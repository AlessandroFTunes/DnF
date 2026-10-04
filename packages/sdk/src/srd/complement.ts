import { DiferenteKey } from '@dnf/core/util';
import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';
import { adaptTo2024, type SrdBackground, type SrdClassDetail, type SrdFeat, type SrdItem, type SrdSpecies, type SrdSpell } from './catalog';
import type { SrdTranslationSource } from './i18n';
import type { SrdEdition } from './index';

/**
 * Complemento do SRD: conteúdo que a Open5e não tem (ex.: os antecedentes de 2024 fora do SRD 5.2, as
 * subclasses e magias do Guia de Xanathar e do Caldeirão de Tasha), servido pela nossa API no mesmo formato da Open5e. O catálogo junta as duas fontes.
 */
export interface SrdComplement {
  backgrounds?(edition: SrdEdition): Promise<SrdBackground[]>;
  feats?(edition: SrdEdition): Promise<SrdFeat[]>;
  species?(edition: SrdEdition): Promise<SrdSpecies[]>;
  /** Subclasses de uma classe da Open5e (ex.: `srd_fighter`). */
  subclasses?(classKey: string): Promise<SrdClassDetail[]>;
  /** Magias da lista de uma classe até o círculo `maxLevel`. */
  spells?(classKey: string, maxLevel: number): Promise<SrdSpell[]>;
  spellsByKey?(keys: string[]): Promise<SrdSpell[]>;
  items?(edition: SrdEdition): Promise<SrdItem[]>;
  itemsByKey?(keys: string[]): Promise<SrdItem[]>;
}

/** Texto traduzido que vem junto de cada registro (`i18n` na coleção). */
interface RecordI18n {
  name?: string;
  desc?: string;
  /** Antecedentes: textos dos benefícios por tipo (equipment, tool_proficiency…). */
  benefits?: Record<string, string> | string[];
  /** Espécies: [nome, descrição] por nome do traço em inglês. */
  traits?: Record<string, [string, string]>;
  /** Subclasses: [nome, descrição] por chave da feature. */
  features?: Record<string, [string, string]>;
  /** Magias: texto de "em círculos maiores". */
  higher_level?: string;
}

const document = (r: RecordModel) => ({ key: r.document_key, name: r.document_name }) as SrdBackground['document'];

/**
 * Complemento servido pelo PocketBase (coleções públicas `srd_backgrounds`, `srd_feats`, `srd_species`,
 * `srd_subclasses`, `srd_spells`).
 * `onTranslations` recebe os textos traduzidos de cada lote carregado (para registrar no tradutor).
 */
export function createPocketBaseComplement(
  client: PocketBase | (() => PocketBase),
  onTranslations?: (locale: string, source: SrdTranslationSource) => void,
): SrdComplement {
  // Aceita o cliente ou uma função que o devolve (resolvido só na primeira consulta).
  const getClient = typeof client === 'function' ? client : () => client;

  const query = async (collection: string, filter: string, params: Record<string, unknown>, sort = 'name') => {
    const pb = getClient();
    const records = await pb.collection(collection).getFullList({
      filter: pb.filter(filter, params),
      sort,
      // Conteúdo público: não depende de login nem cancela por requisição repetida.
      requestKey: null,
    });
    publish(records);
    return records;
  };
  const list = (collection: string, edition: SrdEdition) => query(collection, 'edition = {:edition}', { edition });

  /** Magia no formato da Open5e; as classes ganham a chave da edição pedida (`srd_wizard`, `srd-2024_wizard`). */
  const toSpell = (r: RecordModel, edition: SrdEdition) =>
    ({
      key: r.key,
      name: r.name,
      desc: r.desc,
      level: r.level,
      school: { key: r.school, name: r.school.charAt(0).toUpperCase() + r.school.slice(1) },
      casting_time: r.casting_time,
      range_text: r.range_text,
      duration: r.duration,
      concentration: r.concentration,
      ritual: r.ritual,
      verbal: r.verbal,
      somatic: r.somatic,
      material: r.material,
      material_specified: r.material_specified,
      attack_roll: r.attack_roll,
      saving_throw_ability: r.saving_throw_ability,
      damage_roll: r.damage_roll,
      higher_level: r.higher_level,
      classes: (r.classes as string[]).map((slug) => ({
        key: DiferenteKey.build(edition, slug),
        name: slug.charAt(0).toUpperCase() + slug.slice(1),
      })),
    }) as unknown as SrdSpell;

  /** Converte o `i18n` dos registros em fontes do tradutor (por chave). */
  function publish(records: RecordModel[]) {
    if (!onTranslations) return;
    const byLocale = new Map<string, NonNullable<SrdTranslationSource['byKey']>>();
    const namesByLocale = new Map<string, Record<string, string>>();
    for (const r of records) {
      for (const [locale, t] of Object.entries((r.i18n ?? {}) as Record<string, RecordI18n>)) {
        const byKey = byLocale.get(locale) ?? byLocale.set(locale, {}).get(locale)!;
        const fields: Record<string, string> = {};
        if (Array.isArray(t.benefits)) t.benefits.forEach((b, i) => (fields[`benefit:${i}`] = b));
        else for (const [type, text] of Object.entries(t.benefits ?? {})) fields[`benefit:${type}`] = text;
        if (t.higher_level) fields.higher_level = t.higher_level;
        for (const [featureKey, [name, desc]] of Object.entries(t.features ?? {})) byKey[featureKey] = { name, desc };
        for (const [trait, [name, desc]] of Object.entries(t.traits ?? {})) {
          fields[`trait:${trait}`] = desc;
          (namesByLocale.get(locale) ?? namesByLocale.set(locale, {}).get(locale)!)[trait] = name;
        }
        byKey[r.key] = { name: t.name, desc: t.desc, fields };
      }
    }
    for (const [locale, byKey] of byLocale) onTranslations(locale, { byKey, byName: namesByLocale.get(locale) });
  }

  return {
    async backgrounds(edition) {
      const records = await list('srd_backgrounds', edition);
      return records.map((r) => ({ key: r.key, name: r.name, desc: r.desc, benefits: r.benefits ?? [], document: document(r) }));
    },
    async feats(edition) {
      const records = await list('srd_feats', edition);
      return records.map(
        (r) =>
          ({
            key: r.key,
            name: r.name,
            desc: r.desc,
            type: r.type || undefined,
            prerequisite: r.prerequisite,
            benefits: r.benefits ?? [],
          }) as SrdFeat,
      );
    },
    async species(edition) {
      const records = await list('srd_species', edition);
      return records.map(
        (r) =>
          ({
            key: r.key,
            name: r.name,
            desc: r.desc,
            is_subspecies: !!r.subspecies_of,
            subspecies_of: r.subspecies_of || null,
            traits: r.traits ?? [],
          }) as SrdSpecies,
      );
    },
    /** Subclasses são de 2014; numa classe de 2024 entram adaptadas (como as da Open5e). */
    async subclasses(classKey) {
      const parsed = DiferenteKey.parse(classKey);
      if (!parsed) return [];
      const records = await query('srd_subclasses', 'subclass_of = {:slug}', { slug: parsed.slug });
      return records.map((r) => {
        const sub = { key: r.key, name: r.name, desc: r.desc, features: r.features ?? [] } as unknown as SrdClassDetail;
        return r.edition === '2014' && parsed.edition === '2024' ? adaptTo2024(sub) : sub;
      });
    },
    async spells(classKey, maxLevel) {
      const parsed = DiferenteKey.parse(classKey);
      if (!parsed) return [];
      // `classes` é um JSON com os slugs: busca o slug entre aspas para não casar "wizard" em outro nome.
      const records = await query(
        'srd_spells',
        'classes ~ {:slug} && level <= {:maxLevel}',
        { slug: `"${parsed.slug}"`, maxLevel },
        'level,name',
      );
      return records.map((r) => toSpell(r, parsed.edition));
    },
    async spellsByKey(keys) {
      // Só as chaves do complemento (as da Open5e têm outros prefixos).
      const own = keys.filter((k) => /^(xge|tce)_/.test(k));
      if (own.length === 0) return [];
      const filter = own.map((_, i) => `key = {:k${i}}`).join(' || ');
      const records = await query('srd_spells', filter, Object.fromEntries(own.map((k, i) => [`k${i}`, k])), 'level,name');
      return records.map((r) => toSpell(r, '2014'));
    },
  };
}
