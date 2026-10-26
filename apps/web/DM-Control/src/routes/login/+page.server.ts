import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Quem já está logado não precisa ver o login.
export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(302, '/inicio');
};
