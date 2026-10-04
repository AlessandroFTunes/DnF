import type { DiferenteKey } from '@dnf/core/util';
import createFetchClient from 'openapi-fetch';
import type { components, paths } from './open5e';

// Tipos gerados de openapi/open5e.yaml (`bun run srd:spec && bun run srd:gen`).
export type { components, paths } from './open5e';
export type SrdSchemas = components['schemas'];

export const SRD_URL = 'https://api.open5e.com';

// Cada edição é um documento na Open5e: filtre com `document__key: SRD_DOCUMENTS[edition]`.
// As chaves das entidades seguem outro padrão: use DiferenteKey (@dnf/core/util) para montar/ler.
export const SRD_DOCUMENTS = {
  '2014': 'srd-2014', // 5e (SRD 5.1)
  '2024': 'srd-2024', // 5.5e (SRD 5.2)
} as const satisfies Record<DiferenteKey.Edition, string>;

export type SrdEdition = DiferenteKey.Edition;

export function createSrdClient(baseUrl: string = SRD_URL) {
  return createFetchClient<paths>({
    baseUrl,
    // Os filtros `__in` da Open5e esperam valores separados por vírgula.
    querySerializer: { array: { style: 'form', explode: false } },
  });
}

export type SrdClient = ReturnType<typeof createSrdClient>;
