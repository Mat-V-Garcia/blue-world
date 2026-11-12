// The list of levels, in order. Each level module exports build(scene), which returns
// { colliders, solids, pebbleSpots, horizonColor, update(dt, t), enemies? }.
export const LEVELS = [
  {
    id: 1,
    name: 'The Desert',
    intro: 'You are a tiny western fence lizard. Somewhere out in the dunes, ten golden pebbles are glinting in the sun. Find them all!',
    title: '/assets/title.jpg',
    load: () => import('./desert.js'),
  },
  {
    id: 2,
    name: 'Fullerton Shops',
    intro: 'You followed a breadcrumb trail into a sunny Fullerton shopping center. Ten golden pebbles got scattered among the shops, cars and planters. Watch out for the pigeons!',
    title: '/assets/title-mall.jpg',
    load: () => import('./mall.js'),
  },
];

// Progress (highest level unlocked) is kept in this browser only.
const KEY = 'blueworld.unlocked';
export function unlockedLevel() {
  try { return Math.max(1, Number(localStorage.getItem(KEY)) || 1); } catch { return 1; }
}
export function unlockLevel(id) {
  try { if (id > unlockedLevel()) localStorage.setItem(KEY, String(id)); } catch { /* private mode etc. */ }
}
// Level chosen in the address (?level=2), limited to what's unlocked.
export function currentLevelId() {
  const want = Number(new URLSearchParams(location.search).get('level')) || 1;
  return Math.min(Math.max(1, want), unlockedLevel(), LEVELS.length);
}
