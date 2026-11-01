<script lang="ts">
	import { grid as buscarGrid } from '../api.remote';
	import GridEditorCorpo from './GridEditorCorpo.svelte';

	let { id }: { id: string } = $props();

	const dados = $derived(buscarGrid(id));
</script>

{#if dados.error}
	<p class="aviso" role="alert">Não foi possível carregar a grid. Tente de novo.</p>
{:else if !dados.current}
	<p class="aviso">Carregando…</p>
{:else if 'failure' in dados.current}
	<p class="aviso" role="alert">{dados.current.failure}</p>
{:else}
	<GridEditorCorpo grid={dados.current} />
{/if}

<style>
	.aviso {
		margin: 2rem;
		color: rgb(255 255 255 / 0.6);
	}

	.aviso[role='alert'] {
		color: var(--danger);
	}
</style>
