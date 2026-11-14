import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Banco de dados (Postgres + Drizzle). Só o servidor importa: o app nunca fala com o banco, só com a API
 * (`core/src/api`). O schema é `schema.ts`; as migrations ficam em `core/drizzle/` (`bun run db:generate`).
 */
export namespace Db {
  export const tables = schema;

  export function create(url: string) {
    const sql = postgres(url, { onnotice: () => {} });
    const db = drizzle(sql, { schema, casing: 'snake_case' });
    return Object.assign(db, { close: () => sql.end() });
  }
  export type Client = ReturnType<typeof create>;

  /** Aplica as migrations que faltam (pasta gerada pelo drizzle-kit). */
  export async function migrateUp(db: Client, folder: string) {
    await migrate(db, { migrationsFolder: folder });
  }
}
