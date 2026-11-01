/// <reference path="../pb_data/types.d.ts" />

// Narração: GET /tts?text=... (narrador) e GET /tts/sage?text=... (o Grande Sábio). Devolvem { audio (base64),
// format ("mp3" ou "wav"), starts (início de cada letra do texto, em segundos), duration }, para o app
// sincronizar a animação com a fala. Só para jogadores logados.
//
// Cada provedor é um adapter em `tts/<nome>.js` com `available()` (está configurado?) e um comando só,
// `createVoice(text)`, que fala na voz padrão dele (fixa no adapter) e devolve esse formato ou lança.
// Narrador: provedores de TTS_PROVIDERS, na ordem (ex.: "elevenlabs"). Grande Sábio: ElevenLabs com os ajustes dele,
// depois o Piper do NAS (grátis) e os do narrador, se os anteriores caírem. Se um provedor falha, tenta o próximo; o app não muda.
// `require` dentro do handler: cada handler roda num contexto isolado.
routerAdd(
  "GET",
  "/tts",
  (e) => {
    const tts = require(`${__hooks}/tts/speak.js`);
    return tts.speak(e, "narrator", tts.defaultProviders());
  },
  $apis.requireAuth(),
);

routerAdd(
  "GET",
  "/tts/sage",
  (e) => {
    const tts = require(`${__hooks}/tts/speak.js`);
    const first = ["elevenlabs-sage", "piper"];
    return tts.speak(e, "sage", [...first, ...tts.defaultProviders().filter((n) => !first.includes(n))]);
  },
  $apis.requireAuth(),
);
