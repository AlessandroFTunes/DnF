import { useCallback, useEffect, useState } from 'react';
import { createSrdCatalog, createSrdClient } from '@dnf/sdk/srd';
import Constants from 'expo-constants';
import { Cache } from '@dnf/core/cache';
import { PocketBase } from '@dnf/core/pocketbase';
import { persistentCache } from '../../cache/functions/persistent-cache';
import '../../../pocketbase';

/**
 * Compêndio de regras: a 5e-FastAPI (dados em português). O app não fala direto com ela: passa pelo
 * PocketBase (`core/pb_hooks/srd.pb.js`), que guarda o token do Cloudflare Access e só atende logados.
 * `EXPO_PUBLIC_DND_API_URL` aponta para outra instância (ex.: uma API local, sem login).
 */
// No celular (Expo Go), "localhost" é o próprio celular: troca pelo IP da máquina que roda o Metro.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
// Vazia conta como ausente (o `bun phone` zera para passar pelo PocketBase).
const directUrl = process.env.EXPO_PUBLIC_DND_API_URL?.replace('//localhost', `//${devHost}`) || undefined;

const client = createSrdClient(directUrl ? { baseUrl: directUrl } : { pocketbase: PocketBase.client() });

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
 *  7: classes e subclasses com `casting` (conjuração para a multiclasse)
 *  8: ferramentas com `variants` (proficiência de ferramenta da multiclasse)
 */
const SRD_CACHE_VERSION = 8;
const cache = Cache.create(persistentCache, SRD_CACHE_VERSION);

/**
 * Abre o compêndio enquanto o app ainda está na splash: carrega (do disco ou da rede) as listas que as
 * primeiras telas usam, com as mesmas chaves do `useSrd`, para elas já encontrarem tudo pronto.
 */
export function prefetchSrd(timeoutMs = 8000): Promise<void> {
  const loads: Record<string, () => Promise<unknown>> = {
    languages: () => srd.languages(),
    alignments: () => srd.alignments(),
  };
  for (const edition of ['2014', '2024'] as const) {
    loads[`classes:${edition}`] = () => srd.classes(edition);
    loads[`species:${edition}`] = () => srd.species(edition);
    loads[`backgrounds:${edition}`] = () => srd.backgrounds(edition);
    loads[`feats:${edition}`] = () => srd.feats(edition);
    loads[`items:${edition}`] = () => srd.items(edition);
  }
  return cache.prefetch(loads, timeoutMs);
}

/** Apaga o compêndio guardado (memória e disco): a próxima consulta busca tudo de novo na rede. */
export const refreshSrd = cache.clear;

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
    cache.cached(key, load).then(
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
