<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		label,
		issues,
		...input
	}: HTMLInputAttributes & { label: string; issues?: { message: string }[] } = $props();

	let visible = $state(false);

	const isPassword = $derived(input.type === 'password');
	const error = $derived(issues?.[0]?.message);
</script>

<label>
	<span class="label">{label}</span>
	<span class="control">
		<input {...input} type={isPassword && visible ? 'text' : input.type} />
		{#if isPassword}
			<button
				type="button"
				class="eye"
				aria-label={visible ? 'Esconder senha' : 'Mostrar senha'}
				aria-pressed={visible}
				onclick={() => (visible = !visible)}
			>
				{visible ? 'Esconder' : 'Mostrar'}
			</button>
		{/if}
	</span>
	{#if error}
		<span class="error" role="alert">{error}</span>
	{/if}
</label>

<style>
	label {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.label {
		font-size: 0.85rem;
		font-weight: 700;
	}

	.control {
		position: relative;
		display: flex;
	}

	input {
		flex: 1;
		min-width: 0;
		padding: 0.9rem 1rem;
		border: 1px solid rgb(255 255 255 / 0.3);
		border-radius: 6px;
		background: var(--field);
		color: #fff;
		font-size: 1rem;
	}

	input[type='password'],
	input[type='text'] {
		padding-right: 5.2rem;
	}

	input:focus-visible {
		outline: 2px solid var(--gold);
		outline-offset: 1px;
	}

	input[aria-invalid='true'] {
		border-color: var(--danger);
	}

	.eye {
		position: absolute;
		top: 50%;
		right: 0.6rem;
		padding: 0.25rem 0.4rem;
		border: 0;
		background: none;
		color: var(--gold-light);
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
		translate: 0 -50%;
	}

	.error {
		font-size: 0.85rem;
		color: var(--danger);
	}
</style>
