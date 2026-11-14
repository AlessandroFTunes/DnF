/**
 * Copia os dados do PocketBase para o Postgres, mantendo os ids (os tokens e as relações continuam valendo).
 * Lê o SQLite do PocketBase direto (`pb_data/data.db`, somente leitura): só assim sai o hash da senha, que a API
 * do PocketBase não entrega. Migra users, characters, mesas, mesa_members, grids e grid_scenes (as `srd_*` não:
 * o compêndio vem da 5e-FastAPI). Avatares e a pasta do NAS são arquivos: copie `pb_data/storage/` à parte.
 *
 *   DATABASE_URL=postgres://dnf:dnf@localhost:5432/dnf bun run migrate:pocketbase
 *   PB_DATA=/caminho/pb_data/data.db  ...      # outro banco de origem
 *   ... --replace                              # apaga o que já está no Postgres e copia de novo
 *
 * Cria as tabelas que faltam (migrations do Drizzle) antes de copiar. Sem `--replace`, recusa rodar se o Postgres já tem usuários (não apaga nada de quem já usa a API nova).
 * Linhas que apontam para um registro que não existe (órfãs) são puladas e contadas no fim.
 */
import { Database } from 'bun:sqlite';
import { Db } from '../src/db';

const source = process.env.PB_DATA ?? new URL('../pb_data/data.db', import.meta.url).pathname;
const target = process.env.DATABASE_URL;
if (!target) throw new Error('Defina DATABASE_URL.');
const replace = process.argv.includes('--replace');

const pb = new Database(source, { readonly: true });
const db = Db.create(target);
const t = Db.tables;
await Db.migrateUp(db, new URL('../drizzle', import.meta.url).pathname);

type Row = Record<string, unknown>;
const all = (table: string): Row[] => pb.query(`SELECT * FROM ${table}`).all() as Row[];

/** O PocketBase grava datas como "2026-11-01 12:00:00.000Z". */
const date = (value: unknown) => (value ? new Date(String(value).replace(' ', 'T')) : new Date());
/** Colunas JSON do PocketBase vêm como texto (ou nulas). */
const json = <T>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};
const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));
const nullable = (value: unknown) => (value ? String(value) : null);
const edition = (value: unknown): '2014' | '2024' => (String(value) === '2024' ? '2024' : '2014');

const skipped: Record<string, number> = {};
function onlyWith<R extends Row>(table: string, rows: R[], checks: [field: string, ids: Set<string>][]) {
  return rows.filter((row) => {
    const ok = checks.every(([field, ids]) => ids.has(String(row[field])));
    if (!ok) skipped[table] = (skipped[table] ?? 0) + 1;
    return ok;
  });
}

async function insertInChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>, size = 200) {
  for (let i = 0; i < rows.length; i += size) await insert(rows.slice(i, i + size));
}

const existing = await db.select({ id: t.users.id }).from(t.users).limit(1);
if (existing.length && !replace) {
  console.error('O Postgres já tem usuários. Use --replace para apagar e copiar de novo.');
  process.exit(1);
}

const users = all('users');
const userIDs = new Set(users.map((r) => String(r.id)));
const characters = onlyWith('characters', all('characters'), [['owner', userIDs]]);
const characterIDs = new Set(characters.map((r) => String(r.id)));
const mesas = onlyWith('mesas', all('mesas'), [['gm', userIDs]]);
const mesaIDs = new Set(mesas.map((r) => String(r.id)));
const members = onlyWith('mesa_members', all('mesa_members'), [
  ['mesa', mesaIDs],
  ['user', userIDs],
  ['character', characterIDs],
]);
const grids = onlyWith('grids', all('grids'), [['mesa', mesaIDs]]);
const gridIDs = new Set(grids.map((r) => String(r.id)));
const scenes = onlyWith('grid_scenes', all('grid_scenes'), [['grid', gridIDs]]);

await db.transaction(async (tx) => {
  if (replace) {
    for (const table of [t.gridScenes, t.grids, t.mesaMembers, t.mesas, t.characters, t.users]) await tx.delete(table);
  }
  const base = (r: Row) => ({ id: String(r.id), created: date(r.created), updated: date(r.updated) });

  await insertInChunks(users, (rows) =>
    tx.insert(t.users).values(
      rows.map((r) => ({
        ...base(r),
        email: String(r.email).toLowerCase(),
        passwordHash: nullable(r.password),
        name: text(r.name),
        nickname: text(r.nickname),
        avatar: nullable(r.avatar),
        preferences: json(r.preferences, {}),
        verified: !!r.verified,
      })),
    ),
  );
  await insertInChunks(characters, (rows) =>
    tx.insert(t.characters).values(
      rows.map((r) => ({
        ...base(r),
        ownerId: String(r.owner),
        name: text(r.name),
        edition: edition(r.edition),
        level: Number(r.level) || 1,
        classes: json(r.classes, []),
        speciesKey: nullable(r.speciesKey),
        backgroundKey: nullable(r.backgroundKey),
        alignmentKey: nullable(r.alignmentKey),
        featKeys: json(r.featKeys, []),
        abilities: json(r.abilities, {} as never),
        xp: Number(r.xp) || 0,
        inspiration: !!r.inspiration,
        featureUses: json(r.featureUses, {}),
        proficiencies: json(r.proficiencies, {} as never),
        combat: json(r.combat, {} as never),
        equipment: json(r.equipment, {} as never),
        spellcasting: json(r.spellcasting, {} as never),
        personality: json(r.personality, {} as never),
        details: json(r.details, {} as never),
      })),
    ),
  );
  await insertInChunks(mesas, (rows) =>
    tx.insert(t.mesas).values(
      rows.map((r) => ({
        ...base(r),
        gmId: String(r.gm),
        name: text(r.name),
        description: text(r.description),
        edition: edition(r.edition),
        inviteCode: text(r.inviteCode),
        cover: nullable(r.cover),
      })),
    ),
  );
  await insertInChunks(members, (rows) =>
    tx.insert(t.mesaMembers).values(
      rows.map((r) => ({ ...base(r), mesaId: String(r.mesa), userId: String(r.user), characterId: String(r.character) })),
    ),
  );
  await insertInChunks(grids, (rows) =>
    tx.insert(t.grids).values(rows.map((r) => ({ ...base(r), mesaId: String(r.mesa), name: text(r.name), url: text(r.url) }))),
  );
  await insertInChunks(scenes, (rows) =>
    tx.insert(t.gridScenes).values(rows.map((r) => ({ ...base(r), gridId: String(r.grid), data: json(r.data, null) }))),
  );
});

const copied = { users, characters, mesas, mesa_members: members, grids, grid_scenes: scenes };
for (const [name, rows] of Object.entries(copied)) console.log(`${name}: ${rows.length} copiados`);
for (const [name, count] of Object.entries(skipped)) console.warn(`${name}: ${count} órfãos pulados`);
await db.close();
pb.close();
