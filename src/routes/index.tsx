import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Calculator, Mic, MicOff, NotebookPen, Send, Settings2, Square, Trash2, X, AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { EnergyCore } from "@/components/eli/EnergyCore";
import { Waveform } from "@/components/eli/Waveform";
import { Transcript } from "@/components/eli/Transcript";
import { NotesPanel } from "@/components/eli/NotesPanel";
import { CalculatorPanel } from "@/components/eli/CalculatorPanel";
import { SettingsDialog } from "@/components/eli/SettingsDialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "E.L.I. — Assistente de voz com a voz do Trunks" },
      { name: "description", content: "Assistente virtual por voz com respostas em tempo real, clima, anotações e calculadora." },
      { property: "og:title", content: "E.L.I. — Assistente de voz" },
      { property: "og:description", content: "Fale e ouça a resposta em cerca de um segundo, com a voz do Trunks do Futuro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const VOICE_LABEL: Record<string, string> = { fish: "Voz: Trunks (Fish Audio)", gemini: "Voz: Charon (Gemini)", browser: "Voz: navegador" };

function Index() {
  const eli = useVoiceAssistant();
  const [text, setText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [outLevel, setOutLevel] = useState(0);
  const busy = eli.state === "processing" || eli.state === "speaking" || eli.state === "executing";

  const toggleMic = () => (eli.stt.active ? eli.stt.stop() : void eli.stt.start());
  const coreClick = () => (busy ? eli.interrupt() : toggleMic());

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" aria-hidden />
      <header className="relative z-10 flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-neon shadow-neon" />
          <h1 className="font-display text-sm font-semibold tracking-[0.3em]">E.L.I.</h1>
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">{eli.voiceUsed ? VOICE_LABEL[eli.voiceUsed] : "Pronto"} · STT {eli.stt.mode === "native" ? "nativo" : "gravação"}</span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label="Anotações" onClick={() => eli.setPanel(eli.panel === "notes" ? null : "notes")}><NotebookPen /></Button>
          <Button variant="ghost" size="icon" aria-label="Calculadora" onClick={() => eli.setPanel(eli.panel === "calc" ? null : "calc")}><Calculator /></Button>
          <Button variant="ghost" size="icon" aria-label="Configurações" onClick={() => setSettingsOpen(true)}><Settings2 /></Button>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid max-w-6xl gap-6 px-4 pb-6 lg:grid-cols-[1fr_420px] lg:px-6">
        <section className="flex flex-col items-center justify-center gap-4 pt-2 lg:min-h-[calc(100vh-90px)]">
          <EnergyCore state={eli.state} level={eli.state === "speaking" ? outLevel : eli.stt.level} onClick={coreClick} />
          <div className="w-full max-w-md"><Waveform analyser={eli.analyser} micLevel={eli.stt.level} active={eli.stt.active} onLevel={setOutLevel} /></div>
          <div className="flex items-center gap-3">
            <Button size="lg" variant={eli.stt.active ? "default" : "outline"} onClick={toggleMic} className="rounded-full">
              {eli.stt.active ? <><MicOff /> Parar de ouvir</> : <><Mic /> Conversar</>}
            </Button>
            {busy && <Button size="lg" variant="outline" onClick={eli.interrupt} className="rounded-full"><Square /> Interromper</Button>}
          </div>
          {(eli.stt.error || eli.error) && (
            <div role="alert" className="flex max-w-md items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span className="flex-1">{eli.stt.error || eli.error}</span>
              {eli.error && <button onClick={eli.dismissError} aria-label="Fechar"><X className="size-4" /></button>}
            </div>
          )}
        </section>

        <section className="flex h-[70vh] flex-col rounded-xl border border-neon/20 bg-card/70 p-4 backdrop-blur lg:h-[calc(100vh-90px)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">Diálogo</h2>
            {eli.messages.length > 0 && <Button variant="ghost" size="sm" onClick={eli.clearHistory}><Trash2 /> Limpar</Button>}
          </div>
          <Transcript messages={eli.messages} interim={eli.interim} />
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void eli.send(text); setText(""); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Digite um comando ou pergunta…" className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-neon" />
            <Button type="submit" size="icon" disabled={!text.trim()} aria-label="Enviar"><Send /></Button>
          </form>
        </section>
      </div>

      <AnimatePresence>
        {eli.panel && (
          <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l border-neon/30 bg-popover p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-sm uppercase tracking-[0.3em]">{eli.panel === "notes" ? "Anotações" : "Calculadora"}</h2>
              <Button variant="ghost" size="icon" aria-label="Fechar painel" onClick={() => eli.setPanel(null)}><X /></Button>
            </div>
            <div className="min-h-0 flex-1">{eli.panel === "notes" ? <NotesPanel /> : <CalculatorPanel />}</div>
          </motion.aside>
        )}
      </AnimatePresence>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={eli.settings} onSave={eli.setSettings} />
    </main>
  );
}
