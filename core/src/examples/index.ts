export namespace Examples {
  export const User = {
    id: 'f8pqs6pp2k4mz3e',
    email: 'alice@example.com',
    name: 'Alice',
    avatar: null,
    verified: false,
    timeCreated: '2026-10-04T05:24:30.227Z',
    timeUpdated: '2026-10-04T05:24:30.227Z',
  };

  export const Character = {
    id: 'k3n8w2qz7d1xv5c',
    ownerID: User.id,
    name: 'Tharivol',
    edition: '2024',
    level: 3,
    classes: [{ classKey: 'srd-2024_wizard', subclassKey: 'srd-2024_evoker', level: 3 }],
    speciesKey: 'srd-2024_elf',
    backgroundKey: 'srd-2024_sage',
    alignmentKey: 'neutral-good',
    featKeys: [],
    abilities: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
    xp: 900,
    inspiration: false,
    featureUses: { 'srd-2024_wizard_arcane-recovery': 1 },
    proficiencies: {
      skills: { arcana: 'proficient', history: 'proficient', perception: 'proficient' },
      languages: ['common', 'elvish', 'draconic'],
      tools: [],
      weaponMasteries: [],
    },
    combat: {
      hpMax: 17,
      hpCurrent: 12,
      hpTemp: 0,
      hitDiceSpent: 1,
      deathSaves: { successes: 0, failures: 0 },
      exhaustion: 0,
      conditionKeys: [],
    },
    equipment: {
      items: [{ key: 'srd-2024_quarterstaff', quantity: 1, equipped: true, attuned: false }],
      coins: { cp: 0, sp: 0, ep: 0, gp: 5, pp: 0 },
    },
    spellcasting: {
      spells: [
        { key: 'srd-2024_fire-bolt', prepared: true },
        { key: 'srd-2024_shield', prepared: true },
      ],
      slotsUsed: { '1': 1 },
      pactSlotsUsed: 0,
    },
    personality: { traits: '', ideals: '', bonds: '', flaws: '' },
    details: {
      age: '112', height: '5\'8"', weight: '130 lb', eyes: 'green', skin: '', hair: 'silver',
      appearance: '', backstory: '', allies: '', notes: '',
    },
    timeCreated: '2026-10-04T05:24:30.227Z',
    timeUpdated: '2026-10-04T05:24:30.227Z',
  };

  export const Mesa = {
    id: 'p4t9x1mz6c2rb8w',
    gmID: User.id,
    name: 'A Mina Perdida',
    description: 'Campanha de quinta à noite.',
    edition: '2024',
    inviteCode: 'K7Q2XMH4',
    timeCreated: '2026-10-04T05:24:30.227Z',
    timeUpdated: '2026-10-04T05:24:30.227Z',
  };

  export const MesaMember = {
    id: 'w6d3n9qk1v7hs2a',
    mesaID: Mesa.id,
    userID: 'b2m7r4tx9q1ze6n',
    character: Character,
    timeJoined: '2026-10-04T05:24:30.227Z',
  };
}
