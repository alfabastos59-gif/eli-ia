import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData().catch(() => null);
        const file = form?.get("file");
        if (!(file instanceof File) || file.size < 800) return Response.json({ text: "" });
        if (file.size > 20_000_000) return Response.json({ error: "Áudio muito longo" }, { status: 413 });
        const fd = new FormData();
        fd.append("file", file, file.name || "audio.webm");
        fd.append("model", "openai/gpt-transcribe");
        fd.append("languages", "pt");
        const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env["LOVABLE_API_KEY"] ?? ""}` },
          body: fd,
        });
        if (!r.ok) {
          console.error("stt", r.status, (await r.text().catch(() => "")).slice(0, 300));
          return Response.json({ error: "Falha na transcrição" }, { status: r.status });
        }
        const j = (await r.json()) as { text?: string };
        return Response.json({ text: j.text ?? "" });
      },
    },
  },
});
