import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Só para quem entrou.
export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
};
