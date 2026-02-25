import { logger } from "../utils/logger.js";

/**
 * In-memory temp store:
 * - Session messages live in RAM only
 * - TTL cleanup runs periodically
 *
 * Note: This is NOT durable. On server restart, memory is gone.
 */
export class InMemoryStore {
  constructor({
    ttlMs = 60 * 60 * 1000, // 1 hour
    maxSessions = 2000,
    maxMessagesPerSession = 50,
    cleanupIntervalMs = 5 * 60 * 1000 // 5 minutes
  } = {}) {
    this.ttlMs = ttlMs;
    this.maxSessions = maxSessions;
    this.maxMessagesPerSession = maxMessagesPerSession;

    /** @type {Map<string, {updatedAt:number, summary:string, messages:Array<{role:string, content:string, createdAt:number}>}>} */
    this.sessions = new Map();

    this._timer = setInterval(() => this.cleanup(), cleanupIntervalMs);
    this._timer.unref?.();

    logger.info(
      { ttlMs, maxSessions, maxMessagesPerSession, cleanupIntervalMs },
      "InMemoryStore initialized"
    );
  }

  stop() {
    clearInterval(this._timer);
  }

  _now() {
    return Date.now();
  }

  _touch(sessionId) {
    const s = this.sessions.get(sessionId);
    if (s) s.updatedAt = this._now();
  }

  _ensureCapacity() {
    if (this.sessions.size <= this.maxSessions) return;

    // Evict oldest updated sessions (simple strategy)
    const entries = Array.from(this.sessions.entries());
    entries.sort((a, b) => a[1].updatedAt - b[1].updatedAt);

    const toEvict = this.sessions.size - this.maxSessions;
    for (let i = 0; i < toEvict; i++) {
      this.sessions.delete(entries[i][0]);
    }
  }

  upsertSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        updatedAt: this._now(),
        summary: "",
        messages: []
      });
      this._ensureCapacity();
    } else {
      this._touch(sessionId);
    }
  }

  getSessionSummary(sessionId) {
    return this.sessions.get(sessionId)?.summary || "";
  }

  setSessionSummary(sessionId, summary) {
    this.upsertSession(sessionId);
    const s = this.sessions.get(sessionId);
    s.summary = summary || "";
    s.updatedAt = this._now();
  }

  addMessage(sessionId, role, content) {
    this.upsertSession(sessionId);
    const s = this.sessions.get(sessionId);

    s.messages.push({ role, content, createdAt: this._now() });

    // Keep bounded memory
    if (s.messages.length > this.maxMessagesPerSession) {
      s.messages.splice(0, s.messages.length - this.maxMessagesPerSession);
    }

    s.updatedAt = this._now();
  }

  getRecentMessages(sessionId, limit = 20) {
    const s = this.sessions.get(sessionId);
    if (!s) return [];
    const msgs = s.messages;
    return msgs.slice(Math.max(0, msgs.length - limit));
  }

  cleanup() {
    const now = this._now();
    let removed = 0;

    for (const [sessionId, s] of this.sessions.entries()) {
      if (now - s.updatedAt > this.ttlMs) {
        this.sessions.delete(sessionId);
        removed += 1;
      }
    }

    if (removed > 0) {
      logger.info({ removed, remaining: this.sessions.size }, "InMemoryStore cleanup ran");
    }
  }
}