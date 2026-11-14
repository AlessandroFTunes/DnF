import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { Db } from '../db';
import { Grid } from '../grid';
import { notFound } from './errors';
import { mesaFor } from './mesas';
import type { AppEnv } from './index';

type Row = typeof Db.tables.grids.$inferSelect;

function serializeGrid(row: Row): Grid.Info {
  return {
    id: row.id,
    mesaID: row.mesaId,
    name: row.name,
    url: row.url,
    timeCreated: row.created.toISOString(),
    timeUpdated: row.updated.toISOString(),
  };
}

/** Só o mestre da mesa lê e escreve nas grids dela; quem não pode recebe 404 (igual a "não existe"). */
async function gmGrid(gridID: string, userID: string): Promise<Row> {
  const { grids } = Db.tables;
  const [grid] = await Db.use().select().from(grids).where(eq(grids.id, gridID)).limit(1);
  const found = grid && (await mesaFor(grid.mesaId, userID));
  if (!grid || found?.role !== 'gm') throw notFound('Grid');
  return grid;
}

export function gridRoutes() {
  const app = new Hono<AppEnv>();
  const db = Db.use();
  const { grids, gridScenes } = Db.tables;

  async function gmMesaID(mesaID: string, userID: string) {
    const found = await mesaFor(mesaID, userID);
    if (found?.role !== 'gm') throw notFound('Mesa');
    return found.mesa.id;
  }

  app.get('/mesas/:mesaID/grids', async (c) => {
    const mesaID = await gmMesaID(c.req.param('mesaID'), c.get('user').id);
    const rows = await db.select().from(grids).where(eq(grids.mesaId, mesaID)).orderBy(desc(grids.updated), grids.id);
    return c.json(rows.map(serializeGrid));
  });

  app.post('/mesas/:mesaID/grids', async (c) => {
    const body = Grid.Create.parse(await c.req.json());
    const mesaID = await gmMesaID(c.req.param('mesaID'), c.get('user').id);
    const [row] = await db.insert(grids).values({ ...body, mesaId: mesaID }).returning();
    return c.json(serializeGrid(row!), 201);
  });

  app.get('/grids/:id', async (c) => c.json(serializeGrid(await gmGrid(c.req.param('id'), c.get('user').id))));

  app.patch('/grids/:id', async (c) => {
    const patch = Grid.Patch.parse(await c.req.json());
    const grid = await gmGrid(c.req.param('id'), c.get('user').id);
    const [row] = await db.update(grids).set(patch).where(eq(grids.id, grid.id)).returning();
    return c.json(serializeGrid(row!));
  });

  app.delete('/grids/:id', async (c) => {
    const grid = await gmGrid(c.req.param('id'), c.get('user').id);
    await db.delete(grids).where(eq(grids.id, grid.id));
    return c.body(null, 204);
  });

  /** A cena da grid; uma grid nova ainda não tem registro (`scene: null`). */
  app.get('/grids/:id/scene', async (c) => {
    const grid = await gmGrid(c.req.param('id'), c.get('user').id);
    const [row] = await db.select().from(gridScenes).where(eq(gridScenes.gridId, grid.id)).limit(1);
    return c.json({ scene: row?.data ?? null });
  });

  app.put('/grids/:id/scene', async (c) => {
    const { scene } = Grid.SceneBody.parse(await c.req.json());
    const grid = await gmGrid(c.req.param('id'), c.get('user').id);
    const [atual] = await db.select({ id: gridScenes.id }).from(gridScenes).where(eq(gridScenes.gridId, grid.id)).limit(1);
    if (atual) await db.update(gridScenes).set({ data: scene }).where(eq(gridScenes.id, atual.id));
    else await db.insert(gridScenes).values({ gridId: grid.id, data: scene });
    // A grid foi mexida: sobe na lista (mais recente primeiro).
    await db.update(grids).set({ updated: new Date() }).where(and(eq(grids.id, grid.id)));
    return c.body(null, 204);
  });

  return app;
}
