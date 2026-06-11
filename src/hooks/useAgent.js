// ============================================================
//  src/hooks/useAgent.js  —  Core Agent Communication Hook
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";

export function useAgent(fetchTree, refreshFiles, isMobile, setDesktopPanel) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("idle");
  const [models, setModels] = useState([]);
  const [model, setModel] = useState("");
  const [activeTool, setActive] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [stepCount, setStepCount] = useState(0);
  
  const [askHuman, setAskHuman] = useState(null);
  const [planSteps, setPlanSteps] = useState([]);
  const [streamLines, setStreamLines] = useState([]);
  const [images, setImages] = useState([]);
  const [logs, setLogs] = useState([]);

  const abortRef = useRef(null);

  // Fetch available models on mount
  useEffect(() => {
    fetch("/api/models")
      .then(r => r.json())
      .then(ms => {
        setModels(ms);
        if (ms.length) setModel(ms[0]);
      })
      .catch(() => {});
  }, []);

  // Helper actions
  const addMsg = useCallback((role, content) => {
    setMsgs(m => [...m, { id: Date.now() + Math.random(), role, content }]);
  }, []);

  const addSys = useCallback((c) => {
    addMsg("sys", c);
  }, [addMsg]);

  const addEv = useCallback((type, data) => {
    setMsgs(m => [...m, { id: Date.now() + Math.random(), role: "ev", type, ...data }]);
  }, []);

  // Event handler for reasoning SSE stream
  const handleEv = useCallback((ev) => {
    switch (ev.type) {
      case "step":
        setStepCount(n => n + 1);
        addEv("step", { message: ev.message });
        break;
      case "thought":
        addEv("thought", { message: ev.message });
        break;
      case "tool_call":
        setActive(ev.tool);
        addEv("tool", { message: `${ev.tool}(${JSON.stringify(ev.args)})` });
        break;
      case "tool_result":
        setActive(null);
        addEv("result", { message: ev.tool, result: ev.result });
        break;
      case "confirm_request":
        setConfirm({ runId: ev.runId, tool: ev.tool, preview: ev.preview });
        break;
      case "ask_human":
        setAskHuman({ question: ev.question, runId: ev.runId });
        break;
      case "human_answered":
        setAskHuman(null);
        addEv("step", { message: "💬 Human answered" });
        break;
      case "planning":
        addEv("thought", { message: "🏗 Making a plan…" });
        break;
      case "plan_ready":
        setPlanSteps(ev.plan || []);
        addEv("step", { message: `📋 Plan ready — ${ev.plan?.length || 0} steps` });
        break;
      case "summarizing":
        addEv("thought", { message: "📝 Summarizing context…" });
        break;
      case "stream_start":
        setStreamLines([]);
        addEv("tool", { message: `▶ ${ev.command}` });
        if (!isMobile) {
          setDesktopPanel(p => p === "chat" ? p : "processes");
        }
        break;
      case "stream_output":
        setStreamLines(l => [...l.slice(-100), ev.data]);
        break;
      case "stream_end":
        setStreamLines([]);
        break;
      case "inline_diff":
        setMsgs(m => [...m, { id: Date.now() + Math.random(), role: "diff", path: ev.path, before: ev.before, after: ev.after }]);
        break;
      case "final":
        addMsg("agent", ev.message);
        setStatus("idle");
        setAskHuman(null);
        setPlanSteps([]);
        break;
      case "paused":
        addEv("warn", { message: ev.message });
        setStatus("paused");
        break;
      case "error":
        addEv("error", { message: ev.message });
        setStatus("idle");
        break;
      default:
        break;
    }
  }, [isMobile, setDesktopPanel, addEv, addMsg]);

  // Core send function
  const send = useCallback(async (text) => {
    if (!text.trim() || running) return;
    setInput("");
    addMsg("user", text);
    setRunning(true);
    setStatus("running");
    setStepCount(0);
    
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t0 = Date.now();
    
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, model }),
        signal: ctrl.signal
      });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let finalMsg = "";
      
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
            handleEv(ev);
            if (ev.type === "final") finalMsg = ev.message;
          } catch {}
        }
      }
      
      if (finalMsg) {
        const entry = { question: text, answer: finalMsg, steps: stepCount, duration: Math.round((Date.now() - t0) / 1000) };
        await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry)
        }).catch(() => {});
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        addEv("error", { message: `Error: ${e.message}` });
      }
    }
    setRunning(false);
    setActive(null);
    abortRef.current = null;
    await refreshFiles();
    await fetchTree();
  }, [running, model, stepCount, handleEv, addMsg, addEv, refreshFiles, fetchTree]);

  const handleConfirm = useCallback(async (confirmed) => {
    const c = confirm;
    setConfirm(null);
    if (!c) return;
    try {
      await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: c.runId, confirmed })
      });
    } catch {}
  }, [confirm]);

  const clearSession = useCallback(async () => {
    await fetch("/api/state", { method: "DELETE" });
    setMsgs([]);
    setStatus("idle");
    setStepCount(0);
    addSys("Session cleared.");
  }, [addSys]);

  const openLog = useCallback(async () => {
    try {
      const d = await fetch("/api/log").then(r => r.json());
      setLogs(d);
    } catch {}
  }, []);

  const uploadImage = useCallback(async (file) => {
    const ext = file.type.split("/")[1] || "png";
    const reader = new FileReader();
    return new Promise(resolve => {
      reader.onload = async e => {
        const base64 = e.target.result;
        try {
          const d = await fetch(`/api/upload/base64`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: base64, ext, name: `paste_${Date.now()}.${ext}` })
          }).then(r => r.json());
          if (d.ok) resolve(d);
          else resolve(null);
        } catch {
          resolve(null);
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handlePaste = useCallback(async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imgItem = items.find(it => it.type.startsWith("image/"));
    if (!imgItem) return;
    e.preventDefault();
    const file = imgItem.getAsFile();
    if (!file) return;
    const uploaded = await uploadImage(file);
    if (uploaded) {
      setImages(prev => [...prev, uploaded]);
      addSys(`📎 Image attached: ${uploaded.name}`);
    }
  }, [uploadImage, addSys]);

  const sendWithImages = useCallback(() => {
    let msg = input.trim();
    if (!msg && images.length === 0) return;
    if (images.length > 0) {
      const imgPaths = images.map(i => i.path).join(", ");
      msg = msg ? `${msg}\n\n[Attached images: ${imgPaths}]` : `[Attached images: ${imgPaths}]\nDescribe or analyze these images.`;
    }
    setImages([]);
    send(msg);
  }, [input, images, send]);

  return {
    msgs,
    setMsgs,
    input,
    setInput,
    running,
    setRunning,
    status,
    setStatus,
    models,
    setModels,
    model,
    setModel,
    activeTool,
    setActive,
    confirm,
    setConfirm,
    stepCount,
    setStepCount,
    askHuman,
    setAskHuman,
    planSteps,
    setPlanSteps,
    streamLines,
    setStreamLines,
    images,
    setImages,
    logs,
    setLogs,
    abortRef,
    send,
    sendWithImages,
    handleConfirm,
    clearSession,
    openLog,
    uploadImage,
    handlePaste,
    addSys
  };
}
