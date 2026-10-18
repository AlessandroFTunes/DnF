import type { AudioSource } from 'expo-audio';

/** Web não tem sistema de arquivos: o player toca direto de um `data:` URI. */
export function audioFromBase64(base64: string, _name: string): { source: AudioSource; release(): void } {
  return { source: { uri: `data:audio/mpeg;base64,${base64}` }, release() {} };
}
