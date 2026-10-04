import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { formatBonus } from '../format';
import { radius, spacing, useRpgTheme } from '../theme';
import { ProficiencyMark, type Proficiency } from './ProficiencyMark';

export interface Skill {
  /** Chave estável para a lista, ex.: "acrobatics". */
  key: string;
  /** Nome exibido, ex.: "Acrobacia". */
  name: string;
  /** Sigla do atributo, ex.: "DES". */
  ability: string;
  bonus: number;
  proficiency?: Proficiency;
}

export interface SkillRowProps extends Omit<Skill, 'key'> {
  onPress?: () => void;
}

/** Linha simples de perícia: marca de proficiência, nome, atributo e bônus. */
export function SkillRow({ name, ability, bonus, proficiency = 'none', onPress }: SkillRowProps) {
  const theme = useRpgTheme();
  const proficiencyText =
    proficiency === 'expertise' ? ', especialização' : proficiency === 'proficient' ? ', proficiente' : '';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessible
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${name} ${formatBonus(bonus)}${proficiencyText}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      <ProficiencyMark proficiency={proficiency} />
      <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.ability, { color: theme.textMuted }]}>{ability}</Text>
      <Text style={[styles.bonus, { color: theme.text }]}>{formatBonus(bonus)}</Text>
    </Pressable>
  );
}

export interface SkillListProps {
  skills: Skill[];
  title?: string;
  onPressSkill?: (skill: Skill) => void;
  style?: StyleProp<ViewStyle>;
}

/** Lista de perícias na ordem recebida. */
export function SkillList({ skills, title = 'Perícias', onPressSkill, style }: SkillListProps) {
  const theme = useRpgTheme();
  return (
    <View style={[styles.list, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }, style]}>
      {title ? (
        <Text style={[styles.title, { color: theme.accent }]} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {skills.map(({ key, ...skill }, index) => (
        <View
          key={key}
          style={index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }}
        >
          <SkillRow {...skill} onPress={onPressSkill && (() => onPressSkill({ key, ...skill }))} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  title: { fontSize: 13, fontWeight: '800', letterSpacing: 1.5, paddingTop: spacing.md, paddingBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 },
  name: { flex: 1, fontSize: 15 },
  ability: { fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  bonus: { minWidth: 32, textAlign: 'right', fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
