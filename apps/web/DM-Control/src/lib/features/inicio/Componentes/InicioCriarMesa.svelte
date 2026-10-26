<script lang="ts">
	import { criarMesa, inicio } from '../api.remote';

	const abas = [
		{ id: 'geral', titulo: 'Geral', texto: 'Nome e descrição' },
		{ id: 'regras', titulo: 'Regras', texto: 'Edição do D&D' }
	] as const;

	const edicoes = [
		{ valor: '2024', titulo: 'D&D 2024', texto: 'Regras revisadas (5.5e)' },
		{ valor: '2014', titulo: 'D&D 2014', texto: 'Regras clássicas (5e)' }
	] as const;

	let dialog = $state<HTMLDialogElement>();
	let arquivo = $state<HTMLInputElement>();
	let aba = $state<(typeof abas)[number]['id']>('geral');
	let failure = $state<string>();
	let previa = $state<string>();

	function escolherImagem(input: HTMLInputElement) {
		if (previa) URL.revokeObjectURL(previa);
		const file = input.files?.[0];
		previa = file ? URL.createObjectURL(file) : undefined;
	}

	function removerImagem(input: HTMLInputElement) {
		input.value = '';
		escolherImagem(input);
	}

	// Erro de campo mora em outra aba: leva a pessoa até ele.
	const comErro = $derived(
		criarMesa.fields.edition.issues()?.length
			? 'regras'
			: criarMesa.fields.name.issues()?.length || criarMesa.fields.image.issues()?.length
				? 'geral'
				: undefined
	);
</script>

<button type="button" class="abrir" onclick={() => dialog?.showModal()}>Criar mesa</button>

<dialog
	bind:this={dialog}
	aria-labelledby="criar-mesa-titulo"
	onclick={(e) => e.target === dialog && dialog.close()}
>
	<form
		{...criarMesa.enhance(async ({ submit }) => {
			failure = undefined;
			try {
				await submit();
				if (criarMesa.result?.ok) {
					dialog?.close();
					await inicio().refresh();
				} else if (comErro) {
					aba = comErro;
				}
			} catch {
				failure = 'Não foi possível falar com o servidor. Tente de novo.';
			}
		})}
	>
		<aside>
			<h2 id="criar-mesa-titulo">Criar mesa</h2>

			<nav aria-label="Etapas">
				{#each abas as item (item.id)}
					<button
						type="button"
						class="aba"
						class:on={aba === item.id}
						aria-current={aba === item.id ? 'step' : undefined}
						onclick={() => (aba = item.id)}
					>
						<strong>{item.titulo}</strong>
						<span>{item.texto}</span>
					</button>
				{/each}
			</nav>
		</aside>

		<div class="conteudo">
			<button type="button" class="fechar" aria-label="Fechar" onclick={() => dialog?.close()}>
				×
			</button>

			<div class="capa" hidden={aba !== 'geral'}>
				<button
					type="button"
					class="envio"
					class:cheia={previa}
					aria-label={previa ? 'Trocar imagem' : 'Escolher imagem'}
					onclick={() => arquivo?.click()}
				>
					{#if previa}
						<img src={previa} alt="Prévia da imagem da mesa" />
						<span class="trocar">Trocar imagem</span>
					{:else}
						<strong>Escolher imagem</strong>
						<small>Imagem de capa (opcional) · JPG, PNG ou WebP, até 5 MB</small>
					{/if}
				</button>
				{#if previa && arquivo}
					<button type="button" class="link" onclick={() => removerImagem(arquivo!)}>
						Remover imagem
					</button>
				{/if}
				<input
					bind:this={arquivo}
					class="oculto"
					accept="image/jpeg,image/png,image/webp"
					onchange={(e) => escolherImagem(e.currentTarget)}
					{...criarMesa.fields.image.as('file')}
				/>
				{#each criarMesa.fields.image.issues() ?? [] as issue (issue.message)}
					<em role="alert">{issue.message}</em>
				{/each}
			</div>

			<section hidden={aba !== 'geral'}>
				<label>
					<span>Nome da Campanha</span>
					<input
						autocomplete="off"
						maxlength="64"
						{...criarMesa.fields.name.as('text')}
						aria-invalid={criarMesa.fields.name.issues()?.length ? 'true' : undefined}
					/>
					{#each criarMesa.fields.name.issues() ?? [] as issue (issue.message)}
						<em role="alert">{issue.message}</em>
					{/each}
				</label>
				<label>
					<span>Descrição <small>(opcional)</small></span>
					<textarea rows="6" maxlength="2000" {...criarMesa.fields.description.as('text')}
					></textarea>
					{#each criarMesa.fields.description.issues() ?? [] as issue (issue.message)}
						<em role="alert">{issue.message}</em>
					{/each}
				</label>
			</section>

			<section hidden={aba !== 'regras'}>
				<h3>Regras</h3>
				<p class="dica">
					Os personagens que entrarem precisam ser da mesma edição. Não dá para trocar depois.
				</p>
				{#each edicoes as ed, i (ed.valor)}
					<label class="opcao">
						<input type="radio" name="edition" value={ed.valor} checked={i === 0} />
						<span><strong>{ed.titulo}</strong><small>{ed.texto}</small></span>
					</label>
				{/each}
				{#each criarMesa.fields.edition.issues() ?? [] as issue (issue.message)}
					<em role="alert">{issue.message}</em>
				{/each}
			</section>

			{#if failure}<p class="falha" role="alert">{failure}</p>{/if}

			<footer>
				<button type="button" class="sec" onclick={() => dialog?.close()}>Cancelar</button>
				<button type="submit" class="criar" disabled={criarMesa.pending > 0}>
					{criarMesa.pending > 0 ? 'Aguarde…' : 'Criar mesa'}
				</button>
			</footer>
		</div>
	</form>
</dialog>

<style>
	.abrir,
	.criar {
		padding: 0.7rem 1.3rem;
		border: 0;
		border-radius: 999px;
		background: var(--gold);
		color: var(--on-gold);
		font-size: 0.95rem;
		font-weight: 800;
		cursor: pointer;
	}

	.abrir:hover,
	.criar:hover:not(:disabled) {
		filter: brightness(1.08);
	}

	.criar:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	dialog {
		width: min(64rem, calc(100vw - 2rem));
		max-height: calc(100vh - 2rem);
		overflow: auto;
		text-align: left;
		padding: 0;
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
		display: grid;
		grid-template-columns: 1fr;
		min-height: min(40rem, calc(100vh - 4rem));
	}

	aside {
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		padding: 1.4rem;
		background: #0e0b17;
	}

	aside h2 {
		margin: 0;
		font-size: 1.15rem;
	}

	nav {
		display: flex;
		gap: 0.4rem;
	}

	.aba {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.6rem 0.8rem;
		border: 0;
		border-radius: 0.6rem;
		background: none;
		color: rgb(255 255 255 / 0.6);
		text-align: left;
		cursor: pointer;
	}

	.aba span {
		font-size: 0.75rem;
		color: rgb(255 255 255 / 0.4);
	}

	.aba.on {
		background: rgb(255 255 255 / 0.08);
		color: #fff;
	}

	.conteudo {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
	}

	.conteudo > section,
	.falha,
	footer {
		margin-inline: 1.6rem;
	}

	.conteudo > section:first-of-type {
		margin-top: 0.4rem;
	}

	footer {
		margin-bottom: 1.6rem;
	}

	.fechar {
		z-index: 1;
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: rgb(2 3 10 / 0.6);
		position: absolute;
		top: 0.8rem;
		right: 1rem;
		border: 0;
		color: rgb(255 255 255 / 0.6);
		font-size: 1.6rem;
		line-height: 1;
		cursor: pointer;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	section[hidden] {
		display: none;
	}

	h3 {
		margin: 0;
		font-size: 1.4rem;
		letter-spacing: -0.02em;
	}

	.rotulo {
		font-size: 0.85rem;
		font-weight: 700;
	}

	.capa {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.capa[hidden] {
		display: none;
	}

	.capa > .link,
	.capa > em {
		margin-inline: 1.6rem;
	}

	.envio {
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
		border: 0;
		border-bottom: 1px dashed rgb(255 255 255 / 0.3);
		border-radius: 0;
		background: rgb(10 7 22 / 0.8);
		color: #fff;
		cursor: pointer;
	}

	.envio:hover {
		background: rgb(245 197 66 / 0.08);
	}

	.envio.cheia {
		border-bottom-style: solid;
	}

	.envio strong {
		font-size: 1.1rem;
	}

	.envio small {
		color: rgb(255 255 255 / 0.45);
	}

	.envio img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
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

	.link {
		align-self: flex-start;
		border: 0;
		background: none;
		color: var(--danger);
		font-weight: 700;
		cursor: pointer;
	}

	.oculto {
		display: none;
	}

	.dica {
		margin: 0;
		font-size: 0.9rem;
		color: rgb(255 255 255 / 0.55);
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.85rem;
		font-weight: 700;
	}

	label small {
		font-weight: 400;
		color: rgb(255 255 255 / 0.45);
	}

	input:not([type='radio'], [type='file']),
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

	.opcao {
		flex-direction: row;
		align-items: center;
		gap: 0.8rem;
		padding: 0.9rem 1rem;
		border: 1px solid rgb(255 255 255 / 0.2);
		border-radius: 0.8rem;
		cursor: pointer;
	}

	.opcao:has(input:checked) {
		border-color: var(--gold);
		background: rgb(245 197 66 / 0.08);
	}

	.opcao span {
		display: flex;
		flex-direction: column;
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
		margin-top: auto;
	}

	.sec {
		padding: 0.7rem 1.3rem;
		border: 1px solid rgb(255 255 255 / 0.25);
		border-radius: 999px;
		background: none;
		color: #fff;
		font-weight: 700;
		cursor: pointer;
	}

	@media (min-width: 40rem) {
		form {
			grid-template-columns: 13rem 1fr;
		}

		nav {
			flex-direction: column;
		}
	}
</style>
