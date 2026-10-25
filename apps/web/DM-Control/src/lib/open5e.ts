import type { Rules } from '@dnf/core/rules';

/**
 * Adapter do Open5e (https://api.open5e.com/v2) para o port de criaturas do mestre.
 * Só o DM-Control usa: o app mobile continua na 5e-FastAPI. Os textos vêm em inglês.
 */
export const OPEN5E_URL = 'https://api.open5e.com/v2';

// Sistema de jogo do Open5e → edição do app. Outros (a5e…) ficam de fora.
const GAMESYSTEM: Record<Rules.Edition, string> = { '2014': '5e-2014', '2024': '5e-2024' };
const EDITION_BY_SYSTEM = Object.fromEntries(
	Object.entries(GAMESYSTEM).map(([e, k]) => [k, e])
) as Record<string, Rules.Edition>;

const PAGE = 100;

interface Open5eAbility {
	name: string;
	desc: string;
	action_type?: 'ACTION' | 'BONUS_ACTION' | 'REACTION' | 'LEGENDARY_ACTION' | string;
	order_in_statblock?: number;
	legendary_action_cost?: number | null;
}

interface Open5eCreature {
	key: string;
	name: string;
	document: { key: string; name: string; gamesystem: { key: string } };
	type: { name: string };
	size: { name: string };
	challenge_rating: number;
	proficiency_bonus: number | null;
	speed: Record<string, number | boolean | string>;
	alignment: string;
	armor_class: number;
	armor_detail: string;
	hit_points: number;
	hit_dice: string;
	experience_points: number | null;
	ability_scores: Record<AbilityName, number>;
	modifiers: Record<AbilityName, number>;
	initiative_bonus: number | null;
	saving_throws: Record<string, number>;
	saving_throws_all: Record<AbilityName, number>;
	skill_bonuses: Record<string, number>;
	passive_perception: number | null;
	languages: { as_string: string };
	resistances_and_immunities: {
		damage_immunities_display: string;
		damage_resistances_display: string;
		damage_vulnerabilities_display: string;
		condition_immunities_display: string;
	};
	darkvision_range: number | null;
	blindsight_range: number | null;
	tremorsense_range: number | null;
	truesight_range: number | null;
	actions: Open5eAbility[];
	traits: Open5eAbility[];
}

type AbilityName =
	'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';
const ABILITIES: [AbilityName, string][] = [
	['strength', 'STR'],
	['dexterity', 'DEX'],
	['constitution', 'CON'],
	['intelligence', 'INT'],
	['wisdom', 'WIS'],
	['charisma', 'CHA']
];

interface Open5eList<T> {
	next: string | null;
	results: T[];
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const title = (s: string) => s.replace(/_/g, ' ').replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const orNull = (s: string | undefined) => (s?.trim() ? s.trim() : null);
const FRACTIONS: Record<number, string> = { 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' };

function abilities(list: Open5eAbility[], type: string): Rules.CreatureAbility[] {
	return list
		.filter((a) => a.action_type === type)
		.sort((a, b) => (a.order_in_statblock ?? 0) - (b.order_in_statblock ?? 0))
		.map((a) => ({
			name:
				a.legendary_action_cost && a.legendary_action_cost > 1
					? `${a.name} (Costs ${a.legendary_action_cost} Actions)`
					: a.name,
			desc: a.desc
		}));
}

export function toCreature(c: Open5eCreature): Rules.Creature {
	const speed = Object.entries(c.speed)
		.filter(([k, v]) => typeof v === 'number' && v > 0 && k !== 'unit')
		.map(
			([k, v]) =>
				`${k === 'walk' ? '' : title(k) + ' '}${v} ${c.speed.unit === 'feet' ? 'ft.' : c.speed.unit}`
		)
		.join(', ');
	const senses = [
		['Blindsight', c.blindsight_range],
		['Darkvision', c.darkvision_range],
		['Tremorsense', c.tremorsense_range],
		['Truesight', c.truesight_range]
	]
		.filter(([, v]) => v)
		.map(([k, v]) => `${k} ${v} ft.`);
	if (c.passive_perception != null) senses.push(`Passive Perception ${c.passive_perception}`);
	const ri = c.resistances_and_immunities;
	// O Open5e traz a introdução das ações lendárias como mais uma ação.
	const legendary = c.actions.filter((a) => a.action_type === 'LEGENDARY_ACTION');
	const intro = legendary.find((a) => /legendary actions?\b/i.test(a.name));
	const cr = FRACTIONS[c.challenge_rating] ?? String(c.challenge_rating);

	return {
		key: c.key,
		name: c.name,
		source: {
			key: c.document.key,
			name: c.document.name,
			edition: EDITION_BY_SYSTEM[c.document.gamesystem.key] ?? null
		},
		type: `${c.size.name} ${c.type.name}`,
		alignment: c.alignment,
		armor_class: c.armor_detail ? `${c.armor_class} (${c.armor_detail})` : String(c.armor_class),
		initiative: c.initiative_bonus == null ? null : signed(c.initiative_bonus),
		hit_points: `${c.hit_points} (${c.hit_dice})`,
		speed,
		abilities: ABILITIES.map(([k, label]) => ({
			ability: label,
			score: c.ability_scores[k],
			modifier: c.modifiers[k],
			save: c.saving_throws_all?.[k] ?? null
		})),
		saves: orNull(
			Object.entries(c.saving_throws)
				.filter(([k, v]) => v !== c.modifiers[k as AbilityName])
				.map(([k, v]) => `${title(k).slice(0, 3)} ${signed(v)}`)
				.join(', ')
		),
		skills: orNull(
			Object.entries(c.skill_bonuses)
				.map(([k, v]) => `${title(k)} ${signed(v)}`)
				.join(', ')
		),
		resistances: orNull(ri.damage_resistances_display),
		vulnerabilities: orNull(ri.damage_vulnerabilities_display),
		damage_immunities: orNull(ri.damage_immunities_display),
		condition_immunities: orNull(ri.condition_immunities_display),
		gear: null,
		senses: senses.join(', ') || '—',
		languages: c.languages.as_string || '—',
		challenge:
			c.experience_points != null
				? `${cr} (XP ${c.experience_points.toLocaleString('en-US')})`
				: cr,
		proficiency_bonus: c.proficiency_bonus == null ? null : signed(c.proficiency_bonus),
		traits: c.traits.map((t) => ({ name: t.name, desc: t.desc })),
		actions: abilities(c.actions, 'ACTION'),
		bonus_actions: abilities(c.actions, 'BONUS_ACTION'),
		reactions: abilities(c.actions, 'REACTION'),
		legendary_desc: intro ? `${intro.name}. ${intro.desc}` : null,
		legendary_actions: abilities(
			legendary.filter((a) => a !== intro),
			'LEGENDARY_ACTION'
		)
	};
}

export class Open5eError extends Error {
	constructor(resource: string, cause?: unknown) {
		super(`Falha ao buscar ${resource} no Open5e.`, { cause });
		this.name = 'Open5eError';
	}
}

/** `fetch` vem de fora para o SvelteKit poder passar o dele (`load`) e o servidor reaproveitar a resposta. */
export function createOpen5eCreatures(
	options: { baseUrl?: string; fetch?: typeof fetch } = {}
): Rules.CreaturePort {
	const baseUrl = options.baseUrl ?? OPEN5E_URL;
	const get = options.fetch ?? fetch;

	async function json<T>(url: string, resource: string): Promise<T | null> {
		const res = await get(url);
		if (res.status === 404) return null;
		if (!res.ok) throw new Open5eError(resource, res.status);
		return (await res.json()) as T;
	}

	return {
		async creatures(edition, filter = {}) {
			const params = new URLSearchParams({
				limit: String(PAGE),
				document__gamesystem__key: GAMESYSTEM[edition]
			});
			if (filter.name?.trim()) params.set('name__icontains', filter.name.trim());
			const out: Open5eCreature[] = [];
			for (let url: string | null = `${baseUrl}/creatures/?${params}`; url;) {
				const page: Open5eList<Open5eCreature> | null = await json(url, 'criaturas');
				if (!page) break;
				out.push(...page.results);
				url = page.next;
			}
			return out.map(toCreature).sort((a, b) => a.name.localeCompare(b.name));
		},

		async creaturesByKey(keys) {
			const found = await Promise.all(
				[...new Set(keys)].map(async (key) => {
					const c = await json<Open5eCreature>(
						`${baseUrl}/creatures/${encodeURIComponent(key)}/`,
						`criatura ${key}`
					);
					return c && toCreature(c);
				})
			);
			return found
				.filter((c): c is Rules.Creature => !!c)
				.sort((a, b) => a.name.localeCompare(b.name));
		}
	};
}
