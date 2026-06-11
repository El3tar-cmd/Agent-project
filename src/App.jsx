// ============================================================
//  src/App.jsx  —  Refactored Layout & Root Component
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import { I, ec } from "./components/Icons";
import { FileNode } from "./components/FileTree";
import { EditorPane } from "./components/Editor";
import { TerminalPanel } from "./components/Terminal";
import { ProcessManager } from "./components/Processes";
import { SwarmPanel } from "./components/Swarm";
import { ChatPane } from "./components/Chat";

import { useWorkspace } from "./hooks/useWorkspace";
import { useEditor } from "./hooks/useEditor";
import { useAgent } from "./hooks/useAgent";

const TOOLS_LIST = [
  "read_file", "write_file", "replace_text", "run_command", "list_files",
  "search_in_files", "create_dir", "delete_file", "http_get", "search_web",
  "python_eval", "git_status", "git_diff", "grep", "cd"
];

export default function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [desktopPanel, setDesktopPanel] = useState("chat");
  const [mobileTab, setMobileTab] = useState("chat");
  const [editorH, setEditorH] = useState(45);
  const [previewUrl, setPreviewUrl] = useState("");
  
  const [showHistory, setShowHistory] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [sidebarOpen, setSidebar] = useState(false);

  const addSysRef = useRef();
  const resizing = useRef(false);

  // ── CUSTOM HOOK INSTANCES ───────────────────────────────
  const workspace = useWorkspace((msg) => addSysRef.current?.(msg));
  const editor = useEditor(isMobile, setMobileTab, (msg) => addSysRef.current?.(msg));
  const agent = useAgent(workspace.fetchTree, editor.refreshFiles, isMobile, setDesktopPanel);

  // Link circular dependency via ref
  addSysRef.current = agent.addSys;

  // ── VH FIX & RESIZE BINDING ──────────────────────────────
  useEffect(() => {
    const f = () => {
      document.documentElement.style.setProperty("--vh", `${window.innerHeight * .01}px`);
      setIsMobile(window.innerWidth < 768);
    };
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  // ── PANE RESIZING ────────────────────────────────────────
  useEffect(() => {
    const mv = e => {
      if (!resizing.current) return;
      const b = document.querySelector(".center");
      if (!b) return;
      const r = b.getBoundingClientRect();
      setEditorH(Math.min(80, Math.max(15, ((e.clientY - r.top) / r.height) * 100)));
    };
    const up = () => {
      resizing.current = false;
    };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", mv);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  const activeFile = editor.tabs.find(t => t.path === editor.activeTab) || null;
  const canUndo = !!activeFile?.undoStack?.length;
  const canRedo = !!activeFile?.redoStack?.length;

  const openLog = async () => {
    await agent.openLog();
    setShowLog(true);
    setSidebar(false);
  };

  // ── DESKTOP RIGHT PANELS ─────────────────────────────────
  const PANEL_TABS = [
    { id: "chat",      label: "Chat",      Icon: I.Chat },
    { id: "editor",    label: "Editor",    Icon: I.File },
    { id: "terminal",  label: "Terminal",  Icon: I.Term },
    { id: "processes", label: "Processes", Icon: () => <span style={{ fontSize: 12 }}>⚙️</span> },
    { id: "preview",   label: "Preview",   Icon: I.Eye },
    { id: "swarm",     label: "Swarm",     Icon: () => <span style={{ fontSize: 12 }}>🐝</span> },
  ];

  const desktopRight = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <div className="panel-tabs">
        {PANEL_TABS.map(p => (
          <button key={p.id} className={`ptab${desktopPanel === p.id ? " active" : ""}`} onClick={() => setDesktopPanel(p.id)}>
            <p.Icon width={12} height={12} /> {p.label}
          </button>
        ))}
        {desktopPanel === "editor" && editor.tabs.map(t => (
          <button key={t.path} className={`ptab${editor.activeTab === t.path ? " active" : ""}`} onClick={() => editor.setActiveTab(t.path)}>
            {t.dirty && <span className="dot2" />}
            <span style={{ color: ec(t.ext) }}>{t.name}</span>
            <button className="ptab-close" onPointerDown={e => { e.stopPropagation(); editor.closeTab(t.path); }}>×</button>
          </button>
        ))}
      </div>
      
      {desktopPanel === "chat" && (
        <ChatPane
          msgs={agent.msgs} running={agent.running} confirm={agent.confirm} askHuman={agent.askHuman}
          streamLines={agent.streamLines} planSteps={agent.planSteps} images={agent.images} setImages={agent.setImages}
          input={agent.input} setInput={agent.setInput} send={agent.send} sendWithImages={agent.sendWithImages}
          uploadImage={agent.uploadImage} handlePaste={agent.handlePaste}
          onKey={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); agent.sendWithImages(); } }}
          autoResize={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 95) + "px"; }}
          bottomRef={agent.bottomRef} handleConfirm={agent.handleConfirm} abortRef={agent.abortRef}
          setRunning={agent.setRunning} setStatus={agent.setStatus} addSys={agent.addSys}
        />
      )}
      {desktopPanel === "editor" && (
        <EditorPane
          file={activeFile} onChange={editor.changeContent} onSave={editor.saveFile}
          editorMode={editor.editorMode} setEditorMode={editor.setEditorMode}
          onUndo={editor.undo} onRedo={editor.redo} canUndo={canUndo} canRedo={canRedo}
        />
      )}
      {desktopPanel === "terminal" && <TerminalPanel cwd={workspace.cwd} />}
      {desktopPanel === "processes" && <ProcessManager />}
      {desktopPanel === "swarm" && <SwarmPanel model={agent.model} />}
      {desktopPanel === "preview" && (
        <div className="preview-wrap">
          <div className="preview-bar">
            <input className="preview-url" value={previewUrl} onChange={e => setPreviewUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && e.target.blur()} placeholder="http://localhost:3000" />
            <button className="ibtn" onClick={() => setPreviewUrl(u => u)}><I.Refresh width={13} height={13} /></button>
          </div>
          {previewUrl ? (
            <iframe className="preview-frame" src={previewUrl} title="preview" />
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContext: "center", color: "var(--fg3)", fontSize: 11, justifyContent: "center" }}>Enter a URL above</div>
          )}
        </div>
      )}
    </div>
  );

  // ── MOBILE TAB CONTENT ───────────────────────────────────
  const MOBILE_TABS = [
    { id: "chat",      label: "Chat",      Icon: I.Chat },
    { id: "editor",    label: "Editor",    Icon: I.File },
    { id: "terminal",  label: "Terminal",  Icon: I.Term },
    { id: "processes", label: "Processes", Icon: () => <span style={{ fontSize: 13 }}>⚙️</span> },
    { id: "swarm",     label: "Swarm",     Icon: () => <span style={{ fontSize: 13 }}>🐝</span> },
  ];

  const mobileContent = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      {mobileTab === "chat" && (
        <ChatPane
          msgs={agent.msgs} running={agent.running} confirm={agent.confirm} askHuman={agent.askHuman}
          streamLines={agent.streamLines} planSteps={agent.planSteps} images={agent.images} setImages={agent.setImages}
          input={agent.input} setInput={agent.setInput} send={agent.send} sendWithImages={agent.sendWithImages}
          uploadImage={agent.uploadImage} handlePaste={agent.handlePaste}
          onKey={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); agent.sendWithImages(); } }}
          autoResize={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 95) + "px"; }}
          bottomRef={agent.bottomRef} handleConfirm={agent.handleConfirm} abortRef={agent.abortRef}
          setRunning={agent.setRunning} setStatus={agent.setStatus} addSys={agent.addSys}
        />
      )}
      {mobileTab === "editor" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flexShrink: 0, borderBottom: "1px solid var(--border)" }}>
            <div style={{ height: 34, display: "flex", alignItems: "center", gap: 5, padding: "0 9px", background: "var(--bg1)" }}>
              <I.Folder width={12} height={12} style={{ color: "var(--yellow2)" }} />
              <span style={{ flex: 1, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{workspace.cwd.split("/").pop() || "Files"}</span>
              <button className="ibtn" onClick={workspace.fetchTree}><I.Refresh width={12} height={12}/></button>
            </div>
            <div style={{ maxHeight: 140, overflowY: "auto" }}>
              {workspace.tree.length ? (
                workspace.tree.map(n => <FileNode key={n.path} node={n} depth={0} onOpen={editor.openFile} selPath={editor.selPath} />)
              ) : (
                <div style={{ padding: "8px 12px", color: "var(--fg3)", fontSize: 11, textAlign: "center" }}>Set CWD first</div>
              )}
            </div>
          </div>
          {editor.tabs.length > 0 && (
            <div className="panel-tabs" style={{ flexShrink: 0 }}>
              {editor.tabs.map(t => (
                <button key={t.path} className={`ptab${editor.activeTab === t.path ? " active" : ""}`} onClick={() => editor.setActiveTab(t.path)}>
                  {t.dirty && <span className="dot2" />}
                  <span style={{ color: ec(t.ext) }}>{t.name}</span>
                  <button className="ptab-close" onPointerDown={e => { e.stopPropagation(); editor.closeTab(t.path); }}>×</button>
                </button>
              ))}
            </div>
          )}
          <EditorPane
            file={activeFile} onChange={editor.changeContent} onSave={editor.saveFile}
            editorMode={editor.editorMode} setEditorMode={editor.setEditorMode}
            onUndo={editor.undo} onRedo={editor.redo} canUndo={canUndo} canRedo={canRedo}
          />
        </div>
      )}
      {mobileTab === "terminal" && <TerminalPanel cwd={workspace.cwd} />}
      {mobileTab === "processes" && <ProcessManager />}
      {mobileTab === "swarm" && <SwarmPanel model={agent.model} />}
    </div>
  );

  return (
    <>
      <div className="overlay" style={{ display: sidebarOpen ? "block" : "none" }} onClick={() => setSidebar(false)} />
      <div className="app">
        {/* HEADER */}
        <header className="header">
          <button className="ibtn menu-btn" onClick={() => setSidebar(o => !o)}>
            {sidebarOpen ? <I.Close width={17} height={17} /> : <I.Menu width={17} height={17} />}
          </button>
          <div className="logo"><div className="dot" /><I.Bot width={17} height={17} /><span>AGENT</span></div>
          <div className="hright">
            {workspace.cwd && <span style={{ fontSize: 9, color: "var(--fg3)", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", direction: "rtl" }}>{workspace.cwd.split("/").slice(-2).join("/")}</span>}
            {agent.stepCount > 0 && <span style={{ fontSize: 10, color: "var(--fg3)" }}>#{agent.stepCount}</span>}
            {agent.activeTool && <span style={{ fontSize: 10, color: "var(--green)", maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>⚙{agent.activeTool}</span>}
            <span className={`badge ${agent.status}`}>{agent.status}</span>
          </div>
        </header>

        {/* BODY */}
        <div className="body">
          {/* SIDEBAR */}
          <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
            <div className="sb-scroll">
              <div className="stitle">Model</div>
              <select className="msel" value={agent.model} onChange={e => agent.setModel(e.target.value)}>
                {agent.models.length ? (
                  agent.models.map(m => <option key={m}>{m}</option>)
                ) : (
                  <option>{agent.model || "…"}</option>
                )}
              </select>

              <div className="stitle" style={{ display: "flex", alignItems: "center", justifyContext: "space-between", paddingRight: 12, justifyContent: "space-between" }}>
                <span>Workspaces</span>
                <button className="ibtn" onClick={workspace.addWs} style={{ padding: 2 }}><I.Plus width={12} height={12} /></button>
              </div>
              <div className="ws-list">
                {workspace.workspaces.map(w => (
                  <div key={w.id} className={`ws-item${w.cwd === workspace.cwd ? " active-ws" : ""}`} onClick={() => workspace.activateWs(w)}>
                    <I.Ws width={11} height={11} style={{ flexShrink: 0, color: "var(--fg3)" }} />
                    <span>{w.name}</span>
                    <button className="ws-del" onPointerDown={e => { e.stopPropagation(); workspace.delWs(w.id); }}>×</button>
                  </div>
                ))}
              </div>

              <div className="stitle">Working Directory</div>
              <div className="cwd-box">
                <div className="cwd-lbl">CWD</div>
                <div className="cwd-row">
                  <input className="cwd-inp" value={workspace.cwdInput} onChange={e => workspace.setCwdInput(e.target.value)} onKeyDown={e => e.key === "Enter" && workspace.changeCwd(workspace.cwdInput)} placeholder="/path/to/project" spellCheck={false} autoCorrect="off" autoCapitalize="off" />
                  <button className="cwd-go" onPointerDown={e => { e.preventDefault(); workspace.changeCwd(workspace.cwdInput); }}>Go</button>
                </div>
              </div>

              <div className="stitle" style={{ marginTop: 4 }}>Actions</div>
              <button className="sbbtn" onClick={() => setShowHistory(true)}><I.History width={13} height={13} /> Task History</button>
              <button className="sbbtn" onClick={() => setShowMemory(true)}><I.Mem width={13} height={13} /> Agent Memory</button>
              <button className="sbbtn" onClick={openLog}><I.Log width={13} height={13} /> View Log</button>
              <button className="sbbtn danger" onClick={agent.clearSession}><I.Trash width={13} height={13} /> Clear Session</button>

              <div className="stitle" style={{ marginTop: 4 }}>Session</div>
              <div className="scard">
                <div className="srow"><span>Status</span><span style={{ color: agent.status === "running" ? "var(--cyan)" : agent.status === "paused" ? "var(--yellow)" : "var(--green)" }}>{agent.status}</span></div>
                <div className="srow"><span>Steps</span><span>{agent.stepCount}</span></div>
              </div>

              <div className="stitle" style={{ marginTop: 4 }}>Tools</div>
              <div className="chips">{TOOLS_LIST.map(t => <div key={t} className={`chip${agent.activeTool === t ? " active" : ""}`}>{t}</div>)}</div>
            </div>
          </aside>

          {/* FILE TREE (desktop only) */}
          {!isMobile && (
            <div className="ftree-panel">
              <div className="ftree-head">
                <I.Folder width={12} height={12} style={{ color: "var(--yellow2)", flexShrink: 0 }} />
                <span title={workspace.cwd}>{workspace.cwd.split("/").pop() || "Files"}</span>
                <button className="ibtn" onClick={workspace.fetchTree}><I.Refresh width={12} height={12} /></button>
              </div>
              <div className="ftree-body">
                {workspace.tree.map(n => (
                  <FileNode key={n.path} node={n} depth={0} onOpen={editor.openFile} selPath={editor.selPath} />
                ))}
              </div>
            </div>
          )}

          {/* CENTER PANEL */}
          <div className="center">
            {isMobile ? (
              mobileContent
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
                <div style={{ height: `${editorH}%`, display: "flex", flexDirection: "column", overflow: "hidden", borderBottom: "1px solid var(--border)" }}>
                  <div className="panel-tabs">
                    {editor.tabs.map(t => (
                      <button key={t.path} className={`ptab${editor.activeTab === t.path ? " active" : ""}`} onClick={() => editor.setActiveTab(t.path)}>
                        {t.dirty && <span className="dot2" />}
                        <span style={{ color: ec(t.ext) }}>{t.name}</span>
                        <button className="ptab-close" onPointerDown={e => { e.stopPropagation(); editor.closeTab(t.path); }}>×</button>
                      </button>
                    ))}
                    <div style={{ marginLeft: "auto", padding: "0 6px", display: "flex", alignItems: "center" }}>
                      <button className="ibtn" onClick={workspace.fetchTree}><I.Refresh width={11} height={11} /></button>
                    </div>
                  </div>
                  <EditorPane
                    file={activeFile} onChange={editor.changeContent} onSave={editor.saveFile}
                    editorMode={editor.editorMode} setEditorMode={editor.setEditorMode}
                    onUndo={editor.undo} onRedo={editor.redo} canUndo={canUndo} canRedo={canRedo}
                  />
                </div>
                <div className="rh" onMouseDown={() => { resizing.current = true; }} />
                {desktopRight}
              </div>
            )}
          </div>
        </div>

        {/* MOBILE TABBAR */}
        <nav className="tabbar">
          {MOBILE_TABS.map(t => (
            <button key={t.id} className={`tab${mobileTab === t.id ? " active" : ""}`} onClick={() => setMobileTab(t.id)}>
              <t.Icon /><span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* HISTORY MODAL */}
      {showHistory && (
        <div className="modal-bg" onClick={() => setShowHistory(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhd"><I.History width={13} height={13} /><span>Task History ({workspace.taskHistory.length})</span>
              <button className="mclose" onClick={() => setShowHistory(false)}>✕</button>
            </div>
            <div className="mbody">
              {workspace.taskHistory.length ? (
                workspace.taskHistory.map(h => (
                  <div key={h.id} className="hist-item" onClick={() => { agent.setInput(h.question); setShowHistory(false); }}>
                    <div className="hist-q">{h.question}</div>
                    <div className="hist-meta">
                      <span>{new Date(h.timestamp).toLocaleDateString()}</span>
                      <span>{h.steps} steps</span>
                      {h.duration && <span>{h.duration}s</span>}
                    </div>
                    {h.answer && <div className="hist-ans">{h.answer}</div>}
                  </div>
                ))
              ) : (
                <div style={{ padding: 16, color: "var(--fg3)", fontSize: 11, textAlign: "center" }}>No history yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MEMORY MODAL */}
      {showMemory && (
        <div className="modal-bg" onClick={() => setShowMemory(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhd"><I.Mem width={13} height={13} /><span>Agent Memory</span>
              <button className="mclose" onClick={() => setShowMemory(false)}>✕</button>
            </div>
            <div className="mbody">
              <div className="mem-add-row">
                <input className="mem-inp" placeholder="key" value={workspace.newMemKey} onChange={e => workspace.setNewMemKey(e.target.value)} />
                <input className="mem-inp" placeholder="value" value={workspace.newMemVal} onChange={e => workspace.setNewMemVal(e.target.value)} onKeyDown={e => e.key === "Enter" && workspace.addMemory()} />
                <button className="cwd-go" onClick={workspace.addMemory}>Add</button>
              </div>
              {Object.entries(workspace.memory.global || {}).length ? (
                Object.entries(workspace.memory.global).map(([k, v]) => (
                  <div key={k} className="mem-item">
                    <span className="mem-key">{k}</span>
                    <span className="mem-val">{v}</span>
                    <button className="mem-del" onClick={() => workspace.delMemory(k)}>×</button>
                  </div>
                ))
              ) : (
                <div style={{ padding: "16px 12px", color: "var(--fg3)", fontSize: 11, textAlign: "center" }}>No memories. Add key-value pairs above.<br /><br />The agent reads these in every conversation.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LOG MODAL */}
      {showLog && (
        <div className="modal-bg" onClick={() => setShowLog(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhd"><I.Log width={13} height={13} /><span>Agent Log</span>
              <button className="mclose" onClick={() => setShowLog(false)}>✕</button>
            </div>
            <div className="mbody">
              {agent.logs.length ? (
                agent.logs.map((el, i) => (
                  <div key={i} style={{ padding: "6px 12px", borderBottom: "1px solid var(--border)", fontSize: 11, color: "var(--fg2)" }}>
                    <span style={{ color: "var(--cyan)", marginRight: 8 }}>#{el.step}</span>
                    <span style={{ color: "var(--green)" }}>{el.tool || el.type || "?"}</span>
                    {el.result && <div className="pre">{el.result}</div>}
                  </div>
                ))
              ) : (
                <div style={{ padding: 16, color: "var(--fg3)", fontSize: 11, textAlign: "center" }}>No log entries</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
