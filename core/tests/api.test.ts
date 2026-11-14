import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inArray } from 'drizzle-orm';
import { Api } from '../src/api';
import { Db } from '../src/db';

// Precisa de um Postgres (`DATABASE_URL`, ex.: `docker compose up -d postgres`); sem ele o teste é pulado.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)('Api', () => {
  const run = crypto.randomUUID().slice(0, 8);
  const ids = { gm: `gm-${run}`, member: `member-${run}`, stranger: `stranger-${run}`, mesa: `mesa-${run}`, character: `char-${run}`, row: `row-${run}` };
  const tokens: Record<string, string> = { gm: ids.gm, member: ids.member, stranger: ids.stranger };
  const db = Db.create(url!);
  const { users, mesas, mesaMembers, characters, ttsCache } = Db.tables;
  let nasDir: string;
  let fakeSrd: ReturnType<typeof Bun.serve>;
  let srdCalls = 0;
  let app: ReturnType<typeof Api.create>;

  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const get = (path: string, as?: keyof typeof tokens) =>
    app.request(path, { headers: as ? { Authorization: tokens[as]! } : {} });

  beforeAll(async () => {
    await Db.migrateUp(db, new URL('../drizzle', import.meta.url).pathname);
    nasDir = await mkdtemp(join(tmpdir(), 'dnf-nas-'));
    await mkdir(join(nasDir, ids.mesa, 'imagens'), { recursive: true });
    await mkdir(join(nasDir, ids.mesa, 'mapas'), { recursive: true });
    await writeFile(join(nasDir, ids.mesa, 'imagens', 'capa.png'), png);
    await writeFile(join(nasDir, ids.mesa, 'mapas', 'mapa.png'), png);
    process.env.NAS_DIR = nasDir;

    fakeSrd = Bun.serve({
      port: 0,
      fetch: (req) => {
        srdCalls++;
        return Response.json({ path: new URL(req.url).pathname + new URL(req.url).search });
      },
    });

    await db.insert(users).values(
      [ids.gm, ids.member, ids.stranger].map((id) => ({ id, email: `${id}@test.local` })),
    );
    await db.insert(mesas).values({ id: ids.mesa, gmId: ids.gm, name: 'Mesa', edition: '2024', inviteCode: `INV-${run}` });
    await db.insert(characters).values({
      id: ids.character,
      ownerId: ids.member,
      name: 'Kira',
      edition: '2024',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    });
    await db.insert(mesaMembers).values({ id: ids.row, mesaId: ids.mesa, userId: ids.member, characterId: ids.character });

    app = Api.create({
      db,
      // Aceita só os tokens do teste (o id do usuário é o próprio token).
      auth: { authenticate: async (token) => (Object.values(tokens).includes(token) ? { id: token } : null) },
      env: { DND_API_URL: `http://localhost:${fakeSrd.port}` },
    });
  });

  afterAll(async () => {
    await db.delete(users).where(inArray(users.id, [ids.gm, ids.member, ids.stranger])); // cascata leva o resto
    await db.delete(ttsCache);
    fakeSrd?.stop(true);
    if (nasDir) await rm(nasDir, { recursive: true, force: true });
    await db.close();
  });

  test('/health é aberto; o resto exige login', async () => {
    expect((await get('/health')).status).toBe(200);
    expect((await get('/srd/api/v1/magias')).status).toBe(401);
    expect((await get('/tts?text=oi')).status).toBe(401);
    expect((await get('/nas/x/imagens/a.png')).status).toBe(401);
    expect((await get('/srd/api/v1/magias', undefined)).status).toBe(401);
    const wrong = await app.request('/srd/api/v1/magias', { headers: { Authorization: 'nope' } });
    expect(wrong.status).toBe(401);
  });

  test('/srd repassa, guarda no cache e só aceita caminhos de regras', async () => {
    const before = srdCalls;
    const first = await get('/srd/api/v1/magias?circulo=3', 'member');
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ path: '/api/v1/magias?circulo=3' });
    await get('/srd/api/v1/magias?circulo=3', 'member');
    expect(srdCalls - before).toBe(1);
    expect((await get('/srd/openapi.json', 'member')).status).toBe(404);
    expect((await get('/srd/api/v1/..%2Fadmin', 'member')).status).toBe(404);
    expect((await get('/srd/api/v1/Magias', 'member')).status).toBe(404);
  });

  test('/tts: texto inválido e sem provedor configurado', async () => {
    expect((await get('/tts', 'member')).status).toBe(400);
    expect((await get(`/tts?text=${'a'.repeat(601)}`, 'member')).status).toBe(400);
    expect((await get('/tts?text=Olá', 'member')).status).toBe(503);
    expect((await get('/tts/sage?text=Olá', 'member')).status).toBe(503);
  });

  test('/nas: mestre lê tudo, jogador só imagens, estranho nada', async () => {
    const cover = `/nas/${ids.mesa}/imagens/capa.png`;
    const map = `/nas/${ids.mesa}/mapas/mapa.png`;
    for (const who of ['gm', 'member'] as const) {
      const res = await get(cover, who);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/png');
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(png);
    }
    expect((await get(map, 'gm')).status).toBe(200);
    expect((await get(map, 'member')).status).toBe(404);
    expect((await get(cover, 'stranger')).status).toBe(404);
    expect((await get(`/nas/${ids.mesa}/imagens/nao-existe.png`, 'gm')).status).toBe(404);
    expect((await get(`/nas/${ids.mesa}/imagens/..%2Fmapas%2Fmapa.png`, 'member')).status).toBe(404);
    expect((await get('/nas/mesa-que-nao-existe/imagens/capa.png', 'gm')).status).toBe(404);
  });
});
