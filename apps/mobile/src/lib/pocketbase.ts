import './crypto';
import Constants from 'expo-constants';
import { PocketBase } from '@dnf/core/pocketbase';
import { User } from '@dnf/core/user';
import { secureStorage } from './secure-storage';

// Em dev, o celular não alcança "localhost": usa o IP da máquina que roda o Metro.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';

PocketBase.init(
  process.env.EXPO_PUBLIC_PB_URL ?? `http://${devHost}:8090`,
  User.createAuthStore(secureStorage),
);
