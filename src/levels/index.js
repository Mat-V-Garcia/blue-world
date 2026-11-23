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
    boss: true, // collecting the pebbles wakes the boss; the level is won by beating it
    icon: '🕷',
    name: 'The Giant Tarantula',
    intro: 'Ten golden pebbles lie in a quiet desert arena. But something huge is sleeping under the sand, and the last pebble will wake it. Only one small lizard can send it back!',
    title: '/assets/title-boss.jpg',
    hint: 'Collect the 10 pebbles to wake the boss · Dodge its lunge · Jump on its back while its fangs are stuck · Q drop tail to trick it',
    help: 'Collect all ten pebbles and the giant tarantula comes out · Dodge its lunge, then jump on its back while its fangs are stuck · Q drops your tail to trick it · Rocks block its webs',
    helpTouch: 'Collect all ten pebbles and the giant tarantula comes out · Dodge its lunge, then Jump onto its back while its fangs are stuck · Tail tricks it',
    load: () => import('./boss.js'),
  },
  {
    id: 3,
    name: 'Fullerton Shops',
    intro: 'With the giant tarantula gone, you followed a breadcrumb trail into a sunny Fullerton shopping center. Ten golden pebbles got scattered among the shops, cars and planters. Watch out for the pigeons!',
    title: '/assets/title-mall.jpg',
    hint: 'WASD move · Mouse look · Space jump (land on enemies!) · F bite · Q drop tail · Shift sprint · E push-ups',
    help: 'Climb almost anything · Jump on enemies or bite them with F · Q drops your tail to distract them · Click the game to look around',
    helpTouch: 'Left thumb: move (push far to run) · Right thumb: drag to look · Jump on enemies or tap Bite · Tail distracts them',
    load: () => import('./mall.js'),
  },
  {
    id: 4,
    boss: true,
    icon: '🦅',
    name: 'The Peregrine Falcon',
    intro: 'The pigeons have all flown off, and the shops have gone very quiet. Ten golden pebbles lie out in the open. High on the clock tower, a peregrine falcon is watching, and the last pebble will bring it down!',
    title: '/assets/title-mall.jpg',
    hint: 'Collect the 10 pebbles to bring the falcon down · Run out of the red ring when it dives · Jump on its back while it is on the ground · Q drop tail to trick it',
    help: 'Collect all ten pebbles and the falcon leaves the clock tower · Watch its shadow and run out of the red ring when it dives · Jump on its back while it is on the ground · Q drops your tail to trick it · Under a car or a bench it cannot reach you',
    helpTouch: 'Collect all ten pebbles and the falcon leaves the clock tower · Run out of the red ring when it dives, then Jump onto its back while it is on the ground · Tail tricks it · Under a car it cannot reach you',
    load: () => import('./falcon.js'),
  },
  {
    id: 5,
    name: 'The Back Yard',
    intro: 'You slipped under the fence into a sunny back yard. Ten golden pebbles are hidden around the patio, the swings and the lemon tree. The alley kittens only want to play, but they play rough!',
    title: '/assets/title-yard.jpg',
    hint: 'WASD move · Mouse look · Space jump · E push-ups scare kittens · Q drop tail · Shift sprint',
    help: "Kittens can't be beaten · Do push-ups (E) to scare them or drop your tail (Q) to fool them · Climb or hide where they can't reach",
    helpTouch: 'Left thumb: move (push far to run) · Right thumb: drag to look · 💪 scares kittens · Tail fools them',
    load: () => import('./yard.js'),
  },
  {
    id: 6,
    boss: true,
    icon: '🐱',
    name: 'The Big Cat',
    intro: 'The kittens have gone in for their supper, and ten golden pebbles lie on the lawn. But the kittens have a very big friend on the other side of the fence, and the last pebble will bring it over to play!',
    title: '/assets/title-yard.jpg',
    hint: 'Collect the 10 pebbles to bring the big cat · Dodge its pounce · Jump on its back while it is flopped over · Q drop tail to trick it',
    help: 'Collect all ten pebbles and the big cat jumps the fence · Dodge its pounce, then jump on its back while it is flopped over · Q drops your tail to trick it · Hide from hairballs behind things · Tire it out and it falls asleep',
    helpTouch: 'Collect all ten pebbles and the big cat jumps the fence · Dodge its pounce, then Jump onto its back while it is flopped over · Tail tricks it · Tire it out and it falls asleep',
    load: () => import('./cat.js'),
  },
];

// What a level is called on screen: the boss has no number, so the levels after it
// keep counting past each boss (Level 1, Boss, Level 2, Boss, Level 3, Boss).
export function levelLabel(level) {
  if (level.boss) return 'Boss';
  return `Level ${LEVELS.filter((l) => !l.boss && l.id <= level.id).length}`;
}

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
const ORDER_FLAG = 'blueworld.bossSecond';
const FALCON_FLAG = 'blueworld.falconFourth';
export function migrateUnlocks(store) {
  try {
    const storage = store ?? localStorage; // inside the try: some browsers throw just reading it
    if (!storage.getItem(L3_FLAG)) {
      if (Number(storage.getItem(KEY)) === 2) storage.setItem(KEY, '3');
      storage.setItem(L3_FLAG, '1');
    }
    // The boss then moved from last to second (Desert, Boss, Shops, Back Yard). Progress is
    // the highest level id open, so, once per browser, saves from the old order shift up by
    // one: whoever had the Shops or the Back Yard open keeps them (and gets the boss).
    if (!storage.getItem(ORDER_FLAG)) {
      const n = Number(storage.getItem(KEY));
      if (n >= 2) storage.setItem(KEY, String(Math.min(4, n + 1))); // there were four levels then
      storage.setItem(ORDER_FLAG, '1');
    }
    // Then the falcon boss arrived between the Shops and the Back Yard. Once per browser,
    // whoever already had the Back Yard open keeps it (and gets the falcon).
    if (!storage.getItem(FALCON_FLAG)) {
      const n = Number(storage.getItem(KEY));
      if (n >= 4) storage.setItem(KEY, '5'); // the Back Yard's new id
      storage.setItem(FALCON_FLAG, '1');
    }
  } catch { /* private mode etc. */ }
}
// Level chosen in the address (?level=2), limited to what's unlocked.
export function currentLevelId() {
  const want = Number(new URLSearchParams(location.search).get('level')) || 1;
  return Math.min(Math.max(1, want), unlockedLevel(), LEVELS.length);
}
