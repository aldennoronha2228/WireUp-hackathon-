/**
 * WireUp AI Chat Panel — VS Code Copilot Chat exact design
 *
 * Key VS Code patterns applied:
 * - NO chat bubbles. Messages are flat, full-width.
 * - Role header: "You" / "WireUp" small muted label above each turn.
 * - Tool/reasoning steps = collapsible rows, auto-expand while running,
 *   auto-collapse when done, exactly like "Used tool: X" in Copilot.
 * - Code blocks rendered with dark bg, language tag, copy button.
 * - Markdown: bold, bullets, headers rendered — not raw asterisks.
 * - Input: flat field at bottom, no box styling, paperclip + send.
 * - Model selector: small pill bottom-left of input.
 * - Thin border separator between turns.
 * - Reasoning section pinned to bottom, collapsible like "View Tool Calls".
 */

import {
  useState, useRef, useEffect, type KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMicRecorder } from "../../hooks/useMicRecorder";

/* ── VS Code Copilot exact colors ─────────────────────────────────────────── */
const V = {
  bg:       "#1f1f1f",   // chat panel background
  item:     "#1f1f1f",   // message area (same as bg — no bubbles)
  input:    "#2a2a2a",   // input field
  inputBdr: "#3c3c3c",   // input border
  code:     "#1e1e1e",   // code block bg
  codeBdr:  "#3c3c3c",
  toolBg:   "#252526",   // tool call row bg
  toolBdr:  "#3c3c3c",
  sep:      "rgba(255,255,255,0.06)", // turn separator
  text:     "#cccccc",   // primary text
  textBri:  "#d4d4d4",   // slightly brighter
  textDim:  "#6b6b6b",   // muted — role labels, timestamps
  textMid:  "#9d9d9d",   // secondary
  blue:     "#0e7dd4",   // Copilot blue accent
  blueHov:  "rgba(14,125,212,0.15)",
  green:    "#4ec9b0",   // success / done
  red:      "#f44747",
  amber:    "#dcdcaa",
  icon:     "#c5c5c5",   // icon color
};

/* ── Types ────────────────────────────────────────────────────────────────── */
export type StepStatus = "pending" | "running" | "done" | "failed";
export interface ReasoningStep {
  id: string; label: string; status: StepStatus;
  content: string; streaming: boolean;
  icon?: "think" | "search" | "write" | "tool" | "build" | "check";
}
export interface ChatMessage {
  id: string; role: "user" | "assistant";
  content: string; streaming: boolean; model?: string;
  images?: string[];
}
interface Props {
  projectTitle: string; steps: ReasoningStep[];
  messages: ChatMessage[]; summary: string;
  chatInput: string; chatBusy: boolean;
  pipelineDone: boolean; pipelineActive: boolean; pipelinePct: number;
  model: string;
  onChatInput: (v: string) => void; onSend: (attachments: string[]) => void; onStop: () => void;
  onNewChat: () => void; onModelChange: (m: string) => void;
  modelOptions: Array<{ key: string; sub: string; group?: string }>;
}

/* ── Markdown renderer (minimal, no deps) ────────────────────────────────── */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]); i++;
      }
      out.push(
        <CodeBlock key={i} lang={lang} code={codeLines.join("\n")}/>
      );
      i++; continue;
    }

    // Heading
    if (line.startsWith("### ")) {
      out.push(<p key={i} style={{ fontSize: 12, fontWeight: 600, color: V.textBri, margin: "10px 0 4px" }}>{line.slice(4)}</p>);
      i++; continue;
    }
    if (line.startsWith("## ")) {
      out.push(<p key={i} style={{ fontSize: 13, fontWeight: 600, color: V.textBri, margin: "12px 0 4px" }}>{line.slice(3)}</p>);
      i++; continue;
    }

    // Bullet
    if (line.match(/^[\*\-] /)) {
      out.push(
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 2 }}>
          <span style={{ color: V.textDim, fontSize: 11, marginTop: 2, flexShrink: 0 }}>•</span>
          <span style={{ fontSize: 13, lineHeight: 1.65, color: V.text }}>{inlineMarkdown(line.slice(2))}</span>
        </div>
      );
      i++; continue;
    }

    // Empty line = spacing
    if (line.trim() === "") {
      out.push(<div key={i} style={{ height: 6 }}/>);
      i++; continue;
    }

    // Normal paragraph
    out.push(
      <p key={i} style={{ fontSize: 13, lineHeight: 1.7, color: V.text, margin: "2px 0" }}>
        {inlineMarkdown(line)}
      </p>
    );
    i++;
  }
  return out;
}

/* inline: bold, code, italic */
function inlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i} style={{ color: V.textBri, fontWeight: 600 }}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`"))
      return <code key={i} style={{ background: "rgba(255,255,255,0.08)", color: "#ce9178",
        padding: "1px 4px", borderRadius: 3, fontSize: 12, fontFamily: "var(--font-mono)" }}>{p.slice(1, -1)}</code>;
    if (p.startsWith("*") && p.endsWith("*"))
      return <em key={i} style={{ color: V.textMid }}>{p.slice(1, -1)}</em>;
    return p;
  });
}

/* ── Code block ───────────────────────────────────────────────────────────── */
function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div style={{ position: "relative", margin: "8px 0", borderRadius: 4,
      border: `1px solid ${V.codeBdr}`, overflow: "hidden" }}>
      {/* header bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "4px 10px", background: "#252526", borderBottom: `1px solid ${V.codeBdr}` }}>
        <span style={{ fontSize: 11, color: V.textDim, fontFamily: "var(--font-mono)" }}>
          {lang || "code"}
        </span>
        <button onClick={copy}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11,
            color: copied ? V.green : V.textDim, padding: "1px 6px", borderRadius: 3,
            transition: "color 0.15s" }}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre style={{ margin: 0, padding: "10px 14px", background: V.code, overflowX: "auto",
        fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6, color: "#d4d4d4" }}
        className="ide-scroll">
        {code}
      </pre>
    </div>
  );
}

/* ── Tool/reasoning step row — VS Code "Used tool: X" style ─────────────── */
function StepRow({ step }: { step: ReasoningStep }) {
  const [open, setOpen] = useState(step.status === "running");

  useEffect(() => {
    if (step.status === "running") setOpen(true);
    if (step.status === "done")    setOpen(false);
  }, [step.status]);

  const hasContent = step.content.trim().length > 0;

  // Status icon
  const StatusDot = () => {
    if (step.status === "done") return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M3 8l3.5 3.5L13 4.5" stroke={V.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
    if (step.status === "running") return (
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        style={{ width: 12, height: 12, borderRadius: "50%",
          border: `1.5px solid rgba(14,125,212,0.25)`, borderTopColor: V.blue }}/>
    );
    if (step.status === "failed") return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M4 4l8 8M12 4l-8 8" stroke={V.red} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    );
    return <div style={{ width: 12, height: 12, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.2)" }}/>;
  };

  return (
    <div style={{ fontFamily: "var(--font-sans)" }}>
      {/* Row header — "Used tool: X" style */}
      <div onClick={() => hasContent && setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "5px 16px",
          cursor: hasContent ? "pointer" : "default",
          background: open && hasContent ? "rgba(255,255,255,0.03)" : "transparent",
          transition: "background 0.1s",
        }}
        onMouseOver={e => { if (hasContent) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
        onMouseOut={e  => { e.currentTarget.style.background = open && hasContent ? "rgba(255,255,255,0.03)" : "transparent"; }}>

        <StatusDot/>

        <span style={{ fontSize: 12, color: step.status === "running" ? V.textBri : V.textMid,
          fontWeight: step.status === "running" ? 500 : 400, flex: 1 }}>
          {step.label}
          {step.streaming && (
            <motion.span style={{ color: V.blue, marginLeft: 5, fontSize: 11 }}
              animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.1, repeat: Infinity }}>
              …
            </motion.span>
          )}
        </span>

        {hasContent && (
          <motion.svg animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.13 }}
            width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={V.textDim} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4"/>
          </motion.svg>
        )}
      </div>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {open && hasContent && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.16, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}>
            <div style={{ margin: "0 16px 6px 34px", padding: "8px 12px",
              background: V.toolBg, border: `1px solid ${V.toolBdr}`,
              borderRadius: 4, fontSize: 12, lineHeight: 1.7,
              color: V.textMid, whiteSpace: "pre-wrap",
              fontFamily: "var(--font-sans)", maxHeight: 240, overflowY: "auto" }}
              className="ide-scroll">
              {step.content}
              {step.streaming && (
                <span style={{ display: "inline-block", width: 6, height: 12,
                  background: V.blue, marginLeft: 2, verticalAlign: "text-bottom",
                  animation: "blink 1s step-end infinite" }}/>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Chat turn (VS Code flat style, no bubbles) ───────────────────────────── */
function ChatTurn({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ padding: "12px 16px", borderTop: `1px solid ${V.sep}` }}>
      {/* Role label — "You" or "WireUp" */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        {!isUser && (
          <div style={{ width: 16, height: 16, borderRadius: "50%",
            background: "linear-gradient(135deg,#0e7dd4,#4ec9b0)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
            W
          </div>
        )}
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
          textTransform: "uppercase", color: isUser ? V.textDim : "#0e7dd4",
          fontFamily: "var(--font-sans)" }}>
          {isUser ? "You" : "WireUp"}
        </span>
        {msg.model && !isUser && (
          <span style={{ fontSize: 10, color: V.textDim, marginLeft: 2 }}>
            · {msg.model}
          </span>
        )}
      </div>

      {/* Message content — rendered markdown, not raw */}
      <div style={{ fontSize: 13, lineHeight: 1.7, color: isUser ? V.textBri : V.text,
        fontFamily: "var(--font-sans)" }}>
        {msg.images && msg.images.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {msg.images.map((img, idx) => (
              <img
                key={idx}
                src={img}
                style={{
                  maxWidth: "100%",
                  maxHeight: 180,
                  borderRadius: 4,
                  border: `1px solid ${V.inputBdr}`,
                  objectFit: "contain",
                }}
              />
            ))}
          </div>
        )}
        {isUser ? (
          <p style={{ margin: 0, color: V.textBri, fontSize: 13, lineHeight: 1.7 }}>{msg.content}</p>
        ) : msg.streaming && !msg.content ? (
          /* ── Loading state: animated typing dots + shimmer lines ── */
          <div>
            {/* Bouncing dots */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
              {[0, 0.15, 0.30].map((d, i) => (
                <motion.div key={i}
                  style={{ width: 7, height: 7, borderRadius: "50%", background: V.blue }}
                  animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.7, repeat: Infinity, delay: d, ease: "easeInOut" }}/>
              ))}
              <span style={{ fontSize: 11, color: V.textDim, marginLeft: 4, fontStyle: "italic" }}>
                Thinking…
              </span>
            </div>
            {/* Shimmer skeleton lines */}
            {[100, 80, 92, 60].map((w, i) => (
              <motion.div key={i}
                style={{
                  height: 11, borderRadius: 4,
                  width: `${w}%`, marginBottom: i < 3 ? 7 : 0,
                  background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 100%)",
                  backgroundSize: "200% 100%",
                }}
                animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "linear", delay: i * 0.1 }}/>
            ))}
          </div>
        ) : (
          <>
            {renderMarkdown(msg.content)}
            {msg.streaming && msg.content && (
              <span style={{ display: "inline-block", width: 6, height: 13,
                background: V.blue, marginLeft: 2, verticalAlign: "text-bottom",
                animation: "blink 1s step-end infinite" }}/>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Summary turn (inline, looks like an AI response) ────────────────────── */
function SummaryTurn({ summary }: { summary: string }) {
  const [expanded, setExpanded] = useState(true);

  // Parse into sections and flatten to a clean readable summary
  const sections = summary
    .split(/\n\n(?=\*\*)/)
    .map(block => {
      const m = block.match(/^\*\*(.+?)\*\*\n?/);
      if (!m) return null;
      return {
        label: m[1],
        content: block.slice(m[0].length).trim()
          .replace(/^\* /gm, "• ").replace(/\*\*/g, "").trim(),
      };
    })
    .filter(Boolean) as Array<{ label: string; content: string }>;

  if (!summary) return null;

  return (
    <div style={{ padding: "12px 16px", borderTop: `1px solid ${V.sep}` }}>
      {/* Role label */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%",
          background: "linear-gradient(135deg,#0e7dd4,#4ec9b0)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
          W
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
          textTransform: "uppercase", color: "#0e7dd4", fontFamily: "var(--font-sans)" }}>
          WireUp
        </span>
        <button onClick={() => setExpanded(v => !v)}
          style={{ marginLeft: "auto", fontSize: 11, color: V.textDim, background: "none",
            border: "none", cursor: "pointer", padding: "1px 4px" }}>
          {expanded ? "collapse" : "expand"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}>
            {sections.length > 0
              ? sections.map((s, i) => (
                  <div key={i} style={{ marginBottom: i < sections.length - 1 ? 12 : 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                      letterSpacing: "0.06em", color: V.textDim, marginBottom: 4 }}>
                      {s.label}
                    </p>
                    <p style={{ fontSize: 13, lineHeight: 1.7, color: V.text, margin: 0,
                      whiteSpace: "pre-wrap" }}>
                      {s.content}
                    </p>
                  </div>
                ))
              : <p style={{ fontSize: 13, lineHeight: 1.7, color: V.text, margin: 0,
                  whiteSpace: "pre-wrap" }}>
                  {summary.replace(/\*\*/g, "").replace(/^\* /gm, "• ")}
                </p>
            }
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Model selector pill — uses fixed positioning to escape panel overflow ── */
function ModelPill({ value, options, onChange }: {
  value: string;
  options: Array<{ key: string; sub: string; group?: string }>;
  onChange: (k: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect]  = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      setRect(btnRef.current.getBoundingClientRect());
    }
    setOpen(v => !v);
  };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(t) &&
        btnRef.current  && !btnRef.current.contains(t)
      ) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <>
      <button ref={btnRef} onClick={handleToggle}
        style={{ display: "flex", alignItems: "center", gap: 4,
          padding: "3px 8px", background: "transparent",
          border: `1px solid ${open ? V.blue : V.inputBdr}`, borderRadius: 12,
          color: open ? V.text : V.textDim, fontSize: 11, cursor: "pointer",
          fontFamily: "var(--font-sans)", transition: "border-color 0.15s, color 0.15s" }}
        onMouseOver={e => { e.currentTarget.style.borderColor = V.blue; e.currentTarget.style.color = V.text; }}
        onMouseOut={e  => {
          if (!open) { e.currentTarget.style.borderColor = V.inputBdr; e.currentTarget.style.color = V.textDim; }
        }}>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" d="M2 4h12M4 8h8M6 12h4"/>
        </svg>
        {value}
        <motion.svg animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.13 }}
          width="7" height="7" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" d="M4 6l4 4 4-4"/>
        </motion.svg>
      </button>

      {/* Fixed-position dropdown — completely escapes panel overflow:hidden */}
      <AnimatePresence>
        {open && rect && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.1 }}
            style={{
              position: "fixed",
              /* Open upward — bottom of dropdown aligns with top of button */
              bottom: window.innerHeight - rect.top + 4,
              left: rect.left,
              background: "#2d2d2d",
              border: "1px solid #505050",
              borderRadius: 6,
              overflow: "hidden",
              minWidth: Math.max(220, rect.width),
              boxShadow: "0 -4px 20px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.4)",
              zIndex: 99999,
            }}>
            <div style={{ padding: "8px 0", maxHeight: 380, overflowY: "auto" }} className="ide-scroll">
              {/* Title Header */}
              <div style={{ padding: "4px 14px", fontSize: 11, fontWeight: 600, color: V.textBri, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                WireUp Models
              </div>
              
              <div style={{ height: 1, background: V.sep, margin: "6px 14px 10px 14px" }} />

              {["Recommended", "Reasoning Models", "Fast Models"].map((groupName, gIdx) => {
                const groupModels = options.filter(m => m.group === groupName);
                if (groupModels.length === 0) return null;
                
                return (
                  <div key={groupName} style={{ marginTop: gIdx > 0 ? 12 : 0, marginBottom: 4 }}>
                    {/* Group Title */}
                    <div style={{ padding: "4px 14px", fontSize: 10, fontWeight: 700, color: "#60b8f9", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {groupName}
                    </div>
                    
                    {/* Group Options */}
                    {groupModels.map(m => {
                      const isActive = m.key === value;
                      return (
                        <button key={m.key} onClick={() => { onChange(m.key); setOpen(false); }}
                          style={{ width:"100%", display:"flex", flexDirection:"column",
                            padding:"6px 14px 6px 20px", background: isActive ? "rgba(14,125,212,0.18)" : "transparent",
                            border:"none", cursor:"pointer", textAlign:"left", transition:"background 0.1s" }}
                          onMouseOver={e => { if (!isActive) e.currentTarget.style.background="rgba(255,255,255,0.05)"; }}
                          onMouseOut={e  => { e.currentTarget.style.background = isActive ? "rgba(14,125,212,0.18)" : "transparent"; }}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,width:"100%"}}>
                            <span style={{ fontSize:12, fontWeight:500, color: isActive ? "#60b8f9" : V.textBri }}>
                              {m.key}
                            </span>
                            {isActive && (
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#60b8f9" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l4 4 6-6"/>
                              </svg>
                            )}
                          </div>
                          <span style={{ fontSize:10, color:V.textDim, marginTop:2, fontFamily:"var(--font-sans)", lineHeight: "1.3" }}>
                            {m.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PANEL
═══════════════════════════════════════════════════════════════════════════ */
function compressImage(base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
}

export function AIReasoningPanel({
  projectTitle, steps, messages, summary,
  chatInput, chatBusy, pipelineDone, pipelineActive, pipelinePct,
  model, onChatInput, onSend, onStop, onNewChat, onModelChange, modelOptions,
}: Props) {
  const chatEndRef  = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stepsOpen, setStepsOpen] = useState(true);
  const [attachments, setAttachments] = useState<string[]>([]);

  /* Whisper mic recorder — appends transcript to chat input */
  const { isRecording, isTranscribing, toggleRecording } = useMicRecorder(
    (transcript) => onChatInput(chatInput ? `${chatInput} ${transcript}` : transcript)
  );

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, summary]);

  // Auto-collapse steps once pipeline done (with delay like VS Code)
  useEffect(() => {
    if (pipelineDone) {
      const t = setTimeout(() => setStepsOpen(false), 1400);
      return () => clearTimeout(t);
    }
  }, [pipelineDone]);

  const processFiles = async (files: FileList) => {
    const newAttachments: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      const rawBase64 = await base64Promise;
      const compressed = await compressImage(rawBase64);
      newAttachments.push(compressed);
    }
    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      processFiles(e.clipboardData.files);
    }
  };

  const handleSend = () => {
    if (chatBusy) {
      onStop();
    } else {
      onSend(attachments);
      setAttachments([]);
    }
  };

  const completedN = steps.filter(s => s.status === "done").length;
  const pct = pipelinePct || (steps.length ? Math.round(completedN / steps.length * 100) : 0);
  const hasActive = steps.some(s => s.status === "running");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%",
      background: V.bg, fontFamily: "var(--font-sans)" }}>

      {/* ── Header — VS Code "Chat" panel title bar ──────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", height: 35, flexShrink: 0,
        padding: "0 8px 0 12px",
        borderBottom: `1px solid ${V.sep}`, background: "#252526",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
          {/* VS Code copilot-style icon */}
          <div style={{ width: 15, height: 15, borderRadius: "50%",
            background: "linear-gradient(135deg,#0e7dd4,#4ec9b0)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
            W
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: V.textBri }}>
            WireUp AI
          </span>
          {hasActive && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 6 }}>
              <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: "50%", background: V.blue }}/>
              <span style={{ fontSize: 11, color: V.blue }}>Thinking…</span>
            </div>
          )}
          {pipelineDone && (
            <span style={{ fontSize: 11, color: V.green, marginLeft: 6 }}>● Done</span>
          )}
        </div>
        {/* New chat button */}
        <button onClick={onNewChat}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "3px 6px",
            color: V.textDim, fontSize: 11, borderRadius: 3, transition: "background 0.1s, color 0.1s" }}
          title="New chat"
          onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = V.text; }}
          onMouseOut={e  => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = V.textDim; }}>
          New chat
        </button>
      </div>

      {/* ── 1. Chat turns (scrollable, FLEX:1) ───────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}
        className="ide-scroll">

        {/* Empty state — VS Code "Ask anything" */}
        {messages.length === 0 && !pipelineActive && !pipelineDone && (
          <div style={{ padding: "32px 16px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: V.textDim }}>
              Ask anything about your project, or wait for the analysis to complete.
            </p>
          </div>
        )}

        {/* Chat messages — with summary injected after the first user message */}
        {messages.map((m, i) => {
          // Find the index of the first real user message (not thinking placeholder)
          const firstUserIdx = messages.findIndex(x => x.role === "user" && x.id !== "thinking-init");
          return (
            <div key={m.id}>
              <ChatTurn msg={m}/>
              {/* Summary appears immediately after the first real user message */}
              {pipelineDone && summary && i === firstUserIdx && (
                <SummaryTurn summary={summary}/>
              )}
            </div>
          );
        })}

        {/* If no messages yet but pipeline done, show summary */}
        {pipelineDone && summary && messages.length === 0 && (
          <SummaryTurn summary={summary}/>
        )}

        {/* Typing indicator is now handled inline inside ChatTurn when content="" && streaming */}

        <div ref={chatEndRef}/>
      </div>

      {/* ── 2. Input area — VS Code flat style ─────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: "8px 8px 6px",
        borderTop: `1px solid ${V.sep}`, background: V.bg }}>
        <div style={{
          border: `1px solid ${V.inputBdr}`, borderRadius: 6,
          background: V.input, overflow: "hidden",
          transition: "border-color 0.15s",
        }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = V.blue)}
          onBlurCapture={e  => (e.currentTarget.style.borderColor = V.inputBdr)}>

          {/* Attachment Previews */}
          {attachments.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "8px 10px 4px", borderBottom: `1px solid ${V.sep}` }}>
              {attachments.map((src, idx) => (
                <div key={idx} style={{ position: "relative", width: 44, height: 44, borderRadius: 4, overflow: "hidden", border: `1px solid ${V.inputBdr}` }}>
                  <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button
                    type="button"
                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                    style={{
                      position: "absolute", top: 1, right: 1, width: 14, height: 14, borderRadius: "50%",
                      background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, padding: 0
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={inputRef}
            value={chatInput}
            onChange={e => {
              onChatInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
            }}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            onPaste={handlePaste}
            placeholder={isRecording ? "Listening… speak now" : isTranscribing ? "Transcribing…" : pipelineDone ? "Ask WireUp AI…" : "AI is generating…"}
            disabled={chatBusy && !pipelineDone}            rows={1}
            style={{
              width: "100%", resize: "none", outline: "none", border: "none",
              background: "transparent", color: V.textBri, fontFamily: "var(--font-sans)",
              fontSize: 13, lineHeight: 1.5, padding: "8px 10px",
              maxHeight: 100, caretColor: V.blue,
              opacity: (chatBusy && !pipelineDone) ? 0.4 : 1,
            }}
            className="ide-scroll"
          />

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          {/* Toolbar row — model pill + icons + send */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "4px 8px 6px", gap: 6 }}>
            <ModelPill value={model} options={modelOptions} onChange={onModelChange}/>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {/* Attach */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ background: "none", border: "none", cursor: "pointer",
                  color: V.textDim, padding: "3px 4px", borderRadius: 3, display: "flex",
                  alignItems: "center", transition: "color 0.1s" }}
                onMouseOver={e => (e.currentTarget.style.color = V.text)}
                onMouseOut={e  => (e.currentTarget.style.color = V.textDim)}
                title="Attach file">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32"/>
                </svg>
              </button>

              {/* Mic button — Whisper STT */}
              <button
                onClick={toggleRecording}
                disabled={isTranscribing}
                title={isRecording ? "Stop recording" : isTranscribing ? "Transcribing…" : "Voice input"}
                style={{
                  background: isRecording ? "rgba(239,68,68,0.15)" : "none",
                  border: isRecording ? "1px solid rgba(239,68,68,0.35)" : "none",
                  cursor: isTranscribing ? "not-allowed" : "pointer",
                  color: isRecording ? "#ef4444" : isTranscribing ? V.blue : V.textDim,
                  padding: "3px 4px", borderRadius: 3, display: "flex",
                  alignItems: "center", transition: "color 0.15s, background 0.15s",
                }}
                onMouseOver={e => { if (!isRecording && !isTranscribing) e.currentTarget.style.color = V.text; }}
                onMouseOut={e  => { if (!isRecording && !isTranscribing) e.currentTarget.style.color = V.textDim; }}>
                {isTranscribing ? (
                  /* Transcribing spinner */
                  <motion.div
                    animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    style={{ width: 14, height: 14, borderRadius: "50%",
                      border: `1.5px solid rgba(14,125,212,0.25)`, borderTopColor: V.blue }}/>
                ) : isRecording ? (
                  /* Recording — pulsing red mic */
                  <motion.svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"
                    animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                    <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
                  </motion.svg>
                ) : (
                  /* Idle mic */
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
                  </svg>
                )}
              </button>

              {/* Send / Stop */}
              <button onClick={handleSend}
                disabled={!chatInput.trim() && !attachments.length && !chatBusy}
                style={{
                  width: 26, height: 26, borderRadius: 4, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  background: chatBusy ? V.red : (chatInput.trim() || attachments.length) ? V.blue : "transparent",
                  color: (chatInput.trim() || attachments.length || chatBusy) ? "#fff" : V.textDim,
                  border: (chatInput.trim() || attachments.length || chatBusy) ? "none" : `1px solid ${V.inputBdr}`,
                  cursor: (chatInput.trim() || attachments.length || chatBusy) ? "pointer" : "not-allowed",
                  transition: "background 0.15s",
                }}>
                {chatBusy
                  ? <svg width="9" height="9" fill="currentColor" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
                  : <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7"/></svg>
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Reasoning steps — BOTTOM, collapsible like "View Tool Calls" ── */}
      {steps.length > 0 && (
        <div style={{ flexShrink: 0, borderTop: `1px solid ${V.sep}`, background: "#252526" }}>
          {/* Toggle header */}
          <button onClick={() => setStepsOpen(v => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 6,
              padding: "7px 12px", background: "transparent", border: "none",
              cursor: "pointer", textAlign: "left" }}
            onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            onMouseOut={e  => (e.currentTarget.style.background = "transparent")}>
            <motion.svg animate={{ rotate: stepsOpen ? 0 : -90 }} transition={{ duration: 0.13 }}
              width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={V.textDim} strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4"/>
            </motion.svg>
            <span style={{ fontSize: 11, color: V.textDim, flex: 1 }}>
              {stepsOpen
                ? `Analysis steps (${completedN}/${steps.length})`
                : `${steps.length} steps${pipelineDone ? " · complete" : ""}`}
            </span>
            {/* Progress inline in header */}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 44, height: 2, background: "rgba(255,255,255,0.1)",
                overflow: "hidden", borderRadius: 1 }}>
                <motion.div style={{ height: "100%", borderRadius: 1,
                  background: pipelineDone ? V.green : V.blue }}
                  animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }}/>
              </div>
              <span style={{ fontSize: 10, color: pipelineDone ? V.green : V.textDim, fontWeight: 500 }}>
                {pct}%
              </span>
            </div>
          </button>

          {/* Steps */}
          <AnimatePresence initial={false}>
            {stepsOpen && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}>
                <div style={{ maxHeight: 260, overflowY: "auto", paddingBottom: 4 }}
                  className="ide-scroll">
                  {steps.map(step => <StepRow key={step.id} step={step}/>)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
