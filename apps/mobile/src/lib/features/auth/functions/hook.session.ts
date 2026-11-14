import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { User } from '@dnf/core/user';
import { Http } from '@dnf/core/http';
import '../../../http';
import { clearPlayerData } from '../../../query-client';
import { queryPersister } from '../../cache/functions/query-persister';

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
async function refreshSession(): Promise<User.SessionInfo | null> {
  if (!Http.client().auth.isValid) {
    Http.client().auth.clear();
    return null;
  }
  try {
    await User.refresh();
  } catch (error) {
    if (error instanceof Http.ApiError && REJECTED_TOKEN_STATUS.has(error.status)) Http.client().auth.clear();
  }
  return User.session();
}

/** Ao abrir o app: lê o token do Keychain e renova com o servidor. */
async function restoreSession(): Promise<User.SessionInfo | null> {
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
  // Saiu (ou o token foi recusado): personagens e mesas guardados são de quem saiu e não podem aparecer para o próximo.
  if (!session) {
    clearPlayerData();
    void queryPersister.removeClient();
  }
  listeners.forEach((listener) => listener());
}

function start() {
  if (started) return;
  started = true;

  // Login, logout, refresh e token rejeitado passam todos pelo authStore.
  Http.client().auth.onChange(() => {
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
    login: User.login,
    signUp: User.create,
    logout: User.logout,
  };
}
