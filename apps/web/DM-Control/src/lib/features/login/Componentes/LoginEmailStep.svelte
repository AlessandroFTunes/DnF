<script lang="ts">
	import LoginField from './LoginField.svelte';
	import LoginTitle from './LoginTitle.svelte';
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
	<LoginTitle title="Bem-vindo ao DM Control" subtitle="Seu painel de mestre" />

	<button type="button" class="google" disabled title="Em breve">
		<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
			<path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
			<path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
			<path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
			<path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
		</svg>
		Continuar com Google
	</button>
	<span class="or">ou</span>

	<LoginField
		label="Email"
		hideLabel
		placeholder="Seu email"
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
	<LoginSubmit label="Continuar com email" {busy} />
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.google {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.8rem 1.2rem;
		border: 1px solid rgb(255 255 255 / 0.3);
		border-radius: 999px;
		background: none;
		color: #fff;
		font-size: 1rem;
		opacity: 0.55;
		cursor: not-allowed;
	}

	.or {
		align-self: center;
		margin-top: -0.25rem;
		font-size: 0.9rem;
		color: rgb(255 255 255 / 0.45);
	}
</style>
