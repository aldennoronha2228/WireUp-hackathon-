import express from "express";
import { protectRoute } from "../middleware/auth.middleware";
import { generateQuestions } from "../controllers/questions.controller";

const router = express.Router();
router.post("/questions", protectRoute, generateQuestions);

export default router;
