export type VoiceProvider = "auto" | "fish" | "gemini" | "browser";
export type Settings = { geminiKey: string; fishKey: string; fishReferenceId: string; provider: VoiceProvider; defaultCity: string; bargeIn: boolean };
export const DEFAULT_SETTINGS: Settings = { geminiKey: "", fishKey: "", fishReferenceId: "", provider: "auto", defaultCity: "", bargeIn: true };
const KEY = "eli.settings.v1";
export function loadSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Settings>) }; } catch { return DEFAULT_SETTINGS; }
}
export function saveSettings(s: Settings) { localStorage.setItem(KEY, JSON.stringify(s)); }
