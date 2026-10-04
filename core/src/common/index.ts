import { z } from 'zod';

export namespace Common {
  export const IdDescription = 'Unique identifier.';

  /** Parâmetros de listagem paginada + filtros específicos de cada módulo. */
  export function Query<S extends z.ZodRawShape>(shape: S) {
    return z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      ...shape,
    });
  }

  export interface Page<T> {
    data: T[];
    page: number;
    pageSize: number;
    total: number;
  }

  /** O PocketBase grava datas como "2026-10-04 05:24:30.227Z"; converte para ISO 8601. */
  export function toISO(date: string): string {
    return new Date(date.replace(' ', 'T')).toISOString();
  }
}
