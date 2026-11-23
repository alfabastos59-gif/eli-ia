export type Note = { id: string; text: string; createdAt: number; updatedAt: number };
const KEY = "eli.notes.v1";
let cache: Note[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: Note[] = [];

function load(): Note[] {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) || "[]") as Note[]; } catch { cache = []; }
  return cache;
}
function save(n: Note[]) {
  cache = n;
  try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* quota */ }
  listeners.forEach((l) => l());
}
export const notesStore = {
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
  get: () => (typeof window === "undefined" ? EMPTY : load()),
  getServer: () => EMPTY,
  add(text: string) {
    const now = Date.now();
    const n: Note = { id: crypto.randomUUID(), text: text.trim(), createdAt: now, updatedAt: now };
    save([n, ...load()]);
    return n;
  },
  update(id: string, text: string) { save(load().map((n) => (n.id === id ? { ...n, text, updatedAt: Date.now() } : n))); },
  remove(id: string) { save(load().filter((n) => n.id !== id)); },
  clear() { save([]); },
  exportTxt() {
    const body = load().map((n) => `[${new Date(n.createdAt).toLocaleString("pt-BR")}]\n${n.text}`).join("\n\n");
    const url = URL.createObjectURL(new Blob([body || "Sem anotações."], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url; a.download = `eli-anotacoes-${new Date().toISOString().slice(0, 10)}.txt`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
