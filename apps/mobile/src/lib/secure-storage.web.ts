import type { User } from '@dnf/core/user';

/**
 * Web não tem Keychain/Keystore (expo-secure-store é só iOS/Android): usa localStorage,
 * o mesmo que o LocalAuthStore padrão do PocketBase usaria. Não é armazenamento seguro.
 */
export const secureStorage: User.SessionStorage = {
  getItem: async (key) => localStorage.getItem(key),
  setItem: async (key, value) => localStorage.setItem(key, value),
  removeItem: async (key) => localStorage.removeItem(key),
};
