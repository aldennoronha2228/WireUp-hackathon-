// ??$$$ group 2 - Ideation Stage (Phase 1)
// ??$$$ NEW FLOW
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Socket } from "socket.io-client";
import { axiosInstance } from "../../lib/axios";
import { useThemeStore } from "../../store/useThemeStore.ts";
import { DiscoveryPhase } from "./phases/DiscoveryPhase";
import { X, HardDrive, Layers } from "lucide-react";
import toast from "react-hot-toast";
import { FormulationPhase } from "./phases/FormulationPhase";
import { useSessionRestore } from "./hooks/useSessionRestore";
import { useFormulationSocket } from "./hooks/useFormulationSocket";
import { useDiscoverySession } from "./hooks/useDiscoverySession";
import { getProgressPercent, getProgressStatus } from "./selectors/progress.selectors";
import { getCandidateParts, getDecisionReasons } from "./selectors/decision.selectors";
import { getActiveStage } from "./selectors/stage.selectors";
import { getConflictDetails } from "./selectors/conflict.selectors";
import { ModelSelector } from "./components/ModelSelector";
import wireupLogo from "../../assets/wireup-logo.jpeg";
import { createPortal } from "react-dom";

// ── Custom dark model dropdown ────────────────────────────────────────────────
const MODEL_OPTIONS = [
  { value: "gemini-2.5-flash",                             label: "Gemini 2.5 Flash" },
  { value: "gpt-oss-120b",                                 label: "Cerebras gpt-oss-120b" },
  { value: "zai-glm-4.7",                                  label: "Cerebras zai-glm-4.7" },
  { value: "meta-llama/llama-4-scout-17b-16e-instruct",    label: "Groq Llama 4 Scout" },
  { value: "qwen/qwen3-32b",                               label: "Groq Qwen3-32B" },
  { value: "deepseek-chat",                                label: "DeepSeek V3 (Chat)" },
  { value: "ollama/qwen2.5:3b",                            label: "Ollama (qwen2.5:3b)" },
  { value: "ollama/llama3.2:3b",                           label: "Ollama (llama3.2:3b)" },
  { value: "ollama/qwen2.5-coder:14b",                     label: "Ollama (qwen2.5-coder:14b)" },
  { value: "ollama/qwen2.5-coder:7b",                      label: "Ollama (qwen2.5-coder:7b)" },
  { value: "ollama/deepseek-r1:8b",                        label: "Ollama (deepseek-r1:8b)" },
];

function ModelDropdown({ model, setModel }: {
  model: string;
  setModel: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos]   = React.useState({ top: 0, right: 0 });
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const selected = MODEL_OPTIONS.find(o => o.value === model) || MODEL_OPTIONS[0];

  // Recalculate position when opening
  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen(v => !v);
  };

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        // Check if click is inside the portal dropdown
        const portal = document.getElementById("model-dropdown-portal");
        if (portal && portal.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#8888a8]">Agent Brain:</span>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#111118] px-3 py-1.5 text-xs text-[#f0f0f5] hover:border-[#c8a0e0]/40 transition-colors min-w-[160px]"
      >
        <span className="flex-1 text-left truncate">{selected.label}</span>
        <svg className={`h-3 w-3 flex-shrink-0 text-[#8888a8] transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && createPortal(
        <div
          id="model-dropdown-portal"
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999, width: "220px" }}
          className="rounded-xl border border-white/10 bg-[#111118] shadow-2xl overflow-hidden"
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {MODEL_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setModel(opt.value); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-xs transition-colors ${
                  opt.value === model
                    ? "bg-[#c8a0e0]/15 text-[#c8a0e0]"
                    : "text-[#f0f0f5] hover:bg-white/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

interface DiscoveryModalProps {
  initialIdea?: string;
  projectId?: string;
  initialPhase?: 1 | 2;
  onClose: () => void;
}

export const DiscoveryModal: React.FC<DiscoveryModalProps> = ({
  initialIdea = "",
  projectId,
  initialPhase,
  onClose
}) => {
  const { theme } = useThemeStore();
  const dark = theme === "dark";
  const virtualPlaygroundUrl = (import.meta.env.VITE_VIRTUAL_PLAYGROUND_URL || "http://localhost:5174").replace(/\/$/, "");
  // ??$$$ NEW FLOW
  const [model, setModel] = useState("meta-llama/llama-4-scout-17b-16e-instruct");
  // ??$$$ newer code - hybrid primary provider selection
  const [hybridPrimary, setHybridPrimary] = useState("meta-llama/llama-4-scout-17b-16e-instruct");
  const [phase, setPhase] = useState<1 | 2>(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false); // ??$$$ newer code - track if discovery has started
  const [submitting, setSubmitting] = useState(false);
  // ??$$$ NEW FLOW
  const [restarting, setRestarting] = useState(false);
  // ??$$$ NEW FLOW
  const [shouldAutoFormulate, setShouldAutoFormulate] = useState(false);

  // Phase 1 (Discovery) State
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [answerText, setAnswerText] = useState("");
  const [context, setContext] = useState<any>({
    corePurpose: "",
    mcu: "",
    subsystems: [],
    constraints: [],
    powerSource: "",
    connectivity: "",
    openQuestions: []
  });

  // Phase 2 (Formulation) State
  const [activeTab, setActiveTab] = useState<"thinking" | "tools">("thinking");
  const [logs, setLogs] = useState<any[]>([]);
  const [bom, setBom] = useState<any[]>([]);
  const [wiring, setWiring] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  // ??$$$ newer code — Completion & local export states
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedProjectId, setCompletedProjectId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [isFailed, setIsFailed] = useState(false); // ??$$$ newer code
  const [rescuing, setRescuing] = useState(false); // ??$$$ newer code - API rescue state
  // ??$$$ newer code
  const [workspaceTab, setWorkspaceTab] = useState<"visual" | "console">("visual");
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [finalSketch, setFinalSketch] = useState<string>("");

  const socketRef = useRef<Socket | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // ??$$$ newer code — Visual Progress Calculations
  const progressPercent = useMemo(
    () =>
        getProgressPercent(
        bom,
        wiring,
        milestones,
        logs,
        isCompleted,
        isFailed
        ),
    [bom, wiring, milestones, logs, isCompleted, isFailed]
    );

    const progressStatus = useMemo(
    () =>
        getProgressStatus(
        progressPercent,
        isCompleted,
        isFailed
        ),
    [progressPercent, isCompleted, isFailed]
    );

    const candidates = useMemo(
        () => getCandidateParts(logs, bom),
        [logs, bom]
    );

    const decisions = useMemo(
        () => getDecisionReasons(logs),
        [logs]
    );

    const activeStage = useMemo(
        () =>
            getActiveStage(
            logs,
            bom,
            wiring,
            milestones,
            isCompleted,
            isFailed
            ),
        [
            logs,
            bom,
            wiring,
            milestones,
            isCompleted,
            isFailed
        ]
    );

    const conflictDetails = useMemo(
        () => getConflictDetails(logs),
        [logs]
    );

  const resolveConflict = async (choice: string) => {
    setLoading(true);
    try {
      toast.success(`Conflict resolved: ${choice}. Restarting formulation...`);
      await axiosInstance.post("/new-flow/restart", {
        sessionId,
        context: {
          ...context,
          constraints: [...(context.constraints || []), `Resolved conflict by choosing: ${choice}`]
        },
        model
      });
    } catch (e) {
      toast.error("Failed to submit conflict resolution.");
    } finally {
      setLoading(false);
    }
  };

  



  

  // Setup Socket URL
  const getSocketUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL || "";
    if (envUrl) {
      return envUrl.replace(/\/api$/, "");
    }
    return window.location.hostname === "localhost" ? "http://localhost:5000" : "";
  };

  // Auto-scroll logs
  // ??$$$ NEW FLOW
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const threshold = 150; // pixels from bottom
      const isNearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < threshold;
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [logs]);


  // ??$$$ newer code — start discovery session on mount supporting localStorage caching & restore on reload
  useSessionRestore({
    projectId,
    initialIdea,
    initialPhase,

    onClose,

    setLoading,
    setSessionId,

    setQuestion,
    setOptions,
    setContext,

    setBom,
    setWiring,
    setMilestones,
    setLogs,

    setStarted,
    setPhase,
    setShouldAutoFormulate,

    setIsCompleted,
    setCompletedProjectId,
    setFinalSketch
    });

  // ??$$$ newer code — Handle starting a brand new session with selected model
  const handleStartSession = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.post("/new-flow/start", {
        idea: initialIdea,
        // ??$$$ newer code - send hybridPrimary as the model value when hybrid mode, else send model directly
        model: model === "hybrid" ? `hybrid:${hybridPrimary}` : model
      });

      setSessionId(res.data.sessionId);
      localStorage.setItem("wireup_discovery_session_id", res.data.sessionId);
      setQuestion(res.data.question);
      setOptions(res.data.options || []);
      setContext(res.data.context || {});
      setStarted(true);
      setShouldAutoFormulate(true);
      if (res.data.done) {
        handleProceed();
      }
    } catch (err: any) {
      toast.error("Failed to initiate agent session.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestartDiscovery = async () => {
    if (!sessionId) return;

    setLoading(true);

    try {
        const res = await axiosInstance.post("/new-flow/restart", {
        sessionId,
        });

        setQuestion(res.data.question || "");
        setOptions(res.data.options || []);
        setContext(res.data.context || {});

        setPhase(1);

        toast.success("Discovery Q&A restarted!");
    } catch {
        toast.error("Failed to restart discovery.");
    } finally {
        setLoading(false);
    }
    };

    useFormulationSocket({
        phase,
        sessionId,

        shouldAutoFormulate,
        setShouldAutoFormulate,

        setLogs,
        setBom,
        setWiring,
        setMilestones,

        setFinalSketch,

        setIsCompleted,
        setIsFailed,

        setCompletedProjectId,

        setModel,

        socketRef,

        getSocketUrl
    });

  // ??$$$ newer code — Fallback polling for session completion (every 5 seconds)
    useDiscoverySession({
        sessionId,
        phase,
        isCompleted,

        setIsCompleted,
        setIsFailed,
        setCompletedProjectId,

        setBom,
        setWiring,
        setMilestones,
        setLogs,
        setFinalSketch
    });

  // Submit Answer (Phase 1)
  const handleAnswer = async (selectedAnswer: string) => {
    if (submitting || !sessionId) return;
    setSubmitting(true);
    try {
      const res = await axiosInstance.post("/new-flow/answer", {
        sessionId,
        answer: selectedAnswer,
        currentQuestion: question,
        currentOptions: options
      });
      setQuestion(res.data.question);
      setOptions(res.data.options || []);
      setContext(res.data.context || {});
      setAnswerText("");
      if (res.data.done) {
        setPhase(2);
      }
    } catch (err: any) {
      toast.error("Failed to send answer.");
    } finally {
      setSubmitting(false);
    }
  };



  // ??$$$ newer code — Handle proceed (skip Q&A and auto-start formulation, preserving unsent inputs)
  const handleProceed = async () => {
    if (submitting || !sessionId) return;
    setSubmitting(true);
    try {
      // If user typed an answer, submit it first to store as many answered questions as possible
      if (answerText.trim()) {
        try {
          const answerRes = await axiosInstance.post("/new-flow/answer", {
            sessionId,
            answer: answerText,
            currentQuestion: question,
            currentOptions: options
          });
          setQuestion(answerRes.data.question);
          setOptions(answerRes.data.options || []);
          setContext(answerRes.data.context || {});
          setAnswerText("");
        } catch (e) {
          console.error("Failed to submit final typed answer before skipping:", e);
        }
      }
      const res = await axiosInstance.post("/new-flow/proceed", { sessionId });
      if (res.data && res.data.context) {
        setContext(res.data.context);
      }
      setPhase(2);
      setShouldAutoFormulate(true);
    } catch (err: any) {
      toast.error("Failed to skip discovery.");
    } finally {
      setSubmitting(false);
    }
  };

  // ??$$$ newer code — Export data to local drive E:
  const handleExportLocal = async () => {
    if (!sessionId) return;
    setExporting(true);
    try {
      const res = await axiosInstance.post("/new-flow/export-local", { sessionId });
      toast.success(res.data.message || "Successfully exported to E: drive!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to export data locally.");
    } finally {
      setExporting(false);
    }
  };

  // ??$$$ newer code — Copy all logs, inputs, outputs, thoughts and code
  const handleCopyAllData = () => {
    try {
      let text = `# WIREUP.AI - AI FORMULATION DATA EXPORT\n\n`;

      text += `## Project Idea / Core Purpose:\\n`;
      text += `${initialIdea || context.corePurpose || "Not specified"}\\n\\n`;

      text += `## Compute Brain (MCU):\\n`;
      text += `${context.mcu || "Determining..."}\\n\\n`;

      text += `## Confirmed BOM:\\n`;
      if (bom && bom.length > 0) {
        bom.forEach((item, idx) => {
          text += `- ${idx + 1}. ${item.displayName || item.name} (${item.purpose || "No purpose specified"})\\n`;
        });
      } else {
        text += `No parts finalized yet.\\n`;
      }
      text += `\\n`;

      text += `## Wiring Connections:\\n`;
      if (wiring && wiring.length > 0) {
        wiring.forEach((w, idx) => {
          text += `- ${idx + 1}. ${w.from} ===> ${w.to}\\n`;
        });
      } else {
        text += `No wiring connections designed yet.\\n`;
      }
      text += `\\n`;

      text += `## Deep Agent Log Feed:\\n\\n`;
      if (logs && logs.length > 0) {
        logs.forEach((log, idx) => {
          const timestampStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "";
          text += `--- LOG #${idx + 1} [${timestampStr}] ---\\n`;
          text += `Type: ${String(log.type || "").toUpperCase()}\\n`;
          if (log.type === "thinking") {
            text += `Thinking:\\n${log.text || ""}\\n`;
          } else if (log.type === "tool_call") {
            text += `Tool Name: ${log.name || ""}\\n`;
            text += `Status: ${log.status || "running"}\\n`;
            if (log.input) {
              text += `Input Params:\\n${JSON.stringify(log.input, null, 2)}\\n`;
            }
            if (log.output) {
              text += `Output Response:\\n${JSON.stringify(log.output, null, 2)}\\n`;
            }
          } else {
            text += `Text: ${log.text || ""}\\n`;
          }
          text += `\\n`;
        });
      } else {
        text += `No execution logs yet.\\n`;
      }
      text += `\\n`;

      if (finalSketch) {
        text += `## Generated Arduino Code:\\n\\n\`\`\`cpp\\n${finalSketch}\\n\`\`\`\\n`;
      }

      navigator.clipboard.writeText(text);
      toast.success("All formulation data copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy formulation data:", err);
      toast.error("Failed to copy data.");
    }
  };

  // ??$$$ newer code — Go to simulator workspace
  const handleGoToSimulator = async () => {
    if (!sessionId) {
      onClose();
      return;
    }

    const params = new URLSearchParams({
      sessionId,
      source: "wireup"
    });

    if (completedProjectId) {
      params.set("projectId", completedProjectId);
    }

    try {
      await axiosInstance.post("/new-flow/export-local", { sessionId });
    } catch (err) {
      console.error("Failed to export formulation before opening the playground:", err);
      toast.error("Failed to export formulation data for the playground.");
      return;
    }

    localStorage.removeItem("wireup_discovery_session_id");
    onClose();
    window.location.href = `${virtualPlaygroundUrl}/?${params.toString()}`;
  };

  // ??$$$ NEW FLOW
  const handleRestart = async () => {
    if (!sessionId || restarting) return;
    setRestarting(true);
    setLogs([]);
    setBom([]);
    setWiring([]);
    setMilestones([]);
    try {
      await axiosInstance.post("/new-flow/restart", {
        sessionId,
        context,
        model // ??$$$ newer code - pass currently selected model on restart
      });
      toast.success("Agent restarted with current context!");
    } catch (err: any) {
      toast.error("Failed to restart formulation agent.");
    } finally {
      setRestarting(false);
    }
  };

  // ??$$$ newer code — Trigger resumption of automated formulation
  const handleResume = async () => {
    if (!sessionId) return;
    setLoading(true);
    setIsFailed(false);
    try {
      await axiosInstance.post("/new-flow/resume", { sessionId });
      toast.success("Triggered formulation resumption!");
    } catch (err: any) {
      console.error("handleResume failed:", err);
      toast.error(err.response?.data?.error || "Failed to trigger resumption.");
      setIsFailed(true);
    } finally {
      setLoading(false);
    }
  };

  // ??$$$ newer code — Trigger API Rescue to bypass Ollama constraints and failover to cloud APIs
  const handleRescue = async () => {
    if (!sessionId) return;
    setRescuing(true);
    setIsFailed(false);
    try {
      await axiosInstance.post("/new-flow/rescue", { sessionId });
      toast.success("Triggered API Rescue with Groq/Cerebras/Gemini failover!");
    } catch (err: any) {
      console.error("handleRescue failed:", err);
      toast.error(err.response?.data?.error || "Failed to trigger API Rescue.");
      setIsFailed(true);
    } finally {
      setRescuing(false);
    }
  };

  // ── Derived theme tokens ──────────────────────────────────────────────────
  const modalBg    = dark ? "bg-[#0d0d12]"                  : "bg-slate-50";
  const headerBg   = dark ? "bg-[#0d0d12]/80 border-white/[0.06]" : "bg-white/80 border-slate-200";
  const textHead   = dark ? "text-slate-100"                : "text-slate-800";
  const textSub    = dark ? "text-slate-500"                : "text-slate-400";
  const selectCls  = dark
    ? "rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500/60 transition-colors"
    : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400 transition-colors";

  return (
    <div className={`fixed inset-0 z-50 flex flex-col font-sans antialiased overflow-hidden ${dark ? "text-slate-100" : "text-slate-800"} ${modalBg}`}>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-0 left-1/4 h-100 w-150 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-100 w-150 translate-y-1/2 rounded-full bg-violet-500/8 blur-[130px]" />

      {/* ── Top Header ── */}
      <header className={`relative z-10 flex h-16 shrink-0 items-center justify-between border-b px-6 backdrop-blur-xl ${headerBg}`}>
        {/* top gradient line */}
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-indigo-500 via-violet-500 to-pink-500 opacity-60" />

        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${dark ? "border-indigo-500/30 bg-indigo-500/15" : "border-indigo-200 bg-indigo-50"}`}>
            <img src={wireupLogo} alt="Wireup" className="h-6 w-6 object-contain rounded-md" />
          </div>
          <div>
            <h1 className={`text-sm font-bold tracking-tight ${textHead}`}>
              AI Build Session
            </h1>
            <p className={`text-[11px] ${textSub}`}>
              {phase === 1 ? "Discovery Loop" : "Autonomous Formulation Pipeline"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Model Selector — custom dark dropdown */}
          {started && (
            <ModelDropdown model={model} setModel={setModel} />
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${dark ? "text-slate-400 hover:bg-white/8 hover:text-slate-200" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className={`h-8 w-8 animate-spin rounded-full border-[3px] border-t-transparent ${dark ? "border-indigo-500" : "border-indigo-400"}`} />
            <p className={`text-sm ${textSub}`}>Booting discovery pipelines…</p>
          </div>
        ) : !started ? (
          <ModelSelector
            dark={dark}
            textHead={textHead}
            textSub={textSub}
            initialIdea={initialIdea}

            model={model}
            setModel={setModel}

            hybridPrimary={hybridPrimary}
            setHybridPrimary={setHybridPrimary}

            handleStartSession={handleStartSession}
            />
          
        ) : phase === 1 ? (
        <DiscoveryPhase
            question={question}
            options={options}
            answerText={answerText}
            setAnswerText={setAnswerText}
            submitting={submitting}
            loading={loading}
            sessionId={sessionId}
            context={context}
            initialIdea={initialIdea}
            dark={dark}
            textHead={textHead}
            textSub={textSub}
            model={model}
            setModel={setModel}
            hybridPrimary={hybridPrimary}
            setHybridPrimary={setHybridPrimary}
            handleAnswer={handleAnswer}
            handleProceed={handleProceed}
            handleStartSession={handleStartSession}
            handleRestartDiscovery={handleRestartDiscovery}
            setPhase={setPhase}
            setShouldAutoFormulate={setShouldAutoFormulate}
        />
        ) : (
          <FormulationPhase
            dark={dark}
            isCompleted={isCompleted}
            isFailed={isFailed}
            activeStage={activeStage}
            workspaceTab={workspaceTab}
            setWorkspaceTab={setWorkspaceTab}
            logs={logs}
            bom={bom}
            wiring={wiring}
            milestones={milestones}
            context={context}
            candidates={candidates}
            decisions={decisions}
            conflictDetails={conflictDetails}
            exporting={exporting}
            restarting={restarting}
            loading={loading}
            rescuing={rescuing}
            selectedLog={selectedLog}
            setSelectedLog={setSelectedLog}
            finalSketch={finalSketch}
            scrollContainerRef={scrollContainerRef}
            handleRestart={handleRestart}
            handleGoToSimulator={handleGoToSimulator}
            handleExportLocal={handleExportLocal}
            handleCopyAllData={handleCopyAllData}
            handleResume={handleResume}
            handleRescue={handleRescue}
            resolveConflict={resolveConflict}
          />

        )}
      </div>
    </div>
  );
};