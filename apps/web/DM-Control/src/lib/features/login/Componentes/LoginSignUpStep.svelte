<script lang="ts">
	import LoginField from './LoginField.svelte';
	import LoginTitle from './LoginTitle.svelte';
	import LoginSubmit from './LoginSubmit.svelte';
	import LoginAlert from './LoginAlert.svelte';
	import { signUp } from '../api.remote';

	let { email, onback }: { email: string; onback: () => void } = $props();

	let failure = $state<string>();
</script>

<form
	{...signUp.enhance(async ({ submit }) => {
		failure = undefined;
		try {
			await submit();
		} catch {
			// Erro de validação vai para o campo; aqui só cai o que não é do formulário (rede, servidor).
			failure = 'Não foi possível falar com o servidor. Tente de novo.';
		}
	})}
>
	<LoginTitle title="Criar conta" subtitle="Não encontramos uma conta com esse email" />

	<div class="email">
		<span>{email}</span>
		<button type="button" onclick={onback}>Alterar</button>
	</div>
	<input {...signUp.fields.email.as('hidden', email)} />

	<LoginField
		label="Nome"
		autocomplete="name"
		issues={signUp.fields.name.issues()}
		{...signUp.fields.name.as('text')}
	/>
	<LoginField
		label="Senha"
		autocomplete="new-password"
		issues={signUp.fields.password.issues()}
		{...signUp.fields.password.as('password')}
	/>
	<LoginAlert text={failure} />
	<LoginSubmit label="Criar conta" busy={signUp.pending > 0} />
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
