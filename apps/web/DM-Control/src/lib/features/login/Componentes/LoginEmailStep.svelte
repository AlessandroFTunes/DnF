<script lang="ts">
	import LoginField from './LoginField.svelte';
	import LoginSubmit from './LoginSubmit.svelte';

	let {
		email,
		error,
		busy,
		onchange,
		onsubmit
	}: {
		email: string;
		error?: string;
		busy: boolean;
		onchange: (value: string) => void;
		onsubmit: () => void;
	} = $props();
</script>

<form
	onsubmit={(e) => {
		e.preventDefault();
		onsubmit();
	}}
>
	<h1>Entrar ou criar conta</h1>
	<p>Informe seu email. Se já tiver conta, você entra; se não, criamos uma.</p>

	<LoginField
		label="Email"
		type="email"
		name="email"
		autocomplete="email"
		autocapitalize="none"
		spellcheck={false}
		value={email}
		oninput={(e) => onchange(e.currentTarget.value)}
		issues={error ? [{ message: error }] : undefined}
		aria-invalid={error ? 'true' : undefined}
	/>
	<LoginSubmit label="Continuar" {busy} />
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	h1 {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		text-align: left;
	}

	p {
		margin: 0;
		font-size: 0.95rem;
		color: rgb(255 255 255 / 0.7);
	}
</style>
