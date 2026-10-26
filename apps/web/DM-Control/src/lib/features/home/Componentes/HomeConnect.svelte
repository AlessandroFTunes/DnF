<script lang="ts">
	import HomeVideo from './HomeVideo.svelte';
	import HomeImg from './HomeImg.svelte';

	const steps = [
		{
			title: 'Jogadores no DnF',
			text: 'Cada jogador cria e evolui o personagem no app DnF, direto do celular.'
		},
		{
			title: 'Mestre no DM Control',
			text: 'Você entra com a mesma conta e acompanha a mesa, os personagens e as criaturas.'
		},
		{
			title: 'Tudo sincronizado',
			text: 'Os dois apps usam o mesmo banco: o que muda em um aparece no outro.'
		}
	];
</script>

<section id="sobre" aria-labelledby="conecta-titulo">
	<p class="tag">DM Control + DnF</p>
	<h2 id="conecta-titulo">Dois apps, uma mesa</h2>
	<p class="lead">
		O DM Control é o painel do mestre e conversa com o app DnF dos jogadores. Juntos, a ficha de quem
		joga e o controle de quem mestra ficam sempre em sincronia.
	</p>

	<ol>
		{#each steps as step, i (step.title)}
			<li>
				<span class="num">{i + 1}</span>
				<h3>{step.title}</h3>
				<p>{step.text}</p>
			</li>
		{/each}
	</ol>

	<div class="telas">
		<HomeVideo
			src="/videos/dnf-demo.webm"
			poster="/images/dnf-personagens.png"
			label="Demonstração do app DnF: personagens, árvore, história e ficha"
		/>
		<HomeImg
			src="images/dnf-arvore.png"
			alt="App DnF: árvore de evolução do personagem"
			width={348}
			height={783}
		/>
		<div class="cta">
			<h3>DnF: fichas rápidas e intuitivas</h3>
			<p>
				Chega de jogador passando anos trancado numa torre só para criar um personagem. No DnF a
				ficha sai em minutos, direto do celular, e a aventura começa de verdade.
			</p>
			<a class="dnf lift" href="https://dnf.developale.com">
				Curioso com Dungeon and Fichas? Acesse aqui <span aria-hidden="true">›</span>
			</a>
		</div>
	</div>
</section>

<style>
	section {
		--gold: #f5c542;
		--gold-light: #ffe08a;

		scroll-margin-top: 1rem;

		position: relative;
		z-index: 1;
		max-width: var(--maxw);
		margin: 0 auto;
		padding: 4rem 1.5rem 0;
		color: #fff;
	}

	.tag {
		margin: 0 0 1rem;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: var(--gold-light);
	}

	h2 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3.6rem);
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.04em;
	}

	.lead {
		max-width: 34rem;
		margin: 1.5rem 0 2.5rem;
		font-size: 1.15rem;
		font-weight: 600;
		line-height: 1.4;
	}

	ol {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		padding: 1.25rem;
		border: 1px solid rgb(245 197 66 / 0.3);
		border-radius: 3px;
		background: rgb(2 3 10 / 0.55);
		backdrop-filter: blur(6px);
	}

	.num {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--gold-light);
	}

	h3 {
		margin: 0.5rem 0;
		font-size: 1.15rem;
		font-weight: 800;
	}

	li p {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.45;
		color: var(--gold-light);
	}

	.telas {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1.5rem;
		margin-top: 3rem;
	}

	.cta {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1rem;
		max-width: 26rem;
		margin-left: 4rem;
	}

	.cta h3 {
		margin: 0;
		font-size: clamp(2.2rem, 5vw, 3.6rem);
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.04em;
	}

	.cta p {
		margin: 0;
		font-size: 1rem;
		line-height: 1.45;
		color: var(--gold-light);
	}

	.dnf {
		padding: 1rem 1.6rem;
		border-radius: 4px;
		background: var(--gold);
		color: #2a1d00;
		font-size: 1.1rem;
		font-weight: 800;
		text-decoration: none;
	}

	.dnf:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 2px;
	}
</style>
