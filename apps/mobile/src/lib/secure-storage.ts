import * as SecureStore from 'expo-secure-store';
import type { User } from '@dnf/core/user';

// Legível só com o aparelho desbloqueado e não migra para outro aparelho via backup.
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Keychain (iOS) / Keystore (Android) para guardar o token da sessão. */
export const secureStorage: User.SessionStorage = {
  getItem: (key) => SecureStore.getItemAsync(key, options),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
  removeItem: (key) => SecureStore.deleteItemAsync(key, options),
};
