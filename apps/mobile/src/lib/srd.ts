import { useCallback, useEffect, useState } from 'react';
import { PocketBase } from '@dnf/core/pocketbase';
import {
  createPocketBaseComplement,
  createSrdCatalog,
  createSrdClient,
  createTranslator,
  PT_BR,
  SRD_URL,
  type SrdTranslationSource,
} from '@dnf/sdk/srd';
import { persistentCache } from './persistent-cache';
import './pocketbase';

/**
 * Tradução para exibição (a Open5e só tem inglês). Use nas telas: `tr.name(classe)`, `tr.name(magia, 'spell')`.
 * O catálogo e as regras continuam com o texto original.
 */
export const tr = createTranslator('pt-BR', [PT_BR]);

/**
 * Catálogo do SRD, juntando duas fontes:
 *  - Open5e (SRD 5.1 e 5.2 + livros abertos);
 *  - nosso complemento (conteúdo de 2024 que a Open5e não tem), com as traduções que vêm junto.
 */
export const srd = createSrdCatalog(createSrdClient(process.env.EXPO_PUBLIC_SRD_URL ?? SRD_URL), {
  complements: [
    createPocketBaseComplement(PocketBase.client, (locale, source) => {
      if (locale !== tr.locale) return;
      tr.register(source);
      rememberTranslations(source);
    }),
  ],
});

/**
 * Versão dos dados do compêndio guardados no aparelho. AUMENTE sempre que o SDK mudar o que uma
 * consulta devolve (ex.: subclasses passaram a juntar as duas edições): ao abrir, o app apaga o cache
 * antigo inteiro e busca de novo.
 *  1: primeira versão
 *  2: subclasses das duas edições em cada classe
 *  3: subclasses e magias do Guia de Xanathar e do Caldeirão de Tasha (complemento)
 */
const SRD_CACHE_VERSION = 3;
const cacheVersionReady = persistentCache.get<number>('meta:version').then(async (stored) => {
  if (stored === SRD_CACHE_VERSION) return;
  await persistentCache.clear();
  await persistentCache.set('meta:version', SRD_CACHE_VERSION);
});

// As traduções do complemento chegam junto com os dados. Como os dados podem vir do disco (sem chamar a
// API), elas também ficam guardadas e são registradas assim que o app abre.
const TRANSLATIONS_KEY = `translations:${tr.locale}`;
let savedTranslations: SrdTranslationSource[] = [];
const translationsReady = cacheVersionReady.then(() => persistentCache.get<SrdTranslationSource[]>(TRANSLATIONS_KEY)).then((sources) => {
  savedTranslations = sources ?? [];
  savedTranslations.forEach((source) => tr.register(source));
});

function rememberTranslations(source: SrdTranslationSource) {
  void translationsReady.then(() => {
    savedTranslations = [...savedTranslations, source];
    void persistentCache.set(TRANSLATIONS_KEY, savedTranslations);
  });
}

/**
 * Cada consulta do compêndio é feita uma vez só: primeiro a memória (mesma sessão), depois o disco
 * (aberturas seguintes do app), e só então a rede. O que vem da rede é guardado no disco.
 */
const cache = new Map<string, Promise<unknown>>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  let promise = cache.get(key) as Promise<T> | undefined;
  if (!promise) {
    promise = translationsReady.then(async () => {
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
    ['abilities', () => srd.abilities()],
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
  savedTranslations = [];
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
