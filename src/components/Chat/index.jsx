// ============================================================
//  src/components/Chat/index.jsx  —  Interactive Agent Chat Pane
// ============================================================

import React from "react";
import { I } from "../Icons";
import { DiffViewer } from "../Editor";

const QUICK = [
  "list files here",
  "git status",
  "continue last task",
  "what python version?"
];

export function ChatPane({
  msgs,
  running,
  confirm,
  askHuman,
  streamLines,
  planSteps,
  images,
  setImages,
  input,
  setInput,
  send,
  sendWithImages,
  uploadImage,
  handlePaste,
  onKey,
  autoResize,
  bottomRef,
  handleConfirm,
  abortRef,
  setRunning,
  setStatus,
  addSys
}) {
  const isEmpty = msgs.length === 0;

  const renderMsg = m => {
    if (m.role === "user") {
      return (
        <div key={m.id} className="msg msg-user">
          <div className="bubble">{m.content}</div>
        </div>
      );
    }
    if (m.role === "agent") {
      return (
        <div key={m.id} className="msg msg-agent">
          <div className="bubble">{m.content}</div>
        </div>
      );
    }
    if (m.role === "diff") {
      return (
        <div key={m.id} style={{ animation: "fu .2s ease" }}>
          <div style={{ fontSize: 10, color: "var(--fg3)", marginBottom: 4 }}>
            📝 <code style={{ color: "var(--cyan)" }}>{m.path}</code>
          </div>
          <DiffViewer oldText={m.before || ""} newText={m.after || ""} />
        </div>
      );
    }
    if (m.role === "sys") {
      return (
        <div key={m.id} className="msg msg-sys">
          <div className="bubble">{m.content}</div>
        </div>
      );
    }
    if (m.role === "ev") {
      switch (m.type) {
        case "step":
          return <div key={m.id} className="ev ev-step"><I.Term /><span>{m.message}</span></div>;
        case "thought":
          return <div key={m.id} className="ev ev-thought"><I.Brain /><span>{m.message}</span></div>;
        case "tool":
          return <div key={m.id} className="ev ev-tool"><I.Tool /><span style={{ wordBreak: "break-all" }}>{m.message}</span></div>;
        case "result":
          return (
            <div key={m.id} className="ev ev-result">
              <I.Check />
              <div style={{ minWidth: 0 }}>
                <span style={{ color: "var(--fg)" }}>{m.message}</span>
                {m.result && <div className="pre">{m.result}</div>}
              </div>
            </div>
          );
        case "error":
          return <div key={m.id} className="ev ev-error"><I.Stop /><span>{m.message}</span></div>;
        case "warn":
          return <div key={m.id} className="ev ev-warn"><I.Warn /><span>{m.message}</span></div>;
        case "final":
          return <div key={m.id} className="ev ev-final"><I.Check /><span>{m.message}</span></div>;
        default:
          return null;
      }
    }
    return null;
  };

  return (
    <div className="chat-pane">
      <div className="messages">
        {isEmpty ? (
          <div className="empty">
            <I.Bot style={{ opacity: .2, width: 36, height: 36 }} />
            <h3>Coding Agent</h3>
            <p>Chat with your AI coding agent</p>
            <div className="qwrap">
              {QUICK.map(q => (
                <div key={q} className="qbtn" onClick={() => send(q)}>{q}</div>
              ))}
            </div>
          </div>
        ) : (
          msgs.map(renderMsg)
        )}
        
        {running && !confirm && !askHuman && (
          <div className="ev ev-step">
            <div className="typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        {/* Streaming terminal output */}
        {streamLines.length > 0 && (
          <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 5, padding: "6px 10px", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#ccffcc", maxHeight: 120, overflowY: "auto" }}>
            {streamLines.slice(-30).map((l, idx) => (
              <div key={idx} style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{l}</div>
            ))}
          </div>
        )}

        {/* Plan steps */}
        {planSteps.length > 0 && (
          <div style={{ background: "rgba(88,166,255,.06)", border: "1px solid rgba(88,166,255,.2)", borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, color: "var(--cyan)", fontWeight: 600, marginBottom: 5 }}>📋 Plan</div>
            {planSteps.map((s, idx) => (
              <div key={idx} style={{ fontSize: 11, color: "var(--fg2)", padding: "1px 0" }}>{idx + 1}. {s}</div>
            ))}
          </div>
        )}

        {/* Ask human input */}
        {askHuman && (
          <div style={{ background: "var(--bg2)", border: "1px solid var(--cyan2)", borderRadius: 8, padding: "12px", display: "flex", flexDirection: "column", gap: 8, animation: "fu .2s ease" }}>
            <div style={{ fontSize: 12, color: "var(--cyan)", fontWeight: 500 }}>❓ Agent needs clarification</div>
            <div style={{ fontSize: 12, color: "var(--fg)", lineHeight: 1.6 }}>{askHuman.question}</div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                id="ask-human-input"
                style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border2)", borderRadius: 5, padding: "6px 9px", color: "var(--fg)", fontFamily: "inherit", fontSize: 12, outline: "none" }}
                placeholder="Your answer…"
                autoFocus
                onKeyDown={async e => {
                  if (e.key === "Enter" && e.target.value.trim()) {
                    await fetch(`/api/human`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ runId: askHuman.runId, answer: e.target.value.trim() })
                    });
                    setAskHuman(null);
                  }
                }}
              />
              <button
                style={{ padding: "6px 12px", background: "var(--cyan2)", border: "none", borderRadius: 5, color: "#fff", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}
                onClick={async () => {
                  const v = document.getElementById("ask-human-input")?.value?.trim();
                  if (!v) return;
                  await fetch(`/api/human`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ runId: askHuman.runId, answer: v })
                  });
                  setAskHuman(null);
                }}
              >Send</button>
            </div>
          </div>
        )}

        {/* Confirm action requested */}
        {confirm && (
          <div className="confirm">
            <div className="confirm-hd"><I.Warn /> Confirm</div>
            <div style={{ fontSize: 10, color: "var(--fg3)" }}>TOOL: <strong style={{color: "var(--fg)"}}>{confirm.tool}</strong></div>
            <div className="confirm-cmd">{confirm.preview}</div>
            <div className="cbtn-w">
              <button className="byes" onPointerDown={e => { e.preventDefault(); handleConfirm(true); }}>✔ Run</button>
              <button className="bno" onPointerDown={e => { e.preventDefault(); handleConfirm(false); }}>✘ Cancel</button>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Image previews */}
      {images.length > 0 && (
        <div style={{ display: "flex", gap: 6, padding: "4px 10px", flexWrap: "wrap", borderTop: "1px solid var(--border)", background: "var(--bg2)" }}>
          {images.map((img, idx) => (
            <div key={idx} style={{ position: "relative", flexShrink: 0 }}>
              <img src={img.url} alt="" style={{ height: 52, width: 52, objectFit: "cover", borderRadius: 5, border: "1px solid var(--border2)" }} />
              <button
                onClick={() => setImages(prev => prev.filter((_, j) => j !== idx))}
                style={{ position: "absolute", top: -4, right: -4, background: "var(--red)", border: "none", borderRadius: "50%", width: 16, height: 16, color: "#fff", cursor: "pointer", fontSize: 10, lineHeight: "16px", textAlign: "center", padding: 0 }}
              >×</button>
            </div>
          ))}
          <div style={{ fontSize: 10, color: "var(--fg3)", alignSelf: "center" }}>{images.length} image{images.length > 1 ? "s" : ""} attached</div>
        </div>
      )}

      <div className="input-area">
        <div className="inp-wrap">
          <textarea
            className="chat-ta"
            placeholder="Ask the agent… (Ctrl+V to paste image)"
            value={input}
            onChange={e => { setInput(e.target.value); autoResize(e); }}
            onKeyDown={onKey}
            onPaste={handlePaste}
            rows={1}
            disabled={running}
          />
          <div className="hint">Enter send · Shift+Enter newline · Ctrl+V paste image</div>
        </div>
        
        <label style={{ flexShrink: 0, padding: "9px 10px", background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: 8, color: "var(--fg2)", cursor: "pointer", display: "flex", alignItems: "center", minHeight: 38, minWidth: 38, justifyContent: "center" }} title="Attach image">
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const uploaded = await uploadImage(file);
              if (uploaded) {
                setImages(prev => [...prev, uploaded]);
                addSys(`📎 Attached: ${uploaded.name}`);
              }
              e.target.value = "";
            }}
          />
          <I.Copy width={13} height={13} />
        </label>
        
        {running ? (
          <button className="stpbtn" onClick={() => { abortRef.current?.abort(); setRunning(false); setStatus("idle"); }}><I.Stop width={13} height={13}/></button>
        ) : (
          <button className="sbtn" disabled={!input.trim() && images.length === 0} onClick={sendWithImages}><I.Send width={13} height={13} /><span className="send-label">Send</span></button>
        )}
      </div>
    </div>
  );
}

export default ChatPane;
