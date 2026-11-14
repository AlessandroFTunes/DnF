import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { Db } from '../db';
import { Mesa } from '../mesa';
import { User } from '../user';
import { HttpError, notFound } from './errors';
import { serializeCharacter } from './characters';
import { listing } from './page';
import { publish, subscribe } from './realtime';
import type { AppEnv } from './index';

type Row = typeof Db.tables.mesas.$inferSelect;

function serializeMesa(row: Row): Mesa.Info {
  return {
    id: row.id,
    gmID: row.gmId,
    name: row.name,
    description: row.description,
    edition: row.edition,
    inviteCode: row.inviteCode,
    cover: row.cover || null,
    timeCreated: row.created.toISOString(),
    timeUpdated: row.updated.toISOString(),
  };
}

// Sem 0/O e 1/I, que confundem ao digitar.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** A mesa e o papel de quem pergunta: o mestre, um jogador sentado nela ou ninguém (então `null`). */
export async function mesaFor(mesaID: string, userID: string): Promise<{ mesa: Row; role: 'gm' | 'member' } | null> {
  const { mesas, mesaMembers } = Db.tables;
  const [mesa] = await Db.use().select().from(mesas).where(eq(mesas.id, mesaID)).limit(1);
  if (!mesa) return null;
  if (mesa.gmId === userID) return { mesa, role: 'gm' };
  const [member] = await Db.use()
    .select({ id: mesaMembers.id })
    .from(mesaMembers)
    .where(and(eq(mesaMembers.mesaId, mesaID), eq(mesaMembers.userId, userID)))
    .limit(1);
  return member ? { mesa, role: 'member' } : null;
}

/** Só o mestre muda a mesa; quem não pode nem a vê (404). */
async function gmMesa(mesaID: string, userID: string): Promise<Row> {
  const found = await mesaFor(mesaID, userID);
  if (found?.role !== 'gm') throw notFound('Mesa');
  return found.mesa;
}

export function mesaRoutes() {
  const app = new Hono<AppEnv>();
  const db = Db.use();
  const { mesas, mesaMembers, characters, users } = Db.tables;

  app.get('/', async (c) => {
    const userID = c.get('user').id;
    const input = Mesa.ListQuery.parse(c.req.query());
    const seated = db.select({ id: mesaMembers.mesaId }).from(mesaMembers).where(eq(mesaMembers.userId, userID));
    return c.json(
      await listing(
        {
          from: mesas,
          where: or(eq(mesas.gmId, userID), inArray(mesas.id, seated)),
          columns: { name: mesas.name, timeCreated: mesas.created, timeUpdated: mesas.updated },
          fallback: [desc(mesas.updated), mesas.id],
          search: mesas.name,
          serialize: serializeMesa,
        },
        input,
      ),
    );
  });

  app.post('/', async (c) => {
    const input = Mesa.Create.parse(await c.req.json());
    // O código é único: se por azar repetir, sorteia outro.
    for (let attempt = 0; ; attempt++) {
      try {
        const [row] = await db.insert(mesas).values({ ...input, gmId: c.get('user').id, inviteCode: randomCode() }).returning();
        return c.json(serializeMesa(row!), 201);
      } catch (error) {
        if (attempt >= 4 || !String(error).includes('invite_code')) throw error;
      }
    }
  });

  // Rotas fixas antes de `/:id`.
  app.get('/by-code/:code', async (c) => {
    const code = Mesa.InviteCode.safeParse(c.req.param('code'));
    const [row] = code.success ? await db.select().from(mesas).where(eq(mesas.inviteCode, code.data)).limit(1) : [];
    if (!row) throw notFound('Mesa');
    return c.json(serializeMesa(row));
  });

  app.get('/of-character/:characterID', async (c) => {
    const userID = c.get('user').id;
    const rows = await db
      .select({ memberID: mesaMembers.id, mesa: mesas })
      .from(mesaMembers)
      .innerJoin(mesas, eq(mesas.id, mesaMembers.mesaId))
      .where(and(eq(mesaMembers.characterId, c.req.param('characterID')), or(eq(mesaMembers.userId, userID), eq(mesas.gmId, userID))))
      .orderBy(asc(mesaMembers.created), asc(mesaMembers.id));
    return c.json(rows.map((row) => ({ memberID: row.memberID, mesa: serializeMesa(row.mesa) })));
  });

  app.post('/join', async (c) => {
    const userID = c.get('user').id;
    const input = Mesa.JoinInput.parse(await c.req.json());
    const [mesa] = await db.select().from(mesas).where(eq(mesas.inviteCode, input.inviteCode)).limit(1);
    if (!mesa) throw notFound('Mesa');
    const [character] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, input.characterID), eq(characters.ownerId, userID)))
      .limit(1);
    if (!character) throw new HttpError(400, 'Personagem inválido.', { characterID: { code: 'validation_invalid', message: 'Personagem inválido.' } });
    if (character.edition !== mesa.edition) throw new HttpError(400, 'O personagem é de outra edição.');
    const [already] = await db
      .select({ id: mesaMembers.id })
      .from(mesaMembers)
      .where(and(eq(mesaMembers.mesaId, mesa.id), eq(mesaMembers.characterId, character.id)))
      .limit(1);
    if (already) throw new HttpError(400, 'O personagem já está nesta mesa.');

    const [member] = await db.insert(mesaMembers).values({ mesaId: mesa.id, userId: userID, characterId: character.id }).returning();
    const [player] = await db.select().from(users).where(eq(users.id, userID)).limit(1);
    publish(mesa.id);
    return c.json(serializeMember(member!, character, player!), 201);
  });

  app.delete('/members/:memberID', async (c) => {
    const userID = c.get('user').id;
    const [row] = await db
      .select({ id: mesaMembers.id, userId: mesaMembers.userId, mesaId: mesaMembers.mesaId, gmId: mesas.gmId })
      .from(mesaMembers)
      .innerJoin(mesas, eq(mesas.id, mesaMembers.mesaId))
      .where(eq(mesaMembers.id, c.req.param('memberID')))
      .limit(1);
    // O próprio jogador sai, ou o mestre remove alguém.
    if (!row || (row.userId !== userID && row.gmId !== userID)) throw notFound('Jogador');
    await db.delete(mesaMembers).where(eq(mesaMembers.id, row.id));
    publish(row.mesaId);
    return c.body(null, 204);
  });

  app.get('/:id', async (c) => {
    const found = await mesaFor(c.req.param('id'), c.get('user').id);
    if (!found) throw notFound('Mesa');
    return c.json(serializeMesa(found.mesa));
  });

  app.patch('/:id', async (c) => {
    const patch = Mesa.Patch.parse(await c.req.json());
    const mesa = await gmMesa(c.req.param('id'), c.get('user').id);
    const [row] = await db.update(mesas).set(patch).where(eq(mesas.id, mesa.id)).returning();
    publish(mesa.id);
    return c.json(serializeMesa(row!));
  });

  app.delete('/:id', async (c) => {
    const mesa = await gmMesa(c.req.param('id'), c.get('user').id);
    await db.delete(mesas).where(eq(mesas.id, mesa.id));
    publish(mesa.id);
    return c.body(null, 204);
  });

  /** Troca o código de convite; o antigo para de funcionar. Quem já entrou continua. */
  app.post('/:id/invite-code', async (c) => {
    const mesa = await gmMesa(c.req.param('id'), c.get('user').id);
    const [row] = await db.update(mesas).set({ inviteCode: randomCode() }).where(eq(mesas.id, mesa.id)).returning();
    publish(mesa.id);
    return c.json(serializeMesa(row!));
  });

  /** Mestre: todos os jogadores e personagens. Jogador: só a própria entrada. */
  app.get('/:id/members', async (c) => {
    const userID = c.get('user').id;
    const found = await mesaFor(c.req.param('id'), userID);
    if (!found) throw notFound('Mesa');
    const rows = await db
      .select({ member: mesaMembers, character: characters, player: users })
      .from(mesaMembers)
      .innerJoin(characters, eq(characters.id, mesaMembers.characterId))
      .innerJoin(users, eq(users.id, mesaMembers.userId))
      .where(and(eq(mesaMembers.mesaId, found.mesa.id), found.role === 'gm' ? undefined : eq(mesaMembers.userId, userID)))
      .orderBy(asc(mesaMembers.created), asc(mesaMembers.id));
    return c.json(rows.map((row) => serializeMember(row.member, row.character, row.player)));
  });

  /** Avisos da mesa (SSE). Quem pode ver a mesa recebe `change` quando ela, os membros ou um personagem dela mudam. */
  app.get('/:id/events', async (c) => {
    const found = await mesaFor(c.req.param('id'), c.get('user').id);
    if (!found) throw notFound('Mesa');
    return streamSSE(c, async (stream) => {
      const stop = subscribe(found.mesa.id, () => void stream.writeSSE({ event: 'change', data: '1' }).catch(() => {}));
      stream.onAbort(stop);
      await stream.writeSSE({ event: 'open', data: '1' });
      while (!stream.aborted && !stream.closed) {
        await stream.sleep(25_000);
        await stream.writeSSE({ event: 'ping', data: '1' }).catch(() => {});
      }
      stop();
    });
  });

  return app;
}

function serializeMember(
  member: typeof Db.tables.mesaMembers.$inferSelect,
  character: typeof Db.tables.characters.$inferSelect,
  player: typeof Db.tables.users.$inferSelect,
): Mesa.Member {
  return {
    id: member.id,
    mesaID: member.mesaId,
    userID: member.userId,
    playerName: User.displayName(player),
    character: serializeCharacter(character),
    timeJoined: member.created.toISOString(),
  };
}

