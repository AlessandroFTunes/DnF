import { useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Tokens globais do app ("variáveis CSS"): toda tela usa daqui cor, espaço, raio, tipografia e sombra.
 * Mude aqui e o app inteiro acompanha.
 */

/** Cores: pergaminho no claro, couro escuro no escuro. */
const light = {
  /** Fundo da tela. */
  surface: '#FBF6EC',
  /** Cards e campos sobre o fundo. */
  surfaceRaised: '#FFFFFF',
  /** Áreas rebaixadas: trilhos, chips inativos. */
  surfaceSunken: '#F1E8D6',
  border: '#D9C9A8',
  borderStrong: '#B9A47E',
  text: '#2B2118',
  textMuted: '#7A6A55',
  accent: '#8B2E1F',
  /** Fundo de item selecionado / destaque leve. */
  accentSoft: '#F3DDD5',
  accentText: '#FFFFFF',
  /** Detalhes dourados (ornamentos, edição, números grandes). */
  gold: '#A87A22',
  goldSoft: '#F4E6C2',
  positive: '#2F6B3A',
  negative: '#A3311F',
  shadow: '#3B2A16',
  overlay: 'rgba(43, 33, 24, 0.45)',
};

const dark: typeof light = {
  surface: '#1C1814',
  surfaceRaised: '#27211B',
  surfaceSunken: '#14110E',
  border: '#4A3F33',
  borderStrong: '#6B5C49',
  text: '#F1E8D8',
  textMuted: '#A8987F',
  accent: '#D9694F',
  accentSoft: '#3D231C',
  accentText: '#1C1814',
  gold: '#E0B65A',
  goldSoft: '#3A2F1A',
  positive: '#7FC08B',
  negative: '#F08A73',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export type RpgTheme = typeof light;

export function useRpgTheme(): RpgTheme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 12, lg: 18, pill: 999 } as const;

/**
 * Famílias de fonte. As de título (Cinzel) são carregadas pelo app no layout raiz
 * (`@expo-google-fonts/cinzel`) antes de renderizar qualquer tela.
 */
export const fonts = {
  display: 'Cinzel_700Bold',
  displayHeavy: 'Cinzel_800ExtraBold',
  displayMedium: 'Cinzel_600SemiBold',
} as const;

/** Estilos de texto prontos; combine com a cor do tema: `[typography.title, { color: theme.text }]`. */
export const typography = {
  hero: { fontFamily: fonts.displayHeavy, fontSize: 34, lineHeight: 40, letterSpacing: 1 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: 0.5 },
  heading: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24 },
  subheading: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18 },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  button: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
} as const satisfies Record<string, TextStyle>;

/** Sombra de elevação (iOS/web usam shadow*, Android usa elevation). */
export function shadow(theme: RpgTheme, level: 1 | 2 | 3 = 1): ViewStyle {
  const y = level * 2;
  return {
    shadowColor: theme.shadow,
    shadowOpacity: 0.08 + level * 0.04,
    shadowRadius: level * 4,
    shadowOffset: { width: 0, height: y },
    elevation: level * 2,
  };
}

/** Durações de animação (ms). */
export const duration = { fast: 150, base: 250, slow: 450 } as const;

/** Área mínima de toque. */
export const touchTarget = 48;
