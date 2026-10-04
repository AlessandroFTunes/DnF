import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Character } from '@dnf/core/character';
import { isBodyArmor, isShield } from '@dnf/sdk/srd';
import { formatBonus, radius, spacing, typography, useRpgTheme } from '@dnf/ui-react-native';
import type { IconName } from '../../character-create/labels';
import { Panel, SmallButton } from '../components';
import type { Sheet } from '../useSheet';
import { tr } from '../../../lib/srd';

type Equipment = Character.Info['equipment'];
const COINS = [
  { key: 'pp', label: 'PL' },
  { key: 'gp', label: 'PO' },
  { key: 'ep', label: 'PE' },
  { key: 'sp', label: 'PP' },
  { key: 'cp', label: 'PC' },
] as const;

export function Inventory({ sheet }: { sheet: Sheet }) {
  const theme = useRpgTheme();
  const { character, derived, isOwner, save } = sheet;
  const [newItem, setNewItem] = useState('');
  if (!character || !derived) return null;
  const equipment = character.equipment;

  const saveEquipment = (patch: Partial<Equipment>) =>
    void save({ equipment: patch }, (c) => ({ ...c, equipment: { ...c.equipment, ...patch } }));

  /** Vestir uma armadura tira a outra; o mesmo para o escudo. */
  function toggleEquip(key: string) {
    const target = derived!.inventory.find((i) => i.key === key);
    const equipping = !target?.equipped;
    const items = equipment.items.map((owned) => {
      const info = derived!.inventory.find((i) => i.key === owned.key)?.item;
      if (owned.key === key) return { ...owned, equipped: equipping };
      if (equipping && target?.item && info) {
        if (isBodyArmor(target.item) && isBodyArmor(info)) return { ...owned, equipped: false };
        if (isShield(target.item) && isShield(info)) return { ...owned, equipped: false };
      }
      return owned;
    });
    saveEquipment({ items });
  }

  const setQuantity = (key: string, quantity: number) =>
    saveEquipment({
      items: equipment.items.flatMap((i) => (i.key !== key ? [i] : quantity <= 0 ? [] : [{ ...i, quantity }])),
    });

  const setCustomQuantity = (name: string, quantity: number) =>
    saveEquipment({
      custom: equipment.custom.flatMap((i) => (i.name !== name ? [i] : quantity <= 0 ? [] : [{ ...i, quantity }])),
    });

  const addCustom = () => {
    const name = newItem.trim();
    if (!name) return;
    saveEquipment({ custom: [...equipment.custom, { name, quantity: 1 }] });
    setNewItem('');
  };

  return (
    <View style={styles.column}>
      <Panel title="Ataques" icon="sword-cross">
        {derived.attacks.length === 0 ? (
          <Text style={[typography.body, { color: theme.textMuted }]}>Nenhuma arma empunhada.</Text>
        ) : (
          derived.attacks.map((a) => (
            <View key={a.key} style={[styles.attack, { borderColor: theme.border }]}>
              <MaterialCommunityIcons name="sword" size={18} color={theme.gold} />
              <View style={styles.flex}>
                <Text style={[typography.bodyStrong, { color: theme.text }]}>{tr.text(a.name, 'item')}</Text>
                <Text style={[typography.caption, { color: theme.textMuted }]} numberOfLines={2}>
                  {a.properties.map((p) => tr.text(p)).join(', ')}
                </Text>
              </View>
              <View style={styles.attackRight}>
                <Text style={[typography.subheading, { color: theme.text }]}>{formatBonus(a.toHit)}</Text>
                <Text style={[typography.caption, { color: theme.textMuted }]}>
                  {a.damage} {tr.text(a.damageType).toLowerCase()}
                </Text>
              </View>
            </View>
          ))
        )}
      </Panel>

      <Panel title="Moedas" icon="hand-coin-outline">
        <View style={styles.coins}>
          {COINS.map((coin) => (
            <View key={coin.key} style={[styles.coin, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Text style={[typography.overline, { color: theme.gold }]}>{coin.label}</Text>
              <TextInput
                value={String(equipment.coins[coin.key])}
                editable={isOwner}
                keyboardType="number-pad"
                accessibilityLabel={`Moedas ${coin.label}`}
                onChangeText={(v) => {
                  const value = Math.max(0, parseInt(v.replace(/\D/g, ''), 10) || 0);
                  saveEquipment({ coins: { ...equipment.coins, [coin.key]: value } });
                }}
                style={[typography.subheading, styles.coinInput, { color: theme.text }]}
              />
            </View>
          ))}
        </View>
      </Panel>

      <Panel title="Itens" icon="bag-personal-outline">
        {derived.inventory.map((owned) => {
          const info = owned.item;
          const equippable = !!info && (!!info.weapon || isBodyArmor(info) || isShield(info));
          const icon: IconName = info?.weapon ? 'sword' : info && isShield(info) ? 'shield-outline' : info?.armor ? 'tshirt-crew-outline' : 'treasure-chest';
          return (
            <View key={owned.key} style={[styles.item, { borderColor: theme.border }]}>
              <MaterialCommunityIcons name={icon} size={18} color={owned.equipped ? theme.accent : theme.textMuted} />
              <View style={styles.flex}>
                <Text style={[typography.bodyStrong, { color: theme.text }]}>{info ? tr.name(info, 'item') : owned.key}</Text>
                <Text style={[typography.caption, { color: theme.textMuted }]}>
                  {[
                    info?.armor ? `CA ${info.armor.ac_display}` : null,
                    info?.weapon ? `${info.weapon.damage_dice} ${tr.text(info.weapon.damage_type.name).toLowerCase()}` : null,
                    info?.weight && Number(info.weight) > 0 ? `${Number(info.weight)} lb` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              {isOwner && <Quantity value={owned.quantity} onChange={(q) => setQuantity(owned.key, q)} />}
              {!isOwner && owned.quantity > 1 && <Text style={[typography.caption, { color: theme.text }]}>×{owned.quantity}</Text>}
              {equippable && (
                <Pressable
                  disabled={!isOwner}
                  onPress={() => toggleEquip(owned.key)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: owned.equipped }}
                  accessibilityLabel={`${owned.equipped ? 'Desequipar' : 'Equipar'} ${info ? tr.name(info, 'item') : owned.key}`}
                  style={[
                    styles.equip,
                    { borderColor: owned.equipped ? theme.accent : theme.border, backgroundColor: owned.equipped ? theme.accentSoft : 'transparent' },
                  ]}
                >
                  <Text style={[styles.equipText, { color: owned.equipped ? theme.accent : theme.textMuted }]}>
                    {owned.equipped ? 'EQUIPADO' : 'EQUIPAR'}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
        {equipment.custom.map((c) => (
          <View key={c.name} style={[styles.item, { borderColor: theme.border }]}>
            <MaterialCommunityIcons name="package-variant" size={18} color={theme.textMuted} />
            <Text style={[typography.bodyStrong, styles.flex, { color: theme.text }]}>{tr.text(c.name, 'item')}</Text>
            {isOwner ? (
              <Quantity value={c.quantity} onChange={(q) => setCustomQuantity(c.name, q)} />
            ) : (
              c.quantity > 1 && <Text style={[typography.caption, { color: theme.text }]}>×{c.quantity}</Text>
            )}
          </View>
        ))}
        {isOwner && (
          <View style={styles.add}>
            <TextInput
              value={newItem}
              onChangeText={setNewItem}
              placeholder="Adicionar item (ex.: corda de 15 m)"
              placeholderTextColor={theme.textMuted}
              onSubmitEditing={addCustom}
              accessibilityLabel="Nome do novo item"
              style={[styles.addInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
            />
            <SmallButton icon="plus" label="Adicionar" onPress={addCustom} disabled={!newItem.trim()} />
          </View>
        )}
      </Panel>
    </View>
  );
}

function Quantity({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const theme = useRpgTheme();
  return (
    <View style={styles.quantity}>
      <Pressable onPress={() => onChange(value - 1)} accessibilityRole="button" accessibilityLabel="Diminuir quantidade" hitSlop={6}>
        <MaterialCommunityIcons name={value <= 1 ? 'delete-outline' : 'minus'} size={16} color={theme.textMuted} />
      </Pressable>
      <Text style={[typography.caption, { color: theme.text, fontWeight: '800', minWidth: 18, textAlign: 'center' }]}>{value}</Text>
      <Pressable onPress={() => onChange(value + 1)} accessibilityRole="button" accessibilityLabel="Aumentar quantidade" hitSlop={6}>
        <MaterialCommunityIcons name="plus" size={16} color={theme.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: spacing.lg },
  flex: { flex: 1 },
  attack: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  attackRight: { alignItems: 'flex-end' },
  coins: { flexDirection: 'row', gap: spacing.sm },
  coin: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingTop: spacing.xs },
  coinInput: { textAlign: 'center', paddingVertical: 4, minWidth: 40 },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  quantity: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  equip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  equipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  add: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addInput: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8 },
});
