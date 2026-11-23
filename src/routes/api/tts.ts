import { createFileRoute } from "@tanstack/react-router";
import refAsset from "@/assets/trunks-referencia.mp3.asset.json";
import { mpEncode } from "@/lib/eli/msgpack";

const REF_TEXT = "Ainda não entendo completamente o que aconteceu.";
let refAudio: Uint8Array | null = null;

async function getRef(origin: string) {
  if (refAudio) return refAudio;
  const r = await fetch(new URL(refAsset.url, origin));
  if (!r.ok) throw new Error("Áudio de referência indisponível");
  refAudio = new Uint8Array(await r.arrayBuffer());
  return refAudio;
}

async function fish(text: string, key: string, refId: string | undefined, origin: string, signal: AbortSignal) {
  const common = { text, format: "pcm", sample_rate: 24000, latency: "balanced", normalize: true, chunk_length: 200 };
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, model: "s2-pro" };
  let body: BodyInit;
  if (refId) { headers["Content-Type"] = "application/json"; body = JSON.stringify({ ...common, reference_id: refId }); }
  else {
    headers["Content-Type"] = "application/msgpack";
    body = mpEncode({ ...common, references: [{ audio: await getRef(origin), text: REF_TEXT }] }) as unknown as BodyInit;
  }
  const r = await fetch("https://api.fish.audio/v1/tts", { method: "POST", headers, body, signal });
  if (!r.ok) throw new Error(`Fish ${r.status}: ${(await r.text().catch(() => "")).slice(0, 160)}`);
  return new Uint8Array(await r.arrayBuffer());
}

function wavToPcm(buf: Uint8Array) {
  // find "data" chunk
  for (let i = 12; i < buf.length - 8; i++) {
    if (buf[i] === 0x64 && buf[i + 1] === 0x61 && buf[i + 2] === 0x74 && buf[i + 3] === 0x61) return buf.slice(i + 8);
  }
  return buf.slice(44);
}

async function gemini(text: string, userKey: string | undefined, signal: AbortSignal) {
  const prompt = `Fale em português do Brasil, com voz jovem, calma e determinada: ${text}`;
  const gen = { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } } } };
  if (userKey) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent`, {
      method: "POST", signal,
      headers: { "x-goog-api-key": userKey, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: gen }),
    });
    if (r.ok) {
      const j = (await r.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] };
      const b64 = j.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (b64) return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    }
  }
  const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
    method: "POST", signal,
    headers: { Authorization: `Bearer ${process.env["LOVABLE_API_KEY"] ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-3.1-flash-tts-preview", contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: gen, stream_format: "audio" }),
  });
  if (!r.ok) throw new Error(`Gemini TTS ${r.status}`);
  return wavToPcm(new Uint8Array(await r.arrayBuffer()));
}

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const b = (await request.json().catch(() => null)) as { text?: string; fishKey?: string; fishReferenceId?: string; geminiKey?: string; provider?: string } | null;
        const text = b?.text?.trim().slice(0, 600);
        if (!text) return Response.json({ error: "Texto vazio" }, { status: 400 });
        const origin = new URL(request.url).origin;
        const fishKey = b?.fishKey?.trim() || process.env["FISH_API_KEY"];
        const refId = b?.fishReferenceId?.trim() || process.env["FISH_REFERENCE_ID"] || undefined;
        const errors: string[] = [];
        const pref = b?.provider ?? "auto";
        if (fishKey && (pref === "auto" || pref === "fish")) {
          try {
            const pcm = await fish(text, fishKey, refId, origin, request.signal);
            return new Response(pcm as unknown as BodyInit, { headers: { "content-type": "audio/pcm", "x-voice-provider": "fish" } });
          } catch (e) { errors.push(String(e)); }
        }
        if (pref !== "browser") {
          try {
            const pcm = await gemini(text, b?.geminiKey?.trim(), request.signal);
            return new Response(pcm as unknown as BodyInit, { headers: { "content-type": "audio/pcm", "x-voice-provider": "gemini" } });
          } catch (e) { errors.push(String(e)); }
        }
        console.error("tts failed", errors);
        return Response.json({ error: errors.join(" | ") || "Sem provedor" }, { status: 502 });
      },
    },
  },
});
