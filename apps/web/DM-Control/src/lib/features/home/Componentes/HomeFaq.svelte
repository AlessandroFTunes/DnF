<script lang="ts">
	const perguntas = [
		{
			q: 'O que é o DM Control?',
			a: 'É o painel do mestre para as suas mesas de D&D: campanhas, personagens dos jogadores, criaturas e regras num só lugar, para você focar na história.'
		},
		{
			q: 'Preciso do app DnF?',
			a: 'Não para usar o painel, mas os dois funcionam juntos: os jogadores criam e evoluem os personagens no app DnF e você acompanha tudo por aqui, com a mesma conta.'
		},
		{
			q: 'Quais edições de D&D são suportadas?',
			a: 'As regras de 2014 (5e) e de 2024 (5.5e). O bestiário vem do Open5e, com textos em inglês por enquanto.'
		},
		{
			q: 'Onde posso usar?',
			a: 'No navegador do computador, do tablet ou do celular. Não precisa instalar nada.'
		}
	];
</script>

<section id="faq" class="wrap">
	<h2>Perguntas frequentes</h2>
	<div class="list">
		{#each perguntas as p (p.q)}
			<details>
				<summary>
					<span>{p.q}</span>
					<span class="mark" aria-hidden="true"></span>
				</summary>
				<p>{p.a}</p>
			</details>
		{/each}
	</div>
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

	.list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	details {
		background: #2a2a35;
	}

	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.2rem 1.5rem;
		font-size: clamp(1.05rem, 2.4vw, 1.3rem);
		list-style: none;
		cursor: pointer;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary:hover {
		background: #3a3a48;
	}

	summary:focus-visible {
		outline: 2px solid var(--gold);
		outline-offset: -2px;
	}

	/* Mais vira "x" quando aberto, como na Netflix. */
	.mark {
		position: relative;
		flex: none;
		width: 1.6rem;
		height: 1.6rem;
	}

	.mark::before,
	.mark::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 100%;
		height: 2px;
		background: #fff;
		translate: -50% -50%;
	}

	.mark::after {
		rotate: 90deg;
	}

	details[open] .mark {
		rotate: 45deg;
	}

	p {
		margin: 0;
		padding: 1.2rem 1.5rem 1.5rem;
		border-top: 1px solid #02030a;
		font-size: clamp(1rem, 2.2vw, 1.2rem);
		line-height: 1.5;
	}
</style>
