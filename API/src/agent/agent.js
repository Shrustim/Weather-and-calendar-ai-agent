import { geminiGenerateContent } from "./geminiClient.js";
import { buildToolDeclarations } from "./toolSchemas.js";
import { getWeatherTool } from "../tools/weatherTool.js";
import { listCalendarEventsTool, createCalendarEventTool } from "../tools/calendarTool.js";
import { logger } from "../utils/logger.js";

function toGeminiContentsFromMemory({ summary, recentMessages, userMessage }) {
  const contents = [];

  if (summary && summary.trim()) {
    contents.push({
      role: "user",
      parts: [{ text: `Session summary (memory):\n${summary}` }]
    });
  }

  for (const m of recentMessages) {
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    });
  }

  contents.push({ role: "user", parts: [{ text: userMessage }] });
  return contents;
}

function extractFirstCandidateContent(data) {
  return data?.candidates?.[0]?.content;
}

function extractFunctionCall(candidateContent) {
  const parts = candidateContent?.parts || [];
  for (const p of parts) {
    if (p.functionCall?.name) return p.functionCall;
  }
  return null;
}

function extractText(candidateContent) {
  const parts = candidateContent?.parts || [];
  return parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();
}

function makeToolResponsePart({ name, response }) {
  return {
    functionResponse: {
      name,
      response
    }
  };
}

async function runTool({ toolName, toolArgs, env }) {
  switch (toolName) {
    case "get_weather":
      return getWeatherTool(toolArgs, env);
    case "list_calendar_events":
      return listCalendarEventsTool(toolArgs, env);
    case "create_calendar_event":
      return createCalendarEventTool(toolArgs, env);
    default:
      return { ok: false, error: `Unknown tool: ${toolName}` };
  }
}

/**
 * Optional: Summarize if messages are getting large (still temp memory).
 * Keeps the demo stable even when user chats a lot.
 */
async function maybeUpdateSummary({ env, memory, sessionId }) {
  const recent = memory.getRecentMessages(sessionId, 50);
  if (recent.length < 40) return;

  const transcript = recent.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

  const data = await geminiGenerateContent({
    env,
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "Summarize into short bullet points: stable facts, preferences, and open tasks. Keep concise.\n\n" +
              transcript
          }
        ]
      }
    ],
    generationConfig: { temperature: 0.2 }
  });

  const summary = extractText(extractFirstCandidateContent(data));
  if (summary) memory.setSessionSummary(sessionId, summary);
}

export async function runAgentChat({ env, memory, sessionId, userMessage, correlationId }) {
  memory.addMessage(sessionId, "user", userMessage);

  const summary = memory.getSessionSummary(sessionId);
  const recentMessages = memory.getRecentMessages(sessionId, 20);
  const tools = buildToolDeclarations();

  const contents = toGeminiContentsFromMemory({ summary, recentMessages, userMessage });

  logger.info({ correlationId, sessionId }, "Agent: calling Gemini (step 1)");

  let data = await geminiGenerateContent({
    env,
    contents,
    generationConfig: { temperature: 0.4 },
    tools
  });

  let candidate = extractFirstCandidateContent(data);
  let functionCall = extractFunctionCall(candidate);

  const maxToolHops = 3;
  let hops = 0;

  while (functionCall && hops < maxToolHops) {
    hops += 1;

    const toolName = functionCall.name;
    const toolArgs = functionCall.args || {};

    logger.info({ correlationId, toolName, toolArgs }, "Agent: executing tool");

    const toolResult = await runTool({ toolName, toolArgs, env });

    // Add the tool call and tool response to conversation
    contents.push({ role: "model", parts: [{ functionCall }] });
    contents.push({ role: "user", parts: [makeToolResponsePart({ name: toolName, response: toolResult })] });

    logger.info({ correlationId, sessionId }, `Agent: calling Gemini (hop ${hops})`);

    data = await geminiGenerateContent({
      env,
      contents,
      generationConfig: { temperature: 0.35 },
      tools
    });

    candidate = extractFirstCandidateContent(data);
    functionCall = extractFunctionCall(candidate);
  }

  const finalText = extractText(candidate) || "I couldn’t generate a response. Please try again.";
  memory.addMessage(sessionId, "assistant", finalText);

  try {
    await maybeUpdateSummary({ env, memory, sessionId });
  } catch {
    // non-fatal
  }

  return { sessionId, answer: finalText, meta: { toolHops: hops } };
}