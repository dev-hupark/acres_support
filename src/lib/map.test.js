import { DEAD_COLOR, entryColor, entryRect, footprintSize, overlaps, pointFromPointer } from './map';

test('origin is lower left, Y increases upwards, and all four corners map correctly', () => {
  const bounds = { left: 10, top: 20, width: 601, height: 601 };
  expect(pointFromPointer(10, 621, bounds)).toEqual({ x: 0, y: 0 });
  expect(pointFromPointer(611, 20, bounds)).toEqual({ x: 600, y: 600 });
  expect(pointFromPointer(10, 20, bounds)).toEqual({ x: 0, y: 600 });
  expect(pointFromPointer(611, 621, bounds)).toEqual({ x: 600, y: 0 });
  expect(pointFromPointer(11, 620, bounds)).toEqual({ x: 1, y: 0 });
});
test('2x2 expands right and upwards, OTHER occupies exactly one coordinate cell', () => {
  expect(entryRect({ x: 0, y: 0, faction: 'FRIENDLY' })).toEqual({ x: 0, y: 599, width: 2, height: 2 });
  expect(entryRect({ x: 599, y: 599, faction: 'ENEMY' })).toEqual({ x: 599, y: 0, width: 2, height: 2 });
  expect(entryRect({ x: 600, y: 600, faction: 'OTHER' })).toEqual({ x: 600, y: 0, width: 1, height: 1 });
});
test('death overrides all faction colors without changing the occupied area', () => {
  for (const faction of ['FRIENDLY', 'ENEMY', 'ALLIANCE', 'NEUTRAL', 'OTHER']) {
    expect(entryColor({ faction, is_dead: 'Y' })).toBe(DEAD_COLOR);
    expect(footprintSize(faction)).toBe(faction === 'OTHER' ? 1 : 2);
  }
});
test('partial overlap is blocked, touching edges are allowed', () => {
  const base = { x: 0, y: 0, faction: 'FRIENDLY' };
  expect(overlaps(base, { x: 1, y: 1, faction: 'OTHER' })).toBe(true);
  expect(overlaps(base, { x: 2, y: 0, faction: 'ENEMY' })).toBe(false);
  expect(overlaps(base, { x: 0, y: 2, faction: 'ENEMY' })).toBe(false);
});
