import { getRandomValues } from 'expo-crypto';

// O Hermes não tem Web Crypto; o @dnf/core usa crypto.getRandomValues (ex.: código de convite da mesa).
globalThis.crypto ??= {} as Crypto;
globalThis.crypto.getRandomValues ??= getRandomValues as Crypto['getRandomValues'];
