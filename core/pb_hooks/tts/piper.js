/// <reference path="../../pb_data/types.d.ts" />

// Adapter do Piper (voz do Grande Sábio) para o `/tts`. Chama a ponte HTTP `core/piper-http/server.py`, que fala
// com o `rpg-piper` do NAS e já devolve o formato do `/tts`. Do ambiente vem só o endereço da ponte
// (PIPER_URL, ex.: http://piper-http:5100); a voz é fixa na ponte.
module.exports = {
  available: () => !!$os.getenv("PIPER_URL"),

  /** Criar voz: { audio (wav em base64), format: "wav", starts (estimados, s), duration (s) }; lança se falhar. */
  createVoice: (text) => {
    const res = $http.send({
      method: "GET",
      url: $os.getenv("PIPER_URL").replace(/\/+$/, "") + "/tts?text=" + encodeURIComponent(text),
      // O Piper do NAS gera mais ou menos em tempo real: uma fala longa leva alguns segundos.
      timeout: 60,
    });
    if (res.statusCode !== 200) throw new Error("Piper " + res.statusCode + ": " + toString(res.body));
    return res.json;
  },
};
