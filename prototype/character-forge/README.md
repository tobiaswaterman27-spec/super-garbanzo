# Character Forge

The character creator and NPC prototype for the medieval simulation RPG.

Open `index.html` in a browser. No build step, no dependencies.

For a single file you can hand to someone — no server, works offline — run
`node prototype/character-forge/build.js`, which inlines every script into
`dist/character-forge.html`. Re-run it after changing anything here.

## Why it looks the way it does

Characters are **real 3D models rendered down to pixels**, not hand-drawn sprite
sheets. `render.js` is a small orthographic software rasteriser with a z-buffer.
That is what makes a character correct from all eight facing directions, and
turning a genuine rotation rather than a sprite swap.

They are not limited to boxes. `geometry.js` builds general convex meshes, so a
spike is a pyramid, a beard hangs and tapers to a point, and a skull is a
superellipsoid rather than a cube — a hard-edged box head was the single biggest
reason these characters read as wrong.

Two rules do the heavy lifting on top of that, and both are load-bearing:

**Everything is quantised.** Poses are sampled at 12fps and facing is snapped to
16 discrete angles before rendering. Without this the model rotates and breathes
by fractions of a pixel every frame, so every box edge flickers between two
pixel columns at 60Hz — the whole model appears to crawl. Real sprite work runs
at 8-12fps with a fixed set of facing angles; this applies the same discipline to
a model that is genuinely 3D underneath. A side benefit: if neither the pose
clock nor the facing angle changed, the actor's buffer is reused untouched.

**Faces are shaded by orientation, not by a light vector.** A plain lambert dot
product gives two perpendicular faces the same value whenever they sit at equal
angles to the light — so a box's front and its left side would render in the
same colour and the form went flat. Shading instead bands by which way a face
points on screen, across five steps, which makes that impossible. There is a
test for it: no two co-visible perpendicular faces may ever share a step.

## Files

| File | Responsibility |
| --- | --- |
| `geometry.js` | Mesh primitives: box, taper, pyramid, wedge, superellipsoid, dome |
| `render.js` | Matrices, rasteriser, z-buffer, outline pass, canvas presenter |
| `parts.js` | Palettes, 15 hairstyles, 8 facial-hair styles, feature shapes, name pools |
| `character.js` | The character record, randomisation, the bone tree, the face |
| `rig.js` | Poses, the idle/walk/run/talk cycles, blinking, turning, actors |
| `font.js` | Crisp pixel text (glyphs thresholded to 1-bit masks and cached) |
| `dialogue.js` | The paged text box, typewriter reveal, bobbing arrow |
| `world.js` | Ground, props, the villager brain, click-to-talk |
| `app.js` | Editor UI, preview stage, world mode |
| `build.js` | Inlines all of the above into `dist/character-forge.html` |

## What is implemented

- Character creator: name (15 characters max), sex, skin, hair style and colour,
  **moustache and beard as separate choices**, eye colour and shape, brow, nose,
  mouth width, height, frame, garment and three clothing colours.
- Movement with momentum: input steers a velocity, friction bleeds it off, and
  reversing at speed costs control and makes you skid instead of pivoting.
- Sprint by double-tapping any direction. Double-tap again, or come to a
  stop, to drop back to a walk.
- Trees, rocks, barrels and the cart are solid. Hitting one kills your inward
  velocity, bleeds the rest and staggers you if you were moving fast.
- Collisions are answered mostly by **moving the body**, not by waving its
  limbs about. A person rooted to the spot flapping reads as a flail however
  the limbs are tuned; a person shoved aside reads as a collision. Walk into
  a villager and they step aside; jog into them and they stumble several
  paces away; hit them flat out and they go over.
- **Ragdoll physics only ever run at full throttle.** Below that a collision
  is answered by moving the body and swinging the arms. Two strengths:
  - **Jostle** — any contact above a walking pace. An arms-only reaction:
    everything from the shoulders inward is pinned exactly to the animated
    pose, so a knock never moves a character's legs or neck. Letting the torso
    join in is what kept reading as a flail.
  - **Fall** — a flat-out run into a tree, and nothing else.
- Between those, the body is simply moved: clipping a trunk at speed spins you
  off it, something knee-high gives a short stumble and you pull up at it, and
  a villager you charge stumbles several paces away.
- A character going down is limp — the arms flail rather than being driven.
- Idle villagers pick **gestures** now — waving at a neighbour, flinching from
  someone sprinting at them, laughing, pondering, carrying something. These
  are the only thing besides eyes and mouth that moves a standing character,
  and they read as intent rather than as drift.
- Idle characters hold perfectly still. The only things that move are eyes
  (random blinks, sometimes a double) and mouth shapes driven by whichever
  letter is currently being revealed.
- A pose editor: 10 joints x 3 axes, keyframe capture and looping playback.
- Villagers generated at random, with names, hair and facial hair chosen
  according to sex.
- Walk up to a villager and press E, Enter or Space: they turn to face you, or step
  closer first, then a three-page text box opens. Repeatable.

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` / arrows | Move |
| Double-tap any direction | Toggle sprint |
| `E` / `Enter` / `Space` | Talk to a nearby villager, and turn the page |
| Click | Turn the page |

Double-taps are tracked per direction, and WASD and the arrows share those
directions — so `W` then `Up` counts, while swinging from `W` to `D` around a
corner does not.

## Conventions worth knowing before editing

- **Facing.** Yaw 0 faces the camera (south) and grows clockwise on screen, so
  east is `+pi/2`. `Rig.DIRECTIONS` is ordered by increasing yaw.
- **Joint rotations.** On a limb, `rot[0]` positive swings it *backward*. On the
  torso, positive leans *forward*.
- **Model space.** 1 unit is about 1 pixel at scale 1. A character is roughly
  32.5 units tall. The head bone's origin sits at the neck, and the skull
  occupies `y 0..8`, `z -3.7..3.7`, with `+Z` as the face - hair and beards are
  written against that box so they scale with the skull.
- **Randomness is seeded.** `CharacterModel.makeRng(seed)` everywhere, so a
  given seed always rebuilds the same village.
- **Cloth is laid over a whole limb, never used to build one.** Making the
  forearm out of a sleeve piece plus a skin piece left a bare band where
  neither reached the elbow. The arm is always built full length in skin and
  the sleeve goes on top of it.
- **Every bending joint needs a ball.** A tapered limb capped with a flat face
  opens a wedge-shaped hole the moment the joint bends, which is why the
  characters had no elbows. There are spheres at the shoulder, elbow, hip and
  knee.
- **Hair must be one connected mass.** Every piece of a hairstyle has to overlap
  at least one other on all three axes, or a seam opens up around the skull once
  the head rotates. There is a test for this.
- **The crown is concentric with the skull.** It is a dome: the same
  superellipsoid as the head, grown slightly and sliced off at the hairline
  (`Geo.dome`). Sitting a separate rounded lump on top of the head instead makes
  every character look like they are wearing a mushroom.
- **The camera is locked to the player.** To keep it there without ever showing
  the edge of the generated ground, the player is confined to the world inset by
  exactly half a viewport — no further, or blank bands appear at the screen
  edge. Villagers roam the whole map.
- **The world camera is the forge camera, halved.** Same pitch, half the scale,
  so a villager is the preview model sized down rather than a differently
  proportioned one.

## The ragdoll

Sixteen verlet particles joined by 27 distance constraints, falling under
gravity onto a ground plane at y = 0, solved with 8 relaxation iterations per
120Hz substep. Limbs swing and settle independently.

It is seeded from wherever the character actually was: `jointPositions()` walks
the posed bone tree and reads the joints off it, so the ragdoll starts in the
pose the character was standing in. The push impulse scales with each
particle's height, so the feet barely move and the shoulders take the hit —
that is what makes a body topple rather than slide.

Rendering runs the other way. `segmentMatrix()` builds a bone transform that
runs between two particles, with the shoulder line pinning the roll so knees
and elbows keep pointing somewhere sensible. The simulation is re-centred on
the pelvis each frame and the drift handed back to the actor's world position,
so a body that tumbles actually travels across the ground.

Getting up is animated rather than interpolated: the ragdoll is hauled through
a series of get-up poses — face down with the arms planted, hips pushed up,
onto a knee, then standing — while the physics keeps running underneath, so
the limbs collide with the ground on the way through. A new impulse at any
point, recovery included, puts them straight back down.

A jostle is the same solver with the lower body pinned: the feet, hips and
knees are dragged hard onto the animated pose each frame while the chest, arms
and head are left loose. The body reacts and settles in under a second and
cannot topple. A trip releases that lower-body grip for a moment first, which
is the difference between a stumble and a wobble.

Control is handed back only once **every joint is within a fifth of a unit of
the animated pose**, never on a timer. Cutting over on the clock leaves the
body wherever the physics happened to put it, and the model jumps — that is
what the teleport was. The last of the distance is closed with gravity out of
the picture and the motion damped, so it always converges: measured, the
remaining jump at hand-over is under half a pixel.

## Not done yet

Pronoun selection (the sex field is deliberately separate from it), genetics and
inheritance, buildings, and anything to do with the simulation itself.
