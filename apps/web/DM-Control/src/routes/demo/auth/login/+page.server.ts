import { fail, redirect } from '@sveltejs/kit';
import { Http } from '@dnf/core/http';
import { User } from '@dnf/core/user';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		return redirect(302, '/demo/auth');
	}
	return {};
};

function message(error: unknown, fallback: string) {
	if (error instanceof Http.ApiError) return error.message || fallback;
	return fallback;
}

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		const email = User.Email.safeParse(formData.get('email'));
		const password = formData.get('password')?.toString() ?? '';
		if (!email.success) return fail(400, { message: 'Email inválido' });

		try {
			await User.login.force({ email: email.data, password });
		} catch (error) {
			return fail(400, { message: message(error, 'Email ou senha incorretos') });
		}

		return redirect(302, '/demo/auth');
	},
	signUpEmail: async (event) => {
		const formData = await event.request.formData();
		const password = formData.get('password')?.toString() ?? '';
		const parsed = User.SignUp.safeParse({
			name: formData.get('name')?.toString() ?? '',
			email: formData.get('email'),
			password,
			passwordConfirm: password
		});
		if (!parsed.success)
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Dados inválidos' });

		try {
			await User.create.force(parsed.data);
		} catch (error) {
			return fail(400, { message: message(error, 'Não foi possível criar a conta') });
		}

		return redirect(302, '/demo/auth');
	}
};
