import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { backgroundRules, plainText } from '@dnf/sdk/srd';
import { OptionCard, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { InfoRow, LoadState, SectionLabel, StepScreen } from '../../features/character-create/StepScreen';
import { useCharacterDraft } from '../../features/character-create/draft';
import { abilityName, skillLabel } from '../../features/character-create/labels';
import { useSteps } from '../../features/character-create/steps';
import { useCreation } from '../../features/character-create/useCreation';
import { tr } from '../../lib/srd';

/** Nome curto do livro de origem. */
const SOURCE_LABEL: Record<string, string> = {
  'srd-2014': 'SRD 5.1 (oficial)',
  'srd-2024': 'SRD 5.2 (oficial)',
  'dnf-2024': 'Livro do Jogador 2024 · complemento DnF',
  open5e: 'Open5e Originals',
  tdcs: "Tal'Dorei Campaign Setting",
  toh: 'Tome of Heroes',
  'a5e-ag': "Level Up · Adventurer's Guide",
  'a5e-ddg': "Level Up · Dungeon Delver's Guide",
  'a5e-gpg': 'Level Up · Gate Pass Gazette',
};

export default function BackgroundPage() {
  const theme = useRpgTheme();
  const router = useRouter();
  const steps = useSteps();
  const { draft, setBackground } = useCharacterDraft();
  const { queries, skills } = useCreation();
  const backgrounds = queries.backgroundsQ;
  const [search, setSearch] = useState('');

  const next = steps[steps.findIndex((s) => s.id === 'background') + 1];
  const skip = () => {
    setBackground(null);
    if (next) router.push(next.href);
  };

  const query = search.trim().toLowerCase();
  const list =
    backgrounds.status === 'ready'
      ? backgrounds.data.filter(
          (b) =>
            !query ||
            b.name.toLowerCase().includes(query) ||
            tr.name(b).toLowerCase().includes(query) ||
            b.key === draft.backgroundKey,
        )
      : [];

  return (
    <StepScreen
      step="background"
      title="Escolha seu antecedente"
      subtitle={
        draft.edition === '2024'
          ? 'O que você fazia antes da aventura: dá atributos, perícias, um talento de origem e equipamento.'
          : 'O que você fazia antes da aventura: perícias, idiomas e equipamento inicial. Inclui livros abertos além do SRD.'
      }
      canContinue={draft.backgroundKey !== null}
      secondary={{ label: 'Pular', onPress: skip }}
    >
      {backgrounds.status !== 'ready' || !skills ? (
        <LoadState status={backgrounds.status === 'error' ? 'error' : 'loading'} onRetry={backgrounds.retry} />
      ) : (
        <>
          {backgrounds.data.length > 6 && (
            <View style={[styles.search, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
              <MaterialCommunityIcons name="magnify" size={20} color={theme.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={`Buscar entre ${backgrounds.data.length} antecedentes`}
                placeholderTextColor={theme.textMuted}
                autoCorrect={false}
                accessibilityLabel="Buscar antecedente"
                style={[styles.searchInput, { color: theme.text }]}
              />
            </View>
          )}

          {list.map((bg, i) => {
            const rules = backgroundRules(bg, skills);
            const source = bg.document.key ?? '';
            const newSource = i === 0 || list[i - 1]!.document.key !== source;
            const skillText = [
              ...rules.skills.map((k) => skillLabel(k)),
              rules.skillChoice
                ? rules.skillChoice.options
                  ? `${rules.skillChoice.count} entre ${rules.skillChoice.options.map((k) => skillLabel(k)).join('/')}`
                  : `${rules.skillChoice.count} à escolha`
                : null,
            ]
              .filter(Boolean)
              .join(', ');
            const feature = bg.benefits.find((b) => b.type === 'feature');
            return (
              <View key={bg.key} style={styles.item}>
                {newSource && <SectionLabel>{SOURCE_LABEL[source] ?? bg.document.name ?? source}</SectionLabel>}
                <OptionCard
                  title={tr.name(bg)}
                  subtitle={skillText ? `Perícias: ${skillText}` : undefined}
                  selected={draft.backgroundKey === bg.key}
                  onPress={() => setBackground(bg.key)}
                  leading={(color) => <MaterialCommunityIcons name="book-account" size={24} color={color} />}
                >
                  {tr.desc(bg) ? <Text style={[typography.caption, { color: theme.text }]}>{plainText(tr.desc(bg))}</Text> : null}
                  {rules.abilityOptions.length > 0 && (
                    <InfoRow
                      icon="arm-flex"
                      label="Atributos"
                      value={`${rules.abilityOptions.map(abilityName).join(', ')} (+2/+1 ou +1/+1/+1)`}
                    />
                  )}
                  {rules.feat && (
                    <InfoRow
                      icon="medal-outline"
                      label="Talento de origem"
                      value={
                        rules.feat.spellList
                          ? `${tr.text(rules.feat.name)} (${tr.text(rules.feat.spellList)})`
                          : tr.text(rules.feat.name)
                      }
                    />
                  )}
                  {feature?.desc ? (
                    <InfoRow icon="star-four-points-outline" label={tr.text(feature.name)} value={plainText(feature.desc).slice(0, 220)} />
                  ) : null}
                  {rules.tools ? (
                    <InfoRow icon="hammer" label="Ferramentas" value={tr.field(bg.key, 'benefit:tool_proficiency', rules.tools)} />
                  ) : null}
                  {rules.languagesToChoose > 0 && (
                    <InfoRow icon="format-quote-open" label="Idiomas" value={`${rules.languagesToChoose} à sua escolha`} />
                  )}
                  {rules.equipment && (
                    <InfoRow
                      icon="bag-personal-outline"
                      label="Equipamento"
                      value={tr.field(
                        bg.key,
                        'benefit:equipment',
                        rules.equipment.options
                          .map((o) => (rules.equipment!.options.length > 1 ? `(${o.id}) ${o.label}` : o.label))
                          .join('  ou  '),
                      )}
                    />
                  )}
                </OptionCard>
              </View>
            );
          })}
          {list.length === 0 && (
            <Text style={[typography.body, { color: theme.textMuted, textAlign: 'center' }]}>Nenhum antecedente com esse nome.</Text>
          )}
        </>
      )}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: spacing.md, fontSize: 15 },
  item: { gap: spacing.sm },
});
