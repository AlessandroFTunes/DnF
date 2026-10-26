<script lang="ts">
	let { title, subtitle }: { title: string; subtitle?: string } = $props();
</script>

<h1>
	{title}
	{#if subtitle}<span>{subtitle}</span>{/if}
</h1>

<style>
	h1 {
		margin: 0 0 0.6rem;
		font-size: clamp(1.9rem, 2.9vw, 2.6rem);
		font-weight: 600;
		line-height: 1.1;
		letter-spacing: -0.03em;
		text-align: left;
	}

	span {
		display: block;
		color: rgb(255 255 255 / 0.4);
	}
</style>
