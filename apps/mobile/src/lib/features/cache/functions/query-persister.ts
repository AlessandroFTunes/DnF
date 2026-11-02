import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { persistentCache } from './persistent-cache';

const KEY = 'query-player';

/**
 * Guarda os dados do jogador (personagens e mesas) do TanStack Query no aparelho, no mesmo armazenamento do
 * compêndio (disco no celular, localStorage na web). O app abre já com o último estado e atualiza em segundo
 * plano. Grava no máximo uma vez por `throttleMs`, porque o cache muda a cada toque na ficha.
 */
export function createQueryPersister(throttleMs = 1000): Persister {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: PersistedClient | null = null;

  return {
    persistClient(client) {
      pending = client;
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        const toSave = pending;
        pending = null;
        if (toSave) void persistentCache.set(KEY, toSave);
      }, throttleMs);
    },
    async restoreClient() {
      return (await persistentCache.get<PersistedClient | null>(KEY)) ?? undefined;
    },
    async removeClient() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      pending = null;
      await persistentCache.set(KEY, null);
    },
  };
}

export const queryPersister = createQueryPersister();
