/**
 * Tradução do conteúdo da Open5e (que só existe em inglês).
 *
 * É uma camada de exibição: o catálogo e as regras continuam lendo o texto original em inglês
 * (os parsers dependem dele), e as telas pedem o texto traduzido ao mostrar.
 *
 * A busca é em camadas, a primeira que tiver vence:
 *  1. pela chave da Open5e (`srd-2024_wizard_arcane-recovery`): tradução exata de uma entidade;
 *  2. pelo nome em inglês no dicionário do tipo (magia, item…): "Shield" item ≠ "Shield" magia;
 *  3. pelo nome em inglês no dicionário geral: vale para as duas edições e para livros de terceiros;
 *  4. o texto original.
 * Novas fontes (ex.: descrições pré-traduzidas) entram como mais um `SrdTranslationSource`.
 */

export type SrdLocale = 'en' | 'pt-BR';
export type SrdKind = 'spell' | 'item';

export interface SrdTranslationSource {
  /** Por chave da Open5e. */
  byKey?: Record<string, { name?: string; desc?: string; fields?: Record<string, string> }>;
  /** Por nome em inglês (sem diferenciar maiúsculas). */
  byName?: Record<string, string>;
  /** Por nome em inglês, só para um tipo de entidade. */
  byKind?: Partial<Record<SrdKind, Record<string, string>>>;
}

export interface SrdTranslator {
  locale: SrdLocale;
  /** Nome traduzido de uma entidade da Open5e. */
  name(entity: { key?: string; name: string }, kind?: SrdKind): string;
  /** Descrição traduzida, ou a original se ainda não houver tradução. */
  desc(entity: { key?: string; desc?: string | null }): string;
  /** Traduz um nome solto (ex.: "Thieves' Tools" vindo de um texto). */
  text(english: string, kind?: SrdKind): string;
  /** Se existe tradução (para mostrar o original junto, por exemplo). */
  has(entity: { key?: string; name: string }, kind?: SrdKind): boolean;
  /** Campo extra traduzido de uma entidade (ex.: `benefit:equipment`, `trait:Darkvision`), ou o original. */
  field(key: string, field: string, fallback: string): string;
  /** Acrescenta uma fonte depois de criado (ex.: traduções que chegam junto com os dados da API). */
  register(source: SrdTranslationSource): void;
}

type Dictionary = Map<string, string>;

function fill(target: Dictionary, entries: Record<string, string> | undefined) {
  for (const [english, translated] of Object.entries(entries ?? {})) {
    const k = english.trim().toLowerCase();
    if (!target.has(k)) target.set(k, translated); // a primeira fonte tem prioridade
  }
}

export function createTranslator(locale: SrdLocale, sources: SrdTranslationSource[] = []): SrdTranslator {
  const general: Dictionary = new Map();
  const kinds: Record<SrdKind, Dictionary> = { spell: new Map(), item: new Map() };
  const byKey = new Map<string, { name?: string; desc?: string; fields?: Record<string, string> }>();
  const register = (source: SrdTranslationSource) => {
    fill(general, source.byName);
    for (const kind of Object.keys(kinds) as SrdKind[]) fill(kinds[kind], source.byKind?.[kind]);
    for (const [key, entry] of Object.entries(source.byKey ?? {})) {
      const current = byKey.get(key);
      byKey.set(key, { ...entry, ...current, fields: { ...entry.fields, ...current?.fields } });
    }
  };
  sources.forEach(register);

  const exact = (english: string, kind?: SrdKind) => {
    const k = english.trim().toLowerCase();
    return (kind ? kinds[kind].get(k) : undefined) ?? general.get(k);
  };

  /** "Smith's Tools (20 GP)" → "Ferramentas de Ferreiro (20 PO)"; "Arrows (20)" → "Flechas (20)". */
  const lookup = (english: string, kind?: SrdKind, key?: string): string | undefined => {
    const fromKey = key ? byKey.get(key)?.name : undefined;
    if (fromKey) return fromKey;
    const found = exact(english, kind);
    if (found) return found;
    const suffix = english.match(/^(.*?)\s*\(([^)]*)\)$/);
    if (suffix) {
      const base = exact(suffix[1]!, kind);
      if (base) return `${base} (${suffix[2]!.replace(/\bGP\b/gi, 'PO')})`;
    }
    return undefined;
  };

  return {
    locale,
    name: ({ key, name }, kind) => (locale === 'en' ? name : (lookup(name, kind, key) ?? name)),
    desc: ({ key, desc }) => (locale === 'en' || !key ? (desc ?? '') : (byKey.get(key)?.desc ?? desc ?? '')),
    text: (english, kind) => (locale === 'en' ? english : (lookup(english, kind) ?? english)),
    has: ({ key, name }, kind) => locale !== 'en' && lookup(name, kind, key) !== undefined,
    field: (key, field, fallback) => (locale === 'en' ? fallback : (byKey.get(key)?.fields?.[field] ?? fallback)),
    register,
  };
}
