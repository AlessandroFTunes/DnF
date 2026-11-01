<script lang="ts">
	import { untrack } from 'svelte';
	import { GridPixi, type Selection } from '@dnf/core/gridpixi';
	import type { Grid } from '@dnf/core/grid';

	let {
		image,
		scene,
		role,
		canal,
		onready,
		onchange,
		onselect
	}: {
		image: string;
		scene: Grid.Scene;
		role: 'gm' | 'player';
		/** Nome do BroadcastChannel: o mestre envia a cena, a visão do jogador recebe. */
		canal?: string;
		onready?: (grid: GridPixi | undefined) => void;
		onchange?: (scene: Grid.Scene) => void;
		onselect?: (selection: Selection | null) => void;
	} = $props();

	let falha = $state<string>();

	// O canvas é montado uma vez; trocar de mapa recarrega a página. Por isso as props são lidas sem rastrear.
	function montar(host: HTMLElement) {
		const opcoes = untrack(() => ({
			image,
			role,
			canal,
			scene: structuredClone($state.snapshot(scene)) as Grid.Scene
		}));
		const channel = opcoes.canal ? new BroadcastChannel(opcoes.canal) : undefined;
		let vivo = true;
		let instancia: GridPixi | undefined;

		GridPixi.create({
			host,
			role: opcoes.role,
			mapUrl: opcoes.image,
			scene: opcoes.scene,
			resolveUrl: (path) => `/nas/${path}`,
			onChange: (nova) => {
				onchange?.(nova);
				if (opcoes.role === 'gm') channel?.postMessage($state.snapshot(nova));
			},
			onSelect: (selection) => onselect?.(selection)
		}).then(
			(grid) => {
				if (!vivo) return grid.destroy();
				instancia = grid;
				if (opcoes.role === 'player' && channel) {
					channel.onmessage = (e) => grid.setScene(e.data as Grid.Scene);
				}
				onready?.(grid);
			},
			(erro) => {
				console.error('[grid] canvas', erro);
				falha = 'Não foi possível carregar a imagem do mapa.';
			}
		);

		return () => {
			vivo = false;
			channel?.close();
			instancia?.destroy();
			onready?.(undefined);
		};
	}
</script>

<div class="host" {@attach montar}></div>
{#if falha}<p class="falha" role="alert">{falha}</p>{/if}

<style>
	.host {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.host :global(canvas) {
		display: block;
		touch-action: none;
	}

	.falha {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		margin: 0;
		color: var(--danger);
	}
</style>
