import { command, form, getRequestEvent, query } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { Grid } from '@dnf/core/grid';
import { Mesa } from '@dnf/core/mesa';
import { Nas } from '@dnf/core/storage';

const MAP_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

type Falha = { failure: string };

/** Grid do mestre: a API só devolve se a mesa é dele (404 também cobre "sem permissão"). */
async function acharGrid(id: string) {
	const { locals } = getRequestEvent();
	if (!locals.user) return null;
	return Grid.fromID.force(id);
}

/** As grids de uma mesa (só o mestre acessa). */
export const grids = query('unchecked', async (mesaId: string) => {
	const { locals } = getRequestEvent();
	if (!locals.user) return { failure: 'Entre para ver as grids.' } as Falha;

	// 404 aqui é só da mesa (a API também esconde a mesa de quem não tem acesso).
	let mesa;
	try {
		mesa = await Mesa.fromID.force(mesaId);
	} catch (failure) {
		console.error('[grid] mesa', failure);
		return { failure: 'Não foi possível carregar a mesa. Tente de novo.' } as Falha;
	}
	if (!mesa) return { failure: 'Mesa não encontrada.' } as Falha;
	if (mesa.gmID !== locals.user.id) return { failure: 'Só o mestre acessa as grids.' } as Falha;

	try {
		const lista = await Grid.list.force(mesaId);
		return {
			mesa: { id: mesa.id, name: mesa.name },
			grids: lista.map((grid) => ({ ...grid, image: `/nas/${grid.url}` }))
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
		return {
			...record,
			image: `/nas/${record.url}`,
			scene: await Grid.scene.force(id)
		} as const;
	} catch (failure) {
		console.error('[grid] grid', failure);
		return { failure: 'Não foi possível carregar a grid. Tente de novo.' } as Falha;
	}
});

/** Cria a grid: guarda a imagem no NAS e o registro (nome, url, mesa) na API. */
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

		const mesa = await Mesa.fromID.force(data.mesaId).catch(() => null);
		if (!mesa || mesa.gmID !== locals.user.id) invalid(issue.name('Só o mestre cria grids.'));

		const url = `${mesa.id}/mapas/${Date.now()}.${Nas.extensionOf(image.type)}`;
		try {
			await Nas.save({ url, file: image });
		} catch (failure) {
			console.error('[grid] imagem', failure);
			invalid(issue.image('Não foi possível guardar a imagem. Tente de novo.'));
		}

		try {
			const record = await Grid.create.force({ mesaID: mesa.id, name: parsed.data!.name, url });
			return { ok: true, id: record.id } as const;
		} catch (failure) {
			console.error('[grid] criarGrid', failure);
			await Nas.remove(url).catch(() => {});
			invalid(issue.name('Não foi possível criar a grid. Tente de novo.'));
		}
	}
);

/** Apaga a grid, a cena (cascata do banco) e a imagem do NAS. */
export const excluirGrid = command('unchecked', async (id: string) => {
	const record = await acharGrid(id);
	if (!record) return { failure: 'Grid não encontrada.' } as Falha;
	try {
		await Grid.remove.force(id);
	} catch (failure) {
		console.error('[grid] excluirGrid', failure);
		return { failure: 'Não foi possível excluir a grid.' } as Falha;
	}
	await Nas.remove(record.url).catch(() => {});
	return { ok: true } as const;
});

/** Muda o nome da grid. */
export const renomearGrid = command('unchecked', async (data: { id: string; name: string }) => {
	const parsed = Grid.Info.pick({ name: true }).safeParse({ name: data.name });
	if (!parsed.success) return { failure: 'Informe o nome da grid (até 64 letras).' } as Falha;
	if (!(await acharGrid(data.id))) return { failure: 'Grid não encontrada.' } as Falha;
	try {
		await Grid.update.force({ id: data.id, name: parsed.data.name });
		return { ok: true } as const;
	} catch (failure) {
		console.error('[grid] renomearGrid', failure);
		return { failure: 'Não foi possível renomear a grid.' } as Falha;
	}
});

/** Grava a cena inteira (posições, desenhos, paredes, luzes, fog) no JSON da grid. */
export const salvarCena = command('unchecked', async (data: { id: string; scene: unknown }) => {
	const parsed = Grid.Scene.safeParse(data.scene);
	if (!parsed.success) return { failure: 'A cena tem dados inválidos.' } as Falha;
	if (!(await acharGrid(data.id))) return { failure: 'Grid não encontrada.' } as Falha;

	try {
		// A API grava a cena e, de quebra, sobe a grid na lista (a ordem é pela mais recente).
		await Grid.saveScene.force({ gridID: data.id, scene: parsed.data });
		return { ok: true } as const;
	} catch (failure) {
		console.error('[grid] salvarCena', failure);
		return { failure: 'Não foi possível salvar a cena.' } as Falha;
	}
});
