import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { characters } from '../character/character.sql';
import { gridScenes, grids } from '../grid/grid.sql';
import { mesaMembers, mesas } from '../mesa/mesa.sql';
import { ttsCache } from '../narration/narration.sql';
import { users } from '../user/user.sql';

const schema = { users, characters, mesas, mesaMembers, grids, gridScenes, ttsCache };

function open(url: string) {
  const sql = postgres(url, { onnotice: () => {} });
  return { sql, db: drizzle(sql, { schema, casing: 'snake_case' }) };
}

let current: ReturnType<typeof open> | undefined;

/**
 * Banco de dados (Postgres + Drizzle), uma conexão só por processo. Só o servidor importa: o app nunca fala com o
 * banco, só com a API (`core/src/api`). Cada tabela fica ao lado do módulo dela, num `<módulo>.sql.ts`
 * (`mesa/mesa.sql.ts`, `user/user.sql.ts`…); as migrations ficam em `core/drizzle/` (`bun run db:generate`).
 */
export namespace Db {
  export const tables = schema;

  /** O banco compartilhado. A primeira chamada abre a conexão (`url`, ou `DATABASE_URL`); as outras a reaproveitam. */
  export function use(url = process.env.DATABASE_URL) {
    if (current) return current.db;
    if (!url) throw new Error('Defina DATABASE_URL ou chame Db.use(url).');
    return (current = open(url)).db;
  }

  /** Aplica as migrations que faltam (pasta `core/drizzle/`). */
  export async function migrateUp() {
    await migrate(use(), { migrationsFolder: new URL('../../drizzle', import.meta.url).pathname });
  }

  /** Fecha a conexão; o próximo `use()` abre outra. */
  export async function close() {
    const open = current;
    current = undefined;
    await open?.sql.end();
  }
}
