// ??$$$ group 1 - Landing Page & Authentication
import express from "express";

import {
  checkAuth,
  login,
  logout,
  signup,
  updateUser,
} from "../controllers/auth.controller";

import {
  googleAuthRedirect,
  googleAuthCallback,
} from "../controllers/googleAuth.controller";

import { protectRoute } from "../middleware/auth.middleware";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

router.get("/check", protectRoute, checkAuth);
router.put("/update", protectRoute, updateUser);

// Google OAuth
router.get("/google", googleAuthRedirect);
router.get("/google/callback", ...googleAuthCallback);

export default router;