import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing, useRpgTheme } from '../theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: (color: string) => ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Pílula selecionável (filtros, sub-opções). */
export function Chip({ label, selected = false, onPress, icon, disabled, style }: ChipProps) {
  const theme = useRpgTheme();
  const color = selected ? theme.accentText : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.surfaceSunken,
          borderColor: selected ? theme.accent : theme.border,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {icon?.(color)}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: { fontSize: 14, fontWeight: '600' },
});
