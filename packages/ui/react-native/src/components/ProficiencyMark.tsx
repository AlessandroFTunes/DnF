import { View } from 'react-native';
import { useRpgTheme } from '../theme';

export type Proficiency = 'none' | 'proficient' | 'expertise';

export interface ProficiencyMarkProps {
  proficiency: Proficiency;
  size?: number;
}

/** Bolinha da ficha: vazia = sem proficiência, cheia = proficiente, cheia com anel = especialização. */
export function ProficiencyMark({ proficiency, size = 12 }: ProficiencyMarkProps) {
  const theme = useRpgTheme();
  const ring = proficiency === 'expertise';
  const dot = ring ? size - 6 : size;
  const filled = proficiency !== 'none';

  const inner = (
    <View
      style={{
        width: dot,
        height: dot,
        borderRadius: dot / 2,
        borderWidth: 1.5,
        borderColor: filled ? theme.accent : theme.textMuted,
        backgroundColor: filled ? theme.accent : 'transparent',
      }}
    />
  );
  if (!ring) return inner;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: theme.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {inner}
    </View>
  );
}
