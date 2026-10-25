import { getTokenPayload } from 'pocketbase';
import type { Handle } from '@sveltejs/kit/hooks';
import { POCKETBASE_URL } from '$app/env/private';
import { createAdapter, PocketBase } from '@dnf/core/pocketbase';
import { User } from '@dnf/core/user';

// User.serialize monta a URL do avatar com o cliente compartilhado (sem login: só gera a URL).
PocketBase.init(POCKETBASE_URL);

const COOKIE = 'pb_auth';

// O token do PocketBase dura 15 min (users > Options > Token duration, no Dashboard).
// Renova quando falta menos de 10 min, então quem navega nunca é deslogado e o
// PocketBase só é consultado a cada ~5 min. Token vencido não renova: pede login.
const REFRESH_WHEN_LEFT_MS = 10 * 60 * 1000;

function msLeft(token: string): number {
	return getTokenPayload(token).exp * 1000 - Date.now();
}

export const handle: Handle = async ({ event, resolve }) => {
	// Um cliente por requisição: o authStore é o do usuário que fez o pedido.
	const pb = createAdapter(POCKETBASE_URL);
	pb.authStore.loadFromCookie(event.request.headers.get('cookie') ?? '', COOKIE);

	if (pb.authStore.isValid) {
		try {
			if (msLeft(pb.authStore.token) < REFRESH_WHEN_LEFT_MS) {
				await pb.collection('users').authRefresh();
			}
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
