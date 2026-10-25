import { Directory, File, Paths } from 'expo-file-system';
import { TTS_CACHE_VERSION, ttsHash, type TtsResult } from './tts-key';

export type { TtsResult } from './tts-key';

/**
 * Falas já geradas pela ElevenLabs, guardadas no aparelho: o mesmo texto não gasta créditos de novo. Ficam no
 * diretório de documentos (o de cache o sistema pode apagar) e não vencem. Web: `tts-cache.web.ts`.
 */

interface Entry extends TtsResult {
  v: number;
  /** O texto inteiro, para conferir (o nome do arquivo é só um hash). */
  text: string;
}

const dir = new Directory(Paths.document, 'tts-cache');

export const ttsCache = {
  async get(text: string): Promise<TtsResult | undefined> {
    try {
      const file = new File(dir, `${ttsHash(text)}.json`);
      if (!file.exists) return undefined;
      const entry = JSON.parse(await file.text()) as Entry;
      if (entry.v !== TTS_CACHE_VERSION || entry.text !== text) return undefined;
      return { audio: entry.audio, starts: entry.starts, duration: entry.duration };
    } catch {
      return undefined; // arquivo corrompido: gera de novo
    }
  },

  async set(text: string, result: TtsResult): Promise<void> {
    try {
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
      new File(dir, `${ttsHash(text)}.json`).write(JSON.stringify({ v: TTS_CACHE_VERSION, text, ...result } satisfies Entry));
    } catch (error) {
      console.warn('[tts] não deu para guardar a fala:', error instanceof Error ? error.message : error);
    }
  },
};
