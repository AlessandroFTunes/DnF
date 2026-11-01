import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fonts, radius, shadow, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import type { IconName } from './IconButton';

interface ListCardProps {
  title: string;
  subtitle?: string;
  /** Ícone no medalhão redondo da esquerda. */
  icon: IconName;
  /** `accent` = medalhão vermelho; `gold` = dourado; padrão = rebaixado com ícone dourado. */
  tone?: 'accent' | 'gold' | 'default';
  onPress: () => void;
  accessibilityLabel?: string;
  /** Conteúdo abaixo da linha principal (barra de PV, ações…). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Card de lista: medalhão, título, subtítulo e seta. Toque abre o item. */
export function ListCard({ title, subtitle, icon, tone = 'default', onPress, accessibilityLabel, children, style }: ListCardProps) {
  const theme = useRpgTheme();
  const medal =
    tone === 'accent'
      ? { bg: theme.accent, fg: theme.accentText }
      : tone === 'gold'
        ? { bg: theme.gold, fg: theme.surface }
        : { bg: theme.surfaceSunken, fg: theme.gold };

  const row = (
    <>
      <View style={[styles.medal, { backgroundColor: medal.bg }]}>
        <MaterialCommunityIcons name={icon} size={24} color={medal.fg} />
      </View>
      <View style={styles.body}>
        <Text style={[typography.subheading, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.caption, { color: theme.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={theme.textMuted} />
    </>
  );
  const a11y = { accessibilityRole: 'button' as const, accessibilityLabel: accessibilityLabel ?? title };
  const frame = [styles.card, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }, shadow(theme, 1), style];

  // Com conteúdo extra, só a linha de cima abre o item (o resto pode ter botões próprios).
  if (children) {
    return (
      <View style={[frame, styles.stack]}>
        <Pressable onPress={onPress} {...a11y} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}>
          {row}
        </Pressable>
        {children}
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} {...a11y} style={({ pressed }) => [frame, styles.row, { opacity: pressed ? 0.85 : 1 }]}>
      {row}
    </Pressable>
  );
}

/** Card de destaque com borda dourada (convite da mesa, mesa encontrada…). */
export function HighlightCard({ children, center }: { children: ReactNode; center?: boolean }) {
  const theme = useRpgTheme();
  return (
    <View
      style={[
        styles.highlight,
        center && styles.highlightCenter,
        { backgroundColor: theme.surfaceRaised, borderColor: theme.gold },
        shadow(theme, 2),
      ]}
    >
      {children}
    </View>
  );
}

const STAT_SIZE = { sm: typography.bodyStrong, md: typography.heading, lg: { fontFamily: fonts.displayHeavy, fontSize: 22 } };

/** Valor com rótulo embaixo ("12 classes", "CD de magia 13"). */
export function Stat({ label, value, size = 'md' }: { label: string; value: string; size?: keyof typeof STAT_SIZE }) {
  const theme = useRpgTheme();
  return (
    <View style={styles.stat}>
      <Text style={[STAT_SIZE[size], { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[typography.caption, styles.centered, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  medal: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  highlight: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  highlightCenter: { flexDirection: 'column', alignItems: 'center', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  centered: { textAlign: 'center' },
});
