import { boolean, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { created, id, updated, type Edition } from '../db/columns';
import { users } from '../user/user.sql';
import type { Character } from './character';

type Info = Character.Info;

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
    classes: jsonb().$type<Info['classes']>().notNull().default([]),
    speciesKey: text(),
    backgroundKey: text(),
    alignmentKey: text(),
    featKeys: jsonb().$type<string[]>().notNull().default([]),
    abilities: jsonb().$type<Info['abilities']>().notNull(),
    xp: integer().notNull().default(0),
    inspiration: boolean().notNull().default(false),
    featureUses: jsonb().$type<Record<string, number>>().notNull().default({}),
    proficiencies: jsonb().$type<Info['proficiencies']>().notNull().default({} as Info['proficiencies']),
    combat: jsonb().$type<Info['combat']>().notNull().default({} as Info['combat']),
    equipment: jsonb().$type<Info['equipment']>().notNull().default({} as Info['equipment']),
    spellcasting: jsonb().$type<Info['spellcasting']>().notNull().default({} as Info['spellcasting']),
    personality: jsonb().$type<Info['personality']>().notNull().default({} as Info['personality']),
    details: jsonb().$type<Info['details']>().notNull().default({} as Info['details']),
    created: created(),
    updated: updated(),
  },
  (t) => [index().on(t.ownerId)],
);
