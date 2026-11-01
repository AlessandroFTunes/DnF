import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { fonts, spacing, textGlow, useRpgTheme } from '@dnf/ui-react-native';
import { loadSpeech, type Speech } from '../../lib/narration';
import { D20Animation } from './D20Animation';
import { GOLD_DIE } from './LevelUpCelebration';
import { celebrationSounds } from './levelUpSounds';
import { SAGE_CATEGORY, sageSpeech, type SageCategory } from './sageSpeech';

type State = 'idle' | 'loading' | 'playing';

const useNativeDriver = Platform.OS !== 'web';
const DIE_SIZE = 180;
const TEXT = '#F3EBDD';
const MUTED = '#9AA0BE';

const timing = (value: Animated.Value, toValue: number, duration: number, easing = Easing.out(Easing.cubic)) =>
  Animated.timing(value, { toValue, duration, easing, useNativeDriver });

/** Respiração lenta enquanto a fala é gerada. */
const waitingPulse = (pulse: Animated.Value) =>
  Animated.loop(Animated.sequence([timing(pulse, 0.6, 700, Easing.inOut(Easing.sin)), timing(pulse, 0.1, 700, Easing.inOut(Easing.sin))]));

/** Quanto antes de a voz dizer a palavra ela começa a acender no texto, e quanto leva para acender. */
const WORD_LEAD_MS = 80;
const WORD_FADE_MS = 220;

/**
 * Um pulso por palavra, no instante em que a voz a diz: sobe e desce em onda até a próxima, sem apagar entre
 * elas (a voz soa contínua, o brilho também).
 */
function voicePulse(pulse: Animated.Value, starts: (number | null)[], durationMs: number) {
  const beats = starts.filter((at): at is number => at !== null);
  const wave = Easing.inOut(Easing.sin);
  const steps: Animated.CompositeAnimation[] = [];
  let t = 0;
  beats.forEach((at, i) => {
    if (at < t) return;
    const gap = (beats[i + 1] ?? durationMs) - at;
    const rise = Math.max(120, Math.min(260, gap * 0.45));
    const fall = Math.max(0, Math.min(gap - rise, 600));
    steps.push(Animated.delay(at - t), timing(pulse, 0.85, rise, wave), timing(pulse, 0.35, fall, wave));
    t = at + rise + fall;
  });
  steps.push(timing(pulse, 0, 500, wave));
  return Animated.sequence(steps);
}

/** Ícone de áudio ao lado da habilidade: o Grande Sábio lê um resumo rápido. Tocar de novo para a fala. */
export function SageButton({ name, desc, category, color }: { name: string; desc?: string; category: SageCategory; color?: string }) {
  const theme = useRpgTheme();
  const [state, setState] = useState<State>('idle');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [pulse] = useState(() => new Animated.Value(0));
  // Relógio da fala (ms): cada palavra do texto acende quando a voz chega nela.
  const [clock] = useState(() => new Animated.Value(0));
  const [said, setSaid] = useState<{ words: string[]; marksMs: (number | null)[] } | null>(null);
  const speech = useRef<Speech | null>(null);
  // A mesma ambientação de caverna da subida de nível, que abaixa enquanto ela fala.
  const ambience = useRef<ReturnType<typeof celebrationSounds> | null>(null);
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Cada toque ganha um número: a fala que chega depois de parar (ou de outro toque) é descartada.
  const run = useRef(0);
  const alive = useRef(true);

  const animate = (next: Animated.CompositeAnimation | null) => {
    anim.current?.stop();
    anim.current = next;
    next?.start();
  };

  const stop = () => {
    run.current++;
    clearTimeout(timer.current);
    animate(null);
    speech.current?.stop();
    speech.current = null;
    ambience.current?.dispose();
    ambience.current = null;
    if (alive.current) {
      setState('idle');
      setSaid(null);
    }
  };

  useEffect(
    () => () => {
      alive.current = false;
      stop();
    },
    // Só ao desmontar: para a fala e a animação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onPress = async () => {
    if (state !== 'idle') return stop();
    const id = ++run.current;
    setState('loading');
    const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
    if (id !== run.current) return;
    setReduceMotion(reduce);
    pulse.setValue(reduce ? 0.3 : 0);
    if (!reduce) animate(waitingPulse(pulse));
    ambience.current = celebrationSounds([]);
    ambience.current.start(reduce);

    const text = sageSpeech(name, desc, category);
    const words = text.split(/\s+/).filter(Boolean);
    const voice = await loadSpeech(text, words, 'sage');
    if (id !== run.current || !voice) {
      voice?.dispose();
      if (id === run.current) stop();
      return;
    }
    speech.current = voice;
    clock.setValue(reduce ? voice.durationMs : 0);
    setSaid({ words, marksMs: voice.marksMs });
    voice.play();
    ambience.current?.duck(voice.durationMs);
    setState('playing');
    const read = Animated.timing(clock, { toValue: voice.durationMs, duration: voice.durationMs, easing: Easing.linear, useNativeDriver });
    animate(reduce ? null : Animated.parallel([voicePulse(pulse, voice.marksMs, voice.durationMs), read]));
    timer.current = setTimeout(stop, voice.durationMs + 600);
  };

  const tint = color ?? theme.gold;
  return (
    <>
      <Pressable
        onPress={onPress}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={state === 'idle' ? `Ouvir resumo de ${name}` : 'Parar resumo'}
      >
        {state === 'loading' ? (
          <ActivityIndicator size="small" color={tint} />
        ) : (
          <MaterialCommunityIcons name={state === 'playing' ? 'stop-circle-outline' : 'volume-high'} size={20} color={tint} />
        )}
      </Pressable>
      <Modal transparent visible={state !== 'idle'} animationType="fade" onRequestClose={stop} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={stop} accessibilityLabel="Silenciar o Grande Sábio">
          <Text style={[styles.overline, textGlow(GOLD_DIE.glow, 18)]}>Grande Sábio</Text>
          <View style={{ width: DIE_SIZE, height: DIE_SIZE, pointerEvents: 'none' }}>
            {/* Aura larga e núcleo claro: acendem a cada palavra (o dado é vazado, o núcleo brilha por dentro). */}
            <Glow
              id="sage-aura"
              size={DIE_SIZE * 2.6}
              color={GOLD_DIE.glow}
              stops={[1, 0.45, 0]}
              opacity={pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] })}
              scale={pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.35] })}
            />
            <Glow
              id="sage-core"
              size={DIE_SIZE * 1.2}
              color={GOLD_DIE.flash}
              stops={[1, 0.6, 0]}
              opacity={pulse.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.15, 1] })}
              scale={pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.35] })}
            />
            <Animated.View
              style={[StyleSheet.absoluteFill, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) }] }]}
            >
              <D20Animation variant="common" size={DIE_SIZE} reduceMotion={reduceMotion} />
            </Animated.View>
          </View>
          <View style={styles.titles}>
            <Text style={[styles.name, textGlow(GOLD_DIE.glow, 14)]}>{name}</Text>
            <Text style={styles.category}>{SAGE_CATEGORY[category].title}</Text>
          </View>
          {said && (
            // Legenda: as palavras ainda não ditas ficam apagadas e acendem junto com a voz.
            <View style={styles.caption} accessible accessibilityLabel={said.words.join(' ')}>
              {said.words.map((word, i) => {
                const at = said.marksMs[i];
                const lit =
                  at === null
                    ? 1
                    : clock.interpolate({ inputRange: [at - WORD_LEAD_MS, at - WORD_LEAD_MS + WORD_FADE_MS], outputRange: [0.18, 1], extrapolate: 'clamp' });
                return (
                  <Animated.Text key={i} style={[styles.word, { opacity: lit }]}>
                    {word}
                  </Animated.Text>
                );
              })}
            </View>
          )}
          <Text style={styles.hint}>{state === 'loading' ? 'Analisando…' : 'Toque para silenciar'}</Text>
        </Pressable>
      </Modal>
    </>
  );
}

/** Brilho redondo centrado no dado (gradiente fixo, animado só em escala e opacidade pelo driver nativo). */
function Glow({
  id,
  size,
  color,
  stops,
  opacity,
  scale,
}: {
  id: string;
  size: number;
  color: string;
  /** Opacidade no centro, no meio e na borda. */
  stops: [number, number, number];
  opacity: Animated.AnimatedInterpolation<number>;
  scale: Animated.AnimatedInterpolation<number>;
}) {
  const offset = (DIE_SIZE - size) / 2;
  return (
    <Animated.View style={[styles.glow, { left: offset, top: offset, opacity, transform: [{ scale }] }]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={stops[0]} />
            <Stop offset="0.4" stopColor={color} stopOpacity={stops[1]} />
            <Stop offset="1" stopColor={color} stopOpacity={stops[2]} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,5,12,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  glow: { position: 'absolute' },
  overline: { color: GOLD_DIE.edge, fontFamily: fonts.displayMedium, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase' },
  name: { color: TEXT, fontFamily: fonts.display, fontSize: 24, letterSpacing: 1, textAlign: 'center' },
  caption: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 5, maxWidth: 520 },
  word: { color: TEXT, fontFamily: fonts.displayMedium, fontSize: 16, lineHeight: 24 },
  titles: { alignItems: 'center', gap: 2 },
  category: { color: GOLD_DIE.edge, fontFamily: fonts.displayMedium, fontSize: 12, letterSpacing: 2.5, textTransform: 'uppercase' },
  hint: { color: MUTED, fontFamily: fonts.displayMedium, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
});
