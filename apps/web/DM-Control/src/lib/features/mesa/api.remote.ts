import { form, getRequestEvent, query } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { Mesa } from '@dnf/core/mesa';
import { Nas } from '@dnf/core/storage';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Uma mesa da pessoa logada (o PocketBase só devolve se ela é a mestra ou joga nela) e seus players. */
export const mesa = query('unchecked', async (id: string) => {
	const { locals } = getRequestEvent();
	if (!locals.user) return { failure: 'Entre para ver esta mesa.' } as const;

	try {
		const record = await locals.pb.collection('mesas').getOne(id);
		// Mestre vê todos; jogador, só a própria entrada (regra do PocketBase).
		const membros = await locals.pb.collection('mesa_members').getFullList({
			filter: locals.pb.filter('mesa = {:id}', { id }),
			expand: 'character,user',
			sort: 'created,id'
		});
		const players = membros.map((membro) => ({
			id: membro.id,
			jogador: (membro.expand?.user?.name as string | undefined) ?? 'Jogador',
			personagem: (membro.expand?.character?.name as string | undefined) ?? 'Sem personagem',
			nivel: (membro.expand?.character?.level as number | undefined) ?? null
		}));
		return {
			...Mesa.serialize(record),
			image: record.cover ? `/nas/${record.cover}` : null,
			players
		} as const;
	} catch (failure) {
		// 404 do PocketBase também cobre "sem permissão": para quem pede, a mesa não existe.
		if ((failure as { status?: number }).status === 404)
			return { failure: 'Mesa não encontrada.' } as const;
		console.error('[mesa]', failure);
		return { failure: 'Não foi possível carregar a mesa. Tente de novo.' } as const;
	}
});

/** Muda imagem, título e descrição. Só o mestre consegue (updateRule do PocketBase). */
export const editarMesa = form(
	'unchecked',
	async (data: { id: string; name: string; description?: string; image?: File }, issue) => {
		const parsed = Mesa.Info.pick({ id: true, name: true, description: true }).safeParse({
			...data,
			description: data.description ?? ''
		});
		if (!parsed.success) {
			const field = parsed.error.issues[0]?.path[0];
			if (field === 'description') invalid(issue.description('A descrição é longa demais.'));
			invalid(issue.name('Informe o nome da mesa (até 64 letras).'));
		}

		const image = data.image instanceof File && data.image.size > 0 ? data.image : undefined;
		if (image && !IMAGE_TYPES.includes(image.type))
			invalid(issue.image('Use uma imagem JPG, PNG ou WebP.'));
		if (image && image.size > Nas.MAX_BYTES) invalid(issue.image('A imagem pode ter até 30 MB.'));

		const { locals } = getRequestEvent();
		if (!locals.user) invalid(issue.name('Entre para editar a mesa.'));

		const { id, ...patch } = parsed.data;
		let atual: { cover?: string } | undefined;
		try {
			atual = await locals.pb.collection('mesas').getOne(id);
		} catch {
			invalid(issue.name('Mesa não encontrada.'));
		}

		// Nome novo a cada troca: o navegador guarda a imagem em cache pelo caminho.
		let cover: string | undefined;
		if (image) {
			cover = `${id}/imagens/capa-${Date.now()}.${Nas.extensionOf(image.type)}`;
			try {
				await Mesa.adicionarCapa(cover, image);
			} catch (failure) {
				console.error('[mesa] capa', failure);
				invalid(issue.image('Não foi possível guardar a imagem. Tente de novo.'));
			}
		}

		try {
			await locals.pb.collection('mesas').update(id, cover ? { ...patch, cover } : patch);
		} catch (failure) {
			console.error('[mesa] editarMesa', failure);
			if (cover) await Nas.remove(cover);
			invalid(issue.name('Não foi possível salvar. Só o mestre pode editar a mesa.'));
		}

		if (cover && atual?.cover) await Nas.remove(atual.cover).catch(() => {});
		return { ok: true } as const;
	}
);
