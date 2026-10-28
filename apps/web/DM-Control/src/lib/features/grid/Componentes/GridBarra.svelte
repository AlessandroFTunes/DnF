<script lang="ts">
	import type { Component } from 'svelte';
	import type { Tool } from '@dnf/core/gridpixi';
	import AppWindow from '@lucide/svelte/icons/app-window';
	import BrickWall from '@lucide/svelte/icons/brick-wall';
	import Circle from '@lucide/svelte/icons/circle';
	import DoorOpen from '@lucide/svelte/icons/door-open';
	import Eraser from '@lucide/svelte/icons/eraser';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Lightbulb from '@lucide/svelte/icons/lightbulb';
	import Minus from '@lucide/svelte/icons/minus';
	import MousePointer2 from '@lucide/svelte/icons/mouse-pointer-2';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Square from '@lucide/svelte/icons/square';
	import Type from '@lucide/svelte/icons/type';
	import UserPlus from '@lucide/svelte/icons/user-plus';

	let {
		ferramenta,
		cor = $bindable(),
		largura = $bindable(),
		snap = $bindable(),
		onferramenta,
		onestilo
	}: {
		ferramenta: Tool;
		cor: string;
		largura: number;
		snap: boolean;
		onferramenta: (tool: Tool) => void;
		onestilo: () => void;
	} = $props();

	type Item = { id: Tool; nome: string; icone: Component<{ size?: number; strokeWidth?: number }> };
	const grupos: Item[][] = [
		[{ id: 'select', nome: 'Selecionar e mover (V)', icone: MousePointer2 }],
		[
			{ id: 'pen', nome: 'Caneta', icone: Pencil },
			{ id: 'line', nome: 'Linha', icone: Minus },
			{ id: 'rect', nome: 'Retângulo', icone: Square },
			{ id: 'ellipse', nome: 'Elipse', icone: Circle },
			{ id: 'text', nome: 'Texto', icone: Type }
		],
		[
			{ id: 'wall', nome: 'Parede (bloqueia luz e visão)', icone: BrickWall },
			{ id: 'door', nome: 'Porta (clique para abrir/fechar)', icone: DoorOpen },
			{ id: 'window', nome: 'Janela (deixa a luz passar)', icone: AppWindow },
			{ id: 'light', nome: 'Luz', icone: Lightbulb }
		],
		[
			{ id: 'token', nome: 'Adicionar token', icone: UserPlus },
			{ id: 'reveal', nome: 'Revelar área do fog', icone: Eye },
			{ id: 'conceal', nome: 'Esconder área do fog', icone: EyeOff },
			{ id: 'eraser', nome: 'Borracha', icone: Eraser }
		]
	];
</script>

<div class="barra" role="toolbar" aria-label="Ferramentas" aria-orientation="vertical">
	{#each grupos as grupo, i (i)}
		<div class="grupo">
			{#each grupo as item (item.id)}
				<button
					type="button"
					class:on={ferramenta === item.id}
					aria-pressed={ferramenta === item.id}
					title={item.nome}
					aria-label={item.nome}
					onclick={() => onferramenta(item.id)}
				>
					<item.icone size={20} strokeWidth={1.8} />
				</button>
			{/each}
		</div>
	{/each}

	<div class="grupo estilo">
		<input type="color" bind:value={cor} oninput={onestilo} title="Cor" aria-label="Cor" />
		<input
			type="range"
			min="1"
			max="24"
			bind:value={largura}
			oninput={onestilo}
			title="Espessura"
			aria-label="Espessura"
		/>
		<label title="Alinhar à grade">
			<input type="checkbox" bind:checked={snap} />
			<span>Grade</span>
		</label>
	</div>
</div>

<style>
	.barra {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 3.6rem;
		padding: 0.5rem;
		overflow-y: auto;
		background: #0e0b17;
		border-right: 1px solid rgb(255 255 255 / 0.08);
	}

	.grupo {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
	}

	button {
		display: grid;
		place-items: center;
		height: 2.6rem;
		padding: 0;
		border: 0;
		border-radius: 0.6rem;
		background: transparent;
		color: rgb(255 255 255 / 0.65);
		cursor: pointer;
	}

	button:hover {
		background: rgb(255 255 255 / 0.08);
	}

	button.on {
		background: rgb(245 197 66 / 0.18);
		color: var(--gold);
	}

	.estilo {
		align-items: center;
		border: 0;
		font-size: 0.65rem;
		color: rgb(255 255 255 / 0.6);
	}

	.estilo input[type='color'] {
		width: 2.4rem;
		height: 2rem;
		padding: 0;
		border: 0;
		background: none;
	}

	.estilo input[type='range'] {
		width: 2.6rem;
	}

	.estilo label {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.1rem;
	}
</style>
