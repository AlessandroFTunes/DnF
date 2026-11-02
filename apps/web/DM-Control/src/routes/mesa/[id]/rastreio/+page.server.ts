import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Só para quem entrou; a calibração roda toda no navegador.
export const load: PageServerLoad = ({ locals, params }) => {
	if (!locals.user) redirect(302, '/login');
	return { id: params.id };
};
