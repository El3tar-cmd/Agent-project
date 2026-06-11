// ============================================================
//  src/components/FileTree/index.jsx  —  Recursive File Explorer Tree
// ============================================================

import React, { useState } from "react";
import { I, ec } from "../Icons";

export function FileNode({ node, depth, onOpen, selPath }) {
  const [open, setOpen] = useState(depth < 2);
  const isDir = node.type === "dir";
  const pad = depth * 11 + 7;
  const col = isDir ? "var(--yellow2)" : ec(node.ext);
  const sel = selPath === node.path;

  if (isDir) {
    return (
      <div>
        <div className={`fnode${sel ? " sel" : ""}`} style={{ paddingLeft: pad }} onClick={() => setOpen(o => !o)}>
          {open ? (
            <I.ChevD width={9} height={9} style={{ flexShrink: 0, color: "var(--fg3)" }} />
          ) : (
            <I.ChevR width={9} height={9} style={{ flexShrink: 0, color: "var(--fg3)" }} />
          )}
          <I.Folder width={12} height={12} style={{ color: col, flexShrink: 0 }} />
          <span className="fnode-name" style={{ color: "var(--fg)" }}>{node.name}</span>
        </div>
        {open && node.children?.map(c => (
          <FileNode key={c.path} node={c} depth={depth + 1} onOpen={onOpen} selPath={selPath} />
        ))}
      </div>
    );
  }

  return (
    <div className={`fnode${sel ? " sel" : ""}`} style={{ paddingLeft: pad + 12 }} onClick={() => onOpen(node)}>
      <I.File width={11} height={11} style={{ color: col, flexShrink: 0 }} />
      <span className="fnode-name" style={{ color: sel ? "var(--cyan)" : "var(--fg2)" }}>{node.name}</span>
    </div>
  );
}

export default FileNode;
