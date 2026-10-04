import Constants from 'expo-constants';
import { createClient } from '@dnf/sdk';

// Em dev, o celular não alcança "localhost": usa o IP da máquina que roda o Metro.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';

export const pb = createClient(process.env.EXPO_PUBLIC_PB_URL ?? `http://${devHost}:8090`);
