import { afterEach, describe, expect, it, vi } from "vitest";
import { searchPlan } from "@/lib/eli/search";

vi.mock("@tanstack/react-start", () => ({ createServerOnlyFn: (fn: unknown) => fn }));
import { parseDuckDuckGo, researchWeb } from "@/lib/eli/web-search";

afterEach(() => vi.unstubAllGlobals());

describe("experimental web research", () => {
  it("searches the dollar question instead of relying on model memory", () => {
    expect(searchPlan("Qual a cotação do dólar?")).toMatchObject({ needed: true, current: true, wikipedia: false });
  });
  it("supports explicit searches without sending the command as the query", () => {
    expect(searchPlan("Pesquise na web sobre energia solar")).toMatchObject({ needed: true, query: "energia solar" });
  });
  it("adds Wikipedia only for suitable encyclopedic questions", () => {
    expect(searchPlan("Quem foi Albert Einstein?")).toMatchObject({ needed: true, wikipedia: true, query: "Albert Einstein" });
    expect(searchPlan("Quem é o presidente atual?").wikipedia).toBe(false);
    expect(searchPlan("Últimas notícias sobre IA").wikipedia).toBe(false);
  });
  it("does not search for conversational greetings", () => {
    expect(searchPlan("Olá, obrigado pela ajuda").needed).toBe(false);
  });
  it("extracts source facts and unwraps DuckDuckGo redirects safely", () => {
    expect(parseDuckDuckGo('<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdolar">Cotação</a><a class="result__snippet">Dólar &amp; euro</a></div>')).toEqual([{ title: "Cotação", snippet: "Dólar & euro", url: "https://example.com/dolar", provider: "DuckDuckGo" }]);
    expect(parseDuckDuckGo('<div class="result"><a class="result__a" href="javascript:alert(1)">Unsafe</a></div>')).toEqual([]);
  });
  it("returns a nonfatal limitation on a blocked current-data search and never uses a currency API", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("blocked", { status: 429 }));
    vi.stubGlobal("fetch", fetcher);
    const result = await researchWeb("Qual a cotação do dólar hoje?", new AbortController().signal);
    expect(result.sources).toEqual([]);
    expect(result.notice).toContain("DuckDuckGo bloqueou");
    expect(result.status).toBe("blocked");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = fetcher.mock.calls[0]?.[0] as URL;
    expect(url.hostname).toBe("html.duckduckgo.com");
  });
  it("retains Wikipedia context when DuckDuckGo presents a bot challenge", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: URL) => url.hostname === "html.duckduckgo.com"
      ? new Response('<form id="challenge-form"></form>')
      : Response.json({ query: { search: [{ title: "Albert Einstein", snippet: "Físico <b>teórico</b>." }] } })));
    const result = await researchWeb("Quem foi Albert Einstein?", new AbortController().signal);
    expect(result.sources[0]).toEqual({ title: "Albert Einstein", snippet: "Físico teórico.", url: "https://pt.wikipedia.org/wiki/Albert_Einstein", provider: "Wikipedia" });
    expect(result.notice).toContain("não dados em tempo real");
  });
  it("continues without external context when both sources fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await researchWeb("O que é fotossíntese?", new AbortController().signal);
    expect(result.sources).toEqual([]);
    expect(result.notice).toContain("A conversa continua");
    expect(result.notice).toContain("Wikipedia também está indisponível");
    expect(result.status).toBe("error");
  });
  it("reports found results when DuckDuckGo returns a usable source", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('<div class="result"><a class="result__a" href="https://example.com/solar">Energia solar</a><div class="result__snippet">Fonte renovável.</div></div>')));
    const result = await researchWeb("Pesquise energia solar", new AbortController().signal);
    expect(result.status).toBe("found");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.url).toBe("https://example.com/solar");
  });
});