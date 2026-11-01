import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';

/** Mesmo `imageWidth` e imagem da splash (app.json): a troca da splash para a animação não pula. */
export const SPLASH_IMAGE_WIDTH = 200;
const SPLASH_IMAGE = require('../../../../../assets/splash-icon-dark.png');

/** O dado da splash, no mesmo lugar e tamanho, respirando e balançando de leve enquanto o app abre. */
export function OpeningDie() {
  const [t] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let running: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      const half = { duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' };
      running = Animated.loop(Animated.sequence([Animated.timing(t, { toValue: 1, ...half }), Animated.timing(t, { toValue: 0, ...half })]));
      running.start();
    });
    return () => {
      cancelled = true;
      running?.stop();
    };
  }, [t]);

  return (
    <Animated.Image
      source={SPLASH_IMAGE}
      accessibilityRole="progressbar"
      accessibilityLabel="Carregando"
      style={{
        width: SPLASH_IMAGE_WIDTH,
        height: SPLASH_IMAGE_WIDTH,
        transform: [
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) },
        ],
      }}
    />
  );
}
