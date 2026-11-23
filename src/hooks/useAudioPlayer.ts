import { useCallback, useEffect, useRef } from "react";

const RATE = 24000;
const FADE = Math.round(RATE * 0.006); // 6 ms ramps kill clicks at sentence joins

type Item = { kind: "pcm"; data: ArrayBuffer } | { kind: "browser"; text: string } | null;

/** Gapless, click-free PCM16 24 kHz player with ordered queue, barge-in stop and analyser. */
export function useAudioPlayer() {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const nextRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const genRef = useRef(0);

  const ensure = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const gain = ctx.createGain();
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      gain.connect(an).connect(ctx.destination);
      ctxRef.current = ctx; gainRef.current = gain; analyserRef.current = an;
    }
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const schedulePcm = useCallback((data: ArrayBuffer) => {
    const ctx = ensure();
    const len = Math.floor(data.byteLength / 2);
    if (len < 2) return;
    const view = new DataView(data, 0, len * 2);
    const buf = ctx.createBuffer(1, len, RATE);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = view.getInt16(i * 2, true) / 32768;
    const f = Math.min(FADE, len >> 1);
    for (let i = 0; i < f; i++) { const g = i / f; ch[i]! *= g; ch[len - 1 - i]! *= g; }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gainRef.current!);
    const start = Math.max(ctx.currentTime + 0.03, nextRef.current);
    src.start(start);
    nextRef.current = start + buf.duration;
    sourcesRef.current.add(src);
    src.onended = () => sourcesRef.current.delete(src);
  }, [ensure]);

  /** Enqueue an item promise; items play strictly in enqueue order. */
  const enqueue = useCallback((p: Promise<Item>) => {
    const gen = genRef.current;
    chainRef.current = chainRef.current.then(async () => {
      const item = await p.catch(() => null);
      if (gen !== genRef.current || !item) return;
      if (item.kind === "pcm") { schedulePcm(item.data); return; }
      // browser speech: wait for scheduled PCM to finish, then speak
      const ctx = ensure();
      const wait = Math.max(0, nextRef.current - ctx.currentTime);
      if (wait) await new Promise((r) => setTimeout(r, wait * 1000));
      if (gen !== genRef.current) return;
      await new Promise<void>((res) => {
        const u = new SpeechSynthesisUtterance(item.text);
        u.lang = "pt-BR"; u.rate = 1.08; u.pitch = 0.85;
        const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith("pt") && /male|daniel|felipe|ricardo/i.test(x.name)) ?? speechSynthesis.getVoices().find((x) => x.lang.startsWith("pt"));
        if (v) u.voice = v;
        u.onend = () => res(); u.onerror = () => res();
        speechSynthesis.speak(u);
      });
    });
  }, [ensure, schedulePcm]);

  /** Resolves when everything queued so far has finished playing. */
  const drained = useCallback(async () => {
    const gen = genRef.current;
    await chainRef.current;
    const ctx = ctxRef.current;
    while (gen === genRef.current && ctx && ctx.currentTime < nextRef.current) {
      await new Promise((r) => setTimeout(r, 60));
    }
    return gen === genRef.current;
  }, []);

  const stop = useCallback(() => {
    genRef.current++;
    chainRef.current = Promise.resolve();
    const ctx = ctxRef.current;
    if (ctx && gainRef.current) {
      const g = gainRef.current.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setValueAtTime(g.value, ctx.currentTime);
      g.linearRampToValueAtTime(0, ctx.currentTime + 0.015);
      g.setValueAtTime(1, ctx.currentTime + 0.03);
    }
    sourcesRef.current.forEach((s) => { try { s.stop(ctx ? ctx.currentTime + 0.016 : 0); } catch { /* */ } });
    sourcesRef.current.clear();
    nextRef.current = 0;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }, []);

  useEffect(() => () => { stop(); void ctxRef.current?.close(); }, [stop]);

  return { ensure, enqueue, drained, stop, analyser: analyserRef };
}
