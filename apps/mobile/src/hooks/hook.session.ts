import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { z } from 'zod';
import { User } from '@dnf/core/user';
import { PocketBase, ClientResponseError } from '@dnf/core/pocketbase';
import { Assert, fn } from '@dnf/core/util';
import '../lib/pocketbase';

type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; session: User.SessionInfo };

// Respostas em que o servidor rejeita o token (inválido, revogado ou usuário apagado).
const REJECTED_TOKEN_STATUS = new Set([401, 403, 404]);

/**
 * Renova o token no servidor. Só derruba a sessão quando o servidor rejeita o token;
 * sem rede (status 0), rate limit (429) ou erro no servidor (5xx) mantém o token local enquanto não expirar.
 */
export async function refreshSession(): Promise<User.SessionInfo | null> {
  const pb = PocketBase.use();
  if (!pb.authStore.isValid) {
    pb.authStore.clear();
    return null;
  }
  try {
    await pb.collection('users').authRefresh();
  } catch (error) {
    if (error instanceof ClientResponseError && REJECTED_TOKEN_STATUS.has(error.status)) {
      pb.authStore.clear();
    }
  }
  return User.session();
}

const assert = Assert.create('Session');

export const login = fn(
  z.object({ email: User.Email, password: z.string().min(1) }),
  async ({ email, password }) => {
    await PocketBase.use().collection('users').authWithPassword(email, password);
    return assert.exists(User.session());
  },
  { title: 'Login', description: 'Authenticate with email and password.' },
);

export const signUp = fn(
  User.create.schema,
  async (input) => {
    const user = await User.create.force(input);
    return login.force({ email: user.email, password: input.password });
  },
  { title: 'Sign up', description: 'Create an account and log in.' },
);

export function logout() {
  PocketBase.use().authStore.clear();
}

/** Ao abrir o app: lê o token do Keychain e renova com o servidor. */
export async function restoreSession(): Promise<User.SessionInfo | null> {
  await User.loadSession();
  return refreshSession();
}

// Estado global da sessão (um só para o app inteiro, sem Provider).
let state: SessionState = { status: 'loading' };
const listeners = new Set<() => void>();
let started = false;

function sync() {
  const session = User.session();
  state = session ? { status: 'signedIn', session } : { status: 'signedOut' };
  listeners.forEach((listener) => listener());
}

function start() {
  if (started) return;
  started = true;

  // Login, logout, refresh e token rejeitado passam todos pelo authStore.
  PocketBase.use().authStore.onChange(() => {
    if (state.status !== 'loading') sync();
  });

  restoreSession().finally(sync);

  // Renova ao voltar do segundo plano: quem usa o app dentro do prazo do token nunca é deslogado.
  AppState.addEventListener('change', (appState) => {
    if (appState === 'active' && state.status === 'signedIn') void refreshSession();
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Sessão do usuário. `status: 'loading'` até terminar a restauração ao abrir o app
 * (mantenha a splash screen até lá).
 */
export function useSession() {
  const current = useSyncExternalStore(subscribe, () => state);
  return {
    ...current,
    login,
    signUp,
    logout,
  };
}
