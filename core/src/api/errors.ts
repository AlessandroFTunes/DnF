import { ZodError } from 'zod';

/** Erro que a API devolve como JSON `{ message, fields? }` com o status dado. */
export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415,
    message: string,
    readonly fields?: Record<string, { code: string; message: string }>,
  ) {
    super(message);
  }
}

/** Sem direito conta como "não existe": ninguém descobre o que há além do que pode ver. */
export const notFound = (what = 'Registro') => new HttpError(404, `${what} não encontrado.`);

/** Erros do Zod viram `fields`: um por campo (o primeiro de cada). */
export function fieldsOf(error: ZodError): Record<string, { code: string; message: string }> {
  const fields: Record<string, { code: string; message: string }> = {};
  for (const issue of error.issues) fields[String(issue.path[0] ?? 'form')] ??= { code: issue.code, message: issue.message };
  return fields;
}
