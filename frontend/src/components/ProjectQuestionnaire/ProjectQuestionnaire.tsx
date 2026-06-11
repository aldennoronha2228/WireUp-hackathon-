/**
 * ProjectQuestionnaire — "REFINE YOUR DESIGN"
 * Appears after landing in workspace, before pipeline starts.
 * Matches the reference screenshot: monospace font, dark bg,
 * grid-of-chips answer options, SKIP / CONTINUE buttons.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { axiosInstance } from "../../lib/axios";

/* ── palette ──────────────────────────────────────────────────────────────── */
const Q = {
  bg:       "#0a0a0f",
  overlay:  "rgba(0,0,0,0.85)",
  card:     "#111118",
  border:   "rgba(255,255,255,0.09)",
  borderHi: "rgba(255,255,255,0.18)",
  chip:     "#16161e",
  chipSel:  "rgba(0,122,204,0.18)",
  chipSelB: "rgba(0,122,204,0.5)",
  text:     "#e2e8f0",
  textDim:  "#6e7280",
  textMid:  "#9ea3b0",
  blue:     "#007acc",
  mono:     "JetBrains Mono, ui-monospace, monospace",
};

export interface Question {
  id:      string;
  text:    string;
  options: string[];
  hint?:   string;
}

interface Props {
  idea:     string;
  model:    string;
  onStart:  (answers: Record<string, string>) => void;
  onSkip:   () => void;
}

export default function ProjectQuestionnaire({ idea, model, onStart, onSkip }: Props) {
  const [questions,  setQuestions]  = useState<Question[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [answers,    setAnswers]    = useState<Record<string, string>>({});
  const [customText, setCustomText] = useState<Record<string, string>>({});
  const [starting,   setStarting]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axiosInstance.post<{ questions: Question[] }>("/questions", { idea, model })
      .then(res => { if (!cancelled) setQuestions(res.data.questions || []); })
      .catch(() => { /* silently fail — onSkip will be auto-called */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [idea, model]);

  const pick = (qid: string, opt: string) => {
    setAnswers(a => ({ ...a, [qid]: opt }));
    if (opt !== "Other...") {
      setCustomText(t => { const n = { ...t }; delete n[qid]; return n; });
    }
  };

  const handleContinue = () => {
    setStarting(true);
    // Merge answers: if user typed custom text for "Other...", use that
    const merged: Record<string, string> = {};
    for (const q of questions) {
      const a = answers[q.id];
      if (a === "Other..." && customText[q.id]) {
        merged[q.id] = customText[q.id];
      } else if (a) {
        merged[q.id] = a;
      }
    }
    onStart(merged);
  };

  const answeredCount = questions.filter(q => answers[q.id]).length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: Q.overlay,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px 16px",
          backdropFilter: "blur(4px)",
        }}>

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          style={{
            width: "100%", maxWidth: 680,
            maxHeight: "88vh",
            background: Q.card,
            border: `1px solid ${Q.border}`,
            borderRadius: 8,
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          }}>

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div style={{ padding: "20px 24px 14px", borderBottom: `1px solid ${Q.border}`, flexShrink: 0 }}>
            <p style={{ fontFamily: Q.mono, fontSize: 13, fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase", color: Q.text, marginBottom: 4 }}>
              Refine Your Design
            </p>
            <p style={{ fontFamily: Q.mono, fontSize: 11, color: Q.textDim, lineHeight: 1.5 }}>
              Answer to customise the hardware architecture, or skip to use AI defaults.
            </p>
          </div>

          {/* ── Questions ───────────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px 20px" }}
            className="ide-scroll">

            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 12, padding: "40px 0" }}>
                <motion.div
                  animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  style={{ width: 24, height: 24, borderRadius: "50%",
                    border: "2px solid rgba(0,122,204,0.2)", borderTopColor: Q.blue }}/>
                <p style={{ fontFamily: Q.mono, fontSize: 12, color: Q.textDim }}>
                  Analysing your project…
                </p>
              </div>
            ) : (
              questions.map((q, qi) => (
                <div key={q.id} style={{ marginBottom: 24 }}>
                  {/* Question text */}
                  <p style={{ fontFamily: Q.mono, fontSize: 12, fontWeight: 600,
                    color: Q.text, marginBottom: q.hint ? 4 : 10, lineHeight: 1.5 }}>
                    <span style={{ color: Q.textDim, marginRight: 8 }}>{qi + 1}.</span>
                    {q.text}
                  </p>
                  {q.hint && (
                    <p style={{ fontFamily: Q.mono, fontSize: 10, color: Q.textDim, marginBottom: 10 }}>
                      {q.hint}
                    </p>
                  )}

                  {/* Options grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {q.options.map(opt => {
                      const selected = answers[q.id] === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => pick(q.id, opt)}
                          style={{
                            padding: "10px 14px",
                            background: selected ? Q.chipSel : Q.chip,
                            border: `1px solid ${selected ? Q.chipSelB : Q.border}`,
                            borderRadius: 5,
                            cursor: "pointer",
                            textAlign: "left",
                            fontFamily: Q.mono,
                            fontSize: 11,
                            color: selected ? "#60b8f9" : Q.textMid,
                            transition: "all 0.12s",
                            lineHeight: 1.4,
                          }}
                          onMouseOver={e => {
                            if (!selected) {
                              e.currentTarget.style.borderColor = Q.borderHi;
                              e.currentTarget.style.color = Q.text;
                            }
                          }}
                          onMouseOut={e => {
                            if (!selected) {
                              e.currentTarget.style.borderColor = Q.border;
                              e.currentTarget.style.color = Q.textMid;
                            }
                          }}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom text input for "Other..." */}
                  {answers[q.id] === "Other..." && (
                    <motion.input
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 34 }}
                      placeholder="Type your answer…"
                      value={customText[q.id] ?? ""}
                      onChange={e => setCustomText(t => ({ ...t, [q.id]: e.target.value }))}
                      style={{
                        marginTop: 6, width: "100%", padding: "6px 10px",
                        background: Q.chip, border: `1px solid ${Q.blue}`,
                        borderRadius: 4, color: Q.text,
                        fontFamily: Q.mono, fontSize: 11, outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 24px", borderTop: `1px solid ${Q.border}`,
            flexShrink: 0, gap: 12,
          }}>
            {/* Progress */}
            <span style={{ fontFamily: Q.mono, fontSize: 10, color: Q.textDim }}>
              {loading ? "" : `${answeredCount} / ${questions.length} answered`}
            </span>

            <div style={{ display: "flex", gap: 10 }}>
              {/* SKIP */}
              <button
                onClick={onSkip}
                style={{
                  padding: "8px 22px",
                  background: "transparent",
                  border: `1px solid ${Q.border}`,
                  borderRadius: 5, cursor: "pointer",
                  fontFamily: Q.mono, fontSize: 12,
                  fontWeight: 600, letterSpacing: "0.08em",
                  color: Q.textDim, textTransform: "uppercase",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = Q.borderHi; e.currentTarget.style.color = Q.text; }}
                onMouseOut={e  => { e.currentTarget.style.borderColor = Q.border; e.currentTarget.style.color = Q.textDim; }}>
                Skip
              </button>

              {/* CONTINUE */}
              <button
                onClick={handleContinue}
                disabled={starting || loading}
                style={{
                  padding: "8px 28px",
                  background: starting ? "rgba(255,255,255,0.1)" : "#ffffff",
                  border: "none", borderRadius: 5, cursor: starting ? "not-allowed" : "pointer",
                  fontFamily: Q.mono, fontSize: 12,
                  fontWeight: 700, letterSpacing: "0.08em",
                  color: starting ? Q.textDim : "#000000",
                  textTransform: "uppercase",
                  transition: "background 0.15s",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                {starting && (
                  <motion.div
                    animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                    style={{ width: 12, height: 12, borderRadius: "50%",
                      border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#000" }}/>
                )}
                Continue
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
