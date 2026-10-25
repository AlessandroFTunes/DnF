import type { Handle } from '@sveltejs/kit/hooks';
import { POCKETBASE_URL } from '$app/env/private';
import { createAdapter, PocketBase } from '@dnf/core/pocketbase';
import { User } from '@dnf/core/user';

// User.serialize monta a URL do avatar com o cliente compartilhado (sem login: só gera a URL).
PocketBase.init(POCKETBASE_URL);

const COOKIE = 'pb_auth';

export const handle: Handle = async ({ event, resolve }) => {
	// Um cliente por requisição: o authStore é o do usuário que fez o pedido.
	const pb = createAdapter(POCKETBASE_URL);
	pb.authStore.loadFromCookie(event.request.headers.get('cookie') ?? '', COOKIE);

	if (pb.authStore.isValid) {
		try {
			await pb.collection('users').authRefresh();
		} catch {
			pb.authStore.clear();
		}
	}

	event.locals.pb = pb;
	event.locals.user = pb.authStore.record ? User.serialize(pb.authStore.record) : undefined;

	const response = await resolve(event);
	response.headers.append(
		'set-cookie',
		pb.authStore.exportToCookie(
			{ httpOnly: true, secure: event.url.protocol === 'https:', sameSite: 'Lax' },
			COOKIE
		)
	);
	return response;
};
