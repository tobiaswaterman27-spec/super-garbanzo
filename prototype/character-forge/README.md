# Character Forge

The character creator and NPC prototype for the medieval simulation RPG.

Open `index.html` in a browser. No build step, no dependencies.

For a single file you can hand to someone — no server, works offline — run
`node prototype/character-forge/build.js`, which inlines every script into
`dist/character-forge.html`. Re-run it after changing anything here.

## Why it looks the way it does

Characters are **real 3D box models rendered down to pixels**, not hand-drawn
sprite sheets. `render.js` is a small orthographic software rasteriser with a
z-buffer. That is what makes a character correct from all eight facing
directions, and turning a genuine rotation rather than a sprite swap.

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
- Sprint by double-tapping forward. Double-tap again, or come to a stop, to
  drop back to a walk.
- Trees, rocks, barrels and the cart are solid. Hitting one kills your inward
  velocity, bleeds the rest and staggers you if you were moving fast.
- Sprint into a villager and they go down: a rigid-body tip driven by angular
  velocity and gravity torque, with a randomised sprawl, a ground bounce, a
  pause and then a spring back to their feet. They can be knocked down again
  mid-recovery. The player recoils and loses most of their momentum too.
- Breathing on idle, random blinking every few seconds (sometimes a double
  blink), mouth shapes driven by the letter currently being revealed.
- A pose editor: 10 joints x 3 axes, keyframe capture and looping playback.
- Villagers generated at random, with names, hair and facial hair chosen
  according to sex.
- Walk up to a villager and press E or Enter: they turn to face you, or step
  closer first, then a three-page text box opens. Repeatable.

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` / arrows | Move |
| Double-tap `W` / `Up` | Toggle sprint |
| `E` / `Enter` | Talk to a nearby villager, and turn the page |
| Click | Turn the page |

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
- **Hair must be one connected mass.** Every box in a hairstyle has to overlap
  at least one other box on all three axes, or a seam opens up around the skull
  once the head rotates. There is a test for this.
- **The camera is locked to the player.** To keep it there without ever showing
  the edge of the generated ground, the player is confined to the world inset by
  half a viewport. Villagers roam the whole map.

## Known limits

The knockdown is a **rigid-body tip, not a true ragdoll**: the whole figure
rotates about the feet under angular velocity and gravity, and the limbs take a
randomised sprawl pose rather than simulating as independent jointed bodies. It
reads well in motion and costs almost nothing, but it is not articulated physics.

## Not done yet

Pronoun selection (the sex field is deliberately separate from it), genetics and
inheritance, buildings, and anything to do with the simulation itself.
