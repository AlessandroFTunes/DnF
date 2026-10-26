<script lang="ts">
	let scrollY = $state(0);
	const visible = $derived(scrollY > 400);
</script>

<svelte:window bind:scrollY />

<button
	type="button"
	class="lift"
	class:visible
	aria-label="Voltar ao topo"
	tabindex={visible ? 0 : -1}
	onclick={() => window.scrollTo({ top: 0 })}
>
	<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
		<path
			d="M12 19V5M5 12l7-7 7 7"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
</button>

<style>
	button {
		position: fixed;
		bottom: 1.5rem;
		left: 1.5rem;
		z-index: 10;
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: var(--gold);
		color: var(--on-gold);
		box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 0.5);
		cursor: pointer;
		opacity: 0;
		pointer-events: none;
		transition:
			opacity 0.2s ease,
			transform 0.18s ease,
			filter 0.18s ease;
	}

	button.visible {
		opacity: 1;
		pointer-events: auto;
	}

	button:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 2px;
	}
</style>
