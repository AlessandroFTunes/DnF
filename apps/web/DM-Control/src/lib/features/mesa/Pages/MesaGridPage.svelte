<script lang="ts">
	import MesaApp from '../Componentes/MesaApp.svelte';
	import MesaGrid from '../Componentes/MesaGrid.svelte';

	let { data }: { data: { id: string } } = $props();
</script>

<svelte:head>
	<title>Mesa · DM Control</title>
</svelte:head>

<MesaApp ativo="grid">
	<MesaGrid id={data.id} />
</MesaApp>
