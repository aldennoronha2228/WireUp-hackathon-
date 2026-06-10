import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { axiosInstance } from "../../lib/axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

interface DiscoveryModalProps {
  initialIdea: string;
  projectId?: string;
  initialPhase?: 1 | 2;
  onClose: () => void;
}

export function DiscoveryModal({ initialIdea: idea, projectId, initialPhase: phase = 1, onClose }: DiscoveryModalProps) {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const handleStart = async () => {
    setIsCreating(true);
    try {
      let id = projectId;

      if (!id) {
        const res = await axiosInstance.post<{ _id: string }>("/projects", {
          description: idea,
        });
        id = res.data._id;
      }

      onClose();
      navigate(`/project/${id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111118] p-8 shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#c8a0e0]">
              {phase === 1 ? "Discovery" : "Formulation"}
            </span>
            <button
              onClick={onClose}
              className="p-1 text-[#8888a8] transition-colors hover:text-[#f0f0f5]"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <h2
            className="mt-2 text-2xl font-medium leading-snug text-[#f0f0f5]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {phase === 1 ? "Let's explore your idea" : "Refine your concept"}
          </h2>

          <p className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm italic text-[#8888a8]">
            "{idea}"
          </p>

          <p className="mt-4 text-sm leading-relaxed text-[#8888a8]">
            {phase === 1
              ? "We'll start by mapping out what you want to build — the core problem, users, and key features."
              : "Now we'll shape this into a concrete plan with requirements and architecture."}
          </p>

          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-medium text-[#8888a8] transition-colors hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={handleStart}
              disabled={isCreating}
              className="flex-1 rounded-xl bg-white py-3 text-sm font-semibold text-black transition-all hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-[#8888a8]"
            >
              {isCreating ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                "Start →"
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
