import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const S = "";

// ══════════════════════════════════════════
//  ICONS
// ══════════════════════════════════════════
const I = {
  Send:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Term:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  Tool:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  Brain:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>,
  Check:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  Trash:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Log:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Bot:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="16" y1="16" x2="16.01" y2="16.01"/></svg>,
  Stop:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
  Warn:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Menu:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  Close:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  File:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Folder:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  Save:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Diff:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  Chat:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Refresh: p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  ChevR:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>,
  ChevD:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>,
  History: p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5-4v-4l4 4"/></svg>,
  Mem:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  Ws:      p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Plus:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Eye:     p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Undo:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>,
  Redo:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>,
  Copy:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Clear:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
};

// ══════════════════════════════════════════════════════════
//  SYNTAX HIGHLIGHTING (safe — max 500 lines to prevent freeze)
// ══════════════════════════════════════════════════════════
const KEYWORDS = /\b(import|export|from|const|let|var|function|class|return|if|else|for|while|do|switch|case|break|continue|new|this|typeof|instanceof|async|await|try|catch|finally|throw|in|of|default|extends|super|static|get|set|null|undefined|true|false|yield|delete|void|type|interface|enum|def|self|pass|lambda|with|as|not|and|or|is|elif|except|raise|global|nonlocal)\b/g;

function highlight(code) {
  if (!code) return '';
  // limit to first 500 lines to avoid freezing on large files
  const lines = code.split('\n');
  const limited = lines.slice(0, 500).join('\n');
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const safe = esc(limited);
  try {
    return safe
      // comments first (before anything else)
      .replace(/(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/g, m=>`<span style="color:#6e7681;font-style:italic">${m}</span>`)
      // strings (simple, no nested quotes)
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, m=>`<span style="color:#a5d6ff">${m}</span>`)
      // keywords
      .replace(KEYWORDS, m=>`<span style="color:#ff7b72;font-weight:500">${m}</span>`)
      // numbers
      .replace(/\b(\d+\.?\d*)\b/g, m=>`<span style="color:#79c0ff">${m}</span>`)
      // function names
      .replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g, m=>`<span style="color:#d2a8ff">${m}</span>`)
      + (lines.length > 500 ? '\n<span style="color:#6e7681">// ... truncated for display ...</span>' : '');
  } catch {
    return safe;
  }
}

// ══════════════════════════════════════════
//  DIFF ALGORITHM
// ══════════════════════════════════════════
function computeDiff(oldT, newT) {
  const ol=oldT.split('\n'), nl=newT.split('\n');
  const m=ol.length, n=nl.length;
  const dp=Array.from({length:m+1},()=>new Array(n+1).fill(0));
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    dp[i][j]=ol[i-1]===nl[j-1]?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]);
  const seq=[]; let i=m,j=n;
  while(i>0&&j>0){ if(ol[i-1]===nl[j-1]){seq.unshift([i-1,j-1]);i--;j--;}else if(dp[i-1][j]>dp[i][j-1])i--;else j--; }
  const res=[]; let oi=0,ni=0,mi=0;
  while(mi<seq.length||oi<ol.length||ni<nl.length){
    const[mo,mn]=mi<seq.length?seq[mi]:[ol.length,nl.length];
    while(oi<mo){res.push({type:'del',old:oi+1,new:null,text:ol[oi]});oi++;}
    while(ni<mn){res.push({type:'add',old:null,new:ni+1,text:nl[ni]});ni++;}
    if(mi<seq.length){res.push({type:'ctx',old:oi+1,new:ni+1,text:ol[oi]});oi++;ni++;mi++;}
  }
  return res;
}
function collapseDiff(lines){
  const ch=new Set(); lines.forEach((l,i)=>{ if(l.type!=='ctx') for(let k=Math.max(0,i-3);k<=Math.min(lines.length-1,i+3);k++) ch.add(k); });
  const out=[]; let skip=false;
  lines.forEach((l,i)=>{ if(ch.has(i)){skip=false;out.push(l);}else if(!skip){skip=true;out.push({type:'hdr',text:'@@ ... @@'});} });
  return out;
}

// ══════════════════════════════════════════
//  EXT → COLOR
// ══════════════════════════════════════════
const EC={js:'#f0c060',jsx:'#58a6ff',ts:'#58a6ff',tsx:'#58a6ff',py:'#3fb950',go:'#79c0ff',rs:'#ff7b72',json:'#d29922',md:'#8b949e',html:'#ff7b72',css:'#bc8cff',sh:'#3fb950',yml:'#d29922',yaml:'#d29922',txt:'#8b949e',env:'#f0c060'};
const ec=e=>EC[e]||'#6e7681';
const TOOLS_LIST=["read_file","write_file","replace_text","run_command","list_files","search_in_files","create_dir","delete_file","http_get","python_eval","git_status","git_diff","grep","cd"];
const QUICK=["list files here","git status","continue last task","what python version?"];

// ══════════════════════════════════════════
//  CSS
// ══════════════════════════════════════════
const css=`
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#080c10;--bg1:#0d1117;--bg2:#161b22;--bg3:#1c2330;
  --border:#21262d;--border2:#30363d;
  --fg:#e6edf3;--fg2:#8b949e;--fg3:#6e7681;
  --green:#3fb950;--cyan:#58a6ff;--cyan2:#1f6feb;
  --yellow:#d29922;--yellow2:#f0c060;--red:#f85149;--purple:#bc8cff;
  --add:#1a4a2e;--add-b:#2ea043;--del:#4a1a1a;--del-b:#f85149;
}
html,body,#root{height:100%;overflow:hidden}
body{background:var(--bg);color:var(--fg);font-family:'JetBrains Mono',monospace;font-size:13px;-webkit-tap-highlight-color:transparent;position:fixed;width:100%;height:100%}
/* LAYOUT */
.app{display:flex;flex-direction:column;height:100dvh;height:calc(var(--vh,1vh)*100)}
.header{height:48px;flex-shrink:0;display:flex;align-items:center;gap:8px;padding:0 12px;background:var(--bg1);border-bottom:1px solid var(--border);z-index:20}
.logo{display:flex;align-items:center;gap:6px;font-family:'Syne',sans-serif;font-weight:800;font-size:14px}
.dot{width:7px;height:7px;background:var(--green);border-radius:50%;box-shadow:0 0 8px var(--green);animation:pulse 2s infinite;flex-shrink:0}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.4)}}
.hright{margin-left:auto;display:flex;align-items:center;gap:5px}
.badge{padding:2px 7px;border-radius:999px;font-size:10px;font-weight:600;border:1px solid var(--border2);background:var(--bg3)}
.badge.running{border-color:var(--cyan);color:var(--cyan);animation:blink 1s infinite}
.badge.idle{border-color:var(--green);color:var(--green)}
.badge.paused{border-color:var(--yellow);color:var(--yellow)}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}
.ibtn{background:none;border:none;color:var(--fg2);cursor:pointer;padding:5px;border-radius:5px;display:flex;align-items:center;touch-action:manipulation;transition:all .15s}
.ibtn:active,.ibtn:hover{background:var(--bg2);color:var(--fg)}
.menu-btn{display:flex}
/* BODY */
.body{flex:1;display:flex;overflow:hidden;min-height:0}
/* TAB BAR */
.tabbar{display:none;height:50px;flex-shrink:0;background:var(--bg1);border-top:1px solid var(--border);justify-content:space-around;align-items:center}
.tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 0;border:none;background:none;color:var(--fg3);font-family:inherit;font-size:9px;cursor:pointer;touch-action:manipulation}
.tab.active{color:var(--cyan)}
.tab svg{width:17px;height:17px}
/* SIDEBAR */
.sidebar{width:260px;flex-shrink:0;background:var(--bg1);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;transition:transform .25s cubic-bezier(.4,0,.2,1);z-index:30}
.sb-scroll{flex:1;overflow-y:auto;padding-bottom:16px}
.sb-scroll::-webkit-scrollbar{width:3px}
.sb-scroll::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
.stitle{padding:10px 12px 4px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--fg3)}
.msel{margin:0 10px 6px;padding:6px 9px;background:var(--bg2);border:1px solid var(--border2);border-radius:5px;color:var(--fg);font-family:inherit;font-size:11px;outline:none;width:calc(100% - 20px)}
.sbbtn{display:flex;align-items:center;gap:7px;padding:6px 12px;font-size:11px;color:var(--fg2);cursor:pointer;border:none;background:none;width:100%;text-align:left;font-family:inherit;touch-action:manipulation;border-radius:4px;margin:1px 0}
.sbbtn:active,.sbbtn:hover{background:var(--bg2);color:var(--fg)}
.sbbtn.danger:hover{color:var(--red)}
.sbbtn.active-item{background:rgba(31,111,235,.15);color:var(--cyan)}
/* PERSONA SELECTOR */
.persona-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:0 10px 6px}
.persona-card{padding:6px 8px;background:var(--bg2);border:1px solid var(--border);border-radius:5px;cursor:pointer;touch-action:manipulation;transition:all .15s;text-align:center}
.persona-card:hover,.persona-card.active{border-color:var(--cyan2);background:rgba(31,111,235,.1)}
.persona-card .p-emoji{font-size:16px}
.persona-card .p-name{font-size:9px;color:var(--fg2);margin-top:2px}
/* CWD */
.cwd-box{margin:2px 10px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;overflow:hidden}
.cwd-lbl{padding:3px 9px 1px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--fg3)}
.cwd-row{display:flex;align-items:center;gap:3px;padding:1px 5px 5px}
.cwd-inp{flex:1;background:none;border:none;outline:none;color:var(--cyan);font-family:inherit;font-size:10px;min-width:0;padding:3px 4px}
.cwd-go{background:var(--cyan2);border:none;border-radius:4px;color:#fff;padding:3px 7px;font-size:10px;cursor:pointer;flex-shrink:0;touch-action:manipulation;font-family:inherit}
/* WORKSPACE CHIPS */
.ws-list{padding:0 10px 6px;display:flex;flex-direction:column;gap:3px}
.ws-item{display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--bg2);border:1px solid var(--border);border-radius:5px;cursor:pointer;touch-action:manipulation;font-size:11px}
.ws-item.active-ws{border-color:var(--cyan2);color:var(--cyan)}
.ws-item span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ws-del{background:none;border:none;color:var(--fg3);cursor:pointer;font-size:14px;line-height:1;padding:0 2px}
.ws-del:hover{color:var(--red)}
/* SESSION */
.scard{margin:2px 10px 0;padding:7px 9px;background:var(--bg2);border:1px solid var(--border);border-radius:5px}
.srow{display:flex;justify-content:space-between;padding:1px 0;font-size:10px;color:var(--fg3)}
.srow span:last-child{color:var(--fg2)}
.chips{padding:0 10px;display:flex;flex-wrap:wrap;gap:2px}
.chip{padding:2px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:3px;font-size:10px;color:var(--fg3)}
.chip.active{border-color:var(--cyan2);color:var(--cyan);background:rgba(31,111,235,.1)}
/* OVERLAY */
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:25;backdrop-filter:blur(2px)}
.overlay.show{display:block}
/* FILE TREE */
.ftree-panel{width:200px;flex-shrink:0;background:var(--bg1);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
.ftree-head{height:36px;flex-shrink:0;display:flex;align-items:center;gap:5px;padding:0 9px;border-bottom:1px solid var(--border);font-size:11px;font-weight:600;color:var(--fg2)}
.ftree-head span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ftree-body{flex:1;overflow-y:auto;padding:3px 0}
.ftree-body::-webkit-scrollbar{width:3px}
.ftree-body::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
.fnode{display:flex;align-items:center;gap:4px;padding:3px 7px;cursor:pointer;font-size:11px;color:var(--fg2);user-select:none;touch-action:manipulation;white-space:nowrap}
.fnode:hover,.fnode.sel{background:var(--bg2);color:var(--fg)}
.fnode.sel{background:rgba(31,111,235,.12);color:var(--cyan)}
.fnode-name{overflow:hidden;text-overflow:ellipsis}
/* CENTER */
.center{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;min-height:0}
/* PANELS HEADER TABS */
.panel-tabs{height:36px;flex-shrink:0;display:flex;align-items:stretch;background:var(--bg1);border-bottom:1px solid var(--border);overflow-x:auto}
.panel-tabs::-webkit-scrollbar{height:2px}
.ptab{display:flex;align-items:center;gap:5px;padding:0 12px;font-size:11px;color:var(--fg3);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;background:none;border-top:none;border-left:none;border-right:1px solid var(--border);font-family:inherit;touch-action:manipulation}
.ptab.active{color:var(--fg);border-bottom-color:var(--cyan);background:var(--bg)}
.ptab .dot2{width:5px;height:5px;background:var(--yellow);border-radius:50%;flex-shrink:0}
.ptab-close{background:none;border:none;color:var(--fg3);cursor:pointer;padding:0 2px;font-size:13px;line-height:1;margin-left:2px}
/* EDITOR */
.editor-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0}
.ebar{display:flex;align-items:center;gap:5px;padding:3px 7px;background:var(--bg1);border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:nowrap;overflow:hidden}
.eact{background:none;border:1px solid var(--border2);border-radius:4px;color:var(--fg2);cursor:pointer;padding:2px 7px;font-size:10px;font-family:inherit;display:flex;align-items:center;gap:3px;touch-action:manipulation;white-space:nowrap;flex-shrink:0}
.eact:hover{background:var(--bg2)}
.eact.on{border-color:#238636;color:var(--green)}
.editor-body{flex:1;overflow:hidden;position:relative;min-height:0;display:flex}
.code-wrap{flex:1;display:flex;overflow:hidden;position:relative;min-height:0}
.line-nums{
  flex-shrink:0;width:42px;
  padding:11px 6px 11px 4px;
  font-size:12px;line-height:1.7;
  color:var(--fg3);text-align:right;
  border-right:1px solid var(--border);
  background:var(--bg1);
  overflow:hidden;
  white-space:pre;
  font-family:'JetBrains Mono',monospace;
  user-select:none;pointer-events:none;
  z-index:2;
}
.code-editor-area{flex:1;position:relative;overflow:hidden;min-width:0}
.code-ta{
  position:absolute;inset:0;
  width:100%;height:100%;
  overflow:auto;
  padding:11px;
  background:transparent;
  border:none;outline:none;
  color:var(--fg);
  font-family:'JetBrains Mono',monospace;
  font-size:12px;line-height:1.7;
  resize:none;tab-size:2;
  white-space:pre;
  caret-color:var(--cyan);
  z-index:3;
}
.code-ta::-webkit-scrollbar{width:5px;height:5px}
.code-ta::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
.code-hl{
  position:absolute;inset:0;
  padding:11px;
  font-family:'JetBrains Mono',monospace;
  font-size:12px;line-height:1.7;
  white-space:pre;
  overflow:hidden;
  pointer-events:none;user-select:none;
  z-index:1;
}
/* DIFF */
.diff-view{flex:1;overflow:auto;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.7}
.diff-view::-webkit-scrollbar{width:5px;height:5px}
.diff-view::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
.diff-line{display:flex;min-width:max-content}
.diff-line.add{background:var(--add);border-left:3px solid var(--add-b)}
.diff-line.del{background:var(--del);border-left:3px solid var(--del-b)}
.diff-line.ctx{border-left:3px solid transparent}
.diff-ln{width:38px;text-align:right;padding:0 6px;color:var(--fg3);flex-shrink:0;user-select:none}
.diff-sign{width:16px;flex-shrink:0;text-align:center}
.diff-sign.a{color:var(--add-b)}.diff-sign.d{color:var(--del-b)}
.diff-txt{padding:0 7px;white-space:pre;flex:1}
.diff-hdr{background:rgba(88,166,255,.08);color:var(--cyan);padding:2px 7px;font-size:11px;border-left:3px solid var(--cyan2)}
.no-diff{padding:20px;color:var(--fg3);font-size:12px;text-align:center}
/* EDITOR EMPTY */
.ed-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--fg3);text-align:center;padding:20px}
.ed-empty svg{opacity:.2;width:36px;height:36px}
/* TERMINAL */
.term-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--bg);min-height:0}
.term-bar{height:34px;flex-shrink:0;display:flex;align-items:center;gap:6px;padding:0 10px;background:var(--bg1);border-bottom:1px solid var(--border);font-size:11px;color:var(--fg2)}
.term-body{flex:1;overflow-y:auto;padding:8px 12px;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.6;color:#ccffcc}
.term-body::-webkit-scrollbar{width:4px}
.term-body::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
.term-line{white-space:pre-wrap;word-break:break-all;margin:0}
.term-line.err{color:#ff9999}
.term-line.sys{color:var(--fg3);font-style:italic}
.term-input-row{display:flex;align-items:center;gap:6px;padding:6px 10px;border-top:1px solid var(--border);flex-shrink:0}
.term-prompt{color:var(--green);font-size:12px;flex-shrink:0;font-family:'JetBrains Mono',monospace}
.term-inp{flex:1;background:none;border:none;outline:none;color:#ccffcc;font-family:'JetBrains Mono',monospace;font-size:12px}
/* PREVIEW */
.preview-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0}
.preview-bar{height:34px;flex-shrink:0;display:flex;align-items:center;gap:6px;padding:0 10px;background:var(--bg1);border-bottom:1px solid var(--border)}
.preview-url{flex:1;background:var(--bg2);border:1px solid var(--border2);border-radius:4px;padding:3px 8px;font-size:11px;color:var(--fg);font-family:inherit;outline:none}
.preview-frame{flex:1;border:none;background:#fff}
/* HISTORY MODAL */
.hist-item{padding:8px 12px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s}
.hist-item:hover{background:var(--bg2)}
.hist-q{font-size:12px;color:var(--fg);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hist-meta{font-size:10px;color:var(--fg3);display:flex;gap:8px}
.hist-ans{font-size:10px;color:var(--fg2);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* MEMORY MODAL */
.mem-item{display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid var(--border);font-size:11px}
.mem-key{color:var(--cyan);flex-shrink:0;min-width:120px}
.mem-val{color:var(--fg2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mem-del{background:none;border:none;color:var(--fg3);cursor:pointer;font-size:14px;padding:0 3px}
.mem-del:hover{color:var(--red)}
.mem-add-row{display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid var(--border)}
.mem-inp{flex:1;background:var(--bg2);border:1px solid var(--border2);border-radius:4px;padding:5px 8px;font-size:11px;color:var(--fg);font-family:inherit;outline:none}
.mem-inp:focus{border-color:var(--cyan2)}
/* CHAT PANE */
.chat-pane{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0;height:100%}
.messages{flex:1;overflow-y:auto;padding:10px 10px 4px;display:flex;flex-direction:column;gap:6px}
.messages::-webkit-scrollbar{width:4px}
.messages::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
.msg{display:flex;flex-direction:column;animation:fu .2s ease}
@keyframes fu{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.msg-user{align-items:flex-end}
.bubble{padding:7px 11px;border-radius:10px 10px 10px 2px;max-width:88%;line-height:1.6;white-space:pre-wrap;word-break:break-word;font-size:12px}
.msg-user .bubble{background:var(--cyan2);color:#fff;border-radius:10px 10px 2px 10px}
.msg-agent .bubble{background:var(--bg2);border:1px solid var(--border2)}
.msg-sys .bubble{background:none;border:none;color:var(--fg3);font-size:10px;padding:1px 0}
.ev{display:flex;align-items:flex-start;gap:5px;padding:4px 8px;border-radius:5px;font-size:11px;line-height:1.5;animation:fu .2s ease;word-break:break-word}
.ev svg{flex-shrink:0;margin-top:1px;width:11px;height:11px}
.ev-step{background:rgba(88,166,255,.06);border:1px solid rgba(88,166,255,.15);color:var(--cyan)}
.ev-thought{background:rgba(188,140,255,.06);border:1px solid rgba(188,140,255,.15);color:var(--purple)}
.ev-tool{background:rgba(63,185,80,.06);border:1px solid rgba(63,185,80,.15);color:var(--green)}
.ev-result{background:var(--bg2);border:1px solid var(--border);color:var(--fg2)}
.ev-error{background:rgba(248,81,73,.06);border:1px solid rgba(248,81,73,.15);color:var(--red)}
.ev-warn{background:rgba(240,192,96,.06);border:1px solid rgba(240,192,96,.15);color:var(--yellow2)}
.ev-final{background:rgba(63,185,80,.08);border:1px solid rgba(63,185,80,.3);color:var(--fg);font-size:12px}
.ev-final svg{color:var(--green);width:12px;height:12px}
.pre{font-size:10px;background:var(--bg);border-radius:4px;padding:4px 7px;margin-top:4px;white-space:pre-wrap;word-break:break-all;color:var(--fg3);max-height:80px;overflow-y:auto;border:1px solid var(--border)}
.confirm{background:var(--bg2);border:1px solid var(--yellow);border-radius:7px;padding:11px;display:flex;flex-direction:column;gap:7px;animation:fu .2s ease}
.confirm-hd{display:flex;align-items:center;gap:5px;color:var(--yellow2);font-size:12px;font-weight:500}
.confirm-cmd{background:var(--bg);border:1px solid var(--border2);border-radius:4px;padding:5px 9px;font-size:11px;word-break:break-all}
.cbtn-w{display:flex;gap:6px}
.byes{flex:1;padding:10px;background:var(--red);border:none;border-radius:6px;color:#fff;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;touch-action:manipulation;min-height:42px}
.bno{flex:1;padding:10px;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;color:var(--fg2);font-family:inherit;font-size:12px;cursor:pointer;touch-action:manipulation;min-height:42px}
.typing{display:flex;gap:3px;padding:3px}
.typing span{width:5px;height:5px;background:var(--fg3);border-radius:50%;animation:bo .8s infinite}
.typing span:nth-child(2){animation-delay:.15s}
.typing span:nth-child(3){animation-delay:.3s}
@keyframes bo{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:var(--fg3);padding:14px;text-align:center}
.empty h3{font-family:'Syne',sans-serif;font-size:14px;color:var(--fg2);font-weight:700}
.empty p{font-size:11px;line-height:1.6;max-width:220px}
.qwrap{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin-top:3px}
.qbtn{padding:4px 9px;background:var(--bg2);border:1px solid var(--border2);border-radius:999px;font-size:10px;color:var(--fg2);cursor:pointer;touch-action:manipulation}
.qbtn:active{border-color:var(--cyan2);color:var(--cyan)}
.input-area{padding:7px 9px max(9px,env(safe-area-inset-bottom));border-top:1px solid var(--border);background:var(--bg1);display:flex;gap:6px;align-items:flex-end;flex-shrink:0}
.inp-wrap{flex:1;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;overflow:hidden;transition:border-color .2s}
.inp-wrap:focus-within{border-color:var(--cyan2)}
.chat-ta{display:block;width:100%;background:none;border:none;outline:none;color:var(--fg);font-family:inherit;font-size:13px;padding:8px 10px;resize:none;min-height:38px;max-height:95px;line-height:1.5}
.chat-ta::placeholder{color:var(--fg3)}
.hint{font-size:9px;color:var(--fg3);padding:0 10px 4px}
.sbtn{flex-shrink:0;padding:9px 12px;background:var(--cyan2);border:none;border-radius:8px;color:#fff;cursor:pointer;display:flex;align-items:center;gap:4px;font-family:inherit;font-size:12px;font-weight:500;touch-action:manipulation;min-height:38px;min-width:38px}
.sbtn:disabled{opacity:.35}
.stpbtn{flex-shrink:0;padding:9px 12px;background:var(--red);border:none;border-radius:8px;color:#fff;cursor:pointer;display:flex;align-items:center;touch-action:manipulation;min-height:38px}
/* RESIZE HANDLE */
.rh{height:4px;cursor:row-resize;background:var(--border);flex-shrink:0}
.rh:hover{background:var(--cyan2)}
/* MODAL */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:100;display:flex;align-items:flex-end;justify-content:center;animation:fu .15s ease}
@media(min-width:600px){.modal-bg{align-items:center}}
.modal{background:var(--bg1);border:1px solid var(--border2);border-radius:12px 12px 0 0;width:100%;max-width:560px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden}
@media(min-width:600px){.modal{border-radius:10px}}
.mhd{padding:11px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600}
.mhd span{flex:1}
.mclose{background:none;border:none;color:var(--fg3);cursor:pointer;font-size:17px;padding:2px}
.mbody{flex:1;overflow-y:auto;padding:0}
/* RESIZE */
@media(max-width:767px){
  .sidebar{position:fixed;left:0;top:0;bottom:0;transform:translateX(-100%);box-shadow:4px 0 20px rgba(0,0,0,.6)}
  .sidebar.open{transform:translateX(0)}
  .ftree-panel{display:none}
  .tabbar{display:flex}
  .hint{display:none}
  .send-label{display:none}
  .rh{display:none}
}
@media(min-width:768px){
  .sidebar{position:relative;transform:none!important}
  .menu-btn{display:none!important}
  .overlay{display:none!important}
  .tabbar{display:none!important}
}
`;

// ══════════════════════════════════════════
//  FILE NODE
// ══════════════════════════════════════════
function FileNode({node,depth,onOpen,selPath}){
  const[open,setOpen]=useState(depth<2);
  const isDir=node.type==='dir';
  const pad=depth*11+7;
  const col=isDir?'var(--yellow2)':ec(node.ext);
  const sel=selPath===node.path;
  if(isDir) return(
    <div>
      <div className={`fnode${sel?' sel':''}`} style={{paddingLeft:pad}} onClick={()=>setOpen(o=>!o)}>
        {open?<I.ChevD width={9} height={9} style={{flexShrink:0,color:'var(--fg3)'}}/>:<I.ChevR width={9} height={9} style={{flexShrink:0,color:'var(--fg3)'}}/>}
        <I.Folder width={12} height={12} style={{color:col,flexShrink:0}}/>
        <span className="fnode-name" style={{color:'var(--fg)'}}>{node.name}</span>
      </div>
      {open&&node.children?.map(c=><FileNode key={c.path} node={c} depth={depth+1} onOpen={onOpen} selPath={selPath}/>)}
    </div>
  );
  return(
    <div className={`fnode${sel?' sel':''}`} style={{paddingLeft:pad+12}} onClick={()=>onOpen(node)}>
      <I.File width={11} height={11} style={{color:col,flexShrink:0}}/>
      <span className="fnode-name" style={{color:sel?'var(--cyan)':'var(--fg2)'}}>{node.name}</span>
    </div>
  );
}

// ══════════════════════════════════════════
//  DIFF VIEWER
// ══════════════════════════════════════════
function DiffViewer({oldText,newText}){
  const raw=computeDiff(oldText,newText);
  const lines=collapseDiff(raw);
  if(!raw.some(l=>l.type!=='ctx')) return <div className="no-diff">✓ No changes</div>;
  return(
    <div className="diff-view">
      {lines.map((l,i)=>{
        if(l.type==='hdr') return <div key={i} className="diff-hdr">{l.text}</div>;
        const cls=l.type==='add'?'add':l.type==='del'?'del':'ctx';
        const sign=l.type==='add'?'+':l.type==='del'?'-':' ';
        const sc=l.type==='add'?'a':l.type==='del'?'d':'';
        return(
          <div key={i} className={`diff-line ${cls}`}>
            <span className="diff-ln">{l.old||''}</span>
            <span className="diff-ln">{l.new||''}</span>
            <span className={`diff-sign ${sc}`}>{sign}</span>
            <span className="diff-txt">{l.text}</span>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════
//  TERMINAL COMPONENT
// ══════════════════════════════════════════
function TerminalPanel({cwd}){
  const[lines,setLines]=useState([{t:'sys',s:`Terminal — CWD: ${cwd}`}]);
  const[inp,setInp]=useState('');
  const[ws,setWs]=useState(null);
  const[connected,setConnected]=useState(false);
  const bodyRef=useRef(null);
  const inpRef=useRef(null);

  useEffect(()=>{
    const proto=window.location.protocol==='https:'?'wss':'ws';
    const socket=new WebSocket(`${proto}://${window.location.host}/terminal`);
    socket.onopen=()=>{};
    socket.onmessage=e=>{
      try{
        const msg=JSON.parse(e.data);
        if(msg.type==='ready'){ setConnected(true); addLine('sys',`Connected ${msg.hasPty?'(PTY)':'(basic)'} — ${msg.cwd}`); }
        else if(msg.type==='output') addLine('out', msg.data);
        else if(msg.type==='exit')   addLine('sys','Process exited');
      }catch{}
    };
    socket.onclose=()=>{ setConnected(false); addLine('sys','Disconnected'); };
    socket.onerror=()=>addLine('err','WebSocket error');
    setWs(socket);
    return()=>socket.close();
  },[]);

  useEffect(()=>{ bodyRef.current?.scrollTo(0,99999); },[lines]);

  const addLine=(t,s)=>setLines(l=>[...l,{t,s,id:Date.now()+Math.random()}]);

  const submit=()=>{
    if(!inp.trim()||!ws||ws.readyState!==1) return;
    ws.send(JSON.stringify({type:'input',data:inp+'\n'}));
    addLine('cmd','$ '+inp);
    setInp('');
  };

  return(
    <div className="term-wrap">
      <div className="term-bar">
        <I.Term width={13} height={13}/>
        <span>Terminal</span>
        <span style={{fontSize:9,marginLeft:4,padding:'1px 5px',borderRadius:3,background:connected?'rgba(63,185,80,.15)':'rgba(248,81,73,.15)',color:connected?'var(--green)':'var(--red)',border:`1px solid ${connected?'var(--green)':'var(--red)'}`}}>{connected?'connected':'disconnected'}</span>
        <button className="ibtn" style={{marginLeft:'auto'}} onClick={()=>setLines([])} title="Clear"><I.Clear width={12} height={12}/></button>
        <button className="ibtn" onClick={()=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:'input',data:'\x03'}));}} title="Ctrl+C" style={{fontSize:10,padding:'2px 5px'}}>^C</button>
      </div>
      <div className="term-body" ref={bodyRef} onClick={()=>inpRef.current?.focus()}>
        {lines.map(l=>(
          <div key={l.id} className={`term-line${l.t==='err'?' err':l.t==='sys'?' sys':''}`}>
            {l.s}
          </div>
        ))}
      </div>
      <div className="term-input-row">
        <span className="term-prompt">❯</span>
        <input ref={inpRef} className="term-inp" value={inp} onChange={e=>setInp(e.target.value)}
          onKeyDown={e=>{
            if(e.key==='Enter'){submit();}
            else if(e.key==='c'&&e.ctrlKey&&ws?.readyState===1){ ws.send(JSON.stringify({type:'input',data:'\x03'})); setInp(''); }
          }}
          placeholder="type command…" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          disabled={!connected}
        />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
//  EDITOR PANE  — simplified reliable layout
// ══════════════════════════════════════════
function EditorPane({file,onChange,onSave,editorMode,setEditorMode,onUndo,onRedo,canUndo,canRedo}){
  const taRef  = useRef(null);
  const numRef = useRef(null);
  const [hlHtml, setHlHtml] = useState('');

  const lineCount = file ? file.content.split('\n').length : 0;
  const lineNums  = useMemo(()=>
    Array.from({length:lineCount},(_,i)=>i+1).join('\n'),
  [lineCount]);

  // async highlight — never blocks render
  useEffect(()=>{
    if (!file?.content){ setHlHtml(''); return; }
    const id = setTimeout(()=>{
      try { setHlHtml(highlight(file.content)); }
      catch { setHlHtml(''); }
    }, 80);
    return ()=>clearTimeout(id);
  },[file?.content]);

  // sync line-nums scroll with textarea
  const syncScroll = e => {
    if (numRef.current) numRef.current.scrollTop = e.target.scrollTop;
  };

  const handleTab = e => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const ta = e.target;
    const s = ta.selectionStart, en = ta.selectionEnd;
    const v = ta.value;
    const nv = v.slice(0,s)+'  '+v.slice(en);
    onChange(nv);
    // restore cursor after React re-render
    requestAnimationFrame(()=>{
      if(taRef.current){ taRef.current.selectionStart = taRef.current.selectionEnd = s+2; }
    });
  };

  if (!file) return (
    <div className="ed-empty">
      <I.File width={36} height={36}/><p>Open a file from the tree</p>
    </div>
  );

  return (
    <div className="editor-wrap">
      {/* toolbar */}
      <div className="ebar">
        <button className={`eact${editorMode==='edit'?' on':''}`} onClick={()=>setEditorMode('edit')}><I.File width={10} height={10}/> Edit</button>
        <button className={`eact${editorMode==='diff'?' on':''}`} onClick={()=>setEditorMode('diff')}><I.Diff width={10} height={10}/> Diff</button>
        <button className="eact" onClick={onUndo}  disabled={!canUndo}  title="Undo"><I.Undo width={10} height={10}/></button>
        <button className="eact" onClick={onRedo}  disabled={!canRedo}  title="Redo"><I.Redo width={10} height={10}/></button>
        <span style={{flex:1}}/>
        {file.dirty && <span style={{fontSize:10,color:'var(--yellow)'}}>●</span>}
        <span style={{fontSize:9,color:'var(--fg3)',marginRight:4}}>{lineCount}L</span>
        <button className="eact on" onClick={onSave}><I.Save width={10} height={10}/> Save</button>
      </div>

      {/* editor body */}
      <div className="editor-body">
        {editorMode==='edit' ? (
          <div className="code-wrap">
            {/* line numbers — vertical, synced */}
            <div ref={numRef} className="line-nums">{lineNums}</div>

            {/* code area */}
            <div className="code-editor-area">
              {/* highlight layer */}
              {hlHtml && (
                <div
                  className="code-hl"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{__html: hlHtml}}
                />
              )}
              {/* textarea */}
              <textarea
                ref={taRef}
                className="code-ta"
                value={file.content}
                onChange={e => onChange(e.target.value)}
                onScroll={syncScroll}
                onKeyDown={handleTab}
                style={{ color: hlHtml ? 'transparent' : 'var(--fg)', caretColor:'var(--cyan)' }}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="off"
              />
            </div>
          </div>
        ) : (
          file.original != null
            ? <DiffViewer oldText={file.original} newText={file.content}/>
            : <div className="no-diff">No original to diff</div>
        )}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════
//  PROCESS MANAGER PANEL
// ══════════════════════════════════════════
function ProcessManager() {
  const [procs, setProcs] = useState([]);
  const [filter, setFilter] = useState('all'); // all | running | done | error

  useEffect(() => {
    // fetch initial snapshot
    fetch(`${S}/api/processes`).then(r=>r.json()).then(setProcs).catch(()=>{});

    // subscribe to SSE stream
    const es = new EventSource(`${S}/api/processes/stream`);
    es.onmessage = e => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === 'snapshot') { setProcs(ev.processes); return; }
        if (ev.type === 'process_start') {
          setProcs(p => [ev.process, ...p]);
        }
        if (ev.type === 'process_output') {
          setProcs(p => p.map(x => x.id===ev.id ? { ...x, output: (x.output||'')+ev.data } : x));
        }
        if (ev.type === 'process_end') {
          setProcs(p => p.map(x => x.id===ev.id ? { ...x, status:ev.status, exitCode:ev.exitCode } : x));
        }
      } catch {}
    };
    return () => es.close();
  }, []);

  const kill = async id => {
    await fetch(`${S}/api/processes/${id}`, { method:'DELETE' });
    setProcs(p => p.map(x => x.id===id ? { ...x, status:'killed' } : x));
  };

  const clearAll = async () => {
    await fetch(`${S}/api/processes`, { method:'DELETE' });
    setProcs([]);
  };

  const running  = procs.filter(p=>p.status==='running');
  const filtered = filter==='all' ? procs : procs.filter(p=>p.status===filter);

  const statusColor = s => s==='running'?'var(--cyan)':s==='done'?'var(--green)':s==='error'?'var(--red)':'var(--fg3)';
  const statusDot   = s => s==='running'?'⟳':s==='done'?'✓':s==='error'?'✗':'○';

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
      {/* header */}
      <div style={{padding:'8px 12px',borderBottom:'1px solid var(--border)',background:'var(--bg1)',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
          <span style={{fontSize:14}}>⚙️</span>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:13}}>Process Manager</span>
          {running.length>0&&(
            <span style={{fontSize:9,color:'var(--cyan)',border:'1px solid var(--cyan)',borderRadius:999,padding:'1px 6px',animation:'blink 1s infinite'}}>
              {running.length} running
            </span>
          )}
          <button onClick={clearAll} style={{marginLeft:'auto',background:'none',border:'1px solid var(--border2)',borderRadius:4,color:'var(--fg3)',cursor:'pointer',padding:'2px 7px',fontSize:10,fontFamily:'inherit'}}>
            Clear all
          </button>
        </div>
        {/* filter tabs */}
        <div style={{display:'flex',gap:4}}>
          {['all','running','done','error'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              style={{padding:'2px 9px',background:filter===f?'var(--bg3)':'none',border:`1px solid ${filter===f?'var(--border2)':'transparent'}`,borderRadius:4,color:filter===f?'var(--fg)':'var(--fg3)',cursor:'pointer',fontSize:10,fontFamily:'inherit'}}>
              {f} {f==='all'?procs.length:procs.filter(p=>p.status===f).length}
            </button>
          ))}
        </div>
      </div>

      {/* process list */}
      <div style={{flex:1,overflow:'auto',display:'flex',flexDirection:'column',gap:0}}>
        {filtered.length===0 ? (
          <div style={{padding:20,textAlign:'center',color:'var(--fg3)',fontSize:11}}>
            No processes yet.<br/>Commands run by the agent will appear here.
          </div>
        ) : filtered.map(p=>(
          <ProcessCard key={p.id} proc={p} onKill={kill} statusColor={statusColor} statusDot={statusDot}/>
        ))}
      </div>
    </div>
  );
}

function ProcessCard({ proc:p, onKill, statusColor, statusDot }) {
  const [expanded, setExpanded] = useState(p.status==='running');
  const outRef = useRef(null);

  // auto-scroll output
  useEffect(()=>{ if(expanded&&outRef.current) outRef.current.scrollTop=outRef.current.scrollHeight; },[p.output,expanded]);
  // auto-expand when starts running
  useEffect(()=>{ if(p.status==='running') setExpanded(true); },[p.status]);

  const elapsed = p.endedAt
    ? Math.round((new Date(p.endedAt)-new Date(p.startedAt))/1000)+'s'
    : p.status==='running' ? '…' : '';

  return (
    <div style={{borderBottom:'1px solid var(--border)',background:expanded?'var(--bg2)':'transparent',transition:'background .2s'}}>
      {/* row */}
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',cursor:'pointer'}} onClick={()=>setExpanded(e=>!e)}>
        <span style={{fontSize:11,color:statusColor(p.status),fontWeight:600,flexShrink:0,animation:p.status==='running'?'spin 1s linear infinite':undefined}}>
          {statusDot(p.status)}
        </span>
        <span style={{flex:1,fontSize:11,color:'var(--fg)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:"'JetBrains Mono',monospace"}}>
          {p.cmd}
        </span>
        <span style={{fontSize:9,color:'var(--fg3)',flexShrink:0}}>{elapsed}</span>
        {p.status==='running'&&(
          <button
            onPointerDown={e=>{e.stopPropagation();onKill(p.id);}}
            style={{background:'none',border:'1px solid var(--red)',borderRadius:3,color:'var(--red)',cursor:'pointer',padding:'1px 5px',fontSize:9,flexShrink:0,fontFamily:'inherit'}}
          >Kill</button>
        )}
        <span style={{fontSize:9,color:'var(--fg3)',flexShrink:0}}>{expanded?'▲':'▼'}</span>
      </div>

      {/* output */}
      {expanded&&(
        <div ref={outRef}
          style={{margin:'0 12px 8px',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:5,padding:'7px 10px',fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'#ccffcc',maxHeight:200,overflowY:'auto',whiteSpace:'pre-wrap',wordBreak:'break-all',lineHeight:1.5}}>
          {p.output||<span style={{color:'var(--fg3)',fontStyle:'italic'}}>No output yet…</span>}
          {p.status==='running'&&<span style={{color:'var(--cyan)',animation:'blink 1s infinite'}}>▊</span>}
          {p.exitCode!=null&&p.status!=='running'&&(
            <div style={{marginTop:6,paddingTop:4,borderTop:'1px solid var(--border)',color:p.exitCode===0?'var(--green)':'var(--red)',fontSize:10}}>
              EXIT: {p.exitCode}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
//  SWARM PANEL
// ══════════════════════════════════════════
function AgentCard({ agentId, def, state }) {
  const s = state || {};
  const col = def?.color || 'var(--fg3)';
  const borderCol = s.status==='running'?'var(--cyan2)':s.status==='done'?'rgba(63,185,80,.4)':s.status==='error'?'rgba(248,81,73,.4)':'var(--border)';
  return (
    <div style={{background:'var(--bg2)',border:`1px solid ${borderCol}`,borderRadius:7,padding:'9px 11px',transition:'all .3s',boxShadow:s.status==='running'?`0 0 14px ${col}22`:'none'}}>
      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
        <span style={{fontSize:16}}>{def?.emoji}</span>
        <span style={{fontWeight:600,fontSize:12}}>{def?.name}</span>
        {s.status==='running'&&<span style={{marginLeft:'auto',fontSize:9,color:'var(--cyan)',display:'flex',alignItems:'center',gap:3}}><span style={{width:5,height:5,background:'var(--cyan)',borderRadius:'50%',animation:'pulse 1s infinite'}}/>running</span>}
        {s.status==='done'&&<span style={{marginLeft:'auto',fontSize:9,color:'var(--green)'}}>✓ done</span>}
        {s.status==='error'&&<span style={{marginLeft:'auto',fontSize:9,color:'var(--red)'}}>✗ error</span>}
      </div>
      <div style={{fontSize:10,color:'var(--fg3)',marginBottom:s.task?5:0,lineHeight:1.4}}>{def?.description}</div>
      {s.task&&<div style={{fontSize:10,color:'var(--fg2)',background:'var(--bg)',borderRadius:4,padding:'3px 6px',marginBottom:3,lineHeight:1.5}}>{s.task?.slice(0,100)}</div>}
      {s.currentThought&&s.status==='running'&&<div style={{fontSize:10,color:'var(--purple)',marginTop:3,fontStyle:'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>💭 {s.currentThought}</div>}
      {s.lastTool&&s.status==='running'&&<div style={{fontSize:10,color:'var(--green)',marginTop:2}}>⚙ {s.lastTool}</div>}
      {s.result&&s.status!=='running'&&<div style={{fontSize:10,color:'var(--fg2)',marginTop:4,maxHeight:55,overflow:'hidden',lineHeight:1.4,borderTop:'1px solid var(--border)',paddingTop:4}}>{String(s.result).slice(0,180)}</div>}
    </div>
  );
}

function SwarmPanel({ model }) {
  const[task,setTask]=useState('');
  const[running,setRunning]=useState(false);
  const[phase,setPhase]=useState('');
  const[plan,setPlan]=useState(null);
  const[agentStates,setAS]=useState({});
  const[events,setEvents]=useState([]);
  const[finalMsg,setFinalMsg]=useState('');
  const[agents,setAgents]=useState({});
  const abortRef=useRef(null);
  const evRef=useRef(null);

  useEffect(()=>{ fetch('/api/swarm/agents').then(r=>r.json()).then(setAgents).catch(()=>{}); },[]);
  useEffect(()=>{ evRef.current?.scrollTo(0,99999); },[events]);

  const addEv=ev=>setEvents(e=>[...e.slice(-300),{...ev,id:Date.now()+Math.random()}]);
  const upd=(id,u)=>setAS(s=>({...s,[id]:{...(s[id]||{}),...u}}));

  const run=async()=>{
    if(!task.trim()||running) return;
    setRunning(true); setFinalMsg(''); setPlan(null); setAS({}); setEvents([]);
    const ctrl=new AbortController(); abortRef.current=ctrl;
    try{
      const res=await fetch('/api/swarm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task,model}),signal:ctrl.signal});
      const reader=res.body.getReader(); const dec=new TextDecoder(); let buf='';
      while(true){
        const{done,value}=await reader.read(); if(done)break;
        buf+=dec.decode(value,{stream:true});
        const parts=buf.split('\n\n'); buf=parts.pop();
        for(const part of parts){
          const line=part.trim(); if(!line.startsWith('data:'))continue;
          try{
            const ev=JSON.parse(line.slice(5).trim()); addEv(ev);
            if(ev.type==='phase')        setPhase(ev.phase);
            if(ev.type==='plan')         setPlan(ev.plan);
            if(ev.type==='agent_start')  upd(ev.agent,{status:'running',task:ev.task,steps:0});
            if(ev.type==='agent_step')   upd(ev.agent,{steps:ev.step});
            if(ev.type==='agent_thought')upd(ev.agent,{currentThought:ev.message});
            if(ev.type==='agent_tool')   upd(ev.agent,{lastTool:`${ev.tool}(${JSON.stringify(ev.args||{}).slice(0,50)})`});
            if(ev.type==='agent_done')   upd(ev.agent,{status:'done',result:ev.result,currentThought:null,lastTool:null});
            if(ev.type==='agent_error')  upd(ev.agent,{status:'error',result:ev.message});
            if(ev.type==='final')        setFinalMsg(ev.message);
          }catch{}
        }
      }
    }catch(e){ if(e.name!=='AbortError')addEv({type:'error',message:e.message}); }
    setRunning(false);
  };

  const ORDER=['architect','researcher','coder','reviewer','tester','docs','devops'];

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
      {/* TOP BAR */}
      <div style={{padding:'9px 12px',borderBottom:'1px solid var(--border)',background:'var(--bg1)',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:7}}>
          <span style={{fontSize:15}}>🐝</span>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:13}}>Agent Swarm</span>
          {running&&<span style={{fontSize:9,color:'var(--cyan)',border:'1px solid var(--cyan)',borderRadius:999,padding:'1px 6px',animation:'blink 1s infinite'}}>{phase==='planning'?'🏗 Planning':phase==='execution'?'⚡ Executing':phase==='synthesis'?'🧬 Synthesizing':'…'}</span>}
          {!running&&finalMsg&&<span style={{fontSize:9,color:'var(--green)',border:'1px solid rgba(63,185,80,.4)',borderRadius:999,padding:'1px 6px'}}>✓ Done</span>}
        </div>
        <div style={{display:'flex',gap:6}}>
          <textarea
            style={{flex:1,background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:6,padding:'7px 10px',color:'var(--fg)',fontFamily:'inherit',fontSize:11,outline:'none',resize:'none',minHeight:36,maxHeight:72,lineHeight:1.5}}
            placeholder="Describe a complex task… e.g. 'Add user authentication with JWT to this Express app'"
            value={task} onChange={e=>setTask(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),run())}
            disabled={running} rows={1}
          />
          {running
            ?<button onClick={()=>abortRef.current?.abort()} style={{padding:'7px 12px',background:'var(--red)',border:'none',borderRadius:6,color:'#fff',cursor:'pointer',fontSize:11,fontFamily:'inherit',flexShrink:0}}>Stop</button>
            :<button onClick={run} disabled={!task.trim()} style={{padding:'7px 12px',background:'var(--cyan2)',border:'none',borderRadius:6,color:'#fff',cursor:'pointer',fontSize:11,fontFamily:'inherit',flexShrink:0,opacity:task.trim()?1:.4}}>🚀 Run</button>
          }
        </div>
      </div>

      <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0,flexDirection:window.innerWidth<600?'column':'row'}}>
        {/* AGENT CARDS */}
        <div style={{width:window.innerWidth<600?'100%':260,flexShrink:0,overflow:'auto',padding:10,display:'flex',flexDirection:'column',gap:7,borderRight:window.innerWidth<600?'none':'1px solid var(--border)',borderBottom:window.innerWidth<600?'1px solid var(--border)':'none',maxHeight:window.innerWidth<600?220:'none'}}>
          <div style={{fontSize:9,color:'var(--fg3)',textTransform:'uppercase',letterSpacing:'1px',flexShrink:0}}>Agents</div>
          {plan?.subtasks?.length>0&&(
            <div style={{background:'var(--bg2)',border:'1px solid var(--cyan2)',borderRadius:6,padding:'7px 9px',flexShrink:0}}>
              <div style={{fontSize:9,color:'var(--cyan)',marginBottom:3,fontWeight:600}}>🏗 Plan — {plan.subtasks.length} tasks</div>
              {plan.subtasks.map(t=>(
                <div key={t.id} style={{fontSize:9,color:'var(--fg2)',padding:'1px 0',display:'flex',gap:5}}>
                  <span style={{color:agents[t.agent]?.color||'var(--fg3)',flexShrink:0}}>{agents[t.agent]?.emoji||'•'}</span>
                  <span style={{lineHeight:1.4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.task}</span>
                </div>
              ))}
            </div>
          )}
          {ORDER.filter(id=>agents[id]).map(id=><AgentCard key={id} agentId={id} def={agents[id]} state={agentStates[id]}/>)}
        </div>

        {/* EVENTS + FINAL */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
          {finalMsg&&(
            <div style={{flexShrink:0,padding:'10px 12px',borderBottom:'1px solid var(--border)',background:'rgba(63,185,80,.04)',maxHeight:180,overflowY:'auto'}}>
              <div style={{fontSize:10,color:'var(--green)',fontWeight:600,marginBottom:5}}>✓ Swarm Complete</div>
              <div style={{fontSize:12,color:'var(--fg)',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{finalMsg}</div>
            </div>
          )}
          <div ref={evRef} style={{flex:1,overflow:'auto',padding:'8px 10px',display:'flex',flexDirection:'column',gap:3}}>
            <div style={{fontSize:9,color:'var(--fg3)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:3,flexShrink:0}}>Live Events</div>
            {events.length===0&&!running&&(
              <div style={{color:'var(--fg3)',fontSize:11,textAlign:'center',marginTop:30,lineHeight:2}}>
                Enter a task and hit Run 🚀<br/>Agents will work in parallel
              </div>
            )}
            {events.map(ev=>{
              const ag=ev.agent?agents[ev.agent]:null;
              switch(ev.type){
                case 'phase':        return <div key={ev.id} style={{fontSize:10,color:'var(--cyan)',fontWeight:600,padding:'3px 0',borderTop:'1px solid var(--border)',marginTop:3}}>{ev.message}</div>;
                case 'plan':         return <div key={ev.id} style={{fontSize:10,color:'var(--fg3)',background:'var(--bg2)',borderRadius:4,padding:'3px 6px'}}>📋 Plan: {ev.plan?.subtasks?.length||0} subtasks</div>;
                case 'batch_start':  return <div key={ev.id} style={{fontSize:10,color:'var(--yellow2)',background:'rgba(240,192,96,.07)',border:'1px solid rgba(240,192,96,.2)',borderRadius:4,padding:'3px 7px'}}>⚡ Parallel: {ev.batch?.map(t=>agents[t.agent]?.emoji||t.agent).join(' ')}</div>;
                case 'agent_start':  return <div key={ev.id} style={{fontSize:10,color:ag?.color||'var(--fg3)'}}>{ag?.emoji} <strong>{ag?.name}</strong> started</div>;
                case 'agent_thought':return <div key={ev.id} style={{fontSize:10,color:'var(--purple)',paddingLeft:10,fontStyle:'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>💭 [{ag?.name}] {ev.message}</div>;
                case 'agent_tool':   return <div key={ev.id} style={{fontSize:10,color:'var(--green)',paddingLeft:10}}>⚙ [{ag?.name}] {ev.tool}({JSON.stringify(ev.args||{}).slice(0,60)})</div>;
                case 'agent_done':   return <div key={ev.id} style={{fontSize:10,color:ag?.color||'var(--green)'}}>✓ <strong>{ag?.name}</strong> done</div>;
                case 'agent_error':  return <div key={ev.id} style={{fontSize:10,color:'var(--red)'}}>✗ [{ag?.name}] {ev.message}</div>;
                case 'final':        return <div key={ev.id} style={{fontSize:10,color:'var(--green)',fontWeight:600}}>🧬 Synthesis complete</div>;
                case 'error':        return <div key={ev.id} style={{fontSize:10,color:'var(--red)',background:'rgba(248,81,73,.07)',borderRadius:4,padding:'3px 6px'}}>✗ {ev.message}</div>;
                default: return null;
              }
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════
export default function App(){
  // ── CHAT ────────────────────────────────
  const[msgs,setMsgs]=useState([]);
  const[input,setInput]=useState('');
  const[running,setRunning]=useState(false);
  const[status,setStatus]=useState('idle');
  const[models,setModels]=useState([]);
  const[model,setModel]=useState('');
  const[activeTool,setActive]=useState(null);
  const[confirm,setConfirm]=useState(null);
  const[stepCount,setStepCount]=useState(0);
  const[sidebarOpen,setSidebar]=useState(false);
  const[cwd,setCwd]=useState('');
  const[cwdInput,setCwdInput]=useState('');

  // ── EDITOR ──────────────────────────────
  const[tree,setTree]=useState([]);
  const[tabs,setTabs]=useState([]); // [{path,name,ext,content,original,dirty,undoStack,redoStack}]
  const[activeTab,setActiveTab]=useState(null);
  const[selPath,setSelPath]=useState(null);
  const[editorMode,setEditorMode]=useState('edit');

  // ── PANELS ──────────────────────────────
  // desktopPanel: which panel is open on right side
  // 'chat' | 'editor' | 'terminal' | 'preview'
  const[desktopPanel,setDesktopPanel]=useState('chat');
  const[mobileTab,setMobileTab]=useState('chat');
  const[editorH,setEditorH]=useState(45);
  const[isMobile,setIsMobile]=useState(window.innerWidth<768);

  // ── FEATURES ────────────────────────────
  const[personas,setPersonas]=useState({});
  const[persona,setPersona]=useState('coder');
  const[workspaces,setWorkspaces]=useState([]);
  const[memory,setMemory]=useState({global:{},workspaces:{}});
  const[taskHistory,setTaskHistory]=useState([]);
  const[askHuman,setAskHuman]=useState(null);
  const[planSteps,setPlanSteps]=useState([]);
  const[streamLines,setStreamLines]=useState([]);
  const[images,setImages]=useState([]); // [{url, path, name}]
  const[showMemory,setShowMemory]=useState(false);
  const[showLog,setShowLog]=useState(false);
  const[showHistory,setShowHistory]=useState(false);
  const[logs,setLogs]=useState([]);
  const[previewUrl,setPreviewUrl]=useState('');
  const[newMemKey,setNewMemKey]=useState('');
  const[newMemVal,setNewMemVal]=useState('');

  const bottomRef=useRef(null);
  const abortRef=useRef(null);
  const taRef=useRef(null);
  const resizing=useRef(false);

  // ── VH FIX ──────────────────────────────
  useEffect(()=>{
    const f=()=>{ document.documentElement.style.setProperty('--vh',`${window.innerHeight*.01}px`); setIsMobile(window.innerWidth<768); };
    f(); window.addEventListener('resize',f); return()=>window.removeEventListener('resize',f);
  },[]);

  // ── INIT ────────────────────────────────
  useEffect(()=>{
    fetch(`${S}/api/models`).then(r=>r.json()).then(ms=>{ setModels(ms); if(ms.length)setModel(ms[0]); }).catch(()=>{});
    fetch(`${S}/api/cwd`).then(r=>r.json()).then(d=>{ setCwd(d.cwd||''); setCwdInput(d.cwd||''); }).catch(()=>{});
    fetch(`${S}/api/tree`).then(r=>r.json()).then(d=>{ setTree(d.tree||[]); setCwd(c=>c||d.cwd||''); }).catch(()=>{});
    fetch(`${S}/api/state`).then(r=>r.json()).then(d=>{ if(d.context){ addSys(`📂 Resumed session (${d.context.length} chars). Type "continue".`); setStatus('paused'); } }).catch(()=>{});
    fetch(`${S}/api/personas`).then(r=>r.json()).then(setPersonas).catch(()=>{});
    fetch(`${S}/api/workspaces`).then(r=>r.json()).then(setWorkspaces).catch(()=>{});
    fetch(`${S}/api/memory`).then(r=>r.json()).then(setMemory).catch(()=>{});
    fetch(`${S}/api/history`).then(r=>r.json()).then(setTaskHistory).catch(()=>{});
  },[]);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); },[msgs]);

  // ── PANE RESIZE ─────────────────────────
  useEffect(()=>{
    const mv=e=>{ if(!resizing.current)return; const b=document.querySelector('.center'); if(!b)return; const r=b.getBoundingClientRect(); setEditorH(Math.min(80,Math.max(15,((e.clientY-r.top)/r.height)*100))); };
    const up=()=>{ resizing.current=false; };
    window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up);
    return()=>{ window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up); };
  },[]);

  // ── FILE TREE ───────────────────────────
  const fetchTree=useCallback(async()=>{
    try{ const d=await fetch(`${S}/api/tree`).then(r=>r.json()); setTree(d.tree||[]); setCwd(d.cwd||''); }catch{}
  },[]);

  // sync cwdInput with cwd
  useEffect(()=>{ if(cwd) setCwdInput(cwd); },[cwd]);
  useEffect(()=>{ if(mobileTab==='editor') fetchTree(); },[mobileTab]);

  // ── OPEN FILE ───────────────────────────
  const openFile=useCallback(async(node)=>{
    setSelPath(node.path);
    const ex=tabs.find(t=>t.path===node.path);
    if(ex){ setActiveTab(node.path); if(isMobile)setMobileTab('editor'); return; }
    try{
      const d=await fetch(`${S}/api/file?path=${encodeURIComponent(node.path)}`).then(r=>r.json());
      if(d.error)return;
      setTabs(ts=>[...ts,{path:node.path,name:node.name,ext:node.ext,content:d.content,original:d.content,dirty:false,undoStack:[],redoStack:[]}]);
      setActiveTab(node.path); if(isMobile)setMobileTab('editor');
    }catch{}
  },[tabs,isMobile]);

  // ── SAVE FILE ───────────────────────────
  const saveFile=useCallback(async()=>{
    const file=tabs.find(t=>t.path===activeTab); if(!file)return;
    try{
      const d=await fetch(`${S}/api/file`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:file.path,content:file.content})}).then(r=>r.json());
      if(d.ok){ setTabs(ts=>ts.map(t=>t.path===file.path?{...t,dirty:false,original:file.content}:t)); addSys(`💾 Saved: ${file.name}`); }
    }catch(e){addSys(`❌ ${e.message}`);}
  },[tabs,activeTab]);

  // ── CHANGE CONTENT + UNDO ───────────────
  const changeContent=(content)=>{
    setTabs(ts=>ts.map(t=>{
      if(t.path!==activeTab)return t;
      const undoStack=[...t.undoStack,t.content].slice(-50);
      return{...t,content,dirty:t.original!==content,undoStack,redoStack:[]};
    }));
  };
  const undo=()=>setTabs(ts=>ts.map(t=>{
    if(t.path!==activeTab||!t.undoStack.length)return t;
    const undoStack=[...t.undoStack]; const prev=undoStack.pop();
    return{...t,content:prev,dirty:t.original!==prev,undoStack,redoStack:[...t.redoStack,t.content]};
  }));
  const redo=()=>setTabs(ts=>ts.map(t=>{
    if(t.path!==activeTab||!t.redoStack.length)return t;
    const redoStack=[...t.redoStack]; const next=redoStack.pop();
    return{...t,content:next,dirty:t.original!==next,redoStack,undoStack:[...t.undoStack,t.content]};
  }));
  const closeTab=p=>{
    const idx=tabs.findIndex(t=>t.path===p); const next=tabs[idx+1]||tabs[idx-1];
    setTabs(ts=>ts.filter(t=>t.path!==p)); setActiveTab(next?.path||null);
  };

  // ── REFRESH OPEN FILES AFTER AGENT RUN ──
  const refreshFiles=useCallback(async()=>{
    for(const tab of tabs){
      try{
        const d=await fetch(`${S}/api/file?path=${encodeURIComponent(tab.path)}`).then(r=>r.json());
        if(d.content!==tab.content) setTabs(ts=>ts.map(t=>t.path===tab.path?{...t,content:d.content,dirty:t.original!==d.content}:t));
      }catch{}
    }
  },[tabs]);

  // ── CHAT HELPERS ────────────────────────
  const addMsg=(role,content)=>setMsgs(m=>[...m,{id:Date.now()+Math.random(),role,content}]);
  const addSys=c=>addMsg('sys',c);
  const addEv=(type,data)=>setMsgs(m=>[...m,{id:Date.now()+Math.random(),role:'ev',type,...data}]);

  // ── SEND ────────────────────────────────
  const send=useCallback(async(text)=>{
    if(!text.trim()||running)return;
    setInput(''); setSidebar(false); addMsg('user',text);
    setRunning(true); setStatus('running'); setStepCount(0);
    const ctrl=new AbortController(); abortRef.current=ctrl;
    const t0=Date.now();
    try{
      const res=await fetch(`${S}/api/run`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,model}),signal:ctrl.signal});
      const reader=res.body.getReader(); const dec=new TextDecoder(); let buf='';
      let finalMsg='';
      while(true){
        const{done,value}=await reader.read(); if(done)break;
        buf+=dec.decode(value,{stream:true});
        const parts=buf.split('\n\n'); buf=parts.pop();
        for(const part of parts){ const line=part.trim(); if(!line.startsWith('data:'))continue; try{ const ev=JSON.parse(line.slice(5).trim()); handleEv(ev); if(ev.type==='final')finalMsg=ev.message; }catch{} }
      }
      // Save to history
      if(finalMsg){
        const entry={question:text,answer:finalMsg,steps:stepCount,duration:Math.round((Date.now()-t0)/1000)};
        await fetch(`${S}/api/history`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(entry)}).catch(()=>{});
        setTaskHistory(h=>[{...entry,id:Date.now(),timestamp:new Date().toISOString()},...h].slice(0,200));
      }
    }catch(e){ if(e.name!=='AbortError')addEv('error',{message:`Error: ${e.message}`}); }
    setRunning(false); setActive(null); abortRef.current=null;
    await refreshFiles(); await fetchTree();
  },[running,model,stepCount,refreshFiles,fetchTree]);

  const handleEv=ev=>{
    switch(ev.type){
      case 'step':    setStepCount(n=>n+1); addEv('step',{message:ev.message}); break;
      case 'thought': addEv('thought',{message:ev.message}); break;
      case 'tool_call': setActive(ev.tool); addEv('tool',{message:`${ev.tool}(${JSON.stringify(ev.args)})`}); break;
      case 'tool_result': setActive(null); addEv('result',{message:ev.tool,result:ev.result}); break;
      case 'confirm_request': setConfirm({runId:ev.runId,tool:ev.tool,preview:ev.preview}); break;
      // NEW EVENTS
      case 'ask_human': setAskHuman({question:ev.question,runId:ev.runId}); break;
      case 'human_answered': setAskHuman(null); addEv('step',{message:`💬 Human answered`}); break;
      case 'planning': addEv('thought',{message:'🏗 Making a plan…'}); break;
      case 'plan_ready': setPlanSteps(ev.plan||[]); addEv('step',{message:`📋 Plan ready — ${ev.plan?.length||0} steps`}); break;
      case 'summarizing': addEv('thought',{message:'📝 Summarizing context…'}); break;
      case 'stream_start':
        setStreamLines([]);
        addEv('tool',{message:`▶ ${ev.command}`});
        // highlight processes tab
        if(!isMobile) setDesktopPanel(p => p==='chat'?p:'processes');
        break;
      case 'stream_output':
        setStreamLines(l=>[...l.slice(-100), ev.data]);
        break;
      case 'stream_end': setStreamLines([]); break;
      case 'inline_diff':
        setMsgs(m=>[...m,{id:Date.now()+Math.random(),role:'diff',path:ev.path,before:ev.before,after:ev.after}]);
        break;
      case 'final':   addMsg('agent',ev.message); setStatus('idle'); setAskHuman(null); setPlanSteps([]); break;
      case 'paused':  addEv('warn',{message:ev.message}); setStatus('paused'); break;
      case 'error':   addEv('error',{message:ev.message}); setStatus('idle'); break;
    }
  };

  const handleConfirm=async confirmed=>{
    const c=confirm; setConfirm(null); if(!c)return;
    try{ await fetch(`${S}/api/confirm`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:c.runId,confirmed})}); }catch{}
  };

  const changeCwd=async dir=>{
    try{
      const d=await fetch(`${S}/api/cwd`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dir})}).then(r=>r.json());
      if(d.cwd){ setCwd(d.cwd); setCwdInput(d.cwd); addSys(`📁 CWD → ${d.cwd}`); fetchTree(); }
      else addSys(`❌ ${d.error}`);
    }catch(e){addSys(`❌ ${e.message}`);}
  };

  const clearSession=async()=>{
    await fetch(`${S}/api/state`,{method:'DELETE'});
    setMsgs([]); setStatus('idle'); setStepCount(0); setSidebar(false);
    addSys('Session cleared.');
  };

  const openLog=async()=>{
    try{ const d=await fetch(`${S}/api/log`).then(r=>r.json()); setLogs(d); setShowLog(true); setSidebar(false); }catch{}
  };

  const addMemory=async()=>{
    if(!newMemKey.trim())return;
    await fetch(`${S}/api/memory`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:newMemKey,value:newMemVal})});
    setMemory(m=>({...m,global:{...m.global,[newMemKey]:newMemVal}}));
    setNewMemKey(''); setNewMemVal('');
  };
  const delMemory=async key=>{
    await fetch(`${S}/api/memory`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})});
    setMemory(m=>{ const g={...m.global}; delete g[key]; return{...m,global:g}; });
  };

  const activateWs=async ws=>{
    const d=await fetch(`${S}/api/workspaces/${ws.id}/activate`,{method:'POST'}).then(r=>r.json());
    if(d.ok){ setCwd(d.cwd); setCwdInput(d.cwd); addSys(`🗂 Workspace: ${ws.name}`); fetchTree(); }
  };
  const addWs=async()=>{
    const name=prompt('Workspace name:'); if(!name)return;
    const d=await fetch(`${S}/api/workspaces`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,cwd})}).then(r=>r.json());
    setWorkspaces(w=>[...w,d]);
  };
  const delWs=async id=>{
    await fetch(`${S}/api/workspaces/${id}`,{method:'DELETE'});
    setWorkspaces(w=>w.filter(x=>x.id!==id));
  };

  // image upload helper
  const uploadImage = useCallback(async (file) => {
    const ext = file.type.split('/')[1] || 'png';
    const reader = new FileReader();
    return new Promise(resolve => {
      reader.onload = async e => {
        const base64 = e.target.result;
        try {
          const d = await fetch(`${S}/api/upload/base64`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ data:base64, ext, name:`paste_${Date.now()}.${ext}` })
          }).then(r=>r.json());
          if (d.ok) resolve(d);
          else resolve(null);
        } catch { resolve(null); }
      };
      reader.readAsDataURL(file);
    });
  },[]);

  // paste handler for images
  const handlePaste = useCallback(async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imgItem = items.find(it => it.type.startsWith('image/'));
    if (!imgItem) return;
    e.preventDefault();
    const file = imgItem.getAsFile();
    if (!file) return;
    const uploaded = await uploadImage(file);
    if (uploaded) {
      setImages(prev => [...prev, uploaded]);
      addSys(`📎 Image attached: ${uploaded.name}`);
    }
  },[uploadImage]);

  const sendWithImages = useCallback(() => {
    let msg = input.trim();
    if (!msg && images.length === 0) return;
    if (images.length > 0) {
      const imgPaths = images.map(i => i.path).join(', ');
      msg = msg ? `${msg}\n\n[Attached images: ${imgPaths}]` : `[Attached images: ${imgPaths}]\nDescribe or analyze these images.`;
    }
    setImages([]);
    send(msg);
  },[input,images,send]);

  const onKey=e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendWithImages();} };
  const autoResize=e=>{ e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,95)+'px'; };

  const activeFile=tabs.find(t=>t.path===activeTab)||null;
  const canUndo=!!activeFile?.undoStack?.length;
  const canRedo=!!activeFile?.redoStack?.length;
  const isEmpty=msgs.length===0;

  const renderMsg=m=>{
    if(m.role==='user')  return <div key={m.id} className="msg msg-user"><div className="bubble">{m.content}</div></div>;
    if(m.role==='agent') return <div key={m.id} className="msg msg-agent"><div className="bubble">{m.content}</div></div>;
    if(m.role==='diff') return (
      <div key={m.id} style={{animation:'fu .2s ease'}}>
        <div style={{fontSize:10,color:'var(--fg3)',marginBottom:4}}>📝 <code style={{color:'var(--cyan)'}}>{m.path}</code></div>
        <DiffViewer oldText={m.before||''} newText={m.after||''}/>
      </div>
    );
    if(m.role==='sys')   return <div key={m.id} className="msg msg-sys"><div className="bubble">{m.content}</div></div>;
    if(m.role==='ev'){
      switch(m.type){
        case 'step':    return <div key={m.id} className="ev ev-step"><I.Term/><span>{m.message}</span></div>;
        case 'thought': return <div key={m.id} className="ev ev-thought"><I.Brain/><span>{m.message}</span></div>;
        case 'tool':    return <div key={m.id} className="ev ev-tool"><I.Tool/><span style={{wordBreak:'break-all'}}>{m.message}</span></div>;
        case 'result':  return <div key={m.id} className="ev ev-result"><I.Check/><div style={{minWidth:0}}><span style={{color:'var(--fg)'}}>{m.message}</span>{m.result&&<div className="pre">{m.result}</div>}</div></div>;
        case 'error':   return <div key={m.id} className="ev ev-error"><I.Stop/><span>{m.message}</span></div>;
        case 'warn':    return <div key={m.id} className="ev ev-warn"><I.Warn/><span>{m.message}</span></div>;
        case 'final':   return <div key={m.id} className="ev ev-final"><I.Check/><span>{m.message}</span></div>;
      }
    }
    return null;
  };

  // ── CHAT PANEL ──────────────────────────
  const chatPanel=(
    <div className="chat-pane">
      <div className="messages">
        {isEmpty?(
          <div className="empty">
            <I.Bot style={{opacity:.2,width:36,height:36}}/>
            <h3>Coding Agent</h3>
            <p>Chat with your AI coding agent</p>
            <div className="qwrap">{QUICK.map(q=><div key={q} className="qbtn" onClick={()=>send(q)}>{q}</div>)}</div>
          </div>
        ):msgs.map(renderMsg)}
        {running&&!confirm&&!askHuman&&<div className="ev ev-step"><div className="typing"><span/><span/><span/></div></div>}

        {/* streaming terminal output */}
        {streamLines.length>0&&(
          <div style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:5,padding:'6px 10px',fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'#ccffcc',maxHeight:120,overflowY:'auto'}}>
            {streamLines.slice(-30).map((l,i)=><div key={i} style={{whiteSpace:'pre-wrap',wordBreak:'break-all'}}>{l}</div>)}
          </div>
        )}

        {/* plan steps */}
        {planSteps.length>0&&(
          <div style={{background:'rgba(88,166,255,.06)',border:'1px solid rgba(88,166,255,.2)',borderRadius:6,padding:'8px 10px'}}>
            <div style={{fontSize:10,color:'var(--cyan)',fontWeight:600,marginBottom:5}}>📋 Plan</div>
            {planSteps.map((s,i)=><div key={i} style={{fontSize:11,color:'var(--fg2)',padding:'1px 0'}}>{i+1}. {s}</div>)}
          </div>
        )}

        {/* ask human */}
        {askHuman&&(
          <div style={{background:'var(--bg2)',border:'1px solid var(--cyan2)',borderRadius:8,padding:'12px',display:'flex',flexDirection:'column',gap:8,animation:'fu .2s ease'}}>
            <div style={{fontSize:12,color:'var(--cyan)',fontWeight:500}}>❓ Agent needs clarification</div>
            <div style={{fontSize:12,color:'var(--fg)',lineHeight:1.6}}>{askHuman.question}</div>
            <div style={{display:'flex',gap:6}}>
              <input
                id="ask-human-input"
                style={{flex:1,background:'var(--bg)',border:'1px solid var(--border2)',borderRadius:5,padding:'6px 9px',color:'var(--fg)',fontFamily:'inherit',fontSize:12,outline:'none'}}
                placeholder="Your answer…"
                autoFocus
                onKeyDown={async e=>{
                  if(e.key==='Enter'&&e.target.value.trim()){
                    await fetch(`${S}/api/human`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:askHuman.runId,answer:e.target.value.trim()})});
                    setAskHuman(null);
                  }
                }}
              />
              <button
                style={{padding:'6px 12px',background:'var(--cyan2)',border:'none',borderRadius:5,color:'#fff',cursor:'pointer',fontSize:11,fontFamily:'inherit'}}
                onClick={async()=>{
                  const v=document.getElementById('ask-human-input')?.value?.trim();
                  if(!v) return;
                  await fetch(`${S}/api/human`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:askHuman.runId,answer:v})});
                  setAskHuman(null);
                }}
              >Send</button>
            </div>
          </div>
        )}
        {confirm&&(
          <div className="confirm">
            <div className="confirm-hd"><I.Warn/> Confirm</div>
            <div style={{fontSize:10,color:'var(--fg3)'}}>TOOL: <strong style={{color:'var(--fg)'}}>{confirm.tool}</strong></div>
            <div className="confirm-cmd">{confirm.preview}</div>
            <div className="cbtn-w">
              <button className="byes" onPointerDown={e=>{e.preventDefault();handleConfirm(true);}}>✔ Run</button>
              <button className="bno"  onPointerDown={e=>{e.preventDefault();handleConfirm(false);}}>✘ Cancel</button>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* image previews */}
      {images.length>0&&(
        <div style={{display:'flex',gap:6,padding:'4px 10px',flexWrap:'wrap',borderTop:'1px solid var(--border)',background:'var(--bg2)'}}>
          {images.map((img,i)=>(
            <div key={i} style={{position:'relative',flexShrink:0}}>
              <img src={img.url} alt="" style={{height:52,width:52,objectFit:'cover',borderRadius:5,border:'1px solid var(--border2)'}}/>
              <button
                onClick={()=>setImages(prev=>prev.filter((_,j)=>j!==i))}
                style={{position:'absolute',top:-4,right:-4,background:'var(--red)',border:'none',borderRadius:'50%',width:16,height:16,color:'#fff',cursor:'pointer',fontSize:10,lineHeight:'16px',textAlign:'center',padding:0}}
              >×</button>
            </div>
          ))}
          <div style={{fontSize:10,color:'var(--fg3)',alignSelf:'center'}}>{images.length} image{images.length>1?'s':''} attached</div>
        </div>
      )}

      <div className="input-area">
        <div className="inp-wrap">
          <textarea
            className="chat-ta"
            placeholder="Ask the agent… (Ctrl+V to paste image)"
            value={input}
            onChange={e=>{setInput(e.target.value);autoResize(e);}}
            onKeyDown={onKey}
            onPaste={handlePaste}
            rows={1}
            disabled={running}
          />
          <div className="hint">Enter send · Shift+Enter newline · Ctrl+V paste image</div>
        </div>
        {/* upload button */}
        <label style={{flexShrink:0,padding:'9px 10px',background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:8,color:'var(--fg2)',cursor:'pointer',display:'flex',alignItems:'center',minHeight:38,minWidth:38,justifyContent:'center'}} title="Attach image">
          <input type="file" accept="image/*" style={{display:'none'}} onChange={async e=>{
            const file=e.target.files?.[0]; if(!file) return;
            const uploaded=await uploadImage(file);
            if(uploaded){ setImages(prev=>[...prev,uploaded]); addSys(`📎 Attached: ${uploaded.name}`); }
            e.target.value='';
          }}/>
          <I.Copy width={13} height={13}/>
        </label>
        {running
          ?<button className="stpbtn" onClick={()=>{abortRef.current?.abort();setRunning(false);setStatus('idle');}}><I.Stop width={13} height={13}/></button>
          :<button className="sbtn" disabled={!input.trim()&&images.length===0} onClick={sendWithImages}><I.Send width={13} height={13}/><span className="send-label">Send</span></button>
        }
      </div>
    </div>
  );

  // ── DESKTOP RIGHT PANELS ─────────────────
  const PANEL_TABS=[
    {id:'chat',      label:'Chat',     Icon:I.Chat},
    {id:'editor',    label:'Editor',   Icon:I.File},
    {id:'terminal',  label:'Terminal', Icon:I.Term},
    {id:'processes', label:'Processes',Icon:()=><span style={{fontSize:12}}>⚙️</span>},
    {id:'preview',   label:'Preview',  Icon:I.Eye},
    {id:'swarm',     label:'Swarm',    Icon:()=><span style={{fontSize:12}}>🐝</span>},
  ];

  const desktopRight=(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
      {/* panel tabs */}
      <div className="panel-tabs">
        {PANEL_TABS.map(p=>(
          <button key={p.id} className={`ptab${desktopPanel===p.id?' active':''}`} onClick={()=>setDesktopPanel(p.id)}>
            <p.Icon width={12} height={12}/>{p.label}
          </button>
        ))}
        {/* open editor file tabs in editor mode */}
        {desktopPanel==='editor'&&tabs.map(t=>(
          <button key={t.path} className={`ptab${activeTab===t.path?' active':''}`} onClick={()=>setActiveTab(t.path)}>
            {t.dirty&&<span className="dot2"/>}
            <span style={{color:ec(t.ext)}}>{t.name}</span>
            <button className="ptab-close" onPointerDown={e=>{e.stopPropagation();closeTab(t.path);}}>×</button>
          </button>
        ))}
      </div>
      {/* panel content */}
      {desktopPanel==='chat'&&chatPanel}
      {desktopPanel==='editor'&&(
        <EditorPane
          file={activeFile} onChange={changeContent} onSave={saveFile}
          editorMode={editorMode} setEditorMode={setEditorMode}
          onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
        />
      )}
      {desktopPanel==='terminal'&&<TerminalPanel cwd={cwd}/>}
      {desktopPanel==='processes'&&<ProcessManager/>}
      {desktopPanel==='swarm'&&<SwarmPanel model={model}/>}
      {desktopPanel==='preview'&&(
        <div className="preview-wrap">
          <div className="preview-bar">
            <input className="preview-url" value={previewUrl} onChange={e=>setPreviewUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&e.target.blur()} placeholder="http://localhost:3000"/>
            <button className="ibtn" onClick={()=>setPreviewUrl(u=>u)}><I.Refresh width={13} height={13}/></button>
          </div>
          {previewUrl?<iframe className="preview-frame" src={previewUrl} title="preview"/>:<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--fg3)',fontSize:11}}>Enter a URL above</div>}
        </div>
      )}
    </div>
  );

  // ── MOBILE TAB CONTENT ───────────────────
  const MOBILE_TABS=[
    {id:'chat',      label:'Chat',     Icon:I.Chat},
    {id:'editor',    label:'Editor',   Icon:I.File},
    {id:'terminal',  label:'Terminal', Icon:I.Term},
    {id:'processes', label:'Processes',Icon:()=><span style={{fontSize:13}}>⚙️</span>},
    {id:'swarm',     label:'Swarm',    Icon:()=><span style={{fontSize:13}}>🐝</span>},
  ];

  const mobileContent=(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
      {mobileTab==='chat'&&chatPanel}
      {mobileTab==='editor'&&(
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {/* mini tree */}
          <div style={{flexShrink:0,borderBottom:'1px solid var(--border)'}}>
            <div style={{height:34,display:'flex',alignItems:'center',gap:5,padding:'0 9px',background:'var(--bg1)'}}>
              <I.Folder width={12} height={12} style={{color:'var(--yellow2)'}}/>
              <span style={{flex:1,fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cwd.split('/').pop()||'Files'}</span>
              <button className="ibtn" onClick={fetchTree}><I.Refresh width={12} height={12}/></button>
            </div>
            <div style={{maxHeight:140,overflowY:'auto'}}>
              {tree.length?tree.map(n=><FileNode key={n.path} node={n} depth={0} onOpen={openFile} selPath={selPath}/>):<div style={{padding:'8px 12px',color:'var(--fg3)',fontSize:11,textAlign:'center'}}>Set CWD first</div>}
            </div>
          </div>
          {/* editor tabs */}
          {tabs.length>0&&(
            <div className="panel-tabs" style={{flexShrink:0}}>
              {tabs.map(t=>(
                <button key={t.path} className={`ptab${activeTab===t.path?' active':''}`} onClick={()=>setActiveTab(t.path)}>
                  {t.dirty&&<span className="dot2"/>}
                  <span style={{color:ec(t.ext)}}>{t.name}</span>
                  <button className="ptab-close" onPointerDown={e=>{e.stopPropagation();closeTab(t.path);}}>×</button>
                </button>
              ))}
            </div>
          )}
          <EditorPane file={activeFile} onChange={changeContent} onSave={saveFile} editorMode={editorMode} setEditorMode={setEditorMode} onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}/>
        </div>
      )}
      {mobileTab==='terminal'&&<TerminalPanel cwd={cwd}/>}
      {mobileTab==='processes'&&<ProcessManager/>}
      {mobileTab==='swarm'&&<SwarmPanel model={model}/>}
      {mobileTab==='preview'&&(
        <div className="preview-wrap">
          <div className="preview-bar">
            <input className="preview-url" value={previewUrl} onChange={e=>setPreviewUrl(e.target.value)} placeholder="http://localhost:3000"/>
            <button className="ibtn" onClick={()=>setPreviewUrl(u=>u)}><I.Refresh width={13} height={13}/></button>
          </div>
          {previewUrl?<iframe className="preview-frame" src={previewUrl} title="preview"/>:<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--fg3)',fontSize:11}}>Enter a URL</div>}
        </div>
      )}
    </div>
  );

  return(
    <>
      <style>{css}</style>
      <div className="overlay" style={{display:sidebarOpen?'block':'none'}} onClick={()=>setSidebar(false)}/>
      <div className="app">

        {/* HEADER */}
        <header className="header">
          <button className="ibtn menu-btn" onClick={()=>setSidebar(o=>!o)}>
            {sidebarOpen?<I.Close width={17} height={17}/>:<I.Menu width={17} height={17}/>}
          </button>
          <div className="logo"><div className="dot"/><I.Bot width={17} height={17}/><span>AGENT</span></div>
          <div className="hright">
            {cwd&&<span style={{fontSize:9,color:'var(--fg3)',maxWidth:90,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',direction:'rtl'}}>{cwd.split('/').slice(-2).join('/')}</span>}
            {stepCount>0&&<span style={{fontSize:10,color:'var(--fg3)'}}>#{stepCount}</span>}
            {activeTool&&<span style={{fontSize:10,color:'var(--green)',maxWidth:70,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>⚙{activeTool}</span>}
            <span className={`badge ${status}`}>{status}</span>
          </div>
        </header>

        {/* BODY */}
        <div className="body">

          {/* SIDEBAR */}
          <aside className={`sidebar${sidebarOpen?' open':''}`}>
            <div className="sb-scroll">
              <div className="stitle">Model</div>
              <select className="msel" value={model} onChange={e=>setModel(e.target.value)}>
                {models.length?models.map(m=><option key={m}>{m}</option>):<option>{model||'…'}</option>}
              </select>

              {/* PERSONAS */}
              <div className="stitle">Persona</div>
              <div className="persona-grid">
                {Object.entries(personas).map(([k,p])=>(
                  <div key={k} className={`persona-card${persona===k?' active':''}`} onClick={()=>setPersona(k)}>
                    <div className="p-emoji">{p.emoji}</div>
                    <div className="p-name">{p.name}</div>
                  </div>
                ))}
              </div>

              {/* WORKSPACES */}
              <div className="stitle" style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingRight:12}}>
                <span>Workspaces</span>
                <button className="ibtn" onClick={addWs} style={{padding:2}}><I.Plus width={12} height={12}/></button>
              </div>
              <div className="ws-list">
                {workspaces.map(w=>(
                  <div key={w.id} className={`ws-item${w.cwd===cwd?' active-ws':''}`} onClick={()=>activateWs(w)}>
                    <I.Ws width={11} height={11} style={{flexShrink:0,color:'var(--fg3)'}}/>
                    <span>{w.name}</span>
                    <button className="ws-del" onPointerDown={e=>{e.stopPropagation();delWs(w.id);}}>×</button>
                  </div>
                ))}
              </div>

              {/* CWD */}
              <div className="stitle">Working Directory</div>
              <div className="cwd-box">
                <div className="cwd-lbl">CWD</div>
                <div className="cwd-row">
                  <input className="cwd-inp" value={cwdInput} onChange={e=>setCwdInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&changeCwd(cwdInput)} placeholder="/path/to/project" spellCheck={false} autoCorrect="off" autoCapitalize="off"/>
                  <button className="cwd-go" onPointerDown={e=>{e.preventDefault();changeCwd(cwdInput);}}>Go</button>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="stitle" style={{marginTop:4}}>Actions</div>
              <button className="sbbtn" onClick={()=>setShowHistory(true)}><I.History width={13} height={13}/> Task History</button>
              <button className="sbbtn" onClick={()=>setShowMemory(true)}><I.Mem width={13} height={13}/> Agent Memory</button>
              <button className="sbbtn" onClick={openLog}><I.Log width={13} height={13}/> View Log</button>
              <button className="sbbtn danger" onClick={clearSession}><I.Trash width={13} height={13}/> Clear Session</button>

              {/* SESSION */}
              <div className="stitle" style={{marginTop:4}}>Session</div>
              <div className="scard">
                <div className="srow"><span>Status</span><span style={{color:status==='running'?'var(--cyan)':status==='paused'?'var(--yellow)':'var(--green)'}}>{status}</span></div>
                <div className="srow"><span>Steps</span><span>{stepCount}</span></div>
                <div className="srow"><span>Persona</span><span style={{color:'var(--purple)'}}>{personas[persona]?.emoji} {personas[persona]?.name||persona}</span></div>
              </div>

              <div className="stitle" style={{marginTop:4}}>Tools</div>
              <div className="chips">{TOOLS_LIST.map(t=><div key={t} className={`chip${activeTool===t?' active':''}`}>{t}</div>)}</div>
            </div>
          </aside>

          {/* FILE TREE (desktop) */}
          {!isMobile&&(
            <div className="ftree-panel">
              <div className="ftree-head">
                <I.Folder width={12} height={12} style={{color:'var(--yellow2)',flexShrink:0}}/>
                <span title={cwd}>{cwd.split('/').pop()||'Files'}</span>
                <button className="ibtn" onClick={fetchTree}><I.Refresh width={12} height={12}/></button>
              </div>
              <div className="ftree-body">
                {tree.length?tree.map(n=><FileNode key={n.path} node={n} depth={0} onOpen={openFile} selPath={selPath}/>):<div style={{padding:'16px 10px',color:'var(--fg3)',fontSize:11,textAlign:'center'}}>Set CWD first</div>}
              </div>
            </div>
          )}

          {/* CENTER */}
          <div className="center">
            {isMobile ? mobileContent : (
              // Desktop: stacked editor (top) + chat/panels (bottom)
              <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
                <div style={{height:`${editorH}%`,display:'flex',flexDirection:'column',overflow:'hidden',borderBottom:'1px solid var(--border)'}}>
                  <div className="panel-tabs">
                    {tabs.map(t=>(
                      <button key={t.path} className={`ptab${activeTab===t.path?' active':''}`} onClick={()=>setActiveTab(t.path)}>
                        {t.dirty&&<span className="dot2"/>}
                        <span style={{color:ec(t.ext)}}>{t.name}</span>
                        <button className="ptab-close" onPointerDown={e=>{e.stopPropagation();closeTab(t.path);}}>×</button>
                      </button>
                    ))}
                    <div style={{marginLeft:'auto',padding:'0 6px',display:'flex',alignItems:'center'}}>
                      <button className="ibtn" onClick={fetchTree}><I.Refresh width={11} height={11}/></button>
                    </div>
                  </div>
                  <EditorPane file={activeFile} onChange={changeContent} onSave={saveFile} editorMode={editorMode} setEditorMode={setEditorMode} onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}/>
                </div>
                <div className="rh" onMouseDown={()=>{resizing.current=true;}}/>
                {desktopRight}
              </div>
            )}
          </div>
        </div>

        {/* MOBILE TABBAR */}
        <nav className="tabbar">
          {MOBILE_TABS.map(t=>(
            <button key={t.id} className={`tab${mobileTab===t.id?' active':''}`} onClick={()=>setMobileTab(t.id)}>
              <t.Icon/><span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* HISTORY MODAL */}
      {showHistory&&(
        <div className="modal-bg" onClick={()=>setShowHistory(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="mhd"><I.History width={13} height={13}/><span>Task History ({taskHistory.length})</span>
              <button className="mclose" onClick={()=>setShowHistory(false)}>✕</button>
            </div>
            <div className="mbody">
              {taskHistory.length?taskHistory.map(h=>(
                <div key={h.id} className="hist-item" onClick={()=>{setInput(h.question);setShowHistory(false);}}>
                  <div className="hist-q">{h.question}</div>
                  <div className="hist-meta">
                    <span>{new Date(h.timestamp).toLocaleDateString()}</span>
                    <span>{h.steps} steps</span>
                    {h.duration&&<span>{h.duration}s</span>}
                  </div>
                  {h.answer&&<div className="hist-ans">{h.answer}</div>}
                </div>
              )):<div style={{padding:16,color:'var(--fg3)',fontSize:11,textAlign:'center'}}>No history yet</div>}
            </div>
          </div>
        </div>
      )}

      {/* MEMORY MODAL */}
      {showMemory&&(
        <div className="modal-bg" onClick={()=>setShowMemory(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="mhd"><I.Mem width={13} height={13}/><span>Agent Memory</span>
              <button className="mclose" onClick={()=>setShowMemory(false)}>✕</button>
            </div>
            <div className="mbody">
              <div className="mem-add-row">
                <input className="mem-inp" placeholder="key" value={newMemKey} onChange={e=>setNewMemKey(e.target.value)}/>
                <input className="mem-inp" placeholder="value" value={newMemVal} onChange={e=>setNewMemVal(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addMemory()}/>
                <button className="cwd-go" onClick={addMemory}>Add</button>
              </div>
              {Object.entries(memory.global||{}).length?Object.entries(memory.global).map(([k,v])=>(
                <div key={k} className="mem-item">
                  <span className="mem-key">{k}</span>
                  <span className="mem-val">{v}</span>
                  <button className="mem-del" onClick={()=>delMemory(k)}>×</button>
                </div>
              )):<div style={{padding:'16px 12px',color:'var(--fg3)',fontSize:11,textAlign:'center'}}>No memories. Add key-value pairs above.<br/><br/>The agent reads these in every conversation.</div>}
            </div>
          </div>
        </div>
      )}

      {/* LOG MODAL */}
      {showLog&&(
        <div className="modal-bg" onClick={()=>setShowLog(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="mhd"><I.Log width={13} height={13}/><span>Agent Log</span>
              <button className="mclose" onClick={()=>setShowLog(false)}>✕</button>
            </div>
            <div className="mbody">
              {logs.length?logs.map((e,i)=>(
                <div key={i} style={{padding:'6px 12px',borderBottom:'1px solid var(--border)',fontSize:11,color:'var(--fg2)'}}>
                  <span style={{color:'var(--cyan)',marginRight:8}}>#{e.step}</span>
                  <span style={{color:'var(--green)'}}>{e.tool||e.type||'?'}</span>
                  {e.result&&<div className="pre">{e.result}</div>}
                </div>
              )):<div style={{padding:16,color:'var(--fg3)',fontSize:11,textAlign:'center'}}>No log entries</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
