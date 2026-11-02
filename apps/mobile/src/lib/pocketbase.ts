import './crypto';
import './eventsource';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { PocketBase } from '@dnf/core/pocketbase';
import { User } from '@dnf/core/user';
import { secureStorage } from './secure-storage';

// Em dev, o celular não alcança "localhost": usa o IP da máquina que roda o Metro.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';

const url = process.env.EXPO_PUBLIC_PB_URL ?? `http://${devHost}:8090`;

PocketBase.init(url, User.createAuthStore(secureStorage));

/**
 * Web servida na mesma origem do PocketBase (o Traefik repassa /api, /srd e /tts): o token fica num cookie httpOnly,
 * que o JavaScript não lê (core/pb_hooks/session.pb.js). O app só guarda um token "de mentira", sem assinatura.
 * Fora disso (celular, ou web em desenvolvimento noutra porta) nada muda: o token real vai no Authorization.
 */
export const cookieSession =
  Platform.OS === 'web' && typeof location !== 'undefined' && new URL(url, location.href).origin === location.origin;

if (cookieSession) {
  PocketBase.use().beforeSend = (requestUrl, options) => ({
    url: requestUrl,
    options: { ...options, headers: { ...options.headers, 'X-DNF-Cookie': '1' } },
  });
}
