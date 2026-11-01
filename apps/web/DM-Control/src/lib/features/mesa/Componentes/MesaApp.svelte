<script lang="ts">
	import type { Snippet } from 'svelte';
	import MesaRail from './MesaRail.svelte';

	let { ativo, children }: { ativo: string; children: Snippet } = $props();
</script>

<div class="app">
	<MesaRail {ativo} />

	<main>
		{@render children()}
	</main>
</div>

<style>
	.app {
		--gold: #f5c542;
		--gold-light: #ffe08a;
		--on-gold: #2a1d00;
		--danger: #ff8a8a;

		display: grid;
		grid-template-columns: 4.5rem 1fr;
		min-height: 100vh;
		background:
			radial-gradient(ellipse 60% 40% at 60% 0%, rgb(110 60 210 / 0.25), transparent), #02030a;
		color: #fff;
		font-family: var(--font-body);
	}

	main {
		min-width: 0;
		padding: clamp(1rem, 2.5vw, 2rem);
	}
</style>
