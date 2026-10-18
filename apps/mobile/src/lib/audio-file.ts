import type { AudioSource } from 'expo-audio';
import { File, Paths } from 'expo-file-system';

/** Áudio em base64 (mp3) como fonte do player: grava num arquivo do cache, apagado no `release`. Web: `audio-file.web.ts`. */
export function audioFromBase64(base64: string, name: string): { source: AudioSource; release(): void } {
  const file = new File(Paths.cache, `${name}-${Date.now()}.mp3`);
  file.write(base64, { encoding: 'base64' });
  return {
    source: { uri: file.uri },
    release() {
      try {
        file.delete();
      } catch {
        // já apagado (o sistema limpa o cache)
      }
    },
  };
}
