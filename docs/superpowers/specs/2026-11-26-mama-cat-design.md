# Mama Cat boss — design

## Intent

The third boss should read as the kittens' mother: a grown cat, clearly bigger than
today's boss, with adult proportions, who fights like a cat. Today it is the kitten model
scaled 2.2x on the tarantula's rules (walk, lunge, get stuck, shoot a blob), so it looks
like a giant kitten and plays like the spider.

## Goals

- A new rigged adult-cat model, used for the boss only, about 6.5 units long (today 4.4;
  the lizard is 1.6).
- Her own fight rules, built on cat behaviour: stalk, paw swipe, pounce, fishing under
  furniture, playing with a dropped tail.
- The lizard still wins by landing on her back six times. The openings come from her
  behaviour: the flop after a missed pounce, and while she plays with the tail.
- The boss is called "Mama Cat" in the level name, intro, hints and messages.

## Non-goals

- No change to the tarantula or falcon fights, the yard kittens or the Back Yard level.
- No new title picture in this pass.

## Anti-goals

- She must not look scary or get hurt. She is playing, and ends up asleep.
- No hairballs or any other shot. That is the spider's web under another name.
- No spot in the yard where the lizard wins without dodging anything.

## Approaches

Model:
1. **New Magnific model (picked by Mathew).** Side-view picture of an adult orange cat
   (65 credits), then Image to 3D with "Rig for animation" (about 1,035 credits).
2. Reshape the kitten model in code. Free, but still a stretched kitten with no hind legs.
3. Scale the kitten up only. Bigger, not older.

How the lizard wins:
1. Tire her out with no back-landing; a sleepiness bar fills as she misses.
2. **Keep the back-landing, with cat-made openings (picked by Mathew).**

Code:
1. **A new rules file `src/mamaCat.js` (my call).** It has the same outside shape as the
   tarantula and falcon bosses, so `main.js` drives it the same way. The tarantula's
   `boss.js` loses its cat options and stays the spider's.
2. More options on `boss.js`. Rejected: the two fights no longer share moves.

## The fight

She arrives as today: the tenth pebble brings her over the fence.

| Move | What she does | The tell | How the lizard answers |
|------|---------------|----------|------------------------|
| Stalk | Circles the lizard low and slow, closing in, tail twitching | — | Keep moving |
| Paw swipe | Close up, sweeps a paw across the ground in front of her | Lifts the paw and holds it (about 0.6 s) | Back out of reach, or jump over it |
| Pounce | From mid range, leaps in a high arc to where the lizard was | Crouches and wiggles (about 0.9 s); her shadow marks the landing spot | Run out from under the shadow |
| Flop | A missed pounce skids and she rolls on her side for about 2 s | — | **Jump on her back: one hit** |
| Tail play | A dropped tail in range: she trots over and bats it for about 3 s | — | **Jump on her back: one hit.** The tail's own regrow time limits this |
| Fishing | The lizard hides under furniture: she lies down and sweeps a paw underneath | Paw pulls back before each sweep | Leave, or get batted out after about 3 s |
| Sleepy | Below half health she yawns between moves and pounces twice in a row | Yawn | Dodge both; the second flop is the opening |
| Asleep | Sixth hit: she curls up where she is and naps under the sunset | — | Win |

Rules that hold throughout:

- A swipe or a pounce landing on the lizard costs a heart and knocks it back, as a catch
  does today. So does walking into her while she is on her feet.
- Landing on her back while she is on her feet bounces the lizard off with the "wait"
  message, as today.
- A lizard perched somewhere she can't reach is safe but gains nothing: she sits below
  and waits. A low perch (within her reach standing up) gets swiped.
- After each hit she shakes it off for about 1.5 s and can't be hit again.
- Push-ups do not scare her.

## How

- Art goes in Magnific's Personal project. Source file `art/magnific/mama-cat-rigged.glb`,
  game file `public/assets/mamacat.glb`. Ask before each download.
- `src/mamaCatModel.js`: `loadMamaCatModel()` returns a maker of
  `{ root, update(dt, speed, state) }`. Inspect the skeleton first and pose what it has.
  If the model fails to load, the boss falls back to the kitten model.
- `src/mamaCat.js`: `createMamaCat(scene, colliders, makeModel, cfg)` with the same
  `pos, yaw, health, maxHealth, state, bodyR, reset(), emerge(), baitWith(pos),
  update(dt, player, canHurt)` and the same event names the game already reads
  (`caught, hit, bounced, defeated, stuckNow, windupNow`). A landing-spot shadow like the
  falcon's.
- `src/main.js` picks `createMamaCat` for `kind: 'cat'`, plays a meow on each tell, and
  drops the hairball handling for the cat.
- `src/levels/cat.js`: new scale and numbers; hairball settings removed.
- `src/boss.js`: the cat-only options (`sleeps`, `emergeFrom`, `shotColor`) come out, with
  their tests.
- `src/levels/index.js` and the boss text: "Big Cat" becomes "Mama Cat", and the hints
  describe the new moves.
- Tests in `tests/mamaCat.test.mjs`, written first, one per rule in the table.

## Left to the builder (my calls)

- Exact scale, reach, timings and radii, measured from the finished model. The flopped
  back must stay within the lizard's jump (about 1.3 units).
- Coat: orange, from the model's own texture (no tint unless it comes out pale).
- How each move is posed on the new skeleton.
- Sleepy makes her wilder, not weaker: flop time stays the same all fight.

## Checks

- `npm test` passes.
- In the browser: she drops over the fence, stalks, swipes, pounces and flops, fishes
  under the gazebo table, plays with a dropped tail, can be landed on six times, and
  falls asleep.
