<script lang="ts">
	import LoginField from './LoginField.svelte';
	import LoginTitle from './LoginTitle.svelte';
	import LoginSubmit from './LoginSubmit.svelte';
	import LoginAlert from './LoginAlert.svelte';
	import { signIn } from '../api.remote';

	let {
		email,
		firstName,
		onback
	}: { email: string; firstName: string | null; onback: () => void } = $props();

	const title = $derived(firstName ? `Bem-vindo de volta, ${firstName}` : 'Bem-vindo de volta');

	let failure = $state<string>();
</script>

<form
	{...signIn.enhance(async ({ submit }) => {
		failure = undefined;
		try {
			await submit();
		} catch {
			// Erro de validação vai para o campo; aqui só cai o que não é do formulário (rede, servidor).
			failure = 'Não foi possível falar com o servidor. Tente de novo.';
		}
	})}
>
	<LoginTitle {title} subtitle="Digite sua senha para continuar" />

	<div class="email">
		<span>{email}</span>
		<button type="button" onclick={onback}>Alterar</button>
	</div>
	<input {...signIn.fields.email.as('hidden', email)} />

	<LoginField
		label="Senha"
		autocomplete="current-password"
		issues={signIn.fields.password.issues()}
		{...signIn.fields.password.as('password')}
	/>
	<LoginAlert text={failure} />
	<LoginSubmit label="Entrar" busy={signIn.pending > 0} />
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.email {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.8rem 1.4rem;
		border: 1px solid rgb(255 255 255 / 0.3);
		border-radius: 999px;
		background: var(--field);
		font-size: 0.95rem;
		overflow-wrap: anywhere;
	}

	.email button {
		padding: 0;
		border: 0;
		background: none;
		color: var(--gold);
		font-weight: 700;
		cursor: pointer;
	}
</style>
