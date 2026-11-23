import { useState, useSyncExternalStore } from "react";
import { Check, Download, Pencil, Plus, Trash2, X } from "lucide-react";
import { notesStore } from "@/lib/eli/notes";
import { Button } from "@/components/ui/button";

export function NotesPanel() {
  const notes = useSyncExternalStore(notesStore.subscribe, notesStore.get, notesStore.getServer);
  const [draft, setDraft] = useState("");
  const [edit, setEdit] = useState<{ id: string; text: string } | null>(null);
  return (
    <div className="flex h-full flex-col gap-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { notesStore.add(draft); setDraft(""); } }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Nova anotação…" className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-neon" />
        <Button type="submit" size="icon" variant="outline" aria-label="Adicionar"><Plus /></Button>
      </form>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {!notes.length && <p className="py-8 text-center text-sm text-muted-foreground">Sem anotações. Diga "anote…" ou escreva acima.</p>}
        {notes.map((n) => (
          <div key={n.id} className="group rounded-md border border-border bg-card p-2.5 text-sm">
            {edit?.id === n.id ? (
              <div className="flex gap-2">
                <textarea autoFocus value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} className="min-h-16 flex-1 rounded border border-input bg-background p-2 outline-none focus:border-neon" />
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" aria-label="Salvar" onClick={() => { if (edit.text.trim()) notesStore.update(n.id, edit.text.trim()); setEdit(null); }}><Check /></Button>
                  <Button size="icon" variant="ghost" aria-label="Cancelar" onClick={() => setEdit(null)}><X /></Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <p className="flex-1 whitespace-pre-wrap">{n.text}</p>
                <div className="flex opacity-60 group-hover:opacity-100">
                  <Button size="icon" variant="ghost" className="size-7" aria-label="Editar" onClick={() => setEdit({ id: n.id, text: n.text })}><Pencil /></Button>
                  <Button size="icon" variant="ghost" className="size-7" aria-label="Excluir" onClick={() => notesStore.remove(n.id)}><Trash2 /></Button>
                </div>
              </div>
            )}
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">{new Date(n.updatedAt).toLocaleString("pt-BR")}</div>
          </div>
        ))}
      </div>
      <Button variant="outline" disabled={!notes.length} onClick={() => notesStore.exportTxt()}><Download /> Exportar .txt</Button>
    </div>
  );
}
