// ============================================================
//  src/components/Editor/index.jsx  —  Code Editor & Diff Viewer
// ============================================================

import React, { useState, useEffect, useRef, useMemo } from "react";
import { I, ec } from "../Icons";

// ── KEYWORDS FOR HIGHLIGHTING ──────────────────────────────
const KEYWORDS = /\b(import|export|from|const|let|var|function|class|return|if|else|for|while|do|switch|case|break|continue|new|this|typeof|instanceof|async|await|try|catch|finally|throw|in|of|default|extends|super|static|get|set|null|undefined|true|false|yield|delete|void|type|interface|enum|def|self|pass|lambda|with|as|not|and|or|is|elif|except|raise|global|nonlocal)\b/g;

function highlight(code) {
  if (!code) return "";
  const lines = code.split("\n");
  const limited = lines.slice(0, 500).join("\n");
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safe = esc(limited);
  try {
    return safe
      .replace(/(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/g, m => `<span style="color:#6e7681;font-style:italic">${m}</span>`)
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, m => `<span style="color:#a5d6ff">${m}</span>`)
      .replace(KEYWORDS, m => `<span style="color:#ff7b72;font-weight:500">${m}</span>`)
      .replace(/\b(\d+\.?\d*)\b/g, m => `<span style="color:#79c0ff">${m}</span>`)
      .replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g, m => `<span style="color:#d2a8ff">${m}</span>`)
      + (lines.length > 500 ? "\n<span style='color:#6e7681'>// ... truncated for display ...</span>" : "");
  } catch {
    return safe;
  }
}

// ── DIFF COMPUTATION ────────────────────────────────────────
function computeDiff(oldT, newT) {
  const ol = (oldT || "").split("\n");
  const nl = (newT || "").split("\n");
  const m = ol.length, n = nl.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = ol[i - 1] === nl[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const seq = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (ol[i - 1] === nl[j - 1]) {
      seq.unshift([i - 1, j - 1]);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  const res = [];
  let oi = 0, ni = 0, mi = 0;
  while (mi < seq.length || oi < ol.length || ni < nl.length) {
    const [mo, mn] = mi < seq.length ? seq[mi] : [ol.length, nl.length];
    while (oi < mo) {
      res.push({ type: "del", old: oi + 1, new: null, text: ol[oi] });
      oi++;
    }
    while (ni < mn) {
      res.push({ type: "add", old: null, new: ni + 1, text: nl[ni] });
      ni++;
    }
    if (mi < seq.length) {
      res.push({ type: "ctx", old: oi + 1, new: ni + 1, text: ol[oi] });
      oi++; ni++; mi++;
    }
  }
  return res;
}

function collapseDiff(lines) {
  const ch = new Set();
  lines.forEach((l, idx) => {
    if (l.type !== "ctx") {
      for (let k = Math.max(0, idx - 3); k <= Math.min(lines.length - 1, idx + 3); k++) {
        ch.add(k);
      }
    }
  });
  const out = [];
  let skip = false;
  lines.forEach((l, idx) => {
    if (ch.has(idx)) {
      skip = false;
      out.push(l);
    } else if (!skip) {
      skip = true;
      out.push({ type: "hdr", text: "@@ ... @@" });
    }
  });
  return out;
}

export function DiffViewer({ oldText, newText }) {
  const raw = computeDiff(oldText, newText);
  const lines = collapseDiff(raw);
  if (!raw.some(l => l.type !== "ctx")) {
    return <div className="no-diff">✓ No changes</div>;
  }
  return (
    <div className="diff-view">
      {lines.map((l, idx) => {
        if (l.type === "hdr") return <div key={idx} className="diff-hdr">{l.text}</div>;
        const cls = l.type === "add" ? "add" : l.type === "del" ? "del" : "ctx";
        const sign = l.type === "add" ? "+" : l.type === "del" ? "-" : " ";
        const sc = l.type === "add" ? "a" : l.type === "del" ? "d" : "";
        return (
          <div key={idx} className={`diff-line ${cls}`}>
            <span className="diff-ln">{l.old || ""}</span>
            <span className="diff-ln">{l.new || ""}</span>
            <span className={`diff-sign ${sc}`}>{sign}</span>
            <span className="diff-txt">{l.text}</span>
          </div>
        );
      })}
    </div>
  );
}

export function EditorPane({
  file,
  onChange,
  onSave,
  editorMode,
  setEditorMode,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}) {
  const taRef = useRef(null);
  const numRef = useRef(null);
  const [hlHtml, setHlHtml] = useState("");

  const lineCount = file ? file.content.split("\n").length : 0;
  const lineNums = useMemo(() =>
    Array.from({ length: lineCount }, (_, idx) => idx + 1).join("\n"),
    [lineCount]
  );

  useEffect(() => {
    if (!file?.content) {
      setHlHtml("");
      return;
    }
    const id = setTimeout(() => {
      try {
        setHlHtml(highlight(file.content));
      } catch {
        setHlHtml("");
      }
    }, 80);
    return () => clearTimeout(id);
  }, [file?.content]);

  const syncScroll = e => {
    if (numRef.current) numRef.current.scrollTop = e.target.scrollTop;
  };

  const handleTab = e => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const ta = e.target;
    const s = ta.selectionStart, en = ta.selectionEnd;
    const v = ta.value;
    const nv = v.slice(0, s) + "  " + v.slice(en);
    onChange(nv);
    requestAnimationFrame(() => {
      if (taRef.current) {
        taRef.current.selectionStart = taRef.current.selectionEnd = s + 2;
      }
    });
  };

  if (!file) {
    return (
      <div className="ed-empty">
        <I.File width={36} height={36} />
        <p>Open a file from the tree</p>
      </div>
    );
  }

  return (
    <div className="editor-wrap">
      <div className="ebar">
        <button className={`eact${editorMode === "edit" ? " on" : ""}`} onClick={() => setEditorMode("edit")}>
          <I.File width={10} height={10} /> Edit
        </button>
        <button className={`eact${editorMode === "diff" ? " on" : ""}`} onClick={() => setEditorMode("diff")}>
          <I.Diff width={10} height={10} /> Diff
        </button>
        <button className="eact" onClick={onUndo} disabled={!canUndo} title="Undo">
          <I.Undo width={10} height={10} />
        </button>
        <button className="eact" onClick={onRedo} disabled={!canRedo} title="Redo">
          <I.Redo width={10} height={10} />
        </button>
        <span style={{ flex: 1 }} />
        {file.dirty && <span style={{ fontSize: 10, color: "var(--yellow)" }}>●</span>}
        <span style={{ fontSize: 9, color: "var(--fg3)", marginRight: 4 }}>{lineCount}L</span>
        <button className="eact on" onClick={onSave}>
          <I.Save width={10} height={10} /> Save
        </button>
      </div>

      <div className="editor-body">
        {editorMode === "edit" ? (
          <div className="code-wrap">
            <div ref={numRef} className="line-nums">{lineNums}</div>
            <div className="code-editor-area">
              {hlHtml && (
                <div
                  className="code-hl"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: hlHtml }}
                />
              )}
              <textarea
                ref={taRef}
                className="code-ta"
                value={file.content}
                onChange={e => onChange(e.target.value)}
                onScroll={syncScroll}
                onKeyDown={handleTab}
                style={{ color: hlHtml ? "transparent" : "var(--fg)", caretColor: "var(--cyan)" }}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="off"
              />
            </div>
          </div>
        ) : (
          file.original != null ? (
            <DiffViewer oldText={file.original} newText={file.content} />
          ) : (
            <div className="no-diff">No original to diff</div>
          )
        )}
      </div>
    </div>
  );
}
