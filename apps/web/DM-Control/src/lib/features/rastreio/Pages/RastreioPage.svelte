<script lang="ts">
	import MesaApp from '../../mesa/Componentes/MesaApp.svelte';
	import RastreioCalibracao from '../Componentes/RastreioCalibracao.svelte';
</script>

<svelte:head>
	<title>Rastreio · DM Control</title>
</svelte:head>

<MesaApp ativo="grid">
	<RastreioCalibracao />
</MesaApp>
