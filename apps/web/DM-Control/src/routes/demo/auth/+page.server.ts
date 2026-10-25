import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	if (!event.locals.user) {
		return redirect(302, '/demo/auth/login');
	}
	return { user: event.locals.user };
};

export const actions: Actions = {
	signOut: async (event) => {
		event.locals.pb.authStore.clear();
		return redirect(302, '/demo/auth/login');
	}
};
