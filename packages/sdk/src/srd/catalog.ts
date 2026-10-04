import { DiferenteKey } from '@dnf/core/util';
import type { components } from './open5e';
import type { SrdComplement } from './complement';
import { SRD_DOCUMENTS, type SrdClient, type SrdEdition } from './index';

type Schemas = components['schemas'];

export type SrdClass = Pick<
  Schemas['CharacterClass'],
  'key' | 'name' | 'hit_dice' | 'hit_points' | 'saving_throws' | 'caster_type' | 'primary_abilities'
>;
export type SrdSpecies = Pick<Schemas['Species'], 'key' | 'name' | 'is_subspecies' | 'subspecies_of' | 'traits' | 'desc'>;
export type SrdBackground = Pick<Schemas['Background'], 'key' | 'name' | 'benefits' | 'desc' | 'document'>;
export type SrdAlignment = Pick<Schemas['Alignment'], 'key' | 'short_name' | 'morality' | 'societal_attitude' | 'descriptions'>;
export type SrdFeat = Pick<Schemas['Feat'], 'key' | 'name' | 'desc' | 'type' | 'benefits' | 'prerequisite'>;
export type SrdLanguage = Pick<Schemas['Language'], 'key' | 'name' | 'is_exotic' | 'is_secret'>;

// O spec da Open5e não descreve tudo o que a API devolve: os tipos abaixo seguem o payload real.

/** Feature de classe com a progressão por nível e as colunas da tabela da classe. */
export interface SrdClassFeature {
  key: string;
  name: string;
  desc?: string;
  feature_type?: Schemas['ClassFeature']['feature_type'];
  gained_at?: { level: number; detail: string | null }[];
  data_for_class_table?: { level: number; column_value: string }[];
}

export interface SrdClassDetail extends SrdClass {
  features: SrdClassFeature[];
  /** Subclasse feita para a outra edição e trazida para esta (ver `subclasses`). */
  adaptedFrom?: SrdEdition;
}

/** Nas regras de 2024 a subclasse começa no nível 3. */
const SUBCLASS_LEVEL_2024 = 3;

/**
 * Subclasse de 2014 usada numa classe de 2024: as habilidades de nível 1 e 2 passam a vir no nível 3,
 * quando a classe de 2024 escolhe a subclasse (adaptação do app; o nível original fica no `detail`).
 */
export function adaptTo2024(sub: SrdClassDetail): SrdClassDetail {
  return {
    ...sub,
    adaptedFrom: '2014',
    features: sub.features.map((f) => ({
      ...f,
      gained_at: f.gained_at?.map((g) =>
        g.level < SUBCLASS_LEVEL_2024 ? { level: SUBCLASS_LEVEL_2024, detail: `originalmente nível ${g.level}` } : g,
      ),
    })),
  };
}

export interface SrdArmorData {
  key: string;
  name: string;
  /** light | medium | heavy (o escudo de 2024 vem como "heavy" com ac_base 2). */
  category: string;
  ac_base: number;
  ac_display: string;
  ac_add_dexmod: boolean;
  ac_cap_dexmod: number | null;
  grants_stealth_disadvantage: boolean;
  strength_score_required: number | null;
}

export interface SrdWeaponData {
  key: string;
  name: string;
  damage_type: { name: string; key: string };
  damage_dice: string;
  properties: { property: { name: string; type: string | null; desc: string }; detail: string | null }[];
  is_simple: boolean;
  is_martial?: boolean;
  range?: number | null;
  long_range?: number | null;
}

export interface SrdItem {
  key: string;
  name: string;
  desc?: string;
  category: { name: string; key: string };
  weapon: SrdWeaponData | null;
  armor: SrdArmorData | null;
  cost?: string | null;
  weight?: string;
}

export type SrdSpell = Pick<
  Schemas['Spell'],
  | 'key'
  | 'name'
  | 'desc'
  | 'level'
  | 'school'
  | 'casting_time'
  | 'range_text'
  | 'duration'
  | 'concentration'
  | 'ritual'
  | 'verbal'
  | 'somatic'
  | 'material'
  | 'material_specified'
  | 'attack_roll'
  | 'saving_throw_ability'
  | 'damage_roll'
  | 'higher_level'
> & { classes: { key: string; name: string }[] };

/** Atributo com as perícias ligadas a ele (ex.: dex → acrobatics, sleight-of-hand, stealth). */
export interface SrdAbility {
  key: string;
  name: string;
  skills: { key: string; name: string }[];
}

/** Espécie base com as subespécies dela (2014 tem subespécies; 2024 não). */
export interface SrdSpeciesGroup extends SrdSpecies {
  subspecies: SrdSpecies[];
}

// Cada lista de uma edição cabe numa página (itens: ~240).
const LIMIT = 100;
const ITEM_LIMIT = 400;
const CLASS_FIELDS = 'key,name,hit_dice,hit_points,saving_throws,caster_type,primary_abilities';
const SRD_SKILLS_DOCUMENTS = new Set(['core', 'srd-2014', 'srd-2024']);

/**
 * Antecedentes por edição. O SRD tem poucos (1 em 2014, 4 em 2024); para 2014 entram também os livros
 * abertos compatíveis da Open5e. Os de 2024 precisam de atributos + talento de origem, que só o SRD 5.2 tem.
 */
export const BACKGROUND_DOCUMENTS: Record<SrdEdition, string[]> = {
  '2014': ['srd-2014', 'open5e', 'tdcs', 'toh', 'a5e-ag', 'a5e-ddg', 'a5e-gpg'],
  '2024': ['srd-2024'],
};

/**
 * Consultas do SRD usadas pelo app, por edição (2014 = SRD 5.1, 2024 = SRD 5.2).
 * Só traz dados de regra; o que o jogador escolheu fica no PocketBase.
 */
export function createSrdCatalog(client: SrdClient, options: { complements?: SrdComplement[] } = {}) {
  // `fields` e alguns filtros não estão no spec: monta a query sem a checagem de tipos.
  const loose = <Q>(query: Record<string, unknown>) => query as Q;

  const complements = options.complements ?? [];

  /**
   * Junta às listas da Open5e o que cada complemento tiver (sem repetir nomes).
   * Um complemento que falhar é ignorado: o app segue com o resto.
   */
  async function withComplement<T extends { name: string }>(
    base: T[],
    load: (c: SrdComplement) => Promise<T[]> | undefined,
    dedupe = true,
  ): Promise<T[]> {
    const extras = await Promise.all(
      complements.map((c) =>
        (load(c) ?? Promise.resolve([] as T[])).catch((error) => {
          console.warn('[srd] complemento indisponível:', error instanceof Error ? error.message : error);
          return [] as T[];
        }),
      ),
    );
    const names = new Set(base.map((b) => b.name.toLowerCase()));
    const result = [...base];
    for (const extra of extras.flat()) {
      if (dedupe && names.has(extra.name.toLowerCase())) continue;
      names.add(extra.name.toLowerCase());
      result.push(extra);
    }
    return result;
  }

  return {
    /** Classes base (sem subclasses). */
    async classes(edition: SrdEdition): Promise<SrdClass[]> {
      const query = { document__key: SRD_DOCUMENTS[edition], is_subclass: false, limit: LIMIT, ordering: 'name' };
      // `fields` (sparse fieldsets) corta as features, que pesam muito.
      const { data, error } = await client.GET('/v2/classes/', {
        params: { query: { ...query, fields: CLASS_FIELDS } as typeof query },
      });
      if (error || !data) throw new SrdError('classes', error);
      return data.results;
    },

    /** Classe completa: features com progressão e tabela (perícias, equipamento, conjuração…). */
    async classDetail(key: string): Promise<SrdClassDetail> {
      const { data, error } = await client.GET('/v2/classes/{key}/', { params: { path: { key } } });
      if (error || !data) throw new SrdError(`classe ${key}`, error);
      return data as unknown as SrdClassDetail;
    },

    /** Subclasses de uma classe, com as features (ex.: Evoker do Wizard). */
    /**
     * Todas as subclasses de uma classe, das duas edições. O SRD 5.2 só tem uma por classe; as de 2014
     * (SRD 5.1 e livros abertos: Tome of Heroes, Open5e Originals, Tal'Dorei…) também servem em 2024 —
     * e as de 2024 em 2014. Nome repetido (ex.: Life Domain) fica só a versão da própria edição.
     */
    async subclasses(classKey: string): Promise<SrdClassDetail[]> {
      const fetchFor = async (key: string) => {
        const { data, error } = await client.GET('/v2/classes/', {
          params: { query: { subclass_of: key, limit: LIMIT, ordering: 'name' } },
        });
        if (error || !data) throw new SrdError('subclasses', error);
        return data.results as unknown as SrdClassDetail[];
      };
      const parsed = DiferenteKey.parse(classKey);
      const otherEdition = parsed ? (parsed.edition === '2024' ? '2014' : '2024') : null;
      const [own, other] = await Promise.all([
        fetchFor(classKey),
        otherEdition
          ? fetchFor(DiferenteKey.build(otherEdition, parsed!.slug)).catch(() => [] as SrdClassDetail[])
          : Promise.resolve([] as SrdClassDetail[]),
      ]);
      const names = new Set(own.map((s) => s.name.toLowerCase()));
      const imported = other
        .filter((s) => !names.has(s.name.toLowerCase()))
        .map((s) => (otherEdition === '2014' ? adaptTo2024(s) : { ...s, adaptedFrom: '2024' as const }));
      const all = await withComplement([...own, ...imported], (c) => c.subclasses?.(classKey));
      return all.sort((a, b) => a.name.localeCompare(b.name));
    },

    /** Espécies base, cada uma com suas subespécies. */
    async species(edition: SrdEdition): Promise<SrdSpeciesGroup[]> {
      const { data, error } = await client.GET('/v2/species/', {
        params: { query: { document__key: SRD_DOCUMENTS[edition], limit: LIMIT, ordering: 'name' } },
      });
      if (error || !data) throw new SrdError('species', error);
      const all = await withComplement(data.results, (c) => c.species?.(edition));
      return all
        .filter((s) => !s.subspecies_of)
        .map((base) => ({ ...base, subspecies: all.filter((s) => s.subspecies_of === base.key) }));
    },

    /** Antecedentes da edição: SRD primeiro, depois os outros livros, cada grupo em ordem alfabética. */
    async backgrounds(edition: SrdEdition): Promise<SrdBackground[]> {
      const documents = BACKGROUND_DOCUMENTS[edition];
      const { data, error } = await client.GET('/v2/backgrounds/', {
        params: { query: { document__key__in: documents, limit: LIMIT, ordering: 'name' } },
      });
      if (error || !data) throw new SrdError('backgrounds', error);
      // SRD primeiro, depois o complemento (fica logo após o SRD), depois os outros livros.
      const rank = (b: SrdBackground) => {
        const i = documents.indexOf(b.document.key ?? '');
        return i === 0 ? 0 : i < 0 ? 1 : i + 1;
      };
      const all = await withComplement(data.results, (c) => c.backgrounds?.(edition));
      return all.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    },

    /** Alinhamentos são comuns às duas edições; a descrição vem por edição. */
    async alignments(): Promise<SrdAlignment[]> {
      const { data, error } = await client.GET('/v2/alignments/', { params: { query: { limit: LIMIT } } });
      if (error || !data) throw new SrdError('alignments', error);
      return data.results;
    },

    /** Os seis atributos com suas perícias (só as do SRD; a Open5e mistura conteúdo de terceiros). */
    async abilities(): Promise<SrdAbility[]> {
      const { data, error } = await client.GET('/v2/abilities/', { params: { query: loose({ limit: LIMIT }) } });
      if (error || !data) throw new SrdError('abilities', error);
      return (data.results as unknown as (SrdAbility & { skills: { key: string; name: string; document?: string }[] })[]).map(
        (a) => ({
          key: a.key,
          name: a.name,
          skills: a.skills.filter((s) => !s.key.includes('_') || SRD_SKILLS_DOCUMENTS.has(s.key.split('_')[0] ?? '')),
        }),
      );
    },

    /** Todos os itens da edição (armas e armaduras vêm com os dados embutidos). */
    async items(edition: SrdEdition): Promise<SrdItem[]> {
      const { data, error } = await client.GET('/v2/items/', {
        params: {
          query: loose({
            document__key__in: [SRD_DOCUMENTS[edition]],
            limit: ITEM_LIMIT,
            fields: 'key,name,category,weapon,armor,cost,weight',
          }),
        },
      });
      if (error || !data) throw new SrdError('items', error);
      return withComplement(data.results as unknown as SrdItem[], (c) => c.items?.(edition));
    },

    /** Itens por chave (para montar a ficha). */
    async itemsByKey(keys: string[]): Promise<SrdItem[]> {
      if (keys.length === 0) return [];
      const { data, error } = await client.GET('/v2/items/', {
        params: { query: { key__in: keys, limit: ITEM_LIMIT } },
      });
      if (error || !data) throw new SrdError('items', error);
      return withComplement(data.results as unknown as SrdItem[], (c) => c.itemsByKey?.(keys), false);
    },

    /** Magias da lista de uma classe, até o nível de magia `maxLevel` (0 = truques). */
    async spells(classKey: string, maxLevel: number): Promise<SrdSpell[]> {
      const { data, error } = await client.GET('/v2/spells/', {
        params: { query: { classes__key: classKey, level__lte: maxLevel, limit: 400, ordering: 'level,name' } as never },
      });
      if (error || !data) throw new SrdError('spells', error);
      const all = await withComplement(data.results as unknown as SrdSpell[], (c) => c.spells?.(classKey, maxLevel));
      return all.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    },

    async spellsByKey(keys: string[]): Promise<SrdSpell[]> {
      if (keys.length === 0) return [];
      const { data, error } = await client.GET('/v2/spells/', {
        params: { query: { key__in: keys, limit: 400, ordering: 'level,name' } as never },
      });
      if (error || !data) throw new SrdError('spells', error);
      return withComplement(data.results as unknown as SrdSpell[], (c) => c.spellsByKey?.(keys), false);
    },

    async feats(edition: SrdEdition): Promise<SrdFeat[]> {
      const { data, error } = await client.GET('/v2/feats/', {
        params: { query: { document__key: SRD_DOCUMENTS[edition], limit: LIMIT } },
      });
      if (error || !data) throw new SrdError('feats', error);
      return withComplement<SrdFeat>(data.results, (c) => c.feats?.(edition));
    },

    /** Idiomas (comuns às duas edições). */
    async languages(): Promise<SrdLanguage[]> {
      const { data, error } = await client.GET('/v2/languages/', { params: { query: loose({ limit: LIMIT }) } });
      if (error || !data) throw new SrdError('languages', error);
      return data.results.filter((l) => ['core', 'srd-2014', 'srd-2024'].includes(l.document.key ?? ''));
    },
  };
}

export type SrdCatalog = ReturnType<typeof createSrdCatalog>;

export class SrdError extends Error {
  constructor(resource: string, cause?: unknown) {
    super(`Falha ao buscar ${resource} na Open5e.`, { cause });
    this.name = 'SrdError';
  }
}
