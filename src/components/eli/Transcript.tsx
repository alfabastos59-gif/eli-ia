import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Message } from "@/hooks/useVoiceAssistant";
import { ExternalLink, Search, CircleCheck, ShieldAlert, WifiOff } from "lucide-react";

const WEB_STATUS = {
  found: { label: "Resultados encontrados", Icon: CircleCheck, tone: "text-neon" },
  blocked: { label: "Busca bloqueada · DuckDuckGo", Icon: ShieldAlert, tone: "text-destructive" },
  error: { label: "Falha de conexão com a busca", Icon: WifiOff, tone: "text-destructive" },
  empty: { label: "Nenhum resultado utilizável", Icon: Search, tone: "text-muted-foreground" },
};

export function Transcript({ messages, interim }: { messages: Message[]; interim: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages, interim]);
  return (
    <div className="flex-1 space-y-3 overflow-y-auto pr-1">
      {!messages.length && !interim && (
        <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-display text-base text-foreground">Nenhuma conversa ainda.</p>
            <p>Toque no núcleo para falar ou tente:</p>
            <p className="font-mono text-xs text-neon/80">"Clima em Salvador" · "Anote comprar pão" · "Quanto é 18 vezes 7"</p>
          </div>
        </div>
      )}
      <AnimatePresence initial={false}>
        {messages.map((m) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] rounded-lg border px-3 py-2 text-sm leading-relaxed ${m.role === "user" ? "border-border bg-secondary text-secondary-foreground" : m.meta === "erro" ? "border-destructive/50 bg-destructive/10 text-foreground" : "border-neon/25 bg-card text-card-foreground"}`}>
              {m.searching && <div role="status" className="mb-2 flex items-center gap-2 text-xs text-neon"><Search className="size-3.5 motion-safe:animate-pulse" /> Pesquisando na web…</div>}
              {m.text || <span className="inline-flex gap-1">{[0, 1, 2].map((i) => <motion.span key={i} className="size-1.5 rounded-full bg-neon" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />)}</span>}
              {m.pending && m.text && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-neon align-middle" />}
              {m.meta && <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{m.meta}</div>}
              {m.webStatus && (() => { const { label, Icon, tone } = WEB_STATUS[m.webStatus]; return <div role="status" className={`mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-xs ${tone}`}><Icon className="size-3.5 shrink-0" />{label}</div>; })()}
              {m.webNotice && <p className="mt-2 text-xs text-muted-foreground">{m.webNotice}</p>}
              {!!m.sources?.length && <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-foreground">Fontes consultadas ({m.sources.length})</p>
                {m.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-1.5 break-words text-xs text-neon underline-offset-2 hover:underline"><ExternalLink className="mt-0.5 size-3 shrink-0" /><span className="min-w-0">{source.provider} · {source.title}</span></a>)}
              </div>}
              {m.checkedAt && <p className="mt-1 text-[10px] text-muted-foreground">Consulta: {new Date(m.checkedAt).toLocaleString("pt-BR")}</p>}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {interim && <div className="flex justify-end"><div className="max-w-[85%] rounded-lg border border-dashed border-border px-3 py-2 text-sm italic text-muted-foreground">{interim}</div></div>}
      <div ref={end} />
    </div>
  );
}
