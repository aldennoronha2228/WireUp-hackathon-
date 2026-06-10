import React from "react";
import { AlertTriangle } from "lucide-react";

interface ProgressTrackerProps {
  isCompleted: boolean;
  isFailed: boolean;
  activeStage: string;
  dark: boolean;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  isCompleted,
  isFailed,
  activeStage,
  dark,
}) => {
  const stages = [
    { key: "requirements", label: "Requirements" },
    { key: "components", label: "Components" },
    { key: "wiring", label: "Wiring" },
    { key: "validation", label: "Validation" },
    { key: "curriculum", label: "Curriculum" },
  ];

  return (
    <div className="flex flex-wrap gap-x-1 gap-y-1 items-center">
      {stages.map((stage, idx) => {
        let status = "upcoming";
        if (isCompleted) {
          status = "done";
        } else if (isFailed && stage.key === activeStage) {
          status = "failed";
        } else if (stage.key === activeStage) {
          status = "active";
        } else {
          const stageOrder = [
            "requirements",
            "components",
            "wiring",
            "validation",
            "curriculum",
          ];
          const currentIdx = stageOrder.indexOf(activeStage);
          const thisIdx = stageOrder.indexOf(stage.key);
          if (thisIdx < currentIdx) status = "done";
        }

        return (
          <div key={stage.key} className="flex items-center gap-1">
            {idx > 0 && (
              <svg
                className={`h-3 w-3 mx-0.5 ${
                  status === "done" || status === "active"
                    ? dark
                      ? "text-slate-600"
                      : "text-slate-300"
                    : dark
                    ? "text-slate-800"
                    : "text-slate-200"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                status === "active"
                  ? dark
                    ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                    : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  : status === "done"
                  ? dark
                    ? "text-slate-400"
                    : "text-slate-500"
                  : status === "failed"
                  ? dark
                    ? "text-red-400"
                    : "text-red-500"
                  : dark
                  ? "text-slate-700"
                  : "text-slate-300"
              }`}
            >
              {status === "active" && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500" />
                </span>
              )}
              {status === "done" && (
                <svg
                  className={`h-3 w-3 ${
                    dark ? "text-slate-500" : "text-slate-400"
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              {status === "failed" && <AlertTriangle className="h-3 w-3" />}
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
