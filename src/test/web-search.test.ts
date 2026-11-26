import { afterEach, describe, expect, it, vi } from "vitest";
import { searchPlan } from "@/lib/eli/search";

vi.mock("@tanstack/react-start", () => ({ createServerOnlyFn: (fn: unknown) => fn }));
import { parseExa, researchWeb } from "@/lib/eli/web-search";

afterEach(() => vi.unstubAllGlobals());
const sse = (text: string) => new Response(`event: message\ndata: ${JSON.stringify({ result: { content: [{ type: "text", text }] } })}\n`);

describe("web research via Agent-Reach (Exa)", () => {
  it("searches the dollar question instead of relying on model memory", () => {
    expect(searchPlan("Qual a cotação do dólar?")).toMatchObject({ needed: true, current: true, wikipedia: false });
  });
  it("supports explicit searches without sending the command as the query", () => {
    expect(searchPlan("Pesquise na web sobre energia solar")).toMatchObject({ needed: true, query: "energia solar" });
  });
  it("adds Wikipedia only for suitable encyclopedic questions", () => {
    expect(searchPlan("Quem foi Albert Einstein?")).toMatchObject({ needed: true, wikipedia: true, query: "Albert Einstein" });
    expect(searchPlan("Últimas notícias sobre IA").wikipedia).toBe(false);
  });
  it("does not search for conversational greetings", () => {
    expect(searchPlan("Olá, obrigado pela ajuda").needed).toBe(false);
  });
  it("parses Exa blocks and drops unsafe links", () => {
    const out = parseExa("Title: Cotação\nURL: https://example.com/dolar\nPublished: N/A\nHighlights:\nDólar 5,88\n\nTitle: Bad\nURL: javascript:alert(1)\n");
    expect(out).toEqual([{ title: "Cotação", url: "https://example.com/dolar", snippet: "Dólar 5,88", provider: "Exa" }]);
  });
  it("reports blocked on rate limit without breaking the chat", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("x", { status: 429 }));
    vi.stubGlobal("fetch", fetcher);
    const result = await researchWeb("Qual a cotação do dólar hoje?", new AbortController().signal);
    expect(result.status).toBe("blocked");
    expect(result.sources).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toBe("https://mcp.exa.ai/mcp");
  });
  it("reports connection errors and keeps going", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await researchWeb("O que é fotossíntese?", new AbortController().signal);
    expect(result.status).toBe("error");
    expect(result.notice).toContain("A conversa continua");
  });
  it("reports found results", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sse("Title: Energia solar\nURL: https://example.com/solar\nText:\nRenovável.")));
    const result = await researchWeb("Pesquise energia solar", new AbortController().signal);
    expect(result.status).toBe("found");
    expect(result.sources[0]?.url).toBe("https://example.com/solar");
  });
});
