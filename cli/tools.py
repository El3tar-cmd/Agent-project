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

_bg_procs = {}
_bg_id = [0]

# ─── PATH RESOLVER ────────────────────────────────────────────
def resolve(p):
    return str(Path(CWD[0]) / p) if not Path(p).is_absolute() else p

# ─── BACKGROUND PROCESSES ─────────────────────────────────────
def bg_run(cmd):
    if any(re.search(p, cmd) for p in DANGEROUS_PATTERNS):
        return None, "BLOCKED"
    _bg_id[0] += 1
    pid = _bg_id[0]
    entry = {"id": pid, "cmd": cmd, "output": "", "status": "running",
             "started": datetime.now().isoformat(), "proc": None}
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
    """Read a file with line numbers."""
    try:
        content = Path(resolve(path)).read_text(encoding="utf-8", errors="ignore")
        lines = content.split("\n")
        return "\n".join(f"{str(i+1).rjust(4)}: {l}" for i, l in enumerate(lines))
    except Exception as e:
        return f"ERROR: {e}"

def read_lines(path, start=1, end=None):
    """Read a specific range of lines from a file."""
    try:
        lines = Path(resolve(path)).read_text(encoding="utf-8", errors="ignore").split("\n")
        total = len(lines)
        s = max(1, int(start or 1))
        e = min(total, int(end or total))
        slice_ = lines[s-1:e]
        header = f"Lines {s}-{e} of {total} total:\n"
        return header + "\n".join(f"{str(s+i).rjust(4)}: {l}" for i, l in enumerate(slice_))
    except Exception as e:
        return f"ERROR: {e}"

def write_file(path, content):
    """Create or overwrite a file."""
    try:
        p = Path(resolve(path))
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        lines = content.count("\n") + 1
        return f"Saved {path} ({len(content)} chars, {lines} lines)"
    except Exception as e:
        return f"ERROR: {e}"

def append_file(path, content):
    """Append content to an existing file (or create it)."""
    try:
        p = Path(resolve(path))
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(str(p), "a", encoding="utf-8") as f:
            f.write(content)
        return f"Appended to {path} ({len(content)} chars)"
    except Exception as e:
        return f"ERROR: {e}"

def replace_text(path, old, new):
    """Replace first occurrence of old with new in file."""
    try:
        abs_p = resolve(path)
        t = Path(abs_p).read_text(encoding="utf-8", errors="ignore")
        if old not in t:
            return f"ERROR: pattern not found in {path}. Check exact whitespace and quotes."
        Path(abs_p).write_text(t.replace(old, new, 1), encoding="utf-8")
        return f"Updated {path}"
    except Exception as e:
        return f"ERROR: {e}"

def think(thought):
    """Explicit reasoning step — no side effects."""
    return f"Thought recorded. Proceed with your plan."

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
    ignore = {".git", "node_modules", ".next", "dist", "build", "__pycache__", ".venv"}
    for p in Path(resolve(directory)).rglob("*"):
        if any(part in ignore for part in p.parts):
            continue
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
    """Search DuckDuckGo and return top results."""
    url = f"https://html.duckduckgo.com/html/?q={requests.utils.quote(query)}&kl=us-en"
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,*/*;q=0.8",
    }
    try:
        r = requests.get(url, timeout=12, headers=headers)
        links = re.findall(r'class="result__a"[^>]*>([^<]+)', r.text)
        snips = re.findall(r'class="result__snippet"[^>]*>([\s\S]*?)</a>', r.text)
        urls  = re.findall(r'class="result__url"[^>]*>([^<]+)', r.text)
        results = []
        for i, (l, s) in enumerate(zip(links[:6], snips[:6])):
            s_clean = re.sub(r'<[^>]+>', '', s).strip()
            url_str = urls[i].strip() if i < len(urls) else ""
            results.append(f"[{i+1}] {l.strip()}\n{s_clean}\n{url_str}")
        return "\n\n".join(results) if results else f"No results for: {query}"
    except Exception as e:
        return f"ERROR: {e}"

def python_eval(code):
    """Execute Python code and return output."""
    import io, contextlib
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            exec(code, {"__builtins__": __builtins__})
        return buf.getvalue().strip() or "(no output)"
    except Exception as e:
        return f"ERROR: {e}"

def git_status():
    try:
        r = subprocess.run(["git", "status"], capture_output=True, text=True, cwd=CWD[0])
        return r.stdout.strip() or r.stderr.strip()
    except Exception as e:
        return f"ERROR: {e}"

def git_diff(file=None):
    try:
        cmd = ["git", "diff"]
        if file:
            cmd.append(resolve(file))
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=CWD[0])
        return r.stdout.strip() or "(no changes)"
    except Exception as e:
        return f"ERROR: {e}"

def grep(pattern, path="."):
    try:
        cmd = f'grep -rn --include="*.py" --include="*.js" --include="*.ts" --include="*.json" --include="*.md" --exclude-dir=node_modules --exclude-dir=.git "{pattern}" "{resolve(path)}"'
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=15, cwd=CWD[0])
        return r.stdout.strip() or "(no matches)"
    except Exception as e:
        return f"ERROR: {e}"

def cd(path):
    try:
        abs_p = resolve(path)
        if not Path(abs_p).exists():
            return f"ERROR: directory not found: {abs_p}"
        if not Path(abs_p).is_dir():
            return f"ERROR: not a directory: {abs_p}"
        CWD[0] = abs_p
        return f"CWD changed to: {CWD[0]}"
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

    # Try Puppeteer via Node.js
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

    # Fallback: CLI tools
    for cmd in [
        f'chromium-browser --headless --screenshot="{out}" --window-size=1280,800 "{target}" 2>/dev/null',
        f'google-chrome --headless --screenshot="{out}" --window-size=1280,800 "{target}" 2>/dev/null',
    ]:
        try:
            subprocess.run(cmd, shell=True, timeout=30, check=True)
            if out.exists() and out.stat().st_size > 0:
                return f"SCREENSHOT:{out}\nURL:{target}"
        except:
            pass

    # Termux fallback (dynamic path)
    try:
        service_dir = Path(__file__).resolve().parent.parent / "tools" / "screenshot-service"
        remote_script = f"""
import sys
sys.path.insert(0, {repr(str(service_dir))})
from screenshot import take_screenshot
success = take_screenshot('{target}', '{out}')
sys.exit(0 if success else 1)
"""
        subprocess.run([sys.executable, "-c", remote_script], capture_output=True, timeout=30)
        if out.exists() and out.stat().st_size > 0:
            return f"SCREENSHOT:{out}\nURL:{target}"
    except Exception:
        pass

    return f"ERROR: Screenshot failed. Install puppeteer (npm install puppeteer) or chromium-browser.\nTarget: {target}"

def show_image(path):
    abs_p = resolve(path)
    if not Path(abs_p).exists():
        return f"ERROR: not found: {path}"
    for viewer in ["eog", "display", "feh", "xdg-open", "open"]:
        try:
            subprocess.Popen([viewer, abs_p], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return f"Opening {abs_p} with {viewer}"
        except FileNotFoundError:
            continue
    return f"No image viewer found. File at: {abs_p}"

# ─── TOOL MAP ─────────────────────────────────────────────────
TOOL_MAP = {
    "read_file":       lambda a: read_file(a.get("path", "")),
    "read_lines":      lambda a: read_lines(a.get("path", ""), a.get("start", 1), a.get("end")),
    "write_file":      lambda a: write_file(a.get("path", ""), a.get("content", a.get("text", ""))),
    "append_file":     lambda a: append_file(a.get("path", ""), a.get("content", a.get("text", ""))),
    "replace_text":    lambda a: replace_text(a.get("path", ""), a.get("old", a.get("old_text", "")), a.get("new", a.get("new_text", a.get("replacement", "")))),
    "list_files":      lambda a: list_files(a.get("path", a.get("directory", "."))),
    "search_in_files": lambda a: search_in_files(a.get("pattern", a.get("search", "")), a.get("directory", a.get("dir", "."))),
    "create_dir":      lambda a: create_dir(a.get("path", a.get("directory", ""))),
    "delete_file":     lambda a: delete_file(a.get("path", "")),
    "run_command":     lambda a: run_command_stream(a.get("command", a.get("cmd", ""))),
    "run_background":  lambda a: run_command_stream(a.get("command", ""), background=True),
    "python_eval":     lambda a: python_eval(a.get("code", "")),
    "git_status":      lambda a: git_status(),
    "git_diff":        lambda a: git_diff(a.get("file")),
    "grep":            lambda a: grep(a.get("pattern", a.get("search", "")), a.get("path", a.get("directory", "."))),
    "http_get":        lambda a: http_get(a.get("url", "")),
    "search_web":      lambda a: search_web(a.get("query", a.get("q", a.get("search", "")))),
    "screenshot":      lambda a: screenshot(a.get("url_or_path", a.get("url", a.get("path", "")))),
    "show_image":      lambda a: show_image(a.get("path", "")),
    "cd":              lambda a: cd(a.get("path", a.get("dir", ""))),
    "think":           lambda a: think(a.get("thought", a.get("reasoning", ""))),
}

def execute_tool(name, args):
    fn = TOOL_MAP.get(name)
    if fn:
        return str(fn(args))
    return f"ERROR: unknown tool '{name}'. Available: {', '.join(TOOL_MAP.keys())}"
