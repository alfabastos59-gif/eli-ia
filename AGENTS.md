<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Architecture
- E.L.I. voice assistant: `/api/chat` streams plain text, `/api/tts` returns raw PCM16 24 kHz (Fish → Gemini fallback), `/api/stt` transcribes recorder audio; browser speech is the last voice fallback. Why: one simple audio format for gapless sentence-by-sentence playback.
- Client logic lives in `src/hooks/useAudioPlayer|useSpeechRecognition|useVoiceAssistant` and pure helpers in `src/lib/eli/` (commands, sentences, calc, notes, weather). Why: keep UI components thin and logic testable.
- Web research uses the fixed free Exa MCP endpoint (as used by Agent-Reach) and Wikipedia inside the existing chat handler via a server-only helper, and returns source metadata in a response header while preserving the plain-text audio stream. Why: avoid paid search keys, arbitrary URL fetching and changes to gapless playback.
