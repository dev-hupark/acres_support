export const TROOP_CATEGORIES = [
  { code: 'SHIELD', name: '방패병', hue: 218 },
  { code: 'ARCHER', name: '궁병', hue: 45 },
  { code: 'SPEAR', name: '창병', hue: 2 },
  { code: 'CAVALRY', name: '기병', hue: 138 },
];
const unknown = { code: 'UNCLASSIFIED', name: '미분류', hue: 0 };
const colorFor = (category, index) => `hsl(${(category.hue + (index * 3 % 13) - 6 + 360) % 360}, ${category.code === unknown.code ? 0 : 76}%, ${38 + index * 7 % 31}%)`;

export function buildTroopStatistics(members, characters, troops) {
  const approved = members.filter(m => m.status === 'APPROVED');
  const memberMap = new Map(approved.map(m => [m.user_id, m]));
  const participating = characters.filter(pc => pc.status === 'APPROVED' && memberMap.has(pc.user_id));
  const troopMap = new Map(troops.map(t => [t.code, t]));
  const categoryMap = new Map(TROOP_CATEGORIES.map(c => [c.code, c]));
  const grouped = new Map([...TROOP_CATEGORIES, unknown].map(c => [c.code, { ...c, total: 0, troops: [] }]));
  const selections = new Map();
  for (const pc of participating) {
    [pc.troop1, pc.troop2].forEach((code, index) => {
      if (!code || troopMap.get(code)?.category === 'SIEGE') return;
      if (!selections.has(code)) selections.set(code, []);
      selections.get(code).push({ memberId: pc.user_id, memberName: memberMap.get(pc.user_id).display_name, characterId: pc.id, characterName: pc.name, gameUid: pc.game_uid, slot: index + 1 });
    });
  }
  // Use the full catalogue, including inactive troops, to keep colors stable
  // when participation counts change and to preserve existing selections.
  const catalogByCategory = new Map([...TROOP_CATEGORIES, unknown].map(c => [c.code, []]));
  for (const code of new Set([...troopMap.keys(), ...selections.keys()])) {
    const troop = troopMap.get(code);
    if (troop?.category === 'SIEGE') continue;
    const category = categoryMap.get(troop?.category) || unknown;
    catalogByCategory.get(category.code).push(code);
  }
  for (const codes of catalogByCategory.values()) codes.sort();
  for (const [code, participants] of selections) {
    const troop = troopMap.get(code);
    const category = categoryMap.get(troop?.category) || unknown;
    const group = grouped.get(category.code);
    group.total += participants.length;
    group.troops.push({ code, name: troop?.name || code, count: participants.length, memberCount: new Set(participants.map(p => p.memberId)).size, color: colorFor(category, catalogByCategory.get(category.code).indexOf(code)), participants });
  }
  const groups = [...grouped.values()].filter(g => g.code !== unknown.code || g.total > 0);
  for (const group of groups) group.troops.sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.code.localeCompare(b.code));
  const totalSelections = groups.reduce((sum, g) => sum + g.total, 0);
  const emptySlots = participating.reduce((sum, pc) => sum + [pc.troop1, pc.troop2].filter(code => !code).length, 0);
  return { groups, memberCount: approved.length, characterCount: participating.length, totalSelections, emptySlots };
}
