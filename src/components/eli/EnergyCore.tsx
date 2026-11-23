import { motion } from "motion/react";
import type { EliState } from "@/hooks/useVoiceAssistant";

const LABEL: Record<EliState, string> = {
  standby: "Em espera", listening: "Ouvindo", processing: "Processando", speaking: "Falando", executing: "Executando", error: "Erro",
};

export function EnergyCore({ state, level, onClick }: { state: EliState; level: number; onClick: () => void }) {
  const speaking = state === "speaking";
  const err = state === "error";
  const spin = state === "processing" || state === "executing";
  return (
    <button onClick={onClick} aria-label={`Núcleo E.L.I. — ${LABEL[state]}`} className="group relative grid size-64 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-80">
      <motion.div className={`absolute inset-0 rounded-full ${err ? "bg-destructive/20" : "bg-neon/10"} blur-3xl`}
        animate={{ scale: speaking ? [1, 1.25 + level * 0.4, 1] : state === "listening" ? [1, 1.08, 1] : 1, opacity: state === "standby" ? 0.5 : 1 }}
        transition={{ duration: speaking ? 0.6 : 2.4, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className={`absolute inset-4 rounded-full border ${err ? "border-destructive/60" : "border-neon/40"} border-dashed`}
        animate={{ rotate: 360 }} transition={{ duration: spin ? 3 : 24, repeat: Infinity, ease: "linear" }} />
      <motion.div className={`absolute inset-10 rounded-full border-2 ${err ? "border-destructive/70" : "border-neon/60"}`}
        style={{ borderTopColor: "transparent", borderBottomColor: "transparent" }}
        animate={{ rotate: -360 }} transition={{ duration: spin ? 1.4 : 12, repeat: Infinity, ease: "linear" }} />
      <motion.div className="absolute inset-16 rounded-full bg-core shadow-core"
        animate={{ scale: speaking ? 1 + level * 0.18 : state === "listening" ? [1, 1.04, 1] : 1 }}
        transition={speaking ? { duration: 0.08 } : { duration: 1.6, repeat: Infinity }} />
      <motion.div className={`absolute inset-24 rounded-full ${err ? "bg-destructive" : "bg-neon"} blur-md`}
        animate={{ opacity: state === "standby" ? [0.35, 0.55, 0.35] : speaking ? 0.6 + level * 0.4 : 0.8 }}
        transition={{ duration: 2.8, repeat: Infinity }} />
      <div className="relative text-center">
        <div className="font-display text-3xl font-bold tracking-[0.3em] text-core-foreground sm:text-4xl">E.L.I.</div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.35em] text-core-foreground/80">{LABEL[state]}</div>
      </div>
    </button>
  );
}
