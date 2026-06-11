// ============================================================
//  src/hooks/useWorkspace.js  —  Workspace, CWD, Memory, and History Hook
// ============================================================

import { useState, useEffect, useCallback } from "react";

export function useWorkspace(addSys) {
  const [cwd, setCwd] = useState("");
  const [cwdInput, setCwdInput] = useState("");
  const [tree, setTree] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [memory, setMemory] = useState({ global: {}, workspaces: {} });
  const [taskHistory, setTaskHistory] = useState([]);
  
  const [newMemKey, setNewMemKey] = useState("");
  const [newMemVal, setNewMemVal] = useState("");

  // Fetch file tree
  const fetchTree = useCallback(async () => {
    try {
      const d = await fetch("/api/tree").then(r => r.json());
      setTree(d.tree || []);
      setCwd(d.cwd || "");
    } catch {}
  }, []);

  // Initialize
  useEffect(() => {
    fetch("/api/cwd")
      .then(r => r.json())
      .then(d => {
        setCwd(d.cwd || "");
        setCwdInput(d.cwd || "");
      })
      .catch(() => {});

    fetch("/api/workspaces")
      .then(r => r.json())
      .then(setWorkspaces)
      .catch(() => {});

    fetch("/api/memory")
      .then(r => r.json())
      .then(setMemory)
      .catch(() => {});

    fetch("/api/history")
      .then(r => r.json())
      .then(setTaskHistory)
      .catch(() => {});

    fetchTree();
  }, [fetchTree]);

  // Sync CWD input
  useEffect(() => {
    if (cwd) setCwdInput(cwd);
  }, [cwd]);

  // CWD management
  const changeCwd = useCallback(async (dir) => {
    try {
      const d = await fetch("/api/cwd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir })
      }).then(r => r.json());
      if (d.cwd) {
        setCwd(d.cwd);
        setCwdInput(d.cwd);
        addSys(`📁 CWD → ${d.cwd}`);
        fetchTree();
      } else {
        addSys(`❌ ${d.error}`);
      }
    } catch (e) {
      addSys(`❌ ${e.message}`);
    }
  }, [fetchTree, addSys]);

  // Memory management
  const addMemory = useCallback(async () => {
    if (!newMemKey.trim()) return;
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: newMemKey, value: newMemVal })
    });
    setMemory(m => ({ ...m, global: { ...m.global, [newMemKey]: newMemVal } }));
    setNewMemKey("");
    setNewMemVal("");
  }, [newMemKey, newMemVal]);

  const delMemory = useCallback(async (key) => {
    await fetch("/api/memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key })
    });
    setMemory(m => {
      const g = { ...m.global };
      delete g[key];
      return { ...m, global: g };
    });
  }, []);

  // Workspace management
  const activateWs = useCallback(async (ws) => {
    const d = await fetch(`/api/workspaces/${ws.id}/activate`, { method: "POST" }).then(r => r.json());
    if (d.ok) {
      setCwd(d.cwd);
      setCwdInput(d.cwd);
      addSys(`🗂 Workspace: ${ws.name}`);
      fetchTree();
    }
  }, [fetchTree, addSys]);

  const addWs = useCallback(async () => {
    const name = prompt("Workspace name:");
    if (!name) return;
    const d = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, cwd })
    }).then(r => r.json());
    setWorkspaces(w => [...w, d]);
  }, [cwd]);

  const delWs = useCallback(async (id) => {
    await fetch(`/api/workspaces/${id}`, { method: "DELETE" });
    setWorkspaces(w => w.filter(x => x.id !== id));
  }, []);

  return {
    cwd,
    setCwd,
    cwdInput,
    setCwdInput,
    tree,
    setTree,
    workspaces,
    setWorkspaces,
    memory,
    setMemory,
    taskHistory,
    setTaskHistory,
    newMemKey,
    setNewMemKey,
    newMemVal,
    setNewMemVal,
    fetchTree,
    changeCwd,
    addMemory,
    delMemory,
    activateWs,
    addWs,
    delWs
  };
}
