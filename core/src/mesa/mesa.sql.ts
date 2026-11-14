import { index, pgTable, text } from 'drizzle-orm/pg-core';
import { created, id, updated, type Edition } from '../db/columns';
import { characters } from '../character/character.sql';
import { users } from '../user/user.sql';

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

/** Quem participa da mesa e com qual personagem. */
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
