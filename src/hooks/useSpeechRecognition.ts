import { useCallback, useEffect, useRef, useState } from "react";

type Opts = {
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  onSpeechStart?: () => void;
};

type SR = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null; onspeechstart: (() => void) | null;
};

export type SttMode = "native" | "recorder";

/** Web Speech API first; MediaRecorder + energy VAD + server transcription as fallback. */
export function useSpeechRecognition({ onFinal, onInterim, onSpeechStart }: Opts) {
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<SttMode>("native");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const cb = useRef({ onFinal, onInterim, onSpeechStart });
  cb.current = { onFinal, onInterim, onSpeechStart };
  const activeRef = useRef(false);
  const recRef = useRef<SR | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setMode((w.SpeechRecognition || w.webkitSpeechRecognition) && !ios ? "native" : "recorder");
  }, []);

  const startNative = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const C = (w.SpeechRecognition || w.webkitSpeechRecognition)!;
    const r = new C();
    r.lang = "pt-BR"; r.continuous = true; r.interimResults = true;
    let spoke = false;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        const t = res[0].transcript;
        if (res.isFinal) { spoke = false; if (t.trim()) cb.current.onFinal(t.trim()); }
        else interim += t;
      }
      if (interim.trim().length > 2 && !spoke) { spoke = true; cb.current.onSpeechStart?.(); }
      cb.current.onInterim?.(interim);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { setError("Permissão do microfone negada."); activeRef.current = false; setActive(false); }
      else if (e.error === "network") setError("Reconhecimento nativo sem rede; usando gravação.");
    };
    r.onend = () => { if (activeRef.current) { try { r.start(); } catch { /* */ } } };
    r.start();
    recRef.current = r;
    cleanupRef.current = () => { r.onend = null; try { r.abort(); } catch { /* */ } };
  }, []);

  const startRecorder = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
    const data = new Float32Array(an.fftSize);
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";
    let rec: MediaRecorder | null = null;
    let chunks: Blob[] = [];
    let voiceMs = 0, silenceMs = 0, speaking = false, noise = 0.01;
    const TH = () => Math.max(0.02, noise * 3);
    const send = async (blob: Blob) => {
      if (blob.size < 2000) return;
      const fd = new FormData();
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      fd.append("file", blob, `fala.${ext}`);
      cb.current.onInterim?.("Transcrevendo…");
      try {
        const r = await fetch("/api/stt", { method: "POST", body: fd });
        const j = (await r.json()) as { text?: string; error?: string };
        cb.current.onInterim?.("");
        if (j.text?.trim()) cb.current.onFinal(j.text.trim());
        else if (j.error) setError(j.error);
      } catch { setError("Falha ao transcrever o áudio."); }
    };
    const iv = window.setInterval(() => {
      an.getFloatTimeDomainData(data);
      let s = 0; for (let i = 0; i < data.length; i++) s += data[i]! * data[i]!;
      const rms = Math.sqrt(s / data.length);
      setLevel(Math.min(1, rms * 8));
      if (!speaking) noise = noise * 0.97 + rms * 0.03;
      if (rms > TH()) { voiceMs += 50; silenceMs = 0; } else { silenceMs += 50; if (!speaking) voiceMs = 0; }
      if (!speaking && voiceMs >= 150) {
        speaking = true;
        cb.current.onSpeechStart?.();
        cb.current.onInterim?.("Ouvindo…");
        chunks = [];
        rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = () => void send(new Blob(chunks, { type: rec?.mimeType || mime || "audio/webm" }));
        rec.start(250);
      } else if (speaking && (silenceMs >= 800 || voiceMs > 30000)) {
        speaking = false; voiceMs = 0;
        rec?.stop();
      }
    }, 50);
    cleanupRef.current = () => {
      clearInterval(iv);
      if (rec && rec.state !== "inactive") { rec.onstop = null; rec.stop(); }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
      setLevel(0);
    };
  }, []);

  const start = useCallback(async () => {
    if (activeRef.current) return;
    setError(null);
    activeRef.current = true; setActive(true);
    try {
      if (mode === "native") startNative(); else await startRecorder();
    } catch {
      activeRef.current = false; setActive(false);
      setError("Não consegui acessar o microfone.");
    }
  }, [mode, startNative, startRecorder]);

  const stop = useCallback(() => {
    activeRef.current = false; setActive(false);
    cleanupRef.current?.(); cleanupRef.current = null;
    cb.current.onInterim?.("");
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  return { active, mode, error, level, start, stop };
}
