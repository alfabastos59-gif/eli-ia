import { createFileRoute } from "@tanstack/react-router";

const SYSTEM = `Você é E.L.I., um assistente virtual de voz com a personalidade do Trunks do Futuro: calmo, determinado, educado e protetor.
Responda sempre em português do Brasil, de forma curta e direta (1 a 3 frases), pois sua resposta será falada em voz alta.
Nunca use markdown, listas, emojis ou símbolos; escreva números por extenso quando curtos. Se não souber algo em tempo real, diga com honestidade.`;

type Msg = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { messages?: Msg[]; geminiKey?: string; context?: string } | null;
        if (!body?.messages?.length) return Response.json({ error: "Mensagem vazia." }, { status: 400 });
        const messages = [
          { role: "system", content: SYSTEM + (body.context ? `\nContexto: ${body.context}` : "") },
          ...body.messages.slice(-12).map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) })),
        ];
        const userKey = body.geminiKey?.trim();
        const upstream = userKey
          ? await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${userKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model: "gemini-2.5-flash", stream: true, reasoning_effort: "none", messages }),
              signal: request.signal,
            })
          : await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${process.env["LOVABLE_API_KEY"] ?? ""}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model: "openai/gpt-6.1-sol", stream: true, reasoning_effort: "low", messages }),
              signal: request.signal,
            });
        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          let msg = "A IA não respondeu agora.";
          if (upstream.status === 429) msg = "Muitas requisições. Aguarde alguns segundos.";
          else if (upstream.status === 402) msg = "Créditos de IA esgotados no workspace.";
          else if (upstream.status === 401 || upstream.status === 403) msg = userKey ? "Chave Gemini inválida ou sem permissão." : "Acesso à IA negado.";
          console.error("chat upstream", upstream.status, detail.slice(0, 300));
          return Response.json({ error: msg }, { status: upstream.status });
        }
        // Re-emit only text deltas as a plain text stream.
        const reader = upstream.body.getReader();
        const dec = new TextDecoder();
        const enc = new TextEncoder();
        let buf = "";
        const stream = new ReadableStream<Uint8Array>({
          async pull(controller) {
            const { value, done } = await reader.read();
            if (done) { controller.close(); return; }
            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              const t = line.trim();
              if (!t.startsWith("data:")) continue;
              const data = t.slice(5).trim();
              if (data === "[DONE]") continue;
              try {
                const j = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
                const c = j.choices?.[0]?.delta?.content;
                if (c) controller.enqueue(enc.encode(c));
              } catch { /* partial */ }
            }
          },
          cancel() { void reader.cancel(); },
        });
        return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
      },
    },
  },
});
