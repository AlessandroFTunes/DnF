<script lang="ts">
	import HomeShell from '../Componentes/HomeShell.svelte';
	import HomeHero from '../Componentes/HomeHero.svelte';
	import HomePromo from '../Componentes/HomePromo.svelte';
	import HomeTrending from '../Componentes/HomeTrending.svelte';
	import HomeReasons from '../Componentes/HomeReasons.svelte';
	import HomeConnect from '../Componentes/HomeConnect.svelte';
	import HomeFaq from '../Componentes/HomeFaq.svelte';
	import HomeFooter from '../Componentes/HomeFooter.svelte';
</script>

<svelte:head>
	<title>DM Control</title>
	<meta name="description" content="Painel do mestre para suas mesas de D&D." />
</svelte:head>

<HomeShell>
	<HomeHero />
	<HomePromo />
	<HomeTrending />
	<HomeReasons />
	<HomeConnect />
	<HomeFaq />
	<HomeFooter />
</HomeShell>
