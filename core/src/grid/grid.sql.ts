import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { created, id, updated } from '../db/columns';
import { mesas } from '../mesa/mesa.sql';

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
