import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SRD_DOCUMENTS } from '@dnf/sdk/srd';
import { Chip, fonts, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { LoadState, SectionLabel, StepScreen } from '../../features/character-create/StepScreen';
import { useCharacterDraft } from '../../features/character-create/draft';
import {
  ALIGNMENT_ATTITUDES,
  ALIGNMENT_MORALITIES,
  alignmentLabel,
  alignmentShort,
} from '../../features/character-create/labels';
import { srd, tr, useSrd } from '../../lib/srd';
import { useCreation } from '../../features/character-create/useCreation';

const NAME_MAX = 64;

export default function DetailsPage() {
  const theme = useRpgTheme();
  const { draft, update } = useCharacterDraft();
  const alignments = useSrd('alignments', () => srd.alignments());
  const { fixedLanguages, languagesNeeded, languageOptions, languages } = useCreation();
  const toggleLanguage = (key: string) =>
    update({
      languages: draft.languages.includes(key)
        ? draft.languages.filter((k) => k !== key)
        : draft.languages.length < languagesNeeded
          ? [...draft.languages, key]
          : draft.languages,
    });
  const [focused, setFocused] = useState(false);

  const selected = alignments.status === 'ready' ? alignments.data.find((a) => a.key === draft.alignmentKey) : undefined;
  const description = selected?.descriptions.find((d) => d.document === SRD_DOCUMENTS[draft.edition ?? '2024'])?.desc;

  return (
    <StepScreen
      step="details"
      title="Quem é você?"
      subtitle="Dê um nome ao seu herói e escolha a bússola moral que guia suas decisões."
      canContinue={draft.name.trim().length > 0 && draft.languages.length === languagesNeeded}
    >
      <SectionLabel>Nome do personagem</SectionLabel>
      <View
        style={[
          styles.nameField,
          { backgroundColor: theme.surfaceRaised, borderColor: focused ? theme.accent : theme.border },
        ]}
      >
        <MaterialCommunityIcons name="feather" size={22} color={focused ? theme.accent : theme.gold} />
        <TextInput
          value={draft.name}
          onChangeText={(name) => update({ name })}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Ex.: Thalia Ventoforte"
          placeholderTextColor={theme.textMuted}
          maxLength={NAME_MAX}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          accessibilityLabel="Nome do personagem"
          style={[styles.nameInput, { color: theme.text }]}
        />
      </View>

      <SectionLabel>{`Idiomas · escolha ${languagesNeeded} (${draft.languages.length}/${languagesNeeded})`}</SectionLabel>
      {!languages ? (
        <LoadState status="loading" onRetry={() => {}} />
      ) : (
        <View style={styles.chips}>
          {fixedLanguages.map((l) => (
            <Chip key={l.key} label={tr.name(l)} selected icon={(c) => <MaterialCommunityIcons name="lock-outline" size={14} color={c} />} />
          ))}
          {languageOptions.map((l) => (
            <Chip
              key={l.key}
              label={l.is_exotic ? `${tr.name(l)} ✦` : tr.name(l)}
              selected={draft.languages.includes(l.key)}
              onPress={() => toggleLanguage(l.key)}
              disabled={!draft.languages.includes(l.key) && draft.languages.length >= languagesNeeded}
            />
          ))}
        </View>
      )}
      <Text style={[typography.caption, { color: theme.textMuted }]}>✦ idioma exótico (combine com o mestre).</Text>

      <SectionLabel>Alinhamento (opcional)</SectionLabel>
      {alignments.status !== 'ready' ? (
        <LoadState status={alignments.status} onRetry={alignments.retry} />
      ) : (
        <>
          <View style={[styles.grid, { borderColor: theme.border, backgroundColor: theme.surfaceSunken }]}>
            {ALIGNMENT_MORALITIES.map((morality) => (
              <View key={morality} style={styles.row}>
                {ALIGNMENT_ATTITUDES.map((attitude) => {
                  const alignment = alignments.data.find(
                    (a) => a.societal_attitude === attitude && a.morality === morality,
                  );
                  if (!alignment) return <View key={attitude} style={styles.cell} />;
                  const isSelected = draft.alignmentKey === alignment.key;
                  return (
                    <Pressable
                      key={attitude}
                      onPress={() => update({ alignmentKey: isSelected ? null : alignment.key })}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      accessibilityLabel={alignmentLabel(attitude, morality)}
                      style={({ pressed }) => [
                        styles.cell,
                        {
                          backgroundColor: isSelected ? theme.accent : theme.surfaceRaised,
                          borderColor: isSelected ? theme.accent : theme.border,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.short, { color: isSelected ? theme.accentText : theme.text }]}>
                        {alignmentShort(attitude, morality)}
                      </Text>
                      <Text
                        style={[styles.cellLabel, { color: isSelected ? theme.accentText : theme.textMuted }]}
                        numberOfLines={2}
                      >
                        {alignmentLabel(attitude, morality)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          {selected && description ? (
            <View style={[styles.quote, { borderLeftColor: theme.gold, backgroundColor: theme.goldSoft }]}>
              <Text style={[typography.caption, { color: theme.text }]}>{description}</Text>
            </View>
          ) : null}
        </>
      )}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  nameField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  nameInput: { flex: 1, fontFamily: fonts.display, fontSize: 20, paddingVertical: spacing.lg },
  grid: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  cell: {
    flex: 1,
    minHeight: 76,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    gap: spacing.xxs,
  },
  short: { fontFamily: fonts.displayHeavy, fontSize: 20 },
  cellLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quote: { borderLeftWidth: 3, borderRadius: radius.sm, padding: spacing.md },
});
