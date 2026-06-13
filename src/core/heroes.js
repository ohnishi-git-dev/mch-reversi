export const HEROES = [
  {
    id: 'nobunaga',
    name: '織田信長',
    shortName: '信長',
    skillName: '天下布武',
    skillType: 'block',
    description: '対象盤面の相手合法手マスを1つ封鎖する。',
    accent: '#c63b2d',
  },
  {
    id: 'napoleon',
    name: 'ナポレオン・ボナパルト',
    shortName: 'ナポレオン',
    skillName: '戦術展開',
    skillType: 'grantGauge',
    description: '自分以外の味方ヒーロー1体のスキルゲージを+8する。',
    accent: '#2f6f9f',
  },
  {
    id: 'cao-cao',
    name: '曹操',
    shortName: '曹操',
    skillName: '乱世の奸雄',
    skillType: 'drainGauge',
    description: '敵ヒーロー1体のスキルゲージを-5する。',
    accent: '#6c5a9b',
  },
  {
    id: 'washington',
    name: 'ジョージ・ワシントン',
    shortName: 'ワシントン',
    skillName: '大陸軍の守り',
    skillType: 'protect',
    description: '対象盤面の自石または相手石1枚を保護する。',
    accent: '#2f7a55',
  },
  {
    id: 'davinci',
    name: 'レオナルド・ダ・ビンチ',
    shortName: 'ダ・ビンチ',
    skillName: 'モナリザの幻惑',
    skillType: 'block',
    blockNoCorners: true,
    description: '対象盤面の相手合法手マスを1つ封鎖する。角マスは選択不可。',
    accent: '#9a6a2f',
  },
  {
    id: 'joan',
    name: 'ジャンヌ・ダルク',
    shortName: 'ジャンヌ',
    skillName: 'オルレアンの加護',
    skillType: 'protect',
    protectEdgesOnly: true,
    description: '対象盤面の自石または相手石1枚を保護する。辺の石のみ選択可。',
    accent: '#b04873',
  },
];

export function getHero(heroId) {
  return HEROES.find((hero) => hero.id === heroId);
}

export function defaultPlayerHeroIds() {
  return ['nobunaga', 'napoleon', 'washington'];
}
