import React from "react";
import { Cpu, Database } from "lucide-react";

interface HardwareAssemblyProps {
  bom: any[];
  wiring: any[];
  context: any;
}

export const HardwareAssembly = ({
  bom,
  wiring,
  context
}: HardwareAssemblyProps) => {
    return (
      <div className="border border-zinc-800 bg-zinc-900/10 rounded-xl p-6 min-h-[220px] flex flex-col justify-between">
        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-4 flex justify-between items-center select-none">
          <span>Live Assembly Canvas</span>
          <span className="text-zinc-400">Total BOM Parts: {bom.length}</span>
        </div>

        {bom.length === 0 ? (
          <div className="flex-grow flex items-center justify-center text-zinc-600 text-xs italic py-10">
            Waiting for agent to source components...
          </div>
        ) : (
          <div className="flex-grow flex flex-col sm:flex-row gap-6 items-center justify-around py-2 w-full">
            {/* Compute Brain (ESP32/MCU) */}
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 min-w-[120px] shadow-lg shadow-blue-500/5 select-none">
              <Cpu className="h-6 w-6 text-blue-400" />
              <div className="text-xs font-bold text-zinc-200">MCU</div>
              <div className="text-[9px] text-zinc-400 font-mono">{context.mcu || "ESP32"}</div>
            </div>

            {/* Connection Vectors */}
            <div className="flex-1 max-w-[200px] flex flex-col gap-2 font-mono text-[9px] text-zinc-500 border-y border-dashed border-zinc-800 py-3 w-full select-none">
              {wiring.length === 0 ? (
                bom.filter(b => b.key !== "mcu" && b.key !== "brain").map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-zinc-600 italic">
                    <span>mcu</span>
                    <span className="text-zinc-700 animate-pulse">- - - -</span>
                    <span>{item.key}</span>
                  </div>
                ))
              ) : (
                wiring.slice(0, 5).map((w, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-blue-400">{w.from.split(".")[1] || w.from}</span>
                    <span className="text-zinc-750 font-sans">════</span>
                    <span className="text-emerald-450">{w.to.split(".")[0] || w.to}</span>
                  </div>
                ))
              )}
              {wiring.length > 5 && (
                <div className="text-center text-[8px] text-zinc-650 italic pt-1 border-t border-zinc-900/60">
                  +{wiring.length - 5} more connections active
                </div>
              )}
            </div>

            {/* Connected Subsystems */}
            <div className="flex flex-col gap-2.5 min-w-[150px]">
              {bom.filter(b => b.key !== "mcu" && b.key !== "brain").length === 0 ? (
                <div className="text-zinc-650 text-[10px] italic select-none">No peripheral components added.</div>
              ) : (
                bom.filter(b => b.key !== "mcu" && b.key !== "brain").map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-zinc-850 bg-zinc-900/25 select-none">
                    <Database className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-zinc-300 truncate">{item.displayName}</div>
                      <div className="text-[9px] text-zinc-500 truncate font-mono">{item.purpose}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };