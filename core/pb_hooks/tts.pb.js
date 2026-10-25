/// <reference path="../pb_data/types.d.ts" />

// Narração da ElevenLabs (GET /tts?text=...): devolve { audio (mp3 em base64), starts (início de cada letra do
// texto, em segundos), duration }, para o app sincronizar a animação com a fala. A chave fica só no servidor
// (ELEVENLABS_API_KEY). Voz padrão: Lily (feminina); ELEVENLABS_VOICE_ID e ELEVENLABS_MODEL_ID trocam a voz e o modelo.
// Estilo "Grande Sábio": fala calma, plana e pausada, com um reverb leve de voz dentro da cabeça (`hall` da
// ElevenLabs, sem custo extra). ELEVENLABS_ENVIRONMENT troca o espaço (`tunnel` soa como caverna; ver
// GET /v1/audio-effects/catalog) ou desliga com `none`. `style=sage` (o Grande Sábio explicando uma habilidade)
// solta a voz: menos estabilidade e um pouco de estilo, para a entonação seguir a pontuação. Só para jogadores logados.
routerAdd(
  "GET",
  "/tts",
  (e) => {
    const key = $os.getenv("ELEVENLABS_API_KEY");
    if (!key) return e.json(503, { message: "Narração desligada: falta ELEVENLABS_API_KEY no servidor." });
    const text = (e.request.url.query().get("text") || "").trim();
    // Limite para ninguém gastar os créditos com textos longos.
    if (!text || text.length > 600) return e.json(400, { message: "Texto vazio ou maior que 600 caracteres." });

    const voice = $os.getenv("ELEVENLABS_VOICE_ID") || "pFZP5JQG7iQjIQuC4Bku";
    const environment = $os.getenv("ELEVENLABS_ENVIRONMENT") || "hall";
    const sage = e.request.url.query().get("style") === "sage";
    const body = {
      text: text,
      model_id: $os.getenv("ELEVENLABS_MODEL_ID") || "eleven_multilingual_v2",
      // Calma: estabilidade alta e estilo zero, sem emoção, sempre igual. Sábio: mais solta, com entonação.
      voice_settings: sage
        ? { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, speed: 0.95 }
        : { stability: 0.9, similarity_boost: 0.8, style: 0, use_speaker_boost: true, speed: 0.92 },
    };
    if (environment !== "none") body.audio_effects = { environment_id: environment, distance: 0.1, send_level: 0.45 };
    const res = $http.send({
      method: "POST",
      url: "https://api.elevenlabs.io/v1/text-to-speech/" + voice + "/with-timestamps?output_format=mp3_44100_128",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeout: 30,
    });
    if (res.statusCode !== 200) return e.json(res.statusCode, res.json || { message: toString(res.body) });
    const alignment = res.json.alignment || { character_start_times_seconds: [], character_end_times_seconds: [] };
    const ends = alignment.character_end_times_seconds;
    return e.json(200, {
      audio: res.json.audio_base64,
      starts: alignment.character_start_times_seconds,
      duration: ends.length ? ends[ends.length - 1] : 0,
    });
  },
  $apis.requireAuth(),
);
