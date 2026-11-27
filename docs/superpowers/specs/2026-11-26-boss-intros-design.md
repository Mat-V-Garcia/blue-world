# Boss intros — design

## Intent

Today a boss just appears when the tenth pebble is picked up: a line of text, a sound and
its health bar. Each boss should get a proper entrance, a short "here it comes" moment
that shows the boss arriving and says who it is, before the fight begins.

## What Mathew chose (2026-11-26)

- **In-game cutscene**, not generated video files.
- It plays **at the tenth pebble**, the moment the boss comes out.
- It plays **every time** the boss comes out, and can always be **skipped**.

## Approaches considered

1. **In-game cutscene (chosen).** The game's own camera leaves the lizard, shows the boss
   arriving with the boss's own arrival animation, and comes back. No files to download,
   no Magnific credits, and the inverted levels show the real red-and-black boss in the
   flipped world with no extra work.
2. **Magnific video clips** played full screen. More cinematic, but costs credits per
   clip, the boss would not match the in-game model, the files are heavy on a phone, and
   an inverted clip could only be a colour-flipped copy.
3. **Both.** The most work, and still costs credits.

## Design

- Picking up the tenth pebble on a boss level stops the action for about five seconds.
  The lizard cannot be steered and nothing can hurt it.
- Black movie bars slide in and the usual counters fade out. The existing line of text
  ("The ground is shaking…") stays as the opening line.
- The camera glides (about a second) to a low spot near where the boss arrives, on the
  lizard's side of it, looking at the boss:
  - **Giant Tarantula:** the sand puffs and it climbs out of the ground.
  - **Peregrine Falcon:** looking up at the clock tower as it screeches and takes off.
  - **Mama Cat:** she drops in over the fence and lands on the path. Nothing frightening:
    her line says she only wants to play.
- The boss's name appears in big letters with one line under it. The inverted bosses use
  the level's own name ("Inverted Giant Tarantula") and a line about what is new: the red
  falcon's three strikes, Mama Cat pouncing twice.
- The camera glides back behind the lizard, now turned to face the boss, and the fight
  starts. The lizard gets a short moment of safety (it blinks, as after a hit).
- **Skip:** a Skip button on screen (for phones and tablets), or Space, Enter or a mouse
  click. Skipping goes straight to the fight exactly as the game works today.

## Non-goals

- No change to how any boss fights.
- No new art, sound files or video files.
- No "seen it already" memory: it plays every time, and Skip is the way past it.

## Anti-goals

- The boss must never hurt the lizard, or start an attack, while the intro is playing.
- Mama Cat must not look menacing or be shown being harmed.

## Calls made while building (mine, not Mathew's)

- About 5 seconds long.
- The same camera move for regular and inverted; only the words differ.
- Skip ignores presses in the first half second, so a jump held from grabbing the last
  pebble does not skip it by accident.
- The words and camera numbers live in one new file, `src/bossIntro.js`.
