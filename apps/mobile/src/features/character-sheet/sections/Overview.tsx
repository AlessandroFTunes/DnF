import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ABILITIES, abilityModifier } from '@dnf/core/character';
import { fonts, formatBonus, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { ABILITY_LABEL } from '../../character-create/labels';
import { HpTracker, Panel, SmallButton, StatBox } from '../components';
import type { Sheet, SheetData } from '../useSheet';

export function CombatStats({ data, speed }: { data: SheetData; speed: number }) {
  return (
    <View style={styles.stats}>
      <StatBox label="CA" value={String(data.ac.value)} icon="shield-half-full" accent />
      <StatBox label="Iniciativa" value={formatBonus(abilityModifier(data.scores.dex))} icon="lightning-bolt" />
      <StatBox label="Deslocamento" value={`${speed} pés`} icon="run" />
      <StatBox label="Proficiência" value={formatBonus(data.pb)} icon="star-four-points-outline" />
      <StatBox label="Percepção passiva" value={String(data.passivePerception)} icon="eye-outline" />
    </View>
  );
}

/** PV + descansos: usado no topo da visão geral e na barra lateral direita. */
export function VitalsPanel({ sheet }: { sheet: Sheet }) {
  const theme = useRpgTheme();
  const { character, derived, isOwner, save } = sheet;
  if (!character || !derived) return null;
  const combat = character.combat;
  const hitDiceLeft = character.level - combat.hitDiceSpent;

  const longRest = () =>
    save(
      {
        combat: {
          hpCurrent: combat.hpMax,
          hpTemp: 0,
          deathSaves: { successes: 0, failures: 0 },
          // Recupera metade dos dados de vida (mínimo 1).
          hitDiceSpent: Math.max(0, combat.hitDiceSpent - Math.max(1, Math.floor(character.level / 2))),
        },
        spellcasting: { slotsUsed: {}, pactSlotsUsed: 0 },
        featureUses: {},
      },
      (c) => ({
        ...c,
        combat: { ...c.combat, hpCurrent: c.combat.hpMax, hpTemp: 0, deathSaves: { successes: 0, failures: 0 } },
        spellcasting: { ...c.spellcasting, slotsUsed: {}, pactSlotsUsed: 0 },
      }),
    );

  /** Descanso curto: gasta um dado de vida (média + CON). */
  const spendHitDie = () => {
    const heal = Math.max(1, Math.floor(derived.hitDie / 2) + 1 + abilityModifier(character.abilities.con));
    const hpCurrent = Math.min(combat.hpMax, combat.hpCurrent + heal);
    void save(
      { combat: { hpCurrent, hitDiceSpent: combat.hitDiceSpent + 1 } },
      (c) => ({ ...c, combat: { ...c.combat, hpCurrent, hitDiceSpent: c.combat.hitDiceSpent + 1 } }),
    );
  };

  return (
    <Panel title="Pontos de vida" icon="heart-pulse">
      <HpTracker
        combat={combat}
        editable={isOwner}
        onChange={(next) => save({ combat: next }, (c) => ({ ...c, combat: { ...c.combat, ...next } }))}
      />
      <Text style={[typography.caption, { color: theme.textMuted }]}>
        Dados de vida: {hitDiceLeft}/{character.level} d{derived.hitDie}
      </Text>
      {isOwner && (
        <View style={styles.row}>
          <SmallButton icon="campfire" label="Descanso curto (1 DV)" onPress={spendHitDie} disabled={hitDiceLeft <= 0 || combat.hpCurrent >= combat.hpMax} />
          <SmallButton icon="bed" label="Descanso longo" onPress={() => void longRest()} />
        </View>
      )}
    </Panel>
  );
}

export function Overview({ sheet, showVitals }: { sheet: Sheet; showVitals: boolean }) {
  const theme = useRpgTheme();
  const { character, derived, isOwner, save } = sheet;
  if (!character || !derived) return null;

  return (
    <View style={styles.column}>
      {showVitals && <VitalsPanel sheet={sheet} />}
      <Panel
        title="Combate"
        icon="sword-cross"
        right={
          <Pressable
            disabled={!isOwner}
            onPress={() => save({ inspiration: !character.inspiration }, (c) => ({ ...c, inspiration: !c.inspiration }))}
            accessibilityRole="switch"
            accessibilityState={{ checked: character.inspiration }}
            accessibilityLabel="Inspiração"
            style={[
              styles.inspiration,
              {
                borderColor: character.inspiration ? theme.gold : theme.border,
                backgroundColor: character.inspiration ? theme.goldSoft : 'transparent',
              },
            ]}
          >
            <MaterialCommunityIcons name={character.inspiration ? 'star' : 'star-outline'} size={16} color={theme.gold} />
            <Text style={[typography.caption, { color: theme.text, fontWeight: '700' }]}>Inspiração</Text>
          </Pressable>
        }
      >
        <CombatStats data={derived} speed={derived.species?.speed ?? 30} />
        <Text style={[typography.caption, { color: theme.textMuted }]}>
          CA: {derived.ac.parts.map((p, i) => `${p.label} ${i === 0 ? p.value : formatBonus(p.value)}`).join(' · ')}
        </Text>
      </Panel>

      <Panel title="Atributos e salvaguardas" icon="arm-flex">
        <View style={styles.abilities}>
          {ABILITIES.map((a) => {
            const proficient = derived.klass.savingThrows.includes(a);
            return (
              <View
                key={a}
                style={[styles.ability, { borderColor: proficient ? theme.gold : theme.border, backgroundColor: theme.surface }]}
                accessible
                accessibilityLabel={`${ABILITY_LABEL[a].name} ${derived.scores[a]}, salvaguarda ${formatBonus(derived.saves[a])}`}
              >
                <Text style={[typography.overline, { color: theme.textMuted }]}>{ABILITY_LABEL[a].short}</Text>
                <Text style={[styles.mod, { color: theme.text }]}>{formatBonus(abilityModifier(derived.scores[a]))}</Text>
                <View style={[styles.score, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
                  <Text style={[typography.caption, { color: theme.text, fontWeight: '800' }]}>{derived.scores[a]}</Text>
                </View>
                <View style={styles.saveRow}>
                  <MaterialCommunityIcons
                    name={proficient ? 'shield-half-full' : 'shield-outline'}
                    size={12}
                    color={proficient ? theme.gold : theme.textMuted}
                  />
                  <Text style={[styles.save, { color: theme.textMuted }]}>{formatBonus(derived.saves[a])}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: spacing.lg },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  inspiration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  abilities: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  ability: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  mod: { fontFamily: fonts.displayHeavy, fontSize: 26, lineHeight: 32 },
  score: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  save: { fontSize: 11, fontWeight: '700' },
});
