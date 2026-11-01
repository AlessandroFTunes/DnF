/// <reference path="../../pb_data/types.d.ts" />

// Adapter da ElevenLabs para o `/tts` (ver `tts.pb.js`). Só a chave vem do ambiente (ELEVENLABS_API_KEY); voz,
// modelo e ajustes ficam fixos aqui. Voz: Lily (feminina), com um reverb leve de voz dentro da cabeça (`hall`).
// Este arquivo é o narrador (calmo, plano e pausado); `elevenlabs-sage.js` é o Grande Sábio, com outros ajustes.
const VOICE_ID = "pFZP5JQG7iQjIQuC4Bku";
const MODEL_ID = "eleven_multilingual_v2";
const AUDIO_EFFECTS = { environment_id: "hall", distance: 0.1, send_level: 0.45 };

/** Adapter com estes ajustes de voz fixos: { available, createVoice }. */
function withSettings(voiceSettings) {
  return {
    available: () => !!$os.getenv("ELEVENLABS_API_KEY"),

    /** Criar voz: { audio (mp3 em base64), format, starts (início de cada letra, s), duration (s) }; lança se falhar. */
    createVoice: (text) => {
      const res = $http.send({
        method: "POST",
        url: "https://api.elevenlabs.io/v1/text-to-speech/" + VOICE_ID + "/with-timestamps?output_format=mp3_44100_128",
        headers: { "xi-api-key": $os.getenv("ELEVENLABS_API_KEY"), "Content-Type": "application/json" },
        body: JSON.stringify({ text: text, model_id: MODEL_ID, voice_settings: voiceSettings, audio_effects: AUDIO_EFFECTS }),
        timeout: 30,
      });
      if (res.statusCode !== 200) throw new Error("ElevenLabs " + res.statusCode + ": " + toString(res.body));
      const alignment = res.json.alignment || { character_start_times_seconds: [], character_end_times_seconds: [] };
      const ends = alignment.character_end_times_seconds;
      return {
        audio: res.json.audio_base64,
        format: "mp3",
        starts: alignment.character_start_times_seconds,
        duration: ends.length ? ends[ends.length - 1] : 0,
      };
    },
  };
}

// Narrador: estabilidade alta e estilo zero, sem emoção, sempre igual.
module.exports = withSettings({ stability: 0.9, similarity_boost: 0.8, style: 0, use_speaker_boost: true, speed: 0.92 });
module.exports.withSettings = withSettings;
