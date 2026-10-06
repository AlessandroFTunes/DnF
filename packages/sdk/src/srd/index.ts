import createFetchClient from 'openapi-fetch';
import type { components, paths } from './5e-fastapi';

// Tipos gerados de openapi/5e-fastapi.json (`bun run srd:spec && bun run srd:gen`).
export type { components, paths } from './5e-fastapi';
export type SrdSchemas = components['schemas'];

/** API de regras de D&D em português (https://github.com/AlessandroFTunes/5e-FastAPI). */
export const SRD_URL = 'https://5e-fastapi.developale.com';

export interface SrdClientOptions {
  baseUrl?: string;
  /**
   * Service token do Cloudflare Access que fica na frente da API. Vai em toda requisição
   * (`CF-Access-Client-Id` / `CF-Access-Client-Secret`). Sem ele, o Access responde 401/403.
   */
  accessToken?: { clientId: string; clientSecret: string } | null;
}

export function createSrdClient({ baseUrl = SRD_URL, accessToken }: SrdClientOptions = {}) {
  return createFetchClient<paths>({
    baseUrl,
    headers: accessToken
      ? { 'CF-Access-Client-Id': accessToken.clientId, 'CF-Access-Client-Secret': accessToken.clientSecret }
      : undefined,
  });
}

export type SrdClient = ReturnType<typeof createSrdClient>;
export * from './reference';
export * from './catalog';
export * from './rules';
