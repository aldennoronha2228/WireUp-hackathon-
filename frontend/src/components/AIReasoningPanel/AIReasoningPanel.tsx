/**
 * WireUp AI Reasoning Panel — VS Code / Cursor style
 *
 * Structure (top → bottom):
 *   1. Header (agent status dot + title + New chat)
 *   2. Progress bar (while running)
 *   3. Reasoning steps — each is a collapsible accordion row
 *        - spinner while running, check when done
 *        - content auto-streams inside while active
 *        - auto-collapses on completion (click chevron to re-expand)
 *   4. Final summary card — shown once pipeline_done fires
 *   5. Chat messages — user/assistant bubbles
 *   6. Chat input + model selector
 */

import {
  useState, useRef, useEffect, useCallback, type KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ── palette ──────────────────────────────────────────────────────────────── */
const C = {
  bg:      "#1e1e1e",
  panel:   "#252526",
  surf:    "#2d2d2d",
  border:  "rgba(255,255,255,0.07)",
  borderA: "rgba(255,255,255,0.13)",
  text:    "#cccccc",
  textBri: "#ffffff",
  textDim: "#6e7280",
  textMid: "#9ea3b0",
  blue:    "#007acc",
  blueD:   "rgba(0,122,204,0.14)",
  blueHi:  "rgba(0,122,204,0.24)",
  green:   "#4ec9b0",
  amber:   "#f59e0b",
  red:     "#f44747",
};

/* ── Types ────────────────────────────────────────────────────────────────── */
export type StepStatus = "pending" | "running" | "done" | "failed";

export interface ReasoningStep {
  id:        string;
  label:     string;
  status:    StepStatus;
  content:   string;
  streaming: boolean;
  icon?:     "think" | "search" | "write" | "tool" | "build" | "check";
}

export interface ChatMessage {
  id:        string;
  role:      "user" | "assistant";
  content:   string;
  streaming: boolean;
  model?:    string;
}

interface Props {
  projectTitle:   string;
  steps:          ReasoningStep[];
  messages:       ChatMessage[];
  summary:        string;        // final summary shown after pipeline_done
  chatInput:      string;
  chatBusy:       boolean;
  pipelineDone:   boolean;
  pipelineActive: boolean;
  pipelinePct:    number;
  model:          string;
  onChatInput:    (v: string) => void;
  onSend:         () => void;
  onStop:         () => void;
  onNewChat:      () => void;
  onModelChange:  (m: string) => void;
  modelOptions:   Array<{ key: string; sub: string }>;
}

/* ── Status icon (VS Code style) ─────────────────────────────────────────── */
function StatusIcon({ status, size = 15 }: { status: StepStatus; size?: number }) {
  if (status === "done") return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" fill={C.green} fillOpacity=".15" stroke={C.green} strokeWidth="1.3"/>
      <path d="M5 8.5l2 2 4-4" stroke={C.green} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (status === "running") return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
      style={{ width: size, height: size, borderRadius: "50%",
        border: `1.5px solid rgba(0,122,204,0.22)`, borderTopColor: C.blue }}
    />
  );
  if (status === "failed") return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" fill={C.red} fillOpacity=".12" stroke={C.red} strokeWidth="1.3"/>
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke={C.red} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
  return (
    <div style={{ width: size, height: size, borderRadius: "50%",
      border: `1.5px solid rgba(255,255,255,0.16)` }}/>
  );
}

/* ── Step type icon ───────────────────────────────────────────────────────── */
function TypeIcon({ type }: { type?: ReasoningStep["icon"] }) {
  const s = 11, col = C.textDim;
  switch (type) {
    case "think":  return <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={col} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>;
    case "search": return <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={col} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>;
    case "write":  return <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={col} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>;
    case "tool":   return <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={col} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"/></svg>;
    case "build":  return <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={col} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z"/></svg>;
    default:       return <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={col} strokeWidth={1.8}><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M12 8v4l2.5 2.5"/></svg>;
  }
}

/* ── Single reasoning step accordion ─────────────────────────────────────── */
function StepRow({ step, isLast }: { step: ReasoningStep; isLast: boolean }) {
  // VS Code behaviour: expand while running, auto-collapse when done
  const [open, setOpen] = useState(step.status === "running");

  useEffect(() => {
    if (step.status === "running") setOpen(true);
    if (step.status === "done")    setOpen(false);  // auto-collapse
  }, [step.status]);

  const hasContent = step.content.trim().length > 0;
  const canToggle  = hasContent || step.status === "running";

  return (
    <div style={{ position: "relative" }}>
      {/* connector line */}
      {!isLast && (
        <div style={{
          position: "absolute", left: 19, top: 30, bottom: 0, width: 1,
          background: step.status === "done"
            ? `rgba(78,201,176,0.18)`
            : "rgba(255,255,255,0.05)",
          zIndex: 0,
        }}/>
      )}

      {/* Row header */}
      <div
        onClick={() => canToggle && setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 12px 6px 10px",
          cursor: canToggle ? "pointer" : "default",
          borderRadius: 4,
          background: step.status === "running"
            ? "rgba(0,122,204,0.10)"
            : open && hasContent ? "rgba(255,255,255,0.03)" : "transparent",
          position: "relative", zIndex: 1,
          transition: "background 0.15s",
        }}
        onMouseOver={e => {
          if (canToggle && step.status !== "running")
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseOut={e => {
          e.currentTarget.style.background =
            step.status === "running" ? "rgba(0,122,204,0.10)"
            : open && hasContent ? "rgba(255,255,255,0.03)" : "transparent";
        }}
      >
        {/* Status icon */}
        <div style={{ flexShrink: 0, width: 19, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <StatusIcon status={step.status}/>
        </div>

        {/* Type icon */}
        <div style={{ flexShrink: 0, opacity: 0.55 }}>
          <TypeIcon type={step.icon}/>
        </div>

        {/* Label */}
        <span style={{
          flex: 1, fontSize: 12,
          color: step.status === "running" ? C.textBri
               : step.status === "done"    ? C.textMid
               : C.textDim,
          fontWeight: step.status === "running" ? 500 : 400,
          fontFamily: "var(--font-sans)",
        }}>
          {step.label}
          {step.streaming && (
            <motion.span
              style={{ display: "inline-block", marginLeft: 6, color: C.blue, fontSize: 11 }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity }}>
              …
            </motion.span>
          )}
        </span>

        {/* Chevron — only if has content */}
        {hasContent && (
          <motion.svg
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.15 }}
            width="10" height="10" viewBox="0 0 16 16" fill="none"
            stroke={C.textDim} strokeWidth={2}
            style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4"/>
          </motion.svg>
        )}
      </div>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {open && hasContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              margin: "2px 10px 6px 38px",
              padding: "8px 10px",
              borderRadius: 4,
              background: "rgba(255,255,255,0.025)",
              border: `1px solid ${C.border}`,
              fontSize: 12, lineHeight: 1.7,
              color: C.textMid,
              fontFamily: "var(--font-sans)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 260,
              overflowY: "auto",
            }}
              className="ide-scroll">
              {step.content}
              {step.streaming && (
                <span style={{
                  display: "inline-block", width: 6, height: 12,
                  background: C.blue, marginLeft: 2,
                  verticalAlign: "text-bottom",
                  animation: "blink 1s step-end infinite",
                }}/>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Final summary card — clean, minimal ─────────────────────────────────── */
function SummaryCard({ summary }: { summary: string }) {
  const [open, setOpen] = useState(true);
  if (!summary) return null;

  // Parse "**Label**\ncontent" blocks into clean sections
  const sections = summary
    .split(/\n\n(?=\*\*)/)
    .map(block => {
      const labelMatch = block.match(/^\*\*(.+?)\*\*\n?/);
      if (labelMatch) {
        const label   = labelMatch[1];
        const content = block.slice(labelMatch[0].length).trim();
        // Strip markdown bullets, asterisks, extra whitespace
        const cleaned = content
          .replace(/^\* /gm, "• ")
          .replace(/\*\*/g, "")
          .replace(/^- /gm, "• ")
          .trim();
        return { label, content: cleaned };
      }
      return null;
    })
    .filter(Boolean) as Array<{ label: string; content: string }>;

  return (
    <div style={{ margin: "0 10px", borderRadius: 4, overflow: "hidden" }}>
      {/* Minimal header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 7,
          padding: "7px 10px", background: "rgba(255,255,255,0.04)",
          border: `1px solid ${C.border}`, borderRadius: open ? "4px 4px 0 0" : 4,
          cursor: "pointer", textAlign: "left",
        }}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" fill={C.green} fillOpacity=".15" stroke={C.green} strokeWidth="1.3"/>
          <path d="M5 8.5l2 2 4-4" stroke={C.green} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: C.green }}>
          Analysis ready
        </span>
        <span style={{ fontSize: 10, color: C.textDim }}>
          {open ? "collapse" : "expand"}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            transition={{ duration: 0.16, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}>
            <div style={{
              border: `1px solid ${C.border}`, borderTop: "none",
              borderRadius: "0 0 4px 4px",
              maxHeight: 320, overflowY: "auto",
            }} className="ide-scroll">
              {sections.length > 0 ? sections.map((s, i) => (
                <div key={i} style={{
                  padding: "8px 12px",
                  borderTop: i > 0 ? `1px solid rgba(255,255,255,0.04)` : "none",
                }}>
                  <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.07em",
                    textTransform: "uppercase", color: C.textDim, marginBottom: 4 }}>
                    {s.label}
                  </p>
                  <p style={{ fontSize: 12, lineHeight: 1.65, color: C.textMid,
                    whiteSpace: "pre-wrap", fontFamily: "var(--font-sans)" }}>
                    {s.content}
                  </p>
                </div>
              )) : (
                <div style={{ padding: "10px 12px" }}>
                  <p style={{ fontSize: 12, lineHeight: 1.65, color: C.textMid,
                    whiteSpace: "pre-wrap", fontFamily: "var(--font-sans)" }}>
                    {summary.replace(/\*\*/g, "").replace(/^\* /gm, "• ")}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Chat bubble ──────────────────────────────────────────────────────────── */
function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "0 10px" }}>
      <span style={{
        fontSize: 10, color: C.textDim,
        textAlign: isUser ? "right" : "left",
        textTransform: "uppercase", letterSpacing: "0.06em",
        fontFamily: "var(--font-sans)",
      }}>
        {isUser ? "You" : msg.model ? `WireUp · ${msg.model}` : "WireUp AI"}
      </span>
      <div style={{
        padding: "9px 12px",
        borderRadius: isUser ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
        background: isUser ? "rgba(0,122,204,0.18)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${isUser ? "rgba(0,122,204,0.30)" : C.border}`,
        fontSize: 13, lineHeight: 1.7,
        color: isUser ? C.textBri : C.text,
        fontFamily: "var(--font-sans)",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "92%",
      }}>
        {msg.content}
        {msg.streaming && (
          <span style={{
            display: "inline-block", width: 6, height: 13,
            background: C.blue, marginLeft: 2,
            verticalAlign: "text-bottom",
            animation: "blink 1s step-end infinite",
          }}/>
        )}
      </div>
    </div>
  );
}

/* ── Model picker ─────────────────────────────────────────────────────────── */
function ModelPicker({ value, options, onChange }: {
  value: string;
  options: Array<{ key: string; sub: string }>;
  onChange: (k: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "3px 8px", background: C.bg,
          border: `1px solid ${C.border}`, borderRadius: 3,
          color: C.textMid, fontSize: 11, cursor: "pointer",
          fontFamily: "var(--font-sans)",
        }}>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" d="M2 4h12M4 8h8M6 12h4"/>
        </svg>
        {value}
        <motion.svg animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.12 }}
          width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" d="M4 6l4 4 4-4"/>
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.1 }}
            style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0,
              background: C.panel, border: `1px solid ${C.borderA}`,
              borderRadius: 5, overflow: "hidden", minWidth: 210,
              boxShadow: "0 8px 24px rgba(0,0,0,0.6)", zIndex: 300,
            }}>
            {options.map(m => (
              <button key={m.key} onClick={() => { onChange(m.key); setOpen(false); }}
                style={{
                  width: "100%", display: "flex", flexDirection: "column",
                  padding: "8px 12px", border: "none", cursor: "pointer",
                  textAlign: "left", transition: "background 0.1s",
                  background: m.key === value ? C.blueD : "transparent",
                }}
                onMouseOver={e => { if (m.key !== value) e.currentTarget.style.background = C.surf; }}
                onMouseOut={e  => { e.currentTarget.style.background = m.key === value ? C.blueD : "transparent"; }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: m.key === value ? C.blue : C.textBri }}>
                    {m.key}
                  </span>
                  {m.key === value && (
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={C.blue} strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l4 4 6-6"/>
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: 10, color: C.textDim, marginTop: 1, fontFamily: "var(--font-mono)" }}>
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
   MAIN PANEL
═══════════════════════════════════════════════════════════════════════════ */
export function AIReasoningPanel({
  projectTitle, steps, messages, summary,
  chatInput, chatBusy, pipelineDone, pipelineActive, pipelinePct,
  model, onChatInput, onSend, onStop, onNewChat, onModelChange, modelOptions,
}: Props) {
  const chatEndRef  = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const [reasoningCollapsed, setReasoningCollapsed] = useState(false);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Auto-collapse the whole reasoning section once pipeline is done
  useEffect(() => {
    if (pipelineDone) {
      const t = setTimeout(() => setReasoningCollapsed(true), 1200);
      return () => clearTimeout(t);
    }
  }, [pipelineDone]);

  const completedN = steps.filter(s => s.status === "done").length;
  const pct        = pipelinePct || (steps.length ? Math.round(completedN / steps.length * 100) : 0);
  const hasActive  = steps.some(s => s.status === "running");

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: C.bg, fontFamily: "var(--font-sans)",
    }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 36, flexShrink: 0, padding: "0 12px",
        background: C.panel, borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {/* Status dot */}
          {hasActive ? (
            <motion.div
              animate={{ scale: [1, 1.35, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              style={{ width: 7, height: 7, borderRadius: "50%", background: C.blue }}/>
          ) : pipelineDone ? (
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green }}/>
          ) : (
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }}/>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textBri }}>
            {hasActive ? "Thinking…" : pipelineDone ? "Done" : "WireUp AI"}
          </span>
        </div>

        <button onClick={onNewChat}
          style={{
            fontSize: 11, color: C.textDim, background: "none",
            border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 3,
          }}
          onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = C.text; }}
          onMouseOut={e  => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = C.textDim; }}>
          New chat
        </button>
      </div>

      {/* ── Progress bar ────────────────────────────────────────────────── */}
      {steps.length > 0 && !reasoningCollapsed && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 12px", flexShrink: 0,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ flex: 1, height: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden", borderRadius: 1 }}>
            <motion.div
              style={{ height: "100%", background: pipelineDone ? C.green : C.blue, borderRadius: 1 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4 }}/>
          </div>
          <span style={{ fontSize: 10, color: pipelineDone ? C.green : C.textMid, flexShrink: 0, fontWeight: 500 }}>
            {pct}%
          </span>
        </div>
      )}

      {/* ── Reasoning steps section ──────────────────────────────────────── */}
      {steps.length > 0 && (
        <div style={{ flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
          {/* Section toggle header — VS Code "used X tools" style */}
          <button
            onClick={() => setReasoningCollapsed(v => !v)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", background: "transparent", border: "none",
              cursor: "pointer", textAlign: "left",
            }}
            onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            onMouseOut={e  => (e.currentTarget.style.background = "transparent")}
          >
            <motion.svg
              animate={{ rotate: reasoningCollapsed ? -90 : 0 }}
              transition={{ duration: 0.15 }}
              width="10" height="10" viewBox="0 0 16 16" fill="none"
              stroke={C.textDim} strokeWidth={2} style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4"/>
            </motion.svg>
            <span style={{ fontSize: 11, color: C.textDim }}>
              {reasoningCollapsed
                ? `${steps.length} analysis steps ${pipelineDone ? "· complete" : ""}`
                : `Analysis steps (${completedN}/${steps.length})`}
            </span>
            {pipelineDone && (
              <span style={{
                marginLeft: "auto", fontSize: 10, color: C.green,
                background: "rgba(78,201,176,0.12)", padding: "1px 6px",
                borderRadius: 3,
              }}>
                ✓ Complete
              </span>
            )}
          </button>

          {/* Steps list */}
          <AnimatePresence initial={false}>
            {!reasoningCollapsed && (
              <motion.div
                initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}>
                <div style={{ paddingBottom: 6 }}>
                  {steps.map((step, i) => (
                    <StepRow key={step.id} step={step} isLast={i === steps.length - 1}/>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Messages + summary ───────────────────────────────────────────── */}
      <div
        style={{
          flex: 1, overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 10,
          padding: "10px 0 6px",
        }}
        className="ide-scroll">

        {/* User messages first */}
        {messages.map(m => <Bubble key={m.id} msg={m}/>)}

        {/* Summary — appears AFTER user message, once pipeline done */}
        {pipelineDone && summary && (
          <SummaryCard summary={summary}/>
        )}

        {/* "Thinking" dots for follow-up chat */}
        {chatBusy && messages[messages.length - 1]?.role !== "assistant" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px" }}>
            <div style={{
              display: "flex", gap: 4, padding: "8px 12px", borderRadius: 8,
              background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
            }}>
              {[0, 0.2, 0.4].map((d, i) => (
                <motion.span key={i}
                  style={{ width: 5, height: 5, borderRadius: "50%", background: C.blue, display: "block" }}
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                  transition={{ duration: 0.85, repeat: Infinity, delay: d }}/>
              ))}
            </div>
            <span style={{ fontSize: 11, color: C.textDim, fontStyle: "italic" }}>
              WireUp AI is thinking…
            </span>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !pipelineActive && !pipelineDone && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 10, paddingTop: 28, textAlign: "center",
          }}>
            <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke={C.textDim} strokeWidth={1.3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
            <p style={{ fontSize: 12, color: C.textDim }}>Ready — ask anything about your project.</p>
          </div>
        )}

        <div ref={chatEndRef}/>
      </div>

      {/* ── Chat input ────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, padding: "8px 10px",
        borderTop: `1px solid ${C.border}`, background: C.bg,
      }}>
        <div
          style={{
            border: `1px solid ${C.border}`, borderRadius: 5,
            background: C.panel, overflow: "hidden",
            transition: "border-color 0.15s",
          }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = C.blue)}
          onBlurCapture={e  => (e.currentTarget.style.borderColor = C.border)}>

          <textarea
            ref={inputRef}
            value={chatInput}
            onChange={e => {
              onChatInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px";
            }}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                chatBusy ? onStop() : onSend();
              }
            }}
            placeholder={pipelineDone
              ? "Ask WireUp AI… (↵ send, ⇧↵ newline)"
              : "AI is generating…"}
            disabled={chatBusy && !pipelineDone}
            rows={1}
            style={{
              width: "100%", resize: "none", outline: "none", border: "none",
              background: "transparent", color: C.text,
              fontFamily: "var(--font-sans)", fontSize: 12,
              lineHeight: 1.55, padding: "8px 10px",
              maxHeight: 96, caretColor: C.blue,
              opacity: (chatBusy && !pipelineDone) ? 0.4 : 1,
            }}
            className="ide-scroll"
          />

          {/* Toolbar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "3px 8px 6px", borderTop: `1px solid ${C.border}`,
          }}>
            <ModelPicker value={model} options={modelOptions} onChange={onModelChange}/>
            <div style={{ display: "flex", gap: 4 }}>
              {/* Attach */}
              <button
                style={{ background: "none", border: "none", cursor: "pointer",
                  color: C.textDim, padding: 3, display: "flex", alignItems: "center" }}
                title="Attach file">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"/>
                </svg>
              </button>
              {/* Send / Stop */}
              <button
                onClick={chatBusy ? onStop : onSend}
                disabled={!chatInput.trim() && !chatBusy}
                style={{
                  width: 26, height: 26, borderRadius: 4,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: chatBusy ? C.red : chatInput.trim() ? C.blue : "rgba(255,255,255,0.07)",
                  color: (chatInput.trim() || chatBusy) ? "#fff" : C.textDim,
                  border: "none",
                  cursor: (chatInput.trim() || chatBusy) ? "pointer" : "not-allowed",
                  transition: "background 0.15s",
                }}>
                {chatBusy
                  ? <svg width="9" height="9" fill="currentColor" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
                  : <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7"/></svg>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
