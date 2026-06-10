#!/usr/bin/env python3
# ============================================================
#  NOVA — Advanced CLI Coding Agent  (2026 Edition)
#  Run: python agent_cli.py
#  Or:  python agent_cli.py "your task here"
# ============================================================

import os, re, sys, json, shutil, subprocess, threading
import base64, mimetypes
from pathlib import Path
from datetime import datetime

try: import readline
except: pass

try: import requests
except: subprocess.run([sys.executable,"-m","pip","install","requests","--break-system-packages","-q"]); import requests

# ─── CONFIG ───────────────────────────────────────────────────
OLLAMA_URL    = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
MODEL         = os.getenv("AGENT_MODEL", "qwen3-coder-next:cloud")
MAX_STEPS     = int(os.getenv("MAX_STEPS", "100"))
CONTEXT_FILE  = ".agent_state.json"
LOG_FILE      = ".agent_log.jsonl"
MAX_CTX_CHARS = 14_000
SCREENSHOT_DIR= Path(".screenshots")
SCREENSHOT_DIR.mkdir(exist_ok=True)
UPLOAD_DIR    = Path(".uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

DANGEROUS_PATTERNS = [r"rm\s+-rf\s+/",r"rm\s+-rf\s+~",r"mkfs",r"dd\s+if=",r":(){:|:&};:",r"sudo\s+rm"]

SYSTEM_PROMPT = """You are NOVA — an advanced AI coding agent (2026). You are a senior full-stack engineer with deep expertise in security, testing, performance, and documentation.

## Available Tools
read_file(path), write_file(path, content), replace_text(path, old, new),
run_command(command), list_files(path), search_in_files(pattern, directory),
create_dir(path), delete_file(path), http_get(url), python_eval(code),
git_status(), git_diff(file?), grep(pattern, path), cd(path),
search_web(query), screenshot(url_or_path), ask_human(question),
show_image(path)

## Response Format
ALWAYS respond with ONLY a single valid JSON object. NO markdown, NO extra text.

Use tool: {"thought":"<why>","tool":"<name>","args":{...}}
Finished: {"thought":"<summary>","final":"<message>"}

## CRITICAL JSON Rules
- Output ONLY the JSON object — nothing before or after
- Never wrap in ```json or any markdown fences
- Escape all special characters in strings

## Engineering Standards (2026)
When building ANY feature, consider ALL layers:
1. Backend: API, business logic, validation, error handling, auth
2. Frontend: UI/UX, accessibility (WCAG 2.2), responsive, performance
3. Security: Input sanitization, SQL injection, XSS, CSRF, secrets in env vars
4. Testing: Unit tests, integration tests, edge cases, error paths
5. Documentation: README, API docs, inline comments, examples
6. Performance: Caching, indexes, bundle size, lazy loading
7. DevOps: Config, health checks, logging, graceful shutdown

Rules:
- NEVER guess file contents — always read_file first
- Use replace_text for small changes, write_file only for new files
- After writing code, verify with run_command
- Use search_web for documentation lookup
- Use screenshot to verify visual output
- Use ask_human when requirements are unclear
- Always think full-stack — backend + frontend + tests + docs"""

# ─── COLORS ───────────────────────────────────────────────────
class C:
    RESET="\033[0m"; BOLD="\033[1m"; DIM="\033[2m"
    RED="\033[91m"; GREEN="\033[92m"; YELLOW="\033[93m"
    BLUE="\033[94m"; CYAN="\033[96m"; WHITE="\033[97m"; PURPLE="\033[95m"

def clr(c,t): return f"{c}{t}{C.RESET}"
def info(m):    print(clr(C.CYAN,    f"  ℹ  {m}"))
def ok(m):      print(clr(C.GREEN,   f"  ✔  {m}"))
def warn(m):    print(clr(C.YELLOW,  f"  ⚠  {m}"))
def err(m):     print(clr(C.RED,     f"  ✘  {m}"))
def thought(t): print(clr(C.DIM,     f"  💭 {t}"))
def tool_ev(n,a):print(clr(C.GREEN,  f"  ⚙  {n}({json.dumps(a,ensure_ascii=False)[:80]})"))
def step_ev(n): print(clr(C.BLUE,    f"\n  {'─'*45}\n  STEP {n}\n  {'─'*45}"))
def result_ev(r):
    lines = str(r).split("\n")
    preview = "\n".join(f"    {l}" for l in lines[:8])
    if len(lines)>8: preview += f"\n    … +{len(lines)-8} lines"
    print(clr(C.DIM, preview))

# ─── STATE ────────────────────────────────────────────────────
def save_state(ctx, hist):
    data = {"saved_at":datetime.now().isoformat(),"context":ctx,"history":hist}
    Path(CONTEXT_FILE).write_text(json.dumps(data,ensure_ascii=False,indent=2))

def load_state():
    if Path(CONTEXT_FILE).exists():
        try:
            d=json.loads(Path(CONTEXT_FILE).read_text())
            return d.get("context",""), d.get("history",[])
        except: pass
    return "", []

def clear_state():
    for f in [CONTEXT_FILE, LOG_FILE]:
        if Path(f).exists(): Path(f).unlink()

def append_log(e):
    with open(LOG_FILE,"a") as f: f.write(json.dumps(e,ensure_ascii=False)+"\n")

# ─── BACKGROUND PROCESS MANAGER ──────────────────────────────
_bg_procs = {}  # id → {cmd, proc, output, status, started}
_bg_id    = [0]

def bg_run(cmd):
    """Run command in background, stream output, track process."""
    if any(re.search(p,cmd) for p in DANGEROUS_PATTERNS):
        return None, "BLOCKED"
    _bg_id[0] += 1
    pid = _bg_id[0]
    entry = {"id":pid,"cmd":cmd,"output":"","status":"running",
             "started":datetime.now().isoformat(),"proc":None}
    _bg_procs[pid] = entry
    print(clr(C.CYAN, f"\n  ▶ [{pid}] {cmd[:70]}"))

    proc = subprocess.Popen(["sh","-c",cmd], stdout=subprocess.PIPE,
                             stderr=subprocess.STDOUT, text=True, bufsize=1)
    entry["proc"] = proc

    def stream():
        for line in proc.stdout:
            entry["output"] += line
            print(clr(C.DIM, f"    {line.rstrip()}"))
        proc.wait()
        entry["status"] = "done" if proc.returncode==0 else "error"
        entry["exitcode"] = proc.returncode
        entry["proc"] = None
        col = C.GREEN if proc.returncode==0 else C.RED
        print(clr(col, f"  ◼ [{pid}] EXIT:{proc.returncode}"))

    t = threading.Thread(target=stream, daemon=True)
    t.start()
    return pid, proc

def list_processes():
    if not _bg_procs:
        print(clr(C.DIM, "  No processes yet."))
        return
    print(clr(C.BOLD, f"\n  {'ID':<4} {'STATUS':<10} {'COMMAND':<50}"))
    print(f"  {'─'*70}")
    for p in _bg_procs.values():
        col = C.CYAN if p["status"]=="running" else C.GREEN if p["status"]=="done" else C.RED
        icon = "🔄" if p["status"]=="running" else "✅" if p["status"]=="done" else "❌"
        print(clr(col, f"  {p['id']:<4} {icon} {p['status']:<8} {p['cmd'][:50]}"))
    print()

def kill_process(pid):
    p = _bg_procs.get(pid)
    if not p: return err(f"Process {pid} not found")
    if p["proc"]: p["proc"].terminate(); p["status"]="killed"; ok(f"Killed [{pid}]")
    else: warn(f"Process [{pid}] already stopped")

# ─── TOOLS ────────────────────────────────────────────────────
CWD = [str(Path.cwd())]  # mutable

def resolve(p):
    return str(Path(CWD[0]) / p) if not Path(p).is_absolute() else p

def read_file(path):
    try: return Path(resolve(path)).read_text(encoding="utf-8",errors="ignore")
    except Exception as e: return f"ERROR: {e}"

def write_file(path, content):
    try:
        p=Path(resolve(path)); p.parent.mkdir(parents=True,exist_ok=True)
        p.write_text(content,encoding="utf-8")
        return f"Saved {path} ({len(content)} chars)"
    except Exception as e: return f"ERROR: {e}"

def replace_text(path, old, new):
    try:
        abs_p = resolve(path)
        t=Path(abs_p).read_text(encoding="utf-8",errors="ignore")
        if old not in t: return f"ERROR: pattern not found in {path}"
        Path(abs_p).write_text(t.replace(old,new,1),encoding="utf-8")
        return f"Updated {path}"
    except Exception as e: return f"ERROR: {e}"

def run_command_stream(cmd, background=False):
    if any(re.search(p,cmd) for p in DANGEROUS_PATTERNS):
        return "BLOCKED: dangerous command."
    if background:
        pid, _ = bg_run(cmd)
        return f"Started in background [PID:{pid}]. Use /ps to monitor."
    try:
        r=subprocess.run(cmd,shell=True,capture_output=True,text=True,timeout=120,cwd=CWD[0])
        out = f"EXIT:{r.returncode}\n{r.stdout.strip()}\n{r.stderr.strip()}".strip()
        # stream output line by line
        for line in out.split("\n")[:20]: print(clr(C.DIM,f"    {line}"))
        if len(out.split("\n"))>20: print(clr(C.DIM,f"    … +{len(out.split(chr(10)))-20} lines"))
        return out
    except subprocess.TimeoutExpired: return "ERROR: timed out (120s)"
    except Exception as e: return f"ERROR: {e}"

def list_files(path="."):
    try:
        entries=sorted(Path(resolve(path)).iterdir(),key=lambda x:(x.is_file(),x.name))
        lines = [f"{'📄' if e.is_file() else '📁'} {e.name}" for e in entries]
        for l in lines: print(clr(C.DIM,f"    {l}"))
        return "\n".join(lines) or "(empty)"
    except Exception as e: return f"ERROR: {e}"

def search_in_files(pattern, directory="."):
    results=[]
    for p in Path(resolve(directory)).rglob("*"):
        if p.is_file():
            try:
                for i,line in enumerate(p.read_text(encoding="utf-8",errors="ignore").splitlines(),1):
                    if pattern.lower() in line.lower(): results.append(f"{p}:{i}: {line.strip()}")
            except: pass
    return "\n".join(results[:50]) if results else f"No matches for '{pattern}'"

def create_dir(path):
    try: Path(resolve(path)).mkdir(parents=True,exist_ok=True); return f"Created: {path}"
    except Exception as e: return f"ERROR: {e}"

def delete_file(path):
    try:
        p=Path(resolve(path))
        if not p.exists(): return f"ERROR: not found: {path}"
        shutil.rmtree(p) if p.is_dir() else p.unlink()
        return f"Deleted: {path}"
    except Exception as e: return f"ERROR: {e}"

def http_get(url):
    if not url.startswith(("http://","https://")): url = "https://"+url
    headers={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}
    try:
        r=requests.get(url,timeout=20,headers=headers,allow_redirects=True)
        ct=r.headers.get("content-type","")
        text=r.text
        if "html" in ct:
            import re as _re
            text=_re.sub(r'<script[\s\S]*?</script>','',text,flags=_re.I)
            text=_re.sub(r'<style[\s\S]*?</style>','',text,flags=_re.I)
            text=_re.sub(r'<[^>]+>',' ',text)
            text=_re.sub(r'\s{3,}','\n',text).strip()
        return f"STATUS:{r.status_code}\n{text[:5000]}"+("…[truncated]" if len(text)>5000 else "")
    except Exception as e: return f"ERROR: {e}"

def search_web(query):
    url=f"https://html.duckduckgo.com/html/?q={requests.utils.quote(query)}&kl=us-en"
    headers={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}
    try:
        r=requests.get(url,timeout=12,headers=headers)
        import re as _re
        links  = _re.findall(r'class="result__a"[^>]*>([^<]+)',r.text)
        snips  = _re.findall(r'class="result__snippet"[^>]*>([\s\S]*?)</a>',r.text)
        results=[]
        for i,(l,s) in enumerate(zip(links[:6],snips[:6])):
            s=_re.sub(r'<[^>]+>','',s).strip()
            results.append(f"[{i+1}] {l.strip()}\n{s}")
        return "\n\n".join(results) if results else f"No results for: {query}"
    except Exception as e: return f"ERROR: {e}"

def screenshot(url_or_path):
    target = url_or_path
    if not target.startswith(("http://","https://","file://")):
        abs_p = resolve(target)
        if Path(abs_p).exists(): target = f"file://{abs_p}"
        else: return f"ERROR: not found: {target}"
    out = SCREENSHOT_DIR / f"shot_{int(datetime.now().timestamp())}.png"
    # try puppeteer via node
    node_script = f"""
const p=require('puppeteer');p.launch({{headless:'new',args:['--no-sandbox','--disable-setuid-sandbox']}}).then(async b=>{{
  const pg=await b.newPage();await pg.setViewport({{width:1280,height:800}});
  await pg.goto('{target}',{{waitUntil:'networkidle2',timeout:30000}});
  await pg.screenshot({{path:'{out}',fullPage:false}});
  await b.close();console.log('OK:{out}');
}}).catch(e=>{{console.error('ERR:'+e.message);process.exit(1)}});"""
    tmp = Path("/tmp/_shot.js"); tmp.write_text(node_script)
    try:
        r = subprocess.run(["node",str(tmp)],capture_output=True,text=True,timeout=35)
        if "OK:" in r.stdout and out.exists():
            ok(f"Screenshot saved: {out}")
            return f"SCREENSHOT:{out}\nURL:{target}"
    except: pass
    # fallback CLI tools
    for cmd in [f'chromium-browser --headless --screenshot="{out}" --window-size=1280,800 "{target}" 2>/dev/null',
                f'google-chrome --headless --screenshot="{out}" --window-size=1280,800 "{target}" 2>/dev/null']:
        try:
            subprocess.run(cmd,shell=True,timeout=30,check=True)
            if out.exists() and out.stat().st_size > 0:
                return f"SCREENSHOT:{out}\nURL:{target}"
        except: pass
    return f"ERROR: Screenshot failed. Install puppeteer: npm install puppeteer\nTarget was: {target}"

def show_image(path):
    abs_p = resolve(path)
    if not Path(abs_p).exists(): return f"ERROR: not found: {path}"
    # try to show in terminal (if supported)
    for viewer in ["eog","display","feh","xdg-open","open"]:
        try:
            subprocess.Popen([viewer,abs_p],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            ok(f"Opening image: {abs_p}")
            return f"Opened in viewer: {abs_p}"
        except: pass
    return f"Image at: {abs_p} (no viewer found — try opening manually)"

def python_eval(code):
    try:
        import io,contextlib; buf=io.StringIO()
        with contextlib.redirect_stdout(buf): exec(code,{"__builtins__":__builtins__})
        out = buf.getvalue()
        for line in out.split("\n")[:10]: print(clr(C.DIM,f"    {line}"))
        return out or "(no output)"
    except Exception as e: return f"ERROR: {e}"

def git_status(): return run_command_stream("git status",background=False)
def git_diff(file=""): return run_command_stream(f"git diff {file}".strip())
def grep(pattern, path="."): return run_command_stream(f'grep -rn "{pattern}" "{resolve(path)}"')
def cd(path):
    abs_p = resolve(path)
    if not Path(abs_p).is_dir(): return f"ERROR: not a directory: {abs_p}"
    CWD[0] = abs_p; ok(f"CWD → {abs_p}"); return f"CWD: {abs_p}"

def ask_human(question):
    print(clr(C.CYAN+C.BOLD, f"\n  ❓ Agent asks: {question}"))
    try: answer = input(clr(C.YELLOW,"  Your answer: ")).strip()
    except: answer = ""
    return answer or "(no answer)"

TOOL_MAP = {
    "read_file":       lambda a: read_file(a.get("path","")),
    "write_file":      lambda a: write_file(a.get("path",""),a.get("content","")),
    "replace_text":    lambda a: replace_text(a.get("path",""),a.get("old",""),a.get("new","")),
    "run_command":     lambda a: run_command_stream(a.get("command",""),a.get("background",False)),
    "list_files":      lambda a: list_files(a.get("path",".")),
    "search_in_files": lambda a: search_in_files(a.get("pattern",""),a.get("directory",".")),
    "create_dir":      lambda a: create_dir(a.get("path","")),
    "delete_file":     lambda a: delete_file(a.get("path","")),
    "http_get":        lambda a: http_get(a.get("url","")),
    "python_eval":     lambda a: python_eval(a.get("code","")),
    "git_status":      lambda a: git_status(),
    "git_diff":        lambda a: git_diff(a.get("file","")),
    "grep":            lambda a: grep(a.get("pattern",""),a.get("path",".")),
    "cd":              lambda a: cd(a.get("path",".")),
    "search_web":      lambda a: search_web(a.get("query",a.get("q",a.get("search","")))),
    "screenshot":      lambda a: screenshot(a.get("url",a.get("path",a.get("file","")))),
    "show_image":      lambda a: show_image(a.get("path",a.get("file",""))),
    "ask_human":       lambda a: ask_human(a.get("question",a.get("q","Can you clarify?"))),
}

CONFIRM_TOOLS = {"delete_file"}

def execute_tool(name, args):
    fn = TOOL_MAP.get(name)
    if not fn: return f"ERROR: unknown tool '{name}'"
    if name in CONFIRM_TOOLS:
        preview = args.get("path","")
        warn(f"DELETE: {preview}")
        try: yn=input(clr(C.YELLOW,"  Confirm? [y/N] ")).strip().lower()
        except: yn="n"
        if yn!="y": return "Cancelled."
    return fn(args)

# ─── ROBUST JSON PARSER ──────────────────────────────────────
def clean_json(raw):
    if not raw: return "{}"
    # strategy 1: direct
    try: json.loads(raw); return raw
    except: pass
    # strategy 2: strip fences
    s = re.sub(r'^```(?:json)?\s*','',raw,flags=re.M)
    s = re.sub(r'\s*```\s*$','',s,flags=re.M).strip()
    try: json.loads(s); return s
    except: pass
    # strategy 3: extract first { ... }
    depth=0; start=-1; in_str=False; esc=False
    for i,c in enumerate(raw):
        if esc: esc=False; continue
        if c=='\\'and in_str: esc=True; continue
        if c=='"': in_str=not in_str; continue
        if in_str: continue
        if c=='{':
            if depth==0: start=i
            depth+=1
        elif c=='}':
            depth-=1
            if depth==0 and start!=-1:
                candidate=raw[start:i+1]
                try: json.loads(candidate); return candidate
                except: pass
    # strategy 4: manual key extraction
    t=re.search(r'"thought"\s*:\s*"((?:[^"\\]|\\.)*)"',raw)
    tl=re.search(r'"tool"\s*:\s*"([^"]+)"',raw)
    fn=re.search(r'"final"\s*:\s*"((?:[^"\\]|\\.)*)"',raw)
    thought_v = t.group(1) if t else ""
    if tl: return json.dumps({"thought":thought_v,"tool":tl.group(1),"args":{}})
    if fn: return json.dumps({"thought":thought_v,"final":fn.group(1)})
    return json.dumps({"__plain__":True,"text":raw})

# ─── OLLAMA ───────────────────────────────────────────────────
def ask_ollama(messages):
    try:
        r=requests.post(OLLAMA_URL,json={
            "model":MODEL,"messages":messages,"stream":False,
            "options":{"temperature":0.2}
        },timeout=300)
        r.raise_for_status()
        return r.json()["message"]["content"]
    except Exception as e:
        return json.dumps({"thought":"API error","final":f"Ollama error: {e}"})

# ─── AGENT LOOP ───────────────────────────────────────────────
def run_agent(user_request, context, chat_history, image_paths=None):
    cwd_note = f"\n\n## Current Working Directory\n{CWD[0]}"
    resume   = f"\n\n## Resumed Session\n{context}" if context else ""
    sys_p    = SYSTEM_PROMPT + cwd_note + resume

    messages = [{"role":"system","content":sys_p}] + chat_history

    # attach images to user message
    user_content = user_request
    if image_paths:
        img_list = ", ".join(str(p) for p in image_paths)
        user_content += f"\n\n[Attached images: {img_list}]"

    messages.append({"role":"user","content":user_content})

    ctx = context
    for n in range(1, MAX_STEPS+1):
        step_ev(n)
        raw  = ask_ollama(messages)
        cleaned = clean_json(raw)
        try:
            data = json.loads(cleaned)
        except:
            ok("Plain text response.")
            messages.append({"role":"assistant","content":raw})
            ctx += f"\n\n[Step {n}] Final: {raw[:500]}"
            save_state(ctx, messages[2:])
            return raw, ctx, messages[2:]

        if data.get("__plain__"):
            ok("Response."); print(f"\n  {data['text'][:500]}\n")
            messages.append({"role":"assistant","content":raw})
            ctx += f"\n\n[Step {n}] Final: {data['text'][:300]}"
            save_state(ctx, messages[2:])
            return data["text"], ctx, messages[2:]

        if data.get("thought"): thought(data["thought"])

        if "final" in data:
            ok("Done.")
            messages.append({"role":"assistant","content":raw})
            ctx += f"\n\n[Step {n}] Final: {data['final'][:300]}"
            save_state(ctx, messages[2:]); append_log({"step":n,"final":data["final"]})
            return data["final"], ctx, messages[2:]

        tool_name = data.get("tool")
        args      = data.get("args",{})
        if not tool_name:
            messages.append({"role":"assistant","content":raw}); continue

        tool_ev(tool_name, args)
        result = execute_tool(tool_name, args)
        result_ev(result)
        messages.append({"role":"assistant","content":raw})
        messages.append({"role":"user","content":f"[Tool result: {tool_name}]\n{result}"})
        ctx += f"\n\n[Step {n}] {tool_name}: {str(result)[:300]}"
        if len(ctx) > MAX_CTX_CHARS:
            ctx = f"[Original task]\n{user_request}\n\n[...trimmed...]\n\n{ctx[-4000:]}"
        append_log({"step":n,"tool":tool_name,"args":args,"result":str(result)[:300]})

    warn(f"Reached {MAX_STEPS} steps. State saved. Type 'continue' to resume.")
    save_state(ctx, messages[2:])
    return "PAUSED", ctx, messages[2:]

# ─── ATTACH IMAGE HELPER ─────────────────────────────────────
def attach_image(path):
    abs_p = Path(resolve(path))
    if not abs_p.exists(): err(f"File not found: {path}"); return None
    dest = UPLOAD_DIR / f"cli_{int(datetime.now().timestamp())}_{abs_p.name}"
    shutil.copy(abs_p, dest)
    ok(f"Attached: {dest}")
    return dest

# ─── MAIN ─────────────────────────────────────────────────────
def main():
    global MODEL
    print(clr(C.BOLD+C.BLUE,"""
  ╔══════════════════════════════════════════╗
  ║   NOVA — Advanced CLI Coding Agent       ║
  ║   2026 Edition  •  Powered by Ollama     ║
  ╚══════════════════════════════════════════╝
"""))
    context, chat_history = load_state()
    if context: warn(f"Resumed session. Type 'continue' to pick up.")
    else: info(f"CWD: {CWD[0]}")
    print(clr(C.DIM,"  /help for commands\n"))

    pending_images = []

    # one-shot mode: python agent_cli.py "task"
    if len(sys.argv) > 1:
        task = " ".join(sys.argv[1:])
        answer, context, chat_history = run_agent(task, context, chat_history)
        if answer != "PAUSED": print(f"\n{clr(C.GREEN+C.BOLD,'  NOVA:')}\n  {answer}\n")
        return

    while True:
        try:
            prompt = clr(C.BOLD+C.WHITE, f"[{Path(CWD[0]).name}]>>> ")
            user = input(prompt).strip()
        except (EOFError,KeyboardInterrupt): print(); break
        if not user: continue

        lo = user.lower()

        # ── built-in commands ──────────────────────────────────
        if lo in ("exit","quit"): ok("Bye!"); break

        if lo == "/help":
            print(f"""
  {clr(C.BOLD,'Commands:')}
  exit/quit          Exit
  /clear             Clear session
  /status            Session info
  /log               Last 10 log entries
  /model <name>      Switch model
  /tools             List all tools
  /ps                Show background processes
  /kill <id>         Kill background process
  /attach <path>     Attach image to next message
  /screenshot <url>  Take screenshot
  /cwd               Show current directory
  /cd <path>         Change directory
  continue           Resume paused session
"""); continue

        if lo == "/clear":
            clear_state(); context,chat_history=[],[]
            pending_images=[]; ok("Cleared."); continue

        if lo == "/status":
            info(f"Model: {MODEL}")
            info(f"CWD: {CWD[0]}")
            info(f"Context: {len(context)} chars")
            info(f"History: {len(chat_history)} messages")
            if pending_images: info(f"Pending images: {len(pending_images)}")
            continue

        if lo == "/ps": list_processes(); continue

        if lo.startswith("/kill "):
            try: kill_process(int(lo.split()[1]))
            except: err("Usage: /kill <id>")
            continue

        if lo.startswith("/model "):
            MODEL = user[7:].strip(); ok(f"Model: {MODEL}"); continue

        if lo == "/tools":
            print("\n  " + "\n  ".join(f"• {t}" for t in TOOL_MAP) + "\n"); continue

        if lo == "/cwd": info(f"CWD: {CWD[0]}"); continue

        if lo.startswith("/cd "):
            cd(user[4:].strip()); continue

        if lo.startswith("/attach "):
            img = attach_image(user[8:].strip())
            if img: pending_images.append(img)
            continue

        if lo.startswith("/screenshot "):
            target = user[12:].strip()
            result = screenshot(target)
            info(result)
            # offer to attach
            if "SCREENSHOT:" in result:
                path = result.split("SCREENSHOT:")[1].split("\n")[0].strip()
                pending_images.append(Path(path))
                info("Screenshot attached to next message.")
            continue

        if lo == "/log":
            if Path(LOG_FILE).exists():
                for line in Path(LOG_FILE).read_text().splitlines()[-10:]:
                    try:
                        e=json.loads(line)
                        print(f"  Step {e.get('step','?')} │ {e.get('tool',e.get('final','?'))[:60]}")
                    except: print(f"  {line[:60]}")
            else: info("No log yet.")
            continue

        if lo == "continue":
            if not context: warn("No paused session."); continue
            user = "Continue the previous task from where you left off."

        # ── run agent ─────────────────────────────────────────
        imgs = pending_images.copy()
        pending_images.clear()
        answer, context, chat_history = run_agent(user, context, chat_history, imgs)

        print()
        if answer == "PAUSED":
            warn(f"Paused. Type 'continue' to resume.")
        else:
            print(clr(C.BOLD+C.GREEN,"  NOVA:"))
            for line in answer.splitlines(): print(f"  {line}")
        print()

if __name__ == "__main__":
    main()
