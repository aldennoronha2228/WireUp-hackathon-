import React from "react";
import {
  Terminal,
  Cpu,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  PlayCircle,
  LayoutDashboard,
  Copy,
} from "lucide-react";
import { ProgressTracker } from "../panels/ProgressTracker";
import { AgentConsole } from "../panels/AgentConsole";
import { HardwareAssembly } from "../panels/HardwareAssembly";
import { MilestonesPanel } from "../panels/MilestonesPanel";
import { BomPanel } from "../panels/BomPanel";

interface FormulationPhaseProps {
  dark: boolean;
  // state
  isCompleted: boolean;
  isFailed: boolean;
  activeStage: string;
  workspaceTab: "visual" | "console";
  setWorkspaceTab: (tab: "visual" | "console") => void;
  logs: any[];
  bom: any[];
  wiring: any[];
  milestones: any[];
  context: any;
  candidates: string[];
  decisions: string[];
  conflictDetails: {
    title: string;
    description: string;
    options: string[];
  } | null;
  exporting: boolean;
  restarting: boolean;
  loading: boolean;
  rescuing: boolean;
  selectedLog: any;
  setSelectedLog: (log: any) => void;
  finalSketch: string;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  // handlers
  handleRestart: () => void;
  handleGoToSimulator: () => void;
  handleExportLocal: () => void;
  handleCopyAllData: () => void;
  handleResume: () => void;
  handleRescue: () => void;
  resolveConflict: (choice: string) => void;
}

export const FormulationPhase: React.FC<FormulationPhaseProps> = ({
  dark,
  isCompleted,
  isFailed,
  activeStage,
  workspaceTab,
  setWorkspaceTab,
  logs,
  bom,
  wiring,
  milestones,
  context,
  candidates,
  decisions,
  conflictDetails,
  exporting,
  restarting,
  loading,
  rescuing,
  selectedLog,
  setSelectedLog,
  finalSketch,
  scrollContainerRef,
  handleRestart,
  handleGoToSimulator,
  handleExportLocal,
  handleCopyAllData,
  handleResume,
  handleRescue,
  resolveConflict,
}) => {
  return (
    /* PHASE 2: AUTOMATED FORMULATION LOOP */
    <div className="flex h-full overflow-hidden">
      {/* Left/Center Main Workspace */}
      <div
        className={`flex-1 flex flex-col overflow-hidden border-r ${
          dark
            ? "bg-[#0d0d12] border-white/[0.06]"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        {/* Pipeline header */}
        <div
          className={`border-b px-6 py-4 flex flex-col md:flex-row justify-between gap-4 select-none ${
            dark
              ? "border-white/[0.06] bg-[#0d0d12]/80"
              : "border-slate-200 bg-white/80"
          }`}
        >
          <div className="space-y-2">
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                dark ? "text-slate-600" : "text-slate-400"
              }`}
            >
              AI Sourcing Pipeline
            </p>
            <ProgressTracker
              isCompleted={isCompleted}
              isFailed={isFailed}
              activeStage={activeStage}
              dark={dark}
            />
          </div>
          <div className="flex items-center gap-2.5">
            {/* tab switcher */}
            <div
              className={`flex rounded-xl p-0.5 border ${
                dark
                  ? "bg-white/[0.03] border-white/[0.06]"
                  : "bg-slate-100 border-slate-200"
              }`}
            >
              <button
                onClick={() => setWorkspaceTab("visual")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  workspaceTab === "visual"
                    ? dark
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                      : "bg-white text-indigo-700 shadow-sm border border-slate-200"
                    : dark
                    ? "text-slate-500 hover:text-slate-300"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Visual Overview
              </button>
              <button
                onClick={() => setWorkspaceTab("console")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  workspaceTab === "console"
                    ? dark
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                      : "bg-white text-indigo-700 shadow-sm border border-slate-200"
                    : dark
                    ? "text-slate-500 hover:text-slate-300"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Terminal className="h-3.5 w-3.5" />
                Deep Agent Console
              </button>
            </div>

            <button
              onClick={handleRestart}
              disabled={restarting}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all disabled:opacity-50 ${
                dark
                  ? "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  restarting
                    ? "animate-spin text-indigo-400"
                    : dark
                    ? "text-slate-500"
                    : "text-slate-400"
                }`}
              />
              Restart Build
            </button>

            {isCompleted && (
              <button
                onClick={handleGoToSimulator}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:bg-indigo-700 transition-all"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Launch Playground
              </button>
            )}
          </div>
        </div>

        {/* Main Workspace View Panels */}
        {workspaceTab === "visual" ? (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Completion card */}
              {isCompleted && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 text-zinc-300 space-y-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-100">
                        Formulation Completed Successfully!
                      </h4>
                      <p className="text-[11px] text-zinc-450">
                        BOM, wiring netlists, and code curriculum are generated.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleExportLocal}
                      disabled={exporting}
                      className="flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-all"
                    >
                      <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
                      {exporting ? "Exporting..." : "Export Data to local E:"}
                    </button>
                    <button
                      onClick={handleCopyAllData}
                      className="flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-all"
                    >
                      <Copy className="h-3.5 w-3.5 text-emerald-450" />
                      Copy All Data
                    </button>
                    <button
                      onClick={handleGoToSimulator}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-450 px-4 py-1.5 text-xs font-bold text-zinc-950 transition-all"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      Open Virtual Playground
                    </button>
                  </div>
                </div>
              )}

              {/* Constraint conflict card */}
              {conflictDetails && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-955/15 p-5 text-zinc-300 space-y-3 shadow-lg">
                  <div className="flex items-center gap-2.5 text-amber-400 font-bold text-xs">
                    <AlertTriangle className="h-4 w-4 animate-pulse" />
                    <span>{conflictDetails.title}</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {conflictDetails.description}
                  </p>
                  <div className="space-y-2 pt-2">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">
                      Choose Resolution Path:
                    </div>
                    {conflictDetails.options.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => resolveConflict(opt)}
                        disabled={loading}
                        className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-amber-550/50 p-3 text-xs text-zinc-300 transition-all active:scale-[0.99]"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Failure card */}
              {isFailed && !isCompleted && !conflictDetails && (
                <div className="rounded-xl border border-red-500/20 bg-red-950/10 p-5 text-zinc-300 space-y-3 shadow-lg">
                  <div className="flex items-center gap-2.5 text-red-400 font-bold text-xs">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Formulation Interrupted</span>
                  </div>
                  <p className="text-xs text-zinc-450 leading-relaxed font-sans">
                    The formulation loop stopped. You can resume from where it
                    was left off.
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={handleResume}
                      disabled={loading || rescuing}
                      className="flex items-center gap-1.5 rounded-lg bg-red-500 hover:bg-red-450 px-4 py-2 text-xs font-bold text-zinc-950 transition-all disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                      />
                      {loading ? "Resuming..." : "Resume Formulation"}
                    </button>

                    <button
                      onClick={handleRescue}
                      disabled={loading || rescuing}
                      className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-550 hover:to-amber-450 px-4 py-2 text-xs font-bold text-zinc-950 shadow-md shadow-amber-600/20 transition-all disabled:opacity-50"
                    >
                      <Cpu
                        className={`h-3.5 w-3.5 ${
                          rescuing ? "animate-pulse" : ""
                        }`}
                      />
                      {rescuing
                        ? "Rescuing..."
                        : "API Rescue (Groq/Cerebras/Gemini)"}
                    </button>
                  </div>
                </div>
              )}

              {/* Section 1: Live Hardware Assembly */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">
                  Assembly Preview
                </div>
                <HardwareAssembly bom={bom} wiring={wiring} context={context} />
              </div>

              {/* Section 2: Milestone Timeline */}
              <MilestonesPanel milestones={milestones} />
            </div>

            {/* Bottom drawer/tray (Live AI activity log) */}
            <div className="h-44 border-t border-zinc-800 bg-zinc-955 flex flex-col">
              <div className="flex h-9 border-b border-zinc-850 bg-zinc-900/10 px-4 items-center justify-between select-none">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                  Live AI Activity Log
                </span>
                {logs.some(
                  (l) => l.type === "thinking" || l.type === "tool_call"
                ) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[10px] leading-relaxed text-zinc-400">
                {logs.length === 0 && (
                  <div className="text-zinc-600 italic">
                    No logs initialized.
                  </div>
                )}
                {logs.slice(-15).map((log, i) => {
                  const timestampStr = log.timestamp
                    ? new Date(log.timestamp).toLocaleTimeString()
                    : "";
                  if (log.type === "thinking") {
                    return (
                      <div key={i} className="text-zinc-400 truncate">
                        <span className="text-zinc-600">[{timestampStr}]</span>{" "}
                        <span className="text-blue-400 font-bold">THINK:</span>{" "}
                        {log.text}
                      </div>
                    );
                  }
                  if (log.type === "tool_call") {
                    return (
                      <div key={i} className="text-zinc-300">
                        <span className="text-zinc-500">[{timestampStr}]</span>{" "}
                        <span className="text-emerald-400 font-bold">
                          TOOL:
                        </span>{" "}
                        {log.name} ({log.status})
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </>
        ) : (
          /* DEEP AGENT CONSOLE */
          <AgentConsole
            logs={logs}
            selectedLog={selectedLog}
            setSelectedLog={setSelectedLog}
            scrollContainerRef={scrollContainerRef}
            finalSketch={finalSketch}
            handleCopyAllData={handleCopyAllData}
          />
        )}
      </div>

      {/* Right Sidebar */}
      <aside
        className={`w-72 border-l overflow-y-auto p-5 space-y-6 ${
          dark
            ? "border-white/[0.06] bg-[#0d0d12]"
            : "border-slate-200 bg-white"
        }`}
      >
        {/* Project Constraints */}
        <div>
          <p
            className={`text-[10px] font-bold uppercase tracking-[0.18em] mb-3 ${
              dark ? "text-slate-600" : "text-slate-400"
            }`}
          >
            Project Constraints
          </p>
          <div className="space-y-3">
            {[
              { label: "Core Purpose", value: context.corePurpose },
              { label: "Compute Brain", value: context.mcu },
              { label: "Power Source", value: context.powerSource },
              { label: "Connectivity", value: context.connectivity },
            ]
              .filter((f) => f.value)
              .map(({ label, value }) => (
                <div key={label}>
                  <p
                    className={`text-[10px] font-semibold mb-1 uppercase tracking-wider ${
                      dark ? "text-slate-600" : "text-slate-400"
                    }`}
                  >
                    {label}
                  </p>
                  <p
                    className={`text-sm font-medium leading-snug ${
                      dark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    {value}
                  </p>
                </div>
              ))}
            {!context.corePurpose && !context.mcu && (
              <p
                className={`text-xs italic ${
                  dark ? "text-slate-700" : "text-slate-400"
                }`}
              >
                Extracting from idea…
              </p>
            )}
          </div>
        </div>

        {/* Confirmed BOM + Candidates */}
        <BomPanel bom={bom} candidates={candidates} dark={dark} />

        {/* AI Rationale */}
        {decisions.length > 0 && (
          <div
            className={`border-t pt-5 ${
              dark ? "border-white/[0.06]" : "border-slate-100"
            }`}
          >
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.18em] mb-3 ${
                dark ? "text-slate-600" : "text-slate-400"
              }`}
            >
              AI Rationale
            </p>
            <div className="space-y-2">
              {decisions.map((dec, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border p-3 text-xs leading-relaxed ${
                    dark
                      ? "border-white/[0.05] bg-white/[0.02] text-slate-400"
                      : "border-slate-100 bg-slate-50 text-slate-600"
                  }`}
                >
                  {dec}
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};
