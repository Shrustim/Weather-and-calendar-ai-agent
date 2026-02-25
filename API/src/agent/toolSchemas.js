export function buildToolDeclarations() {
  return [
    {
      name: "get_weather",
      description: "Get current weather for a city/area using OpenWeather.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City and country if possible, e.g., 'Nagpur, IN'." },
          units: { type: "string", enum: ["metric", "imperial"], description: "metric=°C, imperial=°F" }
        },
        required: ["location"]
      }
    },
    {
      name: "list_calendar_events",
      description: "List Google Calendar events in a time window.",
      parameters: {
        type: "object",
        properties: {
          timeMinISO: { type: "string", description: "Inclusive start ISO datetime" },
          timeMaxISO: { type: "string", description: "Exclusive end ISO datetime" },
          maxResults: { type: "number", description: "Max events, 1-50" }
        },
        required: ["timeMinISO", "timeMaxISO"]
      }
    },
    {
      name: "create_calendar_event",
      description: "Create a Google Calendar event.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          description: { type: "string" },
          location: { type: "string" },
          startISO: { type: "string", description: "Event start ISO datetime" },
          endISO: { type: "string", description: "Event end ISO datetime" }
        },
        required: ["summary", "startISO", "endISO"]
      }
    }
  ];
}