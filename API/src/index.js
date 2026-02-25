import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import { correlationIdMiddleware, asyncHandler } from "./utils/http.js";
import { logger } from "./utils/logger.js";
import { InMemoryStore } from "./memory/inMemoryStore.js";
import { runAgentChat } from "./agent/agent.js";

const env = {
  PORT: process.env.PORT || "8080",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",

  GEMINI_BASE_URL: process.env.GEMINI_BASE_URL,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,

  OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID || "primary"
};

const app = express();

app.use(correlationIdMiddleware);
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
  })
);

const memory = new InMemoryStore({
  ttlMs: 60 * 60 * 1000, // 1 hour temporary memory
  maxSessions: 2000,
  maxMessagesPerSession: 50
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "ai-agent-backend" });
});

const ChatSchema = z.object({
  sessionId: z.string().min(3),
  message: z.string().min(1),
  userLevel: z.enum(["beginner", "intermediate", "advanced"]).optional()
});

app.post(
  "/v1/chat",
  asyncHandler(async (req, res) => {
    const parsed = ChatSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

    const { sessionId, message } = parsed.data;
    const correlationId = req.correlationId;

    // Lightweight system instruction embedded into the message for demo simplicity.
    // In a larger system, you'd keep a separate system prompt store/versioning.
    const agentUserMessage =
      `You are an AI Agent. You can use tools when needed.\n` +
      `If user asks weather, use get_weather.\n` +
      `If user asks calendar tasks, use list_calendar_events or create_calendar_event.\n` +
      `If user asks anything else, answer normally.\n` +
      `When replying, be clear and helpful. If tool fails, explain politely.\n\n` +
      `User: ${message}`;

    const result = await runAgentChat({
      env,
      memory,
      sessionId,
      userMessage: agentUserMessage,
      correlationId
    });

    res.json({
      ok: true,
      sessionId: result.sessionId,
      answer: result.answer,
      meta: result.meta,
      correlationId
    });
  })
);

app.use((err, req, res, next) => {
  logger.error({ err: String(err), correlationId: req.correlationId }, "Unhandled error");
  res.status(500).json({ ok: false, error: "Internal Server Error", correlationId: req.correlationId });
});

app.listen(Number(env.PORT), () => {
  logger.info(`Server started on http://localhost:${env.PORT}`);
});