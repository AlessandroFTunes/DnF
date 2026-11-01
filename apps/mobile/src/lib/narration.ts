import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Narration } from '@dnf/core/narration';
import { PocketBase } from '@dnf/core/pocketbase';
import { ttsCache } from './features/cache/functions/tts-cache';
import { audioFromBase64 } from './audio-file';
import './pocketbase';

/**
 * Toca a narração no aparelho. Quem gera a fala é o port `Narration` do core (o provedor fica no servidor);
 * cada fala gerada fica guardada no aparelho (`features/cache/functions/tts-cache.ts`).
 */
const narration = Narration.withCache(Narration.createPocketBaseAdapter(PocketBase.client()), ttsCache);

export interface Speech {
  /** Duração da fala (ms). */
  durationMs: number;
  /** Quando cada trecho pedido em `marks` começa a ser dito (ms), ou `null` se ele não está no texto. */
  marksMs: (number | null)[];
  /** Toca na hora: o áudio já está carregado. */
  play(): void;
  /** Para no meio e libera o áudio. */
  stop(): void;
  /** Libera o áudio: se já está tocando, deixa terminar a frase. */
  dispose(): void;
}

/** Quanto esperar o player carregar o mp3 já baixado. */
const LOAD_TIMEOUT_MS = 3000;

/** Espera o player carregar; `false` se não carregou a tempo. */
function whenLoaded(player: AudioPlayer): Promise<boolean> {
  if (player.isLoaded) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => (sub.remove(), resolve(false)), LOAD_TIMEOUT_MS);
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (!status.isLoaded) return;
      clearTimeout(timer);
      sub.remove();
      resolve(true);
    });
  });
}

export type SpeechStyle = Narration.Style;

/** Gera a fala de `text` e devolve pronta para tocar, com o momento em que cada trecho de `marks` é dito (na ordem). */
export async function loadSpeech(text: string, marks: string[] = [], style: SpeechStyle = 'calm'): Promise<Speech | null> {
  const res = await narration.synthesize(text, style);
  if (!res) return null;
  void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  const file = audioFromBase64(res.audio, 'narration');
  const player = createAudioPlayer(file.source);
  let started = false;
  let disposed = false;
  const release = () => {
    sub.remove();
    player.remove();
    file.release();
  };
  // Liberado no meio da frase: solta o áudio quando ela acabar.
  const sub = player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish && disposed) release();
  });
  if (!(await whenLoaded(player))) {
    release();
    return null;
  }

  return {
    durationMs: Math.round(res.duration * 1000),
    marksMs: Narration.marksMs(text, marks, res),
    play() {
      if (started || disposed) return;
      started = true;
      player.play();
    },
    stop() {
      if (disposed) return;
      disposed = true;
      player.pause();
      release();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (!started || !player.playing) release();
    },
  };
}
