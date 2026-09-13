# Character Forge

The character creator and NPC prototype for the medieval simulation RPG.

Open `index.html` in a browser. No build step, no dependencies.

## Why it looks the way it does

Characters are **real 3D box models rendered down to pixels**, not hand-drawn
sprite sheets. `render.js` is a small orthographic software rasteriser with a
z-buffer; lighting is quantised to a three-step ramp and the silhouette is
traced afterwards. That is what makes a character correct from all eight facing
directions, and turning a genuine rotation rather than a sprite swap.

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

## What is implemented

- Character creator: name (15 characters max), sex, skin, hair style and colour,
  facial hair, eye colour and shape, brow, nose, mouth width, height, frame,
  garment and three clothing colours.
- Eight-direction movement with real turning animation, walk and run cycles.
- Breathing on idle, random blinking every few seconds (sometimes a double
  blink), mouth shapes driven by the letter currently being revealed.
- A pose editor: 10 joints x 3 axes, keyframe capture and looping playback.
- Villagers generated at random, with names, hair and facial hair chosen
  according to sex.
- Click a nearby villager: they turn to face you, or walk closer first, then a
  three-page text box opens. Repeatable.

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

## Not done yet

Pronoun selection (the sex field is deliberately separate from it), genetics and
inheritance, and anything to do with the simulation itself.
