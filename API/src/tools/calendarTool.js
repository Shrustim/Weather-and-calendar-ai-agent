import { google } from "googleapis";
import { z } from "zod";

function getOAuthClient(env) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error("Google Calendar OAuth env vars missing (CLIENT_ID/SECRET/REFRESH_TOKEN).");
  }

  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return oauth2;
}

const ListEventsSchema = z.object({
  timeMinISO: z.string().min(1),
  timeMaxISO: z.string().min(1),
  maxResults: z.number().int().min(1).max(50).default(10)
});

export async function listCalendarEventsTool(args, env) {
  const parsed = ListEventsSchema.safeParse(args);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };

  const auth = getOAuthClient(env);
  const calendar = google.calendar({ version: "v3", auth });

  const calendarId = env.GOOGLE_CALENDAR_ID || "primary";
  const { timeMinISO, timeMaxISO, maxResults } = parsed.data;

  const resp = await calendar.events.list({
    calendarId,
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    maxResults,
    singleEvents: true,
    orderBy: "startTime"
  });

  const items = (resp.data.items || []).map((e) => ({
    id: e.id,
    summary: e.summary,
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    location: e.location
  }));

  return { ok: true, data: { calendarId, items } };
}

const CreateEventSchema = z.object({
  summary: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  startISO: z.string().min(1),
  endISO: z.string().min(1)
});

export async function createCalendarEventTool(args, env) {
  const parsed = CreateEventSchema.safeParse(args);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };

  const auth = getOAuthClient(env);
  const calendar = google.calendar({ version: "v3", auth });

  const calendarId = env.GOOGLE_CALENDAR_ID || "primary";
  const { summary, description, location, startISO, endISO } = parsed.data;

  const resp = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary,
      description,
      location,
      start: { dateTime: startISO },
      end: { dateTime: endISO }
    }
  });

  return {
    ok: true,
    data: {
      calendarId,
      id: resp.data.id,
      htmlLink: resp.data.htmlLink,
      summary: resp.data.summary,
      start: resp.data.start?.dateTime,
      end: resp.data.end?.dateTime
    }
  };
}