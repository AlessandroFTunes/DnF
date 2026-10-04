import PocketBaseClient, { ClientResponseError, type BaseAuthStore, type SendOptions } from 'pocketbase';
export { ClientResponseError } from 'pocketbase';
export * from './order';

export function createAdapter(url: string, authStore?: BaseAuthStore): PocketBaseClient {
  const client = new PocketBaseClient(url, authStore);
  // Sem isso o SDK cancela requisições repetidas (ex.: duas telas buscando o mesmo registro).
  client.autoCancellation(false);

  const origSend = client.send.bind(client);
  client.send = async <T>(path: string, options: SendOptions): Promise<T> => {
    try {
      return await origSend<T>(path, options);
    } catch (e) {
      if (e instanceof ClientResponseError && !e.isAbort) {
        // status 0 = falha de rede (servidor fora do ar ou sem internet)
        // warn e não error: no React Native, console.error abre a tela vermelha do LogBox.
        console.warn(
          `[db] ${e.status === 0 ? 'sem conexão' : `erro ${e.status}`}: ${e.message} — ${path}`,
          e.response?.data ? JSON.stringify(e.response.data) : '',
        );
      }
      throw e;
    }
  };

  return client;
}

let current: PocketBaseClient | undefined;

//-------------------------------------------------------------------------------------
//abstracoes
export namespace PocketBase {
  /** Configura o cliente compartilhado. O app chama ao iniciar (com o authStore do Keychain). */
  export function init(url: string, authStore?: BaseAuthStore): PocketBaseClient {
    return (current = createAdapter(url, authStore));
  }

  export function use(): PocketBaseClient {
    if (current) return current;
    const url = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env?.POCKETBASE_URL;
    if (!url) throw new Error('PocketBase não configurado: chame PocketBase.init(url) ou defina POCKETBASE_URL.');
    return (current = createAdapter(url));
  }

  /** O mesmo que `use()`, com um nome que o lint de hooks do React não confunde com um hook. */
  export function client(): PocketBaseClient {
    return use();
  }
}
