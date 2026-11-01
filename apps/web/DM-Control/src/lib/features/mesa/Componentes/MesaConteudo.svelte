<script lang="ts">
	import { mesa } from '../api.remote';

	let { id }: { id: string } = $props();

	const dados = $derived(mesa(id));
</script>

{#if dados.error}
	<p class="aviso" role="alert">Não foi possível carregar a mesa. Tente de novo.</p>
{:else if !dados.current}
	<p class="aviso">Carregando…</p>
{:else if 'failure' in dados.current}
	<p class="aviso" role="alert">{dados.current.failure}</p>
{:else}
	{@const m = dados.current}

	{#if m.image}<img src={m.image} alt="" />{/if}
	<h1>{m.name}</h1>
	<p class="meta">D&amp;D {m.edition} · Código de convite <strong>{m.inviteCode}</strong></p>
	{#if m.description}<p class="descricao">{m.description}</p>{/if}
{/if}

<style>
	img {
		display: block;
		width: 100%;
		aspect-ratio: 21 / 9;
		margin-bottom: 1.5rem;
		object-fit: cover;
		border-radius: 1rem;
	}

	h1 {
		margin: 0 0 0.4rem;
		font-size: clamp(1.9rem, 3.4vw, 2.8rem);
		font-weight: 700;
		letter-spacing: -0.03em;
		text-align: left;
	}

	.meta {
		margin: 0 0 1.2rem;
		color: rgb(255 255 255 / 0.55);
	}

	.meta strong {
		font-family: var(--font-mono);
		color: var(--gold);
	}

	.descricao {
		max-width: 44rem;
		margin: 0;
		line-height: 1.55;
		color: rgb(255 255 255 / 0.8);
	}

	.aviso {
		color: rgb(255 255 255 / 0.6);
	}

	.aviso[role='alert'] {
		color: var(--danger);
	}
</style>
