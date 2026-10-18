import { z } from 'zod';
import { ClientResponseError } from '@dnf/core/pocketbase';
import { User } from '@dnf/core/user';
import type { AuthMode } from './flow';

export type AuthField = 'name' | 'email' | 'password' | 'passwordConfirm';
export type AuthErrors = Partial<Record<AuthField | 'form', string>>;

/** Traduz erros de validação (Zod) e do servidor (PocketBase) para mensagens por campo. */
export function toErrors(error: unknown, mode: AuthMode): AuthErrors {
  if (error instanceof z.ZodError) {
    const errors: AuthErrors = {};
    for (const issue of error.issues) {
      const field = issue.path[0] as AuthField;
      errors[field] ??= fieldMessage(field, issue.code, mode);
    }
    return errors;
  }
  if (error instanceof ClientResponseError) {
    if (error.status === 0) return { form: 'Sem conexão com o servidor. Tente de novo.' };
    if (mode === 'login' && error.status === 400) return { form: 'Email ou senha incorretos.' };
    if (error.response?.data?.email?.code === 'validation_not_unique') {
      return { email: 'Já existe uma conta com esse email.' };
    }
    if (error.status === 429) return { form: 'Muitas tentativas. Espere um pouco e tente de novo.' };
  }
  return { form: 'Algo deu errado. Tente de novo.' };
}

export function fieldMessage(field: AuthField, code: string, mode: AuthMode): string {
  switch (field) {
    case 'name':
      return 'Informe seu nome.';
    case 'email':
      return 'Informe um email válido.';
    case 'password':
      if (mode === 'login') return 'Informe sua senha.';
      return code === 'too_big' ? 'Senha longa demais.' : `A senha precisa de pelo menos ${User.PASSWORD_MIN_LENGTH} caracteres.`;
    case 'passwordConfirm':
      return 'As senhas não conferem.';
  }
}
