/// <reference path="../../pb_data/types.d.ts" />

// Adapter da ElevenLabs para o Grande Sábio (`/tts/sage`): a mesma voz do narrador (`elevenlabs.js`), mais solta,
// com menos estabilidade e um pouco de estilo, para a entonação seguir a pontuação do roteiro (`sageSpeech.ts`).
module.exports = require(`${__hooks}/tts/elevenlabs.js`).withSettings({
  stability: 0.45,
  similarity_boost: 0.8,
  style: 0.35,
  use_speaker_boost: true,
  speed: 0.95,
});
