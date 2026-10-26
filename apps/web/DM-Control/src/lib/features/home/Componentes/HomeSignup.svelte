<script lang="ts">
	import { resolve } from '$app/paths';

	let { text }: { text: string } = $props();
</script>

<div class="signup">
	<p>{text}</p>
	<div class="row">
		<a class="start lift" href={resolve('/login')}>Get started <span aria-hidden="true">›</span></a>
		<a class="more" href={resolve('/') + '#sobre'}>Ver mais</a>
	</div>
</div>

<style>
	.signup {
		width: 100%;
		max-width: 38rem;
	}

	p {
		margin: 0 0 1rem;
		font-size: 1rem;
		font-weight: 500;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	.start {
		padding: 1rem 1.6rem;
		border-radius: 4px;
		background: var(--gold);
		color: var(--on-gold);
		font-size: clamp(1rem, 2.4vw, 1.4rem);
		font-weight: 800;
		white-space: nowrap;
		text-decoration: none;
	}

	.more {
		color: var(--gold);
		font-weight: 700;
		text-decoration: none;
	}

	.more:hover {
		text-decoration: underline;
	}

	.start:focus-visible,
	.more:focus-visible {
		outline: 2px solid var(--gold);
		outline-offset: 2px;
	}

	@media (max-width: 36rem) {
		.row {
			flex-direction: column;
			gap: 1rem;
		}

		.start {
			align-self: stretch;
			text-align: center;
		}
	}
</style>
