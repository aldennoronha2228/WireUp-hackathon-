import React from "react";
import { MilestoneCard } from "../components/MilestoneCard";

interface MilestonesPanelProps {
  milestones: any[];
}

export const MilestonesPanel: React.FC<MilestonesPanelProps> = ({ milestones }) => {
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">
        Project Roadmap
      </div>
      {milestones.length > 0 ? (
        <div className="space-y-2">
          {milestones.map((m, idx) => (
            <MilestoneCard key={idx} m={m} idx={idx} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-650 italic">
          Roadmap milestones will appear as they are designed.
        </div>
      )}
    </div>
  );
};
