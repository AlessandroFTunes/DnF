import { Buffer } from 'node:buffer';
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { eq } from 'drizzle-orm';
import { Db } from '../db';
import { HttpError } from './errors';
import type { AppEnv, Env } from './index';

/**
 * Login por token (JWT HS256 assinado com `AUTH_SECRET`). O token vai em `Authorization: Bearer …` (app) ou no
 * cookie httpOnly `dnf_session` (web na mesma origem, quando o cliente manda `X-DNF-Cookie: 1`). O `EventSource`
 * não manda cabeçalhos: ele usa um bilhete de 60 s (`?ticket=`), pedido em `POST /auth/ticket`.
 */
const COOKIE = 'dnf_session';
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const TICKET_SECONDS = 60;

export function authSecret(env: Env): string {
  const secret = env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('Defina AUTH_SECRET com pelo menos 32 caracteres.');
  return secret;
}

const now = () => Math.floor(Date.now() / 1000);

export const issueToken = (env: Env, id: string) =>
  sign({ id, iat: now(), exp: now() + SESSION_SECONDS }, authSecret(env));

export const issueTicket = (env: Env, id: string) =>
  sign({ id, purpose: 'events', exp: now() + TICKET_SECONDS }, authSecret(env));

async function userOf(env: Env, token: string, purpose?: 'events'): Promise<{ id: string } | null> {
  const payload = await verify(token, authSecret(env), 'HS256').catch(() => null);
  if (!payload || typeof payload.id !== 'string' || payload.purpose !== purpose) return null;
  const [user] = await Db.use().select({ id: Db.tables.users.id }).from(Db.tables.users).where(eq(Db.tables.users.id, payload.id)).limit(1);
  return user ?? null;
}

/** Sessão no cookie (web) e `token` de mentira para o cliente saber quando vence (o servidor o ignora). */
export function startSession(c: Context, token: string): string {
  if (c.req.header('X-DNF-Cookie') !== '1') return token;
  const https = c.req.header('X-Forwarded-Proto') === 'https' || new URL(c.req.url).protocol === 'https:';
  setCookie(c, COOKIE, token, { httpOnly: true, sameSite: 'Strict', secure: https, path: '/', maxAge: SESSION_SECONDS });
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const { id, exp } = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { id: string; exp: number };
  return `${part({ alg: 'none', typ: 'JWT' })}.${part({ id, exp, cookie: true })}.cookie`;
}

export function endSession(c: Context) {
  deleteCookie(c, COOKIE, { path: '/' });
}

/** Põe o usuário em `c.get('user')`; sem login válido, 401. */
export function requireLogin(env: Env): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const ticket = c.req.query('ticket');
    const header = (c.req.header('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    const token = getCookie(c, COOKIE) ?? header;
    const user = ticket ? await userOf(env, ticket, 'events') : token ? await userOf(env, token) : null;
    if (!user) throw new HttpError(401, 'Faça login para continuar.');
    c.set('user', user);
    return next();
  };
}
