import { AuditEvent } from "../models/AuditEvent.js";

export function writeAudit({ userId, type, req, metadata = {} }) {
  return AuditEvent.create({
    userId,
    type,
    ipAddress: req?.ip,
    userAgent: req?.get?.("user-agent"),
    metadata
  });
}
