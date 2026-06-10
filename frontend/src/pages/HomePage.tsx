//this file is inspected and needs to be re inspected once complete traversal is done
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import wireupLogo from "../assets/wireup-logo.jpeg";
import { DiscoveryModal } from "../components/DiscoveryModal/DiscoveryModal";

// ── Inline Auth Modal ─────────────────────────────────────────────────────────
function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { login, signup } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [data, setData] = useState({ email: "", password: "", fullName: "" });
  const [loading, setLoading] = useState(false);

  const canSubmit = isLogin
    ? Boolean(data.email.trim() && data.password)
    : Boolean(data.fullName.trim() && data.email.trim() && data.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      await (isLogin ? login(data) : signup(data));
      onSuccess();
    } catch {
      // store handles toast
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full rounded-xl px-4 py-3 text-sm outline-none border transition bg-white/5 border-white/10 text-[#f0f0f5] placeholder:text-[#8888a8] focus:border-[#c8a0e0]/50";

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Card */}
      <div
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111118] p-8 shadow-2xl"
        style={{ boxShadow: "0 0 0 1px rgba(200,160,224,0.08), 0 24px 64px rgba(0,0,0,0.7)" }}
      >
        {/* Logo + close */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img src={wireupLogo} alt="Wireup" className="h-7 w-7 object-contain rounded-md" />
            <span className="type-brand text-[#f0f0f5]">Wireup</span>
          </div>
          <button onClick={onClose} className="text-[#8888a8] hover:text-[#f0f0f5] transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Heading */}
        <h2 className="type-hero-sub text-[#f0f0f5] mb-1">
          {isLogin ? "Welcome back" : "Create your account"}
        </h2>
        <p className="text-sm text-[#8888a8] mb-6">
          {isLogin ? "Sign in to build your project." : "Sign up to start building."}
        </p>

        {/* Toggle */}
        <div className="flex rounded-xl bg-white/5 p-1 mb-6">
          {["Login", "Sign up"].map((label, i) => (
            <button
              key={label}
              onClick={() => setIsLogin(i === 0)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                (i === 0) === isLogin
                  ? "bg-[#c8a0e0]/20 text-[#c8a0e0]"
                  : "text-[#8888a8] hover:text-[#f0f0f5]"
              }`}
            >{label}</button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!isLogin && (
            <input
              placeholder="Full name"
              value={data.fullName}
              onChange={e => setData({ ...data, fullName: e.target.value })}
              className={inputCls}
            />
          )}
          <input
            placeholder="Email"
            type="email"
            value={data.email}
            onChange={e => setData({ ...data, email: e.target.value })}
            className={inputCls}
          />
          <input
            placeholder="Password"
            type="password"
            value={data.password}
            onChange={e => setData({ ...data, password: e.target.value })}
            className={inputCls}
          />

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full mt-2 rounded-xl py-3 text-sm font-semibold transition-all bg-white text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-[#8888a8] disabled:cursor-not-allowed"
          >
            {loading
              ? <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              : isLogin ? "Login" : "Create account"
            }
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[11px] text-[#8888a8]">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Google */}
        <a
          href={`${import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000"}/api/auth/google`}
          className="flex w-full items-center justify-center gap-3 rounded-xl py-3 text-sm font-semibold transition-all bg-white text-black hover:bg-white/90"
        >
          <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </a>
      </div>
    </div>
  );
}

type Project = { _id: string; description: string; createdAt: string };
type SettingsForm = {
  fullName: string; email: string;
  newPassword: string; confirmPassword: string;
};

// ── Waveform bars (shown while recording) ────────────────────────────────────
const BAR_COUNT = 40;

// Shared audio data — hook writes a single RMS amplitude value each frame
const audioDataBuffer = {
  rms: 0,
  active: false,
};

function WaveformBars() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef       = useRef<number>(0);
  // Scrolling ring buffer — history of amplitudes, newest at end
  const historyRef   = useRef<Float32Array>(new Float32Array(BAR_COUNT).fill(0));
  const smoothRef    = useRef<Float32Array>(new Float32Array(BAR_COUNT).fill(0));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Build bars imperatively
    container.innerHTML = "";
    const bars: HTMLDivElement[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const bar = document.createElement("div");
      bar.style.cssText = `
        flex: 1;
        max-width: 6px;
        min-height: 3px;
        height: 3px;
        border-radius: 9999px;
        background: linear-gradient(to top, #b04090, #c8a0e0);
        opacity: 0.25;
      `;
      container.appendChild(bar);
      bars.push(bar);
    }

    let frameCount = 0;
    const PUSH_EVERY = 2; // push a new sample every N frames (~30 new values/sec)

    const draw = () => {
      frameCount++;

      if (frameCount % PUSH_EVERY === 0) {
        // Shift history left, push newest RMS on the right
        const hist = historyRef.current;
        hist.copyWithin(0, 1);
        hist[BAR_COUNT - 1] = audioDataBuffer.rms;
      }

      // Smooth display values toward history values
      const hist   = historyRef.current;
      const smooth = smoothRef.current;
      for (let i = 0; i < BAR_COUNT; i++) {
        const target = hist[i];
        const factor = target > smooth[i] ? 0.25 : 0.15; // fast attack, slightly slower decay
        smooth[i] = smooth[i] + (target - smooth[i]) * (1 - factor);

        const h = Math.max(3, smooth[i] * 64);
        bars[i].style.height  = `${h}px`;
        bars[i].style.opacity = String(Math.min(1, 0.2 + smooth[i] * 0.8));
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      container.innerHTML = "";
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex items-end justify-between gap-[3px] w-full px-3"
      style={{ height: "64px" }}
    />
  );
}

// ── useMicRecorder hook ───────────────────────────────────────────────────────
function useMicRecorder(onTranscript: (text: string) => void) {
  const [isRecording, setIsRecording]       = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const streamRef    = useRef<MediaStream | null>(null);
  const contextRef   = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const mediaRecRef  = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<Blob[]>([]);

  // Write RMS amplitude into shared buffer — WaveformBars reads it independently
  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    // Time-domain RMS — direct measure of loudness, responds instantly
    const timeDomain = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(timeDomain);
    let sum = 0;
    for (let s = 0; s < timeDomain.length; s++) {
      const n = (timeDomain[s] - 128) / 128;
      sum += n * n;
    }
    const rms = Math.sqrt(sum / timeDomain.length);
    // Boost quieter voices — apply mild gamma so whispers still show
    audioDataBuffer.rms = Math.pow(Math.min(rms * 3.5, 1), 0.6);

    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  // Send recorded blob to Whisper
  const sendToWhisper = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const arrayBuf = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const mimeType = blob.type || "audio/webm";
      const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "webm";

      const { axiosInstance } = await import("../lib/axios");
      const { data } = await axiosInstance.post("/voice/stt/whisper", {
        audioBase64: base64,
        mimeType,
        filename: `recording.${ext}`,
      });

      if (data.transcript) {
        onTranscript(data.transcript);
      } else {
        toast.error("No speech detected. Try again.");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Transcription failed";
      toast.error(msg);
    } finally {
      setIsTranscribing(false);
    }
  }, [onTranscript]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Waveform visualiser
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;           // 512 bins — lower latency than 2048
      analyser.smoothingTimeConstant = 0; // no browser smoothing, we do it ourselves
      analyser.minDecibels = -85;
      analyser.maxDecibels = -10;
      ctx.createMediaStreamSource(stream).connect(analyser);
      contextRef.current  = ctx;
      analyserRef.current = analyser;
      audioDataBuffer.rms    = 0;
      audioDataBuffer.active = true;
      // MediaRecorder for capturing audio data
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        sendToWhisper(blob);
      };
      recorder.start();
      mediaRecRef.current = recorder;

      setIsRecording(true);
      animFrameRef.current = requestAnimationFrame(tick);
    } catch {
      toast.error("Microphone access denied.");
    }
  }, [tick, sendToWhisper]);

  const stopRecording = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    mediaRecRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    contextRef.current?.close();
    streamRef.current = null;
    contextRef.current = null;
    analyserRef.current = null;
    mediaRecRef.current = null;
    audioDataBuffer.rms    = 0;
    audioDataBuffer.active = false;
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    isRecording ? stopRecording() : startRecording();
  }, [isRecording, startRecording, stopRecording]);

  useEffect(() => () => { stopRecording(); }, [stopRecording]);

  return { isRecording, isTranscribing, toggleRecording };
}



// ── Project row (shared sidebar + drawer) ────────────────────────────────────
function ProjectRow({
  project, onDiscovery, onFormulation, onOpen, onEdit, onDelete, isActive, onClick,
}: {
  project: Project;
  onDiscovery: () => void; onFormulation: () => void;
  onOpen: () => void; onEdit: () => void; onDelete: () => void;
  isActive: boolean; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group flex flex-col px-3 py-3.5 cursor-pointer transition-colors rounded-xl ${
        isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.04] active:bg-white/[0.06]"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <span className="text-[13px] font-medium leading-snug line-clamp-2 text-[#f0f0f5]">
          {project.description}
        </span>
        {/* Actions — always visible on mobile, hover on desktop */}
        <div className="flex gap-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0 pt-0.5">
          <button onClick={e => { e.stopPropagation(); onOpen(); }} title="Open"
            className="transition-colors text-[#8888a8] hover:text-[#c8a0e0] p-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit(); }} title="Rename"
            className="transition-colors text-[#8888a8] hover:text-[#c8a0e0] p-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} title="Delete"
            className="transition-colors text-[#8888a8] hover:text-red-400 p-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={e => { e.stopPropagation(); onDiscovery(); }}
          className="flex-1 rounded-lg border border-white/10 py-2 text-[11px] font-medium transition-colors text-[#8888a8] hover:bg-white/5 hover:text-[#f0f0f5] active:bg-white/10">
          Discovery
        </button>
        <button onClick={e => { e.stopPropagation(); onFormulation(); }}
          className="flex-1 rounded-lg border border-white/10 py-2 text-[11px] font-medium transition-colors text-[#8888a8] hover:bg-white/5 hover:text-[#f0f0f5] active:bg-white/10">
          Formulation
        </button>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();
  const { authUser, logout, updateUser } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const dark = theme === "dark";

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mobile drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [discoveryIdea, setDiscoveryIdea] = useState("");
  const [discoveryProjectId, setDiscoveryProjectId] = useState<string | undefined>(undefined);
  const [discoveryPhase, setDiscoveryPhase] = useState<1 | 2 | undefined>(undefined);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const pendingIdeaRef = useRef<string>("");

  const [settingsForm, setSettingsForm] = useState<SettingsForm>({
    fullName: authUser?.fullName || "", email: authUser?.email || "",
    newPassword: "", confirmPassword: "",
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    setSettingsForm({ fullName: authUser?.fullName || "", email: authUser?.email || "", newPassword: "", confirmPassword: "" });
  }, [authUser]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false); setShowSettings(false);
      }
    };
    if (showProfileMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showProfileMenu]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 100), 200)}px`;
  }, [inputValue]);

  useEffect(() => {
    if (!authUser) { setLoading(false); return; }
    (async () => {
      try {
        const res = await axiosInstance.get<Project[]>("/projects");
        setProjects(Array.isArray(res.data) ? res.data : []);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || "Failed to load projects");
      } finally { setLoading(false); }
    })();
  }, [authUser]);

  // Close drawer when navigating
  const handleNavAction = (fn: () => void) => {
    setDrawerOpen(false);
    fn();
  };

  const handleSubmitAgenticInput = async () => {
    if (!inputValue.trim()) return;
    if (!authUser) {
      pendingIdeaRef.current = inputValue.trim();
      setShowAuthModal(true);
      return;
    }
    // Skip the DiscoveryModal entirely — create project and go straight to workspace
    setIsCreating(true);
    try {
      const res = await axiosInstance.post<{ _id: string }>("/projects", {
        description: inputValue.trim(),
      });
      navigate(`/project/${res.data._id}`, {
        state: { prompt: inputValue.trim() },
      });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditProject = async (project: Project) => {
    const next = window.prompt("Rename project", project.description);
    if (!next || next.trim() === project.description) return;
    try {
      await axiosInstance.put(`/project/${project._id}`, { description: next.trim() });
      setProjects(prev => prev.map(p => p._id === project._id ? { ...p, description: next.trim() } : p));
      toast.success("Project renamed");
    } catch (e: any) { toast.error(e?.response?.data?.error || "Failed to rename"); }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!window.confirm(`Delete "${project.description}"?`)) return;
    try {
      await axiosInstance.delete(`/project/${project._id}`);
      setProjects(prev => prev.filter(p => p._id !== project._id));
      if (activeProjectId === project._id) setActiveProjectId(null);
      toast.success("Deleted");
    } catch (e: any) { toast.error(e?.response?.data?.error || "Failed to delete"); }
  };

  const handleLogout = async () => { await logout(); navigate("/"); };

  const handleSaveSettings = async () => {
    if (settingsForm.newPassword && settingsForm.newPassword !== settingsForm.confirmPassword) {
      toast.error("Passwords do not match"); return;
    }
    try {
      setIsSavingSettings(true);
      const payload: any = { fullName: settingsForm.fullName, email: settingsForm.email };
      if (settingsForm.newPassword) payload.newPassword = settingsForm.newPassword;
      await updateUser(payload);
      setShowSettings(false); setShowProfileMenu(false);
      toast.success("Account updated");
    } catch (e: any) { toast.error(e?.response?.data?.error || "Failed to update");
    } finally { setIsSavingSettings(false); }
  };

  const initial = authUser?.fullName?.charAt(0).toUpperCase() || "U";
  const inputCls = "w-full rounded-md px-3 py-2 text-sm outline-none border transition bg-[#0a0a0f] border-white/10 text-[#f0f0f5] placeholder:text-[#8888a8] focus:border-[#c8a0e0]/60";

  const { isRecording, isTranscribing, toggleRecording } = useMicRecorder(
    (text) => setInputValue(prev => prev ? `${prev} ${text}` : text)
  );

  // ── Shared sidebar/drawer content ─────────────────────────────────────────
  const SidebarContent = ({ inDrawer = false }: { inDrawer?: boolean }) => (
    <>
      {/* Logo */}
      <div className="px-5 py-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src={wireupLogo} alt="Wireup" className="h-8 w-8 object-contain rounded-md flex-shrink-0" />
          <p className="type-brand text-[#f0f0f5]">Wireup</p>
        </div>
        {inDrawer && (
          <button onClick={() => setDrawerOpen(false)} className="p-2 text-[#8888a8] hover:text-[#f0f0f5] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5 mt-1">
        {!authUser ? (
          /* Guest state */
          <div className="px-4 pt-6 flex flex-col items-start gap-3">
            <p className="text-xs text-[#8888a8] leading-relaxed">
              Sign in to save and manage your projects.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="rounded-lg px-4 py-2 text-xs font-semibold bg-white text-black hover:bg-white/90 transition-colors"
            >
              Sign in
            </button>
          </div>
        ) : (
          <>
            {loading && (
              <div className="space-y-3 px-3 pt-1">
                {[1, 2, 3].map(n => (
                  <div key={n} className="h-24 rounded-xl animate-pulse bg-white/5" />
                ))}
              </div>
            )}
            {!loading && projects.length === 0 && (
              <div className="px-4 pt-4">
                <p className="text-xs text-[#8888a8]">No projects yet. Start by describing what you want to build.</p>
              </div>
            )}
            {!loading && projects.map(project => (
              <ProjectRow
                key={project._id}
                project={project}
                isActive={activeProjectId === project._id}
                onClick={() => setActiveProjectId(project._id === activeProjectId ? null : project._id)}
                onOpen={() => handleNavAction(() => navigate(`/project/${project._id}`))}
                onDiscovery={() => handleNavAction(() => { setDiscoveryProjectId(project._id); setDiscoveryPhase(1); setShowDiscoveryModal(true); })}
                onFormulation={() => handleNavAction(() => { setDiscoveryProjectId(project._id); setDiscoveryPhase(2); setShowDiscoveryModal(true); })}
                onEdit={() => handleEditProject(project)}
                onDelete={() => handleDeleteProject(project)}
              />
            ))}
          </>
        )}
      </div>

      {/* Profile / Guest footer */}
      <div className="p-3 border-t border-white/[0.07]" ref={inDrawer ? undefined : profileRef}>
        {!authUser ? (
          /* Guest footer */
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-[#8888a8]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <p className="text-xs text-[#8888a8] flex-1">Guest</p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-xs font-medium text-[#c8a0e0] hover:text-[#f0f0f5] transition-colors"
            >
              Sign in →
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => { setShowProfileMenu(v => !v); setShowSettings(false); }}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-white/5 active:bg-white/10"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold bg-[#c8a0e0]/20 text-[#c8a0e0]">
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate text-[#f0f0f5]">{authUser?.fullName || "User"}</p>
                <p className="text-[10px] text-[#8888a8] truncate">{authUser?.email || ""}</p>
              </div>
              <svg className="w-3.5 h-3.5 text-[#8888a8] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showProfileMenu && (
          <div className={`${inDrawer ? "relative mt-2" : "absolute bottom-16 left-3 right-3"} rounded-xl border border-white/10 shadow-2xl overflow-hidden z-50 bg-[#111118]`}>
            {!showSettings ? (
              <div className="p-1.5 space-y-0.5">
                {[
                  { label: "Account settings", action: () => setShowSettings(true) },
                  { label: `${dark ? "Light" : "Dark"} mode`, action: () => { toggleTheme(); setShowProfileMenu(false); } },
                ].map(({ label, action }) => (
                  <button key={label} onClick={action}
                    className="w-full rounded-md px-3 py-2.5 text-left text-xs font-medium transition-colors text-[#f0f0f5] hover:bg-white/5">
                    {label}
                  </button>
                ))}
                <div className="my-1 border-t border-white/10" />
                <button onClick={handleLogout}
                  className="w-full rounded-md px-3 py-2.5 text-left text-xs font-medium transition-colors text-red-400 hover:bg-white/5">
                  Logout
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
                  <button onClick={() => setShowSettings(false)}
                    className="flex h-5 w-5 items-center justify-center rounded transition-colors text-[#8888a8] hover:bg-white/5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-xs font-medium text-[#f0f0f5]">Settings</span>
                </div>
                <div className="p-3 space-y-3">
                  {[
                    { label: "Full name", type: "text",     key: "fullName",    val: settingsForm.fullName,    ph: undefined },
                    { label: "Email",     type: "email",    key: "email",       val: settingsForm.email,       ph: undefined },
                    { label: "Password",  type: "password", key: "newPassword", val: settingsForm.newPassword, ph: "Leave blank to keep" },
                  ].map(({ label, type, key, val, ph }) => (
                    <div key={key}>
                      <label className="text-[10px] block mb-1 text-[#8888a8]">{label}</label>
                      <input type={type} value={val} placeholder={ph}
                        onChange={e => setSettingsForm({ ...settingsForm, [key]: e.target.value })}
                        className={inputCls} />
                    </div>
                  ))}
                  {settingsForm.newPassword && (
                    <div>
                      <label className="text-[10px] block mb-1 text-[#8888a8]">Confirm Password</label>
                      <input type="password" value={settingsForm.confirmPassword}
                        onChange={e => setSettingsForm({ ...settingsForm, confirmPassword: e.target.value })}
                        className={inputCls} />
                    </div>
                  )}
                  <button onClick={handleSaveSettings} disabled={isSavingSettings}
                    className="w-full rounded-md py-2.5 text-xs font-semibold text-black transition mt-2 bg-white hover:bg-white/90 disabled:opacity-50">
                    {isSavingSettings ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#0a0a0f]">

      {/* ── Mobile drawer overlay ─────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer panel ───────────────────────────────────────── */}
      <div className={`
        fixed inset-y-0 left-0 z-50 flex flex-col w-[80vw] max-w-xs
        bg-[#0d0d12] border-r border-white/[0.07]
        transition-transform duration-300 ease-in-out
        md:hidden
        ${drawerOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <SidebarContent inDrawer />
      </div>

      {/* ── Desktop sidebar (hidden on mobile) ───────────────────────── */}
      <aside className="relative z-10 hidden md:flex w-64 flex-shrink-0 flex-col border-r border-white/[0.07] bg-[#0d0d12]">
        <SidebarContent />
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────── */}
      <main className="relative flex flex-1 flex-col overflow-hidden">

        {/* Mobile top bar */}
        <header className="relative z-10 flex md:hidden items-center justify-between px-4 py-3 border-b border-white/[0.07] bg-[#0d0d12]/80 backdrop-blur-sm flex-shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-2 text-[#8888a8] hover:text-[#f0f0f5] transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <img src={wireupLogo} alt="Wireup" className="h-6 w-6 object-contain rounded" />
            <span className="text-sm font-bold text-[#f0f0f5]" style={{ fontFamily: "var(--font-sans)", letterSpacing: "-0.01em" }}>Wireup</span>
          </div>
          <button
            onClick={() => { setShowProfileMenu(v => !v); setShowSettings(false); }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold bg-[#c8a0e0]/20 text-[#c8a0e0]"
          >
            {initial}
          </button>
        </header>

        {/* Mobile profile menu (top right) */}
        {showProfileMenu && (
          <div className="md:hidden absolute top-14 right-3 z-50 w-56 rounded-xl border border-white/10 shadow-2xl overflow-hidden bg-[#111118]">
            {!showSettings ? (
              <div className="p-1.5 space-y-0.5">
                {[
                  { label: "Account settings", action: () => setShowSettings(true) },
                  { label: `${dark ? "Light" : "Dark"} mode`, action: () => { toggleTheme(); setShowProfileMenu(false); } },
                ].map(({ label, action }) => (
                  <button key={label} onClick={action}
                    className="w-full rounded-md px-3 py-2.5 text-left text-xs font-medium text-[#f0f0f5] hover:bg-white/5">
                    {label}
                  </button>
                ))}
                <div className="my-1 border-t border-white/10" />
                <button onClick={handleLogout} className="w-full rounded-md px-3 py-2.5 text-left text-xs font-medium text-red-400 hover:bg-white/5">
                  Logout
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
                  <button onClick={() => setShowSettings(false)} className="flex h-5 w-5 items-center justify-center text-[#8888a8]">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-xs font-medium text-[#f0f0f5]">Settings</span>
                </div>
                <div className="p-3 space-y-3">
                  {[
                    { label: "Full name", type: "text",     key: "fullName",    val: settingsForm.fullName,    ph: undefined },
                    { label: "Email",     type: "email",    key: "email",       val: settingsForm.email,       ph: undefined },
                    { label: "Password",  type: "password", key: "newPassword", val: settingsForm.newPassword, ph: "Leave blank to keep" },
                  ].map(({ label, type, key, val, ph }) => (
                    <div key={key}>
                      <label className="text-[10px] block mb-1 text-[#8888a8]">{label}</label>
                      <input type={type} value={val} placeholder={ph}
                        onChange={e => setSettingsForm({ ...settingsForm, [key]: e.target.value })}
                        className={inputCls} />
                    </div>
                  ))}
                  {settingsForm.newPassword && (
                    <div>
                      <label className="text-[10px] block mb-1 text-[#8888a8]">Confirm Password</label>
                      <input type="password" value={settingsForm.confirmPassword}
                        onChange={e => setSettingsForm({ ...settingsForm, confirmPassword: e.target.value })}
                        className={inputCls} />
                    </div>
                  )}
                  <button onClick={handleSaveSettings} disabled={isSavingSettings}
                    className="w-full rounded-md py-2.5 text-xs font-semibold text-black bg-white hover:bg-white/90 disabled:opacity-50">
                    {isSavingSettings ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Purple-pink radial glow — breathing + drifting */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          <div className="glow-orb" />
        </div>

        {/* ── Desktop: centered layout ──────────────────────────────── */}
        <div className="relative z-10 hidden md:flex flex-1 flex-col overflow-y-auto">
          {/* Push content to upper-center like the reference (not dead center) */}
          <div className="flex flex-col items-center px-8 pt-[12vh] pb-16">
            <div className="w-full max-w-2xl flex flex-col items-center">

              {/* Kicker badge */}
              <div className="mb-6 px-4 py-1.5 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm">
                <span className="type-kicker text-[rgba(238,232,240,0.66)]">Wireup AI</span>
              </div>

              {/* Heading */}
              <h1 className="type-hero mb-5 text-center text-[#f0f0f5] leading-[1.05]">
                Your AI copilot for{" "}
                <em className="accent-serif">hardware</em>
              </h1>

              {/* Sub */}
              <p className="type-hero-sub text-center mb-12" style={{ color: "rgba(238,232,240,0.46)", maxWidth: "34rem" }}>
                From idea to working prototype — design, simulate, and deploy in minutes.
              </p>

              {/* Chatbox */}
              <div
                className={`w-full rounded-2xl border flex flex-col transition-all bg-[#111118]/80 backdrop-blur-sm ${
                  isRecording ? "border-[#c8a0e0]/50" : "border-white/10 focus-within:border-[#c8a0e0]/40"
                }`}
                style={{ boxShadow: isRecording
                  ? "0 0 0 1px rgba(200,160,224,0.15), 0 8px 40px rgba(176,64,144,0.25)"
                  : "0 0 0 1px rgba(200,160,224,0.05), 0 8px 40px rgba(0,0,0,0.5)"
                }}
              >
                {/* Recording waveform OR textarea */}
                {isRecording ? (
                  <div className="w-full px-5 pt-5 pb-2" style={{ minHeight: "130px", display: "flex", alignItems: "center" }}>
                    <WaveformBars />
                  </div>
                ) : (
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmitAgenticInput(); } }}
                    placeholder="What do you want to build today?"
                    disabled={isCreating}
                    className="w-full resize-none bg-transparent px-5 pt-5 pb-3 outline-none type-form-input disabled:opacity-50 text-[#f0f0f5] placeholder:text-[#8888a8]"
                    style={{ minHeight: "130px", maxHeight: "280px" }}
                  />
                )}
                <div className="flex items-center justify-between px-4 pb-4 gap-3">
                  <div className="flex flex-wrap gap-2">
                    {!isRecording && ["Arduino Projects", "ESP32 Projects", "IoT Systems", "Robotics"].map(action => (
                      <button key={action}
                        onClick={() => setInputValue(prev => prev ? `${prev} ${action}` : action)}
                        className="rounded-full border border-white/10 px-3 py-1.5 type-nav text-[#8888a8] hover:bg-white/5 hover:text-[#f0f0f5] transition-colors">
                        {action}
                      </button>
                    ))}
                    {isRecording && (
                      <span className="text-xs text-[#c8a0e0] flex items-center gap-1.5">
                        {isTranscribing ? (
                          <>
                            <span className="h-3 w-3 rounded-full border-2 border-[#c8a0e0] border-t-transparent animate-spin" />
                            Transcribing…
                          </>
                        ) : (
                          <>
                            <span className="inline-block h-2 w-2 rounded-full bg-[#c8a0e0] animate-pulse" />
                            Listening…
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Mic */}
                    <button
                      onClick={toggleRecording}
                      disabled={isTranscribing}
                      title={isTranscribing ? "Transcribing…" : isRecording ? "Stop recording" : "Voice input"}
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                        isTranscribing
                          ? "bg-[#c8a0e0]/10 text-[#c8a0e0] cursor-wait"
                          : isRecording
                          ? "bg-[#c8a0e0]/20 text-[#c8a0e0] hover:bg-[#c8a0e0]/30"
                          : "text-[#8888a8] hover:bg-white/5 hover:text-[#f0f0f5]"
                      }`}
                    >
                      {isTranscribing ? (
                        <span className="h-4 w-4 rounded-full border-2 border-[#c8a0e0] border-t-transparent animate-spin" />
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                          <line x1="12" y1="19" x2="12" y2="23"/>
                        </svg>
                      )}
                    </button>
                    {/* Send */}
                    <button
                      onClick={handleSubmitAgenticInput}
                      disabled={isCreating || !inputValue.trim()}
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                        inputValue.trim() && !isCreating ? "bg-white text-black hover:bg-white/90" : "bg-white/10 text-[#8888a8] cursor-not-allowed"
                      }`}
                    >
                      {isCreating
                        ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      }
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── Mobile: heading + bottom-pinned input ─────────────────── */}
        <div className="relative z-10 flex md:hidden flex-1 flex-col overflow-hidden">
          {/* Hero text — upper portion, not dead center */}
          <div className="flex flex-col items-center px-6 pt-10 pb-6 text-center">
            {/* Kicker */}
            <div className="mb-5 px-3 py-1 rounded-full border border-white/15 bg-white/5">
              <span className="text-[0.68rem] font-semibold tracking-[0.22em] uppercase text-[rgba(238,232,240,0.6)]"
                style={{ fontFamily: "var(--font-display)" }}>
                Wireup AI
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-[clamp(2.05rem,11vw,2.55rem)] font-normal leading-[1.08] text-[#f0f0f5] mb-4"
              style={{ fontFamily: "var(--font-display)" }}>
              Your AI copilot for{" "}
              <em style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>hardware</em>
            </h1>

            {/* Sub */}
            <p className="text-[0.92rem] font-medium leading-relaxed"
              style={{ color: "rgba(238,232,240,0.46)", fontFamily: "var(--font-display)", maxWidth: "22rem" }}>
              From idea to working prototype — design, simulate, and deploy in minutes.
            </p>
          </div>

          {/* Spacer pushes input to bottom */}
          <div className="flex-1" />

          {/* Bottom-pinned input card */}
          <div className="flex-shrink-0 px-3 pb-5 pt-2">
            <div
              className={`w-full rounded-2xl border flex flex-col backdrop-blur-md transition-all ${
                isRecording ? "border-[#c8a0e0]/50 bg-[#111118]/90" : "border-white/10 bg-[#111118]/90 focus-within:border-[#c8a0e0]/40"
              }`}
              style={{ boxShadow: isRecording
                ? "0 0 0 1px rgba(200,160,224,0.15), 0 -8px 40px rgba(176,64,144,0.2)"
                : "0 0 0 1px rgba(200,160,224,0.05), 0 -8px 40px rgba(0,0,0,0.4)"
              }}
            >
              {/* Waveform OR textarea */}
              {isRecording ? (
                <div className="w-full px-4 pt-4 pb-2" style={{ minHeight: "90px", display: "flex", alignItems: "center" }}>
                  <WaveformBars />
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmitAgenticInput(); } }}
                  placeholder="What do you want to build today?"
                  disabled={isCreating}
                  className="w-full resize-none bg-transparent px-4 pt-4 pb-2 outline-none text-[0.95rem] disabled:opacity-50 text-[#f0f0f5] placeholder:text-[#8888a8]"
                  style={{ minHeight: "90px", maxHeight: "160px", fontFamily: "var(--font-sans)" }}
                />
              )}

              {/* Chips OR listening indicator */}
              {!isRecording ? (
                <div className="overflow-x-auto px-3 pb-2 flex gap-2" style={{ WebkitOverflowScrolling: "touch" }}>
                  {["Arduino Projects", "ESP32 Projects", "IoT Systems", "Robotics"].map(action => (
                    <button key={action}
                      onClick={() => setInputValue(prev => prev ? `${prev} ${action}` : action)}
                      className="flex-shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#8888a8] hover:bg-white/5 active:bg-white/10 hover:text-[#f0f0f5] transition-colors whitespace-nowrap">
                      {action}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 pb-2">
                  <span className="text-xs text-[#c8a0e0] flex items-center gap-1.5">
                    {isTranscribing ? (
                      <>
                        <span className="h-3 w-3 rounded-full border-2 border-[#c8a0e0] border-t-transparent animate-spin" />
                        Transcribing…
                      </>
                    ) : (
                      <>
                        <span className="inline-block h-2 w-2 rounded-full bg-[#c8a0e0] animate-pulse" />
                        Listening…
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* Send row */}
              <div className="flex items-center justify-between px-3 pb-3 pt-1">
                <span className="text-[10px] text-[#8888a8]">Enter · Shift+Enter for new line</span>
                <div className="flex items-center gap-2">
                  {/* Mic */}
                  <button
                    onClick={toggleRecording}
                    disabled={isTranscribing}
                    title={isTranscribing ? "Transcribing…" : isRecording ? "Stop recording" : "Voice input"}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                      isTranscribing
                        ? "bg-[#c8a0e0]/10 text-[#c8a0e0] cursor-wait"
                        : isRecording
                        ? "bg-[#c8a0e0]/20 text-[#c8a0e0] hover:bg-[#c8a0e0]/30"
                        : "text-[#8888a8] hover:bg-white/5 hover:text-[#f0f0f5]"
                    }`}
                  >
                    {isTranscribing ? (
                      <span className="h-4 w-4 rounded-full border-2 border-[#c8a0e0] border-t-transparent animate-spin" />
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                      </svg>
                    )}
                  </button>
                  {/* Send */}
                  <button
                    onClick={handleSubmitAgenticInput}
                    disabled={isCreating || !inputValue.trim()}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                      inputValue.trim() && !isCreating ? "bg-white text-black" : "bg-white/10 text-[#8888a8] cursor-not-allowed"
                    }`}
                  >
                    {isCreating
                      ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Auth modal — shown when unauthenticated user tries to submit */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setShowAuthModal(false);
            // Continue with the idea the user typed before auth
            if (pendingIdeaRef.current) {
              const idea = pendingIdeaRef.current;
              pendingIdeaRef.current = "";
              // Go straight to workspace — no modal
              setIsCreating(true);
              axiosInstance.post<{ _id: string }>("/projects", { description: idea })
                .then(res => navigate(`/project/${res.data._id}`, { state: { prompt: idea } }))
                .catch(() => toast.error("Failed to create project"))
                .finally(() => setIsCreating(false));
            }
          }}
        />
      )}

      {/* Discovery modal */}
      {showDiscoveryModal && (
        <DiscoveryModal
          initialIdea={discoveryIdea}
          projectId={discoveryProjectId}
          initialPhase={discoveryPhase}
          onClose={() => {
            setShowDiscoveryModal(false);
            setDiscoveryIdea("");
            setDiscoveryProjectId(undefined);
            setDiscoveryPhase(undefined);
          }}
        />
      )}
    </div>
  );
}
