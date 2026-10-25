import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { PocketBase } from '@dnf/core/pocketbase';
import { audioFromBase64 } from './audio-file';
import { ttsCache, type TtsResult } from './tts-cache';
import './pocketbase';

/**
 * Narração da ElevenLabs. O app não tem a chave: pede `/tts` ao PocketBase (`core/pb_hooks/tts.pb.js`), que
 * gera o mp3 com o tempo de cada letra e só atende logados. Sem a chave no servidor (ou sem rede), não há fala.
 * Cada fala gerada fica guardada no aparelho (`tts-cache.ts`).
 */
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

/**
 * Jeito de falar (ver `tts.pb.js`): `calm` é plana e pausada (avisos da subida de nível); `sage` tem mais
 * entonação, para o Grande Sábio explicar uma habilidade.
 */
export type SpeechStyle = 'calm' | 'sage';

/** Gera a fala de `text` e devolve pronta para tocar, com o momento em que cada trecho de `marks` é dito (na ordem). */
export async function loadSpeech(text: string, marks: string[] = [], style: SpeechStyle = 'calm'): Promise<Speech | null> {
  // A mesma fala já gerada toca do aparelho, sem gastar créditos.
  const key = style === 'calm' ? text : `${style}|${text}`;
  let res = await ttsCache.get(key);
  if (!res) {
    try {
      res = await PocketBase.client().send<TtsResult>('/tts', { query: { text, style }, requestKey: null });
    } catch {
      return null;
    }
    void ttsCache.set(key, res);
  }
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

  let from = 0;
  const marksMs = marks.map((mark) => {
    const i = text.indexOf(mark, from);
    if (i < 0) return null;
    from = i + mark.length;
    return Math.round((res.starts[i] ?? 0) * 1000);
  });

  return {
    durationMs: Math.round(res.duration * 1000),
    marksMs,
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
