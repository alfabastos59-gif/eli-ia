import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Settings, VoiceProvider } from "@/lib/eli/settings";

const PROVIDERS: { id: VoiceProvider; label: string }[] = [
  { id: "auto", label: "Automático (Fish → Gemini → navegador)" },
  { id: "fish", label: "Fish Audio (voz do Trunks)" },
  { id: "gemini", label: "Gemini TTS (Charon)" },
  { id: "browser", label: "Voz do navegador" },
];

export function SettingsDialog({ open, onOpenChange, settings, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; settings: Settings; onSave: (s: Settings) => void }) {
  const [s, setS] = useState(settings);
  useEffect(() => { if (open) setS(settings); }, [open, settings]);
  const field = (k: "geminiKey" | "fishKey" | "fishReferenceId" | "defaultCity", label: string, hint: string, secret = false) => (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input type={secret ? "password" : "text"} autoComplete="off" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm outline-none focus:border-neon" />
      <span className="block text-xs text-muted-foreground">{hint}</span>
    </label>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-neon/30">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider">Configurações</DialogTitle>
          <DialogDescription>As chaves ficam só neste navegador e são usadas para testes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Voz</legend>
            {PROVIDERS.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input type="radio" name="prov" checked={s.provider === p.id} onChange={() => setS({ ...s, provider: p.id })} className="accent-[var(--neon)]" /> {p.label}
              </label>
            ))}
          </fieldset>
          {field("fishKey", "Chave Fish Audio", "fish.audio → API Keys. Sem ela, a voz do Trunks não é usada.", true)}
          {field("fishReferenceId", "ID do modelo de voz (opcional)", "Se vazio, a voz é clonada do áudio de referência do Trunks.")}
          {field("geminiKey", "Chave Gemini (opcional)", "Usa sua própria chave para respostas e voz Charon. Sem ela, a IA integrada é usada.", true)}
          {field("defaultCity", "Cidade padrão do clima", "Ex.: Feira de Santana. Se vazio, uso sua localização.")}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.bargeIn} onChange={(e) => setS({ ...s, bargeIn: e.target.checked })} className="accent-[var(--neon)]" />
            Interromper a fala quando eu começar a falar
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { onSave(s); onOpenChange(false); }}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
