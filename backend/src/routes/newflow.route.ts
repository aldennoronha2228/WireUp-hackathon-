// ??$$$ group 2 - Ideation Stage (Phase 1)
// ??$$$ NEW FLOW
import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware";
import {
  startSession,
  answerQuestion,
  proceedSession,
  getSession,
  formulateSession,
  // ??$$$ NEW FLOW
  restartSession,
  getSessionByProject,
  // ??$$$ newer code
  exportLocalSession,
  getVirtualProjectData,
  resumeSession,
  rescueSession
} from "../controllers/newflow.controller";

const router = Router();

router.post("/new-flow/start", protectRoute, startSession);
router.post("/new-flow/answer", protectRoute, answerQuestion);
router.post("/new-flow/proceed", protectRoute, proceedSession);
router.post("/new-flow/formulate", protectRoute, formulateSession);
router.post("/new-flow/restart", protectRoute, restartSession);
// ??$$$ newer code
router.post("/new-flow/export-local", protectRoute, exportLocalSession);
router.post("/new-flow/resume", protectRoute, resumeSession);
router.post("/new-flow/rescue", protectRoute, rescueSession);
router.get("/new-flow/virtual-project/:sessionId", protectRoute, getVirtualProjectData);
router.get("/new-flow/session/:sessionId", protectRoute, getSession);
router.get("/new-flow/project-session/:projectId", protectRoute, getSessionByProject);

export default router;
