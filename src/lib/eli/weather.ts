const CODES: Record<number, string> = {
  0: "céu limpo", 1: "predominantemente limpo", 2: "parcialmente nublado", 3: "nublado", 45: "neblina", 48: "neblina com geada",
  51: "garoa fraca", 53: "garoa", 55: "garoa forte", 61: "chuva fraca", 63: "chuva", 65: "chuva forte", 71: "neve fraca", 73: "neve", 75: "neve forte",
  80: "pancadas de chuva", 81: "pancadas de chuva", 82: "pancadas fortes de chuva", 95: "trovoadas", 96: "trovoadas com granizo", 99: "trovoadas fortes",
};
export const describeCode = (c: number) => CODES[c] ?? "tempo variável";

export type Place = { name: string; admin?: string | undefined; country?: string | undefined; lat: number; lon: number };

export async function geocode(city: string): Promise<Place | null> {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt&format=json`);
  if (!r.ok) throw new Error("Geocodificação indisponível");
  const j = (await r.json()) as { results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[] };
  const p = j.results?.[0];
  return p ? { name: p.name, admin: p.admin1, country: p.country, lat: p.latitude, lon: p.longitude } : null;
}

export async function currentPlace(): Promise<Place | null> {
  if (!("geolocation" in navigator)) return null;
  return new Promise((res) =>
    navigator.geolocation.getCurrentPosition(
      (p) => res({ name: "sua localização", lat: p.coords.latitude, lon: p.coords.longitude }),
      () => res(null),
      { timeout: 6000, maximumAge: 600000 },
    ),
  );
}

export async function weatherReport(place: Place, tomorrow: boolean) {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=auto&forecast_days=2`;
  const r = await fetch(u);
  if (!r.ok) throw new Error("Serviço de clima indisponível");
  const j = (await r.json()) as {
    current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; weather_code: number; wind_speed_10m: number };
    daily: { temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[]; precipitation_probability_max: number[] };
  };
  const label = place.admin && place.admin !== place.name ? `${place.name}, ${place.admin}` : place.name;
  const R = Math.round;
  if (tomorrow) {
    const d = j.daily;
    return `Amanhã em ${label}: ${describeCode(d.weather_code[1] ?? 0)}, mínima de ${R(d.temperature_2m_min[1] ?? 0)} e máxima de ${R(d.temperature_2m_max[1] ?? 0)} graus, com ${R(d.precipitation_probability_max[1] ?? 0)} por cento de chance de chuva.`;
  }
  const c = j.current;
  return `Agora em ${label} faz ${R(c.temperature_2m)} graus, sensação de ${R(c.apparent_temperature)}, ${describeCode(c.weather_code)}, umidade de ${R(c.relative_humidity_2m)} por cento e vento de ${R(c.wind_speed_10m)} quilômetros por hora.`;
}
