import { createAdapter, createPocketBaseAdapter, type DndAdapterOptions } from '@dnf/core/dnd';
import type PocketBaseClient from 'pocketbase';
import type { components, paths } from './5e-fastapi';

// Tipos gerados de openapi/5e-fastapi.json (`bun run srd:spec && bun run srd:gen`).
export type { components, paths } from './5e-fastapi';
export type SrdSchemas = components['schemas'];

export { DND_URL as SRD_URL } from '@dnf/core/dnd';

export interface SrdClientOptions extends DndAdapterOptions {
  /** Passa pelo proxy `/srd` deste PocketBase (com o JWT do login) em vez de falar direto com a API. */
  pocketbase?: PocketBaseClient;
}

export function createSrdClient({ pocketbase, ...options }: SrdClientOptions = {}) {
  return pocketbase ? createPocketBaseAdapter<paths>(pocketbase) : createAdapter<paths>(options);
}

export type SrdClient = ReturnType<typeof createSrdClient>;
export * from './reference';
export * from './catalog';
export * from './rules';
