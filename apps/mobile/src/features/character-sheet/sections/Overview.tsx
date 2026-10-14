import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ABILITIES, abilityModifier } from '@dnf/core/character';
import { fonts, formatBonus, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { ABILITY_LABEL } from '../../character-create/labels';
import { HpTracker, Panel, SmallButton, StatBox } from '../components';
import type { Sheet, SheetData } from '../useSheet';

export function CombatStats({ data, speed }: { data: SheetData; speed: string }) {
  return (
    <View style={styles.stats}>
      <StatBox label="CA" value={String(data.ac.value)} icon="shield-half-full" accent />
      <StatBox label="Iniciativa" value={formatBonus(abilityModifier(data.scores.dex))} icon="lightning-bolt" />
      <StatBox label="Deslocamento" value={speed.replace(/\s*metros?$/i, ' m')} icon="run" />
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
  const pools = derived.hitDice;

  /** Descanso longo: em 2024 todos os dados de vida voltam; em 2014, metade do nível (mínimo 1), dos maiores primeiro. */
  const recovered = () => {
    if (character.edition === '2024') return {};
    let left = Math.max(1, Math.floor(character.level / 2));
    const spent: Record<string, number> = {};
    for (const p of pools) {
      const back = Math.min(p.spent, left);
      left -= back;
      if (p.spent - back > 0) spent[String(p.die)] = p.spent - back;
    }
    return spent;
  };

  const longRest = () =>
    save(
      {
        combat: {
          hpCurrent: combat.hpMax,
          hpTemp: 0,
          deathSaves: { successes: 0, failures: 0 },
          hitDiceSpent: recovered(),
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

  /** Descanso curto: gasta um dado de vida do tipo escolhido (média do dado + CON). */
  const spendHitDie = (die: number) => {
    const heal = Math.max(1, Math.floor(die / 2) + 1 + abilityModifier(derived.scores.con));
    const hpCurrent = Math.min(combat.hpMax, combat.hpCurrent + heal);
    const hitDiceSpent = { ...combat.hitDiceSpent, [die]: (combat.hitDiceSpent[die] ?? 0) + 1 };
    void save(
      // A Magia de Pacto volta no descanso curto.
      { combat: { hpCurrent, hitDiceSpent }, spellcasting: { pactSlotsUsed: 0 } },
      (c) => ({
        ...c,
        combat: { ...c.combat, hpCurrent, hitDiceSpent },
        spellcasting: { ...c.spellcasting, pactSlotsUsed: 0 },
      }),
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
        Dados de vida: {pools.map((p) => `${p.total - p.spent}/${p.total} d${p.die}`).join(' · ')}
      </Text>
      {isOwner && (
        <View style={styles.row}>
          {pools.map((p) => (
            <SmallButton
              key={p.die}
              icon="campfire"
              label={pools.length > 1 ? `Descanso curto (d${p.die})` : 'Descanso curto (1 DV)'}
              onPress={() => spendHitDie(p.die)}
              disabled={p.spent >= p.total || combat.hpCurrent >= combat.hpMax}
            />
          ))}
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
        <CombatStats data={derived} speed={derived.species?.speed || '—'} />
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
