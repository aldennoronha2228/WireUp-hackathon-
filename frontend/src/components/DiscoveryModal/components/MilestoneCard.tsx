import React, { useState, useEffect, useRef, useMemo } from "react";
import { Copy } from "lucide-react"; // if used
import toast from "react-hot-toast";

export const MilestoneCard: React.FC<{ m: any; idx: number }> = ({ m, idx }) => {
  const [expanded, setExpanded] = useState(false);
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 overflow-hidden transition-all duration-300">
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-4 flex justify-between items-center cursor-pointer hover:bg-zinc-900/30 select-none"
      >
        <div className="flex gap-3 items-center">
          <div className="h-6 w-6 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 font-bold text-xs flex items-center justify-center">
            {idx + 1}
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-150">{m.title}</div>
            <div className="text-[10px] text-zinc-500">{m.objective || "Milestone objective"}</div>
          </div>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono">{expanded ? "COLLAPSE" : "EXPAND"}</span>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-zinc-800/50 space-y-3 text-[11px] text-zinc-300 leading-relaxed font-sans">
          <div>
            <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider block mb-0.5 font-mono">Overview</span>
            <p className="text-zinc-400">{m.explanation || "No detailed explanation generated."}</p>
          </div>

          {m.wiringInstructions && (
            <div>
              <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider block mb-0.5 font-mono">Wiring</span>
              <pre className="font-mono bg-zinc-950/60 p-2 rounded border border-zinc-900 text-zinc-400 overflow-x-auto text-[10px]">
                {m.wiringInstructions}
              </pre>
            </div>
          )}

          {(m.expectedOutput || m.passCondition) && (
            <div>
              <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider block mb-0.5 font-mono">Testing</span>
              <div className="space-y-1 bg-zinc-900/30 p-2 rounded border border-zinc-850">
                {m.expectedOutput && (
                  <div>
                    <span className="text-zinc-500">Expected:</span> {m.expectedOutput}
                  </div>
                )}
                {m.passCondition && (
                  <div>
                    <span className="text-zinc-500">Pass:</span> {m.passCondition}
                  </div>
                )}
              </div>
            </div>
          )}

          {m.code && (
            <div className="pt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCode(!showCode);
                }}
                className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                {showCode ? "Hide Firmware Code" : "Open Full Code"}
              </button>
              {showCode && (
                <pre className="mt-2 font-mono text-[10px] bg-black/60 p-3 rounded border border-zinc-900 text-zinc-300 overflow-x-auto max-h-48 cursor-text">
                  <code>{m.code}</code>
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};