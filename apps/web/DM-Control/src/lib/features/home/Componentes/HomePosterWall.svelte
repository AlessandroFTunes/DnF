<script lang="ts">
	import '../animation/wall.css';

	// Pôsteres feitos só com cor e símbolo: classes, criaturas e magias do D&D.
	const posters = [
		{ nome: 'Bárbaro', icone: '🪓', hue: 12 },
		{ nome: 'Bola de Fogo', icone: '🔥', hue: 24 },
		{ nome: 'Beholder', icone: '👁️', hue: 280 },
		{ nome: 'Bardo', icone: '🎻', hue: 320 },
		{ nome: 'Dragão Vermelho', icone: '🐉', hue: 0 },
		{ nome: 'Clérigo', icone: '✨', hue: 48 },
		{ nome: 'Lich', icone: '💀', hue: 200 },
		{ nome: 'Ladino', icone: '🗡️', hue: 220 },
		{ nome: 'Mago', icone: '🔮', hue: 260 },
		{ nome: 'Troll', icone: '🧌', hue: 120 },
		{ nome: 'Druida', icone: '🌿', hue: 140 },
		{ nome: 'Paladino', icone: '🛡️', hue: 45 },
		{ nome: 'Mímico', icone: '📦', hue: 30 },
		{ nome: 'Feiticeiro', icone: '⚡', hue: 290 },
		{ nome: 'Guerreiro', icone: '⚔️', hue: 210 },
		{ nome: 'Vampiro', icone: '🦇', hue: 350 },
		{ nome: 'Patrulheiro', icone: '🏹', hue: 100 },
		{ nome: 'Cubo Gelatinoso', icone: '🟢', hue: 160 },
		{ nome: 'Monge', icone: '🥋', hue: 190 },
		{ nome: 'Bruxo', icone: '🌙', hue: 270 },
		{ nome: 'Orc', icone: '👹', hue: 90 },
		{ nome: 'Relâmpago', icone: '🌩️', hue: 230 },
		{ nome: 'Sereia', icone: '🧜', hue: 180 },
		{ nome: 'Golem', icone: '🗿', hue: 35 }
	];
</script>

<div class="wall" aria-hidden="true">
	<div class="wall-grid">
		{#each posters as p (p.nome)}
			<div class="poster" style:--h={p.hue}>
				<span class="icon">{p.icone}</span>
				<span class="name">{p.nome}</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.wall {
		position: absolute;
		inset: -30% -15%;
		display: grid;
		place-items: center;
		transform: rotate(-12deg) scale(1.15);
		opacity: 0.55;
		pointer-events: none;
	}

	.wall-grid {
		display: grid;
		grid-template-columns: repeat(8, 9rem);
		gap: 0.75rem;
		animation: wall-drift 40s linear infinite alternate;
	}

	.poster {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		gap: 0.4rem;
		aspect-ratio: 2 / 3;
		padding: 0.75rem 0.5rem;
		border-radius: 6px;
		background: linear-gradient(
			160deg,
			hsl(var(--h) 55% 30%),
			hsl(var(--h) 60% 9%) 80%
		);
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08);
		text-align: center;
	}

	.icon {
		margin-bottom: auto;
		margin-top: 1.2rem;
		font-size: 2.8rem;
		filter: drop-shadow(0 4px 12px rgb(0 0 0 / 0.6));
	}

	.name {
		font-size: 0.95rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		text-transform: uppercase;
		color: hsl(var(--h) 90% 85%);
	}

	@media (max-width: 40rem) {
		.wall-grid {
			grid-template-columns: repeat(8, 6.5rem);
		}

		.icon {
			font-size: 2rem;
		}

		.name {
			font-size: 0.7rem;
		}
	}
</style>
