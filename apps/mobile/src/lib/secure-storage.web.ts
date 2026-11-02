import type { User } from '@dnf/core/user';

/**
 * Web não tem Keychain/Keystore (expo-secure-store é só iOS/Android): usa localStorage, que não é armazenamento
 * seguro. Por isso, servida na mesma origem do PocketBase, a web não guarda o token real aqui: o token vai num
 * cookie httpOnly e o que fica no localStorage é só um token sem assinatura (ver `cookieSession` em pocketbase.ts).
 */
export const secureStorage: User.SessionStorage = {
  getItem: async (key) => localStorage.getItem(key),
  setItem: async (key, value) => localStorage.setItem(key, value),
  removeItem: async (key) => localStorage.removeItem(key),
};
