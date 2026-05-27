import crypto from "crypto";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { env, isProduction } from "../config/env.js";
import { Session } from "../models/Session.js";

export function signAccessToken(user) {
  return jwt.sign({ email: user.email }, env.jwtAccessSecret, {
    subject: user._id.toString(),
    expiresIn: env.accessTokenTtl,
    algorithm: "HS256"
  });
}

export function createRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token) {
  return crypto.createHmac("sha256", env.refreshTokenPepper).update(token).digest("hex");
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/auth",
    maxAge: env.refreshTokenDays * 24 * 60 * 60 * 1000
  };
}

export async function issueSession(user, req, familyId = nanoid()) {
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + env.refreshTokenDays * 24 * 60 * 60 * 1000);
  const session = await Session.create({
    userId: user._id,
    tokenHash: hashRefreshToken(refreshToken),
    familyId,
    userAgent: req?.get?.("user-agent"),
    ipAddress: req?.ip,
    expiresAt,
    lastUsedAt: new Date()
  });

  return {
    accessToken: signAccessToken(user),
    refreshToken,
    session
  };
}

export async function rotateRefreshToken(rawToken, req) {
  const tokenHash = hashRefreshToken(rawToken);
  const session = await Session.findOne({ tokenHash });

  if (!session) {
    return { error: "invalid" };
  }

  if (session.revokedAt || session.expiresAt < new Date()) {
    await Session.updateMany(
      { userId: session.userId, familyId: session.familyId, revokedAt: null },
      { revokedAt: new Date(), revokedReason: "refresh_reuse_or_expired" }
    );
    return { error: "reused" };
  }

  session.revokedAt = new Date();
  session.revokedReason = "rotated";
  session.lastUsedAt = new Date();
  await session.save();

  const replacement = await issueSession(
    { _id: session.userId, email: undefined },
    req,
    session.familyId
  );
  return replacement;
}

export async function revokeSession(rawToken, reason = "logout") {
  if (!rawToken) return;
  await Session.updateOne(
    { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
    { revokedAt: new Date(), revokedReason: reason }
  );
}
