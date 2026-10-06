import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { sizeLabel, speciesRules, type SkillInfo, type SrdSpecies } from '@dnf/sdk/srd';
import type { Ability } from '@dnf/core/character';
import { Chip, OptionCard, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { InfoRow, LoadState, SectionLabel, StepScreen } from '../../features/character-create/StepScreen';
import { useCharacterDraft } from '../../features/character-create/draft';
import { srd, tr, useSrd } from '../../lib/srd';
import { useCreation } from '../../features/character-create/useCreation';
import { abilityShort } from '../../features/character-create/labels';

export default function SpeciesPage() {
  const theme = useRpgTheme();
  const { draft, setSpecies } = useCharacterDraft();
  const { skills, languages } = useCreation();
  const edition = draft.edition;
  const species = useSrd(edition && `species:${edition}`, () => srd.species(edition!));

  const groups = species.status === 'ready' ? species.data : [];
  // A escolha pode ser a espécie base ou uma subespécie dela.
  const selectedGroup = groups.find(
    (g) => g.key === draft.speciesKey || g.subspecies.some((s) => s.key === draft.speciesKey),
  );
  const needsSubspecies = !!selectedGroup && selectedGroup.subspecies.length > 0 && draft.speciesKey === selectedGroup.key;

  return (
    <StepScreen
      step="species"
      title={edition === '2014' ? 'Escolha sua raça' : 'Escolha sua espécie'}
      subtitle="De onde você vem molda seu corpo, seus sentidos e seus dons naturais."
      canContinue={!!draft.speciesKey && !needsSubspecies}
    >
      {species.status !== 'ready' ? (
        <LoadState status={species.status} onRetry={species.retry} />
      ) : (
        groups.map((group) => {
          const selected = selectedGroup?.key === group.key;
          return (
            <OptionCard
              key={group.key}
              title={tr.name(group)}
              subtitle={summary(group)}
              selected={selected}
              onPress={() => !selected && setSpecies(group.key)}
              leading={(color) => (
                <Text style={[typography.heading, { color }]}>{tr.name(group)[0]}</Text>
              )}
            >
              {group.subspecies.length > 0 && (
                <View style={styles.subspecies}>
                  <SectionLabel>{edition === '2014' ? 'Sub-raça' : 'Linhagem'}</SectionLabel>
                  <View style={styles.chips}>
                    {group.subspecies.map((sub) => (
                      <Chip
                        key={sub.key}
                        label={tr.name(sub)}
                        selected={draft.speciesKey === sub.key}
                        onPress={() => setSpecies(sub.key)}
                      />
                    ))}
                  </View>
                  {needsSubspecies ? (
                    <View style={styles.hint}>
                      <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.gold} />
                      <Text style={[typography.caption, { color: theme.textMuted }]}>Escolha uma para continuar.</Text>
                    </View>
                  ) : null}
                </View>
              )}

              {skills && languages ? (
                <SpeciesSummary
                  chain={[group, ...group.subspecies.filter((s) => s.key === draft.speciesKey)]}
                  skills={skills}
                  languageNames={languages.map((l) => l.name)}
                />
              ) : null}
              {otherTraits(group)
                .slice(0, MAX_TRAITS)
                .map((t) => (
                  <InfoRow key={t.name} icon="star-four-points-outline" label={tr.text(t.name)} value={firstSentence(tr.field(group.key, `trait:${t.name}`, t.desc ?? ''))} />
                ))}
              {otherTraits(group).length > MAX_TRAITS && (
                <Text style={[typography.caption, { color: theme.textMuted }]}>
                  + {otherTraits(group).length - MAX_TRAITS} outros traços
                </Text>
              )}
            </OptionCard>
          );
        })
      )}
    </StepScreen>
  );
}

const MAX_TRAITS = 4;

/** Bônus de atributo (2014), deslocamento e PV extra, já lidos dos traços. */
function SpeciesSummary({ chain, skills, languageNames }: { chain: SrdSpecies[]; skills: SkillInfo[]; languageNames: string[] }) {
  const rules = speciesRules(chain, skills, languageNames);
  const bonuses = Object.entries(rules.abilityBonuses).map(([a, n]) => `+${n} ${abilityShort(a as Ability)}`);
  if (rules.abilityChoice) bonuses.push(`+${rules.abilityChoice.amount} em ${rules.abilityChoice.count} à escolha`);
  return (
    <>
      {bonuses.length > 0 && <InfoRow icon="arm-flex" label="Atributos" value={bonuses.join(', ')} />}
      <InfoRow icon="shoe-print" label="Deslocamento" value={[rules.speed, rules.size].filter(Boolean).join(' · ')} />
      {rules.hpPerLevel > 0 && <InfoRow icon="heart-plus" label="Robustez" value={`+${rules.hpPerLevel} PV por nível`} />}
    </>
  );
}

// 2024 marca tamanho/deslocamento pelo `type`; 2014 só pelo nome do traço.
const isTrait = (t: SrdSpecies['traits'][number], type: 'SIZE' | 'SPEED') =>
  t.type === type || t.name.toLowerCase() === type.toLowerCase();

/** "Médio · 9 metros", a partir dos traços de tamanho e deslocamento. */
function summary(species: SrdSpecies): string {
  const pick = (type: 'SIZE' | 'SPEED') => species.traits.find((t) => isTrait(t, type))?.desc;
  const size = pick('SIZE');
  return [size && sizeLabel(size), pick('SPEED')].filter(Boolean).join(' · ');
}

function otherTraits(species: SrdSpecies) {
  return species.traits
    .filter((t) => !isTrait(t, 'SIZE') && !isTrait(t, 'SPEED'))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function firstSentence(text = ''): string {
  const plain = text.replace(/[*_#]/g, '').trim();
  const end = plain.search(/[.!?](\s|$)/);
  return end > 0 && end < 160 ? plain.slice(0, end + 1) : plain.length > 160 ? `${plain.slice(0, 157)}…` : plain;
}

const styles = StyleSheet.create({
  subspecies: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
