# ============================================================
#  cli/ui.py  —  CLI Colors and Formatting Helpers
# ============================================================

import json

class C:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"
    PURPLE = "\033[95m"

def clr(color_code, text):
    return f"{color_code}{text}{C.RESET}"

def info(m):
    print(clr(C.CYAN, f"  ℹ  {m}"))

def ok(m):
    print(clr(C.GREEN, f"  ✔  {m}"))

def warn(m):
    print(clr(C.YELLOW, f"  ⚠  {m}"))

def err(m):
    print(clr(C.RED, f"  ✘  {m}"))

def thought(t):
    print(clr(C.DIM, f"  💭 {t}"))

def tool_ev(n, a):
    print(clr(C.GREEN, f"  ⚙  {n}({json.dumps(a, ensure_ascii=False)[:80]})"))

def step_ev(n):
    print(clr(C.BLUE, f"\n  {'─'*45}\n  STEP {n}\n  {'─'*45}"))

def result_ev(r):
    lines = str(r).split("\n")
    preview = "\n".join(f"    {l}" for l in lines[:8])
    if len(lines) > 8:
        preview += f"\n    … +{len(lines)-8} lines"
    print(clr(C.DIM, preview))

def print_banner():
    print(clr(C.BOLD + C.BLUE, """
  ╔══════════════════════════════════════════╗
  ║   NOVA — Advanced CLI Coding Agent       ║
  ║   2026 Edition  •  Powered by Ollama     ║
  ╚══════════════════════════════════════════╝
"""))
