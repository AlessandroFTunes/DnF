import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ABILITIES, abilityModifier, type Ability } from '@dnf/core/character';
import { POINT_BUY_BUDGET, POINT_BUY_COST } from '@dnf/sdk/srd';
import {
  Button,
  Chip,
  fonts,
  formatBonus,
  radius,
  shadow,
  spacing,
  typography,
  useRpgTheme,
} from '@dnf/ui-react-native';
import { SectionLabel, StepScreen } from '../../features/character-create/StepScreen';
import { STANDARD_ARRAY, useCharacterDraft, type AbilityMethod } from '../../features/character-create/draft';
import { ABILITY_LABEL, abilityShort } from '../../features/character-create/labels';
import { useCreation } from '../../features/character-create/useCreation';
import { tr } from '../../lib/srd';

/** 4d6, descarta o menor. */
function rollAbility(): number {
  const dice = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6)).sort((a, b) => b - a);
  return dice[0]! + dice[1]! + dice[2]!;
}

const rollPool = () => Array.from({ length: 6 }, rollAbility).sort((a, b) => b - a);
const POINT_MIN = 8;
const POINT_MAX = 15;
const cost = (value: number) => POINT_BUY_COST[value] ?? Infinity;

export default function AbilitiesPage() {
  const theme = useRpgTheme();
  const { draft, update } = useCharacterDraft();
  const { klass, cls, species, bg, base, scores, speciesBonus, originAmounts, customOrigin, originComplete } = useCreation();
  const { abilityPool: pool, abilityAssignment: assignment, abilityMethod: method } = draft;

  const saves = new Set(klass?.savingThrows ?? []);
  const firstFree = (from: Partial<Record<Ability, number>>) => ABILITIES.find((a) => from[a] === undefined) ?? null;
  const [active, setActive] = useState<Ability | null>(() => (method === 'pointBuy' ? null : firstFree(assignment)));

  const usedBy = (index: number) => ABILITIES.find((a) => assignment[a] === index);
  const pointsSpent = ABILITIES.reduce((sum, a) => sum + cost(draft.pointBuy[a]), 0);
  const canRaise = (a: Ability) =>
    draft.pointBuy[a] < POINT_MAX && pointsSpent + cost(draft.pointBuy[a] + 1) - cost(draft.pointBuy[a]) <= POINT_BUY_BUDGET;

  // Bônus à escolha: antecedente (2024) ou "+1 em dois" do Meio-elfo (2014).
  const bonusRule = bonusRuleFor(draft.edition, bg?.abilityOptions ?? [], species?.abilityChoice ?? null, speciesBonus);
  const bonusOk = bonusRule ? bonusRule.isComplete(draft.bonusPicks, draft.bonusMode) : true;

  function setMethod(next: AbilityMethod) {
    if (next === method) return;
    update({ abilityMethod: next, abilityPool: next === 'roll' ? rollPool() : STANDARD_ARRAY, abilityAssignment: {} });
    setActive(next === 'pointBuy' ? null : ABILITIES[0]);
  }

  /** Coloca o valor no atributo ativo; se o valor já estava em outro, os dois trocam. */
  function assign(index: number) {
    if (!active) return;
    const next = { ...assignment };
    const previousOwner = usedBy(index);
    const previousValue = next[active];
    if (previousOwner && previousOwner !== active) {
      if (previousValue === undefined) delete next[previousOwner];
      else next[previousOwner] = previousValue;
    }
    next[active] = index;
    update({ abilityAssignment: next });
    setActive(firstFree(next));
  }

  /** Maiores valores nas salvaguardas da classe, depois Constituição e Destreza. */
  function autoAssign() {
    const rank = (a: Ability) => (saves.has(a) ? 3 : 0) + (a === 'con' ? 2 : 0) + (a === 'dex' ? 1 : 0);
    const priority = [...ABILITIES].sort((a, b) => rank(b) - rank(a));
    const order = pool.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value);
    const next: Partial<Record<Ability, number>> = {};
    priority.forEach((ability, i) => (next[ability] = order[i]!.index));
    update({ abilityAssignment: next });
    setActive(null);
  }

  function stepPoint(a: Ability, delta: 1 | -1) {
    if (delta === 1 ? !canRaise(a) : draft.pointBuy[a] <= POINT_MIN) return;
    update({ pointBuy: { ...draft.pointBuy, [a]: draft.pointBuy[a] + delta } });
  }

  return (
    <StepScreen
      step="abilities"
      title="Defina seus atributos"
      subtitle={
        method === 'pointBuy'
          ? 'Gaste até 27 pontos: cada atributo vai de 8 a 15.'
          : 'Toque em um atributo e depois no valor que quer dar a ele.'
      }
      canContinue={base !== null && bonusOk && originComplete}
    >
      <View style={styles.methods}>
        <Chip
          label="Conjunto padrão"
          selected={method === 'standard'}
          onPress={() => setMethod('standard')}
          icon={(c) => <MaterialCommunityIcons name="format-list-numbered" size={16} color={c} />}
        />
        <Chip
          label="Compra por pontos"
          selected={method === 'pointBuy'}
          onPress={() => setMethod('pointBuy')}
          icon={(c) => <MaterialCommunityIcons name="calculator-variant-outline" size={16} color={c} />}
        />
        <Chip
          label="Rolar 4d6"
          selected={method === 'roll'}
          onPress={() => setMethod('roll')}
          icon={(c) => <MaterialCommunityIcons name="dice-multiple-outline" size={16} color={c} />}
        />
      </View>

      {method === 'pointBuy' ? (
        <View style={[styles.poolCard, { backgroundColor: theme.surfaceSunken, borderColor: theme.border }]}>
          <View style={styles.poolHeader}>
            <SectionLabel>Pontos restantes</SectionLabel>
            <Text style={[styles.points, { color: pointsSpent === POINT_BUY_BUDGET ? theme.positive : theme.accent }]}>
              {POINT_BUY_BUDGET - pointsSpent}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: theme.surface }]}>
            <View
              style={[styles.trackFill, { backgroundColor: theme.gold, width: `${(pointsSpent / POINT_BUY_BUDGET) * 100}%` }]}
            />
          </View>
        </View>
      ) : (
        <View style={[styles.poolCard, { backgroundColor: theme.surfaceSunken, borderColor: theme.border }]}>
          <View style={styles.poolHeader}>
            <SectionLabel>{method === 'standard' ? 'Valores do conjunto' : 'Sua rolagem'}</SectionLabel>
            {method === 'roll' && (
              <Pressable
                onPress={() => {
                  update({ abilityPool: rollPool(), abilityAssignment: {} });
                  setActive(ABILITIES[0]);
                }}
                accessibilityRole="button"
                hitSlop={8}
                style={styles.reroll}
              >
                <MaterialCommunityIcons name="dice-6-outline" size={18} color={theme.accent} />
                <Text style={[typography.caption, { color: theme.accent, fontWeight: '700' }]}>Rolar de novo</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.pool}>
            {pool.map((value, index) => {
              const owner = usedBy(index);
              return (
                <Pressable
                  key={index}
                  onPress={() => assign(index)}
                  disabled={!active}
                  accessibilityRole="button"
                  accessibilityLabel={`Valor ${value}${owner ? `, em ${ABILITY_LABEL[owner].name}` : ''}`}
                  style={({ pressed }) => [
                    styles.token,
                    {
                      backgroundColor: owner ? theme.surface : theme.surfaceRaised,
                      borderColor: owner ? theme.border : theme.gold,
                      opacity: owner ? 0.55 : 1,
                      transform: [{ scale: pressed ? 0.94 : 1 }],
                    },
                    !owner && shadow(theme, 1),
                  ]}
                >
                  <Text style={[styles.tokenValue, { color: owner ? theme.textMuted : theme.text }]}>{value}</Text>
                  <Text style={[styles.tokenOwner, { color: theme.textMuted }]}>{owner ? abilityShort(owner) : ' '}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.grid}>
        {ABILITIES.map((ability) => {
          const baseValue =
            method === 'pointBuy'
              ? draft.pointBuy[ability]
              : assignment[ability] === undefined
                ? undefined
                : pool[assignment[ability]!];
          const bonus = (speciesBonus[ability] ?? 0) + (draft.bonusPicks[ability] ?? 0);
          const finalValue = baseValue === undefined ? undefined : Math.min(20, baseValue + bonus);
          const isActive = active === ability;
          const label = ABILITY_LABEL[ability];
          return (
            <Pressable
              key={ability}
              onPress={() => method !== 'pointBuy' && setActive(ability)}
              accessibilityRole={method === 'pointBuy' ? 'text' : 'button'}
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${label.name}: ${finalValue ?? 'sem valor'}`}
              style={[
                styles.ability,
                {
                  backgroundColor: isActive ? theme.accentSoft : theme.surfaceRaised,
                  borderColor: isActive ? theme.accent : theme.border,
                },
                isActive && shadow(theme, 2),
              ]}
            >
              <View style={styles.abilityTop}>
                <MaterialCommunityIcons name={label.icon} size={18} color={isActive ? theme.accent : theme.textMuted} />
                <Text style={[typography.overline, { color: theme.textMuted }]}>{label.short}</Text>
                {saves.has(ability) && <MaterialCommunityIcons name="shield-half-full" size={15} color={theme.gold} />}
              </View>
              <Text style={[styles.abilityValue, { color: finalValue ? theme.text : theme.border }]}>
                {finalValue ?? '—'}
              </Text>
              <View style={styles.badges}>
                <View
                  style={[
                    styles.modifier,
                    {
                      backgroundColor: finalValue ? theme.goldSoft : theme.surfaceSunken,
                      borderColor: finalValue ? theme.gold : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.modifierText, { color: finalValue ? theme.text : theme.textMuted }]}>
                    {finalValue ? formatBonus(abilityModifier(finalValue)) : '±0'}
                  </Text>
                </View>
                {bonus > 0 && <Text style={[styles.bonus, { color: theme.positive }]}>+{bonus}</Text>}
              </View>
              {method === 'pointBuy' ? (
                <View style={styles.stepper}>
                  <StepButton
                    icon="minus"
                    onPress={() => stepPoint(ability, -1)}
                    disabled={draft.pointBuy[ability] <= POINT_MIN}
                    label={`Diminuir ${label.name}`}
                  />
                  <Text style={[typography.caption, { color: theme.textMuted }]}>{draft.pointBuy[ability]}</Text>
                  <StepButton
                    icon="plus"
                    onPress={() => stepPoint(ability, 1)}
                    disabled={!canRaise(ability)}
                    label={`Aumentar ${label.name}`}
                  />
                </View>
              ) : (
                <Text style={[typography.caption, { color: theme.text }]} numberOfLines={1}>
                  {label.name}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {saves.size > 0 && (
        <View style={styles.legend}>
          <MaterialCommunityIcons name="shield-half-full" size={15} color={theme.gold} />
          <Text style={[typography.caption, { color: theme.textMuted, flex: 1 }]}>
            Salvaguardas de {cls ? tr.name(cls) : ''}: bons lugares para os maiores valores.
          </Text>
        </View>
      )}

      {method !== 'pointBuy' && (
        <View style={styles.actions}>
          <Button
            label="Distribuir para mim"
            variant="secondary"
            onPress={autoAssign}
            style={styles.action}
            icon={(c) => <MaterialCommunityIcons name="auto-fix" size={18} color={c} />}
          />
          <Button
            label="Limpar"
            variant="ghost"
            onPress={() => {
              update({ abilityAssignment: {} });
              setActive(ABILITIES[0]);
            }}
            icon={(c) => <MaterialCommunityIcons name="undo" size={18} color={c} />}
          />
        </View>
      )}

      {draft.edition === '2014' && originAmounts.length > 0 && (
        <View style={[styles.bonusCard, { borderColor: customOrigin && !originComplete ? theme.gold : theme.border, backgroundColor: theme.surfaceRaised }]}>
          <View style={styles.bonusRow}>
            <View style={styles.flex}>
              <SectionLabel>Origem personalizada</SectionLabel>
              <Text style={[typography.caption, { color: theme.textMuted }]}>
                Regra opcional do Caldeirão de Tasha: leve os bônus da raça para outros atributos (cada um num atributo diferente).
              </Text>
            </View>
            <Chip
              label={customOrigin ? 'Ligada' : 'Desligada'}
              selected={customOrigin}
              onPress={() => update({ customOrigin: !draft.customOrigin, originSlots: [] })}
            />
          </View>
          {customOrigin &&
            originAmounts.map((amount, slot) => (
              <View key={slot} style={styles.originRow}>
                <Text style={[typography.bodyStrong, { color: theme.text, width: 34 }]}>+{amount}</Text>
                <View style={styles.methods}>
                  {ABILITIES.map((a) => {
                    const takenElsewhere = draft.originSlots.some((x, i) => x === a && i !== slot);
                    return (
                      <Chip
                        key={a}
                        label={abilityShort(a)}
                        selected={draft.originSlots[slot] === a}
                        disabled={takenElsewhere}
                        onPress={() => {
                          const next = [...draft.originSlots];
                          next[slot] = next[slot] === a ? null : a;
                          update({ originSlots: next });
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            ))}
        </View>
      )}

      {Object.keys(speciesBonus).length > 0 && !customOrigin && (
        <View style={[styles.bonusCard, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
          <SectionLabel>Bônus da raça</SectionLabel>
          <Text style={[typography.body, { color: theme.text }]}>
            {Object.entries(speciesBonus)
              .map(([a, n]) => `+${n} ${ABILITY_LABEL[a as Ability].name}`)
              .join(' · ')}
          </Text>
        </View>
      )}

      {bonusRule && (
        <View
          style={[styles.bonusCard, { borderColor: bonusOk ? theme.border : theme.gold, backgroundColor: theme.surfaceRaised }]}
        >
          <SectionLabel>{bonusRule.title}</SectionLabel>
          <Text style={[typography.caption, { color: theme.textMuted }]}>{bonusRule.hint}</Text>
          {bonusRule.kind === 'background' && (
            <View style={styles.methods}>
              <Chip
                label="+2 e +1"
                selected={draft.bonusMode === 'twoOne'}
                onPress={() => update({ bonusMode: 'twoOne', bonusPicks: {} })}
              />
              <Chip
                label="+1, +1 e +1"
                selected={draft.bonusMode === 'threeOnes'}
                onPress={() =>
                  update({ bonusMode: 'threeOnes', bonusPicks: Object.fromEntries(bonusRule.options.map((a) => [a, 1])) })
                }
              />
            </View>
          )}
          {(bonusRule.kind === 'choice' || draft.bonusMode === 'twoOne') && (
            <View style={styles.bonusRows}>
              {bonusRule.options.map((a) => (
                <View key={a} style={styles.bonusRow}>
                  <Text style={[typography.bodyStrong, { color: theme.text, flex: 1 }]}>{ABILITY_LABEL[a].name}</Text>
                  {bonusRule.amounts.map((amount) => (
                    <Chip
                      key={amount}
                      label={`+${amount}`}
                      selected={draft.bonusPicks[a] === amount}
                      onPress={() => update({ bonusPicks: bonusRule.toggle(draft.bonusPicks, a, amount) })}
                    />
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {scores && (
        <Text style={[typography.caption, { color: theme.textMuted }]}>
          Valores finais (máx. 20): {ABILITIES.map((a) => `${abilityShort(a)} ${scores[a]}`).join(' · ')}
        </Text>
      )}
    </StepScreen>
  );
}

function StepButton({
  icon,
  onPress,
  disabled,
  label,
}: {
  icon: 'plus' | 'minus';
  onPress: () => void;
  disabled: boolean;
  label: string;
}) {
  const theme = useRpgTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={[styles.stepButton, { borderColor: theme.border, opacity: disabled ? 0.35 : 1 }]}
    >
      <MaterialCommunityIcons name={icon} size={16} color={theme.text} />
    </Pressable>
  );
}

interface BonusRule {
  kind: 'background' | 'choice';
  title: string;
  hint: string;
  options: Ability[];
  amounts: number[];
  isComplete: (picks: Partial<Record<Ability, number>>, mode: string) => boolean;
  toggle: (picks: Partial<Record<Ability, number>>, a: Ability, amount: number) => Partial<Record<Ability, number>>;
}

/** Regras do bônus escolhido pelo jogador (ou null se não há escolha). */
function bonusRuleFor(
  edition: string | null,
  backgroundOptions: Ability[],
  speciesChoice: { count: number; amount: number } | null,
  speciesBonus: Partial<Record<Ability, number>>,
): BonusRule | null {
  if (edition === '2024' && backgroundOptions.length) {
    return {
      kind: 'background',
      title: 'Aumentos do antecedente',
      hint: 'Seu antecedente aumenta estes atributos: +2 em um e +1 em outro, ou +1 nos três.',
      options: backgroundOptions,
      amounts: [2, 1],
      isComplete: (picks, mode) => {
        const values = Object.values(picks);
        return mode === 'threeOnes'
          ? values.length === 3 && values.every((v) => v === 1)
          : values.length === 2 && values.includes(2) && values.includes(1);
      },
      // Cada valor (+2, +1) só pode estar em um atributo.
      toggle: (picks, a, amount) => {
        const next: Partial<Record<Ability, number>> = Object.fromEntries(
          Object.entries(picks).filter(([k, v]) => k !== a && v !== amount),
        );
        if (picks[a] !== amount) next[a] = amount;
        return next;
      },
    };
  }
  if (speciesChoice) {
    const options = (['str', 'dex', 'con', 'int', 'wis', 'cha'] as Ability[]).filter((a) => !speciesBonus[a]);
    return {
      kind: 'choice',
      title: 'Aumentos à escolha da raça',
      hint: `Escolha ${speciesChoice.count} atributos para ganhar +${speciesChoice.amount}.`,
      options,
      amounts: [speciesChoice.amount],
      isComplete: (picks) => Object.keys(picks).length === speciesChoice.count,
      toggle: (picks, a, amount) => {
        if (picks[a]) {
          const next = { ...picks };
          delete next[a];
          return next;
        }
        return Object.keys(picks).length >= speciesChoice.count ? picks : { ...picks, [a]: amount };
      },
    };
  }
  return null;
}

const styles = StyleSheet.create({
  methods: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  poolCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  poolHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  points: { fontFamily: fonts.displayHeavy, fontSize: 26 },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: radius.pill },
  reroll: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  pool: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  token: {
    flex: 1,
    aspectRatio: 0.8,
    maxWidth: 58,
    borderWidth: 1.5,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenValue: { fontFamily: fonts.display, fontSize: 22 },
  tokenOwner: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  ability: {
    flexBasis: '31%',
    flexGrow: 1,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  abilityTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  abilityValue: { fontFamily: fonts.displayHeavy, fontSize: 30, lineHeight: 36 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  modifier: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  modifierText: { fontSize: 13, fontWeight: '800' },
  bonus: { fontSize: 12, fontWeight: '800' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  action: { flex: 1 },
  bonusCard: { borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  bonusRows: { gap: spacing.sm },
  bonusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  originRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
