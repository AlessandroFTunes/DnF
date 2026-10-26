<script lang="ts">
	import HomeHeader from './HomeHeader.svelte';
	import HomeSky from './HomeSky.svelte';
	import HomeSignup from './HomeSignup.svelte';
	import AppMockup from '../../../components/AppMockup.svelte';
</script>

<div class="hero">
	<HomeSky />
	<div class="shade" aria-hidden="true"></div>

	<HomeHeader />

	<section>
		<div class="text">
			<h1>Mesas, fichas e monstros, sem limites</h1>
			<p class="lead">
				Painel do mestre para D&amp;D 2014 e 2024. Tudo num só lugar para a sua mesa.
			</p>
			<HomeSignup text="Pronto para mestrar? Crie ou acesse sua conta." />
		</div>

		<div class="art">
			<AppMockup />
		</div>
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
		display: grid;
		flex: 1;
		grid-template-columns: 1fr;
		gap: clamp(2rem, 6vw, 5rem);
		align-items: center;
		width: 100%;
		max-width: 80rem;
		margin: 0 auto;
		padding: 2rem clamp(1rem, 4vw, 3rem) 9rem;
		box-sizing: border-box;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.2rem, 5vw, 4rem);
		font-weight: 900;
		line-height: 1.08;
		letter-spacing: -0.03em;
		text-align: left;
	}

	.lead {
		margin: 1.2rem 0 2rem;
		font-size: clamp(1.05rem, 2vw, 1.4rem);
		font-weight: 600;
	}

	/* A tela do app só aparece ao lado do texto; no celular só empurraria o conteúdo. */
	.art {
		display: none;
		height: 32rem;
	}

	@media (min-width: 56rem) {
		section {
			grid-template-columns: 1fr 1.1fr;
		}

		.art {
			display: block;
		}
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
