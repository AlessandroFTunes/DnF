<script lang="ts">
	import { editarMesa, mesa as buscarMesa } from '../api.remote';

	let {
		mesa
	}: {
		mesa: { id: string; name: string; description: string; image: string | null };
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	let arquivo = $state<HTMLInputElement>();
	let previa = $state<string>();
	let failure = $state<string>();

	// Chamado pelo lápis do card (via bind:this).
	export function abrir() {
		failure = undefined;
		dialog?.showModal();
	}

	function escolherImagem(input: HTMLInputElement) {
		if (previa) URL.revokeObjectURL(previa);
		const file = input.files?.[0];
		previa = file ? URL.createObjectURL(file) : undefined;
	}

	const imagemAtual = $derived(previa ?? mesa.image);
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="editar-mesa-titulo"
	onclick={(e) => e.target === dialog && dialog.close()}
>
	<form
		enctype="multipart/form-data"
		{...editarMesa.enhance(async ({ submit }) => {
			failure = undefined;
			try {
				await submit();
				if (editarMesa.result?.ok) {
					dialog?.close();
					previa = undefined;
					void buscarMesa(mesa.id).refresh();
				}
			} catch {
				failure = 'Não foi possível falar com o servidor. Tente de novo.';
			}
		})}
	>
		<h2 id="editar-mesa-titulo">Editar mesa</h2>
		<input {...editarMesa.fields.id.as('hidden', mesa.id)} />

		<button type="button" class="capa" aria-label="Trocar imagem" onclick={() => arquivo?.click()}>
			{#if imagemAtual}
				<img src={imagemAtual} alt="Imagem da mesa" />
				<span class="trocar">Trocar imagem</span>
			{:else}
				<strong>Escolher imagem</strong>
				<small>JPG, PNG ou WebP, até 30 MB</small>
			{/if}
		</button>
		<input
			bind:this={arquivo}
			class="oculto"
			accept="image/jpeg,image/png,image/webp"
			onchange={(e) => escolherImagem(e.currentTarget)}
			{...editarMesa.fields.image.as('file')}
		/>
		{#each editarMesa.fields.image.issues() ?? [] as issue (issue.message)}
			<em role="alert">{issue.message}</em>
		{/each}

		<label>
			<span>Título</span>
			<input
				autocomplete="off"
				maxlength="64"
				{...editarMesa.fields.name.as('text')}
				value={mesa.name}
				aria-invalid={editarMesa.fields.name.issues()?.length ? 'true' : undefined}
			/>
			{#each editarMesa.fields.name.issues() ?? [] as issue (issue.message)}
				<em role="alert">{issue.message}</em>
			{/each}
		</label>

		<label>
			<span>Descrição</span>
			<textarea rows="5" maxlength="2000" {...editarMesa.fields.description.as('text')}
				>{mesa.description}</textarea
			>
			{#each editarMesa.fields.description.issues() ?? [] as issue (issue.message)}
				<em role="alert">{issue.message}</em>
			{/each}
		</label>

		{#if failure}<p class="falha" role="alert">{failure}</p>{/if}

		<footer>
			<button type="button" class="sec" onclick={() => dialog?.close()}>Cancelar</button>
			<button type="submit" class="salvar" disabled={editarMesa.pending > 0}>
				{editarMesa.pending > 0 ? 'Aguarde…' : 'Salvar'}
			</button>
		</footer>
	</form>
</dialog>

<style>
	dialog {
		width: min(40rem, calc(100vw - 2rem));
		max-height: calc(100vh - 2rem);
		padding: 0;
		overflow: auto;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 1.2rem;
		background: #14101f;
		color: #fff;
		text-align: left;
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

	.capa {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		overflow: hidden;
		width: 100%;
		aspect-ratio: 21 / 9;
		padding: 0;
		border: 1px dashed rgb(255 255 255 / 0.3);
		border-radius: 1rem;
		background: rgb(10 7 22 / 0.8);
		color: #fff;
		cursor: pointer;
	}

	.capa img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.capa small {
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

	input:not([type='file'], [type='hidden']),
	textarea {
		padding: 0.8rem 1rem;
		border: 1px solid rgb(255 255 255 / 0.25);
		border-radius: 0.8rem;
		background: rgb(10 7 22 / 0.8);
		color: #fff;
		font: inherit;
		font-weight: 400;
		resize: vertical;
	}

	input:focus-visible,
	textarea:focus-visible {
		outline: 2px solid var(--gold);
		outline-offset: 1px;
	}

	[aria-invalid='true'] {
		border-color: var(--danger);
	}

	em,
	.falha {
		margin: 0;
		font-size: 0.85rem;
		font-style: normal;
		color: var(--danger);
	}

	footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
	}

	.sec,
	.salvar {
		padding: 0.7rem 1.3rem;
		border-radius: 999px;
		font-weight: 700;
		cursor: pointer;
	}

	.sec {
		border: 1px solid rgb(255 255 255 / 0.25);
		background: none;
		color: #fff;
	}

	.salvar {
		border: 0;
		background: var(--gold);
		color: var(--on-gold);
		font-weight: 800;
	}

	.salvar:disabled {
		opacity: 0.6;
		cursor: wait;
	}
</style>
