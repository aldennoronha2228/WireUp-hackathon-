import express from "express";
import { protectRoute } from "../middleware/auth.middleware";
import {
  getProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
} from "../controllers/project.controller";

const router = express.Router();

router.get("/projects", protectRoute, getProjects);
router.post("/projects", protectRoute, createProject);
router.get("/project/:id", protectRoute, getProject);
router.put("/project/:id", protectRoute, updateProject);
router.delete("/project/:id", protectRoute, deleteProject);

export default router;
