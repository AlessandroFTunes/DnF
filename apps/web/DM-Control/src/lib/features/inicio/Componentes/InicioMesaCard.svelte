<script lang="ts">
	import { resolve } from '$app/paths';
	import Dice5 from '@lucide/svelte/icons/dice-5';

	let {
		mesa
	}: {
		mesa: {
			id: string;
			name: string;
			description: string;
			edition: string;
			inviteCode: string;
			timeUpdated: string;
			image: string | null;
		};
	} = $props();

	const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' });
	const texto = $derived(
		mesa.description ||
			`D&D ${mesa.edition} · atualizada em ${data.format(new Date(mesa.timeUpdated))}`
	);

	let copiado = $state(false);

	async function copiar() {
		try {
			await navigator.clipboard.writeText(mesa.inviteCode);
			copiado = true;
		} catch {
			// Sem permissão para a área de transferência: o código continua no botão.
			copiado = false;
		}
	}
</script>

<article>
	<div class="capa">
		{#if mesa.image}
			<img src={mesa.image} alt="" />
		{:else}
			<Dice5 size={40} strokeWidth={1.4} aria-hidden="true" />
		{/if}
	</div>

	<div class="corpo">
		<h3>{mesa.name}</h3>
		<p>{texto}</p>
		<div class="acoes">
			<a class="abrir" href={resolve('/mesa/[id]/grid', { id: mesa.id })}>Abrir mesa</a>
			<button type="button" onclick={copiar}>
				{copiado ? 'Código copiado' : `Copiar código · ${mesa.inviteCode}`}
			</button>
		</div>
	</div>
</article>

<style>
	article {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 1.4rem;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 0.9rem;
		background: #14101f;
	}

	.capa {
		display: grid;
		flex: 0 0 9.5rem;
		place-items: center;
		overflow: hidden;
		aspect-ratio: 4 / 3;
		border-radius: 0.7rem;
		background: linear-gradient(135deg, #2a1659, #0e0b17 70%, rgb(245 197 66 / 0.25));
		color: var(--gold-light);
	}

	.capa img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.corpo {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
		min-width: 0;
	}

	h3 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
	}

	p {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.45;
		color: rgb(255 255 255 / 0.65);
		overflow-wrap: anywhere;
	}

	.acoes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 0.4rem;
	}

	.abrir {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		background: var(--gold);
		color: var(--on-gold);
		font-size: 0.9rem;
		font-weight: 800;
		text-decoration: none;
	}

	.abrir:hover {
		filter: brightness(1.08);
	}

	button {
		padding: 0.5rem 1rem;
		border: 1px solid rgb(255 255 255 / 0.25);
		border-radius: 0.5rem;
		background: none;
		color: #fff;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
	}

	button:hover {
		border-color: var(--gold);
	}

	button:focus-visible,
	.abrir:focus-visible {
		outline: 2px solid var(--gold);
		outline-offset: 2px;
	}

	@media (max-width: 30rem) {
		.capa {
			flex-basis: 6rem;
		}
	}
</style>
