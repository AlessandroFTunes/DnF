<script lang="ts">
	import MesaApp from '../../mesa/Componentes/MesaApp.svelte';
	import RastreioCalibracao from '../Componentes/RastreioCalibracao.svelte';

	let { data }: { data: { id: string } } = $props();
</script>

<svelte:head>
	<title>Rastreio · DM Control</title>
</svelte:head>

<MesaApp ativo="grid">
	<RastreioCalibracao id={data.id} />
</MesaApp>
