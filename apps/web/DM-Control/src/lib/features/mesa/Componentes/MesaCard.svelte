<script lang="ts">
	import type { Component } from 'svelte';

	let {
		titulo,
		icone: Icone,
		texto,
		href,
		acao
	}: {
		titulo: string;
		icone: Component<{ size?: number; strokeWidth?: number }>;
		texto: string;
		/** Com link, o card abre algo em vez de mostrar "Em breve". */
		href?: string;
		acao?: string;
	} = $props();
</script>

<article>
	<h2>{titulo}</h2>

	<div class="vazio">
		<span class="icone" aria-hidden="true"><Icone size={32} strokeWidth={1.6} /></span>
		<p>{texto}</p>
		{#if href}
			<a class="breve ativo" {href}>{acao ?? 'Abrir'}</a>
		{:else}
			<span class="breve">Em breve</span>
		{/if}
	</div>
</article>

<style>
	article {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 17rem;
		padding: 1.5rem;
		border-radius: 1.4rem;
		background: #14101f;
	}

	h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.vazio {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.8rem;
		text-align: center;
	}

	.icone {
		display: grid;
		place-items: center;
		width: 4.2rem;
		height: 4.2rem;
		border-radius: 1.2rem;
		background: linear-gradient(135deg, #2a1659, rgb(245 197 66 / 0.25));
		color: var(--gold-light);
	}

	p {
		margin: 0;
		max-width: 22rem;
		font-size: 0.95rem;
		line-height: 1.45;
		color: rgb(255 255 255 / 0.7);
	}

	.breve.ativo {
		background: var(--gold);
		color: var(--on-gold);
		text-decoration: none;
	}

	.breve {
		padding: 0.35rem 1rem;
		border: 1px solid rgb(245 197 66 / 0.6);
		border-radius: 999px;
		color: var(--gold);
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
</style>
