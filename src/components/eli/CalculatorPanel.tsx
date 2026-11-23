import { useState } from "react";
import { evaluate, formatNumber } from "@/lib/eli/calc";

const KEYS = ["C", "(", ")", "/", "7", "8", "9", "*", "4", "5", "6", "-", "1", "2", "3", "+", "0", ".", "⌫", "="];

export function CalculatorPanel() {
  const [expr, setExpr] = useState("");
  const [res, setRes] = useState<string | null>(null);
  const press = (k: string) => {
    if (k === "C") { setExpr(""); setRes(null); return; }
    if (k === "⌫") { setExpr((e) => e.slice(0, -1)); return; }
    if (k === "=") { try { setRes(formatNumber(evaluate(expr))); } catch { setRes("Erro"); } return; }
    setRes(null); setExpr((e) => e + k);
  };
  return (
    <div className="space-y-3" onKeyDown={(e) => { if (e.key === "Enter") press("="); }}>
      <div className="rounded-md border border-neon/30 bg-background p-3 text-right">
        <input value={expr} onChange={(e) => { setExpr(e.target.value); setRes(null); }} aria-label="Expressão" className="w-full bg-transparent text-right font-mono text-lg outline-none" placeholder="0" />
        <div className="h-8 font-mono text-2xl text-neon">{res !== null && `= ${res}`}</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {KEYS.map((k) => (
          <button key={k} onClick={() => press(k)} className={`h-12 rounded-md border font-mono text-lg transition-colors ${k === "=" ? "border-neon bg-neon/20 text-neon hover:bg-neon/30" : "border-border bg-card hover:border-neon/50"}`}>{k}</button>
        ))}
      </div>
    </div>
  );
}
