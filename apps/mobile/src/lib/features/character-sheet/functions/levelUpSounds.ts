import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * Efeitos da celebração de subir de nível: uma ambientação em loop e os golpes do dado, tocados nos mesmos
 * instantes da animação. Gerados pela ElevenLabs (`bun run sounds`, prompts em `scripts/sounds.ts`).
 */
const SOUNDS = {
  burst: require('../../../assets/sounds/burst.mp3'),
  collide: require('../../../assets/sounds/collide.mp3'),
  shake: require('../../../assets/sounds/shake.mp3'),
  shatter: require('../../../assets/sounds/shatter.mp3'),
} as const;
const AMBIENCE = require('../../../assets/sounds/ambience.mp3');

export type SoundCue = { at: number; sound: keyof typeof SOUNDS };

const AMBIENCE_VOLUME = 0.35;
/** A ambientação abaixa enquanto a narração fala. */
const DUCKED_VOLUME = 0.12;
const CUE_VOLUME = 0.8;
const FADE_MS = 400;

/**
 * Navegador do iPhone/iPad: o volume só muda pelos botões do aparelho (o código não consegue). A ambientação
 * tocaria no máximo por cima da voz, então fica de fora; os golpes tocam no volume do aparelho.
 */
const fixedVolume =
  Platform.OS === 'web' &&
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** Muda o volume aos poucos (o player não tem fade próprio). */
function fade(player: AudioPlayer, to: number, ms: number, then?: () => void) {
  const from = player.volume;
  const steps = 8;
  let i = 0;
  const timer = setInterval(() => {
    i++;
    player.volume = from + ((to - from) * i) / steps;
    if (i >= steps) {
      clearInterval(timer);
      then?.();
    }
  }, ms / steps);
  return () => clearInterval(timer);
}

/** Prepara os sons já (para tocarem sem atraso) e devolve os controles. */
export function celebrationSounds(cues: SoundCue[]) {
  void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  const ambience = fixedVolume ? null : createAudioPlayer(AMBIENCE);
  if (ambience) {
    ambience.loop = true;
    ambience.volume = 0;
  }
  const players = cues.map((cue) => {
    const player = createAudioPlayer(SOUNDS[cue.sound]);
    if (!fixedVolume) player.volume = CUE_VOLUME;
    return { ...cue, player };
  });
  const timers: ReturnType<typeof setTimeout>[] = [];
  let stopFade = () => {};

  return {
    /** Começa junto com a animação: a ambientação entra e cada golpe toca no seu instante. */
    start(reduceMotion: boolean) {
      if (ambience) {
        ambience.play();
        stopFade = fade(ambience, AMBIENCE_VOLUME, FADE_MS);
      }
      // Com "reduzir movimento" o dado não anima: sem golpes.
      if (!reduceMotion) for (const cue of players) timers.push(setTimeout(() => cue.player.play(), cue.at));
    },
    /** Abaixa a ambientação durante `ms` (a fala). */
    duck(ms: number) {
      if (!ambience) return;
      stopFade();
      stopFade = fade(ambience, DUCKED_VOLUME, 250);
      timers.push(setTimeout(() => (stopFade(), (stopFade = fade(ambience, AMBIENCE_VOLUME, FADE_MS))), ms));
    },
    /** A ambientação some aos poucos; os golpes que já tocaram terminam. */
    dispose() {
      timers.forEach(clearTimeout);
      stopFade();
      if (ambience) fade(ambience, 0, FADE_MS, () => ambience.remove());
      // Depois do golpe mais longo (4 s), solta os players.
      setTimeout(() => players.forEach((cue) => cue.player.remove()), 4500);
    },
  };
}
