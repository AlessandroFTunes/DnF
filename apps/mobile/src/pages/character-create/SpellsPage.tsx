import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { proficiencyBonus } from '@dnf/core/character';
import { plainText, spellStats, type SrdSpell } from '@dnf/sdk/srd';
import { Chip, fonts, formatBonus, radius, shadow, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { LoadState, SectionLabel, StepScreen } from '../../features/character-create/StepScreen';
import { useCharacterDraft } from '../../features/character-create/draft';
import { abilityName, rangeLabel } from '../../features/character-create/labels';
import { useCreation } from '../../features/character-create/useCreation';
import { srd, tr, useSrd } from '../../lib/srd';

type Tab = 'cantrips' | 'spells' | 'feat';

export default function SpellsPage() {
  const theme = useRpgTheme();
  const { draft, update } = useCharacterDraft();
  const { casting, spellCount, scores, magicInitiateClassKey, bg } = useCreation();
  const classSpells = useSrd(casting && draft.classKey ? `spells:${draft.classKey}` : null, () =>
    srd.spells(draft.classKey!, 1),
  );
  const featSpells = useSrd(magicInitiateClassKey && `spells:${magicInitiateClassKey}`, () =>
    srd.spells(magicInitiateClassKey!, 1),
  );
  // Enquanto o jogador não escolhe, a aba segue a classe (que pode ainda estar carregando).
  const [chosenTab, setTab] = useState<Tab | null>(null);
  const tab: Tab = chosenTab ?? (casting?.cantrips ? 'cantrips' : casting ? 'spells' : 'feat');

  // A API ainda pode não ter todas as magias de uma lista: não exige mais do que existe para escolher.
  const available = (q: typeof classSpells, level: number, wanted: number) =>
    q.status === 'ready' ? Math.min(wanted, q.data.filter((s) => s.level === level).length) : wanted;
  const cantripsNeeded = available(classSpells, 0, casting?.cantrips ?? 0);
  const spellsNeeded = available(classSpells, 1, casting ? spellCount : 0);
  const featCantripsNeeded = magicInitiateClassKey ? available(featSpells, 0, 2) : 0;
  const featSpellNeeded = magicInitiateClassKey ? available(featSpells, 1, 1) : 0;
  const featNeeded = featCantripsNeeded + featSpellNeeded;
  const featDone = draft.featCantrips.length + (draft.featSpell ? 1 : 0);

  const complete =
    draft.cantrips.length === cantripsNeeded && draft.spells.length === spellsNeeded && featDone === featNeeded;

  const toggle = (list: 'cantrips' | 'spells' | 'featCantrips', key: string, max: number) => {
    const current = draft[list];
    if (current.includes(key)) update({ [list]: current.filter((k) => k !== key) });
    else if (current.length < max) update({ [list]: [...current, key] });
  };

  const stats = casting && scores ? spellStats(casting.ability, scores, proficiencyBonus(1)) : null;
  const loading = (casting && classSpells.status !== 'ready') || (magicInitiateClassKey && featSpells.status !== 'ready');
  const failed = classSpells.status === 'error' ? classSpells : featSpells.status === 'error' ? featSpells : null;

  // A mesma magia não conta duas vezes: o que a classe já escolheu some da lista do talento, e vice-versa.
  const fromClass = new Set([...draft.cantrips, ...draft.spells]);
  const fromFeat = new Set([...draft.featCantrips, ...(draft.featSpell ? [draft.featSpell] : [])]);
  const list =
    tab === 'feat'
      ? featSpells.status === 'ready'
        ? featSpells.data.filter((s) => !fromClass.has(s.key))
        : []
      : classSpells.status === 'ready'
        ? classSpells.data.filter((s) => (tab === 'cantrips' ? s.level === 0 : s.level === 1) && !fromFeat.has(s.key))
        : [];

  return (
    <StepScreen
      step="spells"
      title="Grimório"
      subtitle={
        casting?.preparesFromList
          ? 'Escolha as magias que vai preparar hoje; depois de um descanso longo você pode trocar.'
          : 'Escolha os truques e as magias que seu personagem conhece.'
      }
      canContinue={complete}
    >
      {stats && casting && (
        <View style={[styles.stats, { backgroundColor: theme.surfaceRaised, borderColor: theme.gold }, shadow(theme, 1)]}>
          <Stat label="Atributo" value={abilityName(casting.ability)} />
          <Stat label="CD de magia" value={String(stats.saveDC)} big />
          <Stat label="Ataque mágico" value={formatBonus(stats.attack)} big />
          <Stat label="Espaços 1º" value={String(casting.slots)} big />
        </View>
      )}

      <View style={styles.tabs}>
        {cantripsNeeded > 0 && (
          <Chip
            label={`Truques ${draft.cantrips.length}/${cantripsNeeded}`}
            selected={tab === 'cantrips'}
            onPress={() => setTab('cantrips')}
          />
        )}
        {spellsNeeded > 0 && (
          <Chip
            label={`1º círculo ${draft.spells.length}/${spellsNeeded}`}
            selected={tab === 'spells'}
            onPress={() => setTab('spells')}
          />
        )}
        {featNeeded > 0 && (
          <Chip
            label={`${bg?.feat ? tr.text(bg.feat.name) : 'Talento'} ${featDone}/${featNeeded}`}
            selected={tab === 'feat'}
            onPress={() => setTab('feat')}
          />
        )}
      </View>

      {tab === 'feat' && (
        <Text style={[typography.caption, { color: theme.textMuted }]}>
          {tr.text(bg?.feat?.name ?? '')} ({tr.text(bg?.feat?.spellList ?? '')}): 2 truques e 1 magia de 1º círculo dessa lista, sempre preparada.
        </Text>
      )}

      {loading ? (
        <LoadState status={failed ? 'error' : 'loading'} onRetry={() => failed?.retry()} />
      ) : tab === 'feat' ? (
        <>
          <SectionLabel>{`Truques ${draft.featCantrips.length}/${featCantripsNeeded}`}</SectionLabel>
          {list
            .filter((s) => s.level === 0)
            .map((s) => (
              <SpellCard
                key={s.key}
                spell={s}
                selected={draft.featCantrips.includes(s.key)}
                onPress={() => toggle('featCantrips', s.key, featCantripsNeeded)}
              />
            ))}
          <SectionLabel>{`1º círculo ${draft.featSpell ? 1 : 0}/${featSpellNeeded}`}</SectionLabel>
          {list
            .filter((s) => s.level === 1)
            .map((s) => (
              <SpellCard
                key={s.key}
                spell={s}
                selected={draft.featSpell === s.key}
                onPress={() => update({ featSpell: draft.featSpell === s.key ? null : s.key })}
              />
            ))}
        </>
      ) : (
        list.map((s) => (
          <SpellCard
            key={s.key}
            spell={s}
            selected={(tab === 'cantrips' ? draft.cantrips : draft.spells).includes(s.key)}
            onPress={() =>
              tab === 'cantrips' ? toggle('cantrips', s.key, cantripsNeeded) : toggle('spells', s.key, spellsNeeded)
            }
          />
        ))
      )}
    </StepScreen>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  const theme = useRpgTheme();
  return (
    <View style={styles.stat}>
      <Text style={[big ? styles.statBig : typography.bodyStrong, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[typography.caption, { color: theme.textMuted, textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

const CASTING_TIME: Record<string, string> = {
  action: '1 ação',
  'bonus-action': '1 ação bônus',
  reaction: '1 reação',
  '1minute': '1 minuto',
  '10minutes': '10 minutos',
  '1hour': '1 hora',
};

/** Card de magia: marca ao tocar; selecionada mostra a descrição. */
export function SpellCard({ spell, selected, onPress }: { spell: SrdSpell; selected: boolean; onPress?: () => void }) {
  const theme = useRpgTheme();
  const tags = [
    spell.school?.name && tr.text(spell.school.name),
    CASTING_TIME[spell.casting_time] ?? spell.casting_time,
    rangeLabel(spell.range_text),
    spell.concentration ? 'Concentração' : null,
    spell.ritual ? 'Ritual' : null,
  ].filter(Boolean);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={tr.name(spell, 'spell')}
      style={({ pressed }) => [
        styles.spell,
        {
          backgroundColor: selected ? theme.accentSoft : theme.surfaceRaised,
          borderColor: selected ? theme.accent : theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.spellRow}>
        <MaterialCommunityIcons
          name={selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
          size={20}
          color={selected ? theme.accent : theme.textMuted}
        />
        <View style={styles.flex}>
          <Text style={[typography.bodyStrong, { color: theme.text }]}>{tr.name(spell, 'spell')}</Text>
          <Text style={[typography.caption, { color: theme.textMuted }]} numberOfLines={1}>
            {tags.join(' · ')}
          </Text>
        </View>
      </View>
      {selected && spell.desc ? (
        <Text style={[typography.caption, { color: theme.text }]} numberOfLines={6}>
          {plainText(tr.desc(spell))}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statBig: { fontFamily: fonts.displayHeavy, fontSize: 22 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  spell: { borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  spellRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
