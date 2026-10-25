import { TTS_CACHE_VERSION, ttsHash, type TtsResult } from './tts-key';

/**
 * Web: as falas ficam no Cache Storage do navegador (o localStorage tem ~5 MB e é usado pelo compêndio).
 * Sem Cache Storage (página sem HTTPS), guarda só enquanto a página está aberta.
 */
export type { TtsResult } from './tts-key';

const CACHE = `tts-cache-v${TTS_CACHE_VERSION}`;
const memory = new Map<string, TtsResult>();
const urlFor = (text: string) => `https://tts.local/${ttsHash(text)}`;

export const ttsCache = {
  async get(text: string): Promise<TtsResult | undefined> {
    if (memory.has(text)) return memory.get(text);
    try {
      const res = await (await caches.open(CACHE)).match(urlFor(text));
      if (!res) return undefined;
      const entry = (await res.json()) as TtsResult & { text: string };
      return entry.text === text ? entry : undefined;
    } catch {
      return undefined;
    }
  },

  async set(text: string, result: TtsResult): Promise<void> {
    memory.set(text, result);
    try {
      const body = JSON.stringify({ text, ...result });
      await (await caches.open(CACHE)).put(urlFor(text), new Response(body, { headers: { 'Content-Type': 'application/json' } }));
    } catch {
      // fica só na memória
    }
  },
};
