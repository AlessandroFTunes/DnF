import { BOOKS } from './helpers';
import { bookFeats } from './feats';
import { tceSpells } from './tce-spells';
import { tceSubclasses } from './tce-subclasses';
import { xgeSpells } from './xge-spells';
import { xgeSubclasses } from './xge-subclasses';

/** Linhagem Customizada (Caldeirão de Tasha): única "raça" nova dos dois livros. */
const customLineage = {
  key: 'tce_custom-lineage',
  name: 'Custom Lineage',
  edition: '2014',
  document_key: 'tce',
  document_name: BOOKS.tce,
  subspecies_of: '',
  desc: 'A lineage of your own design, for characters whose origin doesn’t match any existing race.',
  traits: [
    { name: 'Ability Score Increase', type: null, order: 1, desc: 'One ability score of your choice increases by 2.' },
    { name: 'Size', type: null, order: 2, desc: 'Small or Medium, chosen when you select this lineage.' },
    { name: 'Speed', type: null, order: 3, desc: '30 feet' },
    { name: 'Feat', type: null, order: 4, desc: 'You gain one feat of your choice for which you qualify.' },
    { name: 'Variable Trait', type: null, order: 5, desc: 'You gain darkvision with a range of 60 feet, or proficiency in one skill of your choice.' },
    { name: 'Languages', type: null, order: 6, desc: 'Common and one other language you and your DM agree is appropriate.' },
  ],
  i18n: {
    'pt-BR': {
      name: 'Linhagem Customizada',
      desc: 'Uma linhagem criada por você, para personagens cuja origem não combina com nenhuma raça existente.',
      traits: {
        'Ability Score Increase': ['Aumento no Valor de Atributo', 'Um valor de atributo à sua escolha aumenta em 2.'],
        Size: ['Tamanho', 'Pequeno ou Médio, escolhido ao selecionar esta linhagem.'],
        Speed: ['Deslocamento', '9 metros'],
        Feat: ['Talento', 'Você ganha um talento à sua escolha cujos requisitos cumpra.'],
        'Variable Trait': ['Traço Variável', 'Você ganha visão no escuro de 18 m ou proficiência numa perícia à sua escolha.'],
        Languages: ['Idiomas', 'Comum e outro idioma que você e o mestre acharem adequado.'],
      },
    },
  },
};

/** Conteúdo do Guia de Xanathar e do Caldeirão de Tasha, por coleção do complemento. */
export const books = {
  srd_subclasses: [...xgeSubclasses, ...tceSubclasses],
  srd_spells: [...xgeSpells, ...tceSpells],
  srd_feats: bookFeats,
  srd_species: [customLineage],
};
