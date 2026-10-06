import { createContext, useContext } from 'react';
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Tokens globais do app ("variáveis CSS"): toda tela usa daqui cor, espaço, raio, tipografia e sombra.
 * Mude aqui e o app inteiro acompanha.
 */

/** Cores do app: preto com detalhes em vermelho, igual nos modos claro e escuro do sistema. */
export const defaultTheme = {
  /** Fundo da tela. */
  surface: '#0A0707',
  /** Cards e campos sobre o fundo. */
  surfaceRaised: '#160D0D',
  /** Áreas rebaixadas: trilhos, chips inativos. */
  surfaceSunken: '#050303',
  border: '#3A1616',
  borderStrong: '#6E2020',
  text: '#F4E9E7',
  textMuted: '#A88C88',
  accent: '#C8191E',
  /** Fundo de item selecionado / destaque leve. */
  accentSoft: '#3A0D0F',
  accentText: '#FFFFFF',
  /** Ornamentos (bordas de destaque, edição, números grandes): vermelho vivo. */
  gold: '#E5333A',
  goldSoft: '#2A0B0C',
  positive: '#7FC08B',
  negative: '#FF6B5E',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

export type RpgTheme = typeof defaultTheme;

/** Herói lendário (personagem no nível 20): preto com detalhes em amarelo-ouro. */
export const legendaryTheme: RpgTheme = {
  surface: '#0A0905',
  surfaceRaised: '#16130A',
  surfaceSunken: '#050402',
  border: '#3D3212',
  borderStrong: '#7A6220',
  text: '#F6F0DC',
  textMuted: '#A99B74',
  accent: '#E8B417',
  accentSoft: '#3A2E0A',
  accentText: '#0A0905',
  gold: '#FFCC33',
  goldSoft: '#2B230A',
  positive: '#7FC08B',
  negative: '#FF6B5E',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

/** Mistura duas cores hex (#RRGGBB); `t` = 0 é `from`, 1 é `to`. Outros formatos trocam na metade. */
function mixColor(from: string, to: string, t: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(from) || !/^#[0-9a-f]{6}$/i.test(to)) return t < 0.5 ? from : to;
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const channel = (shift: number) => Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * t);
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}

/** Tema intermediário entre dois temas, para transições de cor (`t` de 0 a 1). */
export function mixTheme(from: RpgTheme, to: RpgTheme, t: number): RpgTheme {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const mixed = { ...from };
  for (const key of Object.keys(from) as (keyof RpgTheme)[]) mixed[key] = mixColor(from[key], to[key], t);
  return mixed;
}

/**
 * Troca o tema de um trecho do app (ex.: a ficha de um herói lendário):
 * `<RpgThemeOverride.Provider value={legendaryTheme}>…</RpgThemeOverride.Provider>`. `null` = tema padrão.
 */
export const RpgThemeOverride = createContext<RpgTheme | null>(null);

export function useRpgTheme(): RpgTheme {
  const override = useContext(RpgThemeOverride);
  return override ?? defaultTheme;
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

/** Cor hex (#RRGGBB) com transparência, para sombras. */
function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha.toFixed(2)})`;
}

/** Sombra de elevação (`boxShadow` funciona em iOS, Android e web; os antigos shadow* estão depreciados). */
export function shadow(theme: RpgTheme, level: 1 | 2 | 3 = 1): ViewStyle {
  return { boxShadow: `0px ${level * 2}px ${level * 4}px ${withAlpha(theme.shadow, 0.08 + level * 0.04)}` };
}

/**
 * Brilho em volta de texto. Na web o react-native-web só aceita o `textShadow` em CSS (textShadow* está
 * depreciado lá); no nativo `textShadow` não existe e seguem valendo textShadowColor/textShadowRadius.
 */
export function textGlow(color: string, blur: number): TextStyle {
  return Platform.OS === 'web'
    ? ({ textShadow: `0px 0px ${blur}px ${color}` } as TextStyle)
    : { textShadowColor: color, textShadowRadius: blur, textShadowOffset: { width: 0, height: 0 } };
}

/** Durações de animação (ms). */
export const duration = { fast: 150, base: 250, slow: 450 } as const;

/** Área mínima de toque. */
export const touchTarget = 48;
