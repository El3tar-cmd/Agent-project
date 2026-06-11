// ============================================================
//  src/components/Terminal/index.jsx  —  xterm-like WebSocket Terminal
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import { I } from "../Icons";

export function TerminalPanel({ cwd }) {
  const [lines, setLines] = useState([{ t: "sys", s: `Terminal — CWD: ${cwd}` }]);
  const [inp, setInp] = useState("");
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const bodyRef = useRef(null);
  const inpRef = useRef(null);

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${proto}://${window.location.host}/terminal`);
    
    socket.onopen = () => {};
    socket.onmessage = e => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "ready") {
          setConnected(true);
          addLine("sys", `Connected ${msg.hasPty ? "(PTY)" : "(basic)"} — ${msg.cwd}`);
        } else if (msg.type === "output") {
          addLine("out", msg.data);
        } else if (msg.type === "exit") {
          addLine("sys", "Process exited");
        }
      } catch {}
    };
    socket.onclose = () => {
      setConnected(false);
      addLine("sys", "Disconnected");
    };
    socket.onerror = () => addLine("err", "WebSocket error");
    
    setWs(socket);
    return () => socket.close();
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo(0, 99999);
  }, [lines]);

  const addLine = (t, s) => {
    setLines(l => [...l, { t, s, id: Date.now() + Math.random() }]);
  };

  const submit = () => {
    if (!inp.trim() || !ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: "input", data: inp + "\n" }));
    addLine("cmd", "$ " + inp);
    setInp("");
  };

  return (
    <div className="term-wrap">
      <div className="term-bar">
        <I.Term width={13} height={13} />
        <span>Terminal</span>
        <span style={{
          fontSize: 9,
          marginLeft: 4,
          padding: "1px 5px",
          borderRadius: 3,
          background: connected ? "rgba(63,185,80,.15)" : "rgba(248,81,73,.15)",
          color: connected ? "var(--green)" : "var(--red)",
          border: `1px solid ${connected ? "var(--green)" : "var(--red)"}`
        }}>
          {connected ? "connected" : "disconnected"}
        </span>
        <button className="ibtn" style={{ marginLeft: "auto" }} onClick={() => setLines([])} title="Clear">
          <I.Clear width={12} height={12} />
        </button>
        <button className="ibtn" onClick={() => {
          if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "input", data: "\x03" }));
        }} title="Ctrl+C" style={{ fontSize: 10, padding: "2px 5px" }}>
          ^C
        </button>
      </div>
      <div className="term-body" ref={bodyRef} onClick={() => inpRef.current?.focus()}>
        {lines.map(l => (
          <div key={l.id} className={`term-line${l.t === "err" ? " err" : l.t === "sys" ? " sys" : ""}`}>
            {l.s}
          </div>
        ))}
      </div>
      <div className="term-input-row">
        <span className="term-prompt">❯</span>
        <input
          ref={inpRef}
          className="term-inp"
          value={inp}
          onChange={e => setInp(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              submit();
            } else if (e.key === "c" && e.ctrlKey && ws?.readyState === 1) {
              ws.send(JSON.stringify({ type: "input", data: "\x03" }));
              setInp("");
            }
          }}
          placeholder="type command…"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={!connected}
        />
      </div>
    </div>
  );
}
export default TerminalPanel;
