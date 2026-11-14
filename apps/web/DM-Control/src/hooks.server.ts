import type { Handle } from '@sveltejs/kit/hooks';
import { API_URL } from '$app/env/private';
import { Http } from '@dnf/core/http';
import { User } from '@dnf/core/user';

const COOKIE = 'dnf_auth';

// O token da API dura 30 dias. Renova quando faltam menos de 15, então quem usa o DM-Control de vez em quando nunca
// é deslogado. Token vencido não renova: pede login.
const REFRESH_WHEN_LEFT_MS = 15 * 24 * 60 * 60 * 1000;
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const handle: Handle = async ({ event, resolve }) => {
	// Um cliente por requisição, com o token do cookie: dentro do `Http.scope`, o `Http.client()` dos módulos do core
	// (`Mesa`, `Grid`, `User`…) é o desta pessoa, mesmo com várias requisições ao mesmo tempo.
	const auth = new Http.AuthStore<User.Info>();
	const client = Http.createClient({ url: API_URL, auth });
	const token = event.cookies.get(COOKIE);
	if (token) auth.save(token);

	return Http.scope(client, async () => {
		if (auth.isValid) {
			try {
				const { id, exp } = Http.tokenPayload(auth.token)!;
				if (exp * 1000 - Date.now() < REFRESH_WHEN_LEFT_MS) await User.refresh();
				else auth.save(auth.token, await client.request<User.Info>(`/users/${id}`));
			} catch {
				auth.clear();
			}
		} else {
			auth.clear();
		}
		event.locals.user = auth.record ?? undefined;

		const response = await resolve(event);
		// Depois do `resolve` o SvelteKit não deixa mais mexer em `event.cookies`: o cookie vai direto no cabeçalho.
		const attrs = `Path=/; HttpOnly; SameSite=Lax${event.url.protocol === 'https:' ? '; Secure' : ''}`;
		response.headers.append(
			'set-cookie',
			auth.token && auth.isValid
				? `${COOKIE}=${auth.token}; ${attrs}; Max-Age=${MAX_AGE_SECONDS}`
				: `${COOKIE}=; ${attrs}; Max-Age=0`
		);
		return response;
	});
};
