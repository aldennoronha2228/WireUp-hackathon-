// ??$$$ group 1 - Landing Page & Authentication — Google OAuth
// @ts-nocheck
import { Request, Response } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.model";
import { generateToken } from "../lib/utils";

// ── Configure passport once ────────────────────────────────────────────────
export function configureGoogleStrategy() {
  const clientID     = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientID || !clientSecret) {
    console.warn("[GoogleAuth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set — Google OAuth disabled.");
    return;
  }

  const callbackURL = process.env.GOOGLE_CALLBACK_URL?.trim()
    || `http://localhost:${process.env.PORT || 5000}/api/auth/google/callback`;

  passport.use(
    new GoogleStrategy(
      { clientID, clientSecret, callbackURL },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email     = profile.emails?.[0]?.value || "";
          const fullName  = profile.displayName || "Google User";
          const profilePic = profile.photos?.[0]?.value || "";
          const googleId  = profile.id;

          // Find existing user by googleId or email
          let user = await User.findOne({ $or: [{ googleId }, { email }] });

          if (user) {
            // Link googleId if signing in via email account for first time
            if (!user.googleId) {
              user.googleId = googleId;
              if (!user.profilePic && profilePic) user.profilePic = profilePic;
              await user.save();
            }
          } else {
            // New user via Google
            user = await User.create({ email, fullName, profilePic, googleId, password: "" });
          }

          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );

  // Minimal serialization — we use JWT cookies, not sessions
  passport.serializeUser((user: any, done) => done(null, user._id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}

// ── Route handlers ─────────────────────────────────────────────────────────

// GET /api/auth/google
export const googleAuthRedirect = passport.authenticate("google", {
  scope: ["profile", "email"],
  session: false,
});

// GET /api/auth/google/callback
export const googleAuthCallback = [
  passport.authenticate("google", { session: false, failureRedirect: "/?auth=failed" }),
  (req: Request, res: Response) => {
    const user = req.user as any;
    if (!user) return res.redirect("/?auth=failed");

    // Issue JWT cookie exactly like email/password login
    generateToken(user._id.toString(), res);

    const frontendUrl = process.env.FRONTEND_URL?.trim() || "http://localhost:5173";
    res.redirect(`${frontendUrl}/?auth=success`);
  },
];
