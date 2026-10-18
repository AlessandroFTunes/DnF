import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { useRpgTheme } from '@dnf/ui-react-native';

interface Art {
  source: ImageSourcePropType;
  /** largura / altura do arquivo. */
  ratio: number;
  /** Ponto da arte que fica no centro quando sobra imagem e ela é cortada (0–1). */
  focus: { x: number; y: number };
}

/** Ilustrações que se revezam no topo da Home, na ordem. */
const ARTS: Art[] = [
  { source: require('../../../assets/images/home-party.jpg'), ratio: 1536 / 1024, focus: { x: 0.47, y: 0.5 } },
  { source: require('../../../assets/images/home-party-2.jpg'), ratio: 1159 / 1357, focus: { x: 0.5, y: 0.4 } },
];

/** Quanto cada arte fica parada antes de trocar, e quanto dura o esmaecimento. */
const HOLD_MS = 7000;
const FADE_MS = 1600;
/** Zoom lento enquanto a arte está na tela (Ken Burns). */
const ZOOM = 1.08;

const useNativeDriver = Platform.OS !== 'web';

/**
 * Pôster da Home: as artes do grupo se revezam com esmaecimento cruzado e um zoom lento.
 * Só anima com a tela em foco; com "reduzir movimento", fica parado na primeira.
 */
export function HeroArt({ height }: { height: number }) {
  const theme = useRpgTheme();
  const [width, setWidth] = useState(0);
  const [layers] = useState(() => ARTS.map((_, i) => ({ fade: new Animated.Value(i === 0 ? 1 : 0), zoom: new Animated.Value(0) })));
  // A que está entrando fica por cima; a de baixo segue opaca até a troca acabar (sem "piscar" o fundo).
  const [front, setFront] = useState(0);
  const current = useRef(0);
  /** Arte entrando no meio de um esmaecimento (null fora da troca). */
  const entering = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const running: Animated.CompositeAnimation[] = [];
      const play = (animation: Animated.CompositeAnimation, done?: () => void) => {
        running.push(animation);
        animation.start(({ finished }) => {
          if (finished && !cancelled) done?.();
        });
      };
      const zoomIn = (i: number) => {
        layers[i]!.zoom.setValue(0);
        play(Animated.timing(layers[i]!.zoom, { toValue: 1, duration: HOLD_MS + FADE_MS * 2, easing: Easing.linear, useNativeDriver }));
      };
      const next = () => {
        const prev = current.current;
        const n = (prev + 1) % ARTS.length;
        setFront(n);
        entering.current = n;
        layers[n]!.fade.setValue(0);
        zoomIn(n);
        play(
          Animated.timing(layers[n]!.fade, { toValue: 1, duration: FADE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver }),
          () => {
            layers[prev]!.fade.setValue(0);
            current.current = n;
            entering.current = null;
            timer = setTimeout(next, HOLD_MS);
          },
        );
      };

      AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
        if (cancelled || reduce || ARTS.length < 2) return;
        zoomIn(current.current);
        timer = setTimeout(next, HOLD_MS);
      });
      return () => {
        cancelled = true;
        clearTimeout(timer);
        running.forEach((a) => a.stop());
        // Se saiu no meio de uma troca, já deixa a que estava entrando no lugar.
        const n = entering.current;
        if (n !== null) {
          layers[current.current]!.fade.setValue(0);
          layers[n]!.fade.setValue(1);
          current.current = n;
          entering.current = null;
        }
      };
    }, [layers]),
  );

  return (
    <View
      style={[styles.hero, { height }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {width > 0 &&
        ARTS.map((art, i) => {
          const frame = cover(art, width, height);
          return (
            <Animated.Image
              key={i}
              source={art.source}
              resizeMode="stretch"
              style={[
                styles.art,
                frame,
                {
                  zIndex: i === front ? 1 : 0,
                  opacity: layers[i]!.fade,
                  transform: [{ scale: layers[i]!.zoom.interpolate({ inputRange: [0, 1], outputRange: [1, ZOOM] }) }],
                },
              ]}
            />
          );
        })}

      {/* Escurece em cima (para o nav), nas laterais e embaixo, onde a arte some no fundo. */}
      <Svg style={[StyleSheet.absoluteFill, styles.overlay]} width="100%" height={height} pointerEvents="none">
        <Defs>
          <LinearGradient id="home-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.surface} stopOpacity={0.9} />
            <Stop offset="0.18" stopColor={theme.surface} stopOpacity={0} />
            <Stop offset="0.55" stopColor={theme.surface} stopOpacity={0} />
            <Stop offset="0.85" stopColor={theme.surface} stopOpacity={0.85} />
            <Stop offset="1" stopColor={theme.surface} stopOpacity={1} />
          </LinearGradient>
          <RadialGradient id="home-vignette" cx="50%" cy="45%" r="75%">
            <Stop offset="0.6" stopColor={theme.surface} stopOpacity={0} />
            <Stop offset="1" stopColor={theme.surface} stopOpacity={0.8} />
          </RadialGradient>
          {/* Brasa vermelha do tema subindo do chão, ligando a arte ao resto da tela. */}
          <RadialGradient id="home-ember" cx="50%" cy="100%" r="60%">
            <Stop offset="0" stopColor={theme.accent} stopOpacity={0.28} />
            <Stop offset="1" stopColor={theme.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#home-vignette)" />
        <Rect width="100%" height="100%" fill="url(#home-ember)" />
        <Rect width="100%" height="100%" fill="url(#home-fade)" />
      </Svg>
    </View>
  );
}

/** Enquadramento feito à mão (o `cover` da web não centraliza igual): cobre o palco e mira no foco da arte. */
function cover(art: Art, width: number, height: number) {
  let h = height;
  let w = h * art.ratio;
  if (w < width) {
    w = width;
    h = w / art.ratio;
  }
  const clamp = (v: number, min: number) => Math.min(0, Math.max(min, v));
  return {
    width: w,
    height: h,
    left: clamp(width / 2 - w * art.focus.x, width - w),
    top: clamp(height / 2 - h * art.focus.y, height - h),
  };
}

const styles = StyleSheet.create({
  hero: { width: '100%', overflow: 'hidden' },
  art: { position: 'absolute' },
  overlay: { zIndex: 2 },
});
