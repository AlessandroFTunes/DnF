<script lang="ts">
	import { resolve } from '$app/paths';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Swords from '@lucide/svelte/icons/swords';
	import Users from '@lucide/svelte/icons/users';

	let { ativo }: { ativo: string } = $props();

	// Só o Grid existe por enquanto; as outras entradas aparecem esmaecidas, como no início.
	const itens = [
		{ id: 'personagens', nome: 'Personagens', icone: Users },
		{ id: 'grid', nome: 'Grid', icone: LayoutGrid },
		{ id: 'encontros', nome: 'Encontros rápidos', icone: Swords },
		{ id: 'regras', nome: 'Regras da Mesa', icone: ScrollText },
		{ id: 'ai', nome: 'AI help', icone: Sparkles }
	];
</script>

<nav aria-label="Mesa">
	<a class="logo" href={resolve('/inicio')} aria-label="Voltar ao início" title="Voltar ao início">
		DM
	</a>

	<ul>
		{#each itens as item (item.id)}
			<li>
				{#if item.id === 'grid'}
					<span
						class="item on"
						title={item.nome}
						aria-current={ativo === item.id ? 'page' : undefined}
					>
						<item.icone size={22} strokeWidth={1.8} aria-hidden="true" />
						<span class="sr">{item.nome}</span>
					</span>
				{:else}
					<span class="item" aria-disabled="true" title="{item.nome} · em breve">
						<item.icone size={22} strokeWidth={1.8} aria-hidden="true" />
						<span class="sr">{item.nome} (em breve)</span>
					</span>
				{/if}
			</li>
		{/each}
	</ul>
</nav>

<style>
	nav {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		padding: 1rem 0;
		background: #0e0b17;
	}

	.logo {
		display: grid;
		place-items: center;
		width: 2.8rem;
		height: 2.8rem;
		border-radius: 0.8rem;
		background: var(--gold);
		color: var(--on-gold);
		font-weight: 900;
		letter-spacing: -0.04em;
		text-decoration: none;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.item {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		border-radius: 0.8rem;
		color: rgb(255 255 255 / 0.5);
	}

	.item.on {
		background: rgb(245 197 66 / 0.14);
		color: var(--gold);
	}

	.item[aria-disabled='true'] {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
