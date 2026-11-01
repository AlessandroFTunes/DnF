<script lang="ts">
	import { criarGrid, grids as buscarGrids } from '../api.remote';

	let { mesaId }: { mesaId: string } = $props();

	let dialog = $state<HTMLDialogElement>();
	let arquivo = $state<HTMLInputElement>();
	let previa = $state<string>();
	let failure = $state<string>();

	export function abrir() {
		failure = undefined;
		dialog?.showModal();
	}

	function escolherImagem(input: HTMLInputElement) {
		if (previa) URL.revokeObjectURL(previa);
		const file = input.files?.[0];
		previa = file ? URL.createObjectURL(file) : undefined;
	}
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="nova-grid-titulo"
	onclick={(e) => e.target === dialog && dialog.close()}
>
	<form
		enctype="multipart/form-data"
		{...criarGrid.enhance(async ({ submit }) => {
			failure = undefined;
			try {
				await submit();
				if (criarGrid.result?.ok) {
					dialog?.close();
					previa = undefined;
					void buscarGrids(mesaId).refresh();
				}
			} catch {
				failure = 'Não foi possível falar com o servidor. Tente de novo.';
			}
		})}
	>
		<h2 id="nova-grid-titulo">Nova grid</h2>
		<input {...criarGrid.fields.mesaId.as('hidden', mesaId)} />

		<button type="button" class="mapa" aria-label="Escolher o mapa" onclick={() => arquivo?.click()}>
			{#if previa}
				<img src={previa} alt="Prévia do mapa" />
				<span class="trocar">Trocar imagem</span>
			{:else}
				<strong>Escolher o mapa</strong>
				<small>PNG, JPG, WebP ou GIF, até 30 MB</small>
			{/if}
		</button>
		<input
			bind:this={arquivo}
			class="oculto"
			accept="image/png,image/jpeg,image/webp,image/gif"
			onchange={(e) => escolherImagem(e.currentTarget)}
			{...criarGrid.fields.image.as('file')}
		/>
		{#each criarGrid.fields.image.issues() ?? [] as issue (issue.message)}
			<em role="alert">{issue.message}</em>
		{/each}

		<label>
			<span>Nome</span>
			<input
				autocomplete="off"
				maxlength="64"
				{...criarGrid.fields.name.as('text')}
				aria-invalid={criarGrid.fields.name.issues()?.length ? 'true' : undefined}
			/>
			{#each criarGrid.fields.name.issues() ?? [] as issue (issue.message)}
				<em role="alert">{issue.message}</em>
			{/each}
		</label>

		{#if failure}<p class="falha" role="alert">{failure}</p>{/if}

		<footer>
			<button type="button" class="sec" onclick={() => dialog?.close()}>Cancelar</button>
			<button type="submit" class="salvar" disabled={criarGrid.pending > 0}>
				{criarGrid.pending > 0 ? 'Aguarde…' : 'Criar'}
			</button>
		</footer>
	</form>
</dialog>

<style>
	dialog {
		width: min(36rem, calc(100vw - 2rem));
		max-height: calc(100vh - 2rem);
		padding: 0;
		overflow: auto;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 1.2rem;
		background: #14101f;
		color: #fff;
		box-shadow: 0 2rem 5rem rgb(0 0 0 / 0.7);
	}

	dialog::backdrop {
		background: rgb(2 3 10 / 0.7);
		backdrop-filter: blur(4px);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.6rem;
	}

	h2 {
		margin: 0;
		font-size: 1.4rem;
	}

	.mapa {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		overflow: hidden;
		width: 100%;
		aspect-ratio: 16 / 9;
		padding: 0;
		border: 1px dashed rgb(255 255 255 / 0.3);
		border-radius: 1rem;
		background: rgb(10 7 22 / 0.8);
		color: #fff;
		cursor: pointer;
	}

	.mapa img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.mapa small {
		color: rgb(255 255 255 / 0.5);
	}

	.trocar {
		position: absolute;
		right: 0.8rem;
		bottom: 0.8rem;
		padding: 0.4rem 0.9rem;
		border-radius: 999px;
		background: rgb(2 3 10 / 0.75);
		font-size: 0.85rem;
		font-weight: 700;
	}

	.oculto {
		display: none;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.85rem;
		font-weight: 700;
	}

	input:not([type='file'], [type='hidden']) {
		padding: 0.8rem 1rem;
		border: 1px solid rgb(255 255 255 / 0.25);
		border-radius: 0.8rem;
		background: rgb(10 7 22 / 0.8);
		color: #fff;
		font: inherit;
	}

	em,
	.falha {
		margin: 0;
		color: var(--danger);
		font-size: 0.85rem;
		font-style: normal;
	}

	footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
	}

	footer button {
		padding: 0.7rem 1.4rem;
		border: 0;
		border-radius: 999px;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.sec {
		background: transparent;
		color: #fff;
		border: 1px solid rgb(255 255 255 / 0.3);
	}

	.salvar {
		background: var(--gold);
		color: var(--on-gold);
	}

	.salvar:disabled {
		opacity: 0.6;
	}
</style>
