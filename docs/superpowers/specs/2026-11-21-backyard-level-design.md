# Level 3 — The Back Yard (design)

## Intent

Level 3 of Blue World is set in the family's real back yard, so it should be
recognisable to the people who live there, but shown as a tidy, well-kept, sunny
version of itself. The enemies are alley kittens. Kittens are never hurt or
defeated: the lizard gets past them the way a real fence lizard would, by
bluffing (push-ups) or by dropping its tail.

## Goals

- A third level, "The Back Yard", reachable from the level picker and unlocked by
  finishing Level 2. Same win condition as the other levels: collect 10 pebbles.
- The yard's real landmarks are all present and recognisable (list below).
- Kittens that chase the lizard and cost a heart on touch, and that can only be
  dealt with by scaring them or by dropping the tail.
- Works on keyboard/mouse and on the tablet touch controls.

## Non-goals

- Magnific art. This pass is built in code (shapes, flat toon colours, the
  textures already in `public/assets`). A rigged kitten model, grass/fence
  textures and a title picture are a later pass.
- New music, a save system, or changes to the layout of Levels 1 and 2.
- Smarter enemy path-finding than the existing "walk toward target, slide round
  obstacles" behaviour.

## Anti-goals

- The yard must not look messy or run-down: no clutter piles, torn shade cloth,
  stained concrete, bare dirt patches, peeling paint or leaning structures.
- No kitten is ever squashed, bitten away or otherwise "killed", and there is no
  poof/squash effect on them.
- No clipping regressions: every solid-looking prop has a collider that matches
  it, and anything the lizard can stand on is stood *on*, not in (the Level 2
  fixes of 2026-11-21 are the reference).

## Constraints

- Vite + Three.js, plain JS modules, no new dependencies.
- Follows the existing level contract (`src/levels/index.js`): a module exporting
  `build(scene)` that returns `{ colliders, solids, horizonColor, pebbleSpots,
  spawn, enemies, update }`, with ground set through `setGround`.
- Scale matches the other levels: the lizard is about 1.6 units long, so
  human-sized things are big (a chair seat is about lizard-jump height, a bench
  seat is ~1.5 up, the Level 2 car is 12 long).
- No test framework in the repo. Verification is done in the in-app browser:
  a scan for stand-inside-geometry spots, simulated climbs with `Player`, and a
  played-through check.

## Approaches considered

1. **Code-built now, Magnific art as a second pass (chosen).** Build the yard,
   kitten behaviour, scare and tail drop with a kitten made from shapes, using the
   same "stand-in model, swapped for a GLB when one loads" pattern the pigeon and
   tarantula use. Playable sooner; credits are only spent once the level feels
   right; the art drops in without rework.
2. **Magnific art first.** Looks finished from the first playtest, but needs the
   Chrome session and download approvals up front and spends ~1,035 credits on a
   rigged kitten before its size and look have been tried in play.
3. **Code-built only.** Cheapest, but the kittens would stay plainer than the
   lizard, pigeons and tarantulas.

Mathew picked 1.

## The yard

Based on a panorama photo of the real yard that Mathew shared in the design
conversation (2026-11-21). It is a photo of the family home, so it is deliberately
not stored in the repo; the description below is the reference. Everything is
clean, freshly painted and upright.

Proportions: the yard is roughly twice as long (near end to porch) as it is wide.
The patio takes about the left 40% of the width, the path about 10% in the
middle, and the lawn the right 50%. The gazebo stands in the middle of the patio
with the table under it; the chairs, ball and urn are at the near-left corner by
the white house; the hammock chair is further up the patio against the white
house wall. On the lawn the umbrella and playhouse are at the far end near the
lemon tree, the swing set is in the middle (nearer the fence), and the shed,
snake plants and bench are at the near end against the fence. Layout as seen from the lizard's start at the near (street) end looking
toward the houses:

- **Far end:** the green house with orange trim and a gabled roof, with its
  covered porch (lattice under the roof, French doors, a few neat potted plants).
- **Left side:** the white clapboard house wall with a window, running the length
  of the yard.
- **Left half, ground:** a concrete patio with curved terracotta-brick stripes.
  On it: a metal gazebo frame (four posts and a peaked roof frame, with a clean
  shade canopy), a hanging hammock chair on its stand, a small patio table with a
  plate and a red cup, two wooden chairs, a big grey exercise ball, a white
  planter urn, a wicker plant stand.
- **Middle:** a straight concrete path from the near end to the porch.
- **Right half, ground:** a green lawn. On it: a white wooden playhouse on legs
  with a ladder and a small slide, a white A-frame swing set with two belt swings
  and a green two-seat glider, a closed patio umbrella on its base, a green
  ride-on toy.
- **Behind the lawn:** a lemon tree near the porch corner.
- **Right side:** a white picket-board fence with a white wagon wheel leaning on
  it and a wall ornament.
- **Near right corner:** a small pale-green shed with a mailbox on a post, a row
  of snake plants in terracotta pots on little stools, a white wrought-iron bench
  with blue floral cushions on a small paved pad, and a child's bike.
- **Edges:** fence/house walls close the yard on three sides; the near end is
  closed by a low brick edging and hedge. The play area is a rectangle rather
  than a circle (see "Left to the builder").

Ground heights: patio, path and lawn are level; the porch is a raised deck one
step up.

### Climbing and hiding

As in Level 2, wood and rough things are climbable and smooth things are not.
Climbable: gazebo posts and frame, playhouse legs/ladder/walls, swing-set frame,
fence, lemon tree trunk, chairs, table, bench, shed, plant stools, wagon wheel.
Not climbable: house walls, windows, exercise ball, urn, terracotta pots.
Low hiding gaps the lizard fits under and a kitten does not: under the bench,
under the playhouse, under the patio table and chairs.

### Pebbles (10)

One each: on the gazebo roof frame; on the playhouse deck; on a swing seat; in the
top of the lemon tree; among the snake-plant pots; on top of the wagon wheel;
under the bench; on the shed roof; on the patio table; on top of the fence.
Each gets a short pickup hint like the other levels.

## Kittens

- Five alley kittens (mixed coats: tabby, black, orange, grey, tuxedo), built
  from shapes in `src/kittenModel.js` with a walk cycle, a tail that swishes, and
  ears. The module also exposes an async loader that tries `/assets/kitten.glb`
  and falls back to the stand-in, like `pigeonModel.js`.
- They use the existing enemy manager (`createTarantulas` in `src/enemies.js`),
  configured from the level's `enemies` block with `kind: 'kitten'`.
- Wander near home, notice the lizard within about 9 units, chase at a speed
  between the lizard's walk (5.5) and sprint (10) — about 6 — so walking does not
  escape a kitten but sprinting, climbing, hiding or the two special moves do.
  As with the other enemies, they cannot reach the lizard when it is 1.5 or more
  above the ground, and they give up when it gets far from their home.
- Touching a kitten costs a heart (a playful swat), with the existing knock-back
  and invulnerability.
- **Cannot be defeated.** Landing on a kitten just bounces the lizard off it;
  biting does nothing to it. In both cases the kitten is unharmed, and a toast
  points to the right moves ("Kittens don't mind! Try push-ups or drop your
  tail").

### Scare (push-ups)

- Uses the existing push-up action (E, or the 💪 touch button; needs the lizard
  on the ground and standing still).
- When the lizard has been doing push-ups for about 0.7 s (two bobs) and a kitten
  is within about 6 units, that kitten is scared: it turns, runs back to its home
  spot quickly, and ignores the lizard for about 12 seconds. Every kitten in
  range is scared at once.
- A kitten that reaches the lizard before the 0.7 s is up still swats it, which
  is the risk.
- Feedback: a toast ("Scared it off!"), a short sound, and the kitten visibly
  puffing up / jumping back before it runs.

Push-ups only scare kittens. Tarantulas and pigeons ignore them, so Levels 1 and
2 play as before.

### Tail drop

- New action: **Q** on the keyboard, a **Tail** touch button on tablets.
- The lizard's tail detaches and stays where it was dropped, wriggling, for about
  6 seconds. Any kitten within about 12 units goes for the tail instead of the
  lizard and bats at it until it stops, then goes back to wandering.
- While the tail is off, the lizard is drawn without a tail and the button/key
  does nothing. The tail grows back after about 30 seconds (visibly growing over
  the last few seconds). A small tail indicator beside the hearts shows whether
  the tail is ready or regrowing.
- Tail state resets (tail back on) on "Play again" and on respawn after losing
  all hearts.
- The tail drop is the lizard's own ability, so it is available on every level;
  tarantulas and pigeons are distracted by it the same way. (My call, see below.)

## UI and text

- Level picker: "3 · The Back Yard", with a short intro in the same voice as the
  other two levels, mentioning that kittens can't be beaten, only scared or
  fooled.
- Title picture for Level 3: reuse an existing title image until the art pass.
- The on-screen hint and the title-screen help lines become per-level. All levels
  mention Q / Tail for dropping the tail. Levels 1 and 2 keep "land on enemies /
  bite"; Level 3 instead says push-ups scare kittens and that they can't be
  beaten.
- Unlocking: winning Level 2 unlocks Level 3 as usual. Because the game has never
  recorded "Level 2 finished" (there was no next level to unlock), anyone who
  already has Level 2 unlocked also gets Level 3 unlocked, once, so the family
  does not have to replay Level 2 to see the yard.
- Level 2's win screen already announces the next level by name and unlocks it;
  Level 3's win screen is the "you finished every level" message.

## What's left to the builder

- Exact coordinates, sizes and colours of every prop, the yard's overall
  dimensions, and how the play-area boundary is enforced for a rectangular yard
  (the levels so far use a circular radius).
- How the enemy manager is generalised for "can't be defeated", "scared" and
  "distracted by the tail" (config flags vs. per-kind behaviour).
- How the lizard's tail is hidden and regrown on the rigged model and on the
  simple fallback lizard, and what the dropped tail looks like.
- Exact tuning numbers (ranges, speeds, timers) — the figures above are starting
  points to adjust by playtest.
- Sounds for scare and tail drop, using the existing synth helper in
  `src/audio.js`.

## Calls made by Claude (not explicitly decided by Mathew)

- The landmark list and which clutter is left out.
- Where the ten pebbles go.
- Five kittens; kitten speed between walk and sprint.
- Jumping on or biting a kitten does nothing but show a hint.
- Scare timing (0.7 s, 6 units, 12 s) and tail timings (6 s wriggle, 30 s regrow).
- Tail drop on Q / a "Tail" button, and available on all three levels.
- Reusing an existing title picture until the art pass.
- Push-ups scare kittens only, not tarantulas or pigeons.
- Level 3 opens straight away for anyone who already has Level 2 unlocked.
