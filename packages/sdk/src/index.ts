import PocketBase, { type BaseAuthStore } from 'pocketbase';

// A URL é configurável para suportar tanto o servidor central quanto o self-hosted do mestre.
// O authStore é injetado pelo app (ex.: SecureAuthStore do @dnf/core com o Keychain).
export function createClient(serverUrl: string, authStore?: BaseAuthStore) {
  return new PocketBase(serverUrl, authStore);
}

export type DnfClient = ReturnType<typeof createClient>;
