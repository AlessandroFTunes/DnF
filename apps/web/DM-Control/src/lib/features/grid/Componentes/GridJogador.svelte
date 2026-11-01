<script lang="ts">
	import { grid as buscarGrid } from '../api.remote';
	import GridCanvas from './GridCanvas.svelte';

	let { id }: { id: string } = $props();

	const dados = $derived(buscarGrid(id));
</script>

<div class="tela">
	{#if dados.error}
		<p role="alert">Não foi possível carregar a grid.</p>
	{:else if !dados.current}
		<p>Carregando…</p>
	{:else if 'failure' in dados.current}
		<p role="alert">{dados.current.failure}</p>
	{:else}
		<!-- A cena inicial vem do banco; depois o mestre manda cada alteração pelo canal. -->
		<GridCanvas
			image={dados.current.image}
			scene={dados.current.scene}
			role="player"
			canal={`dnf-grid-${dados.current.id}`}
		/>
	{/if}
</div>

<style>
	.tela {
		position: fixed;
		inset: 0;
		background: #0b0b10;
		color: rgb(255 255 255 / 0.6);
		font-family: var(--font-body);
	}

	p {
		margin: 2rem;
	}
</style>
