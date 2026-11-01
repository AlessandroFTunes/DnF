<script lang="ts">
	import MesaApp from '../../mesa/Componentes/MesaApp.svelte';
	import GridLista from '../Componentes/GridLista.svelte';

	let { data }: { data: { id: string } } = $props();
</script>

<svelte:head>
	<title>Mapas · DM Control</title>
</svelte:head>

<MesaApp ativo="grid">
	<GridLista id={data.id} />
</MesaApp>
