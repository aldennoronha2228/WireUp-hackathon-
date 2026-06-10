import React from "react";

interface BomPanelProps {
  bom: any[];
  candidates: string[];
  dark: boolean;
}

export const BomPanel: React.FC<BomPanelProps> = ({ bom, candidates, dark }) => {
  return (
    <>
      {/* Confirmed BOM */}
      <div className={`border-t pt-5 ${dark ? "border-white/[0.06]" : "border-slate-100"}`}>
        <div className="flex items-center justify-between mb-3">
          <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${dark ? "text-slate-600" : "text-slate-400"}`}>
            Confirmed BOM
          </p>
          {bom.length > 0 && (
            <span className={`text-[10px] font-bold tabular-nums ${dark ? "text-slate-500" : "text-slate-400"}`}>
              {bom.length} parts
            </span>
          )}
        </div>
        {bom.length > 0 ? (
          <div className="space-y-1.5">
            {bom.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                  dark
                    ? "border-white/[0.06] bg-white/[0.025]"
                    : "border-slate-100 bg-slate-50"
                }`}
              >
                <span
                  className={`text-xs font-medium truncate max-w-[140px] ${
                    dark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  {item.displayName}
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    dark
                      ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                      : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                  }`}
                >
                  ✓
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className={`text-xs italic ${dark ? "text-slate-700" : "text-slate-400"}`}>
            No parts finalized yet.
          </p>
        )}
      </div>

      {/* Candidate parts */}
      {candidates.length > 0 && (
        <div className={`border-t pt-5 ${dark ? "border-white/[0.06]" : "border-slate-100"}`}>
          <p className={`text-[10px] font-bold uppercase tracking-[0.18em] mb-3 ${dark ? "text-slate-600" : "text-slate-400"}`}>
            Evaluating Candidates
          </p>
          <div className="space-y-1.5">
            {candidates.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between rounded-xl border border-dashed px-3 py-2 ${
                  dark ? "border-white/[0.06]" : "border-slate-200"
                }`}
              >
                <span
                  className={`text-xs truncate max-w-[140px] font-mono ${
                    dark ? "text-slate-500" : "text-slate-500"
                  }`}
                >
                  {item}
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    dark
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-amber-50 text-amber-600 border border-amber-100"
                  }`}
                >
                  …
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
