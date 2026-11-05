import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { SrdClassDetail, SrdEdition, SrdSpell } from '@dnf/sdk/srd';
import { queryClient } from '../../../query-client';
import { useQueryState, type QueryState } from '../../../query-state';
import { cache, srd, srdKey } from './client';

/**
 * Todas as consultas do compêndio. As telas só chamam estes hooks (`useClasses(edition)`, `useSpecies(edition)`…):
 * nada de chave de cache nem de `srd.*` fora desta pasta. Os parâmetros aceitam `null`/`undefined`/`''`, que
 * deixam a consulta parada (ex.: edição ainda não escolhida). Consulta nova: crie a definição em `defs` e o hook.
 */

export type SrdState<T> = QueryState<T>;

type Maybe<T> = T | null | undefined | false | '';

/**
 * Busca um recurso do SRD (TanStack Query por cima do cache em disco). `key` identifica a consulta
 * (ex.: `classes:2024`); passe `null` para não buscar ainda.
 */
function useSrd<T>(key: string | null, load: () => Promise<T>): SrdState<T> {
  // `load` muda a cada render; a consulta é identificada pela `key`.
  const query = useQuery({
    queryKey: srdKey(key ?? ''),
    queryFn: () => cache.stored(key as string, load),
    enabled: !!key,
  });
  return useQueryState(query);
}

/**
 * Várias consultas de uma vez, cada uma com a sua chave (`useQueries`): o que já veio de outra tela não é
 * buscado de novo, e uma nova (ex.: mais uma magia) não refaz as demais. Fica `loading` até todas chegarem.
 */
function useSrdMany<T>(items: { key: string; load: () => Promise<T> }[]): SrdState<T[]> {
  const keys = items.map((i) => i.key);
  const joined = keys.join('|');
  const raw = useQueries({
    queries: items.map(({ key, load }) => ({ queryKey: srdKey(key), queryFn: () => cache.stored(key, load) })),
    combine: (results) => {
      if (!results.length || results.some((r) => r.data === undefined)) {
        return { failed: results.some((r) => r.isError && r.data === undefined), data: undefined as T[] | undefined };
      }
      return { failed: false, data: results.map((r) => r.data as T) };
    },
  });
  return useMemo<SrdState<T[]>>(() => {
    const refresh = () =>
      queryClient.refetchQueries({
        predicate: (q) => q.queryKey[0] === 'srd' && keys.includes(String(q.queryKey[1])) && q.state.status === 'error',
      });
    const retry = () => void refresh();
    if (raw.data) return { status: 'ready', data: raw.data, retry, refresh };
    return { status: raw.failed ? 'error' : 'loading', retry, refresh };
    // As chaves identificam as consultas; `keys` é recriada a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, joined]);
}

/** Chave + busca de cada consulta, para os hooks e o `prefetchSrd` usarem as mesmas. */
const defs = {
  classes: (e: SrdEdition) => ({ key: `classes:${e}`, load: () => srd.classes(e) }),
  species: (e: SrdEdition) => ({ key: `species:${e}`, load: () => srd.species(e) }),
  backgrounds: (e: SrdEdition) => ({ key: `backgrounds:${e}`, load: () => srd.backgrounds(e) }),
  feats: (e: SrdEdition) => ({ key: `feats:${e}`, load: () => srd.feats(e) }),
  items: (e: SrdEdition) => ({ key: `items:${e}`, load: () => srd.items(e) }),
  languages: () => ({ key: 'languages', load: () => srd.languages() }),
  alignments: () => ({ key: 'alignments', load: () => srd.alignments() }),
};

function useDef<T>(def: { key: string; load: () => Promise<T> } | null): SrdState<T> {
  return useSrd(def?.key ?? null, def?.load ?? (() => Promise.reject(new Error('consulta parada'))));
}

// ── Listas por edição ────────────────────────────────────────────────────────────────────────────────────
export const useClasses = (edition: Maybe<SrdEdition>) => useDef(edition ? defs.classes(edition) : null);
export const useSpecies = (edition: Maybe<SrdEdition>) => useDef(edition ? defs.species(edition) : null);
export const useBackgrounds = (edition: Maybe<SrdEdition>) => useDef(edition ? defs.backgrounds(edition) : null);
export const useFeats = (edition: Maybe<SrdEdition>) => useDef(edition ? defs.feats(edition) : null);
export const useItems = (edition: Maybe<SrdEdition>) => useDef(edition ? defs.items(edition) : null);

// ── Listas fixas ─────────────────────────────────────────────────────────────────────────────────────────
export const useLanguages = () => useDef(defs.languages());
export const useAlignments = () => useDef(defs.alignments());

// ── Classes ──────────────────────────────────────────────────────────────────────────────────────────────
export const useClass = (classKey: Maybe<string>) =>
  useSrd(classKey ? `class:${classKey}` : null, () => srd.classDetail(classKey as string));

export const useSubclasses = (classKey: Maybe<string>) =>
  useSrd(classKey ? `subclasses:${classKey}` : null, () => srd.subclasses(classKey as string));

/** Multiclasse: um detalhe por classe, na ordem de `classKeys` (compartilha o cache de `useClass`). */
export const useClassDetails = (classKeys: string[]): SrdState<SrdClassDetail[]> =>
  useSrdMany(classKeys.map((k) => ({ key: `class:${k}`, load: () => srd.classDetail(k) })));

/** Subclasses de cada classe, na ordem de `classKeys` (compartilha o cache de `useSubclasses`). */
export const useSubclassesOf = (classKeys: string[]): SrdState<SrdClassDetail[][]> =>
  useSrdMany(classKeys.map((k) => ({ key: `subclasses:${k}`, load: () => srd.subclasses(k) })));

export const useMulticlassSlots = (edition: Maybe<SrdEdition>) =>
  useSrd(edition ? `multiclassSlots:${edition}` : null, () => srd.multiclassSlots(edition as SrdEdition));

// ── Magias ───────────────────────────────────────────────────────────────────────────────────────────────
/** Magias da classe até o círculo `maxLevel`. */
export const useSpells = (classKey: Maybe<string>, maxLevel: number, edition?: SrdEdition) =>
  useSrd(classKey ? `spells:${classKey}:${maxLevel}:${edition}` : null, () =>
    srd.spells(classKey as string, maxLevel, edition),
  );

/**
 * Magias por chave, cada uma guardada à parte: aprender uma magia nova não busca de novo as que já vieram.
 * Mesma ordem de `srd.spellsByKey` (círculo, depois nome).
 */
export function useSpellsByKeys(keys: string[]): SrdState<SrdSpell[]> {
  const state = useSrdMany(
    [...new Set(keys)].map((key) => ({
      key: `spell:${key}`,
      load: async () => (await srd.spellsByKey([key]))[0] ?? null,
    })),
  );
  return useMemo<SrdState<SrdSpell[]>>(() => {
    if (state.status !== 'ready') return state;
    const spells = state.data.filter((s): s is SrdSpell => !!s).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    return { ...state, data: spells };
  }, [state]);
}

/** Magias pelo nome (as sempre preparadas de domínios, patronos e círculos), uma consulta por nome. */
export function useSpellsByNames(names: string[], edition: SrdEdition | null | undefined): SrdState<SrdSpell[]> {
  const state = useSrdMany(
    [...new Set(edition ? names : [])].map((name) => ({
      key: `spellname:${edition}:${name}`,
      load: async () => (await srd.spellsByName([name], edition ?? undefined))[0] ?? null,
    })),
  );
  return useMemo<SrdState<SrdSpell[]>>(() => {
    if (state.status !== 'ready') return state;
    return { ...state, data: state.data.filter((s): s is SrdSpell => !!s) };
  }, [state]);
}

// ── Ciclo de vida ────────────────────────────────────────────────────────────────────────────────────────
/**
 * Abre o compêndio enquanto o app ainda está na splash: carrega (do disco ou da rede) as listas que as
 * primeiras telas usam, com as mesmas chaves dos hooks, para elas já encontrarem tudo pronto.
 */
export function prefetchSrd(timeoutMs = 8000): Promise<void> {
  const list: { key: string; load: () => Promise<unknown> }[] = [defs.languages(), defs.alignments()];
  for (const edition of ['2014', '2024'] as const) {
    list.push(defs.classes(edition), defs.species(edition), defs.backgrounds(edition), defs.feats(edition), defs.items(edition));
  }
  const all = Promise.allSettled(
    list.map(({ key, load }) => queryClient.prefetchQuery({ queryKey: srdKey(key), queryFn: () => cache.stored(key, load) })),
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([all.then(() => undefined), timeout]);
}

/** Apaga o compêndio guardado (memória e disco): a próxima consulta busca tudo de novo na rede. */
export async function refreshSrd() {
  queryClient.removeQueries({ queryKey: ['srd'] });
  await cache.clear();
}
