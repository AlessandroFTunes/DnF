import { Narration } from '@dnf/core/narration';

/**
 * Web: as falas ficam no Cache Storage do navegador (o localStorage tem ~5 MB e é usado pelo compêndio).
 * Sem Cache Storage (página sem HTTPS), guarda só enquanto a página está aberta.
 */

const CACHE = `tts-cache-v${Narration.CACHE_VERSION}`;
const memory = new Map<string, Narration.Result>();
const urlFor = (text: string) => `https://tts.local/${Narration.hash(text)}`;

export const ttsCache: Narration.Store = {
  async get(text: string): Promise<Narration.Result | undefined> {
    if (memory.has(text)) return memory.get(text);
    try {
      const res = await (await caches.open(CACHE)).match(urlFor(text));
      if (!res) return undefined;
      const entry = (await res.json()) as Narration.Result & { text: string };
      return entry.text === text ? entry : undefined;
    } catch {
      return undefined;
    }
  },

  async set(text: string, result: Narration.Result): Promise<void> {
    memory.set(text, result);
    try {
      const body = JSON.stringify({ text, ...result });
      await (await caches.open(CACHE)).put(urlFor(text), new Response(body, { headers: { 'Content-Type': 'application/json' } }));
    } catch {
      // fica só na memória
    }
  },
};
