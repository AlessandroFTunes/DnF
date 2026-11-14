import { boolean, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { created, id, updated } from '../db/columns';

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
