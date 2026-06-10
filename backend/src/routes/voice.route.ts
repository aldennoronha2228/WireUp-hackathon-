// ??$$$ group 2 - Ideation Stage (Phase 1)
// @ts-nocheck
import express from "express";
import { protectRoute } from "../middleware/auth.middleware";
import { getVoiceHealth, synthesizeAudio, transcribeAudio, transcribeWithWhisperController } from "../controllers/voice.controller";

const router = express.Router();

router.get("/voice/health", getVoiceHealth);
router.post("/voice/stt", protectRoute, transcribeAudio);
router.post("/voice/stt/whisper", transcribeWithWhisperController);
router.post("/voice/tts", protectRoute, synthesizeAudio);

export default router;
