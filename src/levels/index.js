// The list of levels, in order. Each level module exports build(scene), which returns
// { colliders, solids, pebbleSpots, horizonColor, update(dt, t), enemies? }.
// hint / help / helpTouch: the controls reminders shown in play and on the title screen.
export const LEVELS = [
  {
    id: 1,
    name: 'The Desert',
    intro: 'You are a tiny western fence lizard. Somewhere out in the dunes, ten golden pebbles are glinting in the sun. Find them all!',
    title: '/assets/title.jpg',
    hint: 'WASD move · Mouse look · Space jump (land on enemies!) · F bite · Q drop tail · Shift sprint · E push-ups',
    help: 'Climb almost anything · Jump on enemies or bite them with F · Q drops your tail to distract them · Click the game to look around',
    helpTouch: 'Left thumb: move (push far to run) · Right thumb: drag to look · Jump on enemies or tap Bite · Tail distracts them',
    load: () => import('./desert.js'),
  },
  {
    id: 2,
    name: 'Fullerton Shops',
    intro: 'You followed a breadcrumb trail into a sunny Fullerton shopping center. Ten golden pebbles got scattered among the shops, cars and planters. Watch out for the pigeons!',
    title: '/assets/title-mall.jpg',
    hint: 'WASD move · Mouse look · Space jump (land on enemies!) · F bite · Q drop tail · Shift sprint · E push-ups',
    help: 'Climb almost anything · Jump on enemies or bite them with F · Q drops your tail to distract them · Click the game to look around',
    helpTouch: 'Left thumb: move (push far to run) · Right thumb: drag to look · Jump on enemies or tap Bite · Tail distracts them',
    load: () => import('./mall.js'),
  },
  {
    id: 3,
    name: 'The Back Yard',
    intro: 'You slipped under the fence into a sunny back yard. Ten golden pebbles are hidden around the patio, the swings and the lemon tree. The alley kittens only want to play, but they play rough!',
    title: '/assets/title.jpg', // stand-in until the yard gets its own picture
    hint: 'WASD move · Mouse look · Space jump · E push-ups scare kittens · Q drop tail · Shift sprint',
    help: "Kittens can't be beaten · Do push-ups (E) to scare them or drop your tail (Q) to fool them · Climb or hide where they can't reach",
    helpTouch: 'Left thumb: move (push far to run) · Right thumb: drag to look · 💪 scares kittens · Tail fools them',
    load: () => import('./yard.js'),
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
// Level 3 arrived after people had already finished Level 2, and the game never recorded
// "Level 2 finished" (there was nothing to unlock). So, once per browser, anyone who has
// Level 2 open gets Level 3 too instead of having to replay Level 2.
const L3_FLAG = 'blueworld.l3open';
export function migrateUnlocks(store) {
  try {
    const storage = store ?? localStorage; // inside the try: some browsers throw just reading it
    if (storage.getItem(L3_FLAG)) return;
    if (Number(storage.getItem(KEY)) === 2) storage.setItem(KEY, '3');
    storage.setItem(L3_FLAG, '1');
  } catch { /* private mode etc. */ }
}
// Level chosen in the address (?level=2), limited to what's unlocked.
export function currentLevelId() {
  const want = Number(new URLSearchParams(location.search).get('level')) || 1;
  return Math.min(Math.max(1, want), unlockedLevel(), LEVELS.length);
}
