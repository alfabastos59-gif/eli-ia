import { useEffect, useRef, type RefObject } from "react";

/** Draws output analyser waveform; falls back to mic level bars. Reports output level. */
export function Waveform({ analyser, micLevel, active, onLevel }: { analyser: RefObject<AnalyserNode | null>; micLevel: number; active: boolean; onLevel: (l: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mic = useRef(micLevel); mic.current = micLevel;
  const lv = useRef(onLevel); lv.current = onLevel;
  useEffect(() => {
    let raf = 0; let t = 0;
    const c = ref.current!; const g = c.getContext("2d")!;
    const color = getComputedStyle(c).color;
    const draw = () => {
      raf = requestAnimationFrame(draw); t += 0.05;
      const w = (c.width = c.clientWidth * devicePixelRatio), h = (c.height = c.clientHeight * devicePixelRatio);
      g.clearRect(0, 0, w, h); g.strokeStyle = color; g.lineWidth = 2 * devicePixelRatio; g.shadowColor = color; g.shadowBlur = 8;
      const an = analyser.current;
      let out = 0;
      g.beginPath();
      if (an) {
        const d = new Uint8Array(an.fftSize); an.getByteTimeDomainData(d);
        let s = 0;
        for (let i = 0; i < d.length; i++) { const v = (d[i]! - 128) / 128; s += v * v; const x = (i / (d.length - 1)) * w; const y = h / 2 + v * h * 0.45; i ? g.lineTo(x, y) : g.moveTo(x, y); }
        out = Math.min(1, Math.sqrt(s / d.length) * 5);
      }
      if (out < 0.01) {
        g.beginPath();
        const amp = (active ? 0.05 + mic.current * 0.35 : 0.02) * h;
        for (let x = 0; x <= w; x += 4) { const y = h / 2 + Math.sin(x / 28 + t * 3) * amp * Math.sin(x / w * Math.PI); x ? g.lineTo(x, y) : g.moveTo(x, y); }
      }
      g.stroke();
      lv.current(out);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [analyser, active]);
  return <canvas ref={ref} className="h-14 w-full text-neon" aria-hidden />;
}
