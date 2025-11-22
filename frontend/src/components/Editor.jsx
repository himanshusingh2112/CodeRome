import React, { useEffect, useRef } from "react";
import * as Y from "yjs";
import { CodemirrorBinding } from "y-codemirror";
import "codemirror/mode/javascript/javascript";
import "codemirror/theme/dracula.css";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import "codemirror/lib/codemirror.css";
import CodeMirror from "codemirror";
import { ACTIONS } from "../Actions"; 

function Editor({ socketRef, roomId, onCodeChange }) {
  // const editorRef = useRef(null);
  const ydocRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      // 1️⃣ Create a shared Yjs document
      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;
      const yText = ydocRef.current.getText("codemirror");
      yText.observe(() => onCodeChange(yText.toString()));

      const editor = CodeMirror.fromTextArea(
        document.getElementById("realtimeEditor"),
        {
          mode: { name: "javascript", json: true },
          theme: "dracula",
          autoCloseTags: true,
          autoCloseBrackets: true,
          lineNumbers: true,
        }
      );
      // for sync the code
      // editorRef.current = editor;
      editor.setSize(null, "100%");

      // 4️⃣ Bind CodeMirror <-> Yjs shared text
      const binding = new CodemirrorBinding(yText, editor);

      // 5️⃣ When Yjs document updates locally, send to others
      ydoc.on("update", (update) => {
        socketRef.current.emit(ACTIONS.CODE_CHANGE, {
          roomId,
          update: Array.from(update),
        });
      });

      // editorRef.current.on("change", (instance, changes) => {
      //   // console.log("changes", instance ,  changes );
      //   const { origin } = changes;
      //   const code = instance.getValue(); // code has value which we write
      //   onCodeChange(code);
      //   if (origin !== "setValue") {
      //     socketRef.current.emit(ACTIONS.CODE_CHANGE, {
      //       roomId,
      //       code,
      //     });
      //   }
      // });
    };

    init();
  }, []);

  // data receive from server
  useEffect(() => {
    if (socketRef.current) {

      // socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
      //   if (code !== null) {
      //     editorRef.current.setValue(code);
      //   }
      // });

      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ update }) => {
        Y.applyUpdate(ydocRef.current, new Uint8Array(update));
      });
    }
    return () => {
      socketRef.current.off(ACTIONS.CODE_CHANGE);
     
    };
  }, [socketRef.current]);

  return (
    <div style={{ height: "600px" }}>
      <textarea id="realtimeEditor"></textarea>
    </div>
  );
}

export default Editor;
