import { text, timestamp } from 'drizzle-orm/pg-core';

/** Colunas que quase toda tabela tem. Os ids são texto (os migrados do PocketBase mantêm o de antes). */
export const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
export const created = () => timestamp({ withTimezone: true }).defaultNow().notNull();
export const updated = () =>
  timestamp({ withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());
export type Edition = '2014' | '2024';
