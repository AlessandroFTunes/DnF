import { command, form, getRequestEvent, query } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { Grid } from '@dnf/core/grid';
import { Nas } from '@dnf/core/storage';

const MAP_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

type Falha = { failure: string };

/** Grid do mestre: o PocketBase só devolve se a mesa é dele (404 também cobre "sem permissão"). */
async function acharGrid(id: string) {
	const { locals } = getRequestEvent();
	if (!locals.user) return null;
	return locals.pb
		.collection('grids')
		.getOne(id)
		.catch((failure) => {
			if ((failure as { status?: number }).status === 404) return null;
			throw failure;
		});
}

/** As grids de uma mesa (só o mestre acessa). */
export const grids = query('unchecked', async (mesaId: string) => {
	const { locals } = getRequestEvent();
	if (!locals.user) return { failure: 'Entre para ver as grids.' } as Falha;

	// 404 aqui é só da mesa (o PocketBase também esconde a mesa de quem não tem acesso).
	const mesa = await locals.pb
		.collection('mesas')
		.getOne(mesaId)
		.catch((failure) => {
			if ((failure as { status?: number }).status === 404) return null;
			throw failure;
		})
		.catch((failure) => {
			console.error('[grid] mesa', failure);
			return undefined;
		});
	if (mesa === null) return { failure: 'Mesa não encontrada.' } as Falha;
	if (mesa === undefined)
		return { failure: 'Não foi possível carregar a mesa. Tente de novo.' } as Falha;
	if (mesa.gm !== locals.user.id) return { failure: 'Só o mestre acessa as grids.' } as Falha;

	try {
		const records = await locals.pb.collection('grids').getFullList({
			filter: locals.pb.filter('mesa = {:mesaId}', { mesaId }),
			sort: '-updated,id'
		});
		return {
			mesa: { id: mesa.id as string, name: mesa.name as string },
			grids: records.map((record) => ({ ...Grid.serialize(record), image: `/nas/${record.url}` }))
		} as const;
	} catch (failure) {
		console.error('[grid] grids', failure);
		return { failure: 'Não foi possível carregar as grids. Tente de novo.' } as Falha;
	}
});

/** Uma grid com a imagem e a cena (o JSON), pronta para o canvas. */
export const grid = query('unchecked', async (id: string) => {
	const { locals } = getRequestEvent();
	if (!locals.user) return { failure: 'Entre para ver a grid.' } as Falha;

	try {
		const record = await acharGrid(id);
		if (!record) return { failure: 'Grid não encontrada.' } as Falha;
		const cena = await locals.pb
			.collection('grid_scenes')
			.getFirstListItem(locals.pb.filter('grid = {:id}', { id }))
			.catch((failure) => {
				if ((failure as { status?: number }).status === 404) return null;
				throw failure;
			});
		return {
			...Grid.serialize(record),
			image: `/nas/${record.url}`,
			scene: Grid.parseScene(cena?.data)
		} as const;
	} catch (failure) {
		console.error('[grid] grid', failure);
		return { failure: 'Não foi possível carregar a grid. Tente de novo.' } as Falha;
	}
});

/** Cria a grid: guarda a imagem no NAS e o registro (nome, url, mesa) no PocketBase. */
export const criarGrid = form(
	'unchecked',
	async (data: { mesaId: string; name: string; image?: File }, issue) => {
		const parsed = Grid.Info.pick({ name: true }).safeParse({ name: data.name });
		if (!parsed.success) invalid(issue.name('Informe o nome da grid (até 64 letras).'));

		const image = data.image instanceof File && data.image.size > 0 ? data.image : undefined;
		if (!image) invalid(issue.image('Escolha a imagem do mapa.'));
		if (!MAP_TYPES.includes(image.type)) invalid(issue.image('Use uma imagem PNG, JPG, WebP ou GIF.'));
		if (image.size > Nas.MAX_BYTES) invalid(issue.image('A imagem pode ter até 30 MB.'));

		const { locals } = getRequestEvent();
		if (!locals.user) invalid(issue.name('Entre para criar a grid.'));

		const mesa = await locals.pb
			.collection('mesas')
			.getOne(data.mesaId)
			.catch(() => null);
		if (!mesa || mesa.gm !== locals.user.id) invalid(issue.name('Só o mestre cria grids.'));

		const url = `${mesa.id}/mapas/${Date.now()}.${Nas.extensionOf(image.type)}`;
		try {
			await Nas.save({ url, file: image });
		} catch (failure) {
			console.error('[grid] imagem', failure);
			invalid(issue.image('Não foi possível guardar a imagem. Tente de novo.'));
		}

		try {
			const record = await locals.pb
				.collection('grids')
				.create({ mesa: mesa.id, name: parsed.data!.name, url });
			return { ok: true, id: record.id as string } as const;
		} catch (failure) {
			console.error('[grid] criarGrid', failure);
			await Nas.remove(url).catch(() => {});
			invalid(issue.name('Não foi possível criar a grid. Tente de novo.'));
		}
	}
);

/** Apaga a grid, a cena (cascata do PocketBase) e a imagem do NAS. */
export const excluirGrid = command('unchecked', async (id: string) => {
	const { locals } = getRequestEvent();
	const record = await acharGrid(id);
	if (!record) return { failure: 'Grid não encontrada.' } as Falha;
	try {
		await locals.pb.collection('grids').delete(id);
	} catch (failure) {
		console.error('[grid] excluirGrid', failure);
		return { failure: 'Não foi possível excluir a grid.' } as Falha;
	}
	await Nas.remove(record.url).catch(() => {});
	return { ok: true } as const;
});

/** Muda o nome da grid. */
export const renomearGrid = command('unchecked', async (data: { id: string; name: string }) => {
	const { locals } = getRequestEvent();
	const parsed = Grid.Info.pick({ name: true }).safeParse({ name: data.name });
	if (!parsed.success) return { failure: 'Informe o nome da grid (até 64 letras).' } as Falha;
	if (!(await acharGrid(data.id))) return { failure: 'Grid não encontrada.' } as Falha;
	try {
		await locals.pb.collection('grids').update(data.id, { name: parsed.data.name });
		return { ok: true } as const;
	} catch (failure) {
		console.error('[grid] renomearGrid', failure);
		return { failure: 'Não foi possível renomear a grid.' } as Falha;
	}
});

/** Grava a cena inteira (posições, desenhos, paredes, luzes, fog) no JSON da grid. */
export const salvarCena = command('unchecked', async (data: { id: string; scene: unknown }) => {
	const { locals } = getRequestEvent();
	const parsed = Grid.Scene.safeParse(data.scene);
	if (!parsed.success) return { failure: 'A cena tem dados inválidos.' } as Falha;
	if (!(await acharGrid(data.id))) return { failure: 'Grid não encontrada.' } as Falha;

	try {
		const atual = await locals.pb
			.collection('grid_scenes')
			.getFirstListItem(locals.pb.filter('grid = {:id}', { id: data.id }))
			.catch((failure) => {
				if ((failure as { status?: number }).status === 404) return null;
				throw failure;
			});
		if (atual) await locals.pb.collection('grid_scenes').update(atual.id, { data: parsed.data });
		else await locals.pb.collection('grid_scenes').create({ grid: data.id, data: parsed.data });
		// Mexer na cena conta como mexer na grid (a lista ordena pela mais recente).
		await locals.pb.collection('grids').update(data.id, {});
		return { ok: true } as const;
	} catch (failure) {
		console.error('[grid] salvarCena', failure);
		return { failure: 'Não foi possível salvar a cena.' } as Falha;
	}
});
