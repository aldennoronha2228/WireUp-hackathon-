import React from "react";
import {
  Terminal,
  Cpu,
  CheckCircle,
  AlertTriangle,
  Braces,
  Code,
  Copy,
} from "lucide-react";
import toast from "react-hot-toast";
import { InspectorPanel } from "./InspectorPanel";

interface AgentConsoleProps {
  logs: any[];
  selectedLog: any;
  setSelectedLog: (log: any) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  finalSketch: string;
  handleCopyAllData: () => void;
}

export const AgentConsole: React.FC<AgentConsoleProps> = ({
  logs,
  selectedLog,
  setSelectedLog,
  scrollContainerRef,
  finalSketch,
  handleCopyAllData,
}) => {
  return (
    <div className="flex-1 flex overflow-hidden h-[calc(100vh-280px)]">
      {/* Left Column: Log Feed */}
      <div className="w-[42%] flex flex-col border-r border-zinc-800 bg-zinc-950/40 overflow-hidden">
        <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
              Execution Feed ({logs.length} logs)
            </span>
            {logs.some(
              (l) => l.type === "thinking" || l.type === "tool_call"
            ) && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-mono text-zinc-505">Live</span>
              </span>
            )}
          </div>
          <button
            onClick={handleCopyAllData}
            className="flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-805 hover:text-zinc-100 px-2 py-0.5 text-[9px] font-bold text-zinc-350 transition-colors"
          >
            <Copy className="h-2.5 w-2.5 text-emerald-400" />
            Copy All Data
          </button>
        </div>
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 font-mono"
        >
          {logs.length === 0 && (
            <div className="text-zinc-600 text-xs italic text-center py-10">
              No execution logs yet.
            </div>
          )}
          {logs.map((log, idx) => {
            const timestampStr = log.timestamp
              ? new Date(log.timestamp).toLocaleTimeString()
              : "";
            const isSelected = selectedLog === log;

            if (log.type === "thinking") {
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedLog(log)}
                  className={`p-3 rounded-lg border text-[11px] cursor-pointer transition-all hover:bg-zinc-900/40 ${
                    isSelected
                      ? "border-blue-500/50 bg-blue-500/5"
                      : "border-zinc-800 bg-zinc-900/20"
                  }`}
                >
                  <div className="flex justify-between items-center text-[9px] text-zinc-500 mb-1.5">
                    <span className="font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                      <Cpu className="h-3 w-3" /> Thinking Process
                    </span>
                    <span>{timestampStr}</span>
                  </div>
                  <p className="text-zinc-350 line-clamp-3 leading-relaxed whitespace-pre-wrap font-sans">
                    {log.text}
                  </p>
                  <div className="text-[9px] text-blue-400/70 mt-1 hover:underline font-bold text-right">
                    Inspect full thought →
                  </div>
                </div>
              );
            }

            if (log.type === "tool_call") {
              const statusColors =
                log.status === "failed"
                  ? "border-red-500/35 bg-red-950/10 text-red-300"
                  : log.status === "done"
                  ? "border-emerald-500/35 bg-emerald-950/10 text-emerald-300"
                  : "border-amber-500/35 bg-amber-950/10 text-amber-300 animate-pulse";

              const badge =
                log.status === "failed"
                  ? "bg-red-500/10 text-red-400 border border-red-500/25"
                  : log.status === "done"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/25";

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedLog(log)}
                  className={`p-3 rounded-lg border text-[11px] cursor-pointer transition-all hover:opacity-95 ${statusColors} ${
                    isSelected ? "ring-1 ring-emerald-500" : ""
                  }`}
                >
                  <div className="flex justify-between items-center text-[9px] mb-1.5">
                    <span className="font-bold uppercase tracking-wider flex items-center gap-1 text-zinc-400">
                      <Braces className="h-3 w-3" /> Tool Invocation
                    </span>
                    <span>{timestampStr}</span>
                  </div>
                  <div className="font-bold font-mono text-zinc-100 text-[12px] mb-1">
                    {log.name}
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-1 border-t border-zinc-800/40">
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${badge}`}
                    >
                      {log.status || "running"}
                    </span>
                    <span className="text-[9px] text-zinc-500 hover:text-zinc-355 underline">
                      Inspect details →
                    </span>
                  </div>
                </div>
              );
            }

            if (log.type === "decision") {
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedLog(log)}
                  className={`p-3 rounded-lg border text-[11px] cursor-pointer transition-all bg-purple-500/5 hover:bg-purple-500/10 ${
                    isSelected
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-purple-500/20"
                  }`}
                >
                  <div className="flex justify-between items-center text-[9px] text-purple-400 mb-1">
                    <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Decision Logged
                    </span>
                    <span>{timestampStr}</span>
                  </div>
                  <p className="text-zinc-300 leading-relaxed font-sans">
                    {log.text}
                  </p>
                </div>
              );
            }

            if (log.type === "rate_limit") {
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedLog(log)}
                  className={`p-3 rounded-lg border text-[11px] cursor-pointer transition-all bg-amber-500/5 hover:bg-amber-500/10 ${
                    isSelected
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-amber-500/20"
                  }`}
                >
                  <div className="flex justify-between items-center text-[9px] text-amber-400 mb-1">
                    <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Rate Limit Pause
                    </span>
                    <span>{timestampStr}</span>
                  </div>
                  <p className="text-zinc-300 leading-relaxed font-sans">
                    {log.text}
                  </p>
                </div>
              );
            }

            if (log.type === "error") {
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedLog(log)}
                  className={`p-3 rounded-lg border text-[11px] cursor-pointer transition-all bg-red-500/5 hover:bg-red-500/10 ${
                    isSelected
                      ? "border-red-500 bg-red-500/10"
                      : "border-red-500/20"
                  }`}
                >
                  <div className="flex justify-between items-center text-[9px] text-red-400 mb-1">
                    <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Pipeline Error
                    </span>
                    <span>{timestampStr}</span>
                  </div>
                  <p className="text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap">
                    {log.text}
                  </p>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>

      {/* Right Column: Deep Inspector / Details View */}
      <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
        <div className="flex h-9 border-b border-zinc-800 px-4 items-center justify-between bg-zinc-900/10">
          <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5 text-emerald-400" />
            Parameters & Execution Inspector
          </span>
          {finalSketch && (
            <div className="flex items-center gap-1 text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider font-mono">
              <Code className="h-2.5 w-2.5" /> Sketch Generated
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden p-6 space-y-4">
          {/* Tabs inside Inspector */}
          <div className="flex gap-2 border-b border-zinc-850 pb-2">
            <button
              onClick={() => {
                if (selectedLog?.type === "code" && logs.length > 0) {
                  setSelectedLog(logs[logs.length - 1]);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                selectedLog && selectedLog.type !== "code"
                  ? "bg-zinc-850 text-zinc-100 border border-zinc-700"
                  : "bg-zinc-900/40 text-zinc-500 hover:text-zinc-300"
              }`}
              disabled={!selectedLog}
            >
              <Braces className="h-3.5 w-3.5 text-blue-400" />
              {selectedLog && selectedLog.type !== "code"
                ? `${selectedLog.name || selectedLog.type.toUpperCase()}`
                : "Selected Tool"}
            </button>
            <button
              onClick={() => {
                if (finalSketch) {
                  setSelectedLog({ type: "code", text: finalSketch });
                } else {
                  toast.error("Arduino code has not been generated yet.");
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                selectedLog?.type === "code"
                  ? "bg-emerald-500 text-zinc-950 font-bold"
                  : finalSketch
                  ? "bg-zinc-900 hover:bg-zinc-855 text-emerald-400 border border-zinc-800"
                  : "bg-zinc-900/20 text-zinc-650 cursor-not-allowed"
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              Generated Arduino Code
            </button>
          </div>

          {/* Inspector Content Body */}
          <div className="flex-1 overflow-y-auto bg-black/40 rounded-xl border border-zinc-850 p-4 font-mono text-xs select-text">
            <InspectorPanel selectedLog={selectedLog} />
          </div>
        </div>
      </div>
    </div>
  );
};
