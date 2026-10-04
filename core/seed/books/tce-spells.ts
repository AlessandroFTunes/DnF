import { spell, type SpellSpec } from './helpers';

const B = 'bard', C = 'cleric', D = 'druid', P = 'paladin', R = 'ranger', S = 'sorcerer', K = 'warlock', W = 'wizard';

const SUMMON_HIGHER = 'Use the higher slot level wherever the spell’s level appears in the stat block.';
const SUMMON_HIGHER_PT = 'Use o círculo maior onde o nível da magia aparece na ficha da criatura.';

/** Magias do Caldeirão de Tasha para Todas as Coisas (2020). Listas de classe sem o Artífice. */
const specs: SpellSpec[] = [
  // Truques
  { name: 'Booming Blade', pt: 'Lâmina Trovejante', level: 0, school: 'evocation', classes: [S, K, W], time: 'action', range: 'Self (5-foot radius)', duration: '1 round', comp: 'SM', material: 'A melee weapon worth at least 1 sp', attack: true,
    desc: 'Make a melee attack with a weapon as part of the casting. On a hit, the target is sheathed in thunder: if it willingly moves before your next turn, it takes 1d8 thunder damage. At 5th level the hit also deals an extra 1d8 thunder (and the movement damage becomes 2d8), rising at 11th and 17th.',
    ptDesc: 'Faça um ataque corpo a corpo com arma como parte da conjuração. Se acertar, o alvo é envolto em trovão: se ele se mover por vontade própria antes do seu próximo turno, sofre 1d8 de dano trovejante. No nível 5 o acerto também causa 1d8 trovejante extra (e o dano de movimento vira 2d8), aumentando nos níveis 11 e 17.' },
  { name: 'Green-Flame Blade', pt: 'Lâmina de Chama Verde', level: 0, school: 'evocation', classes: [S, K, W], time: 'action', range: 'Self (5-foot radius)', duration: 'instantaneous', comp: 'SM', material: 'A melee weapon worth at least 1 sp', attack: true,
    desc: 'Make a melee attack with a weapon as part of the casting. On a hit, green fire leaps to a different creature within 5 feet of the target, dealing fire damage equal to your spellcasting modifier. Both damages increase at 5th, 11th and 17th level.',
    ptDesc: 'Faça um ataque corpo a corpo com arma como parte da conjuração. Se acertar, fogo verde salta para outra criatura a 1,5 m do alvo, causando dano de fogo igual ao seu modificador de conjuração. Os dois danos aumentam nos níveis 5, 11 e 17.' },
  { name: 'Lightning Lure', pt: 'Atração Elétrica', level: 0, school: 'evocation', classes: [S, K, W], time: 'action', range: 'Self (15-foot radius)', duration: 'instantaneous', comp: 'V', save: 'strength', dmg: '1d8',
    desc: 'A lash of lightning targets a creature within 15 feet: it makes a Strength save or is pulled up to 10 feet toward you, taking 1d8 lightning damage if it ends within 5 feet of you. Damage scales at 5th, 11th and 17th level.',
    ptDesc: 'Um chicote de eletricidade atinge uma criatura a até 4,5 m: ela faz um teste de Força ou é puxada até 3 m na sua direção, sofrendo 1d8 de dano elétrico se terminar a 1,5 m de você. O dano aumenta nos níveis 5, 11 e 17.' },
  { name: 'Mind Sliver', pt: 'Lasca Mental', level: 0, school: 'enchantment', classes: [S, K, W], time: 'action', range: '60 feet', duration: '1 round', comp: 'V', save: 'intelligence', dmg: '1d6',
    desc: 'A creature makes an Intelligence save or takes 1d6 psychic damage and subtracts 1d4 from its next saving throw before the end of your next turn. Damage scales at 5th, 11th and 17th level.',
    ptDesc: 'Uma criatura faz um teste de Inteligência ou sofre 1d6 de dano psíquico e subtrai 1d4 do próximo teste de resistência antes do fim do seu próximo turno. O dano aumenta nos níveis 5, 11 e 17.' },
  { name: 'Sword Burst', pt: 'Explosão de Espadas', level: 0, school: 'conjuration', classes: [S, K, W], time: 'action', range: 'Self (5-foot radius)', duration: 'instantaneous', comp: 'V', save: 'dexterity', dmg: '1d6',
    desc: 'Spectral blades sweep around you: each other creature within 5 feet makes a Dexterity save or takes 1d6 force damage. Damage scales at 5th, 11th and 17th level.',
    ptDesc: 'Lâminas espectrais giram ao seu redor: cada outra criatura a 1,5 m faz um teste de Destreza ou sofre 1d6 de dano de energia. O dano aumenta nos níveis 5, 11 e 17.' },
  // 1º círculo
  { name: 'Tasha’s Caustic Brew', pt: 'Caldo Cáustico de Tasha', level: 1, school: 'evocation', classes: [S, W], time: 'action', range: 'Self (30-foot line)', duration: '1 minute', conc: true, comp: 'VSM', material: 'A bit of rotten food', save: 'dexterity', dmg: '2d4',
    desc: 'A 30-foot-long, 5-foot-wide line of acid: each creature in it makes a Dexterity save or is covered in acid, taking 2d4 acid damage at the start of each of its turns until it or a creature within 5 feet uses an action to scrape it off.',
    ptDesc: 'Uma linha de ácido de 9 m por 1,5 m: cada criatura nela faz um teste de Destreza ou fica coberta de ácido, sofrendo 2d4 de dano ácido no início de cada turno até ela ou alguém a 1,5 m usar uma ação para raspar.',
    higher: 'Damage increases by 2d4 per slot level above 1st.', ptHigher: 'O dano aumenta 2d4 por círculo acima do 1º.' },
  // 2º círculo
  { name: 'Summon Beast', pt: 'Invocar Fera', level: 2, school: 'conjuration', classes: [D, R], time: 'action', range: '90 feet', duration: '1 hour', conc: true, comp: 'VSM', material: 'A feather, tuft of fur and fish tail inside a gilded acorn worth at least 200 gp',
    desc: 'You summon a bestial spirit (Air, Land or Water) that uses the Bestial Spirit stat block, scaled by the spell’s level. It obeys your commands and acts right after you.',
    ptDesc: 'Você invoca um espírito bestial (Ar, Terra ou Água) com a ficha de Espírito Bestial, que escala com o círculo da magia. Ele obedece aos seus comandos e age logo depois de você.',
    higher: SUMMON_HIGHER, ptHigher: SUMMON_HIGHER_PT },
  { name: 'Tasha’s Mind Whip', pt: 'Chicote Mental de Tasha', level: 2, school: 'enchantment', classes: [S, W], time: 'action', range: '90 feet', duration: '1 round', comp: 'V', save: 'intelligence', dmg: '3d6',
    desc: 'A creature makes an Intelligence save, taking 3d6 psychic damage on a failure (half on a success). On a failure it can’t take reactions until the end of its next turn and, on that turn, chooses only one of: move, action or bonus action.',
    ptDesc: 'Uma criatura faz um teste de Inteligência, sofrendo 3d6 de dano psíquico se falhar (metade se passar). Se falhar, não pode usar reações até o fim do próximo turno e, nesse turno, escolhe só um: movimento, ação ou ação bônus.',
    higher: 'One additional creature per slot level above 2nd.', ptHigher: 'Uma criatura adicional por círculo acima do 2º.' },
  // 3º círculo
  { name: 'Intellect Fortress', pt: 'Fortaleza do Intelecto', level: 3, school: 'abjuration', classes: [B, S, K, W], time: 'action', range: '30 feet', duration: '1 hour', conc: true, comp: 'V',
    desc: 'A willing creature has resistance to psychic damage and advantage on Intelligence, Wisdom and Charisma saves.',
    ptDesc: 'Uma criatura voluntária tem resistência a dano psíquico e vantagem em testes de Inteligência, Sabedoria e Carisma.',
    higher: 'One additional creature per slot level above 3rd (all within 30 feet of each other).', ptHigher: 'Uma criatura adicional por círculo acima do 3º (todas a até 9 m umas das outras).' },
  { name: 'Spirit Shroud', pt: 'Mortalha Espiritual', level: 3, school: 'necromancy', classes: [C, P, K, W], time: 'bonus-action', range: 'Self', duration: '1 minute', conc: true, comp: 'VS', dmg: '1d8',
    desc: 'Spirits surround you within 10 feet: your attacks against creatures within 10 feet deal an extra 1d8 radiant, necrotic or cold damage, those creatures can’t regain hit points, and enemies that start their turn there have their speed reduced by 10 feet.',
    ptDesc: 'Espíritos cercam você a até 3 m: seus ataques contra criaturas a até 3 m causam 1d8 extra de dano radiante, necrótico ou de frio, essas criaturas não recuperam PV, e inimigos que começam o turno ali perdem 3 m de deslocamento.',
    higher: 'Damage increases by 1d8 for every two slot levels above 3rd.', ptHigher: 'O dano aumenta 1d8 a cada dois círculos acima do 3º.' },
  { name: 'Summon Fey', pt: 'Invocar Fada', level: 3, school: 'conjuration', classes: [D, R, K, W], time: 'action', range: '90 feet', duration: '1 hour', conc: true, comp: 'VSM', material: 'A gilded flower worth at least 300 gp',
    desc: 'You summon a fey spirit (Fuming, Mirthful or Tricksy) that uses the Fey Spirit stat block. It can teleport with a Fey Step and obeys your commands.',
    ptDesc: 'Você invoca um espírito feérico (Fumegante, Alegre ou Travesso) com a ficha de Espírito Feérico. Ele se teletransporta com o Passo Feérico e obedece aos seus comandos.',
    higher: SUMMON_HIGHER, ptHigher: SUMMON_HIGHER_PT },
  { name: 'Summon Shadowspawn', pt: 'Invocar Cria das Sombras', level: 3, school: 'conjuration', classes: [K, W], time: 'action', range: '90 feet', duration: '1 hour', conc: true, comp: 'VSM', material: 'Tears inside a gem worth at least 300 gp',
    desc: 'You summon a shadowy spirit (Fury, Despair or Fear) that uses the Shadow Spirit stat block. It can frighten creatures and hide in darkness.',
    ptDesc: 'Você invoca um espírito sombrio (Fúria, Desespero ou Medo) com a ficha de Espírito Sombrio. Ele amedronta criaturas e se esconde na escuridão.',
    higher: SUMMON_HIGHER, ptHigher: SUMMON_HIGHER_PT },
  { name: 'Summon Undead', pt: 'Invocar Morto-Vivo', level: 3, school: 'necromancy', classes: [K, W], time: 'action', range: '90 feet', duration: '1 hour', conc: true, comp: 'VSM', material: 'A gilded skull worth at least 300 gp',
    desc: 'You summon an undead spirit (Ghostly, Putrid or Skeletal) that uses the Undead Spirit stat block.',
    ptDesc: 'Você invoca um espírito morto-vivo (Fantasmagórico, Pútrido ou Esquelético) com a ficha de Espírito Morto-Vivo.',
    higher: SUMMON_HIGHER, ptHigher: SUMMON_HIGHER_PT },
  // 4º círculo
  { name: 'Summon Aberration', pt: 'Invocar Aberração', level: 4, school: 'conjuration', classes: [K, W], time: 'action', range: '90 feet', duration: '1 hour', conc: true, comp: 'VSM', material: 'A pickled tentacle and an eyeball in a platinum-inlaid vial worth at least 400 gp',
    desc: 'You summon an aberrant spirit (Beholderkin, Slaad or Star Spawn) that uses the Aberrant Spirit stat block.',
    ptDesc: 'Você invoca um espírito aberrante (Observador Menor, Slaad ou Cria Estelar) com a ficha de Espírito Aberrante.',
    higher: SUMMON_HIGHER, ptHigher: SUMMON_HIGHER_PT },
  { name: 'Summon Construct', pt: 'Invocar Constructo', level: 4, school: 'conjuration', classes: [W], time: 'action', range: '90 feet', duration: '1 hour', conc: true, comp: 'VSM', material: 'An ornate stone and metal lockbox worth at least 400 gp',
    desc: 'You summon a construct spirit (Clay, Metal or Stone) that uses the Construct Spirit stat block.',
    ptDesc: 'Você invoca um espírito constructo (Argila, Metal ou Pedra) com a ficha de Espírito Constructo.',
    higher: SUMMON_HIGHER, ptHigher: SUMMON_HIGHER_PT },
  { name: 'Summon Elemental', pt: 'Invocar Elemental', level: 4, school: 'conjuration', classes: [D, R, W], time: 'action', range: '90 feet', duration: '1 hour', conc: true, comp: 'VSM', material: 'Air, a pebble, ash and water inside a gold-inlaid vial worth at least 400 gp',
    desc: 'You summon an elemental spirit (Air, Earth, Fire or Water) that uses the Elemental Spirit stat block.',
    ptDesc: 'Você invoca um espírito elemental (Ar, Terra, Fogo ou Água) com a ficha de Espírito Elemental.',
    higher: SUMMON_HIGHER, ptHigher: SUMMON_HIGHER_PT },
  // 5º círculo
  { name: 'Summon Celestial', pt: 'Invocar Celestial', level: 5, school: 'conjuration', classes: [C, P], time: 'action', range: '90 feet', duration: '1 hour', conc: true, comp: 'VSM', material: 'A golden reliquary worth at least 500 gp',
    desc: 'You summon a celestial spirit (Avenger or Defender) that uses the Celestial Spirit stat block and can heal with a touch.',
    ptDesc: 'Você invoca um espírito celestial (Vingador ou Defensor) com a ficha de Espírito Celestial, que cura com um toque.',
    higher: SUMMON_HIGHER, ptHigher: SUMMON_HIGHER_PT },
  // 6º círculo
  { name: 'Summon Fiend', pt: 'Invocar Corruptor', level: 6, school: 'conjuration', classes: [K, W], time: 'action', range: '90 feet', duration: '1 hour', conc: true, comp: 'VSM', material: 'Humanoid blood inside a ruby vial worth at least 600 gp',
    desc: 'You summon a fiendish spirit (Demon, Devil or Yugoloth) that uses the Fiendish Spirit stat block.',
    ptDesc: 'Você invoca um espírito corruptor (Demônio, Diabo ou Yugoloth) com a ficha de Espírito Corruptor.',
    higher: SUMMON_HIGHER, ptHigher: SUMMON_HIGHER_PT },
  { name: 'Tasha’s Otherworldly Guise', pt: 'Disfarce de Outro Mundo de Tasha', level: 6, school: 'transmutation', classes: [S, K, W], time: 'bonus-action', range: 'Self', duration: '1 minute', conc: true, comp: 'VSM', material: 'An object engraved with a symbol of the Outer Planes, worth at least 500 gp',
    desc: 'You take on the aspect of the Lower or Upper Planes: immunity to fire and poison (or radiant and necrotic) and the poisoned (or charmed) condition, a 40-foot flying speed, +2 AC, magical weapon attacks using your spellcasting ability, and two attacks with the Attack action.',
    ptDesc: 'Você assume o aspecto dos Planos Inferiores ou Superiores: imunidade a fogo e veneno (ou radiante e necrótico) e à condição envenenado (ou enfeitiçado), voo de 12 m, +2 na CA, ataques com arma mágicos usando o atributo de conjuração e dois ataques na ação Atacar.' },
  // 7º círculo
  { name: 'Dream of the Blue Veil', pt: 'Sonho do Véu Azul', level: 7, school: 'conjuration', classes: [B, S, K, W], time: '10minutes', range: '20 feet', duration: '6 hours', comp: 'VSM', material: 'A magic item or willing creature from the destination world',
    desc: 'You and up to eight willing creatures fall asleep and dream of another world on the Material Plane; when the spell ends you all wake there, transported.',
    ptDesc: 'Você e até oito criaturas voluntárias dormem e sonham com outro mundo do Plano Material; quando a magia acaba, todos acordam lá, transportados.' },
  // 9º círculo
  { name: 'Blade of Disaster', pt: 'Lâmina do Desastre', level: 9, school: 'conjuration', classes: [S, K, W], time: 'bonus-action', range: '60 feet', duration: '1 minute', conc: true, comp: 'VS', attack: true, dmg: '4d12',
    desc: 'A blade-shaped planar rift appears. As a bonus action, move it 30 feet and make up to two melee spell attacks with it: 4d12 force damage, critical hit on 18–20 (tripling the dice).',
    ptDesc: 'Surge uma fenda planar em forma de lâmina. Com ação bônus, mova-a 9 m e faça até dois ataques mágicos corpo a corpo com ela: 4d12 de dano de energia, crítico com 18–20 (triplicando os dados).' },
];

export const tceSpells = specs.map((s) => spell('tce', s));
