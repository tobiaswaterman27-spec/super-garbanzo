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
- **Villagers talk to each other.** Two who end up near each other pair off,
  turn to face, and take turns speaking — mouth shapes only, the body stays
  still — nodding and laughing while they listen. The conversation runs its
  course and they part. Talking to either of them breaks it up.
- **Gestures only fire for a reason.** They wave at someone arriving and
  flinch at someone sprinting at them; nothing goes off at random. Gestures
  and mouths are the only things besides blinking that move a standing
  character.
- **A body going down at speed takes out whoever it lands on**, and those
  villagers can bring down others in turn.
- Idle characters hold perfectly still. The only things that move are eyes
  (random blinks, sometimes a double) and mouth shapes driven by whichever
  letter is currently being revealed.
- A pose editor: 10 joints x 3 axes, keyframe capture and looping playback.
- Villagers generated at random, with names, hair and facial hair chosen
  according to sex.
- Walk up to a villager and press E, Enter or Space: they turn to face you, or step
  closer first, then a three-page text box opens. Repeatable.

### The watch

- **A guard is unmistakably a guard**: one fixed livery — dark tunic, madder
  surcoat with the town's device, a mail collar and a kettle hat with a brass
  finial. You can tell one at ten pixels, before you can see a face or a
  weapon. Everyone else is drawn from the same random palette as always.
- **On duty they are labelled.** A guard who is actually working carries his
  name over his head with `TOWN WATCH` above it in brass, drawn in a 3x5 face
  built by hand for the purpose — Press Start 2P turns to porridge below eight
  pixels. Off duty he is just somebody in the street and gets nothing.
- **Three of them, in the whole parish.** A small place has a handful of men,
  not a garrison. Six turned every incident into a crowd and made fetching one
  pointless — there was always another round the corner.
- **The watch has to be told.** A guard acts on what he sees himself. Anybody
  else who sees a crime panics for a beat, then runs — flat out, the one
  errand a villager sprints for — to the nearest guard and points back at
  where it happened. That run is time you can use: from a killing to the first
  man moving is several seconds, not none.
- **News is a thing people hold and hand on.** Whoever knows about a crime
  tells whoever they end up next to, and that person carries it too. One
  mechanism covers a baker telling a baker, a baker telling a watchman and a
  watchman calling another watchman; the only differences are how far the
  voice carries and what the listener does about it. Each incident has an id,
  so a piece of news goes round a village without coming back to the person
  who started it and nobody is frightened by the same thing twice.
  Knowing a thing is deliberately separate from having somewhere to take it —
  a witness who cannot find a guard keeps the news and hands it on when they
  finally meet someone, which is what makes the relay work across a map with
  three guards on it.
- **The hue and cry.** A watchman who wants the rest of the watch does not
  walk over and mention it, he shouts, and that carries across a village
  rather than across a conversation. He does it when the thing is actually
  serious — somebody the watch is prepared to kill, or somebody armed, or when
  he is already bleeding from them — and otherwise gets on with it himself.
  Otherwise three men spread over a parish are three men, not a watch.
- **They arrive in ones**, not as a block. Each guard has his own reaction
  time, rolled once, so the same man is always the quick one, and news
  arriving second-hand takes longer to act on than seeing it yourself.
- **One man runs you down; the rest cut you off.** Roles are handed out by who
  is best placed — the runner is whoever is already behind you — and the
  stations are *kept*, because reshuffling them every time the pecking order
  changed was what put the whole watch in one knot. Stations are also balanced
  across the two sides: a cordon with both men on the same side is not a
  cordon, so a crowded side costs more than a walk across. Flankers run at
  where you are going rather than where you are, hold their post once they
  reach it, and close only when the runner has actually stopped you or you
  walk into them. Stand still and they form a ring around you rather than a
  scrum.
- Guards are quicker than villagers at a walk, and only *just* quicker than a
  sprinting player. They used to be half again as fast, which made them
  unloseable and made everything tactical they did pointless: a man who can
  run you down never needs to cut anyone off.
- **They do not want help.** A villager who wades in on the watch's behalf is
  told to get back, once, and goes — and having been told, he does not rejoin
  the moment the next blow lands.
- Response is still graded: below a wanted level of 45 they put the weapon
  away and restrain you, and stop the moment you are down.

### Getting hurt by the world

- Running flat out into a trunk puts you on the floor **and hurts you**,
  through the same wound machinery as a sword — there is no second kind of
  health. So does being thrown from a horse, and so does a cart coming apart
  under you. NPCs take it on the same terms.
- Every blow a cart takes is shared with whoever is riding on it. A cart has
  no suspension; the people on the boards are thrown against it.
- A cart that breaks now turfs out its passengers as well as its driver.
  Leaving them attached to a vehicle that no longer exists had them riding an
  invisible wreck around the county.
- **Passengers get off a cart they do not like the look of**: a stranger at
  the reins, unless they have met you and your name is worth something; or
  themselves bleeding; or the cart itself taking damage. Above a walking pace
  they jump rather than wait, and land badly.

### Carrying a weapon

Measured against the rig, the hand sits about eleven units off the ground and
every weapon but the dagger is longer than that — a sword reached five units
into the turf, a poleaxe thirteen. Nothing clipped, because a character is
drawn whole into its own sprite and blitted at the feet, so the point simply
hung in front of the grass looking like it ought to be buried in it.

So weapons are now carried, and how far each one has to come up is measured
off its own mesh rather than listed in a table:

- short enough to hang (a dagger) — it hangs;
- too long for that — the elbow comes up and it rides forward across the leg;
- too long for *that* (sword, spear, greatsword, poleaxe) — it is turned over
  in the hand and stood up, butt by the hip and point above the shoulder.

A bow is never stood up: turning it over would put the top limb through the
ground instead of the bottom one, so it rides forward like the rest. The
ready stance still levels a short weapon at you, but a pole gets stood up
there too, because twenty-four units of poleaxe held at chest height goes
straight through whoever is beside you.

### Going down

**Dead is limp; everything short of it is not.** The verlet ragdoll is for
being run over by a horse — it is the right answer when a body has stopped
and has no business holding a pose. A person who has been knocked down but
is still alive goes down the way they were *hit*: folding at the knees,
landing on their back, lying there a while, and getting themselves up again.
None of that is something a solver can be asked for. A simulation can be
told to drop somebody; it cannot be told to land them on their back looking
winded.

So a collapse is posed. The whole model tips at the root — which is at the
feet — so the body swings down about the ankles the way a person actually
goes over, and which way it tips is the direction of the blow in the
victim's own frame. Punched in the face, they go backwards. It runs in three
phases: the fall on the 30fps action clock, lying there on the slow 12fps
one (a body on the floor has nothing quick to do), and the get-up, which
rolls them onto an elbow and puts a knee under them. The last third of the
fall eases into the pose they will be lying in, so the frame the shoulders
hit the ground is the frame the lying pose starts from.

`Rig.isDown` covers both, because every other system in the game means "on
the floor" by it. Only the code that drives them asks which.

### What the watch will do about it

The response is graded, and the grade is the crime's, not the wanted bar's:

| What you did | What happens |
| --- | --- |
| Walk into somebody | Nothing. It is not a crime and nobody minds. |
| Barge them off their feet | Their business, not the watch's. They may well come over and hit you — and then go back to their day. |
| Ride somebody down | A guard comes with his hands, or puts the sword away first. |
| Theft | They come after you, and they will hurt you badly. A bowman will shoot you down if you run. |
| Wounding | The same. |
| Murder | They are trying to kill you. |

Three things feed the decision and the worst one wins: what you have just
been seen doing, **what the parish already knows you for**, and whether you
have put this particular guard on the floor. A shove by a man with seven
murders behind him is answered as murder; a shove by a man with two thefts
behind him is still a shove. Only what was *witnessed* goes on your record —
a crime nobody saw leaves your name alone.

Force also caps damage, which is the part that makes the ladder real rather
than decorative. Stopping when you are beaten is not enough on its own,
because the blow that beats you is the blow that might finish you: a sword
landing on a man at a quarter health takes him straight past it. So a guard
who came to arrest you cannot take you below 26, one who came to subdue you
cannot take you below 9, and neither can leave you bleeding hard enough to
die of it afterwards. Only a guard who has decided on killing you is allowed
to. Bare hands have the same cap for the same reason: **sixty punches and two
minutes of bleeding killed 0 of 300**, and left every one of them at about
twelve health and in no state to argue. A dagger still kills 200 of 200, so
the cap has not defanged anything that was supposed to be dangerous.

Villagers never kill. They break off the moment the other is on the floor or
plainly finished — frightened and angry, not murderers. Nobody knowing when
to stop was the single thing turning every scuffle in this village into a
funeral.

### Fights

- **A punch starts a fight, not a rout.** Somebody punched by somebody who
  is also unarmed squares up, because that is what a brawl is — it is steel
  that makes running the sensible answer. This one term is the biggest
  reason a village used to scatter from a shoving match.
- **Fists mark before they cut.** Bare-handed damage accumulates as bruising;
  past a threshold the skin goes and the next punch draws blood. A fist
  fight that never produces any is a pillow fight.
- Being hit badly enough puts them on the floor bleeding, and the bleeding
  goes on taking hp while they are down there.
- **People check on the fallen.** Anyone who passes somebody lying in the
  road who is not dead comes over, stops short, and stoops over them — and
  stays stooped until they get up or the onlooker loses interest. Guards do
  it too. Nobody does it while whoever put them there is still standing over
  them.

### Wounds

What a wound looks like is decided by what made it, not by how much damage
it did:

| Kind | Shape |
| --- | --- |
| `edged` | A slash, laid along the line the edge travelled, length scaling with the weapon. It runs. |
| `pierce` | A small deep hole. Barely wider than the blade, and it runs hard, because a puncture does. |
| `blunt` | A bruise: broad, flat, no run at all, and it changes colour over the days rather than shrinking. |

The swing direction matters and is passed through from the animation, so a
horizontal slash leaves a belt across the chest and an overhead leaves one
down it. Without it every cut sits at a random angle and three of them read
as a rash rather than as three sword blows. An arrow leaves the shaft in
them, built as a stepped stack so it slopes down and out — one aimed exactly
along the view axis projects to about two pixels and reads as a smudge.

Wounds are placed on the **surface** of the body, on the face the blow came
from. Placing one at some fraction of the body's depth puts it inside the
body, and since the torso is wearing a tunic over that, it is invisible —
which is exactly what had been happening: every cut in the game was being
drawn under somebody's shirt. A limb wound also goes on the limb the blow
actually reached; the zone table names the right arm because it has to name
one, but a sword coming in from somebody's left does not land on their
right.

**Wounds heal over days.** Each day one closes a little, its blood dries and
stops running, and when there is nothing left of it, it goes — a bruise in
about four days, a cut in a fortnight, a deep puncture rather longer. A
bruise passes through its colours on the way out rather than just fading.

*There is no clock yet.* All of it is driven by `World.advanceDay`, which
nothing calls on a timer. When the world grows a day, that is the one line
that has to be hooked up to it.

### Reactions to the dead

- Come across a body with the killer still standing over it and people run, or
  shout for the watch, and somebody goes to fetch it.
- Come across one with nobody about and they walk over, stop short of it, and
  bow their heads. Nothing useful happens; that is the point of it.
- Fleeing villagers now flail their arms, and witnesses point at what they
  saw. Both are **overlay** gestures — they play on top of a walk or a run
  rather than instead of it, which is the only way fear reads on someone who
  is moving.

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` / arrows | Move |
| Double-tap any direction | Toggle sprint |
| `E` / `Enter` / `Space` | Talk to a nearby villager, and turn the page |
| `Q` / `I` / `Tab` | Open the bag |
| Move the mouse | Aim |
| Click | Swing, turn the page, move a stack around the bag |

Double-taps are tracked per direction, and WASD and the arrows share those
directions — so `W` then `Up` counts, while swinging from `W` to `D` around a
corner does not.

### On a touchscreen

An overlay appears over the viewport the first time something without a mouse
touches it, or straight away when the browser reports a coarse pointer. It is
sized against the viewport rather than the screen, because the world is a
letterbox on a handset held upright and a stick measured in `vmin` ended up
half as tall as the picture under it.

| Control | Action |
| --- | --- |
| Stick, bottom left | Move. Walking clears the aim, so you face where you are going again |
| `RUN` | Toggle sprint. Unlike the double-tap it latches, so standing still does not un-press it |
| `E` | The `E` key: talk, mount, hitch, open a chest, pick something up, turn the page |
| `BAG` | Open and close the bag |
| `HIT` | Press to take aim, drag to point it, let go to swing or loose |

With the bag open the overlay steps aside and only `BAG` stays, so nothing
sits over a slot a thumb is reaching for. Inside the bag a press and drag
carries a stack to wherever you let go, and a plain tap lifts it and leaves it
on your fingertip for a second tap — the same two ways a mouse can do it.
Taps on the world itself are swallowed rather than acted on: a fumbled thumb
should not swing an axe in a market square.

## The swings

Every attack pose was too polite: the limb moved a little, the body did not
move at all, and the legs never moved once, which is why they read as a
mannequin being adjusted rather than as a person hitting something.

A human blow is not made by the arm. It starts at the feet, turns at the
hips, and arrives at the hand last, and the eye reads that order. So each one
now has four things it lacked:

- **anticipation** — the windup goes the opposite way from the strike, far
  enough to be its own silhouette;
- **a driving torso** — the twist leads the arm and reverses through the blow;
- **a committed stance** — the legs step, lunge or brace;
- **follow-through** — the limb carries past the target before it settles.

The timing is two curves: eased into the windup, then `snap` — fast out of
the gate and decelerating — through contact, which is what makes a blow
*land* rather than arrive.

And the blow now lands when it looks like it lands. Every `hit` fraction had
been set to the moment the strike *begins*, so the damage fired with the fist
still chambered and the blade still behind the shoulder; they are now set to
contact, in the middle of the limb's travel.

A bow is held in the **bow hand**, not the drawing hand, and turned across
the wrist so its limbs stand vertical. It had been hanging off the drawing
arm, lying flat across the body like a plank.

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
the limbs collide with the ground on the way through. The sequence starts from
**however the body actually landed**: the lie of the pelvis-to-chest axis is
measured and the whole body rights itself from there, because targeting an
upright pose from frame one is exactly what a teleport looks like.

Hands and elbows are kept outside a capsule around the spine, or the distance
constraints will happily swing an arm straight through the chest. A new impulse at any
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
