/**
 * Servidor da API (`bun run api`). Lê o ambiente, aplica as migrations do Drizzle e sobe o Hono.
 *   DATABASE_URL        Postgres (obrigatório)
 *   POCKETBASE_URL      onde conferir o login enquanto as contas estão no PocketBase
 *   DND_API_*, ELEVENLABS_API_KEY, TTS_PROVIDERS, PIPER_URL, NAS_DIR   ver `core/src/api`
 */
import { Api } from './src/api';
import { Db } from './src/db';

const env = process.env;
if (!env.DATABASE_URL) throw new Error('Defina DATABASE_URL.');

const db = Db.create(env.DATABASE_URL);
await Db.migrateUp(db, new URL('./drizzle', import.meta.url).pathname);

const auth = Api.pocketBaseAuth(env.POCKETBASE_URL ?? 'http://localhost:8090');
const app = Api.create({ db, auth, env });

export default { port: Number(env.PORT ?? 3000), fetch: app.fetch };
