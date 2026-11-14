import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { characters } from '../character/character.sql';
import { gridScenes, grids } from '../grid/grid.sql';
import { mesaMembers, mesas } from '../mesa/mesa.sql';
import { ttsCache } from '../narration/narration.sql';
import { users } from '../user/user.sql';

const schema = { users, characters, mesas, mesaMembers, grids, gridScenes, ttsCache };

/**
 * Banco de dados (Postgres + Drizzle). Só o servidor importa: o app nunca fala com o banco, só com a API
 * (`core/src/api`). Cada tabela fica ao lado do módulo dela, num `<módulo>.sql.ts` (`mesa/mesa.sql.ts`, `user/user.sql.ts`…); as migrations ficam em `core/drizzle/` (`bun run db:generate`).
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
