// ============================================================
//  src/components/Swarm/index.jsx  —  Multi-Agent Swarm Panel
// ============================================================

import React, { useState, useEffect, useRef } from "react";

export function AgentCard({ agentId, def, state }) {
  const s = state || {};
  const col = def?.color || "var(--fg3)";
  const borderCol = s.status === "running" ? "var(--cyan2)" : s.status === "done" ? "rgba(63,185,80,.4)" : s.status === "error" ? "rgba(248,81,73,.4)" : "var(--border)";
  return (
    <div style={{ background: "var(--bg2)", border: `1px solid ${borderCol}`, borderRadius: 7, padding: "9px 11px", transition: "all .3s", boxShadow: s.status === "running" ? `0 0 14px ${col}22` : "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
        <span style={{ fontSize: 16 }}>{def?.emoji}</span>
        <span style={{ fontWeight: 600, fontSize: 12 }}>{def?.name}</span>
        {s.status === "running" && <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--cyan)", display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 5, height: 5, background: "var(--cyan)", borderRadius: "50%", animation: "pulse 1s infinite" }}/>running</span>}
        {s.status === "done" && <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--green)" }}>✓ done</span>}
        {s.status === "error" && <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--red)" }}>✗ error</span>}
      </div>
      <div style={{ fontSize: 10, color: "var(--fg3)", marginBottom: s.task ? 5 : 0, lineHeight: 1.4 }}>{def?.description}</div>
      {s.task && <div style={{ fontSize: 10, color: "var(--fg2)", background: "var(--bg)", borderRadius: 4, padding: "3px 6px", marginBottom: 3, lineHeight: 1.5 }}>{s.task?.slice(0, 100)}</div>}
      {s.currentThought && s.status === "running" && <div style={{ fontSize: 10, color: "var(--purple)", marginTop: 3, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>💭 {s.currentThought}</div>}
      {s.lastTool && s.status === "running" && <div style={{ fontSize: 10, color: "var(--green)", marginTop: 2 }}>⚙ {s.lastTool}</div>}
      {s.result && s.status !== "running" && <div style={{ fontSize: 10, color: "var(--fg2)", marginTop: 4, maxHeight: 55, overflow: "hidden", lineHeight: 1.4, borderTop: "1px solid var(--border)", paddingTop: 4 }}>{String(s.result).slice(0, 180)}</div>}
    </div>
  );
}

export function SwarmPanel({ model }) {
  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("");
  const [plan, setPlan] = useState(null);
  const [agentStates, setAS] = useState({});
  const [events, setEvents] = useState([]);
  const [finalMsg, setFinalMsg] = useState("");
  const [agents, setAgents] = useState({});
  const abortRef = useRef(null);
  const evRef = useRef(null);

  useEffect(() => {
    fetch("/api/swarm/agents")
      .then(r => r.json())
      .then(setAgents)
      .catch(() => {});
  }, []);

  useEffect(() => {
    evRef.current?.scrollTo(0, 99999);
  }, [events]);

  const addEv = ev => setEvents(e => [...e.slice(-300), { ...ev, id: Date.now() + Math.random() }]);
  const upd = (id, u) => setAS(s => ({ ...s, [id]: { ...(s[id] || {}), ...u } }));

  const run = async () => {
    if (!task.trim() || running) return;
    setRunning(true);
    setFinalMsg("");
    setPlan(null);
    setAS({});
    setEvents([]);
    
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    
    try {
      const res = await fetch("/api/swarm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, model }),
        signal: ctrl.signal
      });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop();
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const ev = JSON.parse(line.slice(5).trim());
            addEv(ev);
            if (ev.type === "phase")        setPhase(ev.phase);
            if (ev.type === "plan")         setPlan(ev.plan);
            if (ev.type === "agent_start")  upd(ev.agent, { status: "running", task: ev.task, steps: 0 });
            if (ev.type === "agent_step")   upd(ev.agent, { steps: ev.step });
            if (ev.type === "agent_thought")upd(ev.agent, { currentThought: ev.message });
            if (ev.type === "agent_tool")   upd(ev.agent, { lastTool: `${ev.tool}(${JSON.stringify(ev.args || {}).slice(0, 50)})` });
            if (ev.type === "agent_done")   upd(ev.agent, { status: "done", result: ev.result, currentThought: null, lastTool: null });
            if (ev.type === "agent_error")  upd(ev.agent, { status: "error", result: ev.message });
            if (ev.type === "final")        setFinalMsg(ev.message);
          } catch {}
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") addEv({ type: "error", message: e.message });
    }
    setRunning(false);
  };

  const ORDER = ["architect", "researcher", "coder", "reviewer", "tester", "docs", "devops"];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      {/* Top bar */}
      <div style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", background: "var(--bg1)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
          <span style={{ fontSize: 15 }}>🐝</span>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 13 }}>Agent Swarm</span>
          {running && <span style={{ fontSize: 9, color: "var(--cyan)", border: "1px solid var(--cyan)", borderRadius: 999, padding: "1px 6px", animation: "blink 1s infinite" }}>{phase === "planning" ? "🏗 Planning" : phase === "execution" ? "⚡ Executing" : phase === "synthesis" ? "🧬 Synthesizing" : "…"}</span>}
          {!running && finalMsg && <span style={{ fontSize: 9, color: "var(--green)", border: "1px solid rgba(63,185,80,.4)", borderRadius: 999, padding: "1px 6px" }}>✓ Done</span>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <textarea
            style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "7px 10px", color: "var(--fg)", fontFamily: "inherit", fontSize: 11, outline: "none", resize: "none", minHeight: 36, maxHeight: 72, lineHeight: 1.5 }}
            placeholder="Describe a complex task… e.g. 'Add user authentication with JWT to this Express app'"
            value={task}
            onChange={e => setTask(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), run())}
            disabled={running}
            rows={1}
          />
          {running ? (
            <button onClick={() => abortRef.current?.abort()} style={{ padding: "7px 12px", background: "var(--red)", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 11, fontFamily: "inherit", flexShrink: 0 }}>Stop</button>
          ) : (
            <button onClick={run} disabled={!task.trim()} style={{ padding: "7px 12px", background: "var(--cyan2)", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 11, fontFamily: "inherit", flexShrink: 0, opacity: task.trim() ? 1 : .4 }}>🚀 Run</button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0, flexDirection: window.innerWidth < 600 ? "column" : "row" }}>
        {/* Agent Cards */}
        <div style={{ width: window.innerWidth < 600 ? "100%" : 260, flexShrink: 0, overflow: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 7, borderRight: window.innerWidth < 600 ? "none" : "1px solid var(--border)", borderBottom: window.innerWidth < 600 ? "1px solid var(--border)" : "none", maxHeight: window.innerWidth < 600 ? 220 : "none" }}>
          <div style={{ fontSize: 9, color: "var(--fg3)", textTransform: "uppercase", letterSpacing: "1px", flexShrink: 0 }}>Agents</div>
          {plan?.subtasks?.length > 0 && (
            <div style={{ background: "var(--bg2)", border: "1px solid var(--cyan2)", borderRadius: 6, padding: "7px 9px", flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: "var(--cyan)", marginBottom: 3, fontWeight: 600 }}>🏗 Plan — {plan.subtasks.length} tasks</div>
              {plan.subtasks.map(t => (
                <div key={t.id} style={{ fontSize: 9, color: "var(--fg2)", padding: "1px 0", display: "flex", gap: 5 }}>
                  <span style={{ color: agents[t.agent]?.color || "var(--fg3)", flexShrink: 0 }}>{agents[t.agent]?.emoji || "•"}</span>
                  <span style={{ lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.task}</span>
                </div>
              ))}
            </div>
          )}
          {ORDER.filter(id => agents[id]).map(id => (
            <AgentCard key={id} agentId={id} def={agents[id]} state={agentStates[id]} />
          ))}
        </div>

        {/* Live Events + Final synthesis */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          {finalMsg && (
            <div style={{ flexShrink: 0, padding: "10px 12px", borderBottom: "1px solid var(--border)", background: "rgba(63,185,80,.04)", maxHeight: 180, overflowY: "auto" }}>
              <div style={{ fontSize: 10, color: "var(--green)", fontWeight: 600, marginBottom: 5 }}>✓ Swarm Complete</div>
              <div style={{ fontSize: 12, color: "var(--fg)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{finalMsg}</div>
            </div>
          )}
          <div ref={evRef} style={{ flex: 1, overflow: "auto", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontSize: 9, color: "var(--fg3)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 3, flexShrink: 0 }}>Live Events</div>
            {events.length === 0 && !running && (
              <div style={{ color: "var(--fg3)", fontSize: 11, textAlign: "center", marginTop: 30, lineHeight: 2 }}>
                Enter a task and hit Run 🚀<br />Agents will work in parallel
              </div>
            )}
            {events.map(ev => {
              const ag = ev.agent ? agents[ev.agent] : null;
              switch (ev.type) {
                case "phase":        return <div key={ev.id} style={{ fontSize: 10, color: "var(--cyan)", fontWeight: 600, padding: "3px 0", borderTop: "1px solid var(--border)", marginTop: 3 }}>{ev.message}</div>;
                case "plan":         return <div key={ev.id} style={{ fontSize: 10, color: "var(--fg3)", background: "var(--bg2)", borderRadius: 4, padding: "3px 6px" }}>📋 Plan: {ev.plan?.subtasks?.length || 0} subtasks</div>;
                case "batch_start":  return <div key={ev.id} style={{ fontSize: 10, color: "var(--yellow2)", background: "rgba(240,192,96,.07)", border: "1px solid rgba(240,192,96,.2)", borderRadius: 4, padding: "3px 7px" }}>⚡ Parallel: {ev.batch?.map(t => agents[t.agent]?.emoji || t.agent).join(" ")}</div>;
                case "agent_start":  return <div key={ev.id} style={{ fontSize: 10, color: ag?.color || "var(--fg3)" }}>{ag?.emoji} <strong>{ag?.name}</strong> started</div>;
                case "agent_thought":return <div key={ev.id} style={{ fontSize: 10, color: "var(--purple)", paddingLeft: 10, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>💭 [{ag?.name}] {ev.message}</div>;
                case "agent_tool":   return <div key={ev.id} style={{ fontSize: 10, color: "var(--green)", paddingLeft: 10 }}>⚙ [{ag?.name}] {ev.tool}({JSON.stringify(ev.args || {}).slice(0, 60)})</div>;
                case "agent_done":   return <div key={ev.id} style={{ fontSize: 10, color: ag?.color || "var(--green)" }}>✓ <strong>{ag?.name}</strong> done</div>;
                case "agent_error":  return <div key={ev.id} style={{ fontSize: 10, color: "var(--red)" }}>✗ [{ag?.name}] {ev.message}</div>;
                case "final":        return <div key={ev.id} style={{ fontSize: 10, color: "var(--green)", fontWeight: 600 }}>🧬 Synthesis complete</div>;
                case "error":        return <div key={ev.id} style={{ fontSize: 10, color: "var(--red)", background: "rgba(248,81,73,.07)", borderRadius: 4, padding: "3px 6px" }}>✗ {ev.message}</div>;
                default: return null;
              }
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SwarmPanel;
