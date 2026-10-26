<script lang="ts">
	// Criaturas mais usadas pelos mestres.
	const criaturas = [
		{ nome: 'Dragão Vermelho', nd: 'ND 17', icone: '🐉', hue: 0 },
		{ nome: 'Beholder', nd: 'ND 13', icone: '👁️', hue: 280 },
		{ nome: 'Lich', nd: 'ND 21', icone: '💀', hue: 200 },
		{ nome: 'Vampiro', nd: 'ND 13', icone: '🦇', hue: 350 },
		{ nome: 'Troll', nd: 'ND 5', icone: '🧌', hue: 120 },
		{ nome: 'Mímico', nd: 'ND 2', icone: '📦', hue: 30 },
		{ nome: 'Golem de Pedra', nd: 'ND 10', icone: '🗿', hue: 35 },
		{ nome: 'Orc', nd: 'ND 1/2', icone: '👹', hue: 90 },
		{ nome: 'Cubo Gelatinoso', nd: 'ND 2', icone: '🟢', hue: 160 },
		{ nome: 'Sereia', nd: 'ND 1/8', icone: '🧜', hue: 180 }
	];
</script>

<section class="wrap">
	<h2>Em alta nas mesas</h2>
	<ol>
		{#each criaturas as c, i (c.nome)}
			<li class="lift" style:--h={c.hue}>
				<span class="rank" aria-hidden="true">{i + 1}</span>
				<div class="card">
					<span class="icon" aria-hidden="true">{c.icone}</span>
					<strong>{c.nome}</strong>
					<small>{c.nd}</small>
				</div>
			</li>
		{/each}
	</ol>
</section>

<style>
	.wrap {
		position: relative;
		z-index: 1;
		max-width: var(--maxw);
		margin: 0 auto;
		padding: 3rem 1.5rem 0;
	}

	h2 {
		margin: 0 0 1.2rem;
		font-size: clamp(1.4rem, 3vw, 1.8rem);
		font-weight: 700;
	}

	ol {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
		gap: 1.2rem 0.8rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		position: relative;
		display: flex;
		align-items: flex-end;
		padding-left: 2.2rem;
		border: 1px solid transparent;
		border-radius: 8px;
	}

	.rank {
		position: absolute;
		bottom: -0.4rem;
		left: -0.2rem;
		z-index: 1;
		font-size: 5rem;
		font-weight: 900;
		line-height: 1;
		letter-spacing: -0.08em;
		color: #000;
		-webkit-text-stroke: 3px rgb(255 255 255 / 0.85);
		pointer-events: none;
	}

	.card {
		position: relative;
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		gap: 0.15rem;
		aspect-ratio: 2 / 3;
		padding: 0.8rem 0.5rem;
		border-radius: 6px;
		background: linear-gradient(160deg, hsl(var(--h) 55% 32%), hsl(var(--h) 60% 9%) 80%);
		text-align: center;
	}

	.icon {
		margin-bottom: auto;
		margin-top: 1.4rem;
		font-size: 3.2rem;
	}

	strong {
		padding-left: 1.2rem;
		font-size: 0.85rem;
		line-height: 1.15;
		text-transform: uppercase;
	}

	small {
		padding-left: 1.2rem;
		font-size: 0.7rem;
		color: var(--gold-light);
	}
</style>
