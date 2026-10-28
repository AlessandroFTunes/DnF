<script lang="ts">
	import MesaShell from '../Componentes/MesaShell.svelte';
	import MesaConteudo from '../Componentes/MesaConteudo.svelte';

	let { data }: { data: { id: string } } = $props();
</script>

<svelte:head>
	<title>Mesa · DM Control</title>
</svelte:head>

<MesaShell>
	<MesaConteudo id={data.id} />
</MesaShell>
