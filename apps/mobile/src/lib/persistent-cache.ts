import { Directory, File, Paths } from 'expo-file-system';

/**
 * Cache em disco dos dados do compêndio (5e-FastAPI): cada consulta é baixada uma vez
 * e as próximas aberturas do app leem daqui. Fica no diretório de documentos (o de cache o sistema
 * pode apagar quando falta espaço). Web: ver `persistent-cache.web.ts`.
 */

// Formato do envelope no disco. A versão dos *dados* fica em `lib/srd.ts` (SRD_CACHE_VERSION).
const VERSION = 1;
// Os dados de regra quase não mudam; depois disso, busca de novo para pegar correções.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface Envelope<T> {
  v: number;
  savedAt: number;
  data: T;
}

const dir = new Directory(Paths.document, 'srd-cache');

/** Nome de arquivo seguro e curto para a chave (chaves com listas de ids podem ser longas). */
function fileFor(key: string): File {
  const safe = key.replace(/[^a-zA-Z0-9-]/g, '_');
  if (safe.length <= 80) return new File(dir, `${safe}.json`);
  let hash = 5381;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0;
  return new File(dir, `${safe.slice(0, 60)}_${hash.toString(36)}.json`);
}

export const persistentCache = {
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const file = fileFor(key);
      if (!file.exists) return undefined;
      const envelope = JSON.parse(await file.text()) as Envelope<T>;
      if (envelope.v !== VERSION || Date.now() - envelope.savedAt > MAX_AGE_MS) return undefined;
      return envelope.data;
    } catch {
      return undefined; // arquivo corrompido ou ilegível: busca na rede
    }
  },

  async set<T>(key: string, data: T): Promise<void> {
    try {
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
      const file = fileFor(key);
      file.write(JSON.stringify({ v: VERSION, savedAt: Date.now(), data } satisfies Envelope<T>));
    } catch (error) {
      console.warn('[srd] não deu para salvar o cache:', error instanceof Error ? error.message : error);
    }
  },

  async clear(): Promise<void> {
    try {
      if (dir.exists) dir.delete();
    } catch {
      // nada a limpar
    }
  },
};
