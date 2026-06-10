import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

// ── Config ────────────────────────────────────────────────────────────────────
const WHISPER_PORT    = process.env.WHISPER_PORT    || "8765";
const WHISPER_MODEL   = process.env.WHISPER_MODEL   || "base";
const WHISPER_DEVICE  = process.env.WHISPER_DEVICE  || "cpu";
const WHISPER_COMPUTE = process.env.WHISPER_COMPUTE || "int8";

// Path to server.py — two levels up from backend/src/lib → project root / whisper-server
const WHISPER_SCRIPT = path.resolve(
  __dirname,
  "..",   // src
  "..",   // backend
  "..",   // project root
  "whisper-server",
  "server.py"
);

const HEALTH_URL     = `http://127.0.0.1:${WHISPER_PORT}/health`;
const POLL_INTERVAL  = 1500;   // ms between health checks while starting
const MAX_WAIT_MS    = 60_000; // 60 s — model download can be slow on first run
const RESTART_DELAY  = 3_000;  // ms before restarting after unexpected exit

let child: ChildProcess | null = null;
let shuttingDown = false;
let restartTimer: ReturnType<typeof setTimeout> | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve python / python3 — whichever exists */
function findPython(): string {
  // On Windows python3 may not exist; try both
  return process.platform === "win32" ? "python" : "python3";
}

/** Poll /health until it responds 200 or we time out */
async function waitForHealth(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(HEALTH_URL);
      if (res.ok) return true;
    } catch {
      // not up yet — keep polling
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
  return false;
}

// ── Spawn ─────────────────────────────────────────────────────────────────────
function spawnWhisper(): void {
  if (shuttingDown) return;

  if (!fs.existsSync(WHISPER_SCRIPT)) {
    console.warn(`[Whisper] server.py not found at ${WHISPER_SCRIPT} — skipping auto-start.`);
    return;
  }

  const python = findPython();
  console.log(`[Whisper] Starting server.py  (model=${WHISPER_MODEL}, device=${WHISPER_DEVICE}, port=${WHISPER_PORT})…`);

  child = spawn(python, [WHISPER_SCRIPT], {
    env: {
      ...process.env,
      WHISPER_PORT,
      WHISPER_MODEL,
      WHISPER_DEVICE,
      WHISPER_COMPUTE,
    },
    // Don't inherit stdin; pipe stdout/stderr so we can prefix logs
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((l) => l && console.log(`[Whisper] ${l}`));
  });

  child.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((l) => l && console.error(`[Whisper][err] ${l}`));
  });

  child.on("error", (err) => {
    console.error(`[Whisper] Failed to start process: ${err.message}`);
    console.error(`[Whisper] Make sure Python and faster-whisper are installed:`);
    console.error(`[Whisper]   pip install faster-whisper flask flask-cors`);
    child = null;
  });

  child.on("exit", (code, signal) => {
    child = null;
    if (shuttingDown) return;
    if (code === 0) {
      console.log(`[Whisper] Process exited cleanly.`);
      return;
    }
    console.warn(`[Whisper] Process exited (code=${code}, signal=${signal}). Restarting in ${RESTART_DELAY / 1000}s…`);
    restartTimer = setTimeout(spawnWhisper, RESTART_DELAY);
  });

  // Poll health and log when ready
  waitForHealth(MAX_WAIT_MS).then((ok) => {
    if (ok) {
      console.log(`[Whisper] ✓ Ready on http://localhost:${WHISPER_PORT}`);
    } else {
      console.warn(`[Whisper] Did not respond to health check within ${MAX_WAIT_MS / 1000}s.`);
      console.warn(`[Whisper] Voice transcription will be unavailable until it starts.`);
    }
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startWhisperServer(): void {
  spawnWhisper();
}

export function stopWhisperServer(): void {
  shuttingDown = true;
  if (restartTimer) clearTimeout(restartTimer);
  if (child) {
    console.log("[Whisper] Shutting down…");
    child.kill("SIGTERM");
    // Force-kill after 5 s if it hasn't exited
    setTimeout(() => { if (child) child.kill("SIGKILL"); }, 5_000);
    child = null;
  }
}

export function isWhisperRunning(): boolean {
  return child !== null && !child.killed;
}
