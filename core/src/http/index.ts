/**
 * Cliente da API do DnF (`core/src/api`): é por aqui que o app e o DM-Control falam com o servidor. Os módulos
 * (`User`, `Character`, `Mesa`, `Grid`) só chamam `Http.client().request(...)`; quem guarda o token é o `AuthStore`.
 * Não importa nada do Node: o app (React Native) usa este arquivo.
 */
type Builtins = { 'node:async_hooks': typeof import('node:async_hooks') };

/** `node:async_hooks` só é pego na hora de usar, sem `import`, para o bundler do Expo não tentar resolvê-lo. */
function node<K extends keyof Builtins>(id: K): Builtins[K] | undefined {
  const load = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process?.getBuiltinModule;
  return load?.(id) as Builtins[K] | undefined;
}

export namespace Http {
  /** Armazenamento seguro do dispositivo (Keychain/Keystore no mobile). Implementado por cada app. */
  export interface Storage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }

  /** Erro devolvido pelo servidor. `status` 0 é falha de rede (servidor fora do ar ou sem internet). */
  export class ApiError extends Error {
    constructor(
      readonly status: number,
      message: string,
      /** Erros por campo (ex.: `email: { code: 'validation_not_unique', message }`). */
      readonly fields: Record<string, { code: string; message: string }> = {},
    ) {
      super(message);
      this.name = 'ApiError';
    }
  }

  const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  /** Lê `id` e `exp` (segundos) do token, sem conferir a assinatura (quem confere é o servidor). */
  export function tokenPayload(token: string): { id: string; exp: number } | null {
    const part = token.split('.')[1];
    if (!part) return null;
    try {
      let bits = 0;
      let value = 0;
      const bytes: number[] = [];
      for (const char of part) {
        const index = BASE64URL.indexOf(char);
        if (index < 0) return null;
        value = (value << 6) | index;
        bits += 6;
        if (bits >= 8) {
          bits -= 8;
          bytes.push((value >> bits) & 0xff);
        }
      }
      const json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes))) as { id?: unknown; exp?: unknown };
      return typeof json.id === 'string' && typeof json.exp === 'number' ? { id: json.id, exp: json.exp } : null;
    } catch {
      return null;
    }
  }

  const TOKEN_KEY = 'dnf.session.token';

  /**
   * O login atual: o token e o registro do usuário. Persiste SOMENTE o token (o Keychain pode rejeitar valores
   * grandes e não precisa guardar o perfil): o registro fica em memória e volta no `refresh`.
   */
  export class AuthStore<R = unknown> {
    token = '';
    record: R | null = null;
    private readonly listeners = new Set<() => void>();

    constructor(private readonly storage?: Storage) {}

    get isValid(): boolean {
      const payload = this.token ? tokenPayload(this.token) : null;
      return !!payload && payload.exp * 1000 > Date.now();
    }

    save(token: string, record: R | null = null) {
      this.token = token;
      this.record = record;
      this.storage?.setItem(TOKEN_KEY, token).catch(reportStorageError);
      this.listeners.forEach((listener) => listener());
    }

    clear() {
      this.token = '';
      this.record = null;
      this.storage?.removeItem(TOKEN_KEY).catch(reportStorageError);
      this.listeners.forEach((listener) => listener());
    }

    /** Carrega o token salvo para a memória, sem validar com o servidor. */
    async load() {
      const token = await this.storage?.getItem(TOKEN_KEY);
      if (token) this.save(token);
    }

    /** Avisa a cada login, logout ou renovação. Devolve a função que para de ouvir. */
    onChange(listener: () => void): () => void {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
  }

  function reportStorageError(error: unknown) {
    console.warn('[session] falha ao acessar o armazenamento seguro', error);
  }

  export interface Request {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    query?: Record<string, string | number | undefined>;
    /** Objeto (vai como JSON) ou `FormData` (upload). */
    body?: unknown;
  }

  export interface Client {
    readonly baseURL: string;
    readonly auth: AuthStore;
    /** Endereço completo de um caminho da API (para imagens, `EventSource`…). */
    url(path: string, query?: Request['query']): string;
    request<T>(path: string, init?: Request): Promise<T>;
  }

  export interface Options {
    url: string;
    auth?: AuthStore;
    /** Web na mesma origem da API: o token vive num cookie httpOnly que o servidor define (`X-DNF-Cookie`). */
    cookie?: boolean;
  }

  export function createClient({ url, auth = new AuthStore(), cookie = false }: Options): Client {
    const baseURL = url.replace(/\/+$/, '');
    const build = (path: string, query?: Request['query']) => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined) search.set(key, String(value));
      const text = search.toString();
      return `${baseURL}${path}${text ? `?${text}` : ''}`;
    };

    return {
      baseURL,
      auth,
      url: build,
      async request<T>(path: string, { method = 'GET', query, body }: Request = {}): Promise<T> {
        const headers: Record<string, string> = {};
        if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
        if (cookie) headers['X-DNF-Cookie'] = '1';
        const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
        if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

        let response: Response;
        try {
          response = await fetch(build(path, query), {
            method,
            headers,
            body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
            credentials: cookie ? 'include' : 'same-origin',
          });
        } catch {
          throw new ApiError(0, 'Sem conexão com o servidor.');
        }

        if (response.status === 204) return undefined as T;
        const data = (await response.json().catch(() => null)) as
          | (T & { message?: string; fields?: Record<string, { code: string; message: string }> })
          | null;
        if (!response.ok) throw new ApiError(response.status, data?.message ?? response.statusText, data?.fields);
        return data as T;
      },
    };
  }

  let current: Client | undefined;
  let scoped: import('node:async_hooks').AsyncLocalStorage<Client> | undefined;

  /** Configura o cliente compartilhado. O app chama ao iniciar (com o `AuthStore` do Keychain). */
  export function init(options: Options): Client {
    return (current = createClient(options));
  }

  /** O cliente da requisição em andamento (ver `scope`) ou, no app, o compartilhado. */
  export function client(): Client {
    const found = scoped?.getStore() ?? current;
    if (!found) throw new Error('Http não configurado: chame Http.init({ url }).');
    return found;
  }

  /**
   * No servidor do DM-Control, cada requisição tem o login do seu usuário: dentro de `scope`, `Http.client()`
   * devolve o cliente dela (e não o compartilhado), mesmo com várias requisições ao mesmo tempo.
   */
  export function scope<T>(request: Client, run: () => T): T {
    scoped ??= new (node('node:async_hooks')!.AsyncLocalStorage)<Client>();
    return scoped.run(request, run);
  }
}
