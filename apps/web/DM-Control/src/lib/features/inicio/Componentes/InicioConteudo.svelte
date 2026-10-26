<script lang="ts">
	import { inicio } from '../api.remote';
	import InicioCriarMesa from './InicioCriarMesa.svelte';

	const dados = inicio();

	const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' });
</script>

{#if dados.error}
	<p class="aviso" role="alert">Não foi possível carregar suas mesas. Tente de novo.</p>
{:else if !dados.current}
	<p class="aviso">Carregando…</p>
{:else if 'failure' in dados.current}
	<p class="aviso" role="alert">{dados.current.failure}</p>
{:else}
	{@const { name, mesas } = dados.current}

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
				<li>
					{#if mesa.image}<img src={mesa.image} alt="" />{/if}
					<strong>{mesa.name}</strong>
					<span class="meta"
						>D&amp;D {mesa.edition} · atualizada em {data.format(new Date(mesa.timeUpdated))}</span
					>
					{#if mesa.description}<p>{mesa.description}</p>{/if}
					<span class="code">Código: {mesa.inviteCode}</span>
				</li>
			{/each}
		</ul>
	{/if}
{/if}

<style>
	h1 {
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
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1.1rem;
		border-radius: 1rem;
		background: #231c33;
	}

	li img {
		width: 100%;
		aspect-ratio: 16 / 9;
		object-fit: cover;
		border-radius: 0.7rem;
	}

	li strong {
		font-size: 1.1rem;
	}

	li p {
		margin: 0;
		font-size: 0.9rem;
		color: rgb(255 255 255 / 0.7);
	}

	.meta,
	.code {
		font-size: 0.8rem;
		color: rgb(255 255 255 / 0.45);
	}

	.code {
		font-family: var(--font-mono);
		color: var(--gold);
	}

	.aviso {
		color: rgb(255 255 255 / 0.6);
	}

	.aviso[role='alert'] {
		color: var(--danger);
	}
</style>
