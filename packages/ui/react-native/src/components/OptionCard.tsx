import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, shadow, spacing, typography, useRpgTheme } from '../theme';

export interface OptionCardProps {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  /** Medalhão à esquerda (ícone, inicial…). Recebe a cor de destaque do estado atual. */
  leading?: (color: string) => ReactNode;
  /** Conteúdo extra mostrado só quando selecionado (detalhes da opção). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Card selecionável (lista de escolha única): borda e fundo de destaque quando selecionado. */
export function OptionCard({ title, subtitle, selected, onPress, leading, children, style }: OptionCardProps) {
  const theme = useRpgTheme();
  const tint = selected ? theme.accent : theme.textMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: selected ? theme.accentSoft : theme.surfaceRaised,
          borderColor: selected ? theme.accent : theme.border,
          opacity: pressed ? 0.85 : 1,
        },
        selected && shadow(theme, 2),
        style,
      ]}
    >
      <View style={styles.row}>
        {leading && (
          <View
            style={[
              styles.medallion,
              { borderColor: selected ? theme.accent : theme.border, backgroundColor: theme.surface },
            ]}
          >
            {leading(tint)}
          </View>
        )}
        <View style={styles.body}>
          <Text style={[typography.subheading, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[typography.caption, { color: theme.textMuted }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={[styles.radio, { borderColor: tint }]}>
          {selected && <View style={[styles.radioDot, { backgroundColor: theme.accent }]} />}
        </View>
      </View>
      {selected && children ? (
        <View style={[styles.details, { borderTopColor: theme.border }]}>{children}</View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  medallion: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: spacing.xxs },
  radio: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: radius.pill },
  details: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.sm },
});
