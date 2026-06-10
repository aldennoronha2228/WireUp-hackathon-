import express from "express";
import { protectRoute } from "../middleware/auth.middleware";
import { generatePipeline } from "../controllers/generate.controller";

const router = express.Router();

// SSE streaming generation pipeline
router.post("/generate", protectRoute, generatePipeline);

export default router;
