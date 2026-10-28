<script lang="ts">
	import { resolve } from '$app/paths';
	import { beforeNavigate } from '$app/navigation';
	import type { GridPixi, Selection, Tool } from '@dnf/core/gridpixi';
	import type { Grid } from '@dnf/core/grid';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Maximize from '@lucide/svelte/icons/maximize';
	import MonitorPlay from '@lucide/svelte/icons/monitor-play';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';
	import { salvarCena } from '../api.remote';
	import GridBarra from './GridBarra.svelte';
	import GridCanvas from './GridCanvas.svelte';
	import GridPainel from './GridPainel.svelte';

	let {
		grid
	}: {
		grid: { id: string; mesaID: string; name: string; image: string; scene: Grid.Scene };
	} = $props();

	type Estado = 'salvo' | 'pendente' | 'salvando' | 'erro';

	let controlador = $state.raw<GridPixi>();
	let ferramenta = $state<Tool>('select');
	let cor = $state('#ffffff');
	let largura = $state(4);
	let snap = $state(true);
	let selecao = $state.raw<Selection | null>(null);
	let ultima = $state.raw<Grid.Scene>();
	let estado = $state<Estado>('salvo');
	let timer: ReturnType<typeof setTimeout> | undefined;

	// O painel mostra a última cena que o canvas avisou; antes disso, a que veio do banco.
	const cena = $derived(ultima ?? grid.scene);
	const canal = $derived(`dnf-grid-${grid.id}`);

	function mudou(nova: Grid.Scene) {
		ultima = structuredClone(nova);
		estado = 'pendente';
		clearTimeout(timer);
		timer = setTimeout(salvar, 800);
	}

	async function salvar() {
		clearTimeout(timer);
		if (!ultima) return;
		estado = 'salvando';
		const enviada = ultima;
		try {
			const resultado = await salvarCena({ id: grid.id, scene: enviada });
			if ('failure' in resultado) estado = 'erro';
			else if (ultima === enviada) estado = 'salvo';
			else estado = 'pendente';
		} catch {
			estado = 'erro';
		}
	}

	// Sair da página com alteração ainda esperando o tempo de gravar: grava agora.
	beforeNavigate(() => {
		if (estado === 'pendente') void salvar();
	});

	function escolher(tool: Tool) {
		ferramenta = tool;
		controlador?.setTool(tool);
	}

	function aplicarEstilo() {
		controlador?.setStyle({ color: cor, width: largura });
	}

	function pronto(instancia: GridPixi | undefined) {
		controlador = instancia;
		instancia?.setSnap(snap);
		instancia?.setStyle({ color: cor, width: largura });
		instancia?.setTool(ferramenta);
	}

	function teclas(e: KeyboardEvent) {
		const alvo = e.target as HTMLElement;
		if (alvo.closest('input, textarea, select')) return;
		if (e.key === 'Delete' || e.key === 'Backspace') controlador?.removeSelected();
		else if (e.key === 'Escape') escolher('select');
	}

	const rotulo: Record<Estado, string> = {
		salvo: 'Salvo',
		pendente: 'Alterações pendentes…',
		salvando: 'Salvando…',
		erro: 'Erro ao salvar'
	};
</script>

<svelte:window
	onkeydown={teclas}
	onbeforeunload={(e) => estado !== 'salvo' && e.preventDefault()}
/>

<div class="editor">
	<header>
		<a class="voltar" href={resolve('/mesa/[id]/mapas', { id: grid.mesaID })}>
			<ArrowLeft size={18} aria-hidden="true" /> Mapas
		</a>
		<h1>{grid.name}</h1>
		<span class="estado" class:erro={estado === 'erro'} role="status">{rotulo[estado]}</span>
		{#if estado === 'erro'}
			<button type="button" onclick={salvar}>Tentar de novo</button>
		{/if}
		<span class="espaco"></span>
		<button type="button" title="Diminuir" aria-label="Diminuir o zoom" onclick={() => controlador?.zoomBy(1 / 1.25)}>
			<ZoomOut size={18} />
		</button>
		<button type="button" title="Aumentar" aria-label="Aumentar o zoom" onclick={() => controlador?.zoomBy(1.25)}>
			<ZoomIn size={18} />
		</button>
		<button type="button" title="Ajustar à tela" aria-label="Ajustar à tela" onclick={() => controlador?.fit()}>
			<Maximize size={18} />
		</button>
		<a
			class="jogador"
			href={resolve('/mesa/[id]/mapas/[gridId]/jogador', { id: grid.mesaID, gridId: grid.id })}
			target="dnf-jogador"
		>
			<MonitorPlay size={18} aria-hidden="true" /> Visão do jogador
		</a>
	</header>

	<div class="corpo">
		<GridBarra
			{ferramenta}
			bind:cor
			bind:largura
			bind:snap
			onferramenta={escolher}
			onestilo={aplicarEstilo}
		/>
		<div class="palco">
			<GridCanvas
				image={grid.image}
				scene={grid.scene}
				role="gm"
				{canal}
				onready={pronto}
				onchange={mudou}
				onselect={(s) => (selecao = s)}
			/>
		</div>
		<GridPainel {cena} {selecao} {controlador} />
	</div>
</div>

<style>
	.editor {
		--gold: #f5c542;
		--danger: #ff8a8a;

		display: flex;
		flex-direction: column;
		height: 100vh;
		background: #02030a;
		color: #fff;
		font-family: var(--font-body);
	}

	header {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.5rem 1rem;
		background: #0e0b17;
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
	}

	h1 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
		text-align: left;
	}

	.espaco {
		flex: 1;
	}

	.estado {
		font-size: 0.8rem;
		color: rgb(255 255 255 / 0.55);
	}

	.estado.erro {
		color: var(--danger);
	}

	.voltar,
	.jogador,
	header button {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.7rem;
		border: 1px solid rgb(255 255 255 / 0.18);
		border-radius: 0.6rem;
		background: transparent;
		color: #fff;
		font: inherit;
		font-size: 0.85rem;
		text-decoration: none;
		cursor: pointer;
	}

	.jogador {
		border-color: var(--gold);
		color: var(--gold);
	}

	.corpo {
		display: flex;
		flex: 1;
		min-height: 0;
	}

	.palco {
		position: relative;
		flex: 1;
		min-width: 0;
	}
</style>
