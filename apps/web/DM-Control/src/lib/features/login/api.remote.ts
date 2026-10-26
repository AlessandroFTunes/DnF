import { command, form, getRequestEvent } from '$app/server';
import { invalid, redirect } from '@sveltejs/kit';
import { ClientResponseError } from '@dnf/core/pocketbase';
import { User } from '@dnf/core/user';

const HOME = '/inicio';

/**
 * Texto para a pessoa a partir do que o PocketBase devolveu. Erro que não é do PocketBase é bug nosso:
 * vai para o log do servidor e a pessoa vê só o texto genérico.
 */
function reason(failure: unknown, fallback: string): { status: number; text: string } {
	if (!(failure instanceof ClientResponseError)) {
		console.error('[login]', failure);
		return { status: 500, text: fallback };
	}
	// status 0 = o servidor não respondeu (fora do ar ou sem rede)
	if (failure.status === 0) return { status: 503, text: 'Sem conexão com o servidor. Tente de novo.' };
	if (failure.status === 429)
		return { status: 429, text: 'Muitas tentativas. Espere um pouco e tente de novo.' };
	if (failure.status >= 500) return { status: 503, text: 'O servidor está com problemas. Tente de novo em instantes.' };
	return { status: failure.status, text: fallback };
}

/**
 * Se já existe conta com o email e, se sim, o primeiro nome dela.
 * A falha volta como dado (`failure`): o texto de uma exceção não chega à tela em produção.
 * É `command` (e não `query`) porque roda a cada clique e não pode reaproveitar a resposta
 * anterior, nem a de uma tentativa que falhou.
 */
export const lookupEmail = command('unchecked', async (email: string) => {
	const parsed = User.Email.safeParse(email);
	if (!parsed.success) return { failure: 'Informe um email válido.' } as const;

	try {
		const found = await User.lookupEmail.force({ email: parsed.data });
		return { email: parsed.data, exists: found.exists, firstName: found.firstName ?? null } as const;
	} catch (failure) {
		return { failure: reason(failure, 'Algo deu errado. Tente de novo.').text } as const;
	}
});

export const signIn = form(
	'unchecked',
	async (data: { email: string; password: string }, issue) => {
		const email = User.Email.safeParse(data.email);
		if (!email.success) invalid(issue.email('Informe um email válido.'));
		if (!data.password) invalid(issue.password('Informe a senha.'));

		const { locals } = getRequestEvent();
		try {
			await locals.pb.collection('users').authWithPassword(email.data, data.password);
		} catch (failure) {
			const { status, text } = reason(failure, 'Não foi possível entrar.');
			// 400 do PocketBase = email ou senha que não conferem
			invalid(issue.password(status === 400 ? 'Email ou senha incorretos.' : text));
		}

		redirect(303, HOME);
	}
);

export const signUp = form(
	'unchecked',
	async (data: { email: string; name: string; password: string }, issue) => {
		const parsed = User.create.schema.safeParse({
			name: data.name,
			email: data.email,
			password: data.password,
			passwordConfirm: data.password
		});
		if (!parsed.success) {
			const first = parsed.error.issues[0];
			const field = first?.path[0];
			if (field === 'name') invalid(issue.name('Informe seu nome (até 64 letras).'));
			if (field === 'email') invalid(issue.email('Informe um email válido.'));
			invalid(
				issue.password(
					first?.code === 'too_small'
						? `A senha precisa ter pelo menos ${User.PASSWORD_MIN_LENGTH} caracteres.`
						: first?.code === 'too_big'
							? 'A senha é longa demais.'
							: 'Senha inválida.'
				)
			);
		}

		const { locals } = getRequestEvent();

		try {
			await locals.pb.collection('users').create(parsed.data);
		} catch (failure) {
			const { text } = reason(failure, 'Não foi possível criar a conta.');
			const emailTaken =
				failure instanceof ClientResponseError && Boolean(failure.response?.data?.email);
			invalid(
				emailTaken ? issue.email('Já existe uma conta com esse email.') : issue.password(text)
			);
		}

		try {
			await locals.pb
				.collection('users')
				.authWithPassword(parsed.data.email, parsed.data.password);
		} catch (failure) {
			// A conta já foi criada: não adianta pedir o cadastro de novo, só a entrada.
			reason(failure, '');
			redirect(303, `/login?email=${encodeURIComponent(parsed.data.email)}`);
		}

		redirect(303, HOME);
	}
);
