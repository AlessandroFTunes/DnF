<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import AppMockup from '../../../components/AppMockup.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="shell">
	<header>
		<a class="logo" href={resolve('/')}>DM<span>CONTROL</span></a>

		<nav aria-label="Principal">
			<a href={resolve('/') + '#sobre'}>Visão geral</a>
			<a href={resolve('/') + '#faq'}>FAQ</a>
			<a href="https://dnf.developale.com">Dungeon and Fichas</a>
		</nav>
	</header>

	<main>
		<section class="content">
			{@render children()}
		</section>

		<div class="art">
			<AppMockup />
		</div>
	</main>

	<footer>
		<span class="brand">DM Control</span>
		<a href="https://dnf.developale.com">feito para mesas de Dungeon and Fichas</a>
	</footer>
</div>

<style>
	.shell {
		--gold: #f5c542;
		--gold-light: #ffe08a;
		--on-gold: #2a1d00;
		--bg: #02030a;
		--field: rgb(10 7 22 / 0.8);
		--danger: #ff8a8a;

		position: relative;
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background:
			radial-gradient(ellipse 60% 45% at 50% 0%, rgb(110 60 210 / 0.35), transparent),
			radial-gradient(ellipse 50% 40% at 85% 100%, rgb(245 197 66 / 0.12), transparent), var(--bg);
		color: #fff;
		font-family: var(--font-body);
	}

	header {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: 88rem;
		width: 100%;
		margin: 0 auto;
		padding: 1.5rem clamp(1rem, 4vw, 3rem);
		box-sizing: border-box;
	}

	.logo {
		font-size: clamp(1.4rem, 3vw, 2rem);
		font-weight: 900;
		letter-spacing: -0.04em;
		color: var(--gold);
		text-decoration: none;
		text-shadow: 0 0 24px rgb(245 197 66 / 0.35);
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
		position: absolute;
		left: 50%;
		display: none;
		gap: 0.25rem;
		padding: 0.4rem;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.08);
		translate: -50% 0;
	}

	nav a {
		padding: 0.6rem 1.1rem;
		border-radius: 999px;
		color: rgb(255 255 255 / 0.75);
		font-size: 0.95rem;
		text-decoration: none;
		transition: background 0.15s;
	}

	nav a:hover {
		background: rgb(255 255 255 / 0.1);
		color: #fff;
	}

	main {
		display: grid;
		flex: 1;
		grid-template-columns: 1fr;
		gap: clamp(2rem, 6vw, 6rem);
		align-items: stretch;
		width: 100%;
		max-width: 88rem;
		margin: 0 auto;
		padding: 1rem clamp(1rem, 4vw, 3rem) 3rem;
		box-sizing: border-box;
	}

	.content {
		display: flex;
		flex-direction: column;
		justify-content: center;
		width: 100%;
		max-width: 32rem;
		margin: 0 auto;
	}

	/* Só aparece ao lado do formulário; no celular só ocuparia a tela. */
	.art {
		display: none;
		min-height: 36rem;
	}

	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem clamp(1rem, 2vw, 1.5rem);
		background: rgb(255 255 255 / 0.07);
		font-size: 0.95rem;
	}

	.brand {
		color: var(--gold);
		font-size: 1.15rem;
		font-weight: 800;
	}

	footer a {
		color: rgb(255 255 255 / 0.8);
		text-decoration: none;
	}

	footer a:hover {
		text-decoration: underline;
	}

	@media (min-width: 56rem) {
		nav {
			display: flex;
		}

		main {
			grid-template-columns: 1fr 1.2fr;
		}

		.content {
			margin: 0;
		}

		.art {
			display: block;
		}
	}
</style>
