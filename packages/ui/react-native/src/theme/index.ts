import { useColorScheme } from 'react-native';

/** Cores da ficha: pergaminho no claro, couro escuro no escuro. */
const light = {
  surface: '#FBF6EC',
  surfaceRaised: '#FFFFFF',
  border: '#D9C9A8',
  text: '#2B2118',
  textMuted: '#7A6A55',
  accent: '#8B2E1F',
  accentText: '#FFFFFF',
  positive: '#2F6B3A',
  negative: '#A3311F',
};

const dark: typeof light = {
  surface: '#1C1814',
  surfaceRaised: '#27211B',
  border: '#4A3F33',
  text: '#F1E8D8',
  textMuted: '#A8987F',
  accent: '#D9694F',
  accentText: '#1C1814',
  positive: '#7FC08B',
  negative: '#F08A73',
};

export type RpgTheme = typeof light;

export function useRpgTheme(): RpgTheme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16 } as const;
export const radius = { sm: 6, md: 12, pill: 999 } as const;
