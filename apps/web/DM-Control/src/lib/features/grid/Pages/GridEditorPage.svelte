<script lang="ts">
	import GridEditor from '../Componentes/GridEditor.svelte';

	let { data }: { data: { id: string; gridId: string } } = $props();
</script>

<svelte:head>
	<title>Grid · DM Control</title>
</svelte:head>

<GridEditor id={data.gridId} />
