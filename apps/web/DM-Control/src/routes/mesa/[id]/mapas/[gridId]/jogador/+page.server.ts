import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Só para quem entrou; os dados vêm das remote functions.
export const load: PageServerLoad = ({ locals, params }) => {
	if (!locals.user) redirect(302, '/login');
	return { id: params.id, gridId: params.gridId };
};
