/**
 * Quem está chamando. O port é um comando só: dado o token da requisição, devolve o usuário ou `null`.
 * Hoje o adapter confere o token no PocketBase (que ainda guarda as contas); quando o login passar para o
 * core, troca-se só o adapter, e as rotas continuam as mesmas.
 */
export interface Port {
  authenticate(token: string): Promise<{ id: string } | null>;
}

/** Adapter do PocketBase: renova o token (`auth-refresh`) só para saber de quem é. Guarda o resultado por 1 min. */
export function pocketBase(url: string, ttlMs = 60_000): Port {
  const base = url.replace(/\/+$/, '');
  const seen = new Map<string, { id: string; until: number }>();
  return {
    async authenticate(token) {
      const hit = seen.get(token);
      if (hit && hit.until > Date.now()) return { id: hit.id };
      const res = await fetch(`${base}/api/collections/users/auth-refresh`, {
        method: 'POST',
        headers: { Authorization: token },
        signal: AbortSignal.timeout(5_000),
      }).catch(() => null);
      if (!res?.ok) return null;
      const id = ((await res.json().catch(() => null)) as { record?: { id?: string } } | null)?.record?.id;
      if (!id) return null;
      if (seen.size >= 1_000) seen.clear();
      seen.set(token, { id, until: Date.now() + ttlMs });
      return { id };
    },
  };
}
