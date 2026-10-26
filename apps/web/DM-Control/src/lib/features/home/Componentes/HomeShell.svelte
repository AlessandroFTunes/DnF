<script lang="ts">
	import type { Snippet } from 'svelte';

	import '../animation/lift.css';

	let { children }: { children: Snippet } = $props();
</script>

<div class="shell">
	{@render children()}
</div>

<style>
	.shell {
		--gold: #f5c542;
		--gold-light: #ffe08a;
		--on-gold: #2a1d00;
		--bg: #02030a;
		--line: rgb(245 197 66 / 0.3);
		--card-from: #2a1659;
		--card-to: #0a0716;
		--maxw: 64rem;

		position: relative;
		overflow: hidden;
		min-height: 100vh;
		background: var(--bg);
		color: #fff;
		font-family: var(--font-body);
	}
</style>
