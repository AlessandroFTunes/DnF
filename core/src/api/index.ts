import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ZodError } from 'zod';
import { authSecret, requireLogin } from './auth';
import { characterRoutes } from './characters';
import { fieldsOf, HttpError } from './errors';
import { gridRoutes } from './grids';
import { mesaRoutes } from './mesas';
import { nasRoutes } from './nas';
import { srdRoutes } from './srd';
import { ttsRoutes } from './tts';
import { authRoutes, fileRoutes, sessionRoutes } from './users';

export type Env = Record<string, string | undefined>;
export type AppEnv = { Variables: { user: { id: string } } };

/**
 * A API do DnF (Hono): as rotas HTTP que o app e o DM-Control chamam. Fica toda no core, junto com as regras
 * e o banco (`Db`); o app só conhece a URL. Só o servidor importa este módulo (`core/server.ts`).
 * Abertas: `/health`, `/auth/{email-exists,signup,login,logout}` e `/files/avatars/*`. O resto exige login.
 * Chame `Db.use(url)` antes de `Api.create`.
 */
export namespace Api {
  export interface Config {
    env: Env;
  }

  export function create({ env }: Config) {
    authSecret(env); // sem segredo válido a API nem sobe
    const app = new Hono<AppEnv>();

    if (env.CORS_ORIGINS) {
      const origins = env.CORS_ORIGINS.split(',').map((origin) => origin.trim());
      app.use(
        '*',
        cors({
          origin: origins.includes('*') ? '*' : origins,
          allowHeaders: ['Authorization', 'Content-Type', 'X-DNF-Cookie'],
          allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
          maxAge: 600,
        }),
      );
    }

    app.get('/health', (c) => c.json({ ok: true }));
    app.route('/auth', authRoutes(env));
    app.route('/files', fileRoutes(env));

    app.use('*', requireLogin(env));
    app.route('/', sessionRoutes(env));
    app.route('/srd', srdRoutes(env));
    app.route('/', ttsRoutes(env));
    app.route('/nas', nasRoutes());
    app.route('/characters', characterRoutes());
    app.route('/mesas', mesaRoutes());
    app.route('/', gridRoutes());

    app.onError((error, c) => {
      if (error instanceof HttpError) return c.json({ message: error.message, fields: error.fields }, error.status);
      if (error instanceof ZodError) return c.json({ message: 'Dados inválidos.', fields: fieldsOf(error) }, 400);
      if (error instanceof SyntaxError) return c.json({ message: 'JSON inválido.' }, 400);
      console.error(error);
      return c.json({ message: 'Erro interno.' }, 500);
    });
    return app;
  }
}
