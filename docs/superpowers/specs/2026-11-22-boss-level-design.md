# Boss level — The Giant Tarantula (design)

## Intent

Blue World ends with a boss fight. After the lizard has beaten all three levels it
goes back to the desert and faces one giant tarantula. The fight should feel like a
finale: a big enemy with its own health bar, two attacks to learn and dodge, and a
sky that turns from sunny blue to a red lightning storm as the tarantula weakens.

## Goals

- A fourth entry in the level picker, "The Giant Tarantula", unlocked by winning
  Level 3 (The Back Yard).
- One giant tarantula that tries to catch the lizard with its fangs (a lunge) and
  shoots spider webs at it from a distance.
- The lizard hurts it only by dodging a lunge and then landing on its back while
  its fangs are stuck in the sand (Mathew picked this).
- A boss health bar on screen.
- The lower the boss's health, the redder and stormier the sky, with lightning and
  thunder in the later part of the fight.
- Beating the boss wins the game. Works on keyboard/mouse and tablet touch controls.

## Non-goals

- Magnific art. This pass reuses the existing tarantula model scaled up, the desert
  sand/rock/sky pictures and the Level 1 title picture. A dedicated boss model, a
  storm sky painting and a boss title picture are a later pass.
- Small tarantulas, pebbles or other pick-ups in the arena.
- New touch buttons or new lizard moves.
- Music, a save system, or changes to Levels 1 to 3 beyond what is listed under
  "UI and text".

## Anti-goals

- Not frightening or gory for young players: no blood, no squashing of the boss,
  nothing that looks like the lizard being eaten. Being caught is the same "Ouch!"
  as every other enemy.
- No strobing. Lightning is single soft flashes, never closer together than 1.5 s,
  and the whole screen never flashes to pure white.
- No unwinnable or stuck states: the lizard can always reach the boss's back while
  the fangs are stuck, and a webbed lizard always gets free on its own.
- No clipping regressions: arena rocks get colliders that match their shapes, as in
  the other levels.
- Levels 1 to 3 must play exactly as they do now.

## Constraints

- Vite + Three.js, plain JS modules, no new dependencies.
- Follows the level contract in `src/levels/index.js` (`build(scene)` returning
  `{ colliders, solids, horizonColor, pebbleSpots, spawn, enemies, update }`), with
  the additions described under "How it is built".
- Scale: the lizard is about 1.6 units long, walks at 5.5, sprints at 10, and its
  jump peaks about 1.3 above where it took off.
- Tests run with `npm test` (`node --test tests/*.test.mjs`); logic that can be
  tested without a browser gets tests there. Looks and feel are checked in the
  in-app browser, stepping the game with `__game.frame(dt)` where needed.
- Every push to `main` goes live, so the work happens on a branch.

## Approaches considered

1. **A separate boss module and a new small arena level (chosen).** A new
   `src/boss.js` owns the giant tarantula (its moves, health, webs) and a new
   `src/levels/boss.js` builds a compact desert arena. The existing enemy manager is
   left alone. The boss has almost nothing in common with the wandering enemies, so
   keeping it apart keeps both simple and keeps Levels 1 to 3 safe.
2. **Teach the existing enemy manager a "boss" kind.** Reuses wander/chase code, but
   lunges, webs, health and a stuck state would be special cases threaded through
   code that three working levels depend on.
3. **Fight on the Level 1 map.** No new arena to build, but that map is 184 units
   across with tall mesas: the lizard could simply leave, or sit somewhere the boss
   cannot follow, and the fight would lose its shape.

Mathew talks about the fight rather than the code, so the choice of 1 is Claude's.

## The arena

A new, smaller patch of the same desert, built from the same sand, rock and sky
pictures as Level 1 so it reads as "back in the desert".

- Round, about 40 units in radius, nearly flat sand with only gentle ripples, so
  lunges and dodges are fair.
- Closed in by a ring of tall mesa rock (not climbable) so neither side can leave.
- Four to six boulders scattered around the middle ring. They block webs and stop
  a lunge. They are low enough (about 2 to 2.5 high) that the boss still towers
  over them, and climbable like the Level 1 rocks. Standing on one is not safe: the
  lunge and the webs both reach the lizard there.
- A few cacti and dead bushes at the edge, for looks only (cacti have colliders).
- The lizard starts near the south edge facing the boss; the boss starts in the
  middle.

## The boss

The existing tarantula model, scaled up so its body is roughly 5 units long and its
back is about 2 units off the sand (the builder tunes this so the next two points
hold), with the simple code-built spider as the fallback if the model fails to load.

- **Health: 6.** Each successful hit removes 1.
- **Getting onto its back:** while its fangs are stuck its body is lowered so the
  back is within reach of an ordinary jump from the sand (the jump peaks about 1.3
  up). A hit is the lizard coming down onto the back, the same falling-onto check
  the other enemies use; the boss is never a solid thing the lizard climbs, so the
  player's collision code is not changed for it. Outside the stuck state the back
  is too high to jump onto from the ground.
- **Touching it** (body or legs) when it is not stuck costs a heart, with the usual
  knock-back and a moment of invulnerability. While it is stuck, touching it is
  harmless.

### What it does

It always turns to face the lizard and walks toward it slowly (slower than the
lizard walks), then picks an attack:

- **Fang lunge** (chosen when the lizard is within about 14 units; a lunge itself
  can travel up to about 22 units, which the tail drop and the web follow-up use):
  1. *Wind-up, about 0.8 s:* it rears up on its back legs and locks onto where the
     lizard is at that moment. A short hiss plays. This is the cue to dodge.
  2. *Lunge:* it dashes in a straight line to that spot and a little past it,
     faster than the lizard can sprint. If the fangs reach the lizard it costs a
     heart.
  3. *Stuck:* if the lunge did not catch the lizard (including passing through a
     lizard that is flashing and cannot be hurt), or it ran into a boulder or the
     arena wall, the fangs are stuck in the sand for about 2.5 s at full
     health, shortening evenly to about 1.8 s at 1 health. The boss sits low and
     strains; a toast the first time says "Its fangs are stuck! Jump on its back!"
  4. *Hit:* landing on its back while stuck takes 1 health, bounces the lizard
     clear, and frees the boss, which then cannot be hurt and does not attack for
     about 1.5 s. If nobody lands on it, it pulls free when the time is up.
- **Web shot** (when the lizard is further than about 14 units, and also at any
  range when the lizard has been standing on a boulder for a couple of seconds):
  1. *Wind-up, about 0.6 s:* it lifts its abdomen and aims.
  2. *Shot:* a white web ball flies in a gentle arc to where the lizard was when
     it was fired, at about 16 units per second. Boulders stop it.
  3. *If it hits:* the lizard is webbed for about 2.5 s: it moves at about a third
     of walking speed and cannot jump, sprint or climb, and is drawn with web
     strands on it. No heart is lost. The boss follows up at once with a lunge
     from where it stands if the lizard is within lunge travel (about 22 units),
     otherwise it walks closer first. Being webbed usually costs a heart unless a
     tail drop saves it.
  4. *If it misses:* it leaves a web splat on the sand that fades after a few
     seconds and does nothing.
- **Getting angrier:** below half health its wind-ups are about 25% shorter and it
  sometimes fires two webs in a row.

### The lizard's other moves

- **Tail drop (Q / Tail):** if the boss is within about 20 units and not already
  mid-lunge, stuck or recovering, it drops what it is doing and starts a lunge
  wind-up aimed at the tail straight away, which leaves it stuck there. This is the reliable way to set up a hit, limited by the tail's 30 s
  regrow.
- **Landing on its back when it is not stuck** (for example from a boulder):
  bounces the lizard off with no damage either way, and a toast says "Wait until
  its fangs are stuck!"
- **Bite (F):** does nothing to it; same toast.
- **Push-ups (E):** do nothing; a giant tarantula is not impressed.

### Losing and winning

- Hearts work as in every level: three, slow refill. Losing the last one sends the
  lizard back to its start spot with full hearts. The boss keeps the damage it has
  taken, so nobody is ever sent back to the beginning of the fight.
- At 0 health the boss stops, curls its legs in, and sinks down into the sand with
  a puff of dust. The storm clears back to blue over about 3 seconds, the win
  jingle plays, and the win screen says the game is finished.
- "Play again" restarts the fight: boss at full health in the middle, blue sky.

## The storm

Driven by one number, storm = 1 − (boss health ÷ 6), eased so each hit visibly
shifts the sky over about a second rather than snapping.

- **Colour:** the sky dome, the painted horizon picture, the haze, the skylight and
  the sunlight all blend from the normal desert daytime colours at storm 0 to a
  dark red sky with dim, red-orange light at storm 1. It must stay bright enough
  to see the lizard, the boss's wind-ups and the webs clearly at storm 1.
- **Lightning:** starts at storm 0.5 (after the third hit). A bolt (a jagged bright
  line in the sky beyond the arena wall, in a random direction) appears for a
  fraction of a second with a soft brightening of the scene, followed by thunder.
  One every 5 to 9 s at storm 0.5, quickening to one every 1.5 to 4 s at the last
  point of health. Lightning is scenery: it never hurts the lizard.
- **Sound:** a low synthesized thunder rumble per bolt, using the existing synth
  helper (which will need a noise source added).

## UI and text

- Level picker: a fourth button, shown as "Boss · The Giant Tarantula" (a skull or
  spider mark instead of the number 4), locked until Level 3 is won.
- Level 3's win screen now announces the boss is unlocked and offers "Next", as
  Levels 1 and 2 do. The boss's win screen is the "you finished the game" message.
- Title screen for the boss: reuses the Level 1 picture, with an intro in the same
  voice as the others ("Something huge is stirring under the dunes…") and help
  lines explaining: dodge the lunge, jump on its back while its fangs are stuck,
  drop your tail to trick it, hide from webs behind rocks.
- In play: a boss health bar across the top centre with the name "Giant
  Tarantula". The pebble counter is hidden on this level. Hearts and the tail
  indicator stay.
- Nobody gets the boss unlocked automatically: Level 3 has to be won on this
  browser after this update, because the game has never recorded a Level 3 win.

## How it is built

- `src/levels/boss.js`: the arena. Returns the usual level object with an empty
  `pebbleSpots`, no wandering enemies (asked for explicitly, since a level that
  says nothing gets six tarantulas), and a `boss` entry (start position, health)
  that tells `main.js` this level is won by beating the boss rather than by
  collecting pebbles.
- `src/boss.js`: `createBoss(...)`, a state machine (approach, wind-up, lunge,
  stuck, recover, web wind-up, defeated) plus the web projectiles. Each frame it
  is given the lizard's position and whether the lizard can be hurt, and reports
  back events for `main.js` to act on: lizard caught, lizard webbed, boss hit,
  bounced off, boss defeated. It exposes health and a way to redirect it at a
  dropped tail. Its rules are tested in `tests/boss.test.mjs` without a browser.
- `src/storm.js`: takes handles to the sky, fog and lights and a storm value, and
  does the colour blending and lightning scheduling. `buildSky` in `src/world.js`
  is extended to hand back what is needed to recolour the sky; Levels 1 to 3
  ignore it.
- `src/player.js`: a "webbed" slow-down the boss level can apply for a time.
- `src/main.js`, `index.html`, `src/style.css`, `src/audio.js`,
  `src/levels/index.js`: the boss health bar, win-by-boss, hiding the pebble
  counter, the fourth level entry, and the hiss, web, hit and thunder sounds.

## What's left to the builder

- Exact arena layout, boulder positions and sizes, colours of the storm.
- Exact boss scale and the stuck pose, provided the lizard can reach the back
  while stuck and cannot from the ground otherwise.
- How rearing up, lunging, straining and curling are posed on the rigged model
  (whole-body tilts and squashes are enough) and on the fallback spider.
- Collision shape of the boss for touching and for standing on its back.
- Tuning numbers (speeds, ranges, timers): the figures above are starting points
  to adjust by playtest.
- What the web ball, web strands and splat look like.

## Calls made by Claude (not explicitly decided by Mathew)

- A new small arena rather than the Level 1 map.
- 6 health; three hearts for the lizard as usual.
- A web that hits slows the lizard rather than costing a heart.
- Lightning is scenery only and never hurts.
- Losing all hearts does not reset the boss's health.
- The tail drop baits a lunge; bite and push-ups do nothing to the boss.
- The boss sinks into the sand when beaten rather than being squashed.
- No automatic unlock: Level 3 must be won again on each device to open the boss.
- Reusing the tarantula model, desert sky and Level 1 title picture until an art
  pass.
- Soft, spaced-out lightning flashes (no strobing).
