import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Narration } from '@dnf/core/narration';
import { PocketBase } from '@dnf/core/pocketbase';
import { ttsCache } from './features/cache/functions/tts-cache';
import { audioFromBase64 } from './audio-file';
import './pocketbase';
import { currentPreferences } from './features/profile/functions/queries';

/**
 * Toca a narração no aparelho. Quem gera a fala é o port `Narration` do core (o provedor fica no servidor);
 * cada fala gerada fica guardada no aparelho (`features/cache/functions/tts-cache.ts`).
 * Duas vozes: o narrador (avisos da subida de nível) e o Grande Sábio (`/tts/sage`).
 */
const voices = {
  narrator: Narration.withCache(Narration.createPocketBaseAdapter(PocketBase.client()), ttsCache),
  sage: Narration.withCache(Narration.createPocketBaseAdapter(PocketBase.client(), '/tts/sage'), ttsCache, 'sage|'),
};
export type Voice = keyof typeof voices;

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

/** Gera a fala de `text` e devolve pronta para tocar, com o momento em que cada trecho de `marks` é dito (na ordem). */
export async function loadSpeech(text: string, marks: string[] = [], voice: Voice = 'narrator'): Promise<Speech | null> {
  // O jogador desligou a narração no Perfil: sem voz (quem chama já trata a fala que não veio).
  if (!currentPreferences().narration) return null;
  const res = await voices[voice].createVoice(text);
  if (!res) return null;
  void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  const file = audioFromBase64(res.audio, 'narration', res.format);
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
