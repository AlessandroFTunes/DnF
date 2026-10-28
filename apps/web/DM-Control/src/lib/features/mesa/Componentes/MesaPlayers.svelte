<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';

	let {
		players,
		inviteCode
	}: {
		players: { id: string; jogador: string; personagem: string; nivel: number | null }[];
		inviteCode: string;
	} = $props();

	let copiado = $state(false);

	async function copiar() {
		try {
			await navigator.clipboard.writeText(inviteCode);
			copiado = true;
		} catch {
			// Sem permissão para a área de transferência: o código continua na tela.
			copiado = false;
		}
	}
</script>

<section>
	<header>
		<h2>Players</h2>
		<button type="button" class="add" onclick={copiar}>
			<Plus size={16} strokeWidth={2.2} aria-hidden="true" />
			{copiado ? 'Código copiado' : 'Convidar'}
		</button>
	</header>

	<p class="total"><strong>Na mesa</strong><strong>{players.length}</strong></p>

	{#if players.length > 0}
		<ul>
			{#each players as player (player.id)}
				<li>
					<span>{player.personagem}</span>
					<small>{player.jogador}{player.nivel ? ` · Nv ${player.nivel}` : ''}</small>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="convite">
		<strong>Código de convite</strong>
		<span class="codigo">{inviteCode}</span>
		<small>Passe para os jogadores entrarem com um personagem.</small>
	</div>
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1.5rem;
		border-radius: 1.4rem;
		background: #14101f;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.add {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--gold);
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
	}

	.total {
		display: flex;
		justify-content: space-between;
		margin: 0;
		padding-bottom: 0.9rem;
		border-bottom: 1px solid rgb(255 255 255 / 0.1);
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		flex-direction: column;
		padding: 0.5rem 0;
	}

	li small,
	.convite small {
		color: rgb(255 255 255 / 0.5);
	}

	.convite {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 1rem;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 0.9rem;
	}

	.codigo {
		font-family: var(--font-mono);
		font-size: 1.1rem;
		color: var(--gold);
	}
</style>
