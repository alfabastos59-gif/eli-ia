import { createServerOnlyFn } from "@tanstack/react-start";
import { parseHTML } from "linkedom";
import { searchPlan, type WebResearch, type WebSource, type WebStatus } from "./search";

function plain(html: string) {
  return (parseHTML(`<html><body>${html}</body></html>`).document.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function parseDuckDuckGo(html: string): WebSource[] {
  const { document } = parseHTML(html);
  if (document.querySelector('#challenge-form, #anomaly-form, .anomaly-modal__title') || /Unfortunately, bots use DuckDuckGo too/.test(html)) {
    throw new Error("blocked");
  }
  const sources: WebSource[] = [];
  for (const result of document.querySelectorAll(".result")) {
    const anchor = result.querySelector(".result__a");
    const title = anchor?.textContent?.trim();
    const href = anchor?.getAttribute("href");
    if (!title || !href || result.classList.contains("result--ad")) continue;
    try {
      const redirect = new URL(href, "https://duckduckgo.com");
      const url = new URL(redirect.searchParams.get("uddg") ?? redirect.href);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      if (url.hostname.endsWith("duckduckgo.com") || sources.some((s) => s.url === url.href)) continue;
      sources.push({ title: title.slice(0, 180), url: url.href, snippet: (result.querySelector(".result__snippet")?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 700), provider: "DuckDuckGo" });
      if (sources.length === 5) break;
    } catch { /* discard unsafe or malformed links */ }
  }
  return sources;
}

async function duckDuckGo(query: string, signal: AbortSignal): Promise<WebSource[]> {
  const url = new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q", query);
  url.searchParams.set("kl", "br-pt");
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(7000)]) });
  if (response.status === 403 || response.status === 429 || response.status === 202) throw new Error("blocked");
  if (!response.ok) throw new Error("unavailable");
  return parseDuckDuckGo((await response.text()).slice(0, 1_000_000));
}

async function wikipedia(query: string, signal: AbortSignal): Promise<WebSource[]> {
  const url = new URL("https://pt.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({ action: "query", list: "search", srsearch: query, srlimit: "2", format: "json", utf8: "1" }).toString();
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });
  if (!response.ok) throw new Error("wikipedia-unavailable");
  const data = await response.json() as { query?: { search?: { title?: string; snippet?: string }[] } };
  return (data.query?.search ?? []).flatMap((item) => typeof item.title === "string" && typeof item.snippet === "string" ? [{ title: item.title.slice(0, 180), snippet: plain(item.snippet).slice(0, 700), url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`, provider: "Wikipedia" as const }] : []);
}

// Fetch only fixed providers; never follow arbitrary source URLs or relay bot checks.
export const researchWeb = createServerOnlyFn(async (text: string, signal: AbortSignal): Promise<WebResearch> => {
  const plan = searchPlan(text);
  const [ddg, wiki] = await Promise.allSettled([duckDuckGo(plan.query, signal), plan.wikipedia ? wikipedia(plan.query, signal) : Promise.resolve([])]);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const sources = [...(ddg.status === "fulfilled" ? ddg.value : []), ...(wiki.status === "fulfilled" ? wiki.value : [])];
  let status: WebStatus = sources.length ? "found" : "empty";
  let notice = "Busca experimental: os trechos podem estar incompletos ou defasados; não garantem dados em tempo real.";
  if (ddg.status === "rejected") {
    const blocked = ddg.reason instanceof Error && ddg.reason.message === "blocked";
    status = blocked ? "blocked" : "error";
    notice = blocked ? "O DuckDuckGo bloqueou esta consulta automática." : "O DuckDuckGo não respondeu a esta consulta.";
    notice += sources.length ? " A Wikipedia oferece apenas contexto enciclopédico, não dados em tempo real." : " A conversa continua, mas não foi possível verificar informações na web.";
  } else if (!ddg.value.length) {
    notice = "O DuckDuckGo não trouxe resultados utilizáveis." + (sources.length ? " Usando apenas contexto enciclopédico da Wikipedia." : " Não foi possível verificar informações na web.");
  }
  if (plan.wikipedia && wiki.status === "rejected") notice += " A Wikipedia também está indisponível.";
  return { sources, notice, checkedAt: new Date().toISOString(), status };
});