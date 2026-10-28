<script lang="ts">
	import GridJogador from '../Componentes/GridJogador.svelte';

	let { data }: { data: { id: string; gridId: string } } = $props();
</script>

<svelte:head>
	<title>Visão do jogador · DM Control</title>
</svelte:head>

<GridJogador id={data.gridId} />
