import express from "express";
import { protectRoute } from "../middleware/auth.middleware";
import { chatStream, listModels } from "../controllers/chat.controller";

const router = express.Router();

// GET /api/chat/models  — list available models (public)
router.get("/chat/models", listModels);

// POST /api/chat  — SSE streaming chat (protected)
router.post("/chat", protectRoute, chatStream);

export default router;
