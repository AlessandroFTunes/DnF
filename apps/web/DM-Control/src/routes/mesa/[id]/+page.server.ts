import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Só para quem entrou; os dados da mesa vêm da remote function.
export const load: PageServerLoad = ({ locals, params }) => {
	if (!locals.user) redirect(302, '/login');
	return { id: params.id };
};
