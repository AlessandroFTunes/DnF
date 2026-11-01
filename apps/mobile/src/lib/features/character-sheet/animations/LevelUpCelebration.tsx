import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fonts, radius, spacing, textGlow } from '@dnf/ui-react-native';
import { D20Animation } from './D20Animation';
import { loadSpeech, type Speech } from '../../lib/narration';
import { celebrationSounds, type SoundCue } from './levelUpSounds';

/** O que o personagem ganhou ao subir (aparece um por um na celebração). */
export interface LevelUpGain {
  label: string;
  kind: 'feature' | 'subclass' | 'asi' | 'hp';
}

/** Cores do dado: arestas/brilhos (`edge`), aura (`glow`) e clarão da quebra (`flash`). */
export interface DicePalette {
  edge: string;
  glow: string;
  flash: string;
}

/** Subida de nível comum. As mesmas cores estão no dado (`D20Animation`). */
export const GOLD_DIE: DicePalette = { edge: '#FFD9A0', glow: '#FFB45C', flash: '#FFF6DD' };
/** Nível 20 (herói lendário). */
export const PURPLE_DIE: DicePalette = { edge: '#D9C2FF', glow: '#9B5CFF', flash: '#F1E8FF' };
const TEXT = '#F3EBDD';
const MUTED = '#9AA0BE';

const GAIN_ICON: Record<LevelUpGain['kind'], 'star-four-points' | 'source-branch' | 'arm-flex' | 'heart-plus'> = {
  feature: 'star-four-points',
  subclass: 'source-branch',
  asi: 'arm-flex',
  hp: 'heart-plus',
};

// ---------------------------------------------------------------------------
// Linha do tempo (ms), a mesma do dado (`D20Animation`)

const APPEAR_MS = 400;
const BURST_AT = 600;
const TITLE_AT = 950;
const GAINS_AT = 1350;
const GAIN_STEP_MS = 160;
/** Quanto cada ganho leva para entrar. */
const GAIN_ENTER_MS = 380;
/** No nível 20 o personagem vira herói lendário (a ficha fica branca e dourada) e o dado se quebra. */
const LEGENDARY_LEVEL = 20;
/** Herói lendário: o dado treme e depois quebra, e "HERÓI LENDÁRIO" sai de dentro dele. */
const SHAKE_AT = 1000;
const SHATTER_AT = 1800;
/** Multiclasse: um d20 vermelho e um azul se chocam e viram um roxo ("nova trilha"). */
const COLLIDE_AT = 950;
const PURPLE = '#C08CFF';
const PURPLE_GLOW = '#9B5CFF';

/** "A, B e C". */
function listPt(items: string[]) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/** Como o ganho é dito ("+2 Força" vira "mais 2 Força"). */
const spoken = (gain: LevelUpGain) => gain.label.replace(/^\+(\d+)/, 'mais $1');

/** O que a narração fala, no tom de aviso do "Grande Sábio": "Aviso. Novo nível alcançado: você adquiriu A, B e C." */
export function levelUpSpeech(title: string, gains: LevelUpGain[]) {
  return gains.length ? `Aviso. ${title}: você adquiriu ${listPt(gains.map(spoken))}.` : `Aviso. ${title}.`;
}

/**
 * Quanto a animação espera a narração além do título. A fala é gerada na hora: o título só aparece quando
 * ela está pronta, para cada ganho surgir quando é dito. Passou disso, segue sem voz.
 */
const SPEECH_WAIT_MS = 5000;
/** Golpes do dado em cada variante (os instantes de `D20Animation`). */
const CUES: Record<'common' | 'multiclass' | 'legendary', SoundCue[]> = {
  common: [{ at: BURST_AT, sound: 'burst' }],
  // O choque tem um "whoosh" de 0,15 s antes do golpe: começa antes para o golpe cair no choque dos dados.
  multiclass: [{ at: COLLIDE_AT - 150, sound: 'collide' }],
  legendary: [
    { at: SHAKE_AT, sound: 'shake' },
    { at: SHATTER_AT, sound: 'shatter' },
  ],
};

/** Quando cada ganho aparece e quando a celebração pode fechar (ms no relógio). */
interface Timeline {
  gainStarts: number[];
  doneAt: number;
}

const useNativeDriver = Platform.OS !== 'web';
const easeOut = Easing.out(Easing.cubic);
/** Passa um pouco do tamanho final e volta. */
const easeOutBack = Easing.out(Easing.back(1.7));

/**
 * Celebração de subir de nível: um d20 transparente de arestas finas gira e pousa, e aparece o que o
 * personagem ganhou. Ao entrar numa classe nova (`multiclass`), dois d20, um vermelho e um azul, se chocam e
 * viram um roxo: "nova trilha alcançada".
 */
export function LevelUpCelebration({
  level,
  gains,
  multiclass = false,
  onClose,
}: {
  level: number;
  gains: LevelUpGain[];
  multiclass?: boolean;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const legendary = level >= LEGENDARY_LEVEL;
  // Dourado na subida comum, roxo no nível 20.
  const palette = legendary ? PURPLE_DIE : GOLD_DIE;
  const { edge: EDGE, glow: GLOW } = palette;
  // No nível 20 a lenda tem prioridade sobre a multiclasse.
  const merge = multiclass && !legendary;
  const variant = legendary ? 'legendary' : merge ? 'multiclass' : 'common';
  const titleAt = legendary ? SHATTER_AT + 450 : merge ? COLLIDE_AT + 450 : TITLE_AT;
  const gainsAt = legendary ? SHATTER_AT + 850 : merge ? COLLIDE_AT + 850 : GAINS_AT;
  const overline = legendary ? 'Lenda alcançada' : merge ? 'Nova trilha alcançada' : 'Novo nível alcançado';
  // Sem narração, os ganhos entram um atrás do outro.
  const fixed: Timeline = {
    gainStarts: gains.map((_, i) => gainsAt + i * GAIN_STEP_MS),
    doneAt: gainsAt + gains.length * GAIN_STEP_MS,
  };

  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);
  const [timeline, setTimeline] = useState(fixed);
  // Um relógio só, que anda no nativo: os textos aparecem por `interpolate` sobre ele.
  const [clock] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>((resolve) => timers.push(setTimeout(resolve, ms)));
    const run = (toValue: number, duration: number) =>
      Animated.timing(clock, { toValue, duration, easing: Easing.linear, useNativeDriver }).start();
    const sounds = celebrationSounds(CUES[variant]);
    // A narração começa a ser gerada já, enquanto o dado gira.
    const speech = loadSpeech(levelUpSpeech(overline, gains), gains.map(spoken));
    const voice = Promise.race([speech, wait(titleAt + SPEECH_WAIT_MS).then(() => null)]);

    void AccessibilityInfo.isReduceMotionEnabled().then(async (reduce) => {
      if (cancelled) return;
      setReduceMotion(reduce);
      sounds.start(reduce);
      if (reduce) {
        // Com "reduzir movimento", tudo já aparece no lugar e a fala entra quando chegar.
        run(fixed.doneAt, 0);
        setDone(true);
        const said = await voice;
        if (!cancelled && said) speak(said);
        return;
      }

      // Até o título o relógio anda sozinho; ali espera a fala.
      run(titleAt, titleAt);
      const [said] = await Promise.all([voice, wait(titleAt)]);
      if (cancelled) return;
      const plan = said ? speechTimeline(said) : fixed;
      setTimeline(plan);
      if (said) speak(said);
      run(plan.doneAt, plan.doneAt - titleAt);
      await wait(plan.doneAt - titleAt);
      if (!cancelled) setDone(true);
    });

    /** Fala por cima da ambientação, que abaixa enquanto isso. */
    function speak(said: Speech) {
      said.play();
      sounds.duck(said.durationMs);
    }

    /** Cada ganho aparece quando a voz começa a dizê-lo; fecha quando a fala acaba. */
    function speechTimeline(said: Speech): Timeline {
      const gainStarts: number[] = [];
      said.marksMs.forEach((ms, i) => gainStarts.push(ms === null ? (gainStarts[i - 1] ?? titleAt) + GAIN_STEP_MS : titleAt + ms));
      const last = gainStarts.length ? gainStarts[gainStarts.length - 1]! + GAIN_ENTER_MS : titleAt;
      return { gainStarts, doneAt: Math.max(titleAt + said.durationMs, last) };
    }

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      sounds.dispose();
      // A fala que já começou termina a frase; a que ainda não chegou é descartada.
      void speech.then((said) => said?.dispose());
    };
    // Roda uma vez: a celebração não muda depois de aberta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Vai de 0 a 1 entre `start` e `start + length`. */
  const enter = (start: number, length: number, easing = easeOut) =>
    clock.interpolate({ inputRange: [start, start + length], outputRange: [0, 1], easing, extrapolate: 'clamp' });
  const scaleIn = (from: number, start: number, length: number, easing = easeOut) =>
    clock.interpolate({ inputRange: [start, start + length], outputRange: [from, 1], easing, extrapolate: 'clamp' });
  const riseIn = (distance: number, start: number, length: number) =>
    clock.interpolate({ inputRange: [start, start + length], outputRange: [distance, 0], easing: easeOut, extrapolate: 'clamp' });

  const size = Math.min(width * 0.62, height * 0.36, 280);
  const stageWidth = merge ? Math.min(width - spacing.xl * 2, size * 2.4) : size;

  const heroIn = enter(SHATTER_AT + 60, 700, easeOutBack);
  const numberIn = enter(BURST_AT + 150, 450);
  const mergeNumber = enter(COLLIDE_AT + 200, 450);

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: enter(0, APPEAR_MS) }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => done && onClose()} accessibilityLabel="Fechar celebração" />

        <View style={{ width: stageWidth, height: size, pointerEvents: 'none' }}>
          {/* Espera saber se é para reduzir movimento antes de começar o dado. */}
          {reduceMotion !== null && (
            <D20Animation variant={variant} size={size} width={stageWidth} reduceMotion={reduceMotion} />
          )}
          <View style={[StyleSheet.absoluteFill, styles.center, { pointerEvents: 'none' }]}>
            {legendary ? (
              // "HERÓI LENDÁRIO" nasce do centro do dado quebrado e cresce até o tamanho dele.
              <Animated.Text
                style={[
                  styles.hero,
                  { color: EDGE, ...textGlow(GLOW, 18) },
                  { opacity: enter(SHATTER_AT + 60, 700 / 1.6), transform: [{ scale: heroIn.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }) }] },
                ]}
              >
                {'HERÓI\nLENDÁRIO'}
              </Animated.Text>
            ) : merge ? (
              <Animated.Text style={[styles.levelNumber, styles.mergeNumber, { opacity: mergeNumber, transform: [{ scale: scaleIn(0.6, COLLIDE_AT + 200, 450) }] }]}>
                {level}
              </Animated.Text>
            ) : (
              <Animated.Text style={[styles.levelNumber, textGlow(GLOW, 16), { opacity: numberIn, transform: [{ scale: scaleIn(0.6, BURST_AT + 150, 450) }] }]}>
                {level}
              </Animated.Text>
            )}
          </View>
        </View>

        <Animated.View style={[styles.text, { pointerEvents: 'none', opacity: enter(titleAt, 450), transform: [{ translateY: riseIn(16, titleAt, 450) }] }]}>
          <Text style={[styles.overline, { color: EDGE }, merge && styles.mergeOverline]}>
            {overline}
          </Text>
          <Text style={styles.title}>Nível {level}</Text>
          {gains.length > 0 && <Text style={styles.youGot}>Você ganhou:</Text>}
          {gains.map((gain, i) => {
            const start = timeline.gainStarts[i] ?? fixed.doneAt;
            return (
              <Animated.View
                key={`${gain.kind}-${gain.label}`}
                style={[styles.gain, { opacity: enter(start, GAIN_ENTER_MS), transform: [{ translateY: riseIn(10, start, GAIN_ENTER_MS) }] }]}
              >
                <MaterialCommunityIcons name={GAIN_ICON[gain.kind]} size={16} color={EDGE} />
                <Text style={styles.gainText}>{gain.label}</Text>
              </Animated.View>
            );
          })}
        </Animated.View>

        <Pressable
          onPress={onClose}
          disabled={!done}
          accessibilityRole="button"
          style={[styles.button, { borderColor: EDGE, opacity: done ? 1 : 0 }]}
        >
          <Text style={[styles.buttonText, { color: EDGE }]}>Continuar</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,5,12,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  levelNumber: {
    color: TEXT,
    fontFamily: fonts.displayHeavy,
    fontSize: 44,
  },
  hero: {
    fontFamily: fonts.displayHeavy,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: 2,
    textAlign: 'center',
  },
  mergeNumber: { ...textGlow(PURPLE_GLOW, 16) },
  mergeOverline: { color: PURPLE },
  text: { alignItems: 'center', gap: spacing.xs, maxWidth: 420 },
  overline: { fontFamily: fonts.displayMedium, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase' },
  title: { color: TEXT, fontFamily: fonts.display, fontSize: 30, letterSpacing: 1 },
  youGot: { color: MUTED, fontSize: 13, letterSpacing: 1, marginTop: spacing.sm, marginBottom: spacing.xs },
  gain: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  gainText: { color: TEXT, fontFamily: fonts.displayMedium, fontSize: 17, letterSpacing: 0.5, textAlign: 'center' },
  button: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  buttonText: { fontFamily: fonts.displayMedium, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase' },
});
