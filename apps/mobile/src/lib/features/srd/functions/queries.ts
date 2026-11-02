import { useQuery } from '@tanstack/react-query';
import type { SrdClassDetail, SrdEdition, SrdSpell } from '@dnf/sdk/srd';
import { queryClient } from '../../../query-client';
import { cache, srd, srdKey } from './client';

/**
 * Todas as consultas do compêndio. As telas só chamam estes hooks (`useClasses(edition)`, `useSpecies(edition)`…):
 * nada de chave de cache nem de `srd.*` fora desta pasta. Os parâmetros aceitam `null`/`undefined`/`''`, que
 * deixam a consulta parada (ex.: edição ainda não escolhida). Consulta nova: crie a definição em `defs` e o hook.
 */

export type SrdState<T> =
  | { status: 'loading'; retry: () => void }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; data: T; retry: () => void };

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
  const retry = () => void query.refetch();
  if (!key || query.status === 'pending') return { status: 'loading', retry };
  if (query.status === 'error') return { status: 'error', retry };
  return { status: 'ready', data: query.data as T, retry };
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

/** Multiclasse: uma consulta para todas as classes (na ordem de `classKeys`). */
export const useClassDetails = (classKeys: string[]): SrdState<SrdClassDetail[]> =>
  useSrd(classKeys.length ? `classDetails:${classKeys.join(',')}` : null, () =>
    Promise.all(classKeys.map((k) => srd.classDetail(k))),
  );

export const useSubclassesOf = (classKeys: string[]): SrdState<SrdClassDetail[][]> =>
  useSrd(classKeys.length ? `subclassesOf:${classKeys.join(',')}` : null, () =>
    Promise.all(classKeys.map((k) => srd.subclasses(k))),
  );

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
async function spellsByKey(keys: string[]): Promise<SrdSpell[]> {
  const found = await Promise.all(
    [...new Set(keys)].map((key) =>
      queryClient.fetchQuery({
        queryKey: srdKey(`spell:${key}`),
        queryFn: () => cache.stored(`spell:${key}`, async () => (await srd.spellsByKey([key]))[0] ?? null),
      }),
    ),
  );
  return found.filter((s): s is SrdSpell => !!s).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

export const useSpellsByKeys = (keys: string[]) =>
  useSrd(keys.length ? `spellsByKey:${[...keys].sort().join(',')}` : null, () => spellsByKey(keys));

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
