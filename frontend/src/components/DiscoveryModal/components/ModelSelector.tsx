// components/ModelSelector.tsx
import React from "react";
import { HardDrive, Layers } from "lucide-react";

interface ModelSelectorProps {
  dark: boolean;
  textHead: string;
  textSub: string;
  initialIdea: string;
  model: string;
  setModel: React.Dispatch<React.SetStateAction<string>>;
  hybridPrimary: string;
  setHybridPrimary: React.Dispatch<React.SetStateAction<string>>;
  handleStartSession: () => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  initialIdea,
  model,
  setModel,
  hybridPrimary,
  setHybridPrimary,
  handleStartSession,
}) => {
  const isOllama = model === "ollama/minimax-m3:cloud";
  const isHybrid = model === "hybrid";

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-6 bg-[#0a0a0f]">

      {/* Breathing glow — same as homepage */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="glow-orb" />
      </div>

      <div className="relative z-10 w-full max-w-lg">

        {/* Badge */}
        <div className="flex justify-center mb-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[0.72rem] font-semibold uppercase tracking-widest text-[rgba(238,232,240,0.66)]"
            style={{ fontFamily: "var(--font-display)" }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c8a0e0] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#c8a0e0]" />
            </span>
            AI Hardware Studio
          </span>
        </div>

        {/* Heading */}
        <div className="text-center mb-10">
          <h2 className="text-[clamp(2.2rem,4vw,3rem)] font-normal leading-[1.08] mb-4 text-[#f0f0f5]"
            style={{ fontFamily: "var(--font-display)" }}>
            Configure your{" "}
            <em style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
              build pipeline
            </em>
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(238,232,240,0.46)", fontFamily: "var(--font-display)" }}>
            Building{" "}
            <span className="font-semibold text-[#f0f0f5]">"{initialIdea}"</span>
            <br />
            Choose your AI engine, then launch.
          </p>
        </div>

        {/* Mode cards */}
        <div className="space-y-3 mb-6">

          {/* Pure Ollama */}
          <button
            onClick={() => setModel("ollama/minimax-m3:cloud")}
            className={`group w-full flex items-center gap-5 rounded-2xl border p-5 text-left transition-all duration-200 ${
              isOllama
                ? "border-[#c8a0e0]/40 bg-[#c8a0e0]/8 shadow-lg shadow-[#c8a0e0]/10"
                : "border-white/[0.07] bg-white/[0.025] hover:border-[#c8a0e0]/25 hover:bg-white/[0.04]"
            }`}
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
              isOllama
                ? "border-[#c8a0e0]/40 bg-[#c8a0e0]/15 text-[#c8a0e0]"
                : "border-white/10 bg-white/5 text-[#8888a8]"
            }`}>
              <HardDrive className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[0.95rem] font-semibold tracking-tight ${isOllama ? "text-[#e0c8f5]" : "text-[#f0f0f5]"}`}>
                Pure Ollama
              </p>
              <p className="text-xs mt-0.5 text-[#8888a8]">
                minimax-m3:cloud · 100% local · Zero API limits
              </p>
            </div>
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
              isOllama ? "border-[#c8a0e0] bg-[#c8a0e0]" : "border-white/20"
            }`}>
              {isOllama && (
                <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 12 12">
                  <path d="M3.5 7L5.5 9L8.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </button>

          {/* Hybrid Cloud */}
          <div className={`w-full rounded-2xl border transition-all duration-200 overflow-hidden ${
            isHybrid
              ? "border-[#c8a0e0]/40 bg-[#c8a0e0]/8 shadow-lg shadow-[#c8a0e0]/10"
              : "border-white/[0.07] bg-white/[0.025] hover:border-[#c8a0e0]/25 hover:bg-white/[0.04]"
          }`}>
            <button
              onClick={() => setModel("hybrid")}
              className="w-full flex items-center gap-5 p-5 text-left"
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                isHybrid
                  ? "border-[#c8a0e0]/40 bg-[#c8a0e0]/15 text-[#c8a0e0]"
                  : "border-white/10 bg-white/5 text-[#8888a8]"
              }`}>
                <Layers className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[0.95rem] font-semibold tracking-tight ${isHybrid ? "text-[#e0c8f5]" : "text-[#f0f0f5]"}`}>
                  Hybrid Cloud
                </p>
                <p className="text-xs mt-0.5 text-[#8888a8]">
                  GROQ → GROQ_FALLBACK → Cerebras → Ollama
                </p>
              </div>
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                isHybrid ? "border-[#c8a0e0] bg-[#c8a0e0]" : "border-white/20"
              }`}>
                {isHybrid && (
                  <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 12 12">
                    <path d="M3.5 7L5.5 9L8.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </button>

            {isHybrid && (
              <div className="px-5 pb-5 border-t border-[#c8a0e0]/15">
                <label className="text-[10px] font-semibold uppercase tracking-widest block mt-4 mb-2 text-[#8888a8]">
                  Primary Cloud Provider
                </label>
                <select
                  value={hybridPrimary}
                  onChange={e => setHybridPrimary(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none text-[#f0f0f5] focus:border-[#c8a0e0]/50 transition-colors"
                >
                  <option value="meta-llama/llama-4-scout-17b-16e-instruct" className="bg-[#111118]">Groq · Llama 4 Scout</option>
                  <option value="qwen/qwen3-32b" className="bg-[#111118]">Groq · Qwen3-32B</option>
                  <option value="gpt-oss-120b" className="bg-[#111118]">Cerebras · gpt-oss-120b</option>
                  <option value="zai-glm-4.7" className="bg-[#111118]">Cerebras · zai-glm-4.7</option>
                </select>
                <p className="text-[10px] mt-2 leading-relaxed text-[#8888a8]/60">
                  Auto-failover: GROQ_API_KEY → GROQ_API_FALLBACK → CEREBRAS_API_KEY → Ollama
                </p>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleStartSession}
          className="group w-full flex items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-[0.95rem] font-semibold text-black hover:bg-white/90 transition-all active:scale-[0.99] shadow-xl shadow-black/30"
        >
          <svg className="h-5 w-5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Start AI Build
        </button>

        {/* Footnote */}
        <p className="mt-5 text-center text-[10px] text-[#8888a8]/50" style={{ fontFamily: "var(--font-sans)" }}>
          Discovery → Component Sourcing → Wiring → Curriculum — fully automated
        </p>

      </div>
    </div>
  );
};
