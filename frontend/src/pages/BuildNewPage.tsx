/**
 * WireUp IDE — "Cursor + VS Code + PlatformIO for Hardware Engineering"
 * Layout: Left File Explorer | Center Editor (primary) | Right AI Copilot
 *         Bottom: Output / Terminal / Logs panel
 */
import {
  useEffect, useRef, useState, useCallback, type KeyboardEvent,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useProjectStore, type ProjectFile } from "../store/useProjectStore";
import { useAuthStore } from "../store/useAuthStore";

/* ─── Exact VS Code Dark+ / Embedr color tokens ──────────────────────────── */
const T = {
  // Backgrounds — measured from screenshot
  bg:          "#1e1e1e",   // editor background (VS Code default)
  titleBar:    "#1a1b1e",   // title bar / sidebar / panels
  tabActive:   "#2a2b2e",   // active tab background
  tabInactive: "#1a1b1e",   // inactive tab
  panel:       "#1a1b1e",   // bottom panel, right panel
  statusBar:   "#007acc",   // VS Code blue status bar
  inputBg:     "#2a2b2e",   // input fields

  // Borders
  border:      "rgba(255,255,255,0.08)",
  borderHi:    "rgba(255,255,255,0.14)",
  tabBorder:   "#3e3e42",   // VS Code tab border

  // Text
  text:        "#cccccc",   // primary — VS Code default
  textBright:  "#ffffff",   // active tab label, headings
  textDim:     "#6e7280",   // line numbers, inactive items
  textMid:     "#9ea3b0",   // secondary labels

  // Syntax / accents
  blue:        "#569cd6",   // VS Code keyword blue
  blueUI:      "#007acc",   // VS Code UI blue (status bar, links)
  blueD:       "rgba(0,122,204,0.15)",
  blueHi:      "rgba(0,122,204,0.25)",
  green:       "#6a9955",   // VS Code comment green / success
  greenBright: "#4ec9b0",   // type color
  amber:       "#ce9178",   // VS Code string orange
  yellow:      "#dcdcaa",   // VS Code function yellow
  red:         "#f44747",   // VS Code error red
  purple:      "#c586c0",   // VS Code keyword purple
  teal:        "#4fc1ff",   // variable teal

  // File icon colors
  fileTs:      "#007acc",
  fileJs:      "#cbcb41",
  filePy:      "#3572A5",
  fileMd:      "#519aba",
  fileJson:    "#cbcb41",
  fileIno:     "#00979d",
  fileDefault: "#6e7280",
} as const;

/* ─── File helpers ─────────────────────────────────────────────────────────── */
const LANG_MAP: Record<string, string> = {
  ts:"TypeScript", tsx:"TypeScript JSX", js:"JavaScript", jsx:"JavaScript JSX",
  py:"Python", md:"Markdown", json:"JSON", css:"CSS", html:"HTML",
  sh:"Shell", txt:"Plain Text", yaml:"YAML", yml:"YAML", env:"ENV",
  ino:"Arduino", cpp:"C++", c:"C", rs:"Rust", h:"C Header", csv:"CSV",
};
const LANG_DOT: Record<string, string> = {
  TypeScript:T.fileTs,"TypeScript JSX":T.fileTs,JavaScript:T.fileJs,
  Python:T.filePy,Markdown:T.fileMd,JSON:T.fileJson,CSS:"#a78bfa",
  HTML:"#e44d26",Shell:T.greenBright,Rust:"#dea584",Arduino:T.fileIno,"C++":"#9c4a96",
  CSV:T.green,
};
const getLang = (n: string) => LANG_MAP[n.split(".").pop()?.toLowerCase() ?? ""] ?? "Plain Text";
const ld      = (l: string) => LANG_DOT[l] ?? T.fileDefault;

/* ─── Types ────────────────────────────────────────────────────────────────── */
type TabMode    = "Code" | "Diagram" | "Simulation";
type BottomTab  = "Output" | "Terminal" | "Logs";
type StageState = "completed" | "running" | "pending" | "failed";
interface Stage  { key: string; label: string; state: StageState; }
interface CMsg   { id: string; role: "user" | "assistant"; content: string; streaming: boolean; }
interface LogLine{ type: "info"|"success"|"error"|"warn"; text: string; ts: number; }

/* ─── SSE generator ────────────────────────────────────────────────────────── */
async function* sse(url: string, body: object): AsyncGenerator<{ event: string; data: any }> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!r.ok || !r.body) throw new Error(await r.text());
  const reader = r.body.getReader();
  const dec    = new TextDecoder();
  let   buf    = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
    for (const p of parts) {
      let ev = "", data = "";
      for (const l of p.split("\n")) {
        if (l.startsWith("event: ")) ev   = l.slice(7).trim();
        if (l.startsWith("data: "))  data = l.slice(6).trim();
      }
      if (!data) continue;
      try { yield { event: ev, data: JSON.parse(data) }; } catch { /* skip */ }
    }
  }
}

/* ─── Drag handles ─────────────────────────────────────────────────────────── */
function HDrag({ onD }: { onD: (d: number) => void }) {
  const a = useRef(false), lx = useRef(0);
  return (
    <div style={{ width: 1, flexShrink: 0, background: T.border, cursor: "col-resize" }}
      onMouseEnter={e => (e.currentTarget.style.background = T.blue)}
      onMouseLeave={e => (e.currentTarget.style.background = T.border)}
      onMouseDown={e => {
        e.preventDefault(); a.current = true; lx.current = e.clientX;
        const mv = (ev: MouseEvent) => { if (a.current) { onD(ev.clientX - lx.current); lx.current = ev.clientX; } };
        const up = () => { a.current = false; window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
        window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
      }}
    />
  );
}
function VDrag({ onD }: { onD: (d: number) => void }) {
  const a = useRef(false), ly = useRef(0);
  return (
    <div style={{ height: 1, flexShrink: 0, background: T.border, cursor: "row-resize" }}
      onMouseEnter={e => (e.currentTarget.style.background = T.blue)}
      onMouseLeave={e => (e.currentTarget.style.background = T.border)}
      onMouseDown={e => {
        e.preventDefault(); a.current = true; ly.current = e.clientY;
        const mv = (ev: MouseEvent) => { if (a.current) { onD(ev.clientY - ly.current); ly.current = ev.clientY; } };
        const up = () => { a.current = false; window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
        window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
      }}
    />
  );
}

/* ─── Stage icon ───────────────────────────────────────────────────────────── */
function StageIcon({ s }: { s: StageState }) {
  if (s === "completed") return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" fill="#22c55e" fillOpacity=".15" stroke="#22c55e" strokeWidth="1.2"/>
      <path d="M5 8l2.5 2.5L11 5.5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (s === "running") return (
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      style={{ width: 13, height: 13, borderRadius: "50%", border: `1.5px solid rgba(0,122,204,0.3)`, borderTopColor: "#007acc" }} />
  );
  if (s === "failed") return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" fill="#f44747" fillOpacity=".12" stroke="#f44747" strokeWidth="1.2"/>
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#f44747" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
  return <div style={{ width: 13, height: 13, borderRadius: "50%", border: `1.5px solid #3e3e42` }}/>;
}

/* ─── Model catalogue (matches backend chat.controller.ts) ─────────────── */
const MODELS = [
  { key: "WU Lite", id: "claude-haiku-4-5-20251001", sub: "claude-haiku · Fast"       },
  { key: "WU Pro",  id: "claude-sonnet-4-6",          sub: "claude-sonnet · Balanced"  },
  { key: "WU Max",  id: "claude-opus-4-8",             sub: "claude-opus · Powerful"    },
] as const;
type ModelKey = typeof MODELS[number]["key"];

function ModelPicker({ val, set }: { val: ModelKey; set: (v: ModelKey) => void }) {
  const [open, setOpen] = useState(false);
  const current = MODELS.find(m => m.key === val) ?? MODELS[1];
  return (
    <div style={{position:"relative"}}>
      <button onClick={() => setOpen(v => !v)}
        style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 8px",
          background:T.bg, border:`1px solid ${T.border}`, borderRadius:3,
          color:T.textMid, fontSize:11, cursor:"pointer", fontFamily:"var(--font-sans)",
          whiteSpace:"nowrap" }}>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" d="M2 4h12M4 8h8M6 12h4"/>
        </svg>
        {val}
        <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={open ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4"}/>
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0, y:4, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:4, scale:0.97 }} transition={{ duration:0.1 }}
            style={{ position:"absolute", bottom:"calc(100% + 4px)", left:0,
              background:T.titleBar, border:`1px solid ${T.borderHi}`,
              borderRadius:4, overflow:"hidden", minWidth:220,
              boxShadow:"0 8px 24px rgba(0,0,0,0.6)", zIndex:200 }}>
            {MODELS.map(m => (
              <button key={m.key} onClick={() => { set(m.key); setOpen(false); }}
                style={{ width:"100%", display:"flex", flexDirection:"column",
                  padding:"8px 12px", background: m.key===val ? T.blueD : "transparent",
                  border:"none", cursor:"pointer", textAlign:"left", transition:"background 0.1s" }}
                onMouseOver={e => { if (m.key !== val) e.currentTarget.style.background="rgba(255,255,255,0.05)"; }}
                onMouseOut={e  => { e.currentTarget.style.background = m.key===val ? T.blueD : "transparent"; }}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                  <span style={{ fontSize:12, fontWeight:500, color: m.key===val ? T.blueUI : T.textBright }}>
                    {m.key}
                  </span>
                  {m.key===val && (
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={T.blueUI} strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l4 4 6-6"/>
                    </svg>
                  )}
                </div>
                <span style={{ fontSize:10, color:T.textDim, marginTop:2, fontFamily:"var(--font-mono)" }}>
                  {m.sub}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════════════════ */
export default function BuildNewPage() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const { authUser } = useAuthStore();
  const { currentProject, loadProject, isLoading, updateFile, addFile, setActiveFile } = useProjectStore();

  /* layout */
  const [leftW,    setLeftW]    = useState(230);
  const [rightW,   setRightW]   = useState(300);
  const [botH,     setBotH]     = useState(180);
  const [botOpen,  setBotOpen]  = useState(false);
  const [tabMode,  setTabMode]  = useState<TabMode>("Code");
  const [botTab,   setBotTab]   = useState<BottomTab>("Output");
  const [model,    setModel]    = useState<ModelKey>("WU Pro");

  /* editor */
  const [tabs,      setTabs]      = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [code,      setCode]      = useState("");
  const [dirty,     setDirty]     = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  /* explorer collapsed state */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  /* pipeline */
  const [stages,       setStages]       = useState<Stage[]>([]);
  const [pipelinePct,  setPipelinePct]  = useState(0);
  const [pipelineDone, setPipelineDone] = useState(false);
  const [pipeActive,   setPipeActive]   = useState(false);
  const started = useRef(false);
  const sidxMap = useRef<Record<string, number>>({});

  /* chat */
  const [msgs,     setMsgs]     = useState<CMsg[]>([]);
  const [chatIn,   setChatIn]   = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /* logs */
  const [logs,    setLogs]    = useState<LogLine[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  /* new file */
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  const addLog = useCallback((type: LogLine["type"], txt: string) => {
    setLogs(p => [...p, { type, text: txt, ts: Date.now() }]);
  }, []);

  /* load project */
  useEffect(() => { if (id) loadProject(id); }, [id]);

  useEffect(() => {
    if (!currentProject) return;
    const a = currentProject.activeFile || currentProject.files[0]?.name || "";
    if (a && !tabs.includes(a)) { setTabs([a]); setActiveTab(a); }
    const f = currentProject.files.find(x => x.name === a);
    if (f) setCode(f.content);
    addLog("info", `[wireup] Project loaded: ${currentProject.description}`);
  }, [currentProject?._id]);

  useEffect(() => {
    if (!currentProject || !activeTab) return;
    const f = currentProject.files.find(x => x.name === activeTab);
    if (f) { setCode(f.content); setDirty(false); }
  }, [activeTab]);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  /* auto-start pipeline */
  useEffect(() => {
    if (!currentProject || started.current || pipelineDone) return;
    started.current = true;
    runPipeline(currentProject.description);
  }, [currentProject?._id]);

  const runPipeline = async (idea: string) => {
    setPipeActive(true); setPipelinePct(0); setStages([]); sidxMap.current = {};
    const base = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    try {
      for await (const { event, data } of sse(`${base}/generate`, { idea, projectId: id, model })) {
        if (event === "stage_start") {
          setStages(p => {
            if (p.find(s => s.key === data.key)) return p.map(s => s.key === data.key ? { ...s, state: "running" } : s);
            return [...p, { key: data.key, label: data.label, state: "running" }];
          });
          setMsgs(p => { sidxMap.current[data.key] = p.length; return [...p, { id: data.key, role: "assistant", content: "", streaming: true }]; });
          addLog("info", `[pipeline] ${data.label}`);
        }
        if (event === "stage_chunk") {
          const idx = sidxMap.current[data.key];
          if (idx !== undefined) setMsgs(p => { const n=[...p]; n[idx]={...n[idx],content:data.text,streaming:true}; return n; });
        }
        if (event === "stage_done") {
          setStages(p => p.map(s => s.key === data.key ? { ...s, state: "completed" } : s));
          const idx = sidxMap.current[data.key];
          if (idx !== undefined) setMsgs(p => { const n=[...p]; n[idx]={...n[idx],content:data.text,streaming:false}; return n; });
          if (data.progress !== undefined) setPipelinePct(data.progress);
          addLog("success", `[pipeline] Done: ${data.key}`);
        }
        if (event === "pipeline_done") { setPipelinePct(100); setPipelineDone(true); setPipeActive(false); setBotOpen(true); addLog("success", "[wireup] Generation complete."); }
        if (event === "pipeline_error") { setStages(p => p.map(s => s.state==="running"?{...s,state:"failed"}:s)); setPipeActive(false); addLog("error", `[pipeline] ${data.error}`); toast.error(data.error); }
      }
    } catch (e: any) { setPipeActive(false); addLog("error", `[wireup] ${e?.message}`); toast.error(e?.message); }
  };

  const sendChat = async () => {
    const text = chatIn.trim();
    if (!text || chatBusy) return;

    // Append user message
    const userMsg = { id: `u-${Date.now()}`, role: "user" as const, content: text, streaming: false };
    setMsgs(p => [...p, userMsg]);
    setChatIn(""); setChatBusy(true);

    // Build conversation history (all non-streaming messages)
    const history = [...msgs, userMsg]
      .filter(m => !m.streaming)
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    // Placeholder for streaming AI response
    const aid = `a-${Date.now()}`;
    let aidx = -1;
    setMsgs(p => { aidx = p.length; return [...p, { id: aid, role: "assistant" as const, content: "", streaming: true }]; });

    const base = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

    try {
      const res = await fetch(`${base}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages:       history,
          model,
          projectContext: currentProject?.description ?? "",
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buf     = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop() ?? "";

        for (const part of parts) {
          let ev = "", data = "";
          for (const line of part.split("\n")) {
            if (line.startsWith("event: ")) ev   = line.slice(7).trim();
            if (line.startsWith("data: "))  data = line.slice(6).trim();
          }
          if (!data) continue;
          try {
            const d = JSON.parse(data);
            if (ev === "token") {
              setMsgs(p => {
                const n = [...p];
                if (n[aidx]) n[aidx] = { ...n[aidx], content: d.full, streaming: true };
                return n;
              });
            }
            if (ev === "done") {
              setMsgs(p => {
                const n = [...p];
                if (n[aidx]) n[aidx] = { ...n[aidx], content: d.content, streaming: false };
                return n;
              });
              if (d.fallback) addLog("warn", `[chat] Used Groq fallback (${d.fallback})`);
              addLog("info", `[chat] Response from ${model}`);
            }
            if (ev === "error") {
              toast.error(d.error || "Chat failed");
              setMsgs(p => {
                const n = [...p];
                if (n[aidx]) n[aidx] = { ...n[aidx], content: "Sorry, something went wrong. Please try again.", streaming: false };
                return n;
              });
            }
          } catch { /* skip malformed SSE chunks */ }
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Connection failed");
      setMsgs(p => {
        const n = [...p];
        if (n[aidx]) n[aidx] = { ...n[aidx], content: "Connection failed. Check if the backend is running.", streaming: false };
        return n;
      });
      addLog("error", `[chat] ${e?.message}`);
    } finally {
      setChatBusy(false);
    }
  };

  /* editor helpers */
  const openTab = (n: string) => { setTabs(p=>p.includes(n)?p:[...p,n]); setActiveTab(n); if(id) setActiveFile(id,n); };
  const closeTab = (n: string) => { const r=tabs.filter(t=>t!==n); setTabs(r); if(activeTab===n) setActiveTab(r[r.length-1]??""); };
  const saveFile = useCallback(async () => {
    if (!id||!activeTab||!dirty) return;
    try { await updateFile(id,activeTab,code); setDirty(false); addLog("success",`[editor] Saved ${activeTab}`); }
    catch { addLog("error",`[editor] Failed to save ${activeTab}`); }
  }, [id,activeTab,code,dirty]);
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey||e.metaKey)&&e.key==="s") { e.preventDefault(); saveFile(); return; }
    if (e.key==="Tab") { e.preventDefault(); const ta=editorRef.current!; const s=ta.selectionStart,end=ta.selectionEnd; setCode(code.slice(0,s)+"  "+code.slice(end)); requestAnimationFrame(()=>{ ta.selectionStart=ta.selectionEnd=s+2; }); }
  };
  const createFile = async () => {
    const n=newFileName.trim(); if(!n||!id) return;
    if(currentProject?.files.find(f=>f.name===n)){toast.error("File exists");return;}
    await addFile(id,{name:n,language:getLang(n),content:""}); openTab(n);
    setNewFileOpen(false); setNewFileName(""); addLog("info",`[fs] Created ${n}`);
  };

  const activeFile = currentProject?.files.find(f=>f.name===activeTab);
  const initial    = authUser?.fullName?.charAt(0).toUpperCase()??"U";
  const completedN = stages.filter(s=>s.state==="completed").length;
  const pct        = pipelinePct || (stages.length ? Math.round(completedN/stages.length*100) : 0);

  /* loading */
  if (isLoading) return (
    <div style={{display:"flex",height:"100vh",width:"100vw",alignItems:"center",justifyContent:"center",background:T.bg}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
        <motion.div animate={{rotate:360}} transition={{duration:0.8,repeat:Infinity,ease:"linear"}}
          style={{width:28,height:28,borderRadius:"50%",border:`2px solid ${T.tabBorder}`,borderTopColor:T.blueUI}}/>
        <span style={{fontSize:12,color:T.textMid,fontFamily:"var(--font-sans)"}}>Loading workspace…</span>
      </div>
    </div>
  );

  /* ═══ RENDER ════════════════════════════════════════════════════════════ */
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",width:"100vw",overflow:"hidden",background:T.bg,color:T.text,fontFamily:"var(--font-sans)",fontSize:13}}>

      {/* ╔═ TITLE BAR ══════════════════════════════════════════════════════╗ */}
      <div style={{display:"flex",alignItems:"center",height:32,flexShrink:0,padding:"0 0",background:T.titleBar,borderBottom:`1px solid ${T.border}`,userSelect:"none"}}>
        {/* back button */}
        <button onClick={()=>navigate("/")} style={{color:T.textDim,background:"none",border:"none",cursor:"pointer",padding:"0 10px",height:"100%",display:"flex",alignItems:"center"}}
          title="Back to projects">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>

        {/* center — project title like Embedr "i2c dashboard" */}
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span style={{fontSize:12,fontWeight:500,color:T.textBright,letterSpacing:"0.01em"}}>
            {currentProject?.description ?? "WireUp Workspace"}
          </span>
          {pipeActive && (
            <>
              <span style={{color:T.border,fontSize:10}}>·</span>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:60,height:2,background:T.tabBorder,overflow:"hidden",borderRadius:1}}>
                  <motion.div style={{height:"100%",background:T.blueUI}} animate={{width:`${pct}%`}} transition={{duration:0.3}}/>
                </div>
                <span style={{fontSize:10,color:T.textMid}}>{pct}%</span>
              </div>
            </>
          )}
        </div>

        {/* right — workspace mode tabs like Embedr "Schematics Board main.cpp .gitignore README.md" */}
        <div style={{display:"flex",alignItems:"stretch",height:"100%",gap:0}}>
          {(["Code","Diagram","Simulation"] as TabMode[]).map(m => (
            <button key={m} onClick={()=>setTabMode(m)}
              style={{padding:"0 16px",height:"100%",fontSize:12,fontWeight:400,border:"none",
                borderBottom:m===tabMode?`2px solid ${T.blueUI}`:"2px solid transparent",
                cursor:"pointer",background:"transparent",color:m===tabMode?T.textBright:T.textDim,
                whiteSpace:"nowrap",transition:"color 0.12s"}}>
              {m}
            </button>
          ))}
        </div>

        {/* right icons — gear, window controls like Embedr */}
        <div style={{display:"flex",alignItems:"center",padding:"0 8px",gap:4}}>
          {dirty && (
            <button onClick={saveFile}
              style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",fontSize:11,
                background:T.blueD,color:T.blueUI,border:`1px solid ${T.blueHi}`,borderRadius:3,cursor:"pointer"}}>
              Save
            </button>
          )}
          <button onClick={()=>setBotOpen(v=>!v)}
            style={{padding:"3px 8px",fontSize:11,background:"transparent",
              color:botOpen?T.blueUI:T.textDim,border:"none",cursor:"pointer",borderRadius:3}}>
            Terminal
          </button>
          <div style={{width:24,height:24,borderRadius:"50%",background:T.blueD,border:`1px solid ${T.blueHi}`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:T.blueUI,cursor:"default"}}>
            {initial}
          </div>
        </div>
      </div>
      {/* ╚═══════════════════════════════════════════════════════════════════╝ */}

      {/* ╔═ BODY ══════════════════════════════════════════════════════════╗ */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ── LEFT: FILE EXPLORER ────────────────────────────────────────── */}
        <aside style={{width:leftW,minWidth:160,maxWidth:340,flexShrink:0,background:T.titleBar,
          borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>

          {/* explorer header */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
            padding:"0 12px",height:30,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
            <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:T.textMid,userSelect:"none"}}>
              Explorer
            </span>
            <button onClick={()=>setNewFileOpen(true)}
              style={{background:"none",border:"none",cursor:"pointer",color:T.textMid,padding:2,display:"flex",alignItems:"center",opacity:0.7}}
              title="New file"
              onMouseOver={e=>(e.currentTarget.style.opacity="1")}
              onMouseOut={e=>(e.currentTarget.style.opacity="0.7")}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </button>
          </div>

          {/* project folder tree */}
          <div style={{flex:1,overflowY:"auto"}} className="ide-scroll">
            {/* PROJECT ROOT */}
            <div>
              <button onClick={()=>setCollapsed(c=>({...c,"root":!c["root"]}))}
                style={{width:"100%",display:"flex",alignItems:"center",gap:4,padding:"3px 8px 3px 4px",
                  background:"none",border:"none",cursor:"pointer",textAlign:"left",userSelect:"none"}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={T.textMid} style={{flexShrink:0}}>
                  <path d={collapsed["root"]?"M9 6l6 6-6 6":"M6 9l6 6 6-6"}/>
                </svg>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={T.amber} strokeWidth={1.5} style={{flexShrink:0}}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                </svg>
                <span style={{fontSize:13,fontWeight:400,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {currentProject?.description?.slice(0,22) ?? "project"}
                </span>
              </button>

              {!collapsed["root"] && (
                <div>
                  {currentProject?.files.map(f => (
                    <button key={f.name} onClick={()=>openTab(f.name)}
                      style={{width:"100%",display:"flex",alignItems:"center",gap:6,
                        padding:"2px 8px 2px 26px",
                        background:activeTab===f.name?"rgba(0,122,204,0.2)":"none",
                        border:"none",cursor:"pointer",textAlign:"left",transition:"background 0.1s"}}
                      onMouseOver={e=>{ if(activeTab!==f.name) e.currentTarget.style.background="rgba(255,255,255,0.05)"; }}
                      onMouseOut={e=>{ if(activeTab!==f.name) e.currentTarget.style.background="none"; }}>
                      <span style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:ld(getLang(f.name)),boxShadow:`0 0 4px ${ld(getLang(f.name))}66`}}/>
                      <span style={{fontSize:13,color:activeTab===f.name?T.textBright:T.text,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:activeTab===f.name?500:400}}>
                        {f.name}
                      </span>
                    </button>
                  ))}
                  {!currentProject?.files.length && (
                    <p style={{fontSize:12,color:T.textDim,padding:"6px 8px 6px 26px"}}>No files yet.</p>
                  )}
                </div>
              )}
            </div>

            {/* COMPONENTS */}
            <div style={{marginTop:2}}>
              <button onClick={()=>setCollapsed(c=>({...c,"components":!c["components"]}))}
                style={{width:"100%",display:"flex",alignItems:"center",gap:4,padding:"3px 8px 3px 4px",
                  background:"none",border:"none",cursor:"pointer",userSelect:"none"}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={T.textMid} style={{flexShrink:0}}>
                  <path d={collapsed["components"]?"M9 6l6 6-6 6":"M6 9l6 6 6-6"}/>
                </svg>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={T.greenBright} strokeWidth={1.5} style={{flexShrink:0}}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
                <span style={{fontSize:13,color:T.text}}>Components</span>
              </button>
              {!collapsed["components"] && (
                <div>
                  {pipelineDone ? [
                    {n:currentProject?.description?.toLowerCase().includes("esp32")?"ESP32 DevKit V1":"Arduino Uno",t:"MCU"},
                    {n:"DHT22",t:"Sensor"},
                    {n:"OLED 128x64",t:"Display"},
                  ].map(c=>(
                    <div key={c.n} style={{display:"flex",alignItems:"center",gap:6,padding:"2px 8px 2px 26px"}}>
                      <span style={{width:8,height:8,borderRadius:1,flexShrink:0,background:T.greenBright}}/>
                      <span style={{fontSize:13,color:T.text,flex:1}}>{c.n}</span>
                      <span style={{fontSize:10,color:T.textDim}}>{c.t}</span>
                    </div>
                  )) : <p style={{fontSize:12,color:T.textDim,padding:"2px 8px 2px 26px"}}>Generating…</p>}
                </div>
              )}
            </div>

            {/* GENERATED ASSETS */}
            <div style={{marginTop:2}}>
              <button onClick={()=>setCollapsed(c=>({...c,"assets":!c["assets"]}))}
                style={{width:"100%",display:"flex",alignItems:"center",gap:4,padding:"3px 8px 3px 4px",
                  background:"none",border:"none",cursor:"pointer",userSelect:"none"}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={T.textMid} style={{flexShrink:0}}>
                  <path d={collapsed["assets"]?"M9 6l6 6-6 6":"M6 9l6 6 6-6"}/>
                </svg>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={T.teal} strokeWidth={1.5} style={{flexShrink:0}}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <span style={{fontSize:13,color:T.text}}>Generated</span>
              </button>
              {!collapsed["assets"] && (
                <div>
                  {["README.md","bom.csv","diagram.json","firmware.ino"].map(a=>(
                    <button key={a} style={{width:"100%",display:"flex",alignItems:"center",gap:6,
                      padding:"2px 8px 2px 26px",background:"none",border:"none",cursor:"pointer",
                      opacity:pipelineDone?1:0.3}}
                      onMouseOver={e=>{ if(pipelineDone) e.currentTarget.style.background="rgba(255,255,255,0.05)"; }}
                      onMouseOut={e=>{ e.currentTarget.style.background="none"; }}>
                      <span style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:ld(getLang(a))}}/>
                      <span style={{fontSize:13,color:T.text}}>{a}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* sidebar status strip */}
          <div style={{height:22,flexShrink:0,display:"flex",alignItems:"center",padding:"0 10px",
            borderTop:`1px solid ${T.border}`,gap:6}}>
            {pipeActive && (
              <>
                <motion.div animate={{rotate:360}} transition={{duration:0.8,repeat:Infinity,ease:"linear"}}
                  style={{width:10,height:10,borderRadius:"50%",border:`1.5px solid ${T.tabBorder}`,borderTopColor:T.blueUI,flexShrink:0}}/>
                <span style={{fontSize:11,color:T.textMid}}>Generating…</span>
              </>
            )}
            {pipelineDone && <span style={{fontSize:11,color:T.green}}>✓ Ready</span>}
          </div>
        </aside>

        <HDrag onD={d=>setLeftW(w=>Math.max(160,Math.min(340,w+d)))}/>

        {/* ── CENTER: EDITOR ─────────────────────────────────────────────── */}
        <div style={{display:"flex",flex:1,flexDirection:"column",overflow:"hidden",minWidth:0,background:T.bg}}>

          {/* file tabs — VS Code style */}
          <div style={{display:"flex",height:35,flexShrink:0,overflowX:"auto",background:T.titleBar,
            borderBottom:`1px solid ${T.border}`,alignItems:"stretch"}} className="ide-scroll">
            {tabs.map(tab => {
              const isA = activeTab===tab;
              return (
                <div key={tab} onClick={()=>{setActiveTab(tab);if(id)setActiveFile(id,tab);}}
                  style={{display:"flex",alignItems:"center",gap:7,padding:"0 12px",flexShrink:0,
                    cursor:"pointer",minWidth:80,maxWidth:180,
                    background:isA?T.bg:T.titleBar,
                    borderBottom:isA?`2px solid ${T.blueUI}`:"2px solid transparent",
                    borderRight:`1px solid ${T.border}`,
                    color:isA?T.textBright:T.textDim,transition:"color 0.1s"}}>
                  <span style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:ld(getLang(tab)),boxShadow:`0 0 3px ${ld(getLang(tab))}88`}}/>
                  <span style={{fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>
                    {tab}
                  </span>
                  {dirty&&tab===activeTab&&<span style={{width:7,height:7,borderRadius:"50%",flexShrink:0,background:T.amber,boxShadow:`0 0 4px ${T.amber}`}}/>}
                  <button onClick={e=>{e.stopPropagation();closeTab(tab);}}
                    style={{opacity:0,background:"none",border:"none",cursor:"pointer",padding:"1px 2px",color:T.textDim,lineHeight:1,flexShrink:0,borderRadius:3}}
                    onMouseOver={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.background="rgba(255,255,255,0.1)";}}
                    onMouseOut={e=>{e.currentTarget.style.opacity="0";e.currentTarget.style.background="none";}}>
                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              );
            })}
            <button onClick={()=>setNewFileOpen(true)}
              style={{padding:"0 10px",background:"none",border:"none",cursor:"pointer",color:T.textDim,flexShrink:0,display:"flex",alignItems:"center"}}
              title="New file">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
            </button>
          </div>

          {/* editor */}
          <div style={{position:"relative",display:"flex",flex:1,overflow:"hidden"}}>
            {activeTab && activeFile ? (
              <>
                {/* line numbers — VS Code style */}
                <div style={{flexShrink:0,background:T.bg,minWidth:44,paddingTop:14,paddingRight:10,paddingLeft:6,
                  textAlign:"right",borderRight:"none",fontFamily:"var(--font-mono)",
                  fontSize:13,lineHeight:"1.6",color:T.textDim,overflowY:"hidden",userSelect:"none",letterSpacing:"0"}}>
                  {code.split("\n").map((_,i)=><div key={i} style={{height:"1.6em"}}>{i+1}</div>)}
                </div>
                <textarea ref={editorRef} value={code}
                  onChange={e=>{setCode(e.target.value);setDirty(true);}}
                  onKeyDown={onKey} spellCheck={false}
                  className="ide-scroll"
                  style={{flex:1,resize:"none",outline:"none",background:T.bg,color:"#d4d4d4",
                    fontFamily:"var(--font-mono)",fontSize:13,lineHeight:"1.6",tabSize:2,
                    caretColor:T.text,padding:"14px 14px 14px 8px",border:"none",
                    userSelect:"text",letterSpacing:"0"}}
                />
              </>
            ) : (
              <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,background:T.bg}}>
                <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke={T.textDim} strokeWidth={0.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                </svg>
                <div style={{textAlign:"center"}}>
                  <p style={{fontSize:13,color:T.textMid,marginBottom:4}}>No file open</p>
                  <p style={{fontSize:12,color:T.textDim}}>Select a file from the explorer or create a new one.</p>
                </div>
                <button onClick={()=>setNewFileOpen(true)}
                  style={{padding:"5px 14px",fontSize:12,background:T.blueD,color:T.blueUI,
                    border:`1px solid ${T.blueHi}`,borderRadius:3,cursor:"pointer"}}>
                  New file
                </button>
              </div>
            )}
            {/* status bar — VS Code blue bar at bottom */}
            {activeTab && activeFile && (
              <div style={{position:"absolute",bottom:0,left:0,right:0,height:22,
                display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"0 12px",background:T.statusBar}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:11,color:"#fff",fontWeight:400}}>
                    {activeFile.language}
                  </span>
                  {dirty && <span style={{fontSize:11,color:"rgba(255,255,255,0.7)"}}>● Modified</span>}
                </div>
                <div style={{display:"flex",gap:12,fontSize:11,color:"rgba(255,255,255,0.8)"}}>
                  <span>Ln 1, Col 1</span>
                  <span>Spaces: 2</span>
                  <span>UTF-8</span>
                  <span>LF</span>
                </div>
              </div>
            )}
          </div>

          {/* vertical drag to resize bottom panel */}
          <VDrag onD={d=>setBotH(h=>Math.max(60,Math.min(400,h-d)))}/>

          {/* ── BOTTOM PANEL ──────────────────────────────────────────── */}
          <AnimatePresence initial={false}>
            {botOpen && (
              <motion.div initial={{height:0}} animate={{height:botH}} exit={{height:0}}
                transition={{duration:0.15,ease:"easeInOut"}}
                style={{flexShrink:0,display:"flex",flexDirection:"column",overflow:"hidden",
                  background:T.titleBar,borderTop:`1px solid ${T.border}`}}>

                {/* tab strip — Embedr "Serial Monitor  Output  Terminal" style */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  height:30,flexShrink:0,borderBottom:`1px solid ${T.border}`,padding:"0 4px"}}>
                  <div style={{display:"flex"}}>
                    {(["Output","Terminal","Logs"] as BottomTab[]).map(t=>(
                      <button key={t} onClick={()=>setBotTab(t)}
                        style={{padding:"0 14px",height:30,fontSize:12,fontWeight:botTab===t?500:400,
                          border:"none",cursor:"pointer",background:"transparent",
                          borderBottom:botTab===t?`2px solid ${T.blueUI}`:"2px solid transparent",
                          color:botTab===t?T.text:T.textDim,transition:"color 0.1s"}}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,paddingRight:10}}>
                    {/* scroll arrows like Embedr */}
                    <div style={{display:"flex",gap:2}}>
                      <button style={{background:"none",border:"none",cursor:"pointer",color:T.textDim,display:"flex",alignItems:"center",padding:"2px 4px"}}>
                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M5 15l7-7 7 7"/></svg>
                      </button>
                      <button style={{background:"none",border:"none",cursor:"pointer",color:T.textDim,display:"flex",alignItems:"center",padding:"2px 4px"}}>
                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M19 9l-7 7-7-7"/></svg>
                      </button>
                    </div>
                    <button onClick={()=>setLogs([])} style={{fontSize:11,color:T.textDim,background:"none",border:"none",cursor:"pointer"}}>Clear</button>
                    <button onClick={()=>setBotOpen(false)} style={{background:"none",border:"none",cursor:"pointer",color:T.textDim,display:"flex",alignItems:"center"}}>
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>

                {/* content — monospace like PlatformIO */}
                <div style={{flex:1,overflowY:"auto",padding:"6px 14px",fontFamily:"var(--font-mono)",fontSize:13,lineHeight:"1.6"}} className="ide-scroll">
                  {botTab==="Output" && <>
                    {msgs.filter(m=>m.role==="assistant").map((m,i)=>(
                      <div key={i} style={{marginBottom:12}}>
                        <div style={{fontSize:11,color:T.blueUI,marginBottom:2,letterSpacing:"0.04em",fontWeight:500}}>
                          [{m.id.replace("msg-","").replace(/_/g," ").toUpperCase()}]
                        </div>
                        <div style={{color:"#9cdcfe",lineHeight:1.65,whiteSpace:"pre-wrap"}}>
                          {m.content}
                          {m.streaming && <span style={{display:"inline-block",width:7,height:13,background:T.text,marginLeft:2,verticalAlign:"text-bottom",animation:"blink 1s step-end infinite"}}/>}
                        </div>
                      </div>
                    ))}
                    {!msgs.filter(m=>m.role==="assistant").length && (
                      <span style={{color:T.textDim}}>No output yet. Generation will appear here.</span>
                    )}
                  </>}
                  {botTab==="Terminal" && (
                    <div>
                      <div style={{color:T.green,marginBottom:4}}>$ wireup-ide v1.0 — workspace started</div>
                      <div style={{color:T.textDim,marginBottom:8}}>Connected to backend at http://localhost:5000</div>
                      {logs.filter(l=>l.type!=="info").map((l,i)=>(
                        <div key={i} style={{color:l.type==="success"?T.green:l.type==="error"?T.red:T.amber,lineHeight:1.65}}>
                          {l.text}
                        </div>
                      ))}
                      <div style={{display:"flex",alignItems:"center",gap:2,marginTop:4}}>
                        <span style={{color:T.green}}>$</span>
                        <span style={{width:7,height:13,background:T.text,marginLeft:4,display:"inline-block",animation:"blink 1s step-end infinite"}}/>
                      </div>
                    </div>
                  )}
                  {botTab==="Logs" && logs.map((l,i)=>(
                    <div key={i} style={{display:"flex",gap:12,lineHeight:1.65,
                      color:l.type==="success"?T.green:l.type==="error"?T.red:l.type==="warn"?T.amber:T.textDim}}>
                      <span style={{color:T.textDim,flexShrink:0,minWidth:60}}>
                        {new Date(l.ts).toLocaleTimeString("en-US",{hour12:false})}
                      </span>
                      {l.text}
                    </div>
                  ))}
                  {botTab==="Logs" && !logs.length && <span style={{color:T.textDim}}>No logs yet.</span>}
                  <div ref={logEndRef}/>
                </div>

                {/* Embedr-style status bar at very bottom */}
                <div style={{height:24,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"0 14px",borderTop:`1px solid ${T.border}`,background:T.bg}}>
                  {pipelineDone
                    ? <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:T.green}}/>
                        <span style={{fontSize:11,color:T.green,fontWeight:500}}>Status: Success</span>
                      </div>
                    : pipeActive
                      ? <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <motion.div animate={{rotate:360}} transition={{duration:0.8,repeat:Infinity,ease:"linear"}}
                            style={{width:8,height:8,borderRadius:"50%",border:`1.5px solid ${T.tabBorder}`,borderTopColor:T.blueUI}}/>
                          <span style={{fontSize:11,color:T.textMid}}>Generating… {pct}%</span>
                        </div>
                      : <span style={{fontSize:11,color:T.textDim}}>Idle</span>
                  }
                  <div style={{display:"flex",gap:14,fontSize:11,color:T.textDim}}>
                    <button onClick={()=>setLogs([])} style={{background:"none",border:"none",cursor:"pointer",color:T.textDim,fontSize:11}}>Disable Auto-scroll</button>
                    <button style={{background:"none",border:"none",cursor:"pointer",color:T.textDim,fontSize:11}}>Copy</button>
                    <button onClick={()=>setLogs([])} style={{background:"none",border:"none",cursor:"pointer",color:T.textDim,fontSize:11}}>Clear</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <HDrag onD={d=>setRightW(w=>Math.max(220,Math.min(420,w-d)))}/>

        {/* ── RIGHT: AI COPILOT ──────────────────────────────────────── */}
        <aside style={{width:rightW,minWidth:220,maxWidth:420,flexShrink:0,display:"flex",
          flexDirection:"column",overflow:"hidden",background:T.titleBar,borderLeft:`1px solid ${T.border}`}}>

          {/* header — "I2C Sensor Dashboard  + New chat" like Embedr */}
          <div style={{height:35,flexShrink:0,display:"flex",alignItems:"center",
            padding:"0 12px",borderBottom:`1px solid ${T.border}`,justifyContent:"space-between",background:T.titleBar}}>
            <span style={{fontSize:13,fontWeight:600,color:T.textBright}}>
              {currentProject?.description?.slice(0,28) ?? "AI Copilot"}
            </span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {pipeActive && (
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <motion.div animate={{rotate:360}} transition={{duration:0.8,repeat:Infinity,ease:"linear"}}
                    style={{width:10,height:10,borderRadius:"50%",border:`1.5px solid ${T.tabBorder}`,borderTopColor:T.blueUI}}/>
                  <span style={{fontSize:11,color:T.blueUI}}>Working</span>
                </div>
              )}
              {pipelineDone && (
                <button onClick={()=>{started.current=false;setPipelineDone(false);setPipeActive(false);setPipelinePct(0);setStages([]);setMsgs([]);if(currentProject)runPipeline(currentProject.description);}}
                  style={{fontSize:11,color:T.textDim,background:"none",border:"none",cursor:"pointer",padding:"2px 6px",borderRadius:3}}
                  onMouseOver={e=>{e.currentTarget.style.background="rgba(255,255,255,0.08)";e.currentTarget.style.color=T.text;}}
                  onMouseOut={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=T.textDim;}}>
                  + New chat
                </button>
              )}
            </div>
          </div>

          {/* project summary block */}
          {currentProject && stages.length > 0 && (
            <div style={{flexShrink:0,padding:"10px 14px",borderBottom:`1px solid ${T.border}`,background:T.bg}}>
              {/* progress bar */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <span style={{fontSize:11,color:T.textMid}}>
                  {pipelineDone ? "Complete" : `${completedN} / ${stages.length} steps`}
                </span>
                <span style={{fontSize:11,fontWeight:600,color:T.blueUI}}>{pct}%</span>
              </div>
              <div style={{height:2,background:T.tabBorder,overflow:"hidden",marginBottom:8}}>
                <motion.div style={{height:"100%",background:T.blueUI}} animate={{width:`${pct}%`}} transition={{duration:0.4}}/>
              </div>
              {/* stage list */}
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {stages.map(s=>(
                  <div key={s.key} style={{display:"flex",alignItems:"center",gap:8}}>
                    <StageIcon s={s.state}/>
                    <span style={{fontSize:12,
                      color:s.state==="running"?T.textBright:s.state==="completed"?T.textMid:T.textDim,
                      fontWeight:s.state==="running"?500:400}}>
                      {s.label}
                    </span>
                    {s.state==="running" && (
                      <span style={{fontSize:11,color:T.blueUI,marginLeft:"auto"}}>…</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* chat messages */}
          <div style={{flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:14}} className="ide-scroll">
            {msgs.length===0 && !pipeActive && (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10,paddingTop:28,textAlign:"center"}}>
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke={T.textDim} strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
                <p style={{fontSize:12,color:T.textDim}}>Generation starting…</p>
              </div>
            )}

            {msgs.map(m => {
              const isUser = m.role==="user";
              return (
                <div key={m.id} style={{display:"flex",flexDirection:"column",gap:4}}>
                  {/* stage label for AI messages */}
                  {!isUser && m.id.startsWith("msg-") && (
                    <span style={{fontSize:10,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",
                      color:T.blueUI}}>
                      {m.id.replace("msg-","").replace(/_/g," ")}
                    </span>
                  )}
                  <div style={{
                    fontSize:13,lineHeight:1.65,whiteSpace:"pre-wrap",color:T.text,
                    fontFamily:"var(--font-sans)",
                    // User messages get a slight indent; AI messages are plain
                    ...(isUser ? {
                      background:T.blueD,
                      border:`1px solid ${T.blueHi}`,
                      borderRadius:4,
                      padding:"7px 10px",
                      color:T.textBright,
                    } : {}),
                  }}>
                    {m.content}
                    {m.streaming && <span style={{display:"inline-block",width:7,height:13,background:T.text,marginLeft:2,verticalAlign:"text-bottom",animation:"blink 1s step-end infinite"}}/>}
                  </div>
                </div>
              );
            })}

            {chatBusy && (
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <motion.div animate={{rotate:360}} transition={{duration:0.8,repeat:Infinity,ease:"linear"}}
                  style={{width:12,height:12,borderRadius:"50%",border:`1.5px solid ${T.tabBorder}`,borderTopColor:T.blueUI,flexShrink:0}}/>
                <span style={{fontSize:12,color:T.textMid,fontStyle:"italic"}}>Hardware Design Agent thinking…</span>
              </div>
            )}
            <div ref={chatEndRef}/>
          </div>

          {/* chat input — "Ask Embedr for help…" style */}
          <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,padding:"8px 10px",background:T.bg}}>
            <div style={{display:"flex",alignItems:"flex-end",gap:6,
              border:`1px solid ${T.border}`,borderRadius:4,background:T.titleBar,padding:"6px 8px",
              transition:"border-color 0.15s"}}
              onFocusCapture={e=>(e.currentTarget.style.borderColor=T.blueUI)}
              onBlurCapture={e=>(e.currentTarget.style.borderColor=T.border)}>
              <textarea value={chatIn}
                onChange={e=>{setChatIn(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,96)+"px";}}
                onKeyDown={e=>{
                if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat();}
              }}
                placeholder={pipelineDone?"Ask WireUp AI… (Type @ to mention files)":"AI is generating…"}
                disabled={chatBusy}
                rows={1}
                style={{flex:1,resize:"none",outline:"none",border:"none",
                  background:"transparent",color:T.text,fontFamily:"var(--font-sans)",
                  fontSize:12,lineHeight:1.5,padding:0,
                  maxHeight:96,caretColor:T.text,
                  opacity:chatBusy?0.5:1}}
                className="ide-scroll"
              />
              <button onClick={chatBusy?undefined:sendChat}
                disabled={!chatIn.trim()&&!chatBusy}
                style={{width:24,height:24,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",
                  flexShrink:0,
                  background:chatBusy?T.red:chatIn.trim()?T.blueUI:"transparent",
                  color:chatIn.trim()||chatBusy?"#fff":T.textDim,
                  border:chatIn.trim()||chatBusy?"none":`1px solid ${T.border}`,
                  cursor:chatIn.trim()||chatBusy?"pointer":"not-allowed"}}>
                {chatBusy
                  ? <svg width="9" height="9" fill="currentColor" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="1"/></svg>
                  : <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
                }
              </button>
            </div>
            {/* model selector row — "GLM-5  >_  Preferences" like Embedr bottom bar */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:6}}>
              <ModelPicker val={model} set={setModel}/>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {/* attach icon */}
                <button style={{background:"none",border:"none",cursor:"pointer",color:T.textDim,display:"flex",alignItems:"center",padding:2}}
                  title="Attach file">
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                  </svg>
                </button>
                {/* preferences */}
                <button style={{background:"none",border:"none",cursor:"pointer",color:T.textDim,fontSize:11,display:"flex",alignItems:"center",gap:3}}>
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
                  </svg>
                  Preferences
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ╔═ NEW FILE MODAL ══════════════════════════════════════════════════╗ */}
      <AnimatePresence>
        {newFileOpen && (
          <div style={{position:"fixed",inset:0,zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",
            background:"rgba(0,0,0,0.6)"}}
            onClick={e=>{if(e.target===e.currentTarget){setNewFileOpen(false);setNewFileName("");}}}>
            <motion.div initial={{opacity:0,scale:0.97,y:4}} animate={{opacity:1,scale:1,y:0}}
              exit={{opacity:0,scale:0.97,y:4}} transition={{duration:0.1}}
              style={{width:"100%",maxWidth:360,borderRadius:6,padding:20,
                background:T.titleBar,border:`1px solid ${T.borderHi}`,
                boxShadow:"0 16px 48px rgba(0,0,0,0.7)"}}>
              <p style={{fontSize:13,fontWeight:600,color:T.textBright,marginBottom:12}}>New file</p>
              <input autoFocus value={newFileName}
                onChange={e=>setNewFileName(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")createFile();if(e.key==="Escape"){setNewFileOpen(false);setNewFileName("");}}}
                placeholder="firmware.ino"
                style={{width:"100%",padding:"7px 10px",borderRadius:3,outline:"none",
                  background:T.bg,border:`1px solid ${T.border}`,color:T.text,
                  fontFamily:"var(--font-mono)",fontSize:13,boxSizing:"border-box"}}
                onFocus={e=>(e.currentTarget.style.borderColor=T.blueUI)}
                onBlur={e=>(e.currentTarget.style.borderColor=T.border)}
              />
              <div style={{display:"flex",gap:8,marginTop:12}}>
                <button onClick={()=>{setNewFileOpen(false);setNewFileName("");}}
                  style={{flex:1,padding:"6px 0",borderRadius:3,fontSize:12,background:"transparent",
                    color:T.textMid,border:`1px solid ${T.border}`,cursor:"pointer"}}>
                  Cancel
                </button>
                <button onClick={createFile} disabled={!newFileName.trim()}
                  style={{flex:1,padding:"6px 0",borderRadius:3,fontSize:12,fontWeight:600,border:"none",
                    background:newFileName.trim()?T.blueUI:"rgba(0,122,204,0.2)",
                    color:newFileName.trim()?"#fff":T.textDim,
                    cursor:newFileName.trim()?"pointer":"not-allowed"}}>
                  Create
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

