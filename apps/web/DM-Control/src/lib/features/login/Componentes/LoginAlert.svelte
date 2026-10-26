<script lang="ts">
	let { text }: { text?: string } = $props();
</script>

{#if text}
	<p role="alert">{text}</p>
{/if}

<style>
	p {
		margin: 0;
		padding: 0.7rem 1rem;
		border: 1px solid var(--danger);
		border-radius: 6px;
		background: rgb(255 138 138 / 0.1);
		font-size: 0.9rem;
		color: var(--danger);
	}
</style>
