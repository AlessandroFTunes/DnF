import { and, desc, eq, exists, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { Character } from '../character';
import { Db } from '../db';
import { notFound } from './errors';
import { listing } from './page';
import { mesasOfCharacter, publish } from './realtime';
import type { AppEnv } from './index';

type Row = typeof Db.tables.characters.$inferSelect;

/** Do banco para o formato do app; registros antigos podem não ter uma seção, e o `parse` completa com os padrões. */
export function serializeCharacter(row: Row): Character.Info {
  return {
    id: row.id,
    ownerID: row.ownerId,
    name: row.name,
    edition: row.edition,
    level: row.level,
    classes: row.classes ?? [],
    speciesKey: row.speciesKey || null,
    backgroundKey: row.backgroundKey || null,
    alignmentKey: row.alignmentKey || null,
    featKeys: row.featKeys ?? [],
    abilities: row.abilities,
    xp: row.xp,
    inspiration: row.inspiration,
    featureUses: row.featureUses ?? {},
    proficiencies: Character.Info.shape.proficiencies.parse(row.proficiencies ?? {}),
    combat: Character.Info.shape.combat.parse(row.combat ?? {}),
    equipment: Character.Info.shape.equipment.parse(row.equipment ?? {}),
    spellcasting: Character.Info.shape.spellcasting.parse(row.spellcasting ?? {}),
    personality: Character.Info.shape.personality.parse(row.personality ?? {}),
    details: Character.Info.shape.details.parse(row.details ?? {}),
    timeCreated: row.created.toISOString(),
    timeUpdated: row.updated.toISOString(),
  };
}

/** O dono vê e muda; o mestre de uma mesa em que o personagem está sentado só vê. */
async function find(id: string, userID: string, write: boolean): Promise<Row> {
  const { characters, mesas, mesaMembers } = Db.tables;
  const asGm = exists(
    Db.use()
      .select({ one: mesaMembers.id })
      .from(mesaMembers)
      .innerJoin(mesas, eq(mesas.id, mesaMembers.mesaId))
      .where(and(eq(mesaMembers.characterId, characters.id), eq(mesas.gmId, userID))),
  );
  const [row] = await Db.use()
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), write ? eq(characters.ownerId, userID) : or(eq(characters.ownerId, userID), asGm)))
    .limit(1);
  if (!row) throw notFound('Personagem');
  return row;
}

export function characterRoutes() {
  const app = new Hono<AppEnv>();
  const db = Db.use();
  const { characters } = Db.tables;

  app.get('/', async (c) => {
    const input = Character.ListQuery.parse(c.req.query());
    // O mestre também enxerga os personagens da mesa dele, mas aqui são só os do usuário.
    return c.json(
      await listing(
        {
          from: characters,
          where: eq(characters.ownerId, c.get('user').id),
          columns: { name: characters.name, level: characters.level, timeCreated: characters.created, timeUpdated: characters.updated },
          fallback: [desc(characters.updated), characters.id],
          search: characters.name,
          serialize: serializeCharacter,
        },
        input,
      ),
    );
  });

  app.post('/', async (c) => {
    const input = Character.Create.parse(await c.req.json());
    const [row] = await db
      .insert(characters)
      .values({ ...input, level: Character.levelOf(input.classes), ownerId: c.get('user').id })
      .returning();
    return c.json(serializeCharacter(row!), 201);
  });

  app.get('/:id', async (c) => c.json(serializeCharacter(await find(c.req.param('id'), c.get('user').id, false))));

  app.patch('/:id', async (c) => {
    const patch = Character.PatchBody.parse(await c.req.json());
    const current = serializeCharacter(await find(c.req.param('id'), c.get('user').id, true));
    const [row] = await db.update(characters).set(Character.merge(current, patch)).where(eq(characters.id, current.id)).returning();
    (await mesasOfCharacter(current.id)).forEach(publish);
    return c.json(serializeCharacter(row!));
  });

  app.delete('/:id', async (c) => {
    const row = await find(c.req.param('id'), c.get('user').id, true);
    const mesaIDs = await mesasOfCharacter(row.id);
    await db.delete(characters).where(eq(characters.id, row.id));
    mesaIDs.forEach(publish);
    return c.body(null, 204);
  });

  return app;
}
