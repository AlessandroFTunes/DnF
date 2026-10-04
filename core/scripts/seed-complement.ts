/**
 * Importa o complemento do SRD (conteúdo de 2024 que a Open5e não tem, e o Guia de Xanathar e o
 * Caldeirão de Tasha) nas coleções públicas `srd_backgrounds`, `srd_feats`, `srd_species`,
 * `srd_subclasses` e `srd_spells`. Idempotente: atualiza pela `key`.
 *
 *   bun run seed:complement            # PocketBase local (compose)
 *   PB_URL=... PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... bun run seed:complement
 */
import PocketBase from 'pocketbase';
import { books } from '../seed/books';
import complement from '../seed/srd-complement.json';

const data: Record<string, { key: string }[]> = { ...complement };
for (const [collection, records] of Object.entries(books)) data[collection] = [...(data[collection] ?? []), ...records];

const url = process.env.PB_URL ?? 'http://localhost:8090';
const pb = new PocketBase(url);
await pb
  .collection('_superusers')
  .authWithPassword(process.env.PB_ADMIN_EMAIL ?? 'admin@dnf.local', process.env.PB_ADMIN_PASSWORD ?? 'dnf-dev-password');

for (const [collection, records] of Object.entries(data)) {
  let created = 0;
  let updated = 0;
  for (const record of records) {
    const existing = await pb
      .collection(collection)
      .getFirstListItem(pb.filter('key = {:key}', { key: record.key }))
      .catch(() => null);
    if (existing) {
      await pb.collection(collection).update(existing.id, record);
      updated += 1;
    } else {
      await pb.collection(collection).create(record);
      created += 1;
    }
  }
  console.log(`${collection}: ${created} criados, ${updated} atualizados`);
}
