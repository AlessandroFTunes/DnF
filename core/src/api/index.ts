import { Hono } from 'hono';
import * as AuthPort from './auth';
import { nasRoutes } from './nas';
import { srdRoutes } from './srd';
import { ttsRoutes } from './tts';

export type Env = Record<string, string | undefined>;
export type AppEnv = { Variables: { user: { id: string } } };

/**
 * A API do DnF (Hono): as rotas HTTP que o app e o DM-Control chamam. Fica toda no core, junto com as regras
 * e o banco (`Db`); o app só conhece a URL. Só o servidor importa este módulo (`core/server.ts`).
 * Tudo exige login (`Api.Auth`), menos `/health`.
 */
export namespace Api {
  export type Auth = AuthPort.Port;
  export const pocketBaseAuth = AuthPort.pocketBase;

  export interface Config {
    auth: Auth;
    env: Env;
  }

  export function create({ auth, env }: Config) {
    const app = new Hono<AppEnv>();

    app.get('/health', (c) => c.json({ ok: true }));

    app.use('*', async (c, next) => {
      if (c.req.path === '/health') return next();
      const token = (c.req.header('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
      const user = token ? await auth.authenticate(token) : null;
      if (!user) return c.json({ message: 'Faça login para continuar.' }, 401);
      c.set('user', user);
      return next();
    });

    app.route('/srd', srdRoutes(env));
    app.route('/', ttsRoutes(env));
    app.route('/nas', nasRoutes());

    app.onError((error, c) => {
      console.error(error);
      return c.json({ message: 'Erro interno.' }, 500);
    });
    return app;
  }
}
