/// <reference path="../pb_data/types.d.ts" />

// Narração (GET /tts?text=...&style=calm|sage): devolve { audio (mp3 em base64), starts (início de cada letra do
// texto, em segundos), duration }, para o app sincronizar a animação com a fala. Só para jogadores logados.
//
// Cada provedor é um adapter em `tts/<nome>.js` com `available()` (tem chave?) e `synthesize(text, style)`, que
// devolve esse formato ou lança. TTS_PROVIDERS lista a ordem (ex.: "voicestudio,elevenlabs"): se um cair, tenta
// o próximo. Para trocar de provedor, crie o adapter e mude a variável; o app não muda.
routerAdd(
  "GET",
  "/tts",
  (e) => {
    const text = (e.request.url.query().get("text") || "").trim();
    // Limite para ninguém gastar os créditos com textos longos.
    if (!text || text.length > 600) return e.json(400, { message: "Texto vazio ou maior que 600 caracteres." });
    const style = e.request.url.query().get("style") === "sage" ? "sage" : "calm";

    // require dentro do handler: cada handler roda num contexto isolado.
    const names = ($os.getenv("TTS_PROVIDERS") || "elevenlabs").split(",").map((n) => n.trim()).filter(Boolean);
    const errors = [];
    for (const name of names) {
      const provider = require(`${__hooks}/tts/${name}.js`);
      if (!provider.available()) continue;
      try {
        return e.json(200, provider.synthesize(text, style));
      } catch (err) {
        errors.push(name + ": " + err);
        e.app.logger().warn("tts: provedor falhou", "provider", name, "error", String(err));
      }
    }
    if (!errors.length) return e.json(503, { message: "Narração desligada: nenhum provedor com chave (TTS_PROVIDERS)." });
    return e.json(502, { message: "Todos os provedores de voz falharam.", errors: errors });
  },
  $apis.requireAuth(),
);
