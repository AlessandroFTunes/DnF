import { PocketBase } from '@dnf/core/pocketbase';
import type { Mesa } from '@dnf/core/mesa';
import '../../../pocketbase';

/** Fonte de imagem do React Native (`<Image source>`): URL e cabeçalhos. */
export type CoverSource = { uri: string; headers: Record<string, string> };

/**
 * Capa da mesa (colocada pelo mestre no DM-Control), ou `undefined` se a mesa não tem. Quem entrega o arquivo é a rota
 * `/nas/<caminho>` do PocketBase (`core/pb_hooks/nas.pb.js`), que só atende quem pode ver a mesa: por isso o token
 * vai no Authorization. O `?v=` renova a imagem quando o mestre troca a capa por outra com o mesmo nome.
 */
export function mesaCover(mesa: Pick<Mesa.Info, 'cover' | 'timeUpdated'>): CoverSource | undefined {
  if (!mesa.cover) return undefined;
  const pb = PocketBase.client();
  const path = mesa.cover.split('/').map(encodeURIComponent).join('/');
  return {
    uri: `${pb.baseURL.replace(/\/$/, '')}/nas/${path}?v=${encodeURIComponent(mesa.timeUpdated)}`,
    headers: { Authorization: pb.authStore.token },
  };
}
