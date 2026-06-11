/**
 * WireUp IDE — "Cursor + VS Code + PlatformIO for Hardware Engineering"
 * Layout: Left File Explorer | Center Editor (primary) | Right AI Copilot
 *         Bottom: Output / Terminal / Logs panel
 */
import {
  useEffect, useRef, useState, useCallback, type KeyboardEvent,
} from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useProjectStore, type ProjectFile } from "../store/useProjectStore";
import { useAuthStore } from "../store/useAuthStore";
import { AIReasoningPanel, type ReasoningStep, type ChatMessage as AIChatMessage } from "../components/AIReasoningPanel/AIReasoningPanel";
import { CircuitDiagram } from "../components/CircuitDiagram/CircuitDiagram";
import ProjectQuestionnaire from "../components/ProjectQuestionnaire/ProjectQuestionnaire";

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
  const location     = useLocation();
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

  /* questionnaire — shown before pipeline starts */
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [questionnaireIdea, setQuestionnaireIdea] = useState("");

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

  /* auto-start — only run questionnaire + pipeline if project hasn't been generated yet */
  useEffect(() => {
    if (!currentProject || started.current || pipelineDone) return;
    started.current = true;

    const routerPrompt = (location.state as { prompt?: string } | null)?.prompt?.trim();
    const idea = routerPrompt || currentProject.description;

    // ── Check if project was already generated ──────────────────────────
    // A project is "done" if it has more than 1 file OR localStorage says so
    const alreadyGenerated = currentProject.files.length > 1 ||
      localStorage.getItem(`wireup:done:${currentProject._id}`) === "1";

    if (alreadyGenerated) {
      // Restore state without re-running anything
      setPipelineDone(true);
      setPipelinePct(100);
      // Show the initial prompt as the user message (use description as fallback)
      const displayPrompt = routerPrompt || currentProject.description;
      setMsgs([{ id: "u-init", role: "user", content: displayPrompt, streaming: false }]);
      addLog("info", `[wireup] Restored project: ${currentProject.description}`);
      return;
    }

    // ── First time — run questionnaire then pipeline ─────────────────────
    // 1. Show user's typed message immediately
    if (routerPrompt) {
      setMsgs([
        { id: `u-init`, role: "user", content: routerPrompt, streaming: false },
        { id: `thinking-init`, role: "assistant", content: "", streaming: true },
      ]);
    }

    // 2. Brief delay so thinking animation is visible, then show questionnaire
    setTimeout(() => {
      setMsgs(p => p.filter(m => m.id !== "thinking-init"));
      setQuestionnaireIdea(idea);
      setShowQuestionnaire(true);
    }, 1800);
  }, [currentProject?._id]);

  const runPipeline = async (idea: string, answers?: Record<string, string>) => {
    // Clear any leftover thinking placeholder
    setMsgs(p => p.filter(m => m.id !== "thinking-init"));
    setPipeActive(true); setPipelinePct(0); setStages([]); sidxMap.current = {};
    const base = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

    // Build context string from questionnaire answers
    const answersContext = answers && Object.keys(answers).length > 0
      ? "\n\nUser preferences:\n" + Object.entries(answers)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")
      : "";

    try {
      for await (const { event, data } of sse(`${base}/generate`, {
        idea: idea + answersContext,
        projectId: id,
        model
      })) {
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
        if (event === "pipeline_done") {
          setPipelinePct(100); setPipelineDone(true); setPipeActive(false); setBotOpen(true);
          // Persist completion flag for this project so reloads don't re-run
          localStorage.setItem(`wireup:done:${id}`, "1");
          addLog("success", "[wireup] Generation complete.");
        }
        if (event === "pipeline_error") { setStages(p => p.map(s => s.state==="running"?{...s,state:"failed"}:s)); setPipeActive(false); addLog("error", `[pipeline] ${data.error}`); toast.error(data.error); }
        // AI-generated short project name — update store so title bar shows clean name
        if (event === "project_name" && data.name) {
          const cleanName = String(data.name).trim();
          if (cleanName) {
            useProjectStore.setState(s => ({
              currentProject: s.currentProject
                ? { ...s.currentProject, description: cleanName }
                : s.currentProject,
            }));
          }
          addLog("info", `[project] Renamed to: ${data.name}`);
        }
        // File created by AI — add to project store immediately so explorer updates live
        if (event === "file_created" && id) {
          const { filename, language, content: fileContent } = data as { filename: string; language: string; content: string; folder: string };
          // addFile handles both new files and updates
          addFile(id, { name: filename, language, content: fileContent });
          addLog("success", `[file] Created ${filename}`);
        }
        if (event === "file_start") {
          addLog("info", `[file] Generating ${data.filename}…`);
        }
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

  /* editor helpers — opening a file auto-switches view mode */
  const openTab = (n: string) => {
    setTabs(p=>p.includes(n)?p:[...p,n]);
    setActiveTab(n);
    if(id) setActiveFile(id,n);
    // Auto-switch view: diagram.json → Diagram, simulation files → Simulation, else Code
    const ext = n.split(".").pop()?.toLowerCase() ?? "";
    if (n.toLowerCase().includes("diagram") && ext === "json") {
      setTabMode("Diagram");
    } else if (n.toLowerCase().includes("simulation") || n.toLowerCase().includes("sim")) {
      setTabMode("Simulation");
    } else {
      setTabMode("Code");
    }
  };
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

        {/* right actions only — no mode tabs, view switches via file clicks */}
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

          {/* ── Explorer header ─────────────────────────────────────────── */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
            padding:"0 12px",height:30,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
            <div>
              <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",
                textTransform:"uppercase",color:T.textMid,userSelect:"none"}}>
                Project
              </span>
              <span style={{fontSize:11,color:T.textDim,marginLeft:6}}>Files</span>
            </div>
            <button onClick={()=>setNewFileOpen(true)}
              style={{background:"none",border:"none",cursor:"pointer",color:T.textMid,
                padding:"2px 4px",display:"flex",alignItems:"center",borderRadius:3,
                transition:"background 0.1s"}}
              title="New file"
              onMouseOver={e=>(e.currentTarget.style.background="rgba(255,255,255,0.08)")}
              onMouseOut={e=>(e.currentTarget.style.background="none")}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </button>
          </div>

          {/* ── Folder tree ─────────────────────────────────────────────── */}
          <div style={{flex:1,overflowY:"auto",paddingBottom:8}} className="ide-scroll">
            {(() => {
              // Group files into folders by extension/type
              const files = currentProject?.files ?? [];
              const groups: Array<{key:string; label:string; icon:React.ReactNode; files:typeof files}> = [
                {
                  key:"src", label:"src",
                  icon:<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={T.amber} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>,
                  files: files.filter(f=>["ino","cpp","c","h","py","js","ts","rs"].includes(f.name.split(".").pop()?.toLowerCase()??"")),
                },
                {
                  key:"wiring", label:"wiring",
                  icon:<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#4fc1ff" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>,
                  files: files.filter(f=>["json","svg","xml"].includes(f.name.split(".").pop()?.toLowerCase()??"") && (f.name.toLowerCase().includes("diagram")||f.name.toLowerCase().includes("wiring")||f.name.toLowerCase().includes("schematic"))),
                },
                {
                  key:"specs", label:"specs",
                  icon:<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#fb923c" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
                  files: files.filter(f=>["csv","json","yaml","yml"].includes(f.name.split(".").pop()?.toLowerCase()??"") && !((f.name.toLowerCase().includes("diagram")||f.name.toLowerCase().includes("wiring")||f.name.toLowerCase().includes("schematic")))),
                },
                {
                  key:"docs", label:"docs",
                  icon:<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#c586c0" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>,
                  files: files.filter(f=>["md","txt","pdf"].includes(f.name.split(".").pop()?.toLowerCase()??"")),
                },
              ].filter(g => g.files.length > 0);

              // Files not caught by any group → show in a misc "other" folder
              const allGrouped = groups.flatMap(g=>g.files);
              const other = files.filter(f=>!allGrouped.find(gf=>gf.name===f.name));
              if (other.length) groups.push({key:"other",label:"other",
                icon:<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={T.textDim} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>,
                files:other});

              if (!files.length) return (
                <div style={{padding:"20px 14px",textAlign:"center"}}>
                  <p style={{fontSize:12,color:T.textDim,lineHeight:1.5}}>
                    {pipeActive ? "Generating project files…" : "No files yet."}
                  </p>
                </div>
              );

              return groups.map(group => (
                <div key={group.key} style={{marginTop:4}}>
                  {/* Group label row */}
                  <button
                    onClick={()=>setCollapsed(c=>({...c,[group.key]:!c[group.key]}))}
                    style={{width:"100%",display:"flex",alignItems:"center",gap:6,
                      padding:"4px 10px 3px 8px",background:"none",border:"none",
                      cursor:"pointer",userSelect:"none"}}>
                    <svg width="9" height="9" viewBox="0 0 16 16" fill={T.textDim}
                      style={{flexShrink:0,transition:"transform 0.12s",
                        transform:collapsed[group.key]?"rotate(-90deg)":"rotate(0deg)"}}>
                      <path d="M4 6l4 4 4-4z"/>
                    </svg>
                    {group.icon}
                    <span style={{fontSize:11,fontWeight:500,letterSpacing:"0.04em",
                      color:T.textDim,textTransform:"lowercase"}}>
                      {group.label}
                    </span>
                  </button>

                  {/* File rows */}
                  {!collapsed[group.key] && group.files.map(f => {
                    const isActive = activeTab===f.name;
                    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";

                    // File-type icon
                    const FileIco = () => {
                      const ico: Record<string,React.ReactNode> = {
                        ino: <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#00979d" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>,
                        cpp: <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#9333ea" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>,
                        md:  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#c586c0" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
                        csv: <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#4ec9b0" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 4v16M14 4v16M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/></svg>,
                        json:<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#fb923c" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h10M7 16h10M3 4h18v16H3z"/></svg>,
                        svg: <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#4fc1ff" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-6-6L3 21"/></svg>,
                        py:  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#3572A5" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>,
                        ts:  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#007acc" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>,
                      };
                      return <>{ico[ext] ?? <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={T.textDim} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}</>;
                    };

                    return (
                      <button key={f.name}
                        onClick={()=>openTab(f.name)}
                        style={{
                          width:"100%",display:"flex",alignItems:"center",gap:8,
                          padding:"4px 10px 4px 28px",
                          background:isActive?"rgba(0,122,204,0.18)":"transparent",
                          border:"none",cursor:"pointer",textAlign:"left",
                          borderLeft:isActive?`2px solid ${T.blueUI}`:"2px solid transparent",
                          paddingLeft:isActive?"26px":"28px",
                          transition:"background 0.1s",
                        }}
                        onMouseOver={e=>{ if(!isActive) e.currentTarget.style.background="rgba(255,255,255,0.05)"; }}
                        onMouseOut={e=>{ if(!isActive) e.currentTarget.style.background="transparent"; }}>
                        <FileIco/>
                        <span style={{fontSize:13,flex:1,
                          color:isActive?T.textBright:T.text,
                          fontWeight:isActive?500:400,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {f.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ));
            })()}
          </div>

          {/* status strip */}
          <div style={{height:22,flexShrink:0,display:"flex",alignItems:"center",
            padding:"0 10px",borderTop:`1px solid ${T.border}`,gap:6}}>
            {pipeActive && (
              <>
                <motion.div animate={{rotate:360}} transition={{duration:0.8,repeat:Infinity,ease:"linear"}}
                  style={{width:9,height:9,borderRadius:"50%",
                    border:`1.5px solid ${T.tabBorder}`,borderTopColor:T.blueUI,flexShrink:0}}/>
                <span style={{fontSize:11,color:T.textMid}}>Generating…</span>
              </>
            )}
            {pipelineDone && (
              <span style={{fontSize:11,color:T.green}}>
                ✓ {currentProject?.files.length ?? 0} file{(currentProject?.files.length??0)!==1?"s":""}
              </span>
            )}
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

          {/* editor / view area — switches based on tabMode */}
          <div style={{position:"relative",display:"flex",flex:1,overflow:"hidden"}}>

            {/* ── CODE MODE ─────────────────────────────────────────────── */}
            {tabMode === "Code" && (
              activeTab && activeFile ? (
                <>
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
              )
            )}

            {/* ── DIAGRAM MODE ──────────────────────────────────────────── */}
            {tabMode === "Diagram" && (
              pipelineDone
                ? <CircuitDiagram
                    projectDescription={currentProject?.description ?? ""}
                    pipelineDone={pipelineDone}
                  />
                : <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,background:T.bg}}>
                    <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:"linear"}}
                      style={{width:24,height:24,borderRadius:"50%",border:`2px solid ${T.tabBorder}`,borderTopColor:T.blueUI}}/>
                    <p style={{fontSize:12,color:T.textDim}}>Circuit diagram generating…</p>
                  </div>
            )}

            {/* ── SIMULATION MODE ───────────────────────────────────────── */}
            {tabMode === "Simulation" && (
              <div style={{flex:1,overflowY:"auto",background:T.bg,padding:"28px 32px"}} className="ide-scroll">
                {!pipelineDone ? (
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:12}}>
                    <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:"linear"}}
                      style={{width:24,height:24,borderRadius:"50%",border:`2px solid ${T.tabBorder}`,borderTopColor:T.blueUI}}/>
                    <p style={{fontSize:12,color:T.textDim}}>Simulation generating…</p>
                  </div>
                ) : (
                  <>
                    <div style={{marginBottom:24}}>
                      <p style={{fontSize:11,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textDim,marginBottom:6}}>
                        Simulation Report
                      </p>
                      <p style={{fontSize:13,color:T.textMid}}>{currentProject?.description}</p>
                    </div>

                    {/* Sim status bar */}
                    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
                      {[
                        {label:"Power",value:"5V / 180mA",ok:true},
                        {label:"Clock",value:"16 MHz",ok:true},
                        {label:"Flash",value:"32KB / 28KB used",ok:true},
                        {label:"RAM",value:"2KB / 1.4KB used",ok:true},
                      ].map(s=>(
                        <div key={s.label} style={{
                          padding:"8px 14px",borderRadius:6,
                          background:s.ok?"rgba(62,207,142,0.08)":"rgba(239,68,68,0.08)",
                          border:`1px solid ${s.ok?"rgba(62,207,142,0.25)":"rgba(239,68,68,0.25)"}`,
                          display:"flex",flexDirection:"column",gap:2
                        }}>
                          <span style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.label}</span>
                          <span style={{fontSize:12,fontWeight:500,color:s.ok?T.greenBright:T.red,fontFamily:"var(--font-mono)"}}>{s.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Simulated serial output */}
                    <div style={{borderRadius:6,overflow:"hidden",border:`1px solid ${T.border}`,marginBottom:20}}>
                      <div style={{padding:"6px 12px",background:T.titleBar,borderBottom:`1px solid ${T.border}`,
                        display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <span style={{fontSize:11,fontWeight:500,color:T.textMid}}>Serial Monitor — 9600 baud</span>
                        <div style={{display:"flex",gap:4}}>
                          <span style={{width:8,height:8,borderRadius:"50%",background:T.green,display:"inline-block"}}/>
                          <span style={{fontSize:10,color:T.green}}>Connected</span>
                        </div>
                      </div>
                      <div style={{padding:"10px 14px",fontFamily:"var(--font-mono)",fontSize:12,lineHeight:1.8,
                        background:"#0a0c10",minHeight:180}}>
                        {[
                          {t:"00:00:01",c:T.green,   l:"[INIT] System starting..."},
                          {t:"00:00:01",c:T.textDim, l:"[INFO] Initializing DHT22 sensor on pin D2"},
                          {t:"00:00:02",c:T.green,   l:"[OK] DHT22 initialized"},
                          {t:"00:00:02",c:T.textDim, l:"[INFO] Initializing OLED display (I2C 0x3C)"},
                          {t:"00:00:02",c:T.green,   l:"[OK] OLED initialized (128x64)"},
                          {t:"00:00:03",c:T.blueUI,  l:"[DATA] Temperature: 23.4°C  Humidity: 61.2%"},
                          {t:"00:00:03",c:T.blueUI,  l:"[DATA] Updating display..."},
                          {t:"00:00:05",c:T.blueUI,  l:"[DATA] Temperature: 23.5°C  Humidity: 61.1%"},
                          {t:"00:00:07",c:T.blueUI,  l:"[DATA] Temperature: 23.5°C  Humidity: 60.9%"},
                          {t:"00:00:09",c:T.amber,   l:"[WARN] High humidity threshold approaching"},
                        ].map((row,i)=>(
                          <div key={i} style={{display:"flex",gap:12}}>
                            <span style={{color:"rgba(255,255,255,0.2)",flexShrink:0}}>{row.t}</span>
                            <span style={{color:row.c}}>{row.l}</span>
                          </div>
                        ))}
                        <div style={{display:"flex",alignItems:"center",gap:2,marginTop:4}}>
                          <span style={{color:T.green}}>$</span>
                          <span style={{width:7,height:13,background:T.text,marginLeft:4,display:"inline-block",animation:"blink 1s step-end infinite"}}/>
                        </div>
                      </div>
                    </div>

                    {/* Validation checks */}
                    <div>
                      <p style={{fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:T.textDim,marginBottom:10}}>
                        Validation
                      </p>
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {[
                          {ok:true,  label:"Power budget within limits (180mA < 500mA)"},
                          {ok:true,  label:"All sensor reads successful"},
                          {ok:true,  label:"Display render cycle < 50ms"},
                          {ok:true,  label:"No I2C address conflicts"},
                          {ok:false, label:"Humidity threshold alert logic not implemented"},
                        ].map((v,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:10}}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                              {v.ok
                                ? <><circle cx="8" cy="8" r="6" fill="#3ecf8e" fillOpacity=".15" stroke="#3ecf8e" strokeWidth="1.2"/><path d="M5 8l2.5 2.5L11 5.5" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round"/></>
                                : <><circle cx="8" cy="8" r="6" fill="#f59e0b" fillOpacity=".12" stroke="#f59e0b" strokeWidth="1.2"/><path d="M8 5v3.5M8 10.5v.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/></>
                              }
                            </svg>
                            <span style={{fontSize:12,color:v.ok?T.textMid:T.amber}}>{v.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* status bar — only in Code mode */}
            {tabMode === "Code" && activeTab && activeFile && (
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

        <HDrag onD={d=>setRightW(w=>Math.max(260,Math.min(480,w-d)))}/>

        {/* ── RIGHT: AI REASONING PANEL (VS Code Copilot style) ──────── */}
        <aside style={{width:rightW,minWidth:260,maxWidth:480,flexShrink:0,
          borderLeft:`1px solid ${T.border}`,overflow:"hidden",display:"flex",flexDirection:"column"}}>
          <AIReasoningPanel
            projectTitle={currentProject?.description ?? ""}
            steps={stages
              .filter(s => s.key !== "summary")  // summary shown as card, not as a step
              .map((s): ReasoningStep => ({
              id:        s.key,
              label:     s.label,
              status:    s.state === "completed" ? "done"
                       : s.state === "running"   ? "running"
                       : s.state === "failed"    ? "failed"
                       : "pending",
              content:   msgs.find(m => m.id === s.key)?.content ?? "",
              streaming: msgs.find(m => m.id === s.key)?.streaming ?? false,
              icon:      (s.key === "requirements" ? "think"
                       : s.key === "architecture"  ? "build"
                       : s.key === "components"    ? "search"
                       : s.key === "circuit"       ? "tool"
                       : s.key === "firmware"      ? "write"
                       : s.key === "validation"    ? "check"
                       : "think") as ReasoningStep["icon"],
            }))}
            messages={msgs
              .filter(m => {
                // Exclude pipeline stage outputs (kept only in reasoning steps)
                const pipelineKeys = new Set([
                  "requirements","architecture","components","circuit",
                  "firmware","validation","documentation","summary",
                  ...stages.map(s => s.key),
                ]);
                if (pipelineKeys.has(m.id)) return false;
                // Keep thinking-init — it renders as the thinking animation
                return true;
              })
              .map((m): AIChatMessage => ({
                id:       m.id,
                role:     m.role as "user" | "assistant",
                content:  m.content,
                streaming:m.streaming,
              }))}
            summary={pipelineDone
              ? (msgs.find(m => m.id === "summary")?.content?.trim() ?? "")
              : ""}
            chatInput={chatIn}
            chatBusy={chatBusy}
            pipelineDone={pipelineDone}
            pipelineActive={pipeActive}
            pipelinePct={pct}
            model={model}
            onChatInput={setChatIn}
            onSend={sendChat}
            onStop={() => setChatBusy(false)}
            onNewChat={() => {
              // Clear completion flag so restart works
              if (id) localStorage.removeItem(`wireup:done:${id}`);
              started.current = false;
              setPipelineDone(false);
              setPipeActive(false);
              setPipelinePct(0);
              setStages([]);
              setMsgs([]);
              if (currentProject) {
                setQuestionnaireIdea(currentProject.description);
                setShowQuestionnaire(true);
              }
            }}
            onModelChange={(m) => setModel(m as ModelKey)}
            modelOptions={MODELS.map(m => ({ key: m.key, sub: m.sub }))}
          />
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

      {/* Questionnaire overlay */}
      {showQuestionnaire && (
        <ProjectQuestionnaire
          idea={questionnaireIdea}
          model={model}
          onStart={(answers) => {
            setShowQuestionnaire(false);
            // Re-add thinking animation briefly while pipeline spins up
            setMsgs(p => {
              const hasThink = p.find(m => m.id === "thinking-init");
              return hasThink ? p : [...p, { id: "thinking-init", role: "assistant" as const, content: "", streaming: true }];
            });
            setTimeout(() => runPipeline(questionnaireIdea, answers), 600);
          }}
          onSkip={() => {
            setShowQuestionnaire(false);
            setMsgs(p => {
              const hasThink = p.find(m => m.id === "thinking-init");
              return hasThink ? p : [...p, { id: "thinking-init", role: "assistant" as const, content: "", streaming: true }];
            });
            setTimeout(() => runPipeline(questionnaireIdea), 600);
          }}
        />
      )}
    </div>
  );
}
