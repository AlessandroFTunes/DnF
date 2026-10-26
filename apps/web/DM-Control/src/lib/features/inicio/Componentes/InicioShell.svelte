<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';

	let { children }: { children: Snippet } = $props();

	const menu = ['Mesas', 'Fichas', 'Criaturas', 'Magias'];
</script>

<div class="shell">
	<aside>
		<a class="logo" href={resolve('/')}>DM<span>CONTROL</span></a>

		<nav aria-label="Principal">
			<a class="item on" href={resolve('/inicio')} aria-current="page">Início</a>
			{#each menu as item (item)}
				<span class="item" aria-disabled="true" title="Em breve">{item}</span>
			{/each}
		</nav>
	</aside>

	<main>
		{@render children()}
	</main>
</div>

<style>
	.shell {
		--gold: #f5c542;
		--gold-light: #ffe08a;
		--on-gold: #2a1d00;
		--bg: #02030a;
		--danger: #ff8a8a;

		display: grid;
		grid-template-columns: 1fr;
		min-height: 100vh;
		background:
			radial-gradient(ellipse 60% 40% at 60% 0%, rgb(110 60 210 / 0.3), transparent), var(--bg);
		color: #fff;
		font-family: var(--font-body);
	}

	aside {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.25rem;
		background: #0e0b17;
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

	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.item {
		padding: 0.55rem 0.9rem;
		border-radius: 0.6rem;
		color: rgb(255 255 255 / 0.6);
		font-size: 0.95rem;
		text-decoration: none;
	}

	.item.on {
		background: rgb(255 255 255 / 0.08);
		color: #fff;
	}

	span.item {
		opacity: 0.45;
		cursor: not-allowed;
	}

	main {
		padding: clamp(1.25rem, 4vw, 3rem);
	}

	@media (min-width: 56rem) {
		.shell {
			grid-template-columns: 15rem 1fr;
		}

		nav {
			flex-direction: column;
			flex-wrap: nowrap;
		}
	}
</style>
