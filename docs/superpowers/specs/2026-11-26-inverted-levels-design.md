# Inverted levels (replaces the portals)

Decided with Mathew on 2026-11-26.

## What changed

- The portals are gone. No level has one, and nothing in the game loop looks for one.
- There are twelve levels. The six regular ones come first (Desert, Giant Tarantula,
  Fullerton Shops, Peregrine Falcon, Back Yard, Mama Cat), then the same six again as
  inverted levels: Inverted Desert, Inverted Giant Tarantula, Inverted Fullerton Shops,
  Inverted Peregrine Falcon, Inverted Back Yard, Inverted Mama Cat.
- Beating Mama Cat unlocks the Inverted Desert. Saved progress needs no conversion: it is
  still "the highest level number open", and the first six numbers did not move.
- An inverted level is colour-flipped from start to finish. The lizard keeps its own
  colours. The small enemies and the boss are red and black.
- The menu has two rows: the regular levels, then "Inverted World". The numbering carries
  on: Level 4, Boss, Level 5, Boss, Level 6, Boss.

## How much harder ("clearly harder")

All of it is in `src/levels/inverted.js`, as multipliers on the regular numbers.

| | Regular | Inverted |
|---|---|---|
| Small enemies: chase speed | desert 3.8, pigeons 3.4, kittens 6 | 25% faster: 4.75, 4.25, 7.5 |
| Small enemies: how far they notice you | 8.5, 8, 9 | 25% further |
| Small enemies: how many | 6, 6, 5 | two more: 8, 8, 7 |
| Boss: landings to beat it | 6 | 8 |
| Boss: movement (walk, lunge, dive, stalk, trot) | | 20% faster |
| Boss: warning before an attack | | 15% shorter |
| Boss: time you can jump on its back (stuck, down, flopped, playing with the tail) | | 25% shorter |
| Boss: pauses between attacks (web cooldown, circling, pounce cooldown) | | 20% shorter |

The inverted falcon strikes three times (`RINGS: 3`, set in `src/levels/inverted.js`).
While it hovers, three red rings circle close round the lizard. When it dives they stop,
and it hits each ring in turn, hopping up between them. Only after the third is it down on
the ground. Standing still is caught; the dodge is to get out of the cluster and stay out
of the rings it has not hit yet. A dropped tail still gets one dive. (An earlier try the
same day, aiming ahead of a running lizard, was too tricky and was taken out.)

The inverted Mama Cat pounces twice from the start (`DOUBLE: true`): a missed pounce goes
straight into a second one before she flops. The regular Mama Cat only does that once she
is half tired out.

The lizard is unchanged (5 hearts, same speeds). Tarantulas and pigeons are still slower
than a walking lizard; kittens are still slower than a sprint.

## Pebbles

The three regular levels have ten new pebble places in their inverted version (listed
next to the regular ones in `desert.js`, `mall.js`, `yard.js`). The three boss arenas
keep their pebbles: those are easy on purpose, the fight is the level.

## How it is built

- `src/levels/index.js`: the six regular entries, then six copies marked `inverted: true`
  with their own name and story.
- A level's `build(scene, { inverted })` picks the pebble places. `main.js` then passes
  the world through `harder()` from `src/levels/inverted.js`, which returns harder
  `enemies` settings and a boss config with more health and a `tune` object.
- The falcon gained the same `tune` option the tarantula and Mama Cat already had.
  `src/boss.js` and `src/mamaCat.js` are untouched.
- `src/portal.js` became `src/flip.js` (the colour flip and the red-and-black skin, no
  ring). The boss is now red-skinned too, and the falcon's dive ring is kept red.
