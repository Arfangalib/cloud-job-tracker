import bcrypt from "bcryptjs";
import express from "express";
import { z } from "zod";
import { authLimiter, passwordRecoveryLimiter } from "../middleware/rateLimits.js";
import { requireAuth } from "../middleware/auth.js";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import {
  issueSession,
  refreshCookieOptions,
  revokeSession,
  rotateRefreshToken,
  signAccessToken
} from "../services/authTokens.js";
import { writeAudit } from "../services/audit.js";

export const authRouter = express.Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(10)
});

authRouter.post("/register", authLimiter, async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await User.create({ name: input.name, email: input.email, passwordHash });
    const session = await issueSession(user, req);
    await writeAudit({ userId: user._id, type: "auth.register", req });
    res.cookie("refresh_token", session.refreshToken, refreshCookieOptions());
    res.status(201).json({ accessToken: session.accessToken, user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "Email already registered" });
    next(error);
  }
});

authRouter.post("/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() });
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });
    const session = await issueSession(user, req);
    await writeAudit({ userId: user._id, type: "auth.login", req });
    res.cookie("refresh_token", session.refreshToken, refreshCookieOptions());
    res.json({ accessToken: session.accessToken, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", authLimiter, async (req, res, next) => {
  try {
    const raw = req.cookies.refresh_token;
    if (!raw) return res.status(401).json({ error: "Missing refresh token" });
    const rotated = await rotateRefreshToken(raw, req);
    if (rotated.error) return res.status(401).json({ error: "Invalid refresh token" });
    const user = await User.findById(rotated.session.userId);
    const accessToken = signAccessToken(user);
    res.cookie("refresh_token", rotated.refreshToken, refreshCookieOptions());
    res.json({ accessToken, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", authLimiter, async (req, res, next) => {
  try {
    await revokeSession(req.cookies.refresh_token, "logout");
    res.clearCookie("refresh_token", { path: "/auth" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

authRouter.post("/password-reset/request", passwordRecoveryLimiter, async (_req, res) => {
  res.json({ ok: true, message: "If an account exists, a password reset email will be sent." });
});

authRouter.post("/password-reset/confirm", passwordRecoveryLimiter, async (_req, res) => {
  res.status(501).json({ error: "Password reset token confirmation is planned for the email provider integration." });
});

authRouter.get("/sessions", requireAuth, async (req, res) => {
  const sessions = await Session.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({
    sessions: sessions.map((session) => ({
      id: session._id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      revokedReason: session.revokedReason
    }))
  });
});

authRouter.delete("/sessions/:id", requireAuth, async (req, res) => {
  await Session.updateOne(
    { _id: req.params.id, userId: req.user._id },
    { revokedAt: new Date(), revokedReason: "user_revoked" }
  );
  res.status(204).end();
});

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email };
}
