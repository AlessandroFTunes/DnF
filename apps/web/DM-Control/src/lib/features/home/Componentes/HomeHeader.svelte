<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<header>
	<a class="logo" href={resolve('/')}>DM<span>CONTROL</span></a>
	<a class="enter" href={resolve('/login')}>Entrar</a>
</header>

<style>
	header {
		position: relative;
		z-index: 3;
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		max-width: 80rem;
		margin: 0 auto;
		padding: 1.25rem clamp(1rem, 4vw, 3rem);
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

	.enter {
		padding: 0.45rem 1rem;
		border-radius: 3px;
		background: var(--gold);
		color: var(--on-gold);
		font-size: 0.95rem;
		font-weight: 700;
		text-decoration: none;
	}

	.enter:hover {
		text-decoration: none;
		filter: brightness(1.08);
	}
</style>
