<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';

	let { children }: { children: Snippet } = $props();
</script>

<div class="shell">
	<header>
		<a class="logo" href={resolve('/inicio')}>DM<span>CONTROL</span></a>
		<a class="voltar" href={resolve('/inicio')}>← Início</a>
	</header>

	<main>
		{@render children()}
	</main>
</div>

<style>
	.shell {
		--gold: #f5c542;
		--gold-light: #ffe08a;
		--on-gold: #2a1d00;
		--danger: #ff8a8a;

		min-height: 100vh;
		background:
			radial-gradient(ellipse 60% 40% at 60% 0%, rgb(110 60 210 / 0.3), transparent), #02030a;
		color: #fff;
		font-family: var(--font-body);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: 64rem;
		margin: 0 auto;
		padding: 1.25rem clamp(1rem, 4vw, 3rem);
	}

	.logo {
		font-size: 1.6rem;
		font-weight: 900;
		letter-spacing: -0.04em;
		color: var(--gold);
		text-decoration: none;
	}

	.logo span {
		margin-left: 0.3rem;
		font-family: var(--font-mono);
		font-size: 0.55em;
		font-weight: 400;
		letter-spacing: 0.2em;
		color: var(--gold-light);
	}

	.voltar {
		color: rgb(255 255 255 / 0.7);
		text-decoration: none;
	}

	.voltar:hover {
		color: #fff;
	}

	main {
		max-width: 64rem;
		margin: 0 auto;
		padding: 1rem clamp(1rem, 4vw, 3rem) 3rem;
	}
</style>
