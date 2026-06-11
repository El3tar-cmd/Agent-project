// ============================================================
//  src/components/Processes/index.jsx  —  Background Process Manager
// ============================================================

import React, { useState, useEffect, useRef } from "react";

export function ProcessCard({ proc: p, onKill, statusColor, statusDot }) {
  const [expanded, setExpanded] = useState(p.status === "running");
  const outRef = useRef(null);

  // Auto-scroll output
  useEffect(() => {
    if (expanded && outRef.current) {
      outRef.current.scrollTop = outRef.current.scrollHeight;
    }
  }, [p.output, expanded]);

  // Auto-expand when starts running
  useEffect(() => {
    if (p.status === "running") setExpanded(true);
  }, [p.status]);

  const elapsed = p.endedAt
    ? Math.round((new Date(p.endedAt) - new Date(p.startedAt)) / 1000) + "s"
    : p.status === "running" ? "…" : "";

  return (
    <div style={{ borderBottom: "1px solid var(--border)", background: expanded ? "var(--bg2)" : "transparent", transition: "background .2s" }}>
      {/* Row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
        <span style={{ fontSize: 11, color: statusColor(p.status), fontWeight: 600, flexShrink: 0, animation: p.status === "running" ? "spin 1s linear infinite" : undefined }}>
          {statusDot(p.status)}
        </span>
        <span style={{ flex: 1, fontSize: 11, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'JetBrains Mono',monospace" }}>
          {p.cmd}
        </span>
        <span style={{ fontSize: 9, color: "var(--fg3)", flexShrink: 0 }}>{elapsed}</span>
        {p.status === "running" && (
          <button
            onPointerDown={e => {
              e.stopPropagation();
              onKill(p.id);
            }}
            style={{ background: "none", border: "1px solid var(--red)", borderRadius: 3, color: "var(--red)", cursor: "pointer", padding: "1px 5px", fontSize: 9, flexShrink: 0, fontFamily: "inherit" }}
          >Kill</button>
        )}
        <span style={{ fontSize: 9, color: "var(--fg3)", flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Output */}
      {expanded && (
        <div
          ref={outRef}
          style={{
            margin: "0 12px 8px",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 5,
            padding: "7px 10px",
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 11,
            color: "#ccffcc",
            maxHeight: 200,
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            lineHeight: 1.5
          }}
        >
          {p.output || <span style={{ color: "var(--fg3)", fontStyle: "italic" }}>No output yet…</span>}
          {p.status === "running" && <span style={{ color: "var(--cyan)", animation: "blink 1s infinite" }}>▊</span>}
          {p.exitCode != null && p.status !== "running" && (
            <div style={{ marginTop: 6, paddingTop: 4, borderTop: "1px solid var(--border)", color: p.exitCode === 0 ? "var(--green)" : "var(--red)", fontSize: 10 }}>
              EXIT: {p.exitCode}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProcessManager() {
  const [procs, setProcs] = useState([]);
  const [filter, setFilter] = useState("all"); // all | running | done | error

  useEffect(() => {
    // Fetch initial snapshot
    fetch("/api/processes")
      .then(r => r.json())
      .then(setProcs)
      .catch(() => {});

    // Subscribe to SSE stream
    const es = new EventSource("/api/processes/stream");
    es.onmessage = e => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === "snapshot") {
          setProcs(ev.processes);
          return;
        }
        if (ev.type === "process_start") {
          setProcs(p => [ev.process, ...p]);
        }
        if (ev.type === "process_output") {
          setProcs(p => p.map(x => x.id === ev.id ? { ...x, output: (x.output || "") + ev.data } : x));
        }
        if (ev.type === "process_end") {
          setProcs(p => p.map(x => x.id === ev.id ? { ...x, status: ev.status, exitCode: ev.exitCode } : x));
        }
      } catch {}
    };
    return () => es.close();
  }, []);

  const kill = async id => {
    await fetch(`/api/processes/${id}`, { method: "DELETE" });
    setProcs(p => p.map(x => x.id === id ? { ...x, status: "killed" } : x));
  };

  const clearAll = async () => {
    await fetch("/api/processes", { method: "DELETE" });
    setProcs([]);
  };

  const running = procs.filter(p => p.status === "running");
  const filtered = filter === "all" ? procs : procs.filter(p => p.status === filter);

  const statusColor = s => s === "running" ? "var(--cyan)" : s === "done" ? "var(--green)" : s === "error" ? "var(--red)" : "var(--fg3)";
  const statusDot = s => s === "running" ? "⟳" : s === "done" ? "✓" : s === "error" ? "✗" : "○";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "var(--bg1)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
          <span style={{ fontSize: 14 }}>⚙️</span>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 13 }}>Process Manager</span>
          {running.length > 0 && (
            <span style={{ fontSize: 9, color: "var(--cyan)", border: "1px solid var(--cyan)", borderRadius: 999, padding: "1px 6px", animation: "blink 1s infinite" }}>
              {running.length} running
            </span>
          )}
          <button onClick={clearAll} style={{ marginLeft: "auto", background: "none", border: "1px solid var(--border2)", borderRadius: 4, color: "var(--fg3)", cursor: "pointer", padding: "2px 7px", fontSize: 10, fontFamily: "inherit" }}>
            Clear all
          </button>
        </div>
        
        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 4 }}>
          {["all", "running", "done", "error"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{ padding: "2px 9px", background: filter === f ? "var(--bg3)" : "none", border: `1px solid ${filter === f ? "var(--border2)" : "transparent"}`, borderRadius: 4, color: filter === f ? "var(--fg)" : "var(--fg3)", cursor: "pointer", fontSize: 10, fontFamily: "inherit" }}
            >
              {f} {f === "all" ? procs.length : procs.filter(p => p.status === f).length}
            </button>
          ))}
        </div>
      </div>

      {/* Process list */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 0 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--fg3)", fontSize: 11 }}>
            No processes yet.<br />Commands run by the agent will appear here.
          </div>
        ) : (
          filtered.map(p => (
            <ProcessCard key={p.id} proc={p} onKill={kill} statusColor={statusColor} statusDot={statusDot} />
          ))
        )}
      </div>
    </div>
  );
}

export default ProcessManager;
