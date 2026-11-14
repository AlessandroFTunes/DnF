import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { Db } from '../db';
import { Nas } from '../storage';
import type { AppEnv } from './index';

/**
 * Entrega arquivos do NAS (`GET /nas/<mesa>/imagens|mapas/<arquivo>`), pela regra do `Nas.reader`: o mestre lê
 * tudo da mesa dele; o jogador só a pasta "imagens" das mesas em que participa. Sem direito, 404 igual a "não
 * existe", para não revelar quais arquivos há.
 */
export function nasRoutes() {
  const db = Db.use();
  const app = new Hono<AppEnv>();
  const { mesas, mesaMembers } = Db.tables;

  app.get('/*', async (c) => {
    const notFound = () => c.json({ message: 'Arquivo não encontrado.' }, 404);
    const url = c.req.path.replace(/^\/nas\//, '');
    const rule = Nas.reader(url);
    if (!rule) return notFound();

    const userID = c.get('user').id;
    const [mesa] = await db.select({ gmId: mesas.gmId }).from(mesas).where(eq(mesas.id, rule.mesaID)).limit(1);
    if (!mesa) return notFound();

    let allowed = mesa.gmId === userID;
    if (!allowed && rule.reader === 'member') {
      const [member] = await db
        .select({ id: mesaMembers.id })
        .from(mesaMembers)
        .where(and(eq(mesaMembers.mesaId, rule.mesaID), eq(mesaMembers.userId, userID)))
        .limit(1);
      allowed = !!member;
    }
    if (!allowed) return notFound();

    const file = await Nas.read(url);
    if (!file) return notFound();
    return c.body(new Blob([file.data as BlobPart]), 200, {
      'Content-Type': file.type,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    });
  });

  return app;
}
