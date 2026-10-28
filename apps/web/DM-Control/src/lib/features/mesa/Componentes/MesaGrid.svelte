<script lang="ts">
	import { mesa } from '../api.remote';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Swords from '@lucide/svelte/icons/swords';
	import MesaPlayers from './MesaPlayers.svelte';
	import MesaSobre from './MesaSobre.svelte';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import { resolve } from '$app/paths';
	import MesaCard from './MesaCard.svelte';

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

	<div class="grid">
		<MesaPlayers players={m.players} inviteCode={m.inviteCode} />

		<div class="cards">
			<MesaSobre mesa={m} />
			<MesaCard
				titulo="Mapas de combate"
				icone={LayoutGrid}
				texto="Grid com tokens, fog of war, iluminação dinâmica e desenhos, e a visão para mostrar aos jogadores."
				href={resolve('/mesa/[id]/mapas', { id })}
				acao="Abrir mapas"
			/>
			<MesaCard
				titulo="Encontros rápidos"
				icone={Swords}
				texto="Monte um encontro em segundos com as criaturas do bestiário."
			/>
			<MesaCard
				titulo="Regras da Mesa"
				icone={ScrollText}
				texto="Registre as regras da casa para que todos joguem do mesmo jeito."
			/>
			<MesaCard
				titulo="AI help"
				icone={Sparkles}
				texto="Peça ajuda para improvisar NPCs, nomes e ganchos de aventura."
			/>
		</div>
	</div>
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.2rem;
		align-items: start;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
		gap: 1.2rem;
	}

	.aviso {
		color: rgb(255 255 255 / 0.6);
	}

	.aviso[role='alert'] {
		color: var(--danger);
	}

	@media (min-width: 64rem) {
		.grid {
			grid-template-columns: 22rem 1fr;
		}
	}
</style>
