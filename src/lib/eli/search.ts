export type WebSource = { title: string; url: string; snippet: string; provider: "DuckDuckGo" | "Wikipedia" };
export type WebStatus = "found" | "blocked" | "error" | "empty";
export type WebResearch = { sources: WebSource[]; notice: string; checkedAt: string; status: WebStatus };

export function searchPlan(text: string) {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const explicit = /\b(pesquis\w*|busqu\w*|busca|procure|procurar|na web|na internet|wikipedia)\b/.test(normalized);
  const current = /\b(hoje|agora|atual\w*|recent\w*|ultim\w*|noticia\w*|cotacao|dolar|euro|bitcoin|placar|ontem|amanha|tempo real|quanto esta|quem ganhou|resultado do jogo)\b/.test(normalized);
  const encyclopedia = /\b(quem (e|foi)|o que (e|sao)|historia|significado|definicao|wikipedia)\b/.test(normalized);
  const query = text.replace(/^(?:e\.?l\.?i\.?[, ]+)?(?:pesquise|pesquisar|busque|buscar|procure|procurar)\s*(?:na (?:web|internet)\s*)?(?:sobre\s+|por\s+)?/i, "")
    .replace(/^(?:quem (?:é|foi)|o que (?:é|são)|qual (?:é )?a definição de)\s+/i, "").replace(/[?!.]+$/, "").trim().slice(0, 300);
  return { needed: explicit || current || encyclopedia, wikipedia: encyclopedia && !current, current, query };
}