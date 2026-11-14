import { and, asc, desc, ilike, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { Db } from '../db';
import type { Common } from '../common';

/**
 * Listagem paginada de uma tabela. `columns` diz o que cada chave de ordenação ordena (também é a allowlist; `-chave`
 * inverte), `fallback` é a ordem padrão, `search` é a coluna da busca por nome e `where` restringe o que o usuário vê.
 */
export interface Listing<Row, T> {
  from: PgTable;
  where?: SQL;
  columns: Record<string, PgColumn>;
  fallback: (SQL | PgColumn)[];
  search: PgColumn;
  serialize: (row: Row) => T;
}

export async function listing<Row, T>(
  spec: Listing<Row, T>,
  input: { page: number; pageSize: number; sort?: string; search?: string },
): Promise<Common.Page<T>> {
  const db = Db.use();
  const key = input.sort?.replace(/^-/, '');
  const column = key ? spec.columns[key] : undefined;
  const order = column ? [input.sort!.startsWith('-') ? desc(column) : asc(column)] : spec.fallback;
  // Busca por parte do nome, sem diferenciar maiúsculas; `%` e `_` digitados valem como texto.
  const search = input.search ? ilike(spec.search, `%${input.search.replace(/[\\%_]/g, '\\$&')}%`) : undefined;
  const where = and(spec.where, search);

  const [rows, [counted]] = await Promise.all([
    db.select().from(spec.from).where(where).orderBy(...order).limit(input.pageSize).offset((input.page - 1) * input.pageSize),
    db.select({ total: sql<number>`count(*)` }).from(spec.from).where(where),
  ]);
  return { data: (rows as Row[]).map(spec.serialize), page: input.page, pageSize: input.pageSize, total: Number(counted?.total ?? 0) };
}
