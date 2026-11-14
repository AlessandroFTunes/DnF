<script lang="ts">
	import EstadoCarga from '../../../components/EstadoCarga.svelte';
	import { inicio } from '../api.remote';
	import InicioCriarMesa from './InicioCriarMesa.svelte';
	import InicioMesaCard from './InicioMesaCard.svelte';

	const dados = inicio();
</script>

<EstadoCarga {dados} erro="Não foi possível carregar suas mesas. Tente de novo.">
	{#snippet children({ name, mesas })}
		<h1>Olá, {name}<span>O que vamos mestrar hoje?</span></h1>

		{#if mesas.length === 0}
			<div class="vazio">
				<h2>Vamos explorar</h2>
				<p>Crie sua primeira campanha</p>
				<InicioCriarMesa />
			</div>
		{:else}
			<div class="titulo">
				<h2>Suas mesas</h2>
				<InicioCriarMesa />
			</div>
			<ul>
				{#each mesas as mesa (mesa.id)}
					<li><InicioMesaCard {mesa} /></li>
				{/each}
			</ul>
		{/if}
	{/snippet}
</EstadoCarga>

<style>
	h1 {
		text-align: left;
		margin: 0 0 2rem;
		font-size: clamp(1.9rem, 3.4vw, 2.8rem);
		font-weight: 600;
		line-height: 1.1;
		letter-spacing: -0.03em;
	}

	h1 span {
		display: block;
		color: rgb(255 255 255 / 0.4);
	}

	.vazio {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.8rem;
		min-height: 55vh;
		text-align: center;
	}

	.vazio h2 {
		font-size: clamp(1.8rem, 3.4vw, 2.6rem);
		font-weight: 700;
		letter-spacing: -0.03em;
		color: #fff;
	}

	.vazio p {
		margin: 0 0 0.8rem;
		color: rgb(255 255 255 / 0.55);
	}

	.titulo {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--gold-light);
	}

	ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr));
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
