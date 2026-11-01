import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { proficiencyBonus } from '@dnf/core/character';
import {
  findItem,
  isWeaponProficient,
  weaponAttack,
  type EquipmentChoice,
  type SrdItem,
} from '@dnf/sdk/srd';
import { Chip, fonts, formatBonus, OptionCard, radius, shadow, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import { LoadState, SectionLabel, StepScreen } from '../../features/character-create/StepScreen';
import { useCharacterDraft } from '../../features/character-create/draft';
import { buildInventory, inventoryArmorClass, pickId } from '../../features/character-create/inventory';
import { combined, useCreation } from '../../features/character-create/useCreation';
import { tr } from '../../lib/srd';

export default function EquipmentPage() {
  const theme = useRpgTheme();
  const { draft, update } = useCharacterDraft();
  const c = useCreation();
  const { klass, bg, items, scores } = c;
  const load = combined(c.queries.classQ, c.queries.itemsQ);

  if (!klass || !items || !scores) {
    return (
      <StepScreen step="equipment" title="Equipamento inicial" canContinue={false}>
        <LoadState status={load.status === 'error' ? 'error' : 'loading'} onRetry={load.retry} />
      </StepScreen>
    );
  }

  const inventory = buildInventory(draft, klass, bg, items, scores);
  const ac = inventoryArmorClass(inventory, scores, klass);
  const pb = proficiencyBonus(1);
  const weapons = inventory.items.filter((i) => i.item.weapon);

  const setPick = (id: string, key: string) => update({ weaponPicks: { ...draft.weaponPicks, [id]: key } });

  return (
    <StepScreen
      step="equipment"
      title="Equipamento inicial"
      subtitle="Escolha o que você leva para a aventura. A armadura e o escudo já entram vestidos."
      canContinue={inventory.missing === 0}
    >
      <View style={[styles.preview, { backgroundColor: theme.surfaceRaised, borderColor: theme.gold }, shadow(theme, 2)]}>
        <View style={[styles.acShield, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}>
          <Text style={[styles.acValue, { color: theme.accent }]}>{ac.value}</Text>
          <Text style={[typography.overline, { color: theme.accent }]}>CA</Text>
        </View>
        <View style={styles.previewBody}>
          <Text style={[typography.caption, { color: theme.textMuted }]}>
            {ac.parts.map((p, i) => `${p.label} ${i === 0 ? p.value : formatBonus(p.value)}`).join('  ·  ')}
          </Text>
          <View style={styles.coins}>
            <MaterialCommunityIcons name="hand-coin-outline" size={16} color={theme.gold} />
            <Text style={[typography.bodyStrong, { color: theme.text }]}>{inventory.gp} po</Text>
          </View>
        </View>
      </View>

      {klass.equipment.map((choice, group) => (
        <ChoiceGroup
          key={`class-${group}`}
          title={klass.equipment.length > 1 ? `Da classe · ${group + 1} de ${klass.equipment.length}` : 'Da classe'}
          choice={choice}
          selected={draft.classEquipment[group] ?? null}
          onSelect={(id) => update({ classEquipment: { ...draft.classEquipment, [group]: id } })}
          items={items}
          picks={draft.weaponPicks}
          pickPrefix={(option, i) => pickId('class', group, option, i)}
          onPick={setPick}
        />
      ))}
      {bg?.equipment && (
        <ChoiceGroup
          title="Do antecedente"
          choice={bg.equipment}
          selected={draft.backgroundEquipment}
          onSelect={(id) => update({ backgroundEquipment: id })}
          items={items}
          picks={draft.weaponPicks}
          pickPrefix={(option, i) => pickId('background', 0, option, i)}
          onPick={setPick}
        />
      )}

      {weapons.length > 0 && (
        <>
          <SectionLabel>Ataques</SectionLabel>
          {weapons.map((w) => {
            const attack = weaponAttack(w.item.weapon, scores, pb, isWeaponProficient(w.item.weapon!, klass.weaponTraining));
            return attack ? (
              <View key={w.key} style={[styles.attack, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
                <MaterialCommunityIcons name="sword" size={18} color={theme.gold} />
                <View style={styles.flex}>
                  <Text style={[typography.bodyStrong, { color: theme.text }]}>{tr.name(w.item, 'item')}</Text>
                  <Text style={[typography.caption, { color: theme.textMuted }]} numberOfLines={1}>
                    {attack.properties.map((p) => tr.text(p)).join(', ') || '—'}
                  </Text>
                </View>
                <View style={styles.attackStats}>
                  <Text style={[typography.subheading, { color: theme.text }]}>{formatBonus(attack.toHit)}</Text>
                  <Text style={[typography.caption, { color: theme.textMuted }]}>
                    {attack.damage} {tr.text(attack.damageType).toLowerCase()}
                  </Text>
                </View>
              </View>
            ) : null;
          })}
        </>
      )}

      {inventory.custom.length > 0 && (
        <Text style={[typography.caption, { color: theme.textMuted }]}>
          Também vão na mochila (sem ficha na API): {inventory.custom.map((c) => (c.quantity > 1 ? `${c.quantity}× ${c.name}` : c.name)).join(', ')}.
        </Text>
      )}
    </StepScreen>
  );
}

function ChoiceGroup({
  title,
  choice,
  selected,
  onSelect,
  items,
  picks,
  pickPrefix,
  onPick,
}: {
  title: string;
  choice: EquipmentChoice;
  selected: string | null;
  onSelect: (id: string) => void;
  items: SrdItem[];
  picks: Record<string, string>;
  pickPrefix: (option: string, item: number) => string;
  onPick: (id: string, key: string) => void;
}) {
  const theme = useRpgTheme();
  const fixed = choice.options.length === 1;

  return (
    <View style={styles.group}>
      <SectionLabel>{fixed ? `${title} · você recebe` : title}</SectionLabel>
      {choice.options.map((option) => {
        const isSelected = fixed || selected === option.id;
        const names = option.items.map((ref) => {
          if (ref.pick) return `${ref.quantity > 1 ? `${ref.quantity}× ` : ''}arma ${ref.pick === 'simple' ? 'simples' : 'marcial'} à escolha`;
          const item = findItem(ref.name, items);
          return `${ref.quantity > 1 ? `${ref.quantity}× ` : ''}${item ? tr.name(item, 'item') : ref.name}`;
        });
        if (option.gp) names.push(`${option.gp} po`);
        return (
          <OptionCard
            key={option.id}
            title={fixed ? names.join(', ') : `Opção ${option.id.toUpperCase()}`}
            subtitle={fixed ? undefined : names.join(', ')}
            selected={isSelected}
            onPress={() => !fixed && onSelect(option.id)}
            leading={(color) => (
              <MaterialCommunityIcons name={option.items.length === 0 ? 'hand-coin-outline' : 'bag-personal-outline'} size={22} color={color} />
            )}
          >
            {option.items.some((ref) => ref.pick)
              ? option.items.map((ref, i) =>
              ref.pick ? (
                <View key={i} style={styles.pick}>
                  <Text style={[typography.caption, { color: theme.text, fontWeight: '700' }]}>
                    Escolha a arma {ref.pick === 'simple' ? 'simples' : 'marcial'}
                    {ref.quantity > 1 ? ` (${ref.quantity}×)` : ''}:
                  </Text>
                  <View style={styles.chips}>
                    {items
                      .filter((it) => it.weapon && (ref.pick === 'simple' ? it.weapon.is_simple : !it.weapon.is_simple))
                      .map((it) => (
                        <Chip
                          key={it.key}
                          label={tr.name(it, 'item')}
                          selected={picks[pickPrefix(option.id, i)] === it.key}
                          onPress={() => onPick(pickPrefix(option.id, i), it.key)}
                        />
                      ))}
                  </View>
                </View>
              ) : null,
            )
              : null}
          </OptionCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.lg },
  acShield: {
    width: 74,
    height: 82,
    borderWidth: 2,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acValue: { fontFamily: fonts.displayHeavy, fontSize: 30, lineHeight: 34 },
  previewBody: { flex: 1, gap: spacing.sm },
  coins: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  group: { gap: spacing.sm },
  pick: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  attack: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  attackStats: { alignItems: 'flex-end' },
  flex: { flex: 1 },
});
