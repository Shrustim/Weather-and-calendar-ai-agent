import { z } from "zod";

const WeatherArgsSchema = z.object({
  location: z.string().min(1),
  units: z.enum(["metric", "imperial"]).default("metric")
});

export async function getWeatherTool(args, env) {
  const parsed = WeatherArgsSchema.safeParse(args);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten() };
  }

  const { location, units } = parsed.data;
  if (!env.OPENWEATHER_API_KEY) {
    return { ok: false, error: "OPENWEATHER_API_KEY is missing" };
  }

  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("q", location);
  url.searchParams.set("appid", env.OPENWEATHER_API_KEY);
  url.searchParams.set("units", units);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `OpenWeather error (${res.status}): ${text}` };
  }

  const data = await res.json();

  return {
    ok: true,
    data: {
      location: `${data?.name || location}${data?.sys?.country ? ", " + data.sys.country : ""}`,
      temp: data?.main?.temp,
      feels_like: data?.main?.feels_like,
      humidity: data?.main?.humidity,
      wind_speed: data?.wind?.speed,
      condition: data?.weather?.[0]?.main,
      description: data?.weather?.[0]?.description
    }
  };
}