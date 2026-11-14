<script lang="ts">
	import EstadoCarga from '../../../components/EstadoCarga.svelte';
	import { grid as buscarGrid } from '../api.remote';
	import GridEditorCorpo from './GridEditorCorpo.svelte';

	let { id }: { id: string } = $props();

	const dados = $derived(buscarGrid(id));
</script>

<EstadoCarga {dados} erro="Não foi possível carregar a grid. Tente de novo." style="margin: 2rem">
	{#snippet children(grid)}
		<GridEditorCorpo {grid} />
	{/snippet}
</EstadoCarga>

<style>
</style>
