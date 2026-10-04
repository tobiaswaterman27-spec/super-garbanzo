# Backlog, what the player has asked for (kept so nothing is forgotten)

## Batch A, build now (steps 57+)

- [x] Rough edges from step 55/56: reload puts you back where you saved (any region), no background hitches, no plain-colour ground popping in, town side-tracks that end in grass
- [x] Guards carry no light sources (remove the lanterns/glow on guards)
- [x] For-sale signs: drawn and collided properly (not drawn over things in front of them)
- [x] Little clickable signs (like Animal Crossing), on the other side of the path from the for-sale sign; buildings (not only plots) can be for sale too
- [x] Free roam everywhere: no camera cuts, no map edge except the island's coast
- [x] Player head cut off; revert the face/head to the second iteration (step 48 look)
- [x] You can attack anyone: people holding things, people with carts, any age
- [x] Sometimes you get stuck and can't move, fix
- [x] Redesign the old towns so each has everything it needs
- [x] Map icons: simple again
- [x] People travel between places: merchants, visitors, people moving home; travelling together; on horseback over long distances if they own a horse; an interlinked economy between towns
- [x] Beds only where people actually sleep
- [x] Tavern: innkeeper stands at the counter; you hire a bed by talking to the innkeeper at the counter (only there); a jobless spouse works the inn too, in shifts (counter / out); older children help and may be paid a little; someone goes upstairs every so often to check; the family can live upstairs if they can't afford a house; the tavern has a limited number of places downstairs and upstairs, when full, an NPC goes to the counter, is told it's full, and leaves
- [x] Sybil (tavern) changes from black/ginger to white/blonde, appearance flicker bug
- [x] No teleporting: people walk in through the door and walk out; NPCs collide with people, animals, rocks, trees, bushes, everything
- [x] Pots on floors belong in the kitchen
- [x] You can ask for work even when the person isn't on duty; they may refuse (reputation, whether they like you, how desperate they are, whether they need anyone); NPC employers hire by the same rules
- [x] Drinking ale (and eating/drinking in general) is an action with an animation
- [x] Food items can be placed (place-down animation, within a radius of where you want them); you and NPCs eat them with animations
- [x] Male and female hairstyles and clothes kept apart
- [x] More detailed inventory icons, even more detailed when placed in the world
- [x] NPC idle animations, sprinting, action animations
- [x] Doors: the door visibly opens when used; doors that look open must not say they're locked
- [x] Tavern tables: chairs evenly round each table (3+, not 2)
- [x] Map remade with all these buildings; nothing in water (a morgue was in the water); nowhere you can get stuck
- [x] Furniture: no oddly placed items; beds with the head against the wall; the unknown bed-like thing upstairs in the tavern
- [x] The weird tower in the place next to Ashford, remove or remodel
- [x] Check for glitches
- [x] Then say what should be added next, and ideas for jobs

## Batch B, LIST ONLY (do not build yet; "then we will make")

### The jobs list to write (docs/JOBS.md)
Every job and every level of it, royal family and titles included, grouped under its business/group. For each: name, rough average wage, average hours, where they work, whether they can live there, employer, who pays them, a sentence on what they do, other facts. Include gang jobs, landlords (renting out homes), people who sell homes. For each business: what it needs to work / to make (e.g. flour), and the new materials, places and jobs that produce them.

### Rules to remember for the jobs/working build
- Tax collectors go up to NPCs (and the player) and demand money, sprinting to them; refusers go to jail via guards. Tax applies to the player only if they have a house or a current job.
- Landlords do the same for rent.
- People can travel long distances on horses if they own any.
- Rich people can have farmers, stables and stablehands round their castle/estate.
- Business fund: the owner sets money aside; every worker on shift can use it; the owner has access 24/7 and can top it up. Workers buy what's needed with it, bring it back, make things or sell them.
- Merchants / people with goods travel to places that need them, go to the counter and offer to sell; the business may refuse.
- Business deals: e.g. "come every Sunday with X, I'll pay Y a month"; or ad-hoc selling.
- More materials, with the places and jobs that make them.
- Player jobs: when hired you do the job's tasks, fetching materials, staying and making things as orders come in. Things take time; you tend other things meanwhile (fires die down and need firewood from the shop; pots over fires on counters to put food in to cook). More items for places to sell. Tavern: cooking, or taking orders (a separate job; one job may combine both).
- Orders and tasks appear in a checklist in the corner, plus your next shift (when, where, details).
- Late for a shift → may be fired (maybe without being told). Letters: buy a letter, write it (types and recipients to be added later), a messenger (new place + jobs: post office) walks it to the addressee inside their building. E.g. "I'm unwell, I can't come in". Too many → may be fired. Fired → unlikely to be rehired. Desperate or fond employers may keep you; no-shows make them like you less. Turning up and doing lots of tasks → promotion, depending on business wealth and whether the owner likes you.
- Owners can hire, demote, promote, raise pay, sell the business, relocate, etc. Owners can buy items to improve the place, take items out and sell them, redo the interior (keeping stairs and access clear), redo floors and wallpaper, same for home owners and renters. Business premises can be rented.
- Government: each area's leader can hire/promote like an owner. Every week, at a set day and time, all leaders travel to the castle for a meeting in the great hall with the monarch (whoever rules by blood, eldest child, rarely declining) and guards: long table; laws, guards, buildings, money, wars, criminals, expansion. The monarch can raise or cut their allowance, may dislike them (bad ideas, or an unjust monarch), and can sack them.
- Elections: a sacked or resigning leader → election next day in the government building. Citizens (people whose current home is there) vote at a ballot box, choosing among candidates with a short bio of what they've done. Candidates stand if they think they're good enough and usually drop their old job. NPCs vote by what they like and whom they like (friends vote for friends). The day after, the winner leads and follows the routine. Without a leader, the place runs on as before and people are still paid.
- People can quit jobs; a leader can resign (→ election).
- Rich people and royals tend to marry rich people; parents may arrange matches.
- Crime: remove the base. Buy a little tent at stalls and make a base there: chest, a fund, people managing business; expand it by hiring builders (or builders in your gang, paid), fortify, etc.
- People can own several houses/buildings; they are citizens where they currently live most of the time.
- Later maybe: the OpenAI key hookup and talking to people.

## Batch C (asked after the jobs list) - build now

- [x] Finish steps 59-64 (everything in Batch A)
- [x] Build everything in docs/JOBS.md: every job (existing and NEW, and the extra ideas at the end), every business, every material chain, every item; buildings for every job and business; enough buildings and jobs in every place
- [x] The work system: player can take every job and do its tasks (checklist in the corner, shifts, business fund, orders, firing/promotion, letters). Jobs that can't be asked for (monarch etc.) are still playable "as if" you hold them, with tasks
- [x] Businesses the player can run; a business needs its furniture/equipment placed inside to count as that business (remove it and it stops being one); shops that sell every furniture item, in the right places
- [x] NPCs do these tasks too and you see them doing them
- [x] Animations for every interaction and job action; a shocked animation; people (tax collectors, landlords, beggars, thieves) run up to you in the street
- [x] Every item drawn well; some placeable; animations when used; drop items (icon on the floor), pick them up, sweepers collect them
- [x] Other gangs' bases can be found; the Crows are not the only gang (remove them as the single gang)
- [x] Government buildings can't be sold
- [x] No two people share a name; everyone is different each new life
- [x] No long dashes in game text or writing
- [x] Redo the towns with all the new places, placed where they belong (fishers by the shore or river, mills on rivers, mines in hills, etc.)
- [x] Strictly medieval: no modern tech
- [x] Check for glitches throughout
- [x] Afterwards: list in chat every job that can't yet be reached by asking for work or buying a business

## Still to do (after steps 57-64)
- [ ] Business deals between owners and suppliers (e.g. "every Sunday bring me X for Y a month")
- [ ] Relocating a business; the moneylender actually lending; a touring minstrel troupe; a hermit at the ruins
- [ ] Riders shown on horseback on the roads (merchants with horses already travel faster)
- [ ] Leaders visibly leaving their own towns on council day (they already appear in the great hall)
- [ ] Journeys, council minutes and elections kept across a reload (today travellers come home and the council starts afresh)
- [ ] When the player takes the throne (or any post held by a family): the old holders move out and the player's family takes their place (options to come, as asked)
- [ ] Letters: more kinds and recipients (asked to be added later)
- [ ] Talking to people through an AI key (maybe)

## Batch D (asked after steps 63-64) - build now

- [x] Lordship of Ashford: only offered if you live in Ashford (own a house there and live in it)
- [ ] The "not done yet" items: business deals, relocating a business, the moneylender lending, riders on horseback, leaders visibly leaving for the council, journeys and council kept across a reload
- [ ] Everyone visibly doing things; people leave in time for where they're going (by distance), early or late by personality
- [x] Glitch: some people change their whole look at work but keep their name
- [x] Beds only in buildings where someone lives, and only on the floor they sleep on
- [x] Paths to every city, town, village and hamlet, and paths between buildings
- [x] Construction: the lot is walkable, only what's built collides; stages by building size; no box, grass turns to dirt first; last stage is painting the house, the inside, and the sign
- [x] Prices: bigger buildings cost and rent for more; also by economy and place (near the capital, good trade spots cost more)
- [ ] People can send the player letters (an AI key will write them later)
- [x] Criers heard only when you're near them
- [ ] NPCs talk and do things with each other, sometimes fight, with animations; relationships and friends that affect jobs and so on
- [ ] A prison: gaolers and keepers; law-breakers serve time or pay bail by sentence length; animations
- [ ] Collisions: no seeing through things, no odd overlaps
- [x] The for-sale sign is put up by a person, with animation
- [x] Attack while sprinting
- [ ] Preload the map
- [ ] Better pathfinding: people walking head on don't jam
- [x] NPCs turn to face you when you talk to them
- [x] Some buildings have no light: at least a candle unless too poor
- [x] Inn: "a bed for the night" and "a room for the night" mean the same; the upstairs only where the building has one
- [ ] Population numbers for every place (answer in chat)
- [x] Potboy or potgirl always takeable even when the inn's other posts are full; more than one job at once
- [ ] Optional: minstrels and the hermit
- [ ] Gangs: join any gang, climb the ranks, tasks per rank (management, pickpocketing, burglary, higher up assassinations); the tailor sells disguises so you aren't known
- [ ] Next: how to get the other jobs (asked to come after this)
- [ ] Say what should be added next; how many people are in the sim and how things change over time
