<script lang="ts">
	import Dice5 from '@lucide/svelte/icons/dice-5';
	import Pencil from '@lucide/svelte/icons/pencil';
	import MesaEditar from './MesaEditar.svelte';

	let {
		mesa
	}: {
		mesa: {
			id: string;
			name: string;
			description: string;
			edition: string;
			image: string | null;
		};
	} = $props();

	let editar = $state<ReturnType<typeof MesaEditar>>();
</script>

<article>
	<button
		type="button"
		class="lapis"
		aria-label="Editar imagem, título e descrição"
		title="Editar"
		onclick={() => editar?.abrir()}
	>
		<Pencil size={18} strokeWidth={1.8} aria-hidden="true" />
	</button>

	{#if mesa.image}
		<img src={mesa.image} alt="" />
	{:else}
		<div class="sem-imagem" aria-hidden="true"><Dice5 size={44} strokeWidth={1.4} /></div>
	{/if}

	<h2>{mesa.name}</h2>
	<p class="edicao">D&amp;D {mesa.edition}</p>
	<p class="descricao">
		{mesa.description || 'Sem descrição ainda. Use o lápis para escrever uma.'}
	</p>
</article>

<MesaEditar bind:this={editar} {mesa} />

<style>
	article {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		min-height: 17rem;
		padding: 1.5rem;
		border-radius: 1.4rem;
		background: #14101f;
	}

	.lapis {
		position: absolute;
		top: 1.2rem;
		right: 1.2rem;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 2.4rem;
		height: 2.4rem;
		border: 0;
		border-radius: 50%;
		background: rgb(2 3 10 / 0.7);
		color: #fff;
		cursor: pointer;
	}

	.lapis:hover {
		color: var(--gold);
	}

	img,
	.sem-imagem {
		width: 100%;
		aspect-ratio: 21 / 9;
		border-radius: 0.9rem;
	}

	img {
		object-fit: cover;
	}

	.sem-imagem {
		display: grid;
		place-items: center;
		background: linear-gradient(135deg, #2a1659, #0e0b17 70%, rgb(245 197 66 / 0.25));
		color: var(--gold-light);
	}

	h2 {
		margin: 0.4rem 0 0;
		font-size: 1.5rem;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.edicao {
		margin: 0;
		font-size: 0.85rem;
		color: var(--gold-light);
	}

	.descricao {
		margin: 0;
		line-height: 1.5;
		color: rgb(255 255 255 / 0.7);
		overflow-wrap: anywhere;
	}
</style>
