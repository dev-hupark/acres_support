import { buildTroopStatistics } from './troopStatistics';

export const members = [
  { id: 'm1', user_id: 'u1', status: 'APPROVED', display_name: '첫 회원' },
  { id: 'm2', user_id: 'u2', status: 'APPROVED', display_name: '둘째 회원' },
  { id: 'm3', user_id: 'u3', status: 'PENDING' },
];
export const troops = [
  { code: 'S1', name: '정예 방패', category: 'SHIELD' },
  { code: 'S2', name: '일반 방패', category: 'SHIELD', status: 'INACTIVE' },
  { code: 'A', name: '장궁병', category: 'ARCHER' },
  { code: 'C', name: '중기병', category: 'CAVALRY' },
];
export const characters = [
  { id: 'c1', user_id: 'u1', name: '첫 캐릭터', game_uid: '001', status: 'APPROVED', troop1: 'S1', troop2: 'A' },
  { id: 'c2', user_id: 'u1', name: '둘째 캐릭터', game_uid: '002', status: 'APPROVED', troop1: 'S1', troop2: 'S2' },
  { id: 'c3', user_id: 'u2', status: 'APPROVED', troop1: 'C', troop2: null },
  { id: 'c4', user_id: 'u1', status: 'EXCLUDED_BY_ADMIN', troop1: 'S1' },
  { id: 'c5', user_id: 'u3', status: 'APPROVED', troop1: 'S1' },
  { id: 'c6', user_id: 'u1', status: 'PENDING_REAPPROVAL', troop1: 'S1' },
];

test('statistics retain inactive choices and exclude siege selections without counting them as empty slots', () => {
  const result = buildTroopStatistics(members, [...characters, { id: 'siege-character', user_id: 'u1', status: 'APPROVED', troop1: 'ENGINE', troop2: 'ENGINE_2' }], [...troops, { code: 'ENGINE', name: '공성 병기', category: 'SIEGE' }, { code: 'ENGINE_2', name: '비활성 병기', category: 'SIEGE', status: 'INACTIVE' }]);
  expect(result).toMatchObject({ memberCount: 2, characterCount: 4, totalSelections: 5, emptySlots: 1 });
  expect(result.groups.map(g => g.code)).toEqual(['SHIELD', 'ARCHER', 'SPEAR', 'CAVALRY']);
  const shield = result.groups.find(g => g.code === 'SHIELD');
  expect(shield.total).toBe(3);
  expect(shield.troops.find(t => t.code === 'S1')).toMatchObject({ count: 2, memberCount: 1 });
  expect(shield.troops.find(t => t.code === 'S2').count).toBe(1);
  expect(shield.troops.find(t => t.code === 'S1').participants.map(p => p.characterId)).toEqual(['c1', 'c2']);
});

test('different troops in a category use different stable shades', () => {
  const first = buildTroopStatistics(members, characters, troops).groups.find(g => g.code === 'SHIELD');
  const second = buildTroopStatistics(members, characters.slice(0, 1), troops).groups.find(g => g.code === 'SHIELD');
  expect(first.troops[0].color).not.toBe(first.troops[1].color);
  expect(first.troops.find(t => t.code === 'S1').color).toBe(second.troops.find(t => t.code === 'S1').color);
});

test('unclassified and missing catalogue entries are counted without losing their selections', () => {
  const result = buildTroopStatistics(members, [{ id: 'c', user_id: 'u1', status: 'APPROVED', troop1: 'U', troop2: 'missing' }], [{ code: 'U', name: '미분류 병종', category: null }]);
  const unknown = result.groups.find(g => g.code === 'UNCLASSIFIED');
  expect(unknown.total).toBe(2);
  expect(result.totalSelections).toBe(2);
});

test('empty selections return four zero-count groups without unclassified noise', () => {
  const result = buildTroopStatistics(members, [], troops);
  expect(result.groups).toHaveLength(4);
  expect(result.groups.every(g => g.total === 0)).toBe(true);
  expect(result.totalSelections).toBe(0);
});
