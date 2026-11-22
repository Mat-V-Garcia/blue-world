# Blue World

A cosy 3D browser game: you're a western fence lizard collecting 10 golden pebbles per level.

- **Level 1 · The Desert** — dunes, mesas, cacti, fences and an old wagon. Enemies: tarantulas.
- **Level 2 · Fullerton Shops** — a sunny Southern California shopping center inspired by Fullerton, CA
  (all shop names are made up): storefronts, a clock tower, a fountain, palms, an orange tree, cafés,
  carts and a parking lot. Enemies: pigeons.
- **Level 3 · The Back Yard** — a sunny family back yard: striped patio and gazebo, lawn with a
  playhouse and swing set, a lemon tree, a shed and a white fence. Enemies: alley kittens, which can't be
  beaten, only scared off or fooled.

Finishing a level unlocks the next (saved in the browser). The title screen has a level picker.

## Run
```
npm install
npm run dev
```
Then open http://localhost:5173.

## Controls
WASD move · Mouse look (click the game to capture the mouse) · Space jump · F bite · Q drop tail · Shift sprint · E push-ups · Mouse wheel zoom.

Tarantulas wander the desert and chase you if you get close. Jump on them or bite them (F). A touch costs one of your 3 hearts; lose them all and you restart at the start point, keeping your pebbles. Hearts refill slowly.

**Drop your tail (Q)** on any level: it stays behind wriggling for a few seconds and nearby enemies go for it instead of you. It grows back after about 30 seconds (the HUD shows "Tail ready").

**Kittens (Level 3)** are different: jumping on them or biting them does nothing. Do push-ups (E) for a moment while one is close and it bolts home for a while, or drop your tail, or get somewhere they can't follow (up high, or under the bench, table, chairs or playhouse).

Walk into boulders, fence posts, the wagon, the arch or mesas to climb them. Cacti, sagebrush and small rocks are obstacles: walk or jump around them.

## Tablet
On a tablet (or phone) the game switches to touch controls automatically:
left thumb anywhere on the left side is a joystick (push far to run), drag on the right side to look,
and there are Jump, Bite, push-up and Tail buttons. The ⛶ button goes full screen where the browser allows it.

To play on a tablet on the same Wi-Fi as this computer, start the server with `npm run dev -- --host`
and open the "Network" address it prints (e.g. http://192.168.x.x:5173) on the tablet.

## Online
Live at **https://blue-world-tau.vercel.app** (Vercel project `blue-world`, personal team "Mathew's projects").
Source: https://github.com/Mat-V-Garcia/blue-world. **Every push to `main` redeploys the live site automatically** (Vercel is connected to the repo); pushes to other branches get their own preview link.
Manual deploy, if ever needed: `npx vercel deploy --prod --scope mathews-projects-b0ec1f40`

## Where things live
- `src/levels/` — one file per level (`desert.js`, `mall.js`, `yard.js`) plus `index.js`, the level list, per-level help text and unlocking
- `src/world.js` — shared world kit: active ground, painted sky, rock shapes, collider maths
- `src/lizard.js` — the simple block-built lizard (fallback if the 3D model fails to load)
- `src/player.js` — movement, jumping, climbing
- `src/pebbles.js` — pebbles, sparkles, dust puffs
- `src/enemies.js` — enemies (tarantulas, pigeons, kittens): wandering, chasing, stomp/bite, respawn, getting scared, going for a dropped tail
- `src/kittenModel.js` — the kitten built from shapes (and a loader for a future `kitten.glb`)
- `src/tail.js` — the tail drop: the wriggling tail and the regrow timer
- `src/spiderModel.js` — the Magnific 3D tarantula and its leg animation
- `src/pigeonModel.js` — the Magnific 3D pigeon (head-bob walk, pecking, wing flaps)
- `src/lizardModel.js` — the Magnific 3D fence lizard and its animation
- `src/touch.js` — tablet controls: joystick, look, Jump/Bite/push-up/Tail buttons
- `src/main.js` — game loop, camera, HUD
- `public/assets/` — web-sized art from Magnific; full-size originals in `art/magnific/`
- `tests/` — logic tests, run with `npm test` (Node's built-in runner, nothing to install)
- `tools/clipScan.js` — dev helper that finds spots where the lizard can stand inside a prop; run it from the browser console: `(await import('/tools/clipScan.js')).scan('/src/levels/yard.js')`
- `docs/superpowers/specs/` — the designs; `docs/superpowers/plans/` — the build plans
