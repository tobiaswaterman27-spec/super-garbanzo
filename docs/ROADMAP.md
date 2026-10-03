# Outlaw — build log and roadmap

The game is a single HTML page built from `src/` by `node tools/build.mjs pages/outlaw.html dist/outlaw.html`.
Each step was published as an artifact and screenshot-checked in headless Chromium
(`tools/shot.mjs`, `tools/interiors.mjs`, `tools/simtest.mjs`).

## Done

| Step | Spec phases | What's in |
|---|---|---|
| 1 | Graphics | Material raster (hue-shifted ramps, normal shading, contact AO, selective outline); skeleton-posed modular characters, 12 animations × 4 directions; outfits by trade/wealth; genetics; character creator, crowd and family views; sprite sheets |
| 2 | 1, world art | Procedural buildings (5 wall types, 4 roof types, side/gable), trees, props, noise-warped terrain with baked shadows; village of Ashford; movement, depth sorting, smoke, day/night light |
| 3 | 2–8 | ~80 residents in families; schedules with A*; jobs, wages, homes, businesses with stock, recipes, supply/demand prices; hand-carried deliveries; trader imports; memories; dialogue; town ledger |
| 4 | 9–10 | Interiors at 2× footprint with furniture by type, residents at beds/workstations/seats, live stock visuals, fire/window light, stairs; 10-slot satchel; trading; room rental; sleeping; container search tied to real pantries/purses/stock; F quick loot |
| 5 | 11–12 | Weather chain (rain, storm, fog, snow, heat) affecting behaviour and work; puddles, snow, cloud shadows, particles, lightning; seasons, crops, harvest reserve; 11-stage construction; storm damage and repair; labour market, relief, exports, tolls, tax policy |
| 6 | 13–16 | Illness, injury, contagion, sanitation, collapse → helper → physician, treatment; ageing, courtship, weddings, births, deaths, funerals, graves, inheritance, vacancies, migration |
| 14 | property | Ownership of every building, property values (size, condition, location, local wealth, demand), landlords and weekly rent, debt and eviction; businesses close when broke and reopen (sometimes as a different trade, interior and sign changing); houses and clothes follow family fortunes; For Sale signs; buy houses and shops, let to tenants, open your own business with a hired manager; Holdings (P); buy the lordship of Ashford to set tax, watchmen, works, take from the treasury and pardon |
| 13 | travel | Procedural settlement generator (through-road, square or green, trades where they belong, back lane, farmland, woods) with regional architecture and land: north stone, slate and mines; east painted plaster and tile; south farms; west coast beach, fishing huts and boats; every place gets its own full simulation when you arrive; Ashford keeps living while you are away; places catch up when revisited; travel by road with time passing, bandits and caravans; local reputation per settlement; fish and mined iron in the economy |
| 12 | persistence | Save/load: deterministic regeneration plus a ~300 KB diff of everything that changed (people, memories, relationships, households, businesses, buildings, sites, trees, props, weather, crimes, gangs, horses, kingdom, player); autosave at dawn and when the page is hidden; Save and New life buttons |
| 11 | 21–25 | Kingdom of 8 settlements in 4 regions simulated in the abstract (food, wealth, prices, crime, health, happiness, migration, growth/decline, harvest failures); roads with quality, danger and storm damage; caravans that physically cross Ashford and can be robbed, with knock-on prices and merchant caution; seasonal castle councils with leaders voting on security, food, health, roads, bounties and taxes, the reeve riding off to attend; town crier; notice board; kingdom map |
| 10 | animals | Horses as individuals (name, breed, age, speed, stamina, temperament, value, owner, full ownership history) with 4-direction walk/gallop sprites, coats and markings; Ashford Stables and paddock; buy, ride (H), gallop with stamina, rename, feed, sell; horse theft with witnesses who remember the horse, and a trader who recognises stolen horses; chickens, pigs, sheep, cows, dogs and cats |
| 9 | combat | Stylised combat: Space to strike with fists, dagger, sword or axe (R to switch); flashes, stagger, dust; injury states feed the health system; NPCs fight, flee, call the watch or surrender; robbery at weapon-point; F to search the beaten; fighting the watch; being beaten down sends you to the physician or the cell |
| 8 | 20 | Gangs: claim a camp, recruit in conversation, wages, loyalty, roles, purse, hideout that grows (camp → hideout → safehouse → HQ), stash, fence, night jobs, informers; rival Crows; council hires watchmen in crime waves |
| 7 | 17–19 | Pickpocketing, lock-picking, witnesses with imperfect descriptions, reports, investigation, suspect profiles, disguise, recognition and chase, arrest/bribe/run, trial and sentences, NPC crime, wrongful arrests, rumours |

## Next

- 20 Gangs: recruits found in the tavern, loyalty, wages, hideout that grows, fence, gang jobs, rivals
- 21 Reputation: per-town and per-faction effects on prices, guards, recruits
- 22 Politics: castle meetings, councils voting on taxes/guards/roads, treasury decisions
- 23–25 Trade and regions: other settlements on the map, caravans, roads, bridges, robberies with economic knock-on effects; town growth/decline
- 26 History: world timeline UI, legacies
- Combat (stylised, non-graphic injury states), horses with ownership history
- Player property: buying houses, land, estates
- NPC speech via OpenAI (see `SPEECH.md`)
