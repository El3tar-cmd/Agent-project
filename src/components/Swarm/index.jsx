// ============================================================
//  src/components/Swarm/index.jsx  —  Multi-Agent Swarm Panel
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from "react";

// ── Helpers ────────────────────────────────────────────────────
const PHASE_INFO = {
  planning:   { label: "Planning",   icon: "🏗", color: "var(--cyan)" },
  execution:  { label: "Executing",  icon: "⚡", color: "var(--yellow2)" },
  synthesis:  { label: "Synthesising", icon: "🧬", color: "var(--purple)" },
};

const STATUS_COLOR = {
  running: "var(--cyan)",
  done:    "var(--green)",
  error:   "var(--red)",
  idle:    "var(--fg3)",
};

const STATUS_ICON = {
  running: "●",
  done:    "✓",
  error:   "✗",
  idle:    "○",
};

const QUICK_TASKS = [
  "Write unit tests for this project",
  "Review code for bugs and security issues",
  "Add JSDoc comments to all functions",
  "Create a production Dockerfile",
  "Refactor to use async/await consistently",
  "Find and fix all TODO comments",
];

// ── AgentCard ─────────────────────────────────────────────────
export function AgentCard({ agentId, def, state }) {
  const s        = state || {};
  const col      = def?.color || "var(--fg3)";
  const stColor  = STATUS_COLOR[s.status] || "var(--fg3)";
  const isRun    = s.status === "running";
  const isDone   = s.status === "done";
  const isErr    = s.status === "error";
  const isActive = isRun || isDone || isErr;

  return (
    <div style={{
      background:   "var(--bg2)",
      border:       `1px solid ${isRun ? col + "55" : isActive ? stColor + "33" : "var(--border)"}`,
      borderRadius: 8,
      padding:      "10px 12px",
      transition:   "all .25s",
      boxShadow:    isRun ? `0 0 18px ${col}18` : "none",
      opacity:      !isActive && state === undefined ? 0.5 : 1,
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{def?.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: col }}>{def?.name}</span>
            {isRun && (
              <span style={{ fontSize: 8, color: "var(--cyan)", display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ width: 5, height: 5, background: "var(--cyan)", borderRadius: "50%", animation: "pulse 1s infinite", display: "inline-block" }} />
                running
              </span>
            )}
            {isDone && <span style={{ fontSize: 9, color: "var(--green)", marginLeft: "auto" }}>✓ done</span>}
            {isErr  && <span style={{ fontSize: 9, color: "var(--red)",   marginLeft: "auto" }}>✗ error</span>}
          </div>
          {s.steps > 0 && (
            <div style={{ fontSize: 9, color: "var(--fg3)", marginTop: 1 }}>
              {s.steps} step{s.steps !== 1 ? "s" : ""}
              {s.toolCalls > 0 ? ` · ${s.toolCalls} tool call${s.toolCalls !== 1 ? "s" : ""}` : ""}
            </div>
          )}
        </div>
      </div>

      {/* Task */}
      {s.task && (
        <div style={{
          fontSize: 10, color: "var(--fg2)", background: "var(--bg)", borderRadius: 5,
          padding: "4px 7px", marginBottom: 4, lineHeight: 1.5,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }} title={s.task}>
          {s.task}
        </div>
      )}

      {/* Live thought */}
      {s.currentThought && isRun && (
        <div style={{
          fontSize: 10, color: "var(--purple)", marginBottom: 3,
          fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          paddingLeft: 3, borderLeft: "2px solid var(--purple)",
        }} title={s.currentThought}>
          💭 {s.currentThought}
        </div>
      )}

      {/* Active tool */}
      {s.lastTool && isRun && (
        <div style={{
          fontSize: 10, color: "var(--green)", display: "flex", alignItems: "center", gap: 4,
        }}>
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block", fontSize: 9 }}>⚙</span>
          {s.lastTool}
        </div>
      )}

      {/* Result preview */}
      {s.result && !isRun && (
        <div style={{
          fontSize: 10, color: isErr ? "var(--red)" : "var(--fg3)",
          marginTop: 5, maxHeight: 48, overflow: "hidden", lineHeight: 1.45,
          borderTop: "1px solid var(--border)", paddingTop: 5,
        }}>
          {String(s.result).slice(0, 200)}
        </div>
      )}
    </div>
  );
}

// ── EventRow ──────────────────────────────────────────────────
function EventRow({ ev, agents }) {
  const ag = ev.agent ? agents[ev.agent] : null;
  switch (ev.type) {
    case "phase":
      return (
        <div style={{
          fontSize: 10, fontWeight: 700, color: PHASE_INFO[ev.phase]?.color || "var(--cyan)",
          padding: "5px 0", borderTop: "1px solid var(--border)", marginTop: 4,
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <span>{PHASE_INFO[ev.phase]?.icon}</span>
          <span style={{ textTransform: "uppercase", letterSpacing: ".5px" }}>
            {PHASE_INFO[ev.phase]?.label || ev.phase}
          </span>
        </div>
      );
    case "plan":
      return (
        <div style={{ fontSize: 10, color: "var(--fg3)", background: "var(--bg2)", borderRadius: 4, padding: "3px 7px", border: "1px solid var(--border)" }}>
          📋 Plan: <strong style={{ color: "var(--cyan)" }}>{ev.plan?.subtasks?.length || 0}</strong> subtasks
        </div>
      );
    case "batch_start":
      return (
        <div style={{ fontSize: 10, color: "var(--yellow2)", background: "rgba(240,192,96,.06)", border: "1px solid rgba(240,192,96,.2)", borderRadius: 4, padding: "3px 8px", display: "flex", alignItems: "center", gap: 5 }}>
          ⚡ <span style={{ color: "var(--fg3)" }}>Parallel:</span>
          {ev.batch?.map(t => (
            <span key={t.agent} style={{ color: agents[t.agent]?.color || "var(--fg3)" }}>
              {agents[t.agent]?.emoji} {t.agent}
            </span>
          ))}
        </div>
      );
    case "agent_start":
      return (
        <div style={{ fontSize: 10, color: ag?.color || "var(--fg3)", paddingLeft: 8, display: "flex", alignItems: "center", gap: 4 }}>
          {ag?.emoji} <strong>{ag?.name}</strong>
          <span style={{ color: "var(--fg3)" }}>started</span>
        </div>
      );
    case "agent_thought":
      return (
        <div style={{ fontSize: 10, color: "var(--purple)", paddingLeft: 16, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.85 }} title={ev.message}>
          💭 <span style={{ color: "var(--fg3)" }}>[{ag?.name}]</span> {ev.message}
        </div>
      );
    case "agent_tool":
      return (
        <div style={{ fontSize: 10, color: "var(--green)", paddingLeft: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          ⚙ <span style={{ color: "var(--fg3)" }}>[{ag?.name}]</span>{" "}
          <span style={{ color: "var(--green)" }}>{ev.tool}</span>
          <span style={{ color: "var(--fg3)" }}>({JSON.stringify(ev.args || {}).slice(0, 55)})</span>
        </div>
      );
    case "agent_done":
      return (
        <div style={{ fontSize: 10, color: ag?.color || "var(--green)", paddingLeft: 8, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          ✓ <strong>{ag?.name}</strong> <span style={{ color: "var(--fg3)", fontWeight: 400 }}>done</span>
        </div>
      );
    case "agent_error":
      return (
        <div style={{ fontSize: 10, color: "var(--red)", paddingLeft: 8, background: "rgba(248,81,73,.05)", borderRadius: 3, padding: "2px 8px" }}>
          ✗ <strong>[{ag?.name}]</strong> {ev.message?.slice(0, 80)}
        </div>
      );
    case "final":
      return (
        <div style={{ fontSize: 10, color: "var(--purple)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4, padding: "3px 0" }}>
          🧬 Synthesis complete
        </div>
      );
    case "error":
      return (
        <div style={{ fontSize: 10, color: "var(--red)", background: "rgba(248,81,73,.08)", borderRadius: 4, padding: "4px 8px", border: "1px solid rgba(248,81,73,.2)" }}>
          ✗ {ev.message}
        </div>
      );
    default:
      return null;
  }
}

// ── SwarmPanel ────────────────────────────────────────────────
export function SwarmPanel({ model }) {
  const [task,        setTask]      = useState("");
  const [running,     setRunning]   = useState(false);
  const [phase,       setPhase]     = useState("");
  const [plan,        setPlan]      = useState(null);
  const [agentStates, setAS]        = useState({});
  const [events,      setEvents]    = useState([]);
  const [finalMsg,    setFinalMsg]  = useState("");
  const [agents,      setAgents]    = useState({});
  const [stats,       setStats]     = useState({ steps: 0, tools: 0, startMs: 0, endMs: 0 });
  const [viewMode,    setViewMode]  = useState("split"); // split | events | result
  const [showQuick,   setShowQuick] = useState(false);

  const abortRef = useRef(null);
  const evRef    = useRef(null);

  useEffect(() => {
    fetch("/api/swarm/agents").then(r => r.json()).then(setAgents).catch(() => {});
  }, []);

  useEffect(() => {
    if (evRef.current) evRef.current.scrollTo({ top: 99999, behavior: "smooth" });
  }, [events]);

  const addEv = useCallback(ev => setEvents(e => [...e.slice(-500), { ...ev, id: Date.now() + Math.random() }]), []);
  const upd   = useCallback((id, u) => setAS(s => ({ ...s, [id]: { ...(s[id] || {}), ...u } })), []);

  const run = async () => {
    if (!task.trim() || running) return;
    setRunning(true);
    setFinalMsg("");
    setPlan(null);
    setAS({});
    setEvents([]);
    setStats({ steps: 0, tools: 0, startMs: Date.now(), endMs: 0 });

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/swarm", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ task, model }),
        signal:  ctrl.signal
      });
      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let buf      = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop();
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const ev = JSON.parse(line.slice(5).trim());
            addEv(ev);
            if (ev.type === "phase")          setPhase(ev.phase);
            if (ev.type === "plan")           setPlan(ev.plan);
            if (ev.type === "agent_start")    upd(ev.agent, { status: "running", task: ev.task, steps: 0, toolCalls: 0 });
            if (ev.type === "agent_step")     upd(ev.agent, s => ({ steps: ev.step }));
            if (ev.type === "agent_thought")  upd(ev.agent, { currentThought: ev.message });
            if (ev.type === "agent_tool") {
              upd(ev.agent, s => ({ lastTool: `${ev.tool}(${JSON.stringify(ev.args || {}).slice(0, 45)})`, toolCalls: ((s?.toolCalls) || 0) + 1 }));
              setStats(s => ({ ...s, tools: s.tools + 1 }));
            }
            if (ev.type === "agent_done")     upd(ev.agent, { status: "done", result: ev.result, currentThought: null, lastTool: null });
            if (ev.type === "agent_error")    upd(ev.agent, { status: "error", result: ev.message });
            if (ev.type === "agent_step")     setStats(s => ({ ...s, steps: s.steps + 1 }));
            if (ev.type === "final") {
              setFinalMsg(ev.message);
              setStats(s => ({ ...s, endMs: Date.now() }));
              if (viewMode === "split" || viewMode === "events") setViewMode("result");
            }
          } catch {}
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") addEv({ type: "error", message: e.message });
    }
    setRunning(false);
    setStats(s => ({ ...s, endMs: s.endMs || Date.now() }));
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const reset = () => {
    setTask(""); setFinalMsg(""); setPlan(null); setAS({}); setEvents([]); setPhase(""); setViewMode("split");
  };

  const ORDER        = ["architect", "researcher", "coder", "reviewer", "tester", "docs", "devops"];
  const activeCounts = Object.values(agentStates);
  const doneCount    = activeCounts.filter(s => s.status === "done").length;
  const totalCount   = activeCounts.length;
  const elapsed      = stats.endMs ? ((stats.endMs - stats.startMs) / 1000).toFixed(1) : stats.startMs ? ((Date.now() - stats.startMs) / 1000).toFixed(0) + "…" : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, fontFamily: "inherit" }}>

      {/* ── Header ── */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", background: "var(--bg1)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>🐝</span>
          <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: "-.3px" }}>Agent Swarm</span>
          <span style={{ fontSize: 9, color: "var(--fg3)" }}>·</span>
          <span style={{ fontSize: 9, color: "var(--fg3)" }}>7 agents</span>

          {running && phase && (
            <span style={{
              marginLeft: 4, fontSize: 9, color: PHASE_INFO[phase]?.color || "var(--cyan)",
              border: `1px solid ${PHASE_INFO[phase]?.color || "var(--cyan)"}55`,
              borderRadius: 999, padding: "1px 7px", animation: "blink 1.2s infinite",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              {PHASE_INFO[phase]?.icon} {PHASE_INFO[phase]?.label}
            </span>
          )}
          {!running && finalMsg && (
            <span style={{ marginLeft: 4, fontSize: 9, color: "var(--green)", border: "1px solid rgba(63,185,80,.35)", borderRadius: 999, padding: "1px 7px" }}>
              ✓ Done{elapsed ? ` in ${elapsed}s` : ""}
            </span>
          )}

          {/* Stats chips */}
          {(stats.tools > 0 || stats.steps > 0) && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
              {stats.tools > 0 && <span style={{ fontSize: 9, color: "var(--green)", background: "rgba(63,185,80,.08)", border: "1px solid rgba(63,185,80,.2)", borderRadius: 4, padding: "1px 6px" }}>⚙ {stats.tools} calls</span>}
              {totalCount > 0 && <span style={{ fontSize: 9, color: "var(--cyan)", background: "rgba(56,189,248,.08)", border: "1px solid rgba(56,189,248,.2)", borderRadius: 4, padding: "1px 6px" }}>✓ {doneCount}/{totalCount}</span>}
            </div>
          )}

          {/* Reset */}
          {!running && finalMsg && (
            <button onClick={reset} style={{ marginLeft: stats.tools > 0 ? 0 : "auto", fontSize: 9, color: "var(--fg3)", background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 7px", cursor: "pointer", fontFamily: "inherit" }}>
              ↺ Reset
            </button>
          )}
        </div>

        {/* Input row */}
        <div style={{ display: "flex", gap: 6, position: "relative" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <textarea
              style={{
                width: "100%", boxSizing: "border-box",
                background: "var(--bg2)", border: "1px solid var(--border2)",
                borderRadius: 7, padding: "7px 10px 7px 10px", color: "var(--fg)",
                fontFamily: "inherit", fontSize: 11, outline: "none",
                resize: "none", minHeight: 36, maxHeight: 72, lineHeight: 1.5,
                transition: "border-color .15s",
              }}
              placeholder="Describe a complex task… e.g. 'Add JWT authentication to this Express API'"
              value={task}
              onChange={e => setTask(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), run())}
              onFocus={e => e.target.style.borderColor = "var(--cyan)"}
              onBlur={e => e.target.style.borderColor = "var(--border2)"}
              disabled={running}
              rows={1}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
            {running ? (
              <button onClick={stop} style={{ padding: "7px 12px", background: "var(--red)", border: "none", borderRadius: 7, color: "#fff", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600 }}>⏹ Stop</button>
            ) : (
              <button onClick={run} disabled={!task.trim()} style={{ padding: "7px 14px", background: "var(--cyan2)", border: "none", borderRadius: 7, color: "#fff", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600, opacity: task.trim() ? 1 : .4 }}>🚀 Run</button>
            )}
            <button
              onClick={() => setShowQuick(v => !v)}
              style={{ padding: "3px 7px", background: "none", border: "1px solid var(--border)", borderRadius: 5, color: "var(--fg3)", cursor: "pointer", fontSize: 9, fontFamily: "inherit" }}
              title="Quick task templates"
            >
              ⚡ quick
            </button>
          </div>
        </div>

        {/* Quick tasks dropdown */}
        {showQuick && !running && (
          <div style={{ marginTop: 6, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 7, overflow: "hidden" }}>
            {QUICK_TASKS.map((t, i) => (
              <button
                key={i}
                onClick={() => { setTask(t); setShowQuick(false); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "6px 10px", fontSize: 10, color: "var(--fg2)",
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: "inherit", borderBottom: i < QUICK_TASKS.length - 1 ? "1px solid var(--border)" : "none",
                  transition: "background .1s",
                }}
                onMouseEnter={e => e.target.style.background = "var(--bg3)"}
                onMouseLeave={e => e.target.style.background = "none"}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Plan strip */}
        {plan?.subtasks?.length > 0 && (
          <div style={{ marginTop: 8, background: "rgba(56,189,248,.05)", border: "1px solid rgba(56,189,248,.2)", borderRadius: 6, padding: "6px 9px" }}>
            <div style={{ fontSize: 9, color: "var(--cyan)", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".5px" }}>
              🏗 Plan — {plan.subtasks.length} tasks
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {plan.subtasks.map(t => (
                <div key={t.id} style={{ fontSize: 9, color: "var(--fg2)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 7px", display: "flex", alignItems: "center", gap: 4, maxWidth: 180 }}>
                  <span style={{ color: agents[t.agent]?.color || "var(--fg3)" }}>{agents[t.agent]?.emoji}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.task?.slice(0, 50)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View mode tabs */}
        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
          {[["split", "Split"], ["events", "Events"], ["result", "Result"]].map(([v, l]) => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              fontSize: 9, padding: "2px 8px", borderRadius: 4, fontFamily: "inherit",
              cursor: "pointer", border: "1px solid var(--border)",
              background: viewMode === v ? "var(--cyan2)" : "none",
              color: viewMode === v ? "#fff" : "var(--fg3)",
              fontWeight: viewMode === v ? 700 : 400,
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Agent Cards column — visible in split + events modes */}
        {viewMode !== "result" && (
          <div style={{
            width: 230, flexShrink: 0, overflowY: "auto", padding: "9px 8px",
            display: "flex", flexDirection: "column", gap: 6,
            borderRight: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: 8, color: "var(--fg3)", textTransform: "uppercase", letterSpacing: "1px", paddingLeft: 2, flexShrink: 0 }}>Agents</div>
            {ORDER.filter(id => agents[id]).map(id => (
              <AgentCard key={id} agentId={id} def={agents[id]} state={agentStates[id]} />
            ))}
          </div>
        )}

        {/* Right panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>

          {/* Result panel */}
          {finalMsg && viewMode === "result" && (
            <div style={{
              flex: 1, overflowY: "auto", padding: "14px 16px",
              background: "rgba(63,185,80,.02)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 14 }}>🧬</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)" }}>Synthesis Complete</span>
                {elapsed && <span style={{ fontSize: 10, color: "var(--fg3)", marginLeft: "auto" }}>⏱ {elapsed}s · ⚙ {stats.tools} tool calls</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--fg)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{finalMsg}</div>
            </div>
          )}

          {/* Events feed */}
          {viewMode !== "result" && (
            <div ref={evRef} style={{
              flex: 1, overflowY: "auto", padding: "8px 10px",
              display: "flex", flexDirection: "column", gap: 2,
            }}>
              <div style={{ fontSize: 8, color: "var(--fg3)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4, flexShrink: 0 }}>
                Live Feed {events.length > 0 ? `· ${events.length}` : ""}
              </div>

              {events.length === 0 && !running && (
                <div style={{ color: "var(--fg3)", fontSize: 11, textAlign: "center", marginTop: 40, lineHeight: 2.2 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🐝</div>
                  Enter a task and press Run<br />
                  <span style={{ fontSize: 10 }}>Agents work in parallel to complete complex tasks</span>
                </div>
              )}

              {events.map(ev => <EventRow key={ev.id} ev={ev} agents={agents} />)}
            </div>
          )}

          {/* Final result banner when in split/events mode */}
          {finalMsg && viewMode !== "result" && (
            <div style={{
              flexShrink: 0, padding: "8px 12px", borderTop: "1px solid var(--border)",
              background: "rgba(63,185,80,.04)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 700, flexShrink: 0 }}>✓ Done</span>
              <span style={{ fontSize: 10, color: "var(--fg2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {finalMsg.slice(0, 100)}
              </span>
              <button onClick={() => setViewMode("result")} style={{ fontSize: 9, color: "var(--cyan)", background: "none", border: "1px solid rgba(56,189,248,.3)", borderRadius: 4, padding: "2px 8px", cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>
                View →
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>
    </div>
  );
}

export default SwarmPanel;
