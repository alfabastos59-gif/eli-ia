import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioPlayer } from "./useAudioPlayer";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { SentenceSplitter } from "@/lib/eli/sentences";
import { parseIntent } from "@/lib/eli/commands";
import { notesStore } from "@/lib/eli/notes";
import { currentPlace, geocode, weatherReport } from "@/lib/eli/weather";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "@/lib/eli/settings";
import { searchPlan, type WebSource, type WebStatus } from "@/lib/eli/search";

export type EliState = "standby" | "listening" | "processing" | "speaking" | "executing" | "error";
export type Message = { id: string; role: "user" | "assistant"; text: string; meta?: string; pending?: boolean; searching?: boolean; sources?: Pick<WebSource, "title" | "url" | "provider">[]; webNotice?: string; checkedAt?: string; webStatus?: WebStatus };

export function useVoiceAssistant() {
  const player = useAudioPlayer();
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState<"processing" | "speaking" | "executing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [panel, setPanel] = useState<"notes" | "calc" | null>(null);
  const [voiceUsed, setVoiceUsed] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => { setSettingsState(loadSettings()); }, []);
  const setSettings = useCallback((s: Settings) => { saveSettings(s); setSettingsState(s); }, []);

  const interrupt = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    player.stop();
    setMessages((m) => m.map((x) => (x.pending ? { ...x, pending: false, searching: false, meta: "interrompido" } : x)));
    setBusy(null);
  }, [player]);

  const synth = useCallback((text: string, signal: AbortSignal) => {
    const s = settingsRef.current;
    if (s.provider === "browser") return Promise.resolve({ kind: "browser" as const, text });
    return fetch("/api/tts", {
      method: "POST", signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, provider: s.provider, fishKey: s.fishKey, fishReferenceId: s.fishReferenceId, geminiKey: s.geminiKey }),
    }).then(async (r) => {
      if (!r.ok) throw new Error("tts");
      setVoiceUsed(r.headers.get("x-voice-provider"));
      return { kind: "pcm" as const, data: await r.arrayBuffer() };
    }).catch((e: unknown) => {
      if (signal.aborted) throw e;
      setVoiceUsed("browser");
      return { kind: "browser" as const, text };
    });
  }, []);

  const say = useCallback((text: string, signal: AbortSignal) => {
    player.enqueue(synth(text, signal).then((it) => { if (!signal.aborted) setBusy("speaking"); return it; }));
  }, [player, synth]);

  const finish = useCallback(async (ctrl: AbortController) => {
    const ok = await player.drained();
    if (ok && abortRef.current === ctrl) { abortRef.current = null; setBusy(null); }
  }, [player]);

  const runIntent = useCallback(async (text: string, ctrl: AbortController): Promise<string | null> => {
    const intent = parseIntent(text);
    if (!intent) return null;
    setBusy("executing");
    switch (intent.kind) {
      case "stop": return "";
      case "open": setPanel(intent.panel); return intent.panel === "calc" ? "Calculadora aberta." : "Aqui estão suas anotações.";
      case "note.add": notesStore.add(intent.text); setPanel("notes"); return "Anotado.";
      case "note.list": {
        const n = notesStore.get(); setPanel("notes");
        if (!n.length) return "Você ainda não tem anotações.";
        return `Você tem ${n.length} ${n.length === 1 ? "anotação" : "anotações"}. ${n.slice(0, 3).map((x, i) => `${i + 1}: ${x.text}.`).join(" ")}`;
      }
      case "note.clear": notesStore.clear(); return "Todas as anotações foram apagadas.";
      case "calc": return `${intent.expr.replace(/\*/g, " vezes ").replace(/\//g, " dividido por ")} é igual a ${intent.result}.`;
      case "time": return `Agora são ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`;
      case "date": return `Hoje é ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`;
      case "weather": {
        try {
          const city = intent.city ?? (settingsRef.current.defaultCity || null);
          const place = city ? await geocode(city) : await currentPlace();
          if (ctrl.signal.aborted) return "";
          if (!place) return city ? `Não encontrei a cidade ${city}.` : "Diga a cidade, por exemplo: clima em Salvador. Ou defina uma cidade padrão nas configurações.";
          return await weatherReport(place, intent.tomorrow);
        } catch { return "O serviço de clima não respondeu agora. Tente de novo em instantes."; }
      }
    }
  }, []);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    interrupt();
    setError(null);
    player.ensure();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const uid = crypto.randomUUID(), aid = crypto.randomUUID();
    const history = messagesRef.current.filter((m) => m.text && !m.pending).map((m) => ({ role: m.role, content: m.text }));
    setMessages((m) => [...m, { id: uid, role: "user", text }, { id: aid, role: "assistant", text: "", pending: true }]);
    const patch = (p: Partial<Message>) => setMessages((m) => m.map((x) => (x.id === aid ? { ...x, ...p } : x)));

    const local = await runIntent(text, ctrl);
    if (local !== null) {
      if (ctrl.signal.aborted) return;
      patch({ text: local || "Ok.", pending: false, meta: "comando" });
      if (local) say(local, ctrl.signal);
      void finish(ctrl);
      return;
    }

    setBusy("processing");
    patch({ searching: searchPlan(text).needed });
    const t0 = performance.now();
    try {
      const notes = notesStore.get().slice(0, 5).map((n) => n.text).join("; ");
      const r = await fetch("/api/chat", {
        method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...history.slice(-11), { role: "user", content: text }],
          geminiKey: settingsRef.current.geminiKey || undefined,
          context: `Agora: ${new Date().toLocaleString("pt-BR")}.${notes ? ` Notas do usuário: ${notes}` : ""}`,
        }),
      });
      if (!r.ok || !r.body) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "A IA não respondeu.");
      }
      const reader = r.body.getReader();
      patch({ searching: false });
      const webHeader = r.headers.get("x-eli-research");
      if (webHeader) {
        try {
          const research = JSON.parse(decodeURIComponent(webHeader)) as { sources: Pick<WebSource, "title" | "url" | "provider">[]; notice: string; checkedAt: string; status: WebStatus };
          patch({ sources: research.sources, webNotice: research.notice, checkedAt: research.checkedAt, webStatus: research.status });
        } catch { /* text streaming remains available if metadata is malformed */ }
      }
      const dec = new TextDecoder();
      const split = new SentenceSplitter();
      let full = "";
      let first = true;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        full += chunk;
        patch({ text: full });
        for (const s of split.push(chunk)) {
          if (first) { first = false; patch({ meta: `1ª frase em ${Math.round(performance.now() - t0)} ms` }); }
          say(s, ctrl.signal);
        }
      }
      for (const s of split.flush()) say(s, ctrl.signal);
      patch({ pending: false, text: full.trim() || "…" });
      void finish(ctrl);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      patch({ pending: false, searching: false, text: msg, meta: "erro" });
      setError(msg);
      setBusy(null);
      abortRef.current = null;
    }
  }, [finish, interrupt, player, runIntent, say]);

  const stt = useSpeechRecognition({
    onFinal: (t) => { setInterim(""); void send(t); },
    onInterim: setInterim,
    onSpeechStart: () => {
      if (settingsRef.current.bargeIn && (busyRef.current === "speaking" || busyRef.current === "processing")) interrupt();
    },
  });

  const state: EliState = error && !busy ? "error" : busy ?? (stt.active ? "listening" : "standby");

  const clearHistory = useCallback(() => { interrupt(); setMessages([]); setError(null); }, [interrupt]);

  return { state, messages, interim, send, interrupt, stt, settings, setSettings, panel, setPanel, analyser: player.analyser, voiceUsed, error, dismissError: () => setError(null), clearHistory };
}
