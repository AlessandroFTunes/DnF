import { eq } from 'drizzle-orm';
import { Db } from '../db';

/**
 * Avisos em tempo real da mesa (quem entra, sai ou muda o PV). Um processo só: cada mudança chama `publish` e
 * quem está com `GET /mesas/:id/events` aberto recebe o aviso e busca de novo o que precisa.
 */
const listeners = new Map<string, Set<() => void>>();

export function subscribe(mesaID: string, listener: () => void): () => void {
  const set = listeners.get(mesaID) ?? new Set();
  set.add(listener);
  listeners.set(mesaID, set);
  return () => {
    set.delete(listener);
    if (!set.size) listeners.delete(mesaID);
  };
}

export function publish(mesaID: string) {
  listeners.get(mesaID)?.forEach((listener) => listener());
}

/** Mesas em que o personagem está sentado. */
export async function mesasOfCharacter(characterID: string): Promise<string[]> {
  const { mesaMembers } = Db.tables;
  const rows = await Db.use().select({ mesaId: mesaMembers.mesaId }).from(mesaMembers).where(eq(mesaMembers.characterId, characterID));
  return rows.map((row) => row.mesaId);
}

