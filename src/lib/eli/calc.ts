/** Safe arithmetic evaluator (+ - * / % ^ parentheses), no eval. */
export function evaluate(expr: string): number {
  const s = expr.replace(/\s+/g, "").replace(/,/g, ".").replace(/[x×]/g, "*").replace(/÷/g, "/");
  let i = 0;
  const peek = () => s[i];
  const num = (): number => {
    if (peek() === "(") { i++; const v = add(); if (s[i++] !== ")") throw new Error("Parêntese"); return v; }
    if (peek() === "-") { i++; return -factor(); }
    if (peek() === "+") { i++; return factor(); }
    const m = /^\d*\.?\d+(e[+-]?\d+)?/i.exec(s.slice(i));
    if (!m) throw new Error("Expressão inválida");
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const factor = (): number => {
    let v = num();
    if (peek() === "%") { i++; v = v / 100; }
    if (peek() === "^") { i++; v = Math.pow(v, factor()); }
    return v;
  };
  const mul = (): number => {
    let v = factor();
    while (peek() === "*" || peek() === "/") { const op = s[i++]; const r = factor(); v = op === "*" ? v * r : v / r; }
    return v;
  };
  const add = (): number => {
    let v = mul();
    while (peek() === "+" || peek() === "-") { const op = s[i++]; const r = mul(); v = op === "+" ? v + r : v - r; }
    return v;
  };
  if (!s) throw new Error("Vazio");
  const v = add();
  if (i !== s.length) throw new Error("Expressão inválida");
  if (!Number.isFinite(v)) throw new Error("Resultado indefinido");
  return v;
}

export function spokenToExpr(t: string) {
  return t.toLowerCase()
    .replace(/dividido por|divido por/g, "/").replace(/\bvezes\b|\bmultiplicado por\b/g, "*")
    .replace(/\bmais\b/g, "+").replace(/\bmenos\b/g, "-").replace(/\belevado a\b/g, "^")
    .replace(/\bpor cento\b/g, "%").replace(/(\d)\s*x\s*(\d)/g, "$1*$2")
    .replace(/[^0-9+\-*/%^().,\s]/g, "").trim();
}

export function formatNumber(n: number) {
  return Number(n.toFixed(8)).toLocaleString("pt-BR", { maximumFractionDigits: 6 });
}
