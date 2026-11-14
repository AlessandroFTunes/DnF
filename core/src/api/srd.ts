import { Hono } from 'hono';
import type { Env } from './index';

/**
 * Repassa `/srd/*` para a 5e-FastAPI. O service token do Cloudflare Access fica só aqui, no servidor
 * (`DND_API_ACCESS_ID` / `DND_API_ACCESS_SECRET`). `DND_API_URL` troca o destino (ex.: `http://5e-fastapi:8000`,
 * na mesma rede do Docker, sem token). As respostas 200 ficam 1 dia na memória, para todos os jogadores.
 * Só passam os caminhos da API de regras (`api/v1/<recurso>/<id>…`): o token não serve para outra rota nem ".."
 */
const ROUTE = /^api\/v1\/[a-z0-9_-]+(\/[a-z0-9_-]+)*$/;
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 2_000;

export function srdRoutes(env: Env) {
  const cache = new Map<string, { body: string; until: number }>();
  const app = new Hono();

  app.get('/*', async (c) => {
    const route = c.req.path.replace(/^\/srd\//, '');
    if (!ROUTE.test(route)) return c.json({ message: 'Rota não encontrada.' }, 404);
    const path = route + new URL(c.req.url).search;

    const hit = cache.get(path);
    if (hit && hit.until > Date.now()) return c.body(hit.body, 200, { 'Content-Type': 'application/json' });

    const headers: Record<string, string> = {};
    if (env.DND_API_ACCESS_ID && env.DND_API_ACCESS_SECRET) {
      headers['CF-Access-Client-Id'] = env.DND_API_ACCESS_ID;
      headers['CF-Access-Client-Secret'] = env.DND_API_ACCESS_SECRET;
    }
    const base = (env.DND_API_URL || 'https://5e-fastapi.developale.com').replace(/\/+$/, '');
    const res = await fetch(`${base}/${path}`, { headers, signal: AbortSignal.timeout(30_000) }).catch(() => null);
    if (!res) return c.json({ message: 'A API de regras não respondeu.' }, 502);

    const body = await res.text();
    if (res.status === 200) {
      if (cache.size >= MAX_ENTRIES) cache.clear();
      cache.set(path, { body, until: Date.now() + TTL_MS });
    }
    return c.body(body, res.status as 200, { 'Content-Type': 'application/json' });
  });

  return app;
}
