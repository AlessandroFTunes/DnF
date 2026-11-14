/**
 * Servidor da API (`bun run api`). Lê o ambiente, aplica as migrations do Drizzle e sobe o Hono.
 *   DATABASE_URL        Postgres (obrigatório)
 *   AUTH_SECRET         segredo dos tokens de login, 32+ caracteres (obrigatório)
 *   FILES_DIR           onde ficam os avatares (padrão ./files)
 *   CORS_ORIGINS        origens liberadas no navegador, separadas por vírgula (`*` libera todas)
 *   DND_API_*, ELEVENLABS_API_KEY, TTS_PROVIDERS, PIPER_URL, NAS_DIR   ver `core/src/api`
 */
import { Api } from './src/api';
import { Db } from './src/db';

const env = process.env;
if (!env.DATABASE_URL) throw new Error('Defina DATABASE_URL.');

Db.use(env.DATABASE_URL);
await Db.migrateUp();

const app = Api.create({ env });

export default { port: Number(env.PORT ?? 3000), fetch: app.fetch, idleTimeout: 255 };
