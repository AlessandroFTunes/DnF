/// <reference path="../../pb_data/types.d.ts" />

/** Provedores de TTS_PROVIDERS, na ordem (padrão: elevenlabs). */
function defaultProviders() {
  return ($os.getenv("TTS_PROVIDERS") || "elevenlabs").split(",").map((n) => n.trim()).filter(Boolean);
}

/** Aumente para descartar as falas guardadas no servidor (ex.: trocou a voz ou os ajustes de um adapter). */
const CACHE_VERSION = 1;

/**
 * Falas já geradas ficam em `pb_data/tts_cache/`, uma por voz e texto: cada fala é paga uma vez só, para todos
 * os jogadores e aparelhos (o cache do app é por aparelho).
 */
function cacheFile(e, voice, text) {
  return e.app.dataDir() + "/tts_cache/" + $security.sha256(CACHE_VERSION + "|" + voice + "|" + text) + ".json";
}

function readCache(file) {
  try {
    return JSON.parse(toString($os.readFile(file)));
  } catch (_) {
    return null; // ainda não gerada (ou arquivo ilegível): gera de novo
  }
}

function writeCache(e, file, result) {
  try {
    $os.mkdirAll(e.app.dataDir() + "/tts_cache", 0o755);
    $os.writeFile(file, JSON.stringify(result), 0o644);
  } catch (err) {
    e.app.logger().warn("tts: não deu para guardar a fala", "error", String(err));
  }
}

/**
 * Responde com a fala do primeiro provedor de `names` que tem chave e não falha. `voice` nomeia a voz no cache.
 * Só a resposta do provedor principal (o primeiro) é guardada: a de uma reserva não fica no lugar dela.
 */
function speak(e, voice, names) {
  const text = (e.request.url.query().get("text") || "").trim();
  // Limite para ninguém gastar os créditos com textos longos.
  if (!text || text.length > 600) return e.json(400, { message: "Texto vazio ou maior que 600 caracteres." });

  const file = cacheFile(e, voice, text);
  const saved = readCache(file);
  if (saved) return e.json(200, saved);

  const errors = [];
  for (const name of names) {
    const provider = require(`${__hooks}/tts/${name}.js`);
    if (!provider.available()) continue;
    try {
      const result = provider.createVoice(text);
      if (name === names[0]) writeCache(e, file, result);
      return e.json(200, result);
    } catch (err) {
      errors.push(name + ": " + err);
      e.app.logger().warn("tts: provedor falhou", "provider", name, "error", String(err));
    }
  }
  if (!errors.length) return e.json(503, { message: "Narração desligada: nenhum provedor configurado." });
  return e.json(502, { message: "Todos os provedores de voz falharam.", errors: errors });
}

module.exports = { defaultProviders, speak };
