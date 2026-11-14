import { jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { created } from '../db/columns';

/** Falas já geradas pelos provedores de voz (uma por voz e texto): cada fala é paga uma vez só. */
export const ttsCache = pgTable('tts_cache', {
  key: text().primaryKey(),
  result: jsonb().$type<unknown>().notNull(),
  created: created(),
});
