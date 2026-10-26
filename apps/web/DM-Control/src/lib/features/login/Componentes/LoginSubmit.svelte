<script lang="ts">
	let { label, busy = false }: { label: string; busy?: boolean } = $props();
</script>

<button type="submit" disabled={busy}>{busy ? 'Aguarde…' : label}</button>

<style>
	button {
		padding: 0.95rem 1rem;
		border: 0;
		border-radius: 6px;
		background: var(--gold);
		color: var(--on-gold);
		font-size: 1.05rem;
		font-weight: 800;
		cursor: pointer;
		transition: filter 0.15s;
	}

	button:hover:not(:disabled) {
		filter: brightness(1.08);
	}

	button:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	button:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 2px;
	}
</style>
