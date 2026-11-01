import type { AbilityScores } from '@dnf/core/character';
import {
  armorClass,
  findItem,
  isBodyArmor,
  isShield,
  itemQuantity,
  type BackgroundRules,
  type ClassRules,
  type EquipmentChoice,
  type EquipmentOption,
  type SrdItem,
} from '@dnf/sdk/srd';
import type { CharacterDraft } from './draft';

export interface InventoryItem {
  key: string;
  name: string;
  quantity: number;
  equipped: boolean;
  item: SrdItem;
}

export interface Inventory {
  items: InventoryItem[];
  /** Itens sem chave na 5e-FastAPI (guardados pelo nome). */
  custom: { name: string; quantity: number }[];
  gp: number;
  /** Escolhas ainda pendentes (grupo sem opção ou arma genérica sem escolha). */
  missing: number;
}

/** Chave de uma arma genérica dentro de uma opção: "classe:0:A:1". */
export const pickId = (source: string, group: number, option: string, item: number) =>
  `${source}:${group}:${option}:${item}`;

function chosen(choice: EquipmentChoice, selected: string | null | undefined): EquipmentOption | null {
  if (choice.options.length === 1) return choice.options[0]!;
  return choice.options.find((o) => o.id === selected) ?? null;
}

/** Junta o equipamento escolhido da classe e do antecedente e decide o que já vem vestido. */
export function buildInventory(
  draft: CharacterDraft,
  klass: ClassRules | null,
  bg: BackgroundRules | null,
  items: SrdItem[],
  scores: AbilityScores | null,
): Inventory {
  const byKey = new Map<string, InventoryItem>();
  const custom = new Map<string, number>();
  let gp = 0;
  let missing = 0;

  const add = (source: string, group: number, option: EquipmentOption) => {
    gp += option.gp;
    option.items.forEach((ref, i) => {
      let item: SrdItem | undefined;
      if (ref.pick) {
        const key = draft.weaponPicks[pickId(source, group, option.id, i)];
        item = key ? items.find((it) => it.key === key) : undefined;
        if (!item) {
          missing += 1;
          return;
        }
      } else {
        item = findItem(ref.name, items);
      }
      if (!item) {
        custom.set(ref.name, (custom.get(ref.name) ?? 0) + ref.quantity);
        return;
      }
      const quantity = ref.pick ? ref.quantity : itemQuantity(ref, item);
      const current = byKey.get(item.key);
      if (current) current.quantity += quantity;
      else byKey.set(item.key, { key: item.key, name: item.name, quantity, equipped: false, item });
    });
  };

  klass?.equipment.forEach((choice, group) => {
    const option = chosen(choice, draft.classEquipment[group]);
    if (option) add('class', group, option);
    else missing += 1;
  });
  if (bg?.equipment) {
    const option = chosen(bg.equipment, draft.backgroundEquipment);
    if (option) add('background', 0, option);
    else missing += 1;
  }

  const list = [...byKey.values()];
  autoEquip(list, klass, scores);
  return {
    items: list,
    custom: [...custom.entries()].map(([name, quantity]) => ({ name, quantity })),
    gp,
    missing,
  };
}

/** Veste a melhor armadura que a classe sabe usar, o escudo (se puder) e empunha as armas. */
function autoEquip(list: InventoryItem[], klass: ClassRules | null, scores: AbilityScores | null) {
  const can = klass?.armorProficiencies;
  const armors = list.filter((i) => isBodyArmor(i.item) && can?.has(i.item.armor!.category as 'light'));
  const best = scores
    ? armors.sort(
        (a, b) =>
          armorClass({ scores, armor: b.item.armor, shield: false, unarmoredDefense: null }).value -
          armorClass({ scores, armor: a.item.armor, shield: false, unarmoredDefense: null }).value,
      )[0]
    : armors[0];
  if (best) best.equipped = true;
  const shield = list.find((i) => isShield(i.item));
  if (shield && can?.has('shield')) shield.equipped = true;
  list.filter((i) => i.item.weapon).forEach((i) => (i.equipped = true));
}

/** CA com o que está vestido. */
export function inventoryArmorClass(inventory: Inventory, scores: AbilityScores, klass: ClassRules | null) {
  const armor = inventory.items.find((i) => i.equipped && isBodyArmor(i.item));
  const shield = inventory.items.some((i) => i.equipped && isShield(i.item));
  return armorClass({
    scores,
    armor: armor?.item.armor ?? null,
    armorName: armor?.name,
    shield,
    unarmoredDefense: klass?.unarmoredDefense ?? null,
  });
}
