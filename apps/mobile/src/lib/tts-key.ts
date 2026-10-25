/** O que o `/tts` devolve: mp3 em base64, início de cada letra (s) e duração (s). */
export interface TtsResult {
  audio: string;
  starts: number[];
  duration: number;
}

/** Aumente para descartar as falas guardadas (ex.: trocou a voz ou o estilo em `core/pb_hooks/tts.pb.js`). */
export const TTS_CACHE_VERSION = 1;

/** Nome curto e seguro para o texto da fala (hash djb2 + tamanho). */
export function ttsHash(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  return `${hash.toString(36)}-${text.length}`;
}
