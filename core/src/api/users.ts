import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { Db } from '../db';
import { Nas } from '../storage';
import { User } from '../user';
import { endSession, issueTicket, issueToken, startSession } from './auth';
import { HttpError, notFound } from './errors';
import type { AppEnv, Env } from './index';

type Row = typeof Db.tables.users.$inferSelect;

/** Do banco para o formato do app. O avatar sai como caminho da API; o cliente monta o endereço completo. */
function serializeUser(row: Row): User.Info {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    nickname: row.nickname,
    avatar: row.avatar ? `/files/avatars/${row.id}/${row.avatar}` : null,
    preferences: User.Preferences.catch(() => User.Preferences.parse({})).parse(row.preferences ?? {}),
    verified: row.verified,
    timeCreated: row.created.toISOString(),
    timeUpdated: row.updated.toISOString(),
  };
}

/** Pasta dos arquivos enviados pelos usuários (avatares). `FILES_DIR`, padrão `./files`. */
const filesRoot = (env: Env) => resolve(env.FILES_DIR || './files');

// Hash de mentira para o login gastar o mesmo tempo quando o email não existe (não revela quais emails têm conta).
const DUMMY_HASH = await Bun.password.hash('dnf-dummy-password', { algorithm: 'bcrypt', cost: 10 });

const NOT_UNIQUE = { email: { code: 'validation_not_unique', message: 'Já existe uma conta com esse email.' } };

/** Login, cadastro e sessão (rotas abertas, menos as que precisam do usuário). */
export function authRoutes(env: Env) {
  const app = new Hono<AppEnv>();
  const db = Db.use();
  const { users } = Db.tables;

  const grant = async (c: import('hono').Context, row: Row) => {
    const token = startSession(c, await issueToken(env, row.id));
    return c.json({ token, user: serializeUser(row) });
  };

  /** Diz se já existe conta com o email e o primeiro nome dela. Nunca devolve o registro. */
  app.post('/email-exists', async (c) => {
    const { email } = z.object({ email: User.Email }).parse(await c.req.json());
    const [row] = await db.select({ name: users.name }).from(users).where(eq(users.email, email)).limit(1);
    if (!row) return c.json({ exists: false });
    return c.json({ exists: true, firstName: row.name.trim().split(/\s+/)[0] || null });
  });

  app.post('/signup', async (c) => {
    const input = User.SignUp.parse(await c.req.json());
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
    if (taken) throw new HttpError(400, 'Já existe uma conta com esse email.', NOT_UNIQUE);
    const passwordHash = await Bun.password.hash(input.password, { algorithm: 'bcrypt', cost: 10 });
    const [row] = await db.insert(users).values({ name: input.name, email: input.email, passwordHash }).returning();
    return grant(c, row!);
  });

  app.post('/login', async (c) => {
    const input = User.Login.parse(await c.req.json());
    const [row] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    const ok = await Bun.password.verify(input.password, row?.passwordHash ?? DUMMY_HASH).catch(() => false);
    if (!row || !row.passwordHash || !ok) throw new HttpError(400, 'Email ou senha incorretos.');
    return grant(c, row);
  });

  app.post('/logout', (c) => {
    endSession(c);
    return c.json({ ok: true });
  });

  return app;
}

/** Sessão e perfil do usuário logado (exigem login). */
export function sessionRoutes(env: Env) {
  const app = new Hono<AppEnv>();
  const db = Db.use();
  const { users } = Db.tables;

  const me = async (id: string): Promise<Row> => {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!row) throw notFound('Usuário');
    return row;
  };

  app.post('/auth/refresh', async (c) => {
    const row = await me(c.get('user').id);
    return c.json({ token: startSession(c, await issueToken(env, row.id)), user: serializeUser(row) });
  });

  /** Bilhete de 60 s para o `EventSource`, que não manda o cabeçalho `Authorization`. */
  app.post('/auth/ticket', async (c) => c.json({ ticket: await issueTicket(env, c.get('user').id) }));

  // O perfil é só do próprio usuário: o de outro é 404, igual a "não existe".
  const own = (c: import('hono').Context<AppEnv>) => {
    const id = c.req.param('id');
    if (id !== c.get('user').id) throw notFound('Usuário');
    return id;
  };

  app.get('/users/:id', async (c) => c.json(serializeUser(await me(own(c)))));

  app.patch('/users/:id', async (c) => {
    const patch = User.Patch.parse(await c.req.json());
    const current = await me(own(c));
    const data: Partial<Row> = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.nickname !== undefined) data.nickname = patch.nickname;
    // As preferências são um JSON só: junta com as atuais para mudar uma sem perder as outras.
    if (patch.preferences) data.preferences = User.Preferences.parse({ ...serializeUser(current).preferences, ...patch.preferences });
    const [row] = await db.update(users).set(data).where(eq(users.id, current.id)).returning();
    return c.json(serializeUser(row!));
  });

  app.delete('/users/:id', async (c) => {
    const current = await me(own(c));
    await rm(avatarDir(current.id), { recursive: true, force: true });
    await db.delete(users).where(eq(users.id, current.id));
    endSession(c);
    return c.body(null, 204);
  });

  const avatarDir = (id: string) => join(filesRoot(env), 'avatars', id);

  app.put('/users/:id/avatar', async (c) => {
    const current = await me(own(c));
    const file = (await c.req.parseBody())['avatar'];
    if (!(file instanceof File)) throw new HttpError(400, 'Envie a imagem no campo "avatar".');
    if (file.size > User.AVATAR_MAX_BYTES) throw new HttpError(413, 'A imagem passa de 5 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    // O tipo vem dos primeiros bytes do arquivo, não do que o cliente disse.
    const type = Nas.detectType(bytes);
    if (!type || !(User.AVATAR_TYPES as readonly string[]).includes(type)) throw new HttpError(415, 'Use uma imagem JPEG, PNG ou WebP.');
    const name = `${crypto.randomUUID()}.${Nas.extensionOf(type)}`;

    await rm(avatarDir(current.id), { recursive: true, force: true });
    await mkdir(avatarDir(current.id), { recursive: true });
    await writeFile(join(avatarDir(current.id), name), bytes);
    const [row] = await db.update(users).set({ avatar: name }).where(eq(users.id, current.id)).returning();
    return c.json(serializeUser(row!));
  });

  app.delete('/users/:id/avatar', async (c) => {
    const current = await me(own(c));
    await rm(avatarDir(current.id), { recursive: true, force: true });
    const [row] = await db.update(users).set({ avatar: null }).where(eq(users.id, current.id)).returning();
    return c.json(serializeUser(row!));
  });

  return app;
}

/** Avatares: o endereço não tem como ser adivinhado (nome aleatório por envio), então a leitura é aberta. */
export function fileRoutes(env: Env) {
  const app = new Hono<AppEnv>();
  const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

  app.get('/avatars/:id/:file', async (c) => {
    const { id, file } = c.req.param();
    const type = TYPES[file.split('.').pop()?.toLowerCase() ?? ''];
    if (!type || !/^[\w-]+$/.test(id) || !/^[\w][\w.-]*$/.test(file) || file.includes('..')) throw notFound('Arquivo');
    const data = await Bun.file(join(filesRoot(env), 'avatars', id, file)).bytes().catch(() => null);
    if (!data) throw notFound('Arquivo');
    return c.body(new Blob([data as BlobPart]), 200, {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
  });

  return app;
}
