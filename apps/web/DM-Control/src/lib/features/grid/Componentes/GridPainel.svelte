<script lang="ts">
	import type { GridPixi, Selection } from '@dnf/core/gridpixi';
	import type { Grid } from '@dnf/core/grid';
	import Trash from '@lucide/svelte/icons/trash';

	let {
		cena,
		selecao,
		controlador
	}: { cena: Grid.Scene; selecao: Selection | null; controlador: GridPixi | undefined } = $props();

	const token = $derived(
		selecao?.kind === 'token' ? cena.tokens.find((t) => t.id === selecao.id) : undefined
	);
	const luz = $derived(
		selecao?.kind === 'light' ? cena.lights.find((l) => l.id === selecao.id) : undefined
	);
	const parede = $derived(
		selecao?.kind === 'wall' ? cena.walls.find((w) => w.id === selecao.id) : undefined
	);
	const desenho = $derived(
		selecao?.kind === 'drawing' ? cena.drawings.find((d) => d.id === selecao.id) : undefined
	);

	function numero(e: Event, fallback = 0) {
		const valor = Number((e.currentTarget as HTMLInputElement).value);
		return Number.isFinite(valor) ? valor : fallback;
	}

	function editar(mutar: (scene: Grid.Scene) => void) {
		controlador?.edit(mutar);
	}

	function editarToken(patch: Partial<Omit<Grid.Token, 'id'>>) {
		if (token) controlador?.updateToken(token.id, patch);
	}
</script>

<aside>
	<section>
		<h3>Grade</h3>
		<label>
			<span>Tamanho da célula (px do mapa)</span>
			<input
				type="number"
				min="8"
				max="1000"
				value={cena.cell.size}
				onchange={(e) => editar((s) => (s.cell.size = Math.min(1000, Math.max(8, numero(e, 70)))))}
			/>
		</label>
		<div class="duas">
			<label>
				<span>Deslocar X</span>
				<input type="number" value={cena.cell.offsetX} onchange={(e) => editar((s) => (s.cell.offsetX = numero(e)))} />
			</label>
			<label>
				<span>Deslocar Y</span>
				<input type="number" value={cena.cell.offsetY} onchange={(e) => editar((s) => (s.cell.offsetY = numero(e)))} />
			</label>
		</div>
		<label>
			<span>Pés por célula</span>
			<input
				type="number"
				min="1"
				value={cena.cell.feet}
				onchange={(e) => editar((s) => (s.cell.feet = Math.max(1, numero(e, 5))))}
			/>
		</label>
		<label class="check">
			<input type="checkbox" checked={cena.cell.show} onchange={(e) => editar((s) => (s.cell.show = e.currentTarget.checked))} />
			<span>Mostrar a grade</span>
		</label>
	</section>

	<section>
		<h3>Fog of war</h3>
		<label class="check">
			<input type="checkbox" checked={cena.fog.enabled} onchange={(e) => editar((s) => (s.fog.enabled = e.currentTarget.checked))} />
			<span>Ativar fog</span>
		</label>
		<div class="duas">
			<button type="button" onclick={() => controlador?.revealAll()}>Revelar tudo</button>
			<button type="button" onclick={() => controlador?.resetFog()}>Cobrir tudo</button>
		</div>
		<small>Use “Revelar” e “Esconder” na barra para desenhar áreas. Com a iluminação ligada, os tokens de jogador revelam o que enxergam.</small>
	</section>

	<section>
		<h3>Iluminação dinâmica</h3>
		<label class="check">
			<input type="checkbox" checked={cena.lighting.enabled} onchange={(e) => editar((s) => (s.lighting.enabled = e.currentTarget.checked))} />
			<span>Ativar (paredes, luzes e visão)</span>
		</label>
		<label>
			<span>Luz ambiente: {Math.round(cena.lighting.ambient * 100)}%</span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.05"
				value={cena.lighting.ambient}
				oninput={(e) => editar((s) => (s.lighting.ambient = numero(e)))}
			/>
		</label>
	</section>

	{#if token}
		<section>
			<h3>Token</h3>
			<label>
				<span>Nome</span>
				<input value={token.name} maxlength="64" onchange={(e) => editarToken({ name: e.currentTarget.value.trim() || token.name })} />
			</label>
			<div class="duas">
				<label>
					<span>Tamanho (células)</span>
					<input type="number" min="0.5" max="12" step="0.5" value={token.size} onchange={(e) => editarToken({ size: Math.min(12, Math.max(0.5, numero(e, 1))) })} />
				</label>
				<label>
					<span>Cor</span>
					<input type="color" value={token.color} oninput={(e) => editarToken({ color: e.currentTarget.value })} />
				</label>
			</div>
			<label class="check">
				<input type="checkbox" checked={token.player} onchange={(e) => editarToken({ player: e.currentTarget.checked })} />
				<span>Personagem de jogador (enxerga e revela)</span>
			</label>
			<label class="check">
				<input type="checkbox" checked={token.hidden} onchange={(e) => editarToken({ hidden: e.currentTarget.checked })} />
				<span>Escondido dos jogadores</span>
			</label>
			<label>
				<span>Visão no escuro (pés)</span>
				<input type="number" min="0" value={token.vision} onchange={(e) => editarToken({ vision: Math.max(0, numero(e)) })} />
			</label>
			<label class="check">
				<input
					type="checkbox"
					checked={token.light !== null}
					onchange={(e) => editarToken({ light: e.currentTarget.checked ? { bright: 20, dim: 20, color: '#ffd9a0' } : null })}
				/>
				<span>Carrega uma luz (tocha)</span>
			</label>
			{#if token.light}
				{@const luzToken = token.light}
				<div class="duas">
					<label>
						<span>Clara (pés)</span>
						<input type="number" min="0" value={luzToken.bright} onchange={(e) => editarToken({ light: { ...luzToken, bright: Math.max(0, numero(e)) } })} />
					</label>
					<label>
						<span>Penumbra (pés)</span>
						<input type="number" min="0" value={luzToken.dim} onchange={(e) => editarToken({ light: { ...luzToken, dim: Math.max(0, numero(e)) } })} />
					</label>
				</div>
			{/if}
		</section>
	{:else if luz}
		<section>
			<h3>Luz</h3>
			<div class="duas">
				<label>
					<span>Clara (pés)</span>
					<input type="number" min="0" value={luz.bright} onchange={(e) => controlador?.updateLight(luz.id, { bright: Math.max(0, numero(e)) })} />
				</label>
				<label>
					<span>Penumbra (pés)</span>
					<input type="number" min="0" value={luz.dim} onchange={(e) => controlador?.updateLight(luz.id, { dim: Math.max(0, numero(e)) })} />
				</label>
			</div>
			<label>
				<span>Cor</span>
				<input type="color" value={luz.color} oninput={(e) => controlador?.updateLight(luz.id, { color: e.currentTarget.value })} />
			</label>
		</section>
	{:else if parede}
		<section>
			<h3>{parede.kind === 'door' ? 'Porta' : parede.kind === 'window' ? 'Janela' : 'Parede'}</h3>
			{#if parede.kind === 'door'}
				<label class="check">
					<input
						type="checkbox"
						checked={parede.open}
						onchange={(e) => editar((s) => { const w = s.walls.find((x) => x.id === parede.id); if (w) w.open = e.currentTarget.checked; })}
					/>
					<span>Aberta</span>
				</label>
			{/if}
		</section>
	{:else if desenho}
		<section>
			<h3>Desenho</h3>
			<label class="check">
				<input
					type="checkbox"
					checked={desenho.hidden}
					onchange={(e) => editar((s) => { const d = s.drawings.find((x) => x.id === desenho.id); if (d) d.hidden = e.currentTarget.checked; })}
				/>
				<span>Escondido dos jogadores</span>
			</label>
		</section>
	{/if}

	{#if selecao}
		<button type="button" class="apagar" onclick={() => controlador?.removeSelected()}>
			<Trash size={16} aria-hidden="true" /> Apagar selecionado
		</button>
	{/if}
</aside>

<style>
	aside {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 18rem;
		padding: 1rem;
		overflow-y: auto;
		background: #0e0b17;
		border-left: 1px solid rgb(255 255 255 / 0.08);
		font-size: 0.85rem;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
	}

	h3 {
		margin: 0;
		font-size: 0.8rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--gold);
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-weight: 700;
	}

	label.check {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		font-weight: 400;
	}

	.duas {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	input:not([type='checkbox'], [type='range'], [type='color']) {
		width: 100%;
		box-sizing: border-box;
		padding: 0.45rem 0.6rem;
		border: 1px solid rgb(255 255 255 / 0.2);
		border-radius: 0.5rem;
		background: rgb(10 7 22 / 0.8);
		color: #fff;
		font: inherit;
	}

	input[type='color'] {
		width: 100%;
		height: 2rem;
		padding: 0;
		border: 0;
		background: none;
	}

	small {
		color: rgb(255 255 255 / 0.5);
		line-height: 1.4;
	}

	button {
		padding: 0.5rem 0.7rem;
		border: 1px solid rgb(255 255 255 / 0.2);
		border-radius: 0.6rem;
		background: transparent;
		color: #fff;
		font: inherit;
		cursor: pointer;
	}

	button:hover {
		background: rgb(255 255 255 / 0.08);
	}

	.apagar {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		border-color: var(--danger);
		color: var(--danger);
	}
</style>
