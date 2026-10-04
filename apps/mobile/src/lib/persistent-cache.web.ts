/**
 * Web não tem sistema de arquivos (o expo-file-system é só iOS/Android): usa localStorage.
 * O limite do navegador (~5 MB) pode estourar com muitas consultas; aí o item simplesmente
 * não é guardado e é buscado de novo na próxima vez.
 */

const VERSION = 1;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PREFIX = 'srd-cache:';

export const persistentCache = {
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return undefined;
      const envelope = JSON.parse(raw) as { v: number; savedAt: number; data: T };
      if (envelope.v !== VERSION || Date.now() - envelope.savedAt > MAX_AGE_MS) return undefined;
      return envelope.data;
    } catch {
      return undefined;
    }
  },

  async set<T>(key: string, data: T): Promise<void> {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify({ v: VERSION, savedAt: Date.now(), data }));
    } catch {
      // cota do navegador cheia: segue sem guardar este item
    }
  },

  async clear(): Promise<void> {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      // nada a limpar
    }
  },
};
