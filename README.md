# Eli Ia

Quero criar o assistente virtual web E.L.I. com voz do Trunks, focado em alta velocidade de resposta, baixa latência e operação web independente.

Locked:
- Aplicação Web independente completa, moderna e responsiva (React, Tailwind CSS, Lucide icons, Motion).
- Voz clonada do Trunks do Futuro com integração para Fish Audio (áudio de referência presente no zip anexado em voice/trunks-referencia.mp3 ou FISH_REFERENCE_ID), com fallback automático para Gemini TTS (voz Charon) e síntese do navegador.
- Pipeline de streaming sentencial: processa e sintetiza a fala frase por frase (quebrando por pontuação como . ! ?) assim que os primeiros tokens chegam da IA, permitindo que a fala comece a tocar em ~1 segundo, sem aguardar o texto inteiro ser gerado.
- Interrupção de fala (Barge-in): silenciamento instantâneo do AudioContext e cancelamento da geração em andamento assim que o microfone detectar voz do usuário.
- Reconhecimento de fala universal (STT): Web Speech API como rota primária rápida e gravação com streaming de áudio/VAD como fallback para navegadores sem suporte nativo (Safari iOS e Firefox).
- Identidade visual do E.L.I.: núcleo de energia animado central com paleta verde esmeralda e neon (#0B3D2E, #07291F, #00FF00), com estados visuais claros (standby, listening, processing, speaking com efeito pulsar, executing e error).
- Funcionalidades do assistente: consulta de clima e temperatura em tempo real (com fallback para Open-Meteo), anotações rápidas com criação/edição/exclusão/exportação, calculadora integrada, e comandos naturais.
- Arquitetura limpa e modular: separar em hooks dedicados (useAudioPlayer, useSpeechRecognition, useVoiceAssistant) e componentes isolados em vez de concentrar o código em um único arquivo gigante.

Open:
- Gerenciamento de buffers PCM Web Audio a 24 kHz sem estalos ou cliques na transição entre sentenças sintetizadas.
- Interface de configuração de chaves de API (Gemini API Key, Fish Audio Key) acessível nas configurações do app para facilitar os testes.
- Histórico visual do diálogo com transcrição em tempo real e visualizador de ondas sonoras de áudio.

build a real working app, not a clickable prototype; the screen and kit files show layout, content and look (a wireframe's, structure only) and are never code to copy. The screens are the moments the user designed, not the whole product. Before building, walk through each flow as its user would and design what the pictures leave out, as a product designer would for this product: the steps a flow needs to finish and how the app responds to what the user does, including the moments its users will actually run into, like waiting on something or finding nothing yet. Add nothing a user of this product would never meet, and keep an app the user wants simple, simple. Never leave a step the product's core flows need as "coming soon", unless the brief says the user chose to. Where such a step needs an outside service, build every part up to it and say in your reply what's left to connect. Fill product gaps only, never a look the design set: an added step reuses the UI kit's tokens, chrome and parts and the nearest designed screen's layout, with no new visual direction.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://eli-ia.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/44c86c4e-e174-4c33-8376-6553fc6d97d9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
