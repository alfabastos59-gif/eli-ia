import { describe, expect, it } from "vitest";
import { SentenceSplitter } from "@/lib/eli/sentences";
import { evaluate } from "@/lib/eli/calc";
import { parseIntent } from "@/lib/eli/commands";

describe("sentence streaming", () => {
  it("emits a sentence as soon as its terminal punctuation and following space arrive", () => {
    const s = new SentenceSplitter();
    expect(s.push("Olá, eu sou o Eli")).toEqual([]);
    expect(s.push(". Como posso")).toEqual(["Olá, eu sou o Eli."]);
    expect(s.push(" ajudar?")).toEqual([]);
    expect(s.flush()).toEqual(["Como posso ajudar?"]);
  });
  it("splits on ! and ?", () => {
    const s = new SentenceSplitter();
    expect(s.push("Claro que sim! Você quer mais? Ok ")).toEqual(["Claro que sim!", "Você quer mais?"]);
  });
});

describe("commands", () => {
  it("calculates spoken math", () => {
    expect(evaluate("18*7")).toBe(126);
    const i = parseIntent("quanto é 18 vezes 7");
    expect(i).toMatchObject({ kind: "calc", result: "126" });
  });
  it("routes weather with city", () => {
    expect(parseIntent("Qual o clima em Feira de Santana?")).toEqual({ kind: "weather", city: "Feira de Santana", tomorrow: false });
  });
  it("adds notes", () => {
    expect(parseIntent("anote comprar pão")).toEqual({ kind: "note.add", text: "comprar pão" });
  });
});
