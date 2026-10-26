import { form, getRequestEvent, query } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { Mesa } from '@dnf/core/mesa';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Nome da pessoa logada e as mesas que ela mestra ou joga (o PocketBase filtra pelas API rules). */
export const inicio = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.user) return { failure: 'Entre para ver suas mesas.' } as const;

	try {
		// Cliente da requisição: o compartilhado do `core` não tem o login desta pessoa.
		const result = await locals.pb.collection('mesas').getList(1, 50, { sort: '-updated' });
		// `image` não faz parte do `Mesa.Info` do core: aqui vira a URL do arquivo (ou null).
		const mesas = result.items.map((record) => ({
			...Mesa.serialize(record),
			image: record.image ? locals.pb.files.getURL(record, record.image) : null
		}));
		return { name: locals.user.name, mesas } as const;
	} catch (failure) {
		console.error('[inicio]', failure);
		return { failure: 'Não foi possível carregar suas mesas. Tente de novo.' } as const;
	}
});

export const criarMesa = form(
	'unchecked',
	async (data: { name: string; description?: string; edition: string; image?: File }, issue) => {
		const parsed = Mesa.Info.pick({ name: true, description: true, edition: true }).safeParse({
			...data,
			description: data.description ?? ''
		});
		if (!parsed.success) {
			const field = parsed.error.issues[0]?.path[0];
			if (field === 'edition') invalid(issue.edition('Escolha a edição das regras.'));
			if (field === 'description') invalid(issue.description('A descrição é longa demais.'));
			invalid(issue.name('Informe o nome da mesa (até 64 letras).'));
		}

		const image = data.image instanceof File && data.image.size > 0 ? data.image : undefined;
		if (image && !IMAGE_TYPES.includes(image.type))
			invalid(issue.image('Use uma imagem JPG, PNG ou WebP.'));
		if (image && image.size > IMAGE_MAX_BYTES) invalid(issue.image('A imagem pode ter até 5 MB.'));

		const { locals } = getRequestEvent();
		if (!locals.user) invalid(issue.name('Entre para criar uma mesa.'));

		try {
			// Cliente da requisição: o PocketBase confere pelo login quem é o mestre.
			const body = new FormData();
			body.set('name', parsed.data.name);
			body.set('description', parsed.data.description);
			body.set('edition', parsed.data.edition);
			body.set('gm', locals.user.id);
			if (image) body.set('image', image);
			await locals.pb.collection('mesas').create(body);
		} catch (failure) {
			console.error('[inicio] criarMesa', failure);
			invalid(issue.name('Não foi possível criar a mesa. Tente de novo.'));
		}

		return { ok: true } as const;
	}
);
