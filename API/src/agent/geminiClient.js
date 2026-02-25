import { logger } from "../utils/logger.js";

export async function geminiGenerateContent({ env, contents, generationConfig, tools }) {
  const base = env.GEMINI_BASE_URL?.includes("/v1beta")
    ? env.GEMINI_BASE_URL
    : "https://generativelanguage.googleapis.com/v1beta";

  const url = `${base}/models/${env.GEMINI_MODEL}:generateContent`;

  const body = {
    contents,
    generationConfig: generationConfig || { temperature: 0.4 },
    tools: tools
      ? [
          {
            functionDeclarations: tools
          }
        ]
      : undefined
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error({ status: res.status, text }, "Gemini API error");
    throw new Error(`Gemini API error (${res.status}): ${text}`);
  }

  return res.json();
}