import { createServerOnlyFn } from "@tanstack/react-start";
import { parseHTML } from "linkedom";
import { searchPlan, type WebResearch, type WebSource, type WebStatus } from "./search";

function plain(html: string) {
  return (parseHTML(`<html><body>${html}</body></html>`).document.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

// Same free hosted endpoint and response format used by the Agent-Reach "web" channel.
const EXA_MCP = "https://mcp.exa.ai/mcp";
const LIMIT_RE = /\b429\b|rate[ _-]?limit|too many requests|\bquota\b|credits?/i;

export function parseExa(text: string): WebSource[] {
  const sources: WebSource[] = [];
  for (const raw of ("\n" + text.trim()).split(/\n(?=Title: )/)) {
    const block = raw.trim();
    if (!block.startsWith("Title:")) continue;
    const fields: Record<string, string> = {};
    const lines = block.split("\n");
    let i = 0;
    for (; i < lines.length; i++) {
      const m = /^(Title|URL|Published|Author):\s*(.*)$/.exec(lines[i] ?? "");
      if (!m) break;
      fields[(m[1] ?? "").toLowerCase()] = (m[2] ?? "").trim();
    }
    try {
      const url = new URL(fields["url"] ?? "");
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      if (sources.some((s) => s.url === url.href)) continue;
      const title = fields["title"] && fields["title"] !== "N/A" ? fields["title"] : url.hostname;
      const snippet = lines.slice(i).filter((l) => !/^(Highlights|Text):$/.test(l.trim())).join(" ").replace(/\s+/g, " ").trim();
      sources.push({ title: title.slice(0, 180), url: url.href, snippet: snippet.slice(0, 700), provider: "Exa" });
      if (sources.length === 5) break;
    } catch { /* discard unsafe or malformed links */ }
  }
  return sources;
}

async function exaSearch(query: string, signal: AbortSignal): Promise<WebSource[]> {
  const response = await fetch(EXA_MCP, {
    method: "POST",
    signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "User-Agent": "agent-reach/eli" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "web_search_exa", arguments: { query, numResults: 5 } } }),
  });
  if (response.status === 403 || response.status === 429) throw new Error("blocked");
  if (!response.ok) throw new Error("unavailable");
  const raw = (await response.text()).slice(0, 2_000_000);
  const payloads = raw.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim());
  const msg = JSON.parse(payloads.at(-1) ?? raw) as { error?: { message?: string }; result?: { isError?: boolean; content?: { type?: string; text?: string }[] } };
  const text = (msg.result?.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
  if (msg.error || msg.result?.isError) throw new Error(LIMIT_RE.test(msg.error?.message ?? text) ? "blocked" : "unavailable");
  return parseExa(text);
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
  const [ddg, wiki] = await Promise.allSettled([exaSearch(plan.query, signal), plan.wikipedia ? wikipedia(plan.query, signal) : Promise.resolve([])]);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const sources = [...(ddg.status === "fulfilled" ? ddg.value : []), ...(wiki.status === "fulfilled" ? wiki.value : [])];
  let status: WebStatus = sources.length ? "found" : "empty";
  let notice = "Busca gratuita (Exa via Agent-Reach): os trechos podem estar incompletos ou defasados; não garantem dados em tempo real.";
  if (ddg.status === "rejected") {
    const blocked = ddg.reason instanceof Error && ddg.reason.message === "blocked";
    status = blocked ? "blocked" : "error";
    notice = blocked ? "A busca (Exa via Agent-Reach) recusou ou limitou esta consulta." : "A busca (Exa via Agent-Reach) não respondeu.";
    notice += sources.length ? " A Wikipedia oferece apenas contexto enciclopédico, não dados em tempo real." : " A conversa continua, mas não foi possível verificar informações na web.";
  } else if (!ddg.value.length) {
    notice = "A busca não trouxe resultados utilizáveis." + (sources.length ? " Usando apenas contexto enciclopédico da Wikipedia." : " Não foi possível verificar informações na web.");
  }
  if (plan.wikipedia && wiki.status === "rejected") notice += " A Wikipedia também está indisponível.";
  return { sources, notice, checkedAt: new Date().toISOString(), status };
});