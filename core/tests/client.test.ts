import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { like } from 'drizzle-orm';
import { Api } from '../src/api';
import { Character } from '../src/character';
import { Db } from '../src/db';
import { Grid } from '../src/grid';
import { Http } from '../src/http';
import { Mesa } from '../src/mesa';
import { User } from '../src/user';

// O cliente do core (o que o app e o DM-Control usam) falando com a API de verdade, por HTTP.
// Precisa de um Postgres (`DATABASE_URL`); sem ele o teste é pulado.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)('Http + módulos do core', () => {
  const run = crypto.randomUUID().slice(0, 8);
  const db = Db.use(url);
  let server: ReturnType<typeof Bun.serve>;
  let filesDir: string;
  const base = () => `http://localhost:${server.port}`;
  const abilities = { str: 10, dex: 12, con: 14, int: 8, wis: 10, cha: 16 };
  const signUp = (who: string) =>
    User.create.force({ name: `Pessoa ${who}`, email: `${who}-${run}@client.local`, password: 'senha-forte-1', passwordConfirm: 'senha-forte-1' });
  const pj = (name: string) => Character.create.force({ name, edition: '2024', classes: [{ classKey: '1', level: 2 }], abilities } as never);

  beforeAll(async () => {
    await Db.migrateUp();
    filesDir = await mkdtemp(join(tmpdir(), 'dnf-client-'));
    const app = Api.create({ env: { AUTH_SECRET: 'y'.repeat(40), FILES_DIR: filesDir } });
    server = Bun.serve({ port: 0, fetch: app.fetch, idleTimeout: 30 });
    Http.init({ url: base() });
  });

  afterAll(async () => {
    server.stop(true);
    await db.delete(Db.tables.users).where(like(Db.tables.users.email, `%-${run}@client.local`));
    await rm(filesDir, { recursive: true, force: true });
    await Db.close();
  });

  test('cadastro já entra: o AuthStore guarda token e perfil, e a sessão vale', async () => {
    expect(User.session()).toBeNull();
    const user = await signUp('ana');
    const session = User.session()!;
    expect(session.userID).toBe(user.id);
    expect(session.user).toMatchObject({ name: 'Pessoa ana', avatar: null });
    expect(new Date(session.timeExpires).getTime()).toBeGreaterThan(Date.now());
    expect(Http.client().auth.isValid).toBe(true);
  });

  test('erros viram ApiError com status e campos; sem servidor é status 0', async () => {
    const taken = await signUp('ana').catch((e: unknown) => e);
    expect(taken).toBeInstanceOf(Http.ApiError);
    expect((taken as Http.ApiError).status).toBe(400);
    expect((taken as Http.ApiError).fields.email?.code).toBe('validation_not_unique');

    const wrong = await User.login.force({ email: `ana-${run}@client.local`, password: 'errada' }).catch((e: unknown) => e);
    expect((wrong as Http.ApiError).status).toBe(400);

    const offline = Http.createClient({ url: 'http://127.0.0.1:1' });
    const down = await offline.request('/health').catch((e: unknown) => e);
    expect((down as Http.ApiError).status).toBe(0);
  });

  test('logout, login e refresh; o token apagado do servidor é recusado', async () => {
    await User.logout();
    expect(User.session()).toBeNull();
    await User.login.force({ email: `ANA-${run}@client.local`, password: 'senha-forte-1' });
    expect(User.session()).not.toBeNull();
    const before = Http.client().auth.token;
    await new Promise((resolve) => setTimeout(resolve, 1100)); // `iat` em segundos: garante um token diferente
    await User.refresh();
    expect(Http.client().auth.token).not.toBe(before);
    expect(await User.lookupEmail.force({ email: `ana-${run}@client.local` })).toEqual({ exists: true, firstName: 'Pessoa' });
  });

  test('perfil: preferências se mesclam e a sessão mostra o perfil novo; avatar vira endereço completo', async () => {
    const id = User.session()!.userID;
    await User.update.force({ id, nickname: 'Aninha', preferences: { narration: false } });
    await User.update.force({ id, preferences: { sounds: false } });
    expect(User.session()!.user).toMatchObject({ nickname: 'Aninha', preferences: { narration: false, sounds: false } });

    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const withAvatar = await User.setAvatar(id, new Blob([png], { type: 'image/png' }));
    expect(withAvatar.avatar).toMatch(new RegExp(`^${base()}/files/avatars/${id}/[\\w-]+\\.png$`));
    expect(User.session()!.user!.avatar).toBe(withAvatar.avatar);
    expect((await fetch(withAvatar.avatar!)).status).toBe(200);
    expect((await User.removeAvatar(id)).avatar).toBeNull();
    await expect(User.setAvatar(id, new Blob(['x'], { type: 'text/plain' }))).rejects.toThrow('JPEG, PNG ou WebP');
  });

  test('personagens: cria, lista, mescla o update e apaga', async () => {
    const created = await pj('Kira');
    expect(created).toMatchObject({ level: 2, ownerID: User.session()!.userID });
    expect((await Character.list.force({ page: 1, pageSize: 20, search: 'kir' })).total).toBe(1);
    const updated = await Character.update.force({ id: created.id, combat: { hpCurrent: 3 } });
    expect(updated.combat.hpCurrent).toBe(3);
    expect((await Character.fromID.force(created.id))?.combat.hpCurrent).toBe(3);
    await Character.remove.force(created.id);
    expect(await Character.fromID.force(created.id)).toBeNull();
  });

  test('mesas e grids: o fluxo do mestre e do jogador, cada um no seu cliente', async () => {
    // O mestre (Ana) tem o cliente global; a jogadora usa um cliente próprio dentro de `Http.scope`.
    const mesa = await Mesa.create({ name: 'Taverna', edition: '2024' });
    expect(mesa.inviteCode).toHaveLength(8);
    expect(await Mesa.fromInviteCode.force(`${mesa.inviteCode.slice(0, 4)}-${mesa.inviteCode.slice(4).toLowerCase()}`)).toMatchObject({ id: mesa.id });
    expect(await Mesa.fromInviteCode.force('ZZZZZZZZ')).toBeNull();

    const player = Http.createClient({ url: base() });
    const characterID = await Http.scope(player, async () => {
      await signUp('bia');
      const character = await pj('Bia Pj');
      const member = await Mesa.join.force({ inviteCode: mesa.inviteCode, characterID: character.id });
      expect(member).toMatchObject({ mesaID: mesa.id, playerName: 'Pessoa bia' });
      expect(await Mesa.members.force(mesa.id)).toHaveLength(1);
      expect(await Mesa.ofCharacter.force(character.id)).toEqual([{ memberID: member.id, mesa: expect.objectContaining({ id: mesa.id }) }]);
      expect(await Mesa.update.force({ id: mesa.id, name: 'X' }).catch((e: unknown) => (e as Http.ApiError).status)).toBe(404);
      return character.id;
    });
    expect((player.auth.record as User.Info).name).toBe('Pessoa bia'); // o login da jogadora ficou no cliente dela
    expect(User.session()!.user!.name).toBe('Pessoa ana'); // e não vazou para o do mestre

    expect((await Mesa.members.force(mesa.id)).map((m) => m.character.id)).toEqual([characterID]);
    expect((await Mesa.list.force({ page: 1, pageSize: 20 })).data.map((m) => m.id)).toContain(mesa.id);
    expect(await Mesa.update.force({ id: mesa.id, description: 'Boas-vindas', cover: `${mesa.id}/imagens/c.png` })).toMatchObject({ description: 'Boas-vindas' });
    expect((await Mesa.newInviteCode.force(mesa.id)).inviteCode).not.toBe(mesa.inviteCode);

    const grid = await Grid.create.force({ mesaID: mesa.id, name: 'Masmorra', url: `${mesa.id}/mapas/m.png` });
    expect(await Grid.list.force(mesa.id)).toHaveLength(1);
    expect((await Grid.scene.force(grid.id)).tokens).toEqual([]); // cena nova volta com os padrões
    const scene = Grid.parseScene({});
    await Grid.saveScene.force({ gridID: grid.id, scene });
    expect(await Grid.scene.force(grid.id)).toEqual(scene);
    expect((await Grid.update.force({ id: grid.id, name: 'Cripta' })).name).toBe('Cripta');
    await Grid.remove.force(grid.id);
    expect(await Grid.fromID.force(grid.id)).toBeNull();

    await Mesa.remove.force(mesa.id);
    expect(await Mesa.fromID.force(mesa.id)).toBeNull();
  });

  test('watch: pede o bilhete, abre o EventSource e avisa a cada mudança', async () => {
    const mesa = await Mesa.create({ name: 'Ao vivo', edition: '2024' });
    const opened: string[] = [];
    // O Bun não tem EventSource; este faz só o que o `watch` usa (open, change, error e close) em cima do fetch.
    class FakeEventSource {
      private listeners = new Map<string, (() => void)[]>();
      private controller = new AbortController();
      constructor(readonly url: string) {
        opened.push(url);
        void this.read();
      }
      addEventListener(type: string, listener: () => void) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
      }
      close() {
        this.controller.abort();
      }
      private async read() {
        const res = await fetch(this.url, { signal: this.controller.signal }).catch(() => null);
        const reader = res?.body?.getReader();
        while (reader) {
          const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
          if (done) break;
          for (const match of new TextDecoder().decode(value).matchAll(/event: (\w+)/g)) this.listeners.get(match[1]!)?.forEach((fn) => fn());
        }
      }
    }
    (globalThis as { EventSource?: unknown }).EventSource = FakeEventSource;

    let calls = 0;
    const stop = await Mesa.watch(mesa.id, () => calls++);
    const waitFor = async (n: number) => {
      const deadline = Date.now() + 3000;
      while (calls < n && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
      expect(calls).toBeGreaterThanOrEqual(n);
    };
    await waitFor(1); // o `open`: quem ficou sem rede busca o que perdeu
    await Mesa.update.force({ id: mesa.id, name: 'Mudou' });
    await waitFor(2);
    expect(opened[0]).toContain(`/mesas/${mesa.id}/events?ticket=`);
    await stop();
    delete (globalThis as { EventSource?: unknown }).EventSource;
    await Mesa.remove.force(mesa.id);
  });

  test('Http.scope isola o login de cada requisição, mesmo ao mesmo tempo', async () => {
    const a = Http.createClient({ url: base() });
    const b = Http.createClient({ url: base() });
    const [nameA, nameB] = await Promise.all([
      Http.scope(a, async () => (await signUp('c1'), await new Promise((r) => setTimeout(r, 30)), (await Http.client().request<User.Info>(`/users/${(a.auth.record as User.Info).id}`)).name)),
      Http.scope(b, async () => (await signUp('c2'), (await Http.client().request<User.Info>(`/users/${(b.auth.record as User.Info).id}`)).name)),
    ]);
    expect([nameA, nameB]).toEqual(['Pessoa c1', 'Pessoa c2']);
  });

  test('apagar a conta encerra a sessão', async () => {
    await User.remove.force(User.session()!.userID);
    expect(User.session()).toBeNull();
  });
});
