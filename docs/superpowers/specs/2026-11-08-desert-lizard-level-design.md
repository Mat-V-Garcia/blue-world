# Desert Level — Western Fence Lizard (design)

## Goal
A browser 3D game in the cosy, chunky style of Little Kitty Big City. Player is a
**western fence lizard**. Level 1: a desert. Win by collecting **10 golden pebbles**.

## Hero: western fence lizard
- Stylised low-poly, built from primitives in code.
- Grey-brown body with dark wavy chevron bars down the back, spiky/keeled scale
  ridge, **bright blue belly patches** and blue throat, yellow-orange under the legs.
- Signature move: **push-ups** (E key) — the real fence lizard display. Leg walk
  cycle, tail sway.

## Look
- Soft toon shading, warm low sun, soft shadows, distance haze.
- Magnific (personal folder) assets saved to `assets/`: sky panorama, tileable sand
  and red-rock textures, pebble/UI art, title art, lizard concept.

## Level
- ~200x200 m dunes ringed by mesas. Cacti, rock arches, dry riverbed, old wagon,
  wooden fence lines (fence lizard!), tumbleweeds.
- 10 spinning, sparkling golden pebbles: some visible, some on rocks/fences/under arches.

## Controls
WASD move, mouse orbit camera (pointer lock), Shift sprint, Space jump, E push-ups.
Lizard can climb steep rock faces and fence posts.

## UI
Pebble counter 0/10, pickup chime + sparkle burst, win screen with time, title screen.

## Tech
Vite + Three.js, plain JS modules: `world`, `lizard`, `controls`, `pebbles`, `ui`.
Verified by playtesting in the in-app browser.

## Out of scope (v1)
NPCs, music, save system, further levels.
