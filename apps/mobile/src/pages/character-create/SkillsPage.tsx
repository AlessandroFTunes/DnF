import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ABILITIES, abilityModifier, proficiencyBonus } from '@dnf/core/character';
import { plainText, skillBonus } from '@dnf/sdk/srd';
import { Chip, formatBonus, OptionCard, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { LoadState, SectionLabel, StepScreen } from '../../features/character-create/StepScreen';
import { useCharacterDraft } from '../../features/character-create/draft';
import { ABILITY_LABEL, abilityShort, skillLabel } from '../../features/character-create/labels';
import { combined, useCreation } from '../../features/character-create/useCreation';
import { tr } from '../../lib/srd';

const PB = proficiencyBonus(1);

export default function SkillsPage() {
  const theme = useRpgTheme();
  const { draft, update } = useCharacterDraft();
  const c = useCreation();
  const { klass, species, skills, scores, grantedSkills, feats } = c;
  const load = combined(c.queries.abilitiesQ, c.queries.classQ, c.queries.featsQ);

  if (!klass || !skills || !scores) {
    return (
      <StepScreen step="skills" title="Perícias e salvaguardas" canContinue={false}>
        <LoadState status={load.status === 'error' ? 'error' : 'loading'} onRetry={load.retry} />
      </StepScreen>
    );
  }

  const granted = new Set(grantedSkills);
  const classOptions = (klass.skillChoice.options ?? skills.map((s) => s.key)).filter((k) => !granted.has(k));
  const classNeeded = Math.min(klass.skillChoice.count, classOptions.length);
  const speciesChoice = c.speciesSkillChoice;
  const speciesOptions = speciesChoice
    ? (speciesChoice.options ?? skills.map((s) => s.key)).filter((k) => !granted.has(k))
    : [];
  const speciesNeeded = speciesChoice ? Math.min(speciesChoice.count, speciesOptions.length) : 0;
  const bgChoice = c.bg?.skillChoice ?? null;
  const bgOptions = bgChoice ? (bgChoice.options ?? skills.map((s) => s.key)).filter((k) => !granted.has(k)) : [];
  const bgNeeded = bgChoice ? Math.min(bgChoice.count, bgOptions.length) : 0;

  const proficient = new Set([...granted, ...draft.classSkills, ...draft.speciesSkills, ...draft.backgroundSkills]);
  const expertiseNeeded = klass.expertiseAtLevel1;

  const originFeatOptions = species?.originFeat
    ? (feats ?? []).filter((f) => /origin/i.test(f.type ?? '') && f.name !== 'Magic Initiate' && f.name !== c.bg?.feat?.name)
    : [];

  function toggleSkill(key: string) {
    if (granted.has(key)) return;
    if (draft.classSkills.includes(key)) {
      update({ classSkills: draft.classSkills.filter((k) => k !== key), expertise: draft.expertise.filter((k) => k !== key) });
    } else if (draft.speciesSkills.includes(key)) {
      update({ speciesSkills: draft.speciesSkills.filter((k) => k !== key), expertise: draft.expertise.filter((k) => k !== key) });
    } else if (classOptions.includes(key) && draft.classSkills.length < classNeeded) {
      update({ classSkills: [...draft.classSkills, key] });
    } else if (draft.backgroundSkills.includes(key)) {
      update({ backgroundSkills: draft.backgroundSkills.filter((k) => k !== key), expertise: draft.expertise.filter((k) => k !== key) });
    } else if (bgOptions.includes(key) && draft.backgroundSkills.length < bgNeeded) {
      update({ backgroundSkills: [...draft.backgroundSkills, key] });
    } else if (speciesOptions.includes(key) && draft.speciesSkills.length < speciesNeeded) {
      update({ speciesSkills: [...draft.speciesSkills, key] });
    }
  }

  function toggleExpertise(key: string) {
    if (draft.expertise.includes(key)) update({ expertise: draft.expertise.filter((k) => k !== key) });
    else if (draft.expertise.length < expertiseNeeded) update({ expertise: [...draft.expertise, key] });
  }

  const complete =
    draft.classSkills.length === classNeeded &&
    draft.speciesSkills.length === speciesNeeded &&
    draft.backgroundSkills.length === bgNeeded &&
    draft.expertise.length === expertiseNeeded &&
    (originFeatOptions.length === 0 || draft.originFeatKey !== null);

  return (
    <StepScreen
      step="skills"
      title="Perícias e salvaguardas"
      subtitle="Bônus de proficiência no 1º nível: +2. Ele soma nos testes em que você é proficiente."
      canContinue={complete}
    >
      <SectionLabel>Salvaguardas (da classe)</SectionLabel>
      <View style={styles.saves}>
        {ABILITIES.map((a) => {
          const prof = klass.savingThrows.includes(a);
          const value = abilityModifier(scores[a]) + (prof ? PB : 0);
          return (
            <View
              key={a}
              style={[
                styles.save,
                { borderColor: prof ? theme.gold : theme.border, backgroundColor: prof ? theme.goldSoft : theme.surfaceRaised },
              ]}
            >
              <Text style={[typography.overline, { color: theme.textMuted }]}>{abilityShort(a)}</Text>
              <Text style={[typography.heading, { color: theme.text }]}>{formatBonus(value)}</Text>
              {prof && <MaterialCommunityIcons name="shield-half-full" size={14} color={theme.gold} />}
            </View>
          );
        })}
      </View>

      <View style={styles.counters}>
        <Counter label="Da classe" done={draft.classSkills.length} total={classNeeded} />
        {bgNeeded > 0 && <Counter label="Do antecedente" done={draft.backgroundSkills.length} total={bgNeeded} />}
        {speciesNeeded > 0 && <Counter label="Da espécie" done={draft.speciesSkills.length} total={speciesNeeded} />}
        {expertiseNeeded > 0 && <Counter label="Especialização" done={draft.expertise.length} total={expertiseNeeded} />}
      </View>

      <View style={[styles.list, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
        {skills.map((skill, i) => {
          const isGranted = granted.has(skill.key);
          const isChosen =
            draft.classSkills.includes(skill.key) ||
            draft.speciesSkills.includes(skill.key) ||
            draft.backgroundSkills.includes(skill.key);
          const selectable =
            !isGranted &&
            (isChosen ||
              (classOptions.includes(skill.key) && draft.classSkills.length < classNeeded) ||
              (bgOptions.includes(skill.key) && draft.backgroundSkills.length < bgNeeded) ||
              (speciesOptions.includes(skill.key) && draft.speciesSkills.length < speciesNeeded));
          const level = draft.expertise.includes(skill.key) ? 'expertise' : proficient.has(skill.key) ? 'proficient' : undefined;
          const source = isGranted
            ? c.bg?.skills.includes(skill.key)
              ? 'Antecedente'
              : 'Espécie'
            : draft.backgroundSkills.includes(skill.key)
              ? 'Antecedente'
              : classOptions.includes(skill.key)
              ? 'Classe'
              : bgOptions.includes(skill.key)
                ? 'Antecedente'
                : speciesOptions.includes(skill.key)
                ? 'Espécie'
                : null;
          return (
            <Pressable
              key={skill.key}
              onPress={() => toggleSkill(skill.key)}
              disabled={!selectable && !isChosen}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!level, disabled: isGranted }}
              accessibilityLabel={`${skillLabel(skill.key, skill.name)}, ${formatBonus(skillBonus(skill, scores, level, PB))}`}
              style={({ pressed }) => [
                styles.skill,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                pressed && { backgroundColor: theme.surfaceSunken },
                !selectable && !level && { opacity: 0.55 },
              ]}
            >
              <MaterialCommunityIcons
                name={isGranted ? 'lock-outline' : level ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                size={20}
                color={level ? theme.accent : theme.textMuted}
              />
              <View style={styles.skillBody}>
                <Text style={[typography.bodyStrong, { color: theme.text }]}>{skillLabel(skill.key, skill.name)}</Text>
                <Text style={[typography.caption, { color: theme.textMuted }]}>
                  {ABILITY_LABEL[skill.ability].short}
                  {source ? ` · ${source}` : ''}
                </Text>
              </View>
              {level === 'expertise' && <MaterialCommunityIcons name="star" size={16} color={theme.gold} />}
              <Text style={[typography.subheading, { color: level ? theme.text : theme.textMuted }]}>
                {formatBonus(skillBonus(skill, scores, level, PB))}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {expertiseNeeded > 0 && (
        <>
          <SectionLabel>Especialização</SectionLabel>
          <Text style={[typography.caption, { color: theme.textMuted }]}>
            Escolha {expertiseNeeded} perícias em que você é proficiente: o bônus de proficiência dobra nelas.
          </Text>
          <View style={styles.chips}>
            {skills
              .filter((s) => proficient.has(s.key))
              .map((s) => (
                <Chip
                  key={s.key}
                  label={skillLabel(s.key, s.name)}
                  selected={draft.expertise.includes(s.key)}
                  onPress={() => toggleExpertise(s.key)}
                  icon={(color) => <MaterialCommunityIcons name="star" size={14} color={color} />}
                />
              ))}
          </View>
        </>
      )}

      {originFeatOptions.length > 0 && (
        <>
          <SectionLabel>Talento de origem (Versátil)</SectionLabel>
          {originFeatOptions.map((feat) => (
            <OptionCard
              key={feat.key}
              title={tr.name(feat)}
              subtitle={plainText(tr.desc(feat)).slice(0, 110) || undefined}
              selected={draft.originFeatKey === feat.key}
              onPress={() => update({ originFeatKey: feat.key })}
              leading={(color) => <MaterialCommunityIcons name="medal-outline" size={22} color={color} />}
            >
              {feat.benefits.map((b, i) => (
                <Text key={i} style={[typography.caption, { color: theme.text }]}>
                  • {plainText(tr.field(feat.key, `benefit:${i}`, b.desc ?? ''))}
                </Text>
              ))}
            </OptionCard>
          ))}
        </>
      )}
    </StepScreen>
  );
}

function Counter({ label, done, total }: { label: string; done: number; total: number }) {
  const theme = useRpgTheme();
  const ok = done === total;
  return (
    <View style={[styles.counter, { borderColor: ok ? theme.positive : theme.gold, backgroundColor: theme.surfaceRaised }]}>
      <MaterialCommunityIcons name={ok ? 'check-circle' : 'circle-outline'} size={14} color={ok ? theme.positive : theme.gold} />
      <Text style={[typography.caption, { color: theme.text, fontWeight: '700' }]}>
        {label}: {done}/{total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  saves: { flexDirection: 'row', gap: spacing.xs },
  save: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing.sm, gap: 2 },
  counters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  list: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  skill: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 10 },
  skillBody: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
