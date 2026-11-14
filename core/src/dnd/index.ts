import createFetchClient, { type Client } from 'openapi-fetch';
import type { Http } from '../http';

/** API de regras de D&D em português (https://github.com/AlessandroFTunes/5e-FastAPI). */
export const DND_URL = 'https://5e-fastapi.developale.com';

export interface DndAdapterOptions {
  baseUrl?: string;
  /**
   * Service token do Cloudflare Access que fica na frente da API. Vai em toda requisição
   * (`CF-Access-Client-Id` / `CF-Access-Client-Secret`). Sem ele, o Access responde 401/403.
   */
  accessToken?: { clientId: string; clientSecret: string } | null;
  /** Token enviado em `Authorization` a cada requisição (o da sessão, para o proxy `/srd` da API). */
  token?: () => string | undefined;
}

/**
 * Cliente tipado da API de regras. `Paths` vem do spec gerado (`paths` em `@dnf/sdk/srd`): o tipo mora
 * lá para o core não depender do SDK.
 */
export function createAdapter<Paths extends {}>({
  baseUrl = DND_URL,
  accessToken,
  token,
}: DndAdapterOptions = {}): Client<Paths> {
  const client = createFetchClient<Paths>({
    baseUrl,
    headers: accessToken
      ? { 'CF-Access-Client-Id': accessToken.clientId, 'CF-Access-Client-Secret': accessToken.clientSecret }
      : undefined,
  });
  if (token) {
    client.use({
      onRequest({ request }) {
        const value = token();
        if (value) request.headers.set('Authorization', `Bearer ${value}`);
        return request;
      },
    });
  }
  return client;
}

/**
 * Passa pela API do DnF (`core/src/api/srd.ts`), que guarda o token do Cloudflare Access e só
 * atende logados. É o caminho dos apps, que não têm o token.
 */
export function createApiAdapter<Paths extends {}>(http: Http.Client): Client<Paths> {
  return createAdapter<Paths>({ baseUrl: `${http.baseURL}/srd`, token: () => http.auth.token });
}
