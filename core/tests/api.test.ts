import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { like } from 'drizzle-orm';
import { Api } from '../src/api';
import { Db } from '../src/db';

// Precisa de um Postgres (`DATABASE_URL`, ex.: `docker compose up -d postgres`); sem ele o teste é pulado.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)('Api', () => {
  const run = crypto.randomUUID().slice(0, 8);
  const db = Db.use(url);
  const { users, ttsCache } = Db.tables;
  let nasDir: string;
  let filesDir: string;
  let fakeSrd: ReturnType<typeof Bun.serve>;
  let srdCalls = 0;
  let app: ReturnType<typeof Api.create>;

  type Who = 'gm' | 'member' | 'stranger';
  const tokens = {} as Record<Who, string>;
  const ids = {} as Record<Who, string>;
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const abilities = { str: 10, dex: 12, con: 14, int: 8, wis: 10, cha: 16 };

  async function call(path: string, options: { as?: Who; method?: string; body?: unknown; form?: FormData; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { ...options.headers };
    if (options.as) headers.Authorization = `Bearer ${tokens[options.as]}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await app.request(path, {
      method: options.method ?? 'GET',
      headers,
      body: options.form ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    });
    const isJson = (res.headers.get('content-type') ?? '').includes('json');
    return { status: res.status, json: isJson ? ((await res.json()) as any) : undefined, res };
  }

  const email = (who: string) => `${who}-${run}@test.local`;
  const signUp = (who: Who, name: string) =>
    call('/auth/signup', { method: 'POST', body: { name, email: email(who), password: 'senha-forte-1', passwordConfirm: 'senha-forte-1' } });

  beforeAll(async () => {
    await Db.migrateUp();
    nasDir = await mkdtemp(join(tmpdir(), 'dnf-nas-'));
    filesDir = await mkdtemp(join(tmpdir(), 'dnf-files-'));
    process.env.NAS_DIR = nasDir;
    fakeSrd = Bun.serve({
      port: 0,
      fetch: (req) => {
        srdCalls++;
        return Response.json({ path: new URL(req.url).pathname + new URL(req.url).search });
      },
    });
    app = Api.create({
      env: { AUTH_SECRET: 'x'.repeat(40), FILES_DIR: filesDir, DND_API_URL: `http://localhost:${fakeSrd.port}`, CORS_ORIGINS: '*' },
    });

    for (const [who, name] of [['gm', 'Mestre Silva'], ['member', 'Bia Jogadora'], ['stranger', 'Zé Estranho']] as const) {
      const { status, json } = await signUp(who, name);
      expect(status).toBe(200);
      tokens[who] = json.token;
      ids[who] = json.user.id;
    }
  });

  afterAll(async () => {
    await db.delete(users).where(like(users.email, `%-${run}@test.local`)); // cascata leva o resto
    await db.delete(ttsCache);
    fakeSrd?.stop(true);
    await rm(nasDir, { recursive: true, force: true });
    await rm(filesDir, { recursive: true, force: true });
    await Db.close();
  });

  describe('login', () => {
    test('/health é aberto; o resto exige login', async () => {
      expect((await call('/health')).status).toBe(200);
      for (const path of ['/srd/api/v1/magias', '/tts?text=oi', '/nas/x/imagens/a.png', '/characters', '/mesas', '/users/x']) {
        expect((await call(path)).status).toBe(401);
      }
      expect((await call('/mesas', { headers: { Authorization: 'Bearer nope' } })).status).toBe(401);
    });

    test('cadastro entrega token e perfil, e recusa email repetido e senhas diferentes', async () => {
      expect(tokens.gm.split('.')).toHaveLength(3);
      expect((await call('/users/' + ids.gm, { as: 'gm' })).json).toMatchObject({ id: ids.gm, email: email('gm'), name: 'Mestre Silva', avatar: null });
      const again = await signUp('gm', 'Outro');
      expect(again.status).toBe(400);
      expect(again.json.fields.email.code).toBe('validation_not_unique');
      const mismatch = await call('/auth/signup', { method: 'POST', body: { name: 'A', email: email('x'), password: 'senha-forte-1', passwordConfirm: 'diferente' } });
      expect(mismatch.status).toBe(400);
      expect(mismatch.json.fields.passwordConfirm).toBeDefined();
    });

    test('login confere a senha; refresh renova; email-exists não vaza o registro', async () => {
      const ok = await call('/auth/login', { method: 'POST', body: { email: email('gm').toUpperCase(), password: 'senha-forte-1' } });
      expect(ok.status).toBe(200);
      expect(ok.json.user.id).toBe(ids.gm);
      for (const body of [{ email: email('gm'), password: 'errada' }, { email: email('nao-existe'), password: 'senha-forte-1' }]) {
        const bad = await call('/auth/login', { method: 'POST', body });
        expect(bad.status).toBe(400);
        expect(bad.json.message).toBe('Email ou senha incorretos.');
      }
      const refreshed = await call('/auth/refresh', { as: 'gm', method: 'POST' });
      expect(refreshed.json.user.id).toBe(ids.gm);

      expect((await call('/auth/email-exists', { method: 'POST', body: { email: email('gm') } })).json).toEqual({ exists: true, firstName: 'Mestre' });
      expect((await call('/auth/email-exists', { method: 'POST', body: { email: email('nao-existe') } })).json).toEqual({ exists: false });
    });

    test('hash bcrypt migrado do PocketBase continua valendo', async () => {
      const hash = await Bun.password.hash('senha-antiga-1', { algorithm: 'bcrypt', cost: 10 });
      const id = `pb-${run}`;
      await db.insert(users).values({ id, email: `legado-${run}@test.local`, passwordHash: hash, name: 'Legado' });
      const res = await call('/auth/login', { method: 'POST', body: { email: `legado-${run}@test.local`, password: 'senha-antiga-1' } });
      expect(res.status).toBe(200);
      expect(res.json.user.id).toBe(id);
    });

    test('apagar a conta leva os dados e invalida o token', async () => {
      const { json } = await call('/auth/signup', { method: 'POST', body: { name: 'Sai', email: email('sai'), password: 'senha-forte-1', passwordConfirm: 'senha-forte-1' } });
      const headers = { Authorization: `Bearer ${json.token}` };
      await call('/mesas', { method: 'POST', body: { name: 'Some', edition: '2024' }, headers });
      expect((await call(`/users/${json.user.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tokens.member}` } })).status).toBe(404);
      expect((await call(`/users/${json.user.id}`, { method: 'DELETE', headers })).status).toBe(204);
      expect((await call('/mesas', { headers })).status).toBe(401);
      expect((await call('/auth/login', { method: 'POST', body: { email: email('sai'), password: 'senha-forte-1' } })).status).toBe(400);
    });

    test('modo cookie define a sessão httpOnly; modo cookie define a sessão httpOnly', async () => {
      const cookie = await call('/auth/login', { method: 'POST', body: { email: email('member'), password: 'senha-forte-1' }, headers: { 'X-DNF-Cookie': '1' } });
      const setCookie = cookie.res.headers.get('set-cookie') ?? '';
      expect(setCookie).toContain('dnf_session=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Strict');
      expect(cookie.json.token.endsWith('.cookie')).toBe(true);
      const real = /dnf_session=([^;]+)/.exec(setCookie)![1]!;
      const viaCookie = await call('/users/' + ids.member, { headers: { Cookie: `dnf_session=${real}` } });
      expect(viaCookie.status).toBe(200);
      expect((await call('/auth/logout', { method: 'POST' })).res.headers.get('set-cookie')).toContain('dnf_session=;');
    });
  });

  describe('perfil e avatar', () => {
    test('o perfil é só do próprio usuário e as preferências se mesclam', async () => {
      expect((await call('/users/' + ids.gm, { as: 'member' })).status).toBe(404);
      expect((await call('/users/' + ids.gm, { as: 'member', method: 'PATCH', body: { name: 'X' } })).status).toBe(404);
      const first = await call('/users/' + ids.member, { as: 'member', method: 'PATCH', body: { nickname: 'Bi', preferences: { narration: false } } });
      expect(first.json).toMatchObject({ nickname: 'Bi', preferences: { narration: false, sounds: true } });
      const second = await call('/users/' + ids.member, { as: 'member', method: 'PATCH', body: { preferences: { sounds: false } } });
      expect(second.json).toMatchObject({ nickname: 'Bi', preferences: { narration: false, sounds: false } });
      expect((await call('/users/' + ids.member, { as: 'member', method: 'PATCH', body: { name: '' } })).status).toBe(400);
    });

    test('avatar: valida pelo conteúdo, serve sem login e some ao remover', async () => {
      const send = (bytes: Uint8Array, name: string, type: string) => {
        const form = new FormData();
        form.append('avatar', new File([bytes as BlobPart], name, { type }));
        return call(`/users/${ids.member}/avatar`, { as: 'member', method: 'PUT', form });
      };
      expect((await send(new TextEncoder().encode('<svg></svg>'), 'a.png', 'image/png')).status).toBe(415);
      expect((await send(new Uint8Array(5 * 1024 * 1024 + 1), 'a.png', 'image/png')).status).toBe(413);
      const ok = await send(png, 'a.png', 'image/png');
      expect(ok.status).toBe(200);
      const path = ok.json.avatar as string;
      expect(path).toMatch(new RegExp(`^/files/avatars/${ids.member}/[\\w-]+\\.png$`));
      const file = await call(path); // sem login
      expect(file.status).toBe(200);
      expect(file.res.headers.get('content-type')).toBe('image/png');
      expect((await call(`/files/avatars/${ids.member}/..%2Fx.png`)).status).toBe(404);
      expect((await call(`/files/avatars/${ids.member}/nao-existe.png`)).status).toBe(404);
      const removed = await call(`/users/${ids.member}/avatar`, { as: 'member', method: 'DELETE' });
      expect(removed.json.avatar).toBeNull();
      expect((await call(path)).status).toBe(404);
    });
  });

  describe('personagens', () => {
    let characterID: string;
    const body = { name: 'Kira', edition: '2024', classes: [{ classKey: '1', level: 3 }], abilities };

    test('cria, lista só os do dono, lê e mescla seções no update', async () => {
      const created = await call('/characters', { as: 'member', method: 'POST', body });
      expect(created.status).toBe(201);
      expect(created.json).toMatchObject({ ownerID: ids.member, level: 3, xp: 0, speciesKey: null });
      characterID = created.json.id;

      expect((await call('/characters', { as: 'member' })).json).toMatchObject({ total: 1, page: 1 });
      expect((await call('/characters', { as: 'stranger' })).json.total).toBe(0);
      expect((await call('/characters?search=kir&sort=-level&pageSize=5', { as: 'member' })).json.data).toHaveLength(1);
      expect((await call('/characters?search=zzz', { as: 'member' })).json.total).toBe(0);
      expect((await call('/characters?sort=password', { as: 'member' })).status).toBe(400);

      const hp = await call(`/characters/${characterID}`, { as: 'member', method: 'PATCH', body: { combat: { hpCurrent: 5 }, xp: 300 } });
      expect(hp.json.combat.hpCurrent).toBe(5);
      const more = await call(`/characters/${characterID}`, { as: 'member', method: 'PATCH', body: { classes: [{ classKey: '1', level: 4 }] } });
      expect(more.json).toMatchObject({ level: 4, xp: 300 });
      expect(more.json.combat.hpCurrent).toBe(5); // a seção ficou como estava
    });

    test('quem não é dono não lê nem muda; o mestre da mesa só lê', async () => {
      const path = `/characters/${characterID}`;
      expect((await call(path, { as: 'stranger' })).status).toBe(404);
      expect((await call(path, { as: 'gm' })).status).toBe(404); // ainda não está na mesa dele
      expect((await call(path, { as: 'stranger', method: 'PATCH', body: { name: 'X' } })).status).toBe(404);
      expect((await call(path, { as: 'stranger', method: 'DELETE' })).status).toBe(404);

      const mesa = (await call('/mesas', { as: 'gm', method: 'POST', body: { name: 'Mesa Do Mestre', edition: '2024' } })).json;
      const join = await call('/mesas/join', { as: 'member', method: 'POST', body: { inviteCode: mesa.inviteCode, characterID } });
      expect(join.status).toBe(201);
      expect((await call(path, { as: 'gm' })).json.id).toBe(characterID);
      expect((await call(path, { as: 'gm', method: 'PATCH', body: { name: 'X' } })).status).toBe(404);
      expect((await call(path, { as: 'gm', method: 'DELETE' })).status).toBe(404);
      await call(`/mesas/${mesa.id}`, { as: 'gm', method: 'DELETE' });
    });

    test('dados inválidos viram 400 com o campo; apagar remove', async () => {
      const bad = await call('/characters', { as: 'member', method: 'POST', body: { name: '', edition: '1999', classes: [], abilities } });
      expect(bad.status).toBe(400);
      expect(Object.keys(bad.json.fields)).toEqual(expect.arrayContaining(['name', 'edition']));
      expect((await call(`/characters/${characterID}`, { as: 'member', method: 'DELETE' })).status).toBe(204);
      expect((await call(`/characters/${characterID}`, { as: 'member' })).status).toBe(404);
    });
  });

  describe('mesas', () => {
    let mesa: any;
    let characterID: string;
    let memberID: string;
    const newCharacter = async (as: Who, edition = '2024') =>
      (await call('/characters', { as, method: 'POST', body: { name: 'Pj', edition, classes: [{ classKey: '1', level: 1 }], abilities } })).json.id as string;

    test('o mestre cria com código de 8 caracteres e só ele muda a mesa', async () => {
      const created = await call('/mesas', { as: 'gm', method: 'POST', body: { name: 'Taverna', edition: '2024' } });
      expect(created.status).toBe(201);
      mesa = created.json;
      expect(mesa).toMatchObject({ gmID: ids.gm, description: '', cover: null });
      expect(mesa.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);

      const patched = await call(`/mesas/${mesa.id}`, { as: 'gm', method: 'PATCH', body: { name: 'Taverna do Dragão', description: 'Boas-vindas', cover: `${mesa.id}/imagens/capa.png` } });
      expect(patched.json).toMatchObject({ name: 'Taverna do Dragão', cover: `${mesa.id}/imagens/capa.png`, edition: '2024' });
      expect((await call(`/mesas/${mesa.id}`, { as: 'member', method: 'PATCH', body: { name: 'X' } })).status).toBe(404);
      expect((await call(`/mesas/${mesa.id}`, { as: 'stranger', method: 'DELETE' })).status).toBe(404);
    });

    test('só quem tem o código encontra a mesa; ela só aparece para o mestre e quem joga', async () => {
      expect((await call(`/mesas/${mesa.id}`, { as: 'member' })).status).toBe(404);
      expect((await call('/mesas', { as: 'member' })).json.total).toBe(0);
      const byCode = await call(`/mesas/by-code/${mesa.inviteCode.toLowerCase().slice(0, 4)}-${mesa.inviteCode.slice(4).toLowerCase()}`, { as: 'member' });
      expect(byCode.json.id).toBe(mesa.id);
      expect((await call('/mesas/by-code/AAAAAAAA', { as: 'member' })).status).toBe(404);
      expect((await call('/mesas/by-code/curto', { as: 'member' })).status).toBe(404);
    });

    test('entrar exige personagem seu, da mesma edição, sem repetir', async () => {
      characterID = await newCharacter('member');
      const other = await newCharacter('member', '2014');
      const strangers = await newCharacter('stranger');
      const join = (inviteCode: string, id: string, as: Who = 'member') => call('/mesas/join', { as, method: 'POST', body: { inviteCode, characterID: id } });

      expect((await join(mesa.inviteCode, other)).status).toBe(400); // outra edição
      expect((await join(mesa.inviteCode, strangers)).status).toBe(400); // personagem de outra pessoa
      expect((await join('AAAAAAAA', characterID)).status).toBe(404);
      const ok = await join(mesa.inviteCode, characterID);
      expect(ok.status).toBe(201);
      expect(ok.json).toMatchObject({ mesaID: mesa.id, userID: ids.member, playerName: 'Bi' });
      expect(ok.json.character.id).toBe(characterID);
      memberID = ok.json.id;
      expect((await join(mesa.inviteCode, characterID)).status).toBe(400); // já está
    });

    test('mestre vê todos os jogadores; jogador só a própria entrada; estranho nada', async () => {
      const strangerCharacter = await newCharacter('stranger');
      const gm2 = (await call('/mesas', { as: 'gm', method: 'GET' })).json;
      expect(gm2.total).toBe(1);
      expect((await call('/mesas', { as: 'member' })).json.total).toBe(1);
      expect((await call(`/mesas/${mesa.id}`, { as: 'member' })).json.inviteCode).toBe(mesa.inviteCode);
      expect((await call(`/mesas/${mesa.id}`, { as: 'stranger' })).status).toBe(404);
      expect((await call(`/mesas/${mesa.id}/members`, { as: 'stranger' })).status).toBe(404);
      await call('/mesas/join', { as: 'stranger', method: 'POST', body: { inviteCode: mesa.inviteCode, characterID: strangerCharacter } });

      expect((await call(`/mesas/${mesa.id}/members`, { as: 'gm' })).json).toHaveLength(2);
      const own = (await call(`/mesas/${mesa.id}/members`, { as: 'member' })).json;
      expect(own).toHaveLength(1);
      expect(own[0].userID).toBe(ids.member);
      expect((await call(`/mesas/of-character/${characterID}`, { as: 'member' })).json).toEqual([{ memberID, mesa: expect.objectContaining({ id: mesa.id }) }]);
      expect((await call(`/mesas/of-character/${characterID}`, { as: 'stranger' })).json).toEqual([]);
    });

    test('trocar o código invalida o antigo; sair e remover seguem as regras', async () => {
      const old = mesa.inviteCode;
      expect((await call(`/mesas/${mesa.id}/invite-code`, { as: 'member', method: 'POST' })).status).toBe(404);
      const changed = await call(`/mesas/${mesa.id}/invite-code`, { as: 'gm', method: 'POST' });
      expect(changed.json.inviteCode).not.toBe(old);
      expect((await call(`/mesas/by-code/${old}`, { as: 'member' })).status).toBe(404);
      mesa = changed.json;

      expect((await call(`/mesas/members/${memberID}`, { as: 'stranger', method: 'DELETE' })).status).toBe(404);
      expect((await call(`/mesas/members/${memberID}`, { as: 'member', method: 'DELETE' })).status).toBe(204); // sai sozinho
      const left = (await call(`/mesas/${mesa.id}/members`, { as: 'gm' })).json;
      expect(left).toHaveLength(1);
      expect((await call(`/mesas/members/${left[0].id}`, { as: 'gm', method: 'DELETE' })).status).toBe(204); // mestre remove
      expect((await call(`/mesas/${mesa.id}`, { as: 'member' })).status).toBe(404); // quem saiu perde o acesso
    });

    test('apagar a mesa remove os jogadores e mantém os personagens', async () => {
      await call('/mesas/join', { as: 'member', method: 'POST', body: { inviteCode: mesa.inviteCode, characterID } });
      expect((await call(`/mesas/${mesa.id}`, { as: 'gm', method: 'DELETE' })).status).toBe(204);
      expect((await call(`/mesas/${mesa.id}`, { as: 'gm' })).status).toBe(404);
      expect((await call(`/characters/${characterID}`, { as: 'member' })).status).toBe(200);
    });
  });

  describe('grids', () => {
    test('só o mestre lê e escreve; a cena vai e volta', async () => {
      const mesa = (await call('/mesas', { as: 'gm', method: 'POST', body: { name: 'Com mapas', edition: '2024' } })).json;
      expect((await call(`/mesas/${mesa.id}/grids`, { as: 'member' })).status).toBe(404);
      expect((await call(`/mesas/${mesa.id}/grids`, { as: 'member', method: 'POST', body: { name: 'X', url: 'a/mapas/x.png' } })).status).toBe(404);
      expect((await call(`/mesas/${mesa.id}/grids`, { as: 'gm', method: 'POST', body: { name: 'X', url: 'a/mapas/x.svg' } })).status).toBe(400);

      const grid = (await call(`/mesas/${mesa.id}/grids`, { as: 'gm', method: 'POST', body: { name: 'Masmorra', url: `${mesa.id}/mapas/m.png` } })).json;
      expect(grid).toMatchObject({ mesaID: mesa.id, name: 'Masmorra' });
      expect((await call(`/mesas/${mesa.id}/grids`, { as: 'gm' })).json).toHaveLength(1);
      expect((await call(`/grids/${grid.id}`, { as: 'stranger' })).status).toBe(404);
      expect((await call(`/grids/${grid.id}`, { as: 'gm', method: 'PATCH', body: { name: 'Cripta' } })).json.name).toBe('Cripta');

      expect((await call(`/grids/${grid.id}/scene`, { as: 'gm' })).json).toEqual({ scene: null });
      const scene = { version: 1, tokens: [], walls: [], lights: [], drawings: [] };
      expect((await call(`/grids/${grid.id}/scene`, { as: 'member', method: 'PUT', body: { scene } })).status).toBe(404);
      expect((await call(`/grids/${grid.id}/scene`, { as: 'gm', method: 'PUT', body: { scene: 'lixo' } })).status).toBe(400);
      expect((await call(`/grids/${grid.id}/scene`, { as: 'gm', method: 'PUT', body: { scene } })).status).toBe(204);
      expect((await call(`/grids/${grid.id}/scene`, { as: 'gm' })).json.scene).toMatchObject({ tokens: [] });

      expect((await call(`/grids/${grid.id}`, { as: 'gm', method: 'DELETE' })).status).toBe(204);
      expect((await call(`/grids/${grid.id}/scene`, { as: 'gm' })).status).toBe(404);
      await call(`/mesas/${mesa.id}`, { as: 'gm', method: 'DELETE' });
    });
  });

  describe('tempo real', () => {
    test('quem pode ver a mesa recebe aviso quando algo muda; o bilhete vale só para isso', async () => {
      const mesa = (await call('/mesas', { as: 'gm', method: 'POST', body: { name: 'Ao vivo', edition: '2024' } })).json;
      const characterID = (await call('/characters', { as: 'member', method: 'POST', body: { name: 'Pj', edition: '2024', classes: [{ classKey: '1', level: 1 }], abilities } })).json.id;
      await call('/mesas/join', { as: 'member', method: 'POST', body: { inviteCode: mesa.inviteCode, characterID } });

      expect((await call(`/mesas/${mesa.id}/events`, { as: 'stranger' })).status).toBe(404);
      const { ticket } = (await call('/auth/ticket', { as: 'gm', method: 'POST' })).json;
      expect((await call(`/mesas/${mesa.id}/events?ticket=${ticket}x`)).status).toBe(401);
      expect((await call(`/mesas?ticket=${ticket}`)).status).toBe(200); // o bilhete identifica o usuário

      const controller = new AbortController();
      const res = await app.request(`/mesas/${mesa.id}/events?ticket=${ticket}`, { signal: controller.signal });
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      const reader = res.body!.getReader();
      let received = '';
      const until = async (text: string) => {
        const deadline = Date.now() + 3000;
        while (!received.includes(text) && Date.now() < deadline) {
          const { value, done } = await reader.read();
          if (done) break;
          received += new TextDecoder().decode(value);
        }
        expect(received).toContain(text);
      };
      await until('event: open');
      await call(`/characters/${characterID}`, { as: 'member', method: 'PATCH', body: { combat: { hpCurrent: 1 } } });
      await until('event: change');
      controller.abort();
      await reader.cancel().catch(() => {});
      await call(`/mesas/${mesa.id}`, { as: 'gm', method: 'DELETE' });
    });
  });

  describe('serviços repassados', () => {
    test('/srd repassa, guarda no cache e só aceita caminhos de regras', async () => {
      const before = srdCalls;
      const first = await call('/srd/api/v1/magias?circulo=3', { as: 'member' });
      expect(first.json).toEqual({ path: '/api/v1/magias?circulo=3' });
      await call('/srd/api/v1/magias?circulo=3', { as: 'member' });
      expect(srdCalls - before).toBe(1);
      for (const path of ['/srd/openapi.json', '/srd/api/v1/..%2Fadmin', '/srd/api/v1/Magias']) {
        expect((await call(path, { as: 'member' })).status).toBe(404);
      }
    });

    test('/tts: texto inválido e sem provedor configurado', async () => {
      expect((await call('/tts', { as: 'member' })).status).toBe(400);
      expect((await call(`/tts?text=${'a'.repeat(601)}`, { as: 'member' })).status).toBe(400);
      expect((await call('/tts?text=Olá', { as: 'member' })).status).toBe(503);
      expect((await call('/tts/sage?text=Olá', { as: 'member' })).status).toBe(503);
    });

    test('/nas: mestre lê tudo, jogador só imagens, estranho nada', async () => {
      const mesa = (await call('/mesas', { as: 'gm', method: 'POST', body: { name: 'NAS', edition: '2024' } })).json;
      const characterID = (await call('/characters', { as: 'member', method: 'POST', body: { name: 'Pj', edition: '2024', classes: [{ classKey: '1', level: 1 }], abilities } })).json.id;
      await call('/mesas/join', { as: 'member', method: 'POST', body: { inviteCode: mesa.inviteCode, characterID } });
      await mkdir(join(nasDir, mesa.id, 'imagens'), { recursive: true });
      await mkdir(join(nasDir, mesa.id, 'mapas'), { recursive: true });
      await writeFile(join(nasDir, mesa.id, 'imagens', 'capa.png'), png);
      await writeFile(join(nasDir, mesa.id, 'mapas', 'mapa.png'), png);

      const cover = `/nas/${mesa.id}/imagens/capa.png`;
      const map = `/nas/${mesa.id}/mapas/mapa.png`;
      for (const who of ['gm', 'member'] as const) {
        const res = await app.request(cover, { headers: { Authorization: `Bearer ${tokens[who]}` } });
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('image/png');
        expect(new Uint8Array(await res.arrayBuffer())).toEqual(png);
      }
      expect((await call(map, { as: 'gm' })).status).toBe(200);
      expect((await call(map, { as: 'member' })).status).toBe(404);
      expect((await call(cover, { as: 'stranger' })).status).toBe(404);
      expect((await call(`/nas/${mesa.id}/imagens/nao-existe.png`, { as: 'gm' })).status).toBe(404);
      expect((await call(`/nas/${mesa.id}/imagens/..%2Fmapas%2Fmapa.png`, { as: 'member' })).status).toBe(404);
      expect((await call('/nas/mesa-que-nao-existe/imagens/capa.png', { as: 'gm' })).status).toBe(404);
      await call(`/mesas/${mesa.id}`, { as: 'gm', method: 'DELETE' });
    });
  });
});
