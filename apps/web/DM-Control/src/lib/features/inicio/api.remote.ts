import { form, getRequestEvent, query } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { Mesa } from '@dnf/core/mesa';
import { Nas } from '@dnf/core/storage';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Nome da pessoa logada e as mesas que ela mestra ou joga (a API só devolve as dela). */
export const inicio = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.user) return { failure: 'Entre para ver suas mesas.' } as const;

	try {
		const result = await Mesa.list.force({ page: 1, pageSize: 50 });
		// A capa é servida por /nas/<caminho>, rota que lê do NAS.
		const mesas = result.data.map((mesa) => ({
			...mesa,
			image: mesa.cover ? `/nas/${mesa.cover}` : null
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
		if (image && image.size > Nas.MAX_BYTES) invalid(issue.image('A imagem pode ter até 30 MB.'));

		const { locals } = getRequestEvent();
		if (!locals.user) invalid(issue.name('Entre para criar uma mesa.'));

		// A mesa nasce primeiro porque a pasta do arquivo leva o id dela: nas/<id da mesa>/imagens/.
		let created;
		try {
			// O mestre é quem está logado (o servidor confere pelo token).
			created = await Mesa.create.force(parsed.data);
		} catch (failure) {
			console.error('[inicio] criarMesa', failure);
			invalid(issue.name('Não foi possível criar a mesa. Tente de novo.'));
		}

		if (image) {
			const cover = `${created.id}/imagens/capa.${Nas.extensionOf(image.type)}`;
			try {
				await Mesa.adicionarCapa(cover, image);
				await Mesa.update.force({ id: created.id, cover });
			} catch (failure) {
				console.error('[inicio] capa', failure);
				// Sem a capa a mesa não fica pela metade: volta ao estado de antes do envio.
				await Nas.remove(cover);
				await Mesa.remove.force(created.id).catch(() => {});
				invalid(issue.image('Não foi possível guardar a imagem. Tente de novo.'));
			}
		}

		return { ok: true, id: created.id } as const;
	}
);
