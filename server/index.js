const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const ACTIONS = require("./Actions");
const cors = require("cors");
const axios = require("axios");
const server = http.createServer(app);
require("dotenv").config();
const docs = new Map(); // Map (or object) storing all document updates per room.
const ROOM_LIMIT = 5; // max users per room

const languageConfig = {
  python3: { versionIndex: "3" },
  java: { versionIndex: "3" },
  cpp: { versionIndex: "4" },
  nodejs: { versionIndex: "3" },
  c: { versionIndex: "4" },
  ruby: { versionIndex: "3" },
  go: { versionIndex: "3" },
  scala: { versionIndex: "3" },
  bash: { versionIndex: "3" },
  sql: { versionIndex: "3" },
  pascal: { versionIndex: "2" },
  csharp: { versionIndex: "3" },
  php: { versionIndex: "3" },
  swift: { versionIndex: "3" },
  rust: { versionIndex: "3" },
  r: { versionIndex: "3" },
};

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

const userSocketMap = {}; // Store the mapping of socket.id to username
const getAllConnectedClients = (roomId) => {
  //to get all users connected to roomId
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId],
      };
    }
  );
};

// When a new client connects to the server through Socket.io
io.on("connection", (socket) => {
  // The client sends roomId (which room to join) and username (who is joining)
  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    const members = io.sockets.adapter.rooms.get(roomId) || new Set();

    if (members.size >= ROOM_LIMIT) {
      // Room full → notify client
      socket.emit(ACTIONS.ROOM_FULL, { message: "Room is full!" });
      return;
    }

    userSocketMap[socket.id] = username;
    socket.join(roomId);
    //update the client list
    const clients = getAllConnectedClients(roomId);

    // Notify and trigger joined event to existing client
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
    });
  });

  // sync the code
  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, update }) => {
    // Merge incoming binary updates into room state
    if (!docs.has(roomId)) docs.set(roomId, []);
    docs.get(roomId).push(update);

    // Broadcast to all other users in the same room
    socket.to(roomId).emit(ACTIONS.CODE_CHANGE, { update });
    //instead of emitting the code, we send only the chnages
    // socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  // when new user join the room all the code which are there are also shows on that persons editor
  socket.on(ACTIONS.SYNC_CODE, ({ socketId, roomId }) => {
    const updates = docs.get(roomId) || [];
    updates.forEach((update) => {
      socket.to(socketId).emit(ACTIONS.CODE_CHANGE, { update });
    });
    //send each update of each room to the new user
    // io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  // ✅ When someone compiles, send output to everyone else in the same room
  socket.on(
    ACTIONS.SYNC_OUTPUT,
    ({ roomId, output, language, triggeredBy }) => {
      socket
        .to(roomId)
        .emit(ACTIONS.SYNC_OUTPUT, { output, language, triggeredBy });
    }
  );

  // when new user join the room all the code which are there are also shows on that persons editor
  socket.on("sync-output-single", ({ socketId, output, language }) => {
    io.to(socketId).emit(ACTIONS.SYNC_OUTPUT, { output, language });
  });

  // Notify all other clients in each room that this user is disconnecting
  socket.on("disconnecting", () => {
    // Get all rooms this socket is currently part of
    // `socket.rooms` is a Set, so we spread it into an array
    const rooms = [...socket.rooms];
    // leave all the room
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });

    delete userSocketMap[socket.id];
    socket.leave();
  });
});

// --------------------------------------------------------------
//    REST API endpoint for code compilation (JDoodle integration)
// --------------------------------------------------------------

app.post("/compile", async (req, res) => {
  const { code, language } = req.body;

  try {
    const response = await axios.post("https://api.jdoodle.com/v1/execute", {
      script: code,
      language: language,
      versionIndex: languageConfig[language].versionIndex,
      clientId: process.env.JDoodle_ClientId,
      clientSecret: process.env.JDoodle_ClientSecret,
    });

    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to compile code" });
  }
});

//-------------------------------------------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------------------------------------
const basicAuth = require("express-basic-auth");
const path = require("path");
// Secure dashboard route with HTTP Basic Auth
app.use(
  "/dashboard",
  basicAuth({
    users: { [process.env.ADMIN_USER]: process.env.ADMIN_PASS },
    challenge: true,
    unauthorizedResponse: "Not allowed",
  })
);

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});
app.get("/rooms", (req, res) => {
  const rooms = {};
  for (let [roomId, socketsSet] of io.sockets.adapter.rooms.entries()) {
    // ignore socket IDs themselves as rooms
    if (!io.sockets.sockets.has(roomId)) {
      const usersInRoom = Array.from(socketsSet).map(socketId => ({
        socketId,
        username: userSocketMap[socketId],
      }));
      rooms[roomId] = usersInRoom;
    }
  }
  res.json(rooms);
});
//----------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------



const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
