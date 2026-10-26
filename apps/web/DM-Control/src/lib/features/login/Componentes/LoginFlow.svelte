<script lang="ts">
	import { page } from '$app/state';
	import { stepIn, stepOut } from '../animation/step';
	import { lookupEmail } from '../api.remote';
	import LoginEmailStep from './LoginEmailStep.svelte';
	import LoginPasswordStep from './LoginPasswordStep.svelte';
	import LoginSignUpStep from './LoginSignUpStep.svelte';

	// O email pode vir preenchido da home (?email=); depois que a pessoa digita, vale o que ela digitou.
	let typed = $state<string>();
	const email = $derived(typed ?? page.url.searchParams.get('email') ?? '');

	let step = $state<'email' | 'password' | 'signUp'>('email');
	let firstName = $state<string | null>(null);
	let error = $state<string>();
	let busy = $state(false);

	async function next() {
		if (busy) return;
		busy = true;
		error = undefined;
		try {
			const found = await lookupEmail(email);
			if ('failure' in found) {
				error = found.failure;
				return;
			}
			typed = found.email;
			firstName = found.exists ? found.firstName : null;
			step = found.exists ? 'password' : 'signUp';
		} catch {
			// O servidor devolve os próprios erros como `failure`; se algo foi lançado, a chamada nem chegou.
			error = 'Não foi possível falar com o servidor. Tente de novo.';
		} finally {
			busy = false;
		}
	}

	function back() {
		step = 'email';
	}
</script>

{#key step}
	<div in:stepIn out:stepOut>
		{#if step === 'email'}
			<LoginEmailStep
				{email}
				onchange={(value) => (typed = value)}
				{error}
				{busy}
				onsubmit={next}
			/>
		{:else if step === 'password'}
			<LoginPasswordStep {email} {firstName} onback={back} />
		{:else}
			<LoginSignUpStep {email} onback={back} />
		{/if}
	</div>
{/key}
