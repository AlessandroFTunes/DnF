import './crypto';
import './eventsource';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { Http } from '@dnf/core/http';
import { User } from '@dnf/core/user';
import { secureStorage } from './secure-storage';

// Em dev, o celular não alcança "localhost": usa o IP da máquina que roda o Metro.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';

const url = process.env.EXPO_PUBLIC_API_URL ?? `http://${devHost}:3000`;

/**
 * Web servida na mesma origem da API (o Traefik repassa a API para o mesmo domínio): o token fica num cookie httpOnly,
 * que o JavaScript não lê (`core/src/api/auth.ts`). O app só guarda um token "de mentira", sem assinatura.
 * Fora disso (celular, ou web em desenvolvimento noutra porta) nada muda: o token real vai no Authorization.
 */
const cookieSession =
  Platform.OS === 'web' && typeof location !== 'undefined' && new URL(url, location.href).origin === location.origin;

Http.init({ url, auth: User.createAuthStore(secureStorage), cookie: cookieSession });
