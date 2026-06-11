import dotenv from "dotenv";
dotenv.config(); // ← must be FIRST — loads .env before any other code reads process.env

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import path from "path";

import { connectDB } from "./lib/db";
import { startWhisperServer, stopWhisperServer, isWhisperRunning } from "./lib/whisper.manager";
import authRoutes from "./routes/auth.route";
import voiceRoutes from "./routes/voice.route";
import projectRoutes from "./routes/project.route";
import generateRoutes from "./routes/generate.route";
import chatRoutes     from "./routes/chat.route";
import questionRoutes from "./routes/questions.route";
import { configureGoogleStrategy } from "./controllers/googleAuth.controller";

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);

// ── Passport ─────────────────────────────────────────────────────────────────
configureGoogleStrategy();
app.use(passport.initialize());

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api", voiceRoutes);
app.use("/api", projectRoutes);
app.use("/api", generateRoutes);
app.use("/api", chatRoutes);
app.use("/api", questionRoutes);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || "development",
    whisper: isWhisperRunning() ? "running" : "stopped",
  });
});

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
connectDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`[server] Running on http://localhost:${PORT}`);
  });

  // Start Whisper STT sidecar
  startWhisperServer();

  // Graceful shutdown — kill Whisper child process too
  const shutdown = () => {
    console.log("\n[server] Shutting down…");
    stopWhisperServer();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 8_000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT",  shutdown);
});

export default app;
