<script lang="ts">
	const motivos = [
		{
			titulo: 'Controle de combate',
			texto: 'Iniciativa, vida e condições de todo mundo na mesa, sem papel nem planilha.',
			icone: '⚔️'
		},
		{
			titulo: 'Fichas dos jogadores',
			texto: 'Acompanhe os personagens que seus jogadores criam e evoluem no app DnF.',
			icone: '📜'
		},
		{
			titulo: 'Bestiário completo',
			texto: 'Busque criaturas das edições 2014 e 2024 e leve o monstro certo para a cena.',
			icone: '🐉'
		},
		{
			titulo: 'Dentro e fora da mesa',
			texto: 'Prepare a sessão no navegador e consulte tudo durante o jogo, de qualquer tela.',
			icone: '🌐'
		}
	];
</script>

<section class="wrap">
	<h2>Mais motivos para mestrar</h2>
	<ul>
		{#each motivos as m (m.titulo)}
			<li class="lift">
				<h3>{m.titulo}</h3>
				<p>{m.texto}</p>
				<span class="icon" aria-hidden="true">{m.icone}</span>
			</li>
		{/each}
	</ul>
</section>

<style>
	.wrap {
		position: relative;
		z-index: 1;
		max-width: var(--maxw);
		margin: 0 auto;
		padding: 3.5rem 1.5rem 0;
	}

	h2 {
		margin: 0 0 1.2rem;
		font-size: clamp(1.4rem, 3vw, 1.8rem);
		font-weight: 700;
	}

	ul {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 0.8rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		position: relative;
		min-height: 12rem;
		padding: 1.3rem 1.2rem 4.5rem;
		border: 1px solid transparent;
		border-radius: 1rem;
		background: linear-gradient(150deg, #231150, #1a0b30 60%, #12091f);
	}

	h3 {
		margin: 0 0 0.9rem;
		font-size: 1.25rem;
		line-height: 1.2;
	}

	p {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.4;
		color: rgb(255 255 255 / 0.7);
	}

	.icon {
		position: absolute;
		right: 1.2rem;
		bottom: 1.1rem;
		display: grid;
		place-items: center;
		width: 3.4rem;
		height: 3.4rem;
		border-radius: 50%;
		background: radial-gradient(circle, rgb(245 197 66 / 0.35), rgb(245 197 66 / 0.08));
		font-size: 1.7rem;
	}
</style>
