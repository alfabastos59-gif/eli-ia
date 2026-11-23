// Minimal MessagePack encoder (Fish Audio reference upload). Works on Workers (no Buffer).
export function mpEncode(value: unknown): Uint8Array {
  const out: number[] = [];
  const push = (...b: number[]) => { for (const x of b) out.push(x & 0xff); };
  const u32 = (n: number) => push(n >>> 24, n >>> 16, n >>> 8, n);
  const bytes = (u: Uint8Array) => { for (let i = 0; i < u.length; i++) out.push(u[i]!); };
  const enc = (v: unknown): void => {
    if (v === null || v === undefined) return push(0xc0);
    if (v === true) return push(0xc3);
    if (v === false) return push(0xc2);
    if (typeof v === "number") {
      if (Number.isInteger(v) && v >= 0 && v < 0x80) return push(v);
      if (Number.isInteger(v) && v >= 0 && v <= 0xffffffff) { push(0xce); return u32(v); }
      const dv = new DataView(new ArrayBuffer(8)); dv.setFloat64(0, v);
      push(0xcb); return bytes(new Uint8Array(dv.buffer));
    }
    if (typeof v === "string") {
      const s = new TextEncoder().encode(v);
      if (s.length < 32) push(0xa0 | s.length);
      else if (s.length < 0x100) push(0xd9, s.length);
      else if (s.length < 0x10000) push(0xda, s.length >> 8, s.length);
      else { push(0xdb); u32(s.length); }
      return bytes(s);
    }
    if (v instanceof Uint8Array) { push(0xc6); u32(v.length); return bytes(v); }
    if (Array.isArray(v)) {
      if (v.length < 16) push(0x90 | v.length); else push(0xdc, v.length >> 8, v.length);
      v.forEach(enc); return;
    }
    if (typeof v === "object") {
      const e = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
      if (e.length < 16) push(0x80 | e.length); else push(0xde, e.length >> 8, e.length);
      for (const [k, x] of e) { enc(k); enc(x); }
      return;
    }
    throw new Error("Tipo não suportado");
  };
  enc(value);
  return new Uint8Array(out);
}
