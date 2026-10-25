import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	POCKETBASE_URL: { description: 'The PocketBase URL, e.g. `https://dnf-db.developale.com`.' },
	ORIGIN: {
		description: 'The app origin (base URL), e.g. `http://localhost:5173`.'
	}
});
