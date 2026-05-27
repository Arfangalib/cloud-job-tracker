import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing access token" });

    const payload = jwt.verify(token, env.jwtAccessSecret, {
      algorithms: ["HS256"]
    });

    const user = await User.findById(payload.sub);
    if (!user || user.deletedAt) return res.status(401).json({ error: "Invalid user" });
    req.user = user;
    req.auth = payload;
    next();
  } catch (_error) {
    res.status(401).json({ error: "Invalid or expired access token" });
  }
}
