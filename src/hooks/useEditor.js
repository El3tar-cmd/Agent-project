// ============================================================
//  src/hooks/useEditor.js  —  Tabbed Editor Management Hook
// ============================================================

import { useState, useCallback } from "react";

export function useEditor(isMobile, setMobileTab, addSys) {
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [selPath, setSelPath] = useState(null);
  const [editorMode, setEditorMode] = useState("edit");

  // Open file in editor tab
  const openFile = useCallback(async (node) => {
    setSelPath(node.path);
    const ex = tabs.find(t => t.path === node.path);
    if (ex) {
      setActiveTab(node.path);
      if (isMobile) setMobileTab("editor");
      return;
    }
    try {
      const d = await fetch(`/api/file?path=${encodeURIComponent(node.path)}`).then(r => r.json());
      if (d.error) return;
      setTabs(ts => [...ts, {
        path: node.path,
        name: node.name,
        ext: node.ext,
        content: d.content,
        original: d.content,
        dirty: false,
        undoStack: [],
        redoStack: []
      }]);
      setActiveTab(node.path);
      if (isMobile) setMobileTab("editor");
    } catch {}
  }, [tabs, isMobile, setMobileTab]);

  // Save file content
  const saveFile = useCallback(async () => {
    const file = tabs.find(t => t.path === activeTab);
    if (!file) return;
    try {
      const d = await fetch(`/api/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: file.path, content: file.content })
      }).then(r => r.json());
      if (d.ok) {
        setTabs(ts => ts.map(t => t.path === file.path ? { ...t, dirty: false, original: file.content } : t));
        addSys(`💾 Saved: ${file.name}`);
      }
    } catch (e) {
      addSys(`❌ ${e.message}`);
    }
  }, [tabs, activeTab, addSys]);

  // Change content (updates undo stack)
  const changeContent = useCallback((content) => {
    setTabs(ts => ts.map(t => {
      if (t.path !== activeTab) return t;
      const undoStack = [...t.undoStack, t.content].slice(-50);
      return { ...t, content, dirty: t.original !== content, undoStack, redoStack: [] };
    }));
  }, [activeTab]);

  // Undo edit
  const undo = useCallback(() => {
    setTabs(ts => ts.map(t => {
      if (t.path !== activeTab || !t.undoStack.length) return t;
      const undoStack = [...t.undoStack];
      const prev = undoStack.pop();
      return { ...t, content: prev, dirty: t.original !== prev, undoStack, redoStack: [...t.redoStack, t.content] };
    }));
  }, [activeTab]);

  // Redo edit
  const redo = useCallback(() => {
    setTabs(ts => ts.map(t => {
      if (t.path !== activeTab || !t.redoStack.length) return t;
      const redoStack = [...t.redoStack];
      const next = redoStack.pop();
      return { ...t, content: next, dirty: t.original !== next, redoStack, undoStack: [...t.undoStack, t.content] };
    }));
  }, [activeTab]);

  // Close active tab
  const closeTab = useCallback((p) => {
    const idx = tabs.findIndex(t => t.path === p);
    const next = tabs[idx + 1] || tabs[idx - 1];
    setTabs(ts => ts.filter(t => t.path !== p));
    setActiveTab(next?.path || null);
  }, [tabs]);

  // Refresh active tabs
  const refreshFiles = useCallback(async () => {
    for (const tab of tabs) {
      try {
        const d = await fetch(`/api/file?path=${encodeURIComponent(tab.path)}`).then(r => r.json());
        if (d.content !== tab.content) {
          setTabs(ts => ts.map(t => t.path === tab.path ? { ...t, content: d.content, dirty: t.original !== d.content } : t));
        }
      } catch {}
    }
  }, [tabs]);

  return {
    tabs,
    setTabs,
    activeTab,
    setActiveTab,
    selPath,
    setSelPath,
    editorMode,
    setEditorMode,
    openFile,
    saveFile,
    changeContent,
    undo,
    redo,
    closeTab,
    refreshFiles
  };
}
