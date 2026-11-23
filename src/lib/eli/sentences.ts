/** Incremental sentence splitter: feed tokens, get complete sentences ASAP. */
export function cleanForSpeech(s: string) {
  return s.replace(/[*_#`>~|]/g, "").replace(/\s+/g, " ").trim();
}

export class SentenceSplitter {
  private buf = "";
  constructor(private minLen = 8, private softMax = 140) {}
  push(chunk: string): string[] {
    this.buf += chunk;
    const out: string[] = [];
    for (;;) {
      const re = /[.!?…;]+(?=\s|$)|\n+/g;
      let m: RegExpExecArray | null;
      let cut = -1;
      while ((m = re.exec(this.buf))) {
        const end = m.index + m[0].length;
        // must be followed by whitespace that already arrived (avoid "3." mid-number)
        if (end >= this.buf.length) break;
        if (this.buf.slice(0, end).trim().length >= this.minLen) { cut = end; break; }
      }
      if (cut === -1 && this.buf.length > this.softMax) {
        const c = this.buf.lastIndexOf(", ", this.softMax);
        if (c > this.minLen) cut = c + 1;
      }
      if (cut === -1) break;
      const s = cleanForSpeech(this.buf.slice(0, cut));
      this.buf = this.buf.slice(cut);
      if (s) out.push(s);
    }
    return out;
  }
  flush(): string[] {
    const s = cleanForSpeech(this.buf);
    this.buf = "";
    return s ? [s] : [];
  }
}
