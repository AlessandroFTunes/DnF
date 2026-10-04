import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { suggestedCharacteristics, type SuggestedCharacteristics } from '@dnf/sdk/srd';
import { radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { SectionLabel, StepScreen } from '../../features/character-create/StepScreen';
import { useCharacterDraft, type CharacterDraft } from '../../features/character-create/draft';
import { useCreation } from '../../features/character-create/useCreation';

type PersonalityKey = keyof CharacterDraft['personality'];
type DetailKey = keyof CharacterDraft['details'];

const PERSONALITY: { key: PersonalityKey; label: string; placeholder: string; table: keyof SuggestedCharacteristics }[] = [
  { key: 'traits', label: 'Traços de personalidade', placeholder: 'Como você age e fala?', table: 'traits' },
  { key: 'ideals', label: 'Ideais', placeholder: 'No que você acredita?', table: 'ideals' },
  { key: 'bonds', label: 'Vínculos', placeholder: 'Quem ou o que é importante para você?', table: 'bonds' },
  { key: 'flaws', label: 'Defeitos', placeholder: 'Qual é a sua fraqueza?', table: 'flaws' },
];

const PHYSICAL: { key: DetailKey; label: string }[] = [
  { key: 'age', label: 'Idade' },
  { key: 'height', label: 'Altura' },
  { key: 'weight', label: 'Peso' },
  { key: 'eyes', label: 'Olhos' },
  { key: 'skin', label: 'Pele' },
  { key: 'hair', label: 'Cabelo' },
];

/** Etapa opcional: personalidade, aparência e história. */
export default function StoryPage() {
  const theme = useRpgTheme();
  const { draft, update } = useCharacterDraft();
  const { background } = useCreation();
  const suggestions = background ? suggestedCharacteristics(background) : null;

  const setPersonality = (key: PersonalityKey, value: string) =>
    update({ personality: { ...draft.personality, [key]: value } });
  const setDetail = (key: DetailKey, value: string) => update({ details: { ...draft.details, [key]: value } });

  return (
    <StepScreen
      step="story"
      title="Sua história"
      subtitle="Tudo opcional: dá para preencher depois na ficha. O dado sorteia das tabelas do seu antecedente."
      canContinue
    >
      {PERSONALITY.map((field) => {
        const options = suggestions?.[field.table] ?? [];
        return (
          <View key={field.key} style={styles.field}>
            <View style={styles.labelRow}>
              <SectionLabel>{field.label}</SectionLabel>
              {options.length > 0 && (
                <Pressable
                  onPress={() => setPersonality(field.key, options[Math.floor(Math.random() * options.length)]!)}
                  accessibilityRole="button"
                  accessibilityLabel={`Sortear ${field.label.toLowerCase()}`}
                  hitSlop={8}
                  style={styles.roll}
                >
                  <MaterialCommunityIcons name="dice-d20-outline" size={18} color={theme.accent} />
                  <Text style={[typography.caption, { color: theme.accent, fontWeight: '700' }]}>Sortear</Text>
                </Pressable>
              )}
            </View>
            <TextInput
              value={draft.personality[field.key]}
              onChangeText={(v) => setPersonality(field.key, v)}
              placeholder={field.placeholder}
              placeholderTextColor={theme.textMuted}
              multiline
              accessibilityLabel={field.label}
              style={[styles.input, styles.multiline, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
            />
          </View>
        );
      })}

      <SectionLabel>Aparência</SectionLabel>
      <View style={styles.grid}>
        {PHYSICAL.map((field) => (
          <View key={field.key} style={styles.gridItem}>
            <Text style={[typography.caption, { color: theme.textMuted }]}>{field.label}</Text>
            <TextInput
              value={draft.details[field.key]}
              onChangeText={(v) => setDetail(field.key, v)}
              accessibilityLabel={field.label}
              maxLength={32}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
            />
          </View>
        ))}
      </View>
      <TextInput
        value={draft.details.appearance}
        onChangeText={(v) => setDetail('appearance', v)}
        placeholder="Cicatrizes, roupas, trejeitos…"
        placeholderTextColor={theme.textMuted}
        multiline
        accessibilityLabel="Descrição da aparência"
        style={[styles.input, styles.multiline, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
      />

      <SectionLabel>História</SectionLabel>
      <TextInput
        value={draft.details.backstory}
        onChangeText={(v) => setDetail('backstory', v)}
        placeholder="De onde você veio e por que partiu em aventura?"
        placeholderTextColor={theme.textMuted}
        multiline
        accessibilityLabel="História do personagem"
        style={[styles.input, styles.backstory, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
      />
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roll: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 15 },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  backstory: { minHeight: 140, textAlignVertical: 'top' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridItem: { flexBasis: '31%', flexGrow: 1, gap: spacing.xxs },
});
