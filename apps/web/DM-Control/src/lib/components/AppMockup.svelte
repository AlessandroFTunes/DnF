<script lang="ts">
	import { asset } from '$app/paths';

	const menu = ['Início', 'Mesas', 'Fichas', 'Criaturas', 'Magias', 'Histórico'];
	const cards = [
		{ src: 'images/dragao-olho.png', title: 'Encare o dragão vermelho', foot: 'Bestiário · Hoje' },
		{ src: 'images/d20.png', title: 'Role o d20 da sorte', foot: 'Dados · Mesa de sexta' },
		{ src: 'images/bau.png', title: 'Abra o baú do tesouro', foot: 'Itens · Masmorra' }
	] as const;
</script>

<div class="mockup" aria-hidden="true">
	<div class="device">
		<aside>
			<span class="workspace">Mesa do Dragão</span>
			<span class="new">+ Nova sessão</span>
			{#each menu as item, i (item)}
				<span class="item" class:on={i === 0}>{item}</span>
			{/each}
		</aside>

		<div class="screen">
			<p class="hello">Olá, Mestre<span>O que vamos mestrar hoje?</span></p>

			<div class="cards">
				{#each cards as card (card.src)}
					<figure>
						<figcaption>{card.title}</figcaption>
						<img src={asset(card.src)} alt="" />
						<span>{card.foot}</span>
					</figure>
				{/each}
			</div>

			<div class="ask">Pergunte ou busque qualquer coisa…</div>
		</div>
	</div>
</div>

<style>
	.mockup {
		--gold: #f5c542;

		position: relative;
		overflow: hidden;
		width: 100%;
		height: 100%;
		min-height: inherit;
		border-radius: 2rem;
		background: #0b0914;
		box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 0.6);
	}

	/* Tela do app inclinada, maior que o painel: o recorte dá a sensação de profundidade. */
	.device {
		position: absolute;
		top: 14%;
		left: 8%;
		display: flex;
		width: 135%;
		height: 90%;
		overflow: hidden;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 1.2rem;
		background: #14101f;
		box-shadow: 0 2rem 5rem rgb(0 0 0 / 0.7);
		transform: perspective(1800px) rotateX(14deg) rotateY(-20deg) rotateZ(-9deg);
		transform-origin: left center;
	}

	aside {
		display: flex;
		flex: 0 0 11rem;
		flex-direction: column;
		gap: 0.35rem;
		padding: 1.2rem 0.9rem;
		background: #0e0b17;
		font-size: 0.8rem;
		color: rgb(255 255 255 / 0.6);
	}

	.workspace {
		margin-bottom: 0.4rem;
		color: #fff;
		font-weight: 700;
	}

	.new {
		margin-bottom: 0.6rem;
		color: var(--gold);
	}

	.item {
		padding: 0.45rem 0.6rem;
		border-radius: 0.5rem;
	}

	.item.on {
		background: rgb(255 255 255 / 0.08);
		color: #fff;
	}

	.screen {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1.4rem;
		min-width: 0;
		padding: 1.6rem;
	}

	.hello {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.hello span {
		display: block;
		color: rgb(255 255 255 / 0.4);
	}

	.cards {
		display: flex;
		gap: 1rem;
	}

	figure {
		display: flex;
		flex: 0 0 10.5rem;
		flex-direction: column;
		gap: 0.7rem;
		margin: 0;
		padding: 0.9rem;
		border-radius: 1rem;
		background: #231c33;
		font-size: 0.8rem;
	}

	figcaption {
		font-weight: 600;
	}

	figure img {
		width: 100%;
		aspect-ratio: 3 / 4;
		object-fit: cover;
		border-radius: 0.6rem;
	}

	figure span {
		color: rgb(255 255 255 / 0.4);
		font-size: 0.7rem;
	}

	.ask {
		margin-top: auto;
		padding: 0.8rem 1rem;
		border-radius: 0.8rem;
		background: rgb(255 255 255 / 0.06);
		font-size: 0.8rem;
		color: rgb(255 255 255 / 0.4);
	}
</style>
