<script lang="ts">
	import DemoLinks from './demo/DemoLinks.svelte';
	import type { LayoutProps } from './$types';
	import Header from './Header.svelte';
	import { page } from '$app/state';
	import './layout.css';

	let { children }: LayoutProps = $props();

	// A home, o login, o início e a mesa têm layout próprio, em tela cheia.
	const isHome = $derived(
		['/', '/login', '/inicio'].includes(page.url.pathname) || page.url.pathname.startsWith('/mesa/')
	);
</script>

{#if isHome}
	{@render children()}
{:else}
	<div class="app">
		<Header />

		<main>
			{@render children()}
		</main>

		<footer>
			<p>
				visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to learn about SvelteKit
			</p>
		</footer>
	</div>
{/if}

<DemoLinks />

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 1rem;
		width: 100%;
		max-width: 64rem;
		margin: 0 auto;
		box-sizing: border-box;
	}

	footer {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 12px;
	}

	footer a {
		font-weight: bold;
	}

	@media (min-width: 480px) {
		footer {
			padding: 12px 0;
		}
	}
</style>
