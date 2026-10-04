import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { formatBonus } from '../format';
import { radius, spacing, useRpgTheme } from '../theme';
import { ProficiencyMark } from './ProficiencyMark';

export interface AbilityScoreCardProps {
  /** Nome por extenso, ex.: "Força". */
  label: string;
  /** Sigla, ex.: "FOR". */
  abbreviation: string;
  score: number;
  modifier: number;
  /** Teste de resistência do atributo; omita para esconder a linha. */
  savingThrow?: { bonus: number; proficient: boolean };
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Card detalhado de atributo: sigla, modificador em destaque, valor e teste de resistência. */
export function AbilityScoreCard({
  label,
  abbreviation,
  score,
  modifier,
  savingThrow,
  onPress,
  style,
}: AbilityScoreCardProps) {
  const theme = useRpgTheme();
  const modifierText = formatBonus(modifier);
  const a11y = [
    `${label} ${score}, modificador ${modifierText}`,
    savingThrow &&
      `teste de resistência ${formatBonus(savingThrow.bonus)}${savingThrow.proficient ? ', proficiente' : ''}`,
  ]
    .filter(Boolean)
    .join('; ');

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessible
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surfaceRaised, borderColor: theme.border },
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      <Text style={[styles.abbreviation, { color: theme.accent }]}>{abbreviation}</Text>
      <Text style={[styles.label, { color: theme.textMuted }]} numberOfLines={1}>
        {label}
      </Text>

      <Text style={[styles.modifier, { color: theme.text }]}>{modifierText}</Text>

      <View style={[styles.score, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.scoreText, { color: theme.text }]}>{score}</Text>
      </View>

      {savingThrow && (
        <View style={[styles.save, { borderTopColor: theme.border }]}>
          <ProficiencyMark proficiency={savingThrow.proficient ? 'proficient' : 'none'} size={10} />
          <Text style={[styles.saveLabel, { color: theme.textMuted }]}>Resistência</Text>
          <Text style={[styles.saveBonus, { color: theme.text }]}>{formatBonus(savingThrow.bonus)}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 104,
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  abbreviation: { fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  label: { fontSize: 12, marginTop: 2 },
  modifier: { fontSize: 36, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: spacing.xs },
  score: {
    minWidth: 44,
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  scoreText: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  save: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveLabel: { flex: 1, fontSize: 11 },
  saveBonus: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
