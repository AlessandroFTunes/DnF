<script lang="ts">
	import HomeHeader from './HomeHeader.svelte';
	import HomeSky from './HomeSky.svelte';
	import HomePosterWall from './HomePosterWall.svelte';
	import HomeSignup from './HomeSignup.svelte';
</script>

<div class="hero">
	<HomeSky />
	<HomePosterWall />
	<div class="shade" aria-hidden="true"></div>

	<HomeHeader />

	<section>
		<h1>Mesas, fichas e monstros, sem limites</h1>
		<p class="lead">Painel do mestre para D&amp;D 2014 e 2024. Tudo num só lugar para a sua mesa.</p>
		<HomeSignup text="Pronto para mestrar? Informe seu email para criar ou acessar sua conta." />
	</section>

	<div class="arc" aria-hidden="true"></div>
</div>

<style>
	.hero {
		position: relative;
		display: flex;
		flex-direction: column;
		min-height: min(100vh, 56rem);
		overflow: hidden;
		isolation: isolate;
	}

	/* Escurece as bordas e o miolo para o texto ler bem, como na Netflix. */
	.shade {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 50% 55%, rgb(2 3 10 / 0.88) 0%, rgb(2 3 10 / 0.35) 65%),
			linear-gradient(rgb(2 3 10 / 0.85), transparent 25%, transparent 70%, #02030a);
		pointer-events: none;
	}

	section {
		position: relative;
		z-index: 2;
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.5rem 8rem;
		text-align: center;
	}

	h1 {
		max-width: 54rem;
		margin: 0;
		font-size: clamp(2.2rem, 6vw, 4rem);
		font-weight: 900;
		line-height: 1.08;
		letter-spacing: -0.03em;
		text-align: center;
	}

	.lead {
		margin: 1.2rem 0 2rem;
		font-size: clamp(1.05rem, 2.4vw, 1.5rem);
		font-weight: 600;
	}

	.arc {
		position: absolute;
		right: -10%;
		bottom: -1px;
		left: -10%;
		z-index: 2;
		height: 7rem;
		border-top: 3px solid rgb(245 197 66 / 0.85);
		border-radius: 50% 50% 0 0 / 100% 100% 0 0;
		background: radial-gradient(ellipse at 50% 0, rgb(70 35 140 / 0.6), #02030a 70%);
		box-shadow: 0 -10px 50px rgb(245 197 66 / 0.35);
		pointer-events: none;
	}
</style>
