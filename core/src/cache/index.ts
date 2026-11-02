/**
 * Cache de consultas em três camadas: memória (mesma sessão), `Store` (aberturas seguintes) e só então a origem
 * (rede). Quem usa escolhe o `Store`: o app implementa com arquivos no celular e localStorage na web.
 */
export namespace Cache {
  /** Port: onde guardar entre aberturas do app. Nunca lança: falha vira `undefined` (busca de novo). */
  export interface Store {
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, data: T): Promise<void>;
    clear(): Promise<void>;
  }

  /**
   * `version` é a versão dos *dados*: quando muda, o `store` é apagado inteiro na primeira consulta, para não
   * ler um formato antigo.
   */
  export function create(store: Store, version: number) {
    const ready = store.get<number>('meta:version').then(async (stored) => {
      if (stored === version) return;
      await store.clear();
      await store.set('meta:version', version);
    });
    const memory = new Map<string, Promise<unknown>>();

    /**
     * Lê do `store`; se não tiver, busca com `load` e guarda. Sem memória: para quem já tem o seu próprio
     * cache em memória (ex.: o TanStack Query do app).
     */
    function stored<T>(key: string, load: () => Promise<T>): Promise<T> {
      return ready.then(async () => {
        const saved = await store.get<T>(key);
        if (saved !== undefined) return saved;
        const data = await load();
        void store.set(key, data);
        return data;
      });
    }

    /** Cada `key` é buscada uma vez só; o que vem de `load` é guardado no `store`. */
    function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
      let promise = memory.get(key) as Promise<T> | undefined;
      if (!promise) {
        promise = stored(key, load);
        memory.set(key, promise);
        promise.catch(() => memory.delete(key)); // falhou: a próxima tentativa busca de novo
      }
      return promise;
    }

    /** Carrega `loads` de uma vez. Nunca falha e nunca passa de `timeoutMs`: o que não chegar é buscado depois. */
    function prefetch(loads: Record<string, () => Promise<unknown>>, timeoutMs: number): Promise<void> {
      const all = Promise.allSettled(Object.entries(loads).map(([key, load]) => cached(key, load)));
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
      return Promise.race([all.then(() => undefined), timeout]);
    }

    /** Apaga memória e `store`: a próxima consulta busca tudo de novo. */
    async function clear() {
      memory.clear();
      await store.clear();
    }

    return { cached, stored, prefetch, clear };
  }
}
