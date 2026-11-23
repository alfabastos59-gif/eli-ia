import { evaluate, formatNumber, spokenToExpr } from "./calc";

export type Intent =
  | { kind: "weather"; city: string | null; tomorrow: boolean }
  | { kind: "note.add"; text: string }
  | { kind: "note.list" }
  | { kind: "note.clear" }
  | { kind: "calc"; result: string; expr: string }
  | { kind: "open"; panel: "notes" | "calc" }
  | { kind: "time" }
  | { kind: "date" }
  | { kind: "stop" };

const strip = (s: string) => s.replace(/[?!.]+$/g, "").trim();

/** Local, instant command router. Returns null when the AI should answer. */
export function parseIntent(raw: string): Intent | null {
  const t = raw.trim();
  const l = t.toLowerCase();
  if (/^(para|pare|parar|silêncio|silencio|chega|cala a boca)[.!]*$/.test(l)) return { kind: "stop" };
  if (/\b(abr[ae]|abrir|mostr[ae]|mostrar)\b.*\bcalculadora\b/.test(l)) return { kind: "open", panel: "calc" };
  if (/\b(abr[ae]|abrir|mostr[ae]|mostrar)\b.*\b(notas|anota[çc][õo]es)\b/.test(l)) return { kind: "open", panel: "notes" };
  const add = /^(?:e\.?l\.?i\.?,?\s*)?(?:anot[ae]r?|anote|cri[ae]r?\s+(?:uma\s+)?nota|lembre(?:-me)?\s+de|salv[ae]r?\s+(?:uma\s+)?nota)\s*(?:que|:)?\s*(.+)$/i.exec(t);
  if (add?.[1]) return { kind: "note.add", text: strip(add[1]) };
  if (/\b(list[ae]r?|ler|leia|quais s[ãa]o)\b.*\b(notas|anota[çc][õo]es)\b/.test(l) || /^minhas (notas|anota[çc][õo]es)/.test(l)) return { kind: "note.list" };
  if (/\b(apag[ae]r?|limp[ae]r?|exclu[ia]r?)\b.*\btodas\b.*\b(notas|anota[çc][õo]es)\b/.test(l)) return { kind: "note.clear" };
  if (/\b(clima|temperatura|previs[ãa]o do tempo|previs[ãa]o|tempo)\b/.test(l) && !/\bquanto tempo\b|\btempo livre\b/.test(l)) {
    const tomorrow = /\bamanh[ãa]\b/.test(l);
    const m = /\b(?:em|de|para|no|na)\s+([a-zà-ú][a-zà-ú\s'-]+?)(?:\s+(?:hoje|amanh[ãa]|agora))?[?.!]*$/i.exec(t);
    let city = m?.[1]?.trim() ?? null;
    if (city && /^(hoje|amanh[ãa]|agora|aqui|tempo)$/i.test(city)) city = null;
    return { kind: "weather", city, tomorrow };
  }
  if (/\b(que horas|horas s[ãa]o|hor[áa]rio atual)\b/.test(l)) return { kind: "time" };
  if (/\b(que dia [ée] hoje|data de hoje|qual a data)\b/.test(l)) return { kind: "date" };
  const calc = /^(?:quanto (?:é|e|da|dá)|calcul[ae]r?|calcule)\s+(.+)$/i.exec(t);
  if (calc?.[1]) {
    const expr = spokenToExpr(calc[1]);
    if (/\d/.test(expr)) {
      try { return { kind: "calc", expr, result: formatNumber(evaluate(expr)) }; } catch { /* AI handles */ }
    }
  }
  return null;
}
