import React, { useEffect, useRef, useState } from "react";
import Client from "./Client";
import Editor from "./Editor";
import { initSocket } from "../Socket";
import { ACTIONS } from "../Actions";
import {
  useNavigate,
  useLocation,
  Navigate,
  useParams,
} from "react-router-dom";
import { toast } from "react-hot-toast";
import axios from "axios";

// List of supported languages
const LANGUAGES = [
  "python3",
  "java",
  "cpp",
  "nodejs",
  "c",
  "ruby",
  "go",
  "scala",
  "bash",
  "sql",
  "pascal",
  "csharp",
  "php",
  "swift",
  "rust",
  "r",
];

function EditorPage() {
  const [clients, setClients] = useState([]);
  const [output, setOutput] = useState("");
  const [isCompileWindowOpen, setIsCompileWindowOpen] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("python3");

  // 🆕 for resizing
  const [compilerHeight, setCompilerHeight] = useState(250);
  const [isResizing, setIsResizing] = useState(false);

  const codeRef = useRef(null);
  const Location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams();

  const socketRef = useRef(null);
  const outputRef = useRef("");

  useEffect(() => {
    outputRef.current = output;
  }, [output]);

  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      const handleErrors = (err) => {
        console.log("Error", err);
        toast.error("Socket connection failed, Try again later");
        navigate("/");
      };

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: Location.state?.username,
      });

      socketRef.current.on(ACTIONS.JOINED, ({ username }) => {
        toast.success(`Joined the room successfully`);
      });

      // Listen for ROOM_FULL event
      socketRef.current.on(ACTIONS.ROOM_FULL, ({ message }) => {
        toast.error(message);
        navigate("/");
      });

      //when new user joined the room
      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, username, socketId }) => {
          if (username !== Location.state?.username) {
            toast.success(`${username} joined the room.`);
          }
          setClients(clients);

          //synced the code for new user
          // socketRef.current.emit(ACTIONS.SYNC_CODE, {
          //   code: codeRef.current,
          //   socketId, //the socket id of new user, it is provided by server in JOINED event
          // });

          socketRef.current.emit(ACTIONS.SYNC_CODE, {
            socketId,
            roomId,
          });

          if (outputRef.current) {
            socketRef.current.emit("sync-output-single", {
              socketId,
              output: outputRef.current,
              language: selectedLanguage,
            });
          }
        }
      );

      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room`);
        setClients((prev) => {
          return prev.filter((client) => client.socketId !== socketId);
        });
      });

      socketRef.current.on(
        ACTIONS.SYNC_OUTPUT,
        ({ output, language, triggeredBy }) => {
          console.log("Received synced output:", output);
          setSelectedLanguage(language);
          setOutput(output);
          setIsCompileWindowOpen(true); // open compiler for all users

          if (triggeredBy && triggeredBy !== Location.state?.username) {
            toast(`${triggeredBy} ran the code.`, { icon: "💻" });
          }
        }
      );
    };
    init();

    return () => {
      socketRef.current && socketRef.current.disconnect();
      socketRef.current.off(ACTIONS.JOINED);
      socketRef.current.off(ACTIONS.DISCONNECTED);
    };
  }, []);

  if (!Location.state) {
    return <Navigate to="/" />;
  }

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success(`Room ID is copied`);
    } catch (error) {
      console.log(error);
      toast.error("Unable to copy the room ID");
    }
  };

  const leaveRoom = async () => {
    navigate("/");
  };

  const [isCooldown, setIsCooldown] = useState(false);

  const runCode = async () => {
    if (!codeRef.current.trim()) {
      toast.error("⚠️ Please write some code before compiling!");
      return;
    }

    if (isCooldown) {
      toast.error("⏳ Please wait 30 seconds before running code again!");
      return;
    }

    setIsCompiling(true);
    setIsCooldown(true); // start cooldown
    const username = Location.state?.username || "Someone";

    try {
      const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/compile`, {
        code: codeRef.current,
        language: selectedLanguage,
      });

      const result = response.data.output || JSON.stringify(response.data);
      setOutput(result);

      // ✅ Emit to others
      socketRef.current.emit(ACTIONS.SYNC_OUTPUT, {
        roomId,
        output: result,
        language: selectedLanguage,
        triggeredBy: username,
      });

      toast.success("Compilation successful!");
    } catch (error) {
      const errMsg = error.response?.data?.error || "An error occurred";
      setOutput(errMsg);

      socketRef.current.emit("sync-output", {
        roomId,
        output: errMsg,
        language: selectedLanguage,
        triggeredBy: username,
      });

      toast.error(errMsg);
    } finally {
      setIsCompiling(false);

      // automatically reset cooldown after 30 seconds
      setTimeout(() => setIsCooldown(false), 30000);
    }
  };

  const toggleCompileWindow = () => {
    setIsCompileWindowOpen(!isCompileWindowOpen);
  };

  // 🧩 Handle mouse drag to resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newHeight = window.innerHeight - e.clientY;
      setCompilerHeight(
        Math.min(Math.max(newHeight, 120), window.innerHeight * 0.9)
      );
    };

    const stopResizing = () => setIsResizing(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopResizing);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing]);

  return (
    <div className="container-fluid vh-100 d-flex flex-column">
      <div className="row flex-grow-1">
        {/* Client panel */}
        <div className="col-md-2 bg-dark text-light d-flex flex-column">
          <img
            src="/images/CodeRome.png"
            alt="Logo"
            className="img-fluid mx-auto"
            style={{ maxWidth: "170px", marginTop: "-23px" }}
          />
          <hr style={{ marginTop: "-2rem" }} />

          {/* Client list container */}
          <div className="d-flex flex-column flex-grow-1 overflow-auto">
            <span className="mb-2">Members</span>
            {clients.map((client) => (
              <Client
                key={client.socketId}
                username={client.username}
                currentUser={Location.state?.username}
              />
            ))}
          </div>

          <hr />
          {/* Buttons */}
          <div className="mt-auto mb-3">
            <button className="btn btn-success w-100 mb-2" onClick={copyRoomId}>
              Copy Room ID
            </button>
            <button className="btn btn-danger w-100" onClick={leaveRoom}>
              Leave Room
            </button>
          </div>
        </div>

        {/* Editor panel */}
        <div className="col-md-10 text-light d-flex flex-column">
          {/* Language selector */}
          <div className="bg-dark p-2 d-flex justify-content-end">
            <select
              className="form-select w-auto"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <Editor
            socketRef={socketRef}
            roomId={roomId}
            onCodeChange={(code) => {
              codeRef.current = code;
            }}
          />
        </div>
      </div>

      {/* Compiler toggle button */}
      <button
        className="btn btn-primary position-fixed bottom-0 end-0 m-3"
        onClick={toggleCompileWindow}
        style={{ zIndex: 1050 }}
      >
        {isCompileWindowOpen ? "Close Compiler" : "Open Compiler"}
      </button>

      {/* 🧱 Compiler Section (Resizable) */}
      <div
        className={`bg-dark text-light p-3 ${
          isCompileWindowOpen ? "d-block" : "d-none"
        }`}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: `${compilerHeight}px`,
          transition: isResizing ? "none" : "height 0.25s ease-in-out",
          overflowY: "auto",
          zIndex: 1040,
          userSelect: isResizing ? "none" : "auto",
        }}
      >
        {/* 🪄 Resize handle */}
        <div
          onMouseDown={() => setIsResizing(true)}
          style={{
            height: "6px",
            cursor: "ns-resize",
            background: "#766e6eff",
            borderRadius: "3px",
            marginBottom: "8px",
          }}
        />

        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="m-0">Compiler Output ({selectedLanguage})</h5>
          <div>
            <button
              className="btn btn-success me-2"
              onClick={runCode}
              disabled={isCompiling}
            >
              {isCompiling ? "Compiling..." : "Run Code"}
            </button>
            <button className="btn btn-secondary" onClick={toggleCompileWindow}>
              Close
            </button>
          </div>
        </div>
        <pre className="bg-secondary p-3 rounded">
          {output || "Output will appear here after compilation"}
        </pre>
      </div>
    </div>
  );
}

export default EditorPage;
