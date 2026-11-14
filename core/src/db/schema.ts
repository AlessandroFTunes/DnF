import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import type { Character } from '../character';

/**
 * Schema do Postgres (Drizzle). Substitui as coleções do PocketBase (`core/pb_migrations`): os ids continuam
 * texto e os registros migrados mantêm o id de antes. As colunas ficam em snake_case no banco (`casing`).
 * Quem decide quem pode ler ou gravar o quê são as regras do `core` (rotas em `core/src/api`), não o banco.
 */

const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const created = () => timestamp({ withTimezone: true }).defaultNow().notNull();
const updated = () =>
  timestamp({ withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

type Edition = '2014' | '2024';
type Sections = Pick<
  Character.Info,
  'proficiencies' | 'combat' | 'equipment' | 'spellcasting' | 'personality' | 'details'
>;

/** Conta. `passwordHash` guarda o bcrypt do PocketBase até o login novo assumir (ver `scripts/migrate-from-pocketbase.ts`). */
export const users = pgTable('users', {
  id: id(),
  email: text().notNull().unique(),
  passwordHash: text(),
  name: text().notNull().default(''),
  nickname: text().notNull().default(''),
  /** Nome do arquivo do avatar (o arquivo mora no storage). */
  avatar: text(),
  preferences: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  verified: boolean().notNull().default(false),
  created: created(),
  updated: updated(),
});

export const characters = pgTable(
  'characters',
  {
    id: id(),
    ownerId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    edition: text().$type<Edition>().notNull(),
    level: integer().notNull().default(1),
    classes: jsonb().$type<Character.Info['classes']>().notNull().default([]),
    speciesKey: text(),
    backgroundKey: text(),
    alignmentKey: text(),
    featKeys: jsonb().$type<string[]>().notNull().default([]),
    abilities: jsonb().$type<Character.Info['abilities']>().notNull(),
    xp: integer().notNull().default(0),
    inspiration: boolean().notNull().default(false),
    featureUses: jsonb().$type<Record<string, number>>().notNull().default({}),
    proficiencies: jsonb().$type<Sections['proficiencies']>().notNull().default({} as Sections['proficiencies']),
    combat: jsonb().$type<Sections['combat']>().notNull().default({} as Sections['combat']),
    equipment: jsonb().$type<Sections['equipment']>().notNull().default({} as Sections['equipment']),
    spellcasting: jsonb().$type<Sections['spellcasting']>().notNull().default({} as Sections['spellcasting']),
    personality: jsonb().$type<Sections['personality']>().notNull().default({} as Sections['personality']),
    details: jsonb().$type<Sections['details']>().notNull().default({} as Sections['details']),
    created: created(),
    updated: updated(),
  },
  (t) => [index().on(t.ownerId)],
);

export const mesas = pgTable(
  'mesas',
  {
    id: id(),
    gmId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text().notNull().default(''),
    edition: text().$type<Edition>().notNull(),
    inviteCode: text().notNull().unique(),
    /** Caminho da capa no NAS ("<mesa>/imagens/<arquivo>"). */
    cover: text(),
    created: created(),
    updated: updated(),
  },
  (t) => [index().on(t.gmId)],
);

export const mesaMembers = pgTable(
  'mesa_members',
  {
    id: id(),
    mesaId: text()
      .notNull()
      .references(() => mesas.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    characterId: text()
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    created: created(),
    updated: updated(),
  },
  (t) => [index().on(t.mesaId), index().on(t.userId), index().on(t.characterId)],
);

/** Mapas da mesa (DM-Control). */
export const grids = pgTable(
  'grids',
  {
    id: id(),
    mesaId: text()
      .notNull()
      .references(() => mesas.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    url: text().notNull().default(''),
    created: created(),
    updated: updated(),
  },
  (t) => [index().on(t.mesaId)],
);

export const gridScenes = pgTable(
  'grid_scenes',
  {
    id: id(),
    gridId: text()
      .notNull()
      .references(() => grids.id, { onDelete: 'cascade' }),
    data: jsonb().$type<unknown>().notNull(),
    created: created(),
    updated: updated(),
  },
  (t) => [index().on(t.gridId)],
);

/** Falas já geradas pelos provedores de voz (uma por voz e texto): cada fala é paga uma vez só. */
export const ttsCache = pgTable('tts_cache', {
  key: text().primaryKey(),
  result: jsonb().$type<unknown>().notNull(),
  created: created(),
});

