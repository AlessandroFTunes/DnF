import { Http } from '@dnf/core/http';
import type { Mesa } from '@dnf/core/mesa';
import '../../../http';

/** Fonte de imagem do React Native (`<Image source>`): URL e cabeçalhos. */
export type CoverSource = { uri: string; headers: Record<string, string> };

/**
 * Capa da mesa (colocada pelo mestre no DM-Control), ou `undefined` se a mesa não tem. Quem entrega o arquivo é a rota
 * `/nas/<caminho>` da API (`core/src/api/nas.ts`), que só atende quem pode ver a mesa: por isso o token
 * vai no Authorization. O `?v=` renova a imagem quando o mestre troca a capa por outra com o mesmo nome.
 */
export function mesaCover(mesa: Pick<Mesa.Info, 'cover' | 'timeUpdated'>): CoverSource | undefined {
  if (!mesa.cover) return undefined;
  const http = Http.client();
  const path = mesa.cover.split('/').map(encodeURIComponent).join('/');
  return {
    uri: http.url(`/nas/${path}`, { v: mesa.timeUpdated }),
    headers: { Authorization: `Bearer ${http.auth.token}` },
  };
}
