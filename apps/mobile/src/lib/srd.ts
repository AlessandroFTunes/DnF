import { useCallback, useEffect, useState } from 'react';
import { createSrdCatalog, createSrdClient } from '@dnf/sdk/srd';
import Constants from 'expo-constants';
import { persistentCache } from './persistent-cache';

import './pocketbase';
import { PocketBase } from '@dnf/core/pocketbase';

/**
 * Compêndio de regras: a 5e-FastAPI (dados em português). O app não fala direto com ela: passa pelo
 * PocketBase (`core/pb_hooks/srd.pb.js`), que guarda o token do Cloudflare Access e só atende logados.
 * `EXPO_PUBLIC_DND_API_URL` aponta para outra instância (ex.: uma API local, sem login).
 */
// No celular (Expo Go), "localhost" é o próprio celular: troca pelo IP da máquina que roda o Metro.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
const directUrl = process.env.EXPO_PUBLIC_DND_API_URL?.replace('//localhost', `//${devHost}`);

const client = createSrdClient({ baseUrl: directUrl ?? `${PocketBase.client().baseURL}/srd` });
if (!directUrl) {
  client.use({
    onRequest({ request }) {
      const token = PocketBase.client().authStore.token;
      if (token) request.headers.set('Authorization', token);
      return request;
    },
  });
}

export const srd = createSrdCatalog(client);

/**
 * Os textos da API já vêm em português; `tr` só mantém a forma das telas (`tr.name(classe)`) caso um dia
 * entre outro idioma.
 */
export const tr = {
  locale: 'pt-BR' as const,
  name: (entity: { name: string }, _kind?: string) => entity.name,
  desc: (entity: { desc?: string | null }) => entity.desc ?? '',
  text: (text: string, _kind?: string) => text,
  field: (_key: string, _field: string, fallback: string) => fallback,
};

/**
 * Versão dos dados do compêndio guardados no aparelho. AUMENTE sempre que o SDK mudar o que uma
 * consulta devolve: ao abrir, o app apaga o cache antigo inteiro e busca de novo.
 *  1: primeira versão
 *  2: subclasses das duas edições em cada classe
 *  3: subclasses e magias do Guia de Xanathar e do Caldeirão de Tasha (complemento)
 *  4: troca da Open5e pela 5e-FastAPI
 *  5: característica repetida em níveis maiores (Golpe Brutal Fortalecido 13 e 17) vira uma só
 *  6: talentos, equipamento e magias dos três livros carregados (o cache tinha as listas vazias); Artífice na criação 2024
 */
const SRD_CACHE_VERSION = 6;
const cacheReady = persistentCache.get<number>('meta:version').then(async (stored) => {
  if (stored === SRD_CACHE_VERSION) return;
  await persistentCache.clear();
  await persistentCache.set('meta:version', SRD_CACHE_VERSION);
});

/**
 * Cada consulta do compêndio é feita uma vez só: primeiro a memória (mesma sessão), depois o disco
 * (aberturas seguintes do app), e só então a rede. O que vem da rede é guardado no disco.
 */
const cache = new Map<string, Promise<unknown>>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  let promise = cache.get(key) as Promise<T> | undefined;
  if (!promise) {
    promise = cacheReady.then(async () => {
      const saved = await persistentCache.get<T>(key);
      if (saved !== undefined) return saved;
      const data = await load();
      void persistentCache.set(key, data);
      return data;
    });
    cache.set(key, promise);
    promise.catch(() => cache.delete(key)); // falhou: a próxima tentativa busca de novo
  }
  return promise;
}

/**
 * Abre o compêndio enquanto o app ainda está na splash: carrega (do disco ou da rede) as listas que as
 * primeiras telas usam, com as mesmas chaves do `useSrd`, para elas já encontrarem tudo pronto.
 * Nunca falha e nunca passa de `timeoutMs`: o que não chegar a tempo é buscado depois, na tela.
 */
export function prefetchSrd(timeoutMs = 8000): Promise<void> {
  const loads: [string, () => Promise<unknown>][] = [
    ['languages', () => srd.languages()],
    ['alignments', () => srd.alignments()],
    ...(['2014', '2024'] as const).flatMap((edition) => [
      [`classes:${edition}`, () => srd.classes(edition)] as [string, () => Promise<unknown>],
      [`species:${edition}`, () => srd.species(edition)] as [string, () => Promise<unknown>],
      [`backgrounds:${edition}`, () => srd.backgrounds(edition)] as [string, () => Promise<unknown>],
      [`feats:${edition}`, () => srd.feats(edition)] as [string, () => Promise<unknown>],
      [`items:${edition}`, () => srd.items(edition)] as [string, () => Promise<unknown>],
    ]),
  ];
  const all = Promise.allSettled(loads.map(([key, load]) => cached(key, load))).then(() => undefined);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([all, timeout]);
}

/** Apaga o compêndio guardado (memória e disco): a próxima consulta busca tudo de novo na rede. */
export async function refreshSrd() {
  cache.clear();
  await persistentCache.clear();
}

export type SrdState<T> =
  | { status: 'loading'; retry: () => void }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; data: T; retry: () => void };

/**
 * Busca um recurso do SRD com cache. `key` identifica a consulta (ex.: `classes:2024`);
 * passe `null` para não buscar ainda.
 */
export function useSrd<T>(key: string | null, load: () => Promise<T>): SrdState<T> {
  const [attempt, setAttempt] = useState(0);
  // Resultado da última consulta concluída; "carregando" é derivado de key/attempt diferentes.
  const [result, setResult] = useState<{ key: string; attempt: number; ok: boolean; data?: T } | null>(null);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!key) return;
    let active = true;
    cached(key, load).then(
      (data) => active && setResult({ key, attempt, ok: true, data }),
      () => active && setResult({ key, attempt, ok: false }),
    );
    return () => {
      active = false;
    };
    // `load` muda a cada render; a consulta é identificada pela `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  if (!result || result.key !== key || result.attempt !== attempt) return { status: 'loading', retry };
  if (!result.ok) return { status: 'error', retry };
  return { status: 'ready', data: result.data as T, retry };
}
