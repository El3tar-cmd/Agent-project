import { useState, useEffect } from "react";

const KEY = "pinned_prompts_v1";

function loadPins() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function PinnedPrompts({ input, setInput }) {
  const [pins, setPins] = useState(loadPins);
  const [editIdx, setEditIdx] = useState(null);
  const [editVal, setEditVal] = useState("");

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(pins));
  }, [pins]);

  const add = () => {
    const text = input.trim();
    if (!text) return;
    if (pins.some(p => p === text)) return;
    setPins(prev => [...prev, text]);
  };

  const remove = (i) => setPins(prev => prev.filter((_, idx) => idx !== i));

  const startEdit = (i) => { setEditIdx(i); setEditVal(pins[i]); };

  const saveEdit = (i) => {
    if (editVal.trim()) {
      setPins(prev => prev.map((p, idx) => idx === i ? editVal.trim() : p));
    }
    setEditIdx(null);
  };

  return (
    <div style={{ marginTop: 4 }}>
      <div className="stitle" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", paddingRight: 12
      }}>
        <span>📌 Pinned Prompts</span>
        <button
          className="ibtn"
          title={input.trim() ? "Pin current input" : "Type something to pin"}
          onClick={add}
          style={{ padding: 2, opacity: input.trim() ? 1 : 0.4 }}
        >
          +
        </button>
      </div>

      {pins.length === 0 && (
        <div style={{ padding: "4px 12px", fontSize: 10, color: "var(--fg3)" }}>
          Type a prompt then click + to pin it
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "0 8px" }}>
        {pins.map((p, i) => (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "var(--bg2)", borderRadius: 6,
              padding: "4px 7px", border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            {editIdx === i ? (
              <>
                <input
                  autoFocus
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") saveEdit(i);
                    if (e.key === "Escape") setEditIdx(null);
                  }}
                  onBlur={() => saveEdit(i)}
                  style={{
                    flex: 1, background: "none", border: "none", outline: "none",
                    fontSize: 10, color: "var(--fg1)", fontFamily: "inherit"
                  }}
                />
              </>
            ) : (
              <>
                <span
                  onClick={() => setInput(p)}
                  style={{
                    flex: 1, fontSize: 10, color: "var(--fg2)", overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer",
                    lineHeight: 1.4
                  }}
                  title={p}
                >
                  {p.length > 60 ? p.slice(0, 60) + "…" : p}
                </span>
                <button
                  className="ibtn"
                  onClick={() => startEdit(i)}
                  title="Edit"
                  style={{ padding: "1px 3px", fontSize: 10, flexShrink: 0, opacity: 0.6 }}
                >
                  ✏
                </button>
                <button
                  className="ibtn"
                  onClick={() => remove(i)}
                  title="Remove"
                  style={{ padding: "1px 3px", fontSize: 11, flexShrink: 0, color: "var(--red)", opacity: 0.7 }}
                >
                  ×
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
