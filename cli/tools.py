# ============================================================
#  cli/tools.py  —  CLI Agent Tools Implementation
# ============================================================

import os
import re
import sys
import json
import shutil
import subprocess
import threading
from pathlib import Path
from datetime import datetime

# Import UI helpers
from cli.ui import ok, warn, err, info, clr, C

try:
    import requests
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "requests", "--break-system-packages", "-q"])
    import requests

# ─── CONFIG ───────────────────────────────────────────────────
DANGEROUS_PATTERNS = [
    r"rm\s+-rf\s+/",
    r"rm\s+-rf\s+~",
    r"mkfs",
    r"dd\s+if=",
    r":\(\)\{:\|:&\};:",
    r"sudo\s+rm"
]

SCREENSHOT_DIR = Path(".screenshots")
SCREENSHOT_DIR.mkdir(exist_ok=True)

UPLOAD_DIR = Path(".uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

CWD = [str(Path.cwd())]  # mutable list to allow updates in other modules

_bg_procs = {}  # id → {cmd, proc, output, status, started}
_bg_id = [0]

# ─── PATH RESOLVER ────────────────────────────────────────────
def resolve(p):
    return str(Path(CWD[0]) / p) if not Path(p).is_absolute() else p

# ─── BACKGROUND PROCESSES ─────────────────────────────────────
def bg_run(cmd):
    """Run command in background, stream output, track process."""
    if any(re.search(p, cmd) for p in DANGEROUS_PATTERNS):
        return None, "BLOCKED"
    _bg_id[0] += 1
    pid = _bg_id[0]
    entry = {
        "id": pid,
        "cmd": cmd,
        "output": "",
        "status": "running",
        "started": datetime.now().isoformat(),
        "proc": None
    }
    _bg_procs[pid] = entry
    print(clr(C.CYAN, f"\n  ▶ [{pid}] {cmd[:70]}"))

    proc = subprocess.Popen(["sh", "-c", cmd], stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True, bufsize=1)
    entry["proc"] = proc

    def stream():
        for line in proc.stdout:
            entry["output"] += line
            print(clr(C.DIM, f"    {line.rstrip()}"))
        proc.wait()
        entry["status"] = "done" if proc.returncode == 0 else "error"
        entry["exitcode"] = proc.returncode
        entry["proc"] = None
        col = C.GREEN if proc.returncode == 0 else C.RED
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
        col = C.CYAN if p["status"] == "running" else C.GREEN if p["status"] == "done" else C.RED
        icon = "🔄" if p["status"] == "running" else "✅" if p["status"] == "done" else "❌"
        print(clr(col, f"  {p['id']:<4} {icon} {p['status']:<8} {p['cmd'][:50]}"))
    print()

def kill_process(pid):
    p = _bg_procs.get(pid)
    if not p:
        return err(f"Process {pid} not found")
    if p["proc"]:
        p["proc"].terminate()
        p["status"] = "killed"
        ok(f"Killed [{pid}]")
    else:
        warn(f"Process [{pid}] already stopped")

# ─── INDIVIDUAL TOOLS ─────────────────────────────────────────
def read_file(path):
    try:
        return Path(resolve(path)).read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        return f"ERROR: {e}"

def write_file(path, content):
    try:
        p = Path(resolve(path))
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return f"Saved {path} ({len(content)} chars)"
    except Exception as e:
        return f"ERROR: {e}"

def replace_text(path, old, new):
    try:
        abs_p = resolve(path)
        t = Path(abs_p).read_text(encoding="utf-8", errors="ignore")
        if old not in t:
            return f"ERROR: pattern not found in {path}"
        Path(abs_p).write_text(t.replace(old, new, 1), encoding="utf-8")
        return f"Updated {path}"
    except Exception as e:
        return f"ERROR: {e}"

def run_command_stream(cmd, background=False):
    if any(re.search(p, cmd) for p in DANGEROUS_PATTERNS):
        return "BLOCKED: dangerous command."
    if background:
        pid, _ = bg_run(cmd)
        return f"Started in background [PID:{pid}]. Use /ps to monitor."
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=120, cwd=CWD[0])
        out = f"EXIT:{r.returncode}\n{r.stdout.strip()}\n{r.stderr.strip()}".strip()
        for line in out.split("\n")[:20]:
            print(clr(C.DIM, f"    {line}"))
        if len(out.split("\n")) > 20:
            print(clr(C.DIM, f"    … +{len(out.split(chr(10)))-20} lines"))
        return out
    except subprocess.TimeoutExpired:
        return "ERROR: timed out (120s)"
    except Exception as e:
        return f"ERROR: {e}"

def list_files(path="."):
    try:
        entries = sorted(Path(resolve(path)).iterdir(), key=lambda x: (x.is_file(), x.name))
        lines = [f"{'📄' if e.is_file() else '📁'} {e.name}" for e in entries]
        for l in lines:
            print(clr(C.DIM, f"    {l}"))
        return "\n".join(lines) or "(empty)"
    except Exception as e:
        return f"ERROR: {e}"

def search_in_files(pattern, directory="."):
    results = []
    for p in Path(resolve(directory)).rglob("*"):
        if p.is_file():
            try:
                for i, line in enumerate(p.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
                    if pattern.lower() in line.lower():
                        results.append(f"{p}:{i}: {line.strip()}")
            except:
                pass
    return "\n".join(results[:50]) if results else f"No matches for '{pattern}'"

def create_dir(path):
    try:
        Path(resolve(path)).mkdir(parents=True, exist_ok=True)
        return f"Created: {path}"
    except Exception as e:
        return f"ERROR: {e}"

def delete_file(path):
    try:
        p = Path(resolve(path))
        if not p.exists():
            return f"ERROR: not found: {path}"
        if p.is_dir():
            shutil.rmtree(p)
        else:
            p.unlink()
        return f"Deleted: {path}"
    except Exception as e:
        return f"ERROR: {e}"

def http_get(url):
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    headers = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}
    try:
        r = requests.get(url, timeout=20, headers=headers, allow_redirects=True)
        ct = r.headers.get("content-type", "")
        text = r.text
        if "html" in ct:
            text = re.sub(r'<script[\s\S]*?</script>', '', text, flags=re.I)
            text = re.sub(r'<style[\s\S]*?</style>', '', text, flags=re.I)
            text = re.sub(r'<[^>]+>', ' ', text)
            text = re.sub(r'\s{3,}', '\n', text).strip()
        return f"STATUS:{r.status_code}\n{text[:5000]}" + ("…[truncated]" if len(text) > 5000 else "")
    except Exception as e:
        return f"ERROR: {e}"

def search_web(query):
    url = f"https://html.duckduckgo.com/html/?q={requests.utils.quote(query)}&kl=us-en"
    headers = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}
    try:
        r = requests.get(url, timeout=12, headers=headers)
        links = re.findall(r'class="result__a"[^>]*>([^<]+)', r.text)
        snips = re.findall(r'class="result__snippet"[^>]*>([\s\S]*?)</a>', r.text)
        results = []
        for i, (l, s) in enumerate(zip(links[:6], snips[:6])):
            s = re.sub(r'<[^>]+>', '', s).strip()
            results.append(f"[{i+1}] {l.strip()}\n{s}")
        return "\n\n".join(results) if results else f"No results for: {query}"
    except Exception as e:
        return f"ERROR: {e}"

def screenshot(url_or_path):
    target = url_or_path
    if not target.startswith(("http://", "https://", "file://")):
        abs_p = resolve(target)
        if Path(abs_p).exists():
            target = f"file://{abs_p}"
        else:
            return f"ERROR: not found: {target}"
    out = SCREENSHOT_DIR / f"shot_{int(datetime.now().timestamp())}.png"
    
    # Try Puppeteer
    node_script = f"""
const p=require('puppeteer');p.launch({{headless:'new',args:['--no-sandbox','--disable-setuid-sandbox']}}).then(async b=>{{
  const pg=await b.newPage();await pg.setViewport({{width:1280,height:800}});
  await pg.goto('{target}',{{waitUntil:'networkidle2',timeout:30000}});
  await pg.screenshot({{path:'{out}',fullPage:false}});
  await b.close();console.log('OK:{out}');
}}).catch(e=>{{console.error('ERR:'+e.message);process.exit(1)}});"""
    tmp = Path(os.environ.get("TMPDIR", "/tmp")) / "_shot.js"
    tmp.write_text(node_script)
    try:
        r = subprocess.run(["node", str(tmp)], capture_output=True, text=True, timeout=35)
        if "OK:" in r.stdout and out.exists():
            ok(f"Screenshot saved: {out}")
            return f"SCREENSHOT:{out}\nURL:{target}"
    except:
        pass
        
    # Try CLI fallbacks
    for cmd in [f'chromium-browser --headless --screenshot="{out}" --window-size=1280,800 "{target}" 2>/dev/null',
                f'google-chrome --headless --screenshot="{out}" --window-size=1280,800 "{target}" 2>/dev/null']:
        try:
            subprocess.run(cmd, shell=True, timeout=30, check=True)
            if out.exists() and out.stat().st_size > 0:
                return f"SCREENSHOT:{out}\nURL:{target}"
        except:
            pass
    
    # Try Remote Service Fallback (screenshot-service alongside this file)
    try:
        service_dir = Path(__file__).resolve().parent.parent / "tools" / "screenshot-service"
        remote_script = f"""
import sys
sys.path.insert(0, {repr(str(service_dir))})
from screenshot import take_screenshot
success = take_screenshot('{target}', '{out}')
sys.exit(0 if success else 1)
"""
        res = subprocess.run([sys.executable, "-c", remote_script], capture_output=True, timeout=30)
        if out.exists() and out.stat().st_size > 0:
            return f"SCREENSHOT:{out}\nURL:{target}"
    except Exception:
        pass
        
    return f"ERROR: Screenshot failed. Install puppeteer: npm install puppeteer\nTarget was: {target}"

def show_image(path):
    abs_p = resolve(path)
    if not Path(abs_p).exists():
        return f"ERROR: not found: {path}"
    for viewer in ["eog", "display", "feh", "xdg-open", "open"]:
        try:
            subprocess.Popen([viewer, abs_p], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            ok(f"Opening image: {abs_p}")
            return f"Opened in viewer: {abs_p}"
        except:
            pass
    return f"Image at: {abs_p} (no viewer found — try opening manually)"

def python_eval(code):
    try:
        import io
        import contextlib
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            exec(code, {"__builtins__": __builtins__})
        out = buf.getvalue()
        for line in out.split("\n")[:10]:
            print(clr(C.DIM, f"    {line}"))
        return out or "(no output)"
    except Exception as e:
        return f"ERROR: {e}"

def git_status():
    return run_command_stream("git status", background=False)

def git_diff(file=""):
    return run_command_stream(f"git diff {file}".strip())

def grep(pattern, path="."):
    return run_command_stream(f'grep -rn "{pattern}" "{resolve(path)}"')

def cd(path):
    abs_p = resolve(path)
    if not Path(abs_p).is_dir():
        return f"ERROR: not a directory: {abs_p}"
    CWD[0] = abs_p
    ok(f"CWD → {abs_p}")
    return f"CWD: {abs_p}"

def ask_human(question):
    print(clr(C.CYAN + C.BOLD, f"\n  ❓ Agent asks: {question}"))
    try:
        answer = input(clr(C.YELLOW, "  Your answer: ")).strip()
    except:
        answer = ""
    return answer or "(no answer)"

# ─── TOOL DISPATCH MAP ────────────────────────────────────────
TOOL_MAP = {
    "read_file":       lambda a: read_file(a.get("path", "")),
    "write_file":      lambda a: write_file(a.get("path", ""), a.get("content", "")),
    "replace_text":    lambda a: replace_text(a.get("path", ""), a.get("old", ""), a.get("new", "")),
    "run_command":     lambda a: run_command_stream(a.get("command", ""), a.get("background", False)),
    "list_files":      lambda a: list_files(a.get("path", ".")),
    "search_in_files": lambda a: search_in_files(a.get("pattern", ""), a.get("directory", ".")),
    "create_dir":      lambda a: create_dir(a.get("path", "")),
    "delete_file":     lambda a: delete_file(a.get("path", "")),
    "http_get":        lambda a: http_get(a.get("url", "")),
    "python_eval":     lambda a: python_eval(a.get("code", "")),
    "git_status":      lambda a: git_status(),
    "git_diff":        lambda a: git_diff(a.get("file", "")),
    "grep":            lambda a: grep(a.get("pattern", ""), a.get("path", ".")),
    "cd":              lambda a: cd(a.get("path", ".")),
    "search_web":      lambda a: search_web(a.get("query", a.get("q", a.get("search", "")))),
    "screenshot":      lambda a: screenshot(a.get("url", a.get("path", a.get("file", "")))),
    "show_image":      lambda a: show_image(a.get("path", a.get("file", ""))),
    "ask_human":       lambda a: ask_human(a.get("question", a.get("q", "Can you clarify?"))),
}

CONFIRM_TOOLS = {"delete_file"}

def execute_tool(name, args):
    fn = TOOL_MAP.get(name)
    if not fn:
        return f"ERROR: unknown tool '{name}'"
    if name in CONFIRM_TOOLS:
        preview = args.get("path", "")
        warn(f"DELETE: {preview}")
        try:
            yn = input(clr(C.YELLOW, "  Confirm? [y/N] ")).strip().lower()
        except:
            yn = "n"
        if yn != "y":
            return "Cancelled."
    return fn(args)
