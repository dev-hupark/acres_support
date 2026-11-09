export const MAX_COORDINATE = 600;
export const GRID_SIZE = MAX_COORDINATE + 1;
export const FACTIONS = {
  FRIENDLY: { name: '아군', color: '#22a35a' },
  ENEMY: { name: '적군', color: '#e04444' },
  ALLIANCE: { name: '동맹군', color: '#9353cf' },
  NEUTRAL: { name: '중립', color: '#e4ba21' },
  OTHER: { name: '기타', color: '#f18a28' },
};
export const DEAD_COLOR = '#8a929b';
export const footprintSize = faction => faction === 'OTHER' ? 1 : 2;
export const entryColor = entry => entry.is_dead === 'Y' ? DEAD_COLOR : FACTIONS[entry.faction].color;
export const entryRect = entry => ({ x: entry.x, y: GRID_SIZE - entry.y - footprintSize(entry.faction), width: footprintSize(entry.faction), height: footprintSize(entry.faction) });
export function pointFromPointer(clientX, clientY, bounds) {
  const clamp = n => Math.max(0, Math.min(MAX_COORDINATE, n));
  return { x: clamp(Math.floor((clientX - bounds.left) / bounds.width * GRID_SIZE)), y: clamp(MAX_COORDINATE - Math.floor((clientY - bounds.top) / bounds.height * GRID_SIZE)) };
}
export function overlaps(a, b) {
  return a.x < b.x + footprintSize(b.faction) && b.x < a.x + footprintSize(a.faction) && a.y < b.y + footprintSize(b.faction) && b.y < a.y + footprintSize(a.faction);
}
