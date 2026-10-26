<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';

	let { children }: { children: Snippet } = $props();
</script>

<div class="shell">
	<a class="logo" href={resolve('/')}>DM<span>CONTROL</span></a>

	<main>
		<div class="card">
			{@render children()}
		</div>
	</main>
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
		overflow: hidden;
		background:
			radial-gradient(ellipse 60% 45% at 50% 0%, rgb(110 60 210 / 0.35), transparent),
			radial-gradient(ellipse 50% 40% at 85% 100%, rgb(245 197 66 / 0.12), transparent),
			var(--bg);
		color: #fff;
		font-family: var(--font-body);
	}

	.logo {
		padding: 1.25rem clamp(1rem, 4vw, 3rem);
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

	main {
		display: grid;
		flex: 1;
		place-items: center;
		padding: 1rem 1rem 4rem;
	}

	.card {
		width: 100%;
		max-width: 26rem;
		padding: clamp(1.5rem, 5vw, 2.5rem);
		border: 1px solid rgb(245 197 66 / 0.3);
		border-radius: 12px;
		background: rgb(10 7 22 / 0.75);
		box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 0.6);
		backdrop-filter: blur(10px);
	}
</style>
