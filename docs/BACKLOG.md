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
- [x] Business deals between owners and suppliers (e.g. "every Sunday bring me X for Y a month")
- [x] Relocating a business; the moneylender actually lending; a touring minstrel troupe; a hermit at the ruins
- [x] Riders shown on horseback on the roads (merchants with horses already travel faster)
- [x] Leaders visibly leaving their own towns on council day (they already appear in the great hall)
- [x] Journeys, council minutes and elections kept across a reload (today travellers come home and the council starts afresh)
- [ ] When the player takes the throne (or any post held by a family): the old holders move out and the player's family takes their place (options to come, as asked)
- [ ] Letters: more kinds and recipients (asked to be added later)
- [ ] Talking to people through an AI key (maybe)

## Batch D (asked after steps 63-64) - build now

- [x] Lordship of Ashford: only offered if you live in Ashford (own a house there and live in it)
- [x] The "not done yet" items: business deals, relocating a business, the moneylender lending, riders on horseback, leaders visibly leaving for the council, journeys and council kept across a reload
- [x] Everyone visibly doing things; people leave in time for where they're going (by distance), early or late by personality
- [x] Glitch: some people change their whole look at work but keep their name
- [x] Beds only in buildings where someone lives, and only on the floor they sleep on
- [x] Paths to every city, town, village and hamlet, and paths between buildings
- [x] Construction: the lot is walkable, only what's built collides; stages by building size; no box, grass turns to dirt first; last stage is painting the house, the inside, and the sign
- [x] Prices: bigger buildings cost and rent for more; also by economy and place (near the capital, good trade spots cost more)
- [x] People can send the player letters (an AI key will write them later)
- [x] Criers heard only when you're near them
- [x] NPCs talk and do things with each other, sometimes fight, with animations; relationships and friends that affect jobs and so on
- [x] A prison: gaolers and keepers; law-breakers serve time or pay bail by sentence length; animations
- [x] Collisions: no seeing through things, no odd overlaps
- [x] The for-sale sign is put up by a person, with animation
- [x] Attack while sprinting
- [x] Preload the map
- [x] Better pathfinding: people walking head on don't jam
- [x] NPCs turn to face you when you talk to them
- [x] Some buildings have no light: at least a candle unless too poor
- [x] Inn: "a bed for the night" and "a room for the night" mean the same; the upstairs only where the building has one
- [ ] Population numbers for every place (answer in chat)
- [x] Potboy or potgirl always takeable even when the inn's other posts are full; more than one job at once
- [x] Optional: minstrels and the hermit
- [x] Gangs: join any gang, climb the ranks, tasks per rank (management, pickpocketing, burglary, higher up assassinations); the tailor sells disguises so you aren't known
- [ ] Next: how to get the other jobs (asked to come after this)
- [ ] Say what should be added next; how many people are in the sim and how things change over time

## Batch E (asked after step 69) - build now

- [x] Testing cheat (remove later): teleport to any city, town, village, hamlet etc. Publish this first
- [x] The castle should look like a castle; where is the royal family; parts of the castle are blocked off
- [x] Talking: people (including on the roads) stop and turn to face you and the dialogue options come up, not just one message
- [x] You can't read what NPCs say to each other (only chatting animations): make it readable
- [x] Gang ranks should be many different jobs (more than 7), some better than others
- [x] Disguises: only basic black clothing that covers the face (remove the other kinds). Witnesses can only give approximate height and build. People don't recognise you in it. Guards who catch you take it off you and keep it (it goes to the local government and is sold). Make sure you and NPCs can actually wear it
- [x] Currency: one made-up coin with its own symbol
- [x] "Welcome to Ashford" shows when you're not there
- [x] Animals can be in the barn, mostly at night
- [x] Stable hand: unclear how to clean and sweep; the arrow points into the house; interacting with the dresser opens it and it's unclear what to do
- [x] Horses glitch when sprinting
- [x] The job panel should close when a menu (map etc.) opens
- [x] Deliveries whenever agreed, not only Sunday (Sunday was an example)
- [x] Potboy/potgirl is not always open; a cook (etc.) can also do the potboy's work as part of their job
- [x] Remove the see-through/fading when behind buildings; make sure layering and collisions are right
- [ ] Check for glitches, animations, everything
- [x] The cross on the church roof is off-centre
- [x] Jobs are hard to follow: explain how they work in the game; arrows that lead you there; at the marked thing pressing E must do the job (it opened the dresser instead). For every job
- [x] If you're hired while the shift is already running, your first shift is the next one (tomorrow)

## Batch F (asked after step 71) - the castle rebuilt, and more

- [x] Castle interior is not open plan: you walk in to a long hallway with guards and red carpet; off it, doors to separate rooms you go into (you can't see beyond the room you're in): kitchen, places to sit and rest, etc.
- [x] Upstairs: separate rooms for the servants, the jester, the stable people, anyone who lives in the castle; everyone gets their own room, like a house inside
- [x] At the end of the corridor a grand staircase; upstairs a massive hallway with guards, the locked rooms of the monarch (unless you are the monarch) and the royal family, other people's rooms; the big table for the council meetings you must attend is in that hallway; lots of red carpet
- [x] If you're the king (or any role that fits) the job starts at once, and the job card text is different
- [x] NPC animation: people stand idle and don't walk properly (fix)

## Batch G (asked after step 72) - clean-up and the crown

- [x] Government (officials, the treasury's own houses) and the royals pay no tax
- [x] Tax glitch: the collector asks, you refuse, they ask again; instead, if you run or refuse they go to the guards and the guards come for you
- [x] Fix glitches and clean things up so far; make sure everything works and jobs function
- [x] Remove any invisible walls
- [x] Remove NPC speech appearing above them
- [x] Locked royal doors look like any other door; you pick the lock to get in
- [x] The red carpet barely covers anywhere: cover much more
- [x] Any crime against the royal family is at once worse: pushing, stealing, lock picking get a heavy sentence or fine
- [x] The king (you, as monarch) may sit on the throne
- [x] Weird hairstyle with hair only at the back and none on top: fix

## Batch H (asked after step 73) - the castle floors, waking sleepers, knowing who to ask

- [x] An arrow showing the direction to go (not only over the target)
- [x] Paths blocked by things: you can't get through; clear them
- [x] When you're monarch, the old royals don't still live in the castle; the old monarch and people with titles lose the title
- [x] Castle floors: the royal rooms off the council floor and up; 2nd floor the less important people and their families, 3rd the more important, 4th the monarch's
- [x] Guards patrol each floor
- [x] Floors too long, takes forever to cross: shorter
- [x] Click on a bed to wake whoever's in it: they go back to bed eventually if it's nothing serious; a stranger in their room and they run out to call the watch or the guards
- [x] If no one is in the room, or they're asleep, no one sees you; and more than one person can see you
- [x] People run away (from danger, from you)
- [x] Follow someone out of a room and they're gone when you get outside: fix
- [x] You can't ask for a job or to join a gang if you have no idea who does that: let people tell you
- [x] Polish

## Batch I (asked after step 74) - small fixes

- [x] You can't ask for a job at a place where you already have one
- [x] At the inn, ask the innkeeper directly for a bed (no one at the counter shouldn't stop you)
- [x] The job card says "next shift tomorrow" even when tomorrow has come: keep it current
- [x] People randomly entering and leaving the empty tavern: fix

## Batch J (asked after step 75) - trust, and the next features

- [x] People of the law (and the government) are never in gangs
- [x] People only tell you things if they trust you enough; good people won't say (priests, most of the law and government), and nobody says what they don't know
- [x] You can't ask anyone about houses to let or for sale unless you know they deal in them
- [x] Getting a room: the words appear in the speech text, not the line at the bottom
- [x] Seasons and festivals that matter: harvest fair, midwinter feast at the castle, spring tournament (joust or bet), Sunday market with travelling merchants
- [x] Ruling as monarch: set the crown tax, pardon or condemn prisoners, grant titles, order works, declare war, hold audiences for petitions
- [x] Reputation you can see: guards nod or glare, merchants' prices, children following the famous
- [x] Bounty boards and hired work at the watch house and the tavern: catch a thief, escort a merchant, clear a bandit camp
- [x] Disasters with choices: plague year, failed harvest, flood; help or profit
- [x] Clean-up pass of the old Ashford-only systems (reeve, moot, lordship) against the whole island
- Later, with the AI chat: marriage and family (court, marry, children, heirs)
- Next after this batch: the AI chat (NPC speech by AI)

## Batch K (asked during step 77) - quick fixes

- [x] People still teleport, and aren't there when you go in or come out of a building
- [x] People cross the river: they must use the bridge
- [x] Someone going to tell (the watch, a guard) sprints and runs
- [x] The arrow that tells you where to go: make sure it shows
- [x] Priests can tell you about gangs but it's very unlikely; good people may not; the government may not; ask the wrong person (a guard, the government) and you may be punished
- [x] You are drawn white (the outline behind roofs): remove it
- [x] Invisible solid tiles still: find and fix
- [x] Upstairs in the mill there's a strange brown-then-white thing: fix it
- [x] You shouldn't be able to sit in the pews
- [x] Some children have no walking animation
- [ ] Hard to get the option to ask to join a gang (to be looked at again with the AI chat)
- (Festivals in progress: Sunday market, harvest fair archery, spring tournament, midwinter feast)

## Batch L (asked during step 78) - quick

- [x] A more pixelated arrow
- [x] Pressing R says you put your weapon away when you never had one: remove that popup entirely
- [x] Someone inside goes back in when you go out (they'd only just come in): fix
- [x] A menu where you can cancel tasks; cancelling work means no pay and an angry boss
- [x] When someone says go to a person, talking to that person makes the arrow go
- [x] As monarch, host the festivities whenever you want, and keep a blacklist or a whitelist of anyone

## Batch M (asked after step 78) - roles that fit, the business tab, arrows that guide

- [x] Disasters with choices (help or profit); the old Ashford-only systems made to work for every town (Ashford was the first and only town once; some menus still assume it)
- [x] You may take things from your own room in your own place (castle chamber, rented room, your house)
- [x] The job list in the corner folds into an icon; press it to open
- [x] Jobs for the king (and every job) need better tasks than "press E at a thing"; some jobs may have none
- [x] Rank fits: a king (or anyone high) doesn't ask people below them for work; find ALL such cases and fix
- [x] A king asking about gangs isn't reported or jailed; the monarch isn't arrested by their own guards
- [x] The throne task is done at the throne only (not a desk), by sitting on it
- [x] How to open the business and monarch menus: make them reachable; outdated menus brought up to date
- [x] The throne room door isn't central
- [x] The arrow gets smaller as you get closer until it merges into the one over the place; arrows guide you to places inside buildings too (stairs, rooms, doors)
- [x] Manage business and monarch things: remove the separate monarch tab, make a Business tab that changes with your work: owners see income, employees, stats; workers see stats, wages, coworkers; manage what you can (leave, ask for a raise by letter if you have one)
- [x] Parties at your house: invite a few; not all will come; some early, some late; families come together
- [x] Cancelling a task cancels its arrow; several arrows at once
- Next after this: how to get the jobs you can't simply ask for

## Batch N (asked after step 79) - quick

- [x] A king, queen and princess still about when you're monarch with no family: the old royal family steps down wherever you took the crown, and crown posts are always held at the capital
- [x] Woken people stay awake a good while before sleeping again
- [x] Your party is an undertaking too (J: call it off), with an arrow home
- [x] Animations stopping: people indoors never advanced their animation, so they slid about frozen
- [x] On the throne you sat on the grey step: now up on the seat

## Batch O (asked after step 80) - how to get the jobs you can't just ask for (all routes, in detail)

- [x] Ladders: watch: guard, sergeant, guard captain; the royal guard (a sergeant, vouched for); the castle: maid or page, butler, steward, chamberlain; the town hall: clerk, scribe, magistrate (needs learning); "Ways up" in Business
- [x] Learning: study the books at the chapel, or pay the priest for lessons
- [x] Patronage: lady-in-waiting or page (a royal or a lady takes to you); jester (perform at the tavern and the fair, and the herald hears); herald (carry the crown's letters to other towns); spy (sly but not known as a criminal: a secret offer by letter)
- [x] Deeds: knighthood (win the tournament, or serve in a war); a lordship at half price for a knight; masters of their craft sent for by the castle (physician, master of horse, falconer)
- [x] Elections and vows: a reeve's moot in every town; the priesthood (serve the chapel, learn, take vows; no gang, no marrying); a priest of long good standing becomes bishop
- [x] Seizing it: rise against the crown with a gang and lords behind you (win the crown or hang); the council chooses a monarch when the royal line dies out, and you can campaign; blackmail an official out of their post with a secret you've found
- [x] Finding out: positions at court posted at the castle gate; the herald and steward tell you what each post needs; Ways up in Business
- Later, with the AI: marriage into the crown or a noble house (consort, heir, lord or lady by marriage)

## Batch P (asked after step 81) - lords for a rising, rites, and the block

- [x] Lady-in-waiting is a woman's post only (patron offers, asking for work, Ways up, blackmail, the settings job list); a man is offered page
- [x] War: already in (wars with the Marchers, civil wars with the Duke of Frostmere, the King's shilling, the rebel agent, the crown's war tab)
- [x] Winning lords to a rising: write to the lords of the realm (sound them out, gifts, promise land, pay their price), speak to the gentry face to face, make common cause with the Duke of Frostmere, hire sellswords, buy arms, find a man inside to open the postern; whispers at court (the crown issues a warrant if it hears too much); choose how to rise (storm, postern, siege); keep or break your promises; crown the Duke or betray him
- [x] Tested the routes not tested before: the rising (win and lose), the council's choice, blackmail for a post, face-to-face plotting
- [x] Invisible solid tiles inside buildings: sacks and barrels of stock vanished as stock ran down but stayed solid; now you can walk where they stood
- [x] A coronation in the castle chapel the day after taking the crown: the court, the gentry and townsfolk fill the pews, kneel at the altar and the crown comes down onto your head; a feast that night; a crowned monarch wears the crown
- [x] Childbirth: the belly shows late in pregnancy; in labour she goes to the infirmary (or to bed at home with the midwife sent for), lies in, the baby is born, and she carries it home in her arms
- [x] Executions (strictly medieval: the headsman's block on a scaffold in the square, not a guillotine): murder, treason, sedition, arson, highway robbery or a third conviction; the crowd gathers, the condemned is walked up and kneels, the headsman swings; a player executioner swings the axe themselves (E at the block); the monarch can pardon or send a prisoner to the block
- [x] The crier no longer announces "0 villagers hired"
- Later, with the AI: marriage ceremonies (the wedding in the chapel, the vows, the feast), alongside courting and marriage into the crown or a noble house

## Batch Q (asked after step 82) - war for leaders, crowns, job modes, more wars

- [x] A War section in Business for the leaders of places (a lord, a reeve, the monarch): men who could bear arms, raise a palisade, arm and drill the levy, send men to the King's host, your quarrels (make peace), your neighbours (demand tribute, raise a feud and lead your men out), who's who in the realm, trouble in the realm
- [x] Monarchs lose the crown when they leave: deposed royals give up their royal posts and their crowns and robes; a player who leaves the throne loses the crown too
- [x] Jobs come in two kinds: a day's quota (several different tasks; when they're done your day is done and you're paid in full) for makers, woodcutters, farmhands, fishers, carriers, collectors, sweeps and the like; and shifts (stay the hours, paid for the time you're there, and new work comes along every hour and a half) for guards, servers, servants, the court and the like
- [x] More wars than the Duke of Frostmere's: foreign wars with the Sea-Lords of Varn, the Marcher clans or the Kingdom of Aldmark; civil wars raised by the Duke or by a great lord of Eastmarch or Westcliff; feuds between lords; sea raiders and bandits; risings of the hungry commons
- [x] Who the Duke is: Robert, Duke of Frostmere, the old king's cousin, who holds the north and says his claim is the better one (shown in the War section)
- [x] Battles you can see: two lines meet on the road where you stand, banners up, men pair off and fight, fall, and one side breaks and runs; press E near one of theirs to strike; raids, feuds and risings at your town are fought in front of you; marching with the levy shows you a battle before you come home

## Batch R (asked after step 83) - clearer work, real time, the council, finery, and a sweep for inconsistencies

- [x] Business is in tabs (The Crown, Your work, Your businesses, Your home, War, Ways up); B opens it from anywhere and closes it again (J too)
- [x] Your work: what the job is, whether it's a day's quota or a shift and the hours, today's task checklist with plain instructions for each (no talk of arrows), fellow workers
- [x] The right way out of each post: hand in your notice, buy out an indenture, be released from vows or service, ask the crown's leave, renounce a royal place, or abdicate the throne; walking out of a shift ends the day unpaid instead of quitting
- [x] The monarch has no master and no raise to ask for
- [x] The coronation: a royal herald comes on the morning to fetch you, wherever you are
- [x] Petitioners come as soon as you sit on the throne and wait until you've answered them; the crown treasury is shown as you hear them
- [x] Pointers travel into the gold mark over the door and vanish into it; every marker has a label saying what it's for; two in one place become one with both names; your markers show on the map of the realm; Settings can turn pointers off (markers only) or turn all of it off
- [x] People stay put while you talk to them, indoors and out
- [x] Jewellery: rings, brooches, gold chains and circlets, worn from the satchel and shown on you; the gentry and royals wear theirs; the well-off buy them at the jeweller's
- [x] What's on (in J): every event with its date and hours (fairs, feasts, the tournament, Sunday market, the council, a coronation, executions, your party, weddings, funerals, elections, and the gatherings townsfolk hold); Show the way to any of them
- [x] Townsfolk host their own gatherings: christenings after a birth, guild feasts, church ales, harvest-home suppers, mummers' plays, hunts; going makes friends
- [x] No two big gatherings at once in a town: the crown can't call a festivity on a day already taken, and you can't throw a party on a night something else is on
- [x] Letters take time: sounding out a lord, writing to the Duke, demanding tribute and asking for a raise by letter all wait for the answer to come back (listed in J while you wait); a palisade takes three days and drilling counts from the next day
- [x] The council of the realm: every leader of a city, town, port and castle rides in; it waits for whoever has a seat until five, then goes home; the monarch presides (grant or refuse, with the treasury shown); a leader brings their own petition and speaks for or against others; you're told on the morning and shown the way
- [x] Castle doors carry plaques (the room, or the family who lives there); chests in a family's room belong to them, not the castle
- [x] Wording: the King's host becomes the Queen's under a queen; the currency is the aurin everywhere (no crowns, shillings or pennies); the recruiting sergeant calls a woman a lass; leaders' titles read properly; the moot names your rival; women's titles for women (potgirl, mistress cook); the guide is brought up to date
