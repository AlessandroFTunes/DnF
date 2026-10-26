<script lang="ts">
	import { resolve } from '$app/paths';

	let { text }: { text: string } = $props();
</script>

<form action={resolve('/login')}>
	<p>{text}</p>
	<div class="row">
		<input type="email" name="email" placeholder="Email" autocomplete="email" aria-label="Email" />
		<button type="submit" class="lift">Vamos lá <span aria-hidden="true">›</span></button>
	</div>
</form>

<style>
	form {
		width: 100%;
		max-width: 38rem;
		margin: 0 auto;
	}

	p {
		margin: 0 0 1rem;
		font-size: 1rem;
		font-weight: 500;
	}

	.row {
		display: flex;
		gap: 0.5rem;
	}

	input {
		flex: 1;
		min-width: 0;
		padding: 1rem;
		border: 1px solid rgb(255 255 255 / 0.35);
		border-radius: 4px;
		background: rgb(10 7 22 / 0.7);
		color: #fff;
		font-size: 1rem;
	}

	input:focus-visible {
		outline: 2px solid var(--gold);
		outline-offset: 1px;
	}

	button {
		padding: 0 1.6rem;
		border: 0;
		border-radius: 4px;
		background: var(--gold);
		color: var(--on-gold);
		font-size: clamp(1rem, 2.4vw, 1.4rem);
		font-weight: 800;
		white-space: nowrap;
		cursor: pointer;
	}

	@media (max-width: 36rem) {
		.row {
			flex-direction: column;
		}

		button {
			padding: 0.9rem;
		}
	}
</style>
