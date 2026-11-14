<script lang="ts">
	/**
	 * Fim dos formulários em diálogo: a falha do envio (se houver) e os botões "Cancelar" e de enviar. Não cria
	 * wrapper: `p.falha` e `footer` entram direto no layout do formulário que os usa.
	 */
	let {
		failure,
		pending,
		label,
		oncancel
	}: { failure?: string; pending: boolean; label: string; oncancel: () => void } = $props();
</script>

{#if failure}<p class="falha" role="alert">{failure}</p>{/if}

<footer>
	<button type="button" class="sec" onclick={oncancel}>Cancelar</button>
	<button type="submit" class="enviar" disabled={pending}>{pending ? 'Aguarde…' : label}</button>
</footer>

<style>
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

	button {
		padding: 0.7rem 1.3rem;
		border-radius: 999px;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.sec {
		border: 1px solid rgb(255 255 255 / 0.25);
		background: none;
		color: #fff;
	}

	.enviar {
		border: 0;
		background: var(--gold);
		color: var(--on-gold);
		font-weight: 800;
	}

	.enviar:hover:not(:disabled) {
		filter: brightness(1.08);
	}

	.enviar:disabled {
		opacity: 0.6;
		cursor: wait;
	}
</style>
