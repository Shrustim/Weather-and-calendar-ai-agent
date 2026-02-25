import crypto from "crypto";

export function correlationIdMiddleware(req, res, next) {
  const incoming = req.headers["x-correlation-id"];
  const id = typeof incoming === "string" && incoming.trim() ? incoming : crypto.randomUUID();
  req.correlationId = id;
  res.setHeader("x-correlation-id", id);
  next();
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}