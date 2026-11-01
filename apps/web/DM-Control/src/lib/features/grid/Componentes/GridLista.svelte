<script lang="ts">
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash from '@lucide/svelte/icons/trash';
	import { excluirGrid, grids as buscarGrids } from '../api.remote';
	import GridNova from './GridNova.svelte';

	let { id }: { id: string } = $props();

	const dados = $derived(buscarGrids(id));
	let nova = $state<ReturnType<typeof GridNova>>();
	let falha = $state<string>();

	async function excluir(gridId: string, nome: string) {
		if (!confirm(`Excluir “${nome}”? O mapa e tudo o que está nele serão apagados.`)) return;
		falha = undefined;
		try {
			const resultado = await excluirGrid(gridId);
			if ('failure' in resultado) falha = resultado.failure;
			else void buscarGrids(id).refresh();
		} catch {
			falha = 'Não foi possível excluir a grid. Tente de novo.';
		}
	}
</script>

{#if dados.error}
	<p class="aviso" role="alert">Não foi possível carregar os mapas. Tente de novo.</p>
{:else if !dados.current}
	<p class="aviso">Carregando…</p>
{:else if 'failure' in dados.current}
	<p class="aviso" role="alert">{dados.current.failure}</p>
{:else}
	{@const d = dados.current}
	<header>
		<div>
			<h1>Mapas de combate</h1>
			<p class="mesa">{d.mesa.name}</p>
		</div>
		{#if d.grids.length > 0}
			<button type="button" class="novo" onclick={() => nova?.abrir()}>
				<Plus size={18} aria-hidden="true" /> Nova grid
			</button>
		{/if}
	</header>

	{#if falha}<p class="aviso" role="alert">{falha}</p>{/if}

	{#if d.grids.length === 0}
		<div class="vazio">
			<p>Esta mesa ainda não tem nenhum mapa de combate.</p>
			<button type="button" class="novo" onclick={() => nova?.abrir()}>
				<Plus size={18} aria-hidden="true" /> Crie seu primeiro grid
			</button>
		</div>
	{:else}
		<ul>
			{#each d.grids as g (g.id)}
				<li>
					<a class="capa" href={resolve('/mesa/[id]/mapas/[gridId]', { id, gridId: g.id })}>
						<img src={g.image} alt="" loading="lazy" />
					</a>
					<div class="info">
						<strong>{g.name}</strong>
						<div class="acoes">
							<a href={resolve('/mesa/[id]/mapas/[gridId]', { id, gridId: g.id })}>Abrir</a>
							<button
								type="button"
								class="lixo"
								aria-label="Excluir {g.name}"
								onclick={() => excluir(g.id, g.name)}
							>
								<Trash size={16} aria-hidden="true" />
							</button>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	<GridNova bind:this={nova} mesaId={id} />
{/if}

<style>
	header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.7rem, 3vw, 2.4rem);
		font-weight: 700;
		letter-spacing: -0.03em;
		text-align: left;
	}

	.mesa {
		margin: 0.2rem 0 0;
		color: rgb(255 255 255 / 0.6);
	}

	.novo {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.7rem 1.3rem;
		border: 0;
		border-radius: 999px;
		background: var(--gold);
		color: var(--on-gold);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
		gap: 1.2rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		overflow: hidden;
		border-radius: 1.2rem;
		background: #14101f;
	}

	.capa {
		display: block;
		aspect-ratio: 16 / 10;
		background: #0b0b10;
	}

	.capa img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.info {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.9rem 1rem;
	}

	.acoes {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.acoes a {
		color: var(--gold);
		font-weight: 700;
		text-decoration: none;
	}

	.lixo {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: 0;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--danger);
		cursor: pointer;
	}

	.lixo:hover {
		background: rgb(255 138 138 / 0.12);
	}

	.vazio {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 4rem 1rem;
		border: 1px dashed rgb(255 255 255 / 0.2);
		border-radius: 1.4rem;
		text-align: center;
		color: rgb(255 255 255 / 0.7);
	}

	.vazio p {
		margin: 0;
	}

	.aviso {
		color: rgb(255 255 255 / 0.6);
	}

	.aviso[role='alert'] {
		color: var(--danger);
	}
</style>
