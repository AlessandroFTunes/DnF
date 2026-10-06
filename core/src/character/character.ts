import { z } from 'zod';
import type { RecordModel } from 'pocketbase';
import { Assert } from '../util/assert';
import { DiferenteKey } from '../util/diferenteKey';
import { fn } from '../util/fn';
import { PocketBase, sortable } from '../pocketbase';
import { Common } from '../common';
import { Examples } from '../examples';
import { abilityScoresSchema } from './abilities';
import { Sheet } from './sheet';

export namespace Character {
  export const assert = Assert.create('Character');

  // Seções guardadas como JSON. No update cada uma é mesclada com a atual (ver `update`).
  const Sections = {
    proficiencies: Sheet.Proficiencies,
    combat: Sheet.Combat,
    equipment: Sheet.Equipment,
    spellcasting: Sheet.Spellcasting,
    personality: Sheet.Personality,
    details: Sheet.Details,
  };
  type SectionName = keyof typeof Sections;
  const SECTION_NAMES = Object.keys(Sections) as SectionName[];

  const optionalKey = (description: string) => z.string().max(128).nullable().meta({ description });

  const Fields = z.object({
    name: z.string().trim().min(1).max(64).meta({ description: 'Character name.' }),
    edition: z.enum(DiferenteKey.EDITIONS).meta({
      description: 'Rules edition: 2014 (5e, SRD 5.1) or 2024 (5.5e, SRD 5.2).',
    }),
    classes: z.array(Sheet.ClassLevel).min(1).meta({
      description: 'Class levels (multiclass); the character level is their sum.',
    }),
    speciesKey: optionalKey('5e-FastAPI species id (as text), or null.'),
    backgroundKey: optionalKey('5e-FastAPI background id (as text), or null.'),
    alignmentKey: optionalKey('Alignment key (e.g. lawful-good), or null.'),
    featKeys: z.array(z.string().min(1).max(128)).meta({ description: 'Feats chosen by the player.' }),
    abilities: abilityScoresSchema.meta({ description: 'Ability scores.' }),
    xp: z.number().int().min(0).meta({ description: 'Experience points.' }),
    inspiration: z.boolean().meta({ description: 'Has (Heroic) Inspiration.' }),
    /** Usos gastos de habilidades limitadas (ex.: Fúria), pela chave da característica. */
    featureUses: z.record(z.string().min(1).max(128), z.number().int().min(0)).meta({
      description: 'Spent uses of limited features, by feature key.',
    }),
    ...Sections,
  });

  export const Info = Fields.extend({
    id: z.string().meta({ description: Common.IdDescription, example: Examples.Character.id }),
    ownerID: z.string().meta({ description: 'Id of the user who owns the character.' }),
    level: z.number().int().meta({ description: 'Total level (sum of class levels).' }),
    timeCreated: z.iso.datetime().meta({ description: 'When it was created.' }),
    timeUpdated: z.iso.datetime().meta({ description: 'When it was last updated.' }),
  }).meta({
    ref: 'Character',
    description: "A player character: the player's choices and state. Rules data comes from the 5e-FastAPI.",
    example: Examples.Character,
  });
  export type Info = z.infer<typeof Info>;

  // Criar exige só identidade, classe e atributos; o resto começa vazio.
  const Create = Fields.extend({
    speciesKey: Fields.shape.speciesKey.default(null),
    backgroundKey: Fields.shape.backgroundKey.default(null),
    alignmentKey: Fields.shape.alignmentKey.default(null),
    featKeys: Fields.shape.featKeys.default([]),
    xp: Fields.shape.xp.default(0),
    inspiration: Fields.shape.inspiration.default(false),
    featureUses: Fields.shape.featureUses.default({}),
    proficiencies: Sheet.Proficiencies.prefault({}),
    combat: Sheet.Combat.prefault({}),
    equipment: Sheet.Equipment.prefault({}),
    spellcasting: Sheet.Spellcasting.prefault({}),
    personality: Sheet.Personality.prefault({}),
    details: Sheet.Details.prefault({}),
  });

  // Seções aceitam só os campos que mudaram; o resto vem do registro atual.
  const Patch = Fields.partial().extend({
    id: Info.shape.id,
    proficiencies: patchOf(Sheet.Proficiencies),
    combat: patchOf(Sheet.Combat),
    equipment: patchOf(Sheet.Equipment),
    spellcasting: patchOf(Sheet.Spellcasting),
    personality: patchOf(Sheet.Personality),
    details: patchOf(Sheet.Details),
  });

  /** Sortable keys mapped to what each orders by — also the allowlist. */
  export const SortableColumns = sortable(
    {
      name: 'name',
      level: 'level',
      timeCreated: 'created',
      timeUpdated: 'updated',
    } satisfies Partial<Record<keyof Info, string>>,
    '-updated,id',
  );

  export const create = fn(
    Create,
    async (input) => {
      const pb = PocketBase.use();
      const ownerID = await Assert.create('Session').exists(pb.authStore.record?.id);
      const record = await pb
        .collection('characters')
        .create({ ...input, level: levelOf(input.classes), owner: ownerID });
      return serialize(record);
    },
    { title: 'Create character', description: 'Create a character owned by the logged-in user.' },
  );

  export const list = fn(
    Common.Query({ sort: SortableColumns.schema.optional(), search: z.string().optional() }),
    async (input): Promise<Common.Page<Info>> => {
      const pb = PocketBase.use();
      const ownerID = await Assert.create('Session').exists(pb.authStore.record?.id);
      // O mestre também enxerga os personagens da mesa dele; aqui são só os do usuário.
      const filter = [pb.filter('owner = {:ownerID}', { ownerID })];
      if (input.search) filter.push(pb.filter('name ~ {:search}', { search: input.search }));
      const result = await pb.collection('characters').getList(input.page, input.pageSize, {
        filter: filter.join(' && '),
        sort: SortableColumns.orderBy(input.sort),
      });
      return {
        data: result.items.map(serialize),
        page: result.page,
        pageSize: result.perPage,
        total: result.totalItems,
      };
    },
    {
      title: 'List characters',
      description: "List the logged-in user's characters. Paginated.",
    },
  );

  export const fromID = fn(
    Info.shape.id,
    (id) =>
      PocketBase.use()
        .collection('characters')
        .getOne(id)
        .then(serialize, (error) => {
          if (error?.status === 404) return null;
          throw error;
        }),
    { title: 'Get character', description: 'Fetch a single character by id.' },
  );

  export const update = fn(
    Patch,
    async ({ id, ...patch }) => {
      const current = await assert.exists(fromID.force(id));
      const data: Record<string, unknown> = { ...patch };
      for (const name of SECTION_NAMES) {
        if (patch[name]) data[name] = Sections[name].parse({ ...current[name], ...stripUndefined(patch[name]) });
      }
      if (patch.classes) data.level = levelOf(patch.classes);
      const record = await PocketBase.use().collection('characters').update(id, data);
      return serialize(record);
    },
    {
      title: 'Update character',
      description: 'Update a character sheet. Sections (combat, equipment…) merge with the current values.',
    },
  );

  export const remove = fn(
    Info.shape.id,
    async (id) => {
      await assert.exists(fromID.force(id));
      await PocketBase.use().collection('characters').delete(id);
    },
    { title: 'Delete character', description: 'Permanently delete a character.' },
  );

  /** Registros antigos podem não ter uma seção: completa com os defaults. */
  export function serialize(record: RecordModel): Info {
    return {
      id: record.id,
      ownerID: record.owner,
      name: record.name,
      edition: record.edition,
      level: record.level,
      classes: record.classes ?? [],
      speciesKey: record.speciesKey || null,
      backgroundKey: record.backgroundKey || null,
      alignmentKey: record.alignmentKey || null,
      featKeys: record.featKeys ?? [],
      abilities: record.abilities,
      xp: record.xp,
      inspiration: record.inspiration,
      featureUses: record.featureUses ?? {},
      proficiencies: Sheet.Proficiencies.parse(record.proficiencies ?? {}),
      combat: Sheet.Combat.parse(record.combat ?? {}),
      equipment: Sheet.Equipment.parse(record.equipment ?? {}),
      spellcasting: Sheet.Spellcasting.parse(record.spellcasting ?? {}),
      personality: Sheet.Personality.parse(record.personality ?? {}),
      details: Sheet.Details.parse(record.details ?? {}),
      timeCreated: Common.toISO(record.created),
      timeUpdated: Common.toISO(record.updated),
    };
  }

  /** Nível total = soma dos níveis de classe (guardado para ordenar a lista). */
  function levelOf(classes: { level: number }[]): number {
    return classes.reduce((sum, c) => sum + c.level, 0);
  }
}

/**
 * Seção parcial para o update. O `.partial()` do Zod 4 ainda aplica os defaults internos
 * (`{ hpCurrent: 5 }` zeraria a CA); aqui campo ausente fica ausente e é mesclado com o atual.
 */
function patchOf<S extends z.ZodObject>(schema: S) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [
      key,
      (field instanceof z.ZodDefault ? field.unwrap() : field).optional(),
    ]),
  );
  return z.object(shape).optional() as unknown as z.ZodOptional<z.ZodObject<{
    [K in keyof S['shape']]: z.ZodOptional<S['shape'][K]>;
  }>>;
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}
