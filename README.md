# Blue World

A cosy 3D browser game: you're a western fence lizard. In Level 1, a desert, you collect 10 golden pebbles.

## Run
```
npm install
npm run dev
```
Then open http://localhost:5173.

## Controls
WASD move · Mouse look (click the game to capture the mouse) · Space jump · F bite · Shift sprint · E push-ups · Mouse wheel zoom.

Tarantulas wander the desert and chase you if you get close. Jump on them or bite them (F). A touch costs one of your 3 hearts; lose them all and you restart at the start point, keeping your pebbles. Hearts refill slowly.

Walk into boulders, fence posts, the wagon, the arch or mesas to climb them. Cacti, sagebrush and small rocks are obstacles: walk or jump around them.

## Tablet
On a tablet (or phone) the game switches to touch controls automatically:
left thumb anywhere on the left side is a joystick (push far to run), drag on the right side to look,
and there are Jump, Bite and push-up buttons. The ⛶ button goes full screen where the browser allows it.

To play on a tablet on the same Wi-Fi as this computer, start the server with `npm run dev -- --host`
and open the "Network" address it prints (e.g. http://192.168.x.x:5173) on the tablet.

## Online
Live at **https://blue-world-tau.vercel.app** (Vercel project `blue-world`, personal team "Mathew's projects").
Source: https://github.com/Mat-V-Garcia/blue-world. **Every push to `main` redeploys the live site automatically** (Vercel is connected to the repo); pushes to other branches get their own preview link.
Manual deploy, if ever needed: `npx vercel deploy --prod --scope mathews-projects-b0ec1f40`

## Where things live
- `src/world.js` — terrain, sky, props, colliders and the 10 pebble spots
- `src/lizard.js` — the simple block-built lizard (fallback if the 3D model fails to load)
- `src/player.js` — movement, jumping, climbing
- `src/pebbles.js` — pebbles, sparkles, dust puffs
- `src/enemies.js` — tarantulas: wandering, chasing, stomp/bite, respawn
- `src/spiderModel.js` — the Magnific 3D tarantula and its leg animation
- `src/lizardModel.js` — the Magnific 3D fence lizard and its animation
- `src/touch.js` — tablet controls: joystick, look, Jump/Bite/push-up buttons
- `src/main.js` — game loop, camera, HUD
- `public/assets/` — web-sized art from Magnific; full-size originals in `art/magnific/`
- `docs/superpowers/specs/` — the design
