import { redirect } from '@sveltejs/kit';
import { User } from '@dnf/core/user';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	if (!event.locals.user) {
		return redirect(302, '/demo/auth/login');
	}
	return { user: event.locals.user };
};

export const actions: Actions = {
	signOut: async (event) => {
		await User.logout();
		return redirect(302, '/demo/auth/login');
	}
};
