// The island of Eldoria. About five thousand souls in thirty-three settlements, from the walled
// capital of Aurelia on the River Aure, where King Aldric IV and Queen Elinora hold court in the
// royal castle, down to Oldbridge, fifteen people and a broken bridge. Four castles keep the island:
// the royal castle at Aurelia, Highmere in the northern peaks, Eastmarch on the east coast and
// Westcliff above the western sea. Five great tracts of wild country — the Eldorian Peaks, the
// Frostwood, the King's Forest, Blackpine and the Greenwood — lie between the farms, crossed by six
// named roads and a web of lesser paths. Ruins of older times stand in the wild places.
//
// Map units: the island fits a 128 x 96 grid. `terrainAt(x, y)` says what the land is anywhere on
// it, so the realm map and the countryside you walk through between towns agree.
'use strict';
(function () {
  const W = 128, H = 96;

  // regions: wild country with a centre and a size
  const REGIONS = [
    { id: 'peaks', name: 'the Eldorian Peaks', kind: 'mountain', x: 62, y: 18, rx: 20, ry: 10 },
    { id: 'frostwood', name: 'the Frostwood', kind: 'forest', x: 36, y: 17, rx: 14, ry: 9, cold: true },
    { id: 'blackpine', name: 'Blackpine', kind: 'forest', x: 22, y: 38, rx: 10, ry: 13, dark: true },
    { id: 'kingsforest', name: "the King's Forest", kind: 'forest', x: 90, y: 30, rx: 12, ry: 8 },
    { id: 'greenwood', name: 'the Greenwood', kind: 'forest', x: 58, y: 80, rx: 15, ry: 7 },
  ];
  const LAKES = [
    { id: 'eldor', name: 'Lake Eldor', x: 57, y: 46, rx: 5.5, ry: 3.6 },
    { id: 'frostmerelake', name: 'Frostmere Lake', x: 46, y: 24, rx: 4, ry: 2.8 },
    { id: 'kingslake', name: "King's Lake", x: 82, y: 34, rx: 3.2, ry: 2.4 },
    { id: 'southmere', name: 'Southmere', x: 72, y: 70, rx: 4, ry: 2.8 },
  ];
  const RIVERS = [
    { id: 'aure', name: 'the River Aure', pts: [[64, 26], [70, 32], [75, 38], [78, 42], [84, 48], [89, 56], [98, 62], [106, 66], [114, 69]] },
    { id: 'rivermere', name: 'the Rivermere', pts: [[52, 48], [46, 51], [40, 53], [32, 55], [24, 56], [16, 58], [9, 59]] },
    { id: 'northflow', name: 'the Northflow', pts: [[56, 22], [50, 23], [44, 22], [38, 16], [33, 10], [30, 5]] },
    { id: 'green', name: 'the Green River', pts: [[60, 49], [62, 56], [62, 63], [68, 68], [72, 70], [73, 78], [74, 86], [75, 92]] },
    { id: 'blackwater', name: 'the Blackwater', pts: [[30, 30], [26, 36], [21, 41], [15, 44], [8, 46]] },
  ];

  // [id, name, kind, x, y, pop, region style, area, leader title, produces]
  const S = [
    ['aurelia', 'Aurelia', 'capital', 78, 42, 1100, 'east', 'the Heartland', 'the Lord Mayor', { cloth: 34, wine: 14, grain: 60 }],
    ['westhaven', 'Westhaven', 'port', 12, 44, 650, 'west', 'the Western Shore', 'the Port-reeve', { fish: 60, salt: 10, wool: 10, timber: 10 }],
    ['goldmere', 'Goldmere', 'town', 98, 36, 600, 'east', 'the Eastern Vale', 'the Master of the Guilds', { cloth: 20, wine: 12, iron: 6 }],
    ['frostmere', 'Frostmere', 'town', 42, 27, 500, 'north', 'the Frostwood', 'the Steward', { iron: 36, timber: 26, wool: 8 }],
    ['greenvale', 'Greenvale', 'town', 62, 64, 450, 'south', 'the Southern Farmlands', 'the Bailiff', { grain: 120, wool: 12, wine: 6 }],
    ['rivermouth', 'Rivermouth', 'town', 24, 57, 350, 'west', 'the Rivermere', 'the Bridgemaster', { fish: 30, grain: 30, timber: 8 }],
    ['eastwatch', 'Eastwatch', 'town', 112, 48, 300, 'east', 'the Eastern Shore', 'the Captain of the Watch', { fish: 40, salt: 12 }],
    ['millhaven', 'Millhaven', 'village', 66, 56, 250, 'south', 'the Southern Farmlands', 'the Miller-reeve', { grain: 70 }],
    ['crossfield', 'Crossfield', 'village', 64, 46, 220, 'south', 'the Heartland', 'the Market-reeve', { grain: 30, cloth: 4 }],
    ['saltmere', 'Saltmere', 'village', 40, 84, 180, 'west', 'the Southern Shore', 'the Saltreeve', { salt: 30, fish: 18 }],
    ['sunfield', 'Sunfield', 'village', 52, 70, 160, 'south', 'the Southern Farmlands', 'the Reeve', { grain: 90, wine: 4 }],
    ['bellford', 'Bellford', 'village', 88, 57, 140, 'east', 'the Aure Valley', 'the Reeve', { grain: 30, fish: 6 }],
    ['ashford', 'Ashford', 'village', 46, 51, 120, 'south', 'the Rivermere', 'the Reeve', { grain: 30, timber: 10 }],
    ['highmere', 'Highmere Castle', 'castle', 58, 14, 90, 'north', 'the Eldorian Peaks', 'Lord', { grain: 6, iron: 4 }],
    ['eastmarch', 'Eastmarch Castle', 'castle', 108, 38, 80, 'east', 'the Eastern Shore', 'Lord', { grain: 6 }],
    ['westcliff', 'Westcliff Castle', 'castle', 9, 32, 70, 'west', 'the Western Shore', 'Lady', { fish: 6 }],
    ['thornwick', 'Thornwick', 'village', 90, 24, 100, 'east', "the King's Forest", 'the Woodward', { timber: 30, grain: 8 }],
    ['elmstead', 'Elmstead', 'village', 50, 79, 95, 'south', 'the Greenwood', 'the Woodward', { timber: 30, grain: 6 }],
    ['brackenhurst', 'Brackenhurst', 'village', 84, 15, 90, 'north', 'the Northern Moors', 'the Headman', { wool: 26, grain: 6 }],
    ['stonebridge', 'Stonebridge', 'village', 56, 36, 85, 'north', 'the Heartland', 'the Reeve', { grain: 16, timber: 6 }],
    ['kettleby', 'Kettleby', 'village', 34, 45, 80, 'west', 'Blackpine', 'the Reeve', { timber: 14, grain: 10 }],
    ['copperhill', 'Copperhill', 'mine', 70, 22, 75, 'north', 'the Eldorian Peaks', 'the Mine-master', { iron: 30 }],
    ['marshby', 'Marshby', 'hamlet', 31, 65, 70, 'west', 'the Rivermere', 'the Headman', { fish: 10, grain: 8 }],
    ['redwater', 'Redwater', 'hamlet', 22, 71, 60, 'west', 'the Southern Shore', 'the Headman', { fish: 12, salt: 4 }],
    ['ravenscar', 'Ravenscar', 'hamlet', 30, 8, 60, 'north', 'the Northern Shore', 'the Headman', { fish: 14, wool: 10 }],
    ['pinecrest', 'Pinecrest', 'hamlet', 24, 27, 55, 'west', 'Blackpine', 'the Woodward', { timber: 22 }],
    ['foxley', 'Foxley', 'hamlet', 80, 68, 55, 'south', 'the Southern Farmlands', 'the Headman', { grain: 24 }],
    ['wolfden', 'Wolfden', 'hamlet', 34, 18, 45, 'north', 'the Frostwood', 'the Headman', { timber: 14, wool: 6 }],
    ['larkspur', 'Larkspur', 'hamlet', 96, 72, 45, 'east', 'the Southern Shore', 'the Headman', { grain: 14, fish: 6 }],
    ['hollowmere', 'Hollowmere', 'hamlet', 44, 63, 40, 'south', 'the Rivermere', 'the Headman', { grain: 14 }],
    ['fernbrook', 'Fernbrook', 'hamlet', 64, 84, 30, 'south', 'the Greenwood', 'the Headman', { timber: 8, grain: 4 }],
    ['dunmore', 'Dunmore', 'hamlet', 102, 58, 25, 'east', 'the Eastern Shore', 'the Headman', { wool: 6 }],
    ['oldbridge', 'Oldbridge', 'hamlet', 74, 51, 15, 'east', 'the Aure Valley', 'the Headman', { grain: 4 }],
  ];

  // [a, b, quality, danger, bridge, road name]
  const ROADS = [
    // the King's Road: Aurelia -> Crossfield -> (Ashford) -> Rivermouth -> (Hollowmere) -> Greenvale
    ['aurelia', 'crossfield', 0.9, 0.05, true, "the King's Road"], ['crossfield', 'ashford', 0.8, 0.12, false, "the King's Road"], ['ashford', 'rivermouth', 0.75, 0.15, true, "the King's Road"],
    ['rivermouth', 'hollowmere', 0.65, 0.2, false, "the King's Road"], ['hollowmere', 'greenvale', 0.7, 0.15, false, "the King's Road"],
    // the Eastern Trade Road
    ['aurelia', 'goldmere', 0.9, 0.08, false, 'the Eastern Trade Road'], ['goldmere', 'eastwatch', 0.75, 0.15, false, 'the Eastern Trade Road'],
    // the Western Road
    ['aurelia', 'stonebridge', 0.75, 0.15, true, 'the Western Road'], ['stonebridge', 'kettleby', 0.6, 0.25, false, 'the Western Road'], ['kettleby', 'rivermouth', 0.6, 0.25, false, 'the Western Road'], ['rivermouth', 'westhaven', 0.7, 0.2, true, 'the Western Road'],
    // the Northern Road
    ['stonebridge', 'frostmere', 0.6, 0.25, false, 'the Northern Road'], ['frostmere', 'ravenscar', 0.45, 0.35, false, 'the Northern Road'],
    // the Iron Road, through the mines of the peaks
    ['frostmere', 'highmere', 0.55, 0.3, false, 'the Iron Road'], ['highmere', 'copperhill', 0.55, 0.3, false, 'the Iron Road'], ['copperhill', 'thornwick', 0.5, 0.3, false, 'the Iron Road'], ['thornwick', 'goldmere', 0.6, 0.2, false, 'the Iron Road'],
    // the Southern Farm Road
    ['greenvale', 'sunfield', 0.65, 0.1, false, 'the Southern Farm Road'], ['sunfield', 'elmstead', 0.55, 0.2, false, 'the Southern Farm Road'], ['elmstead', 'saltmere', 0.5, 0.25, false, 'the Southern Farm Road'],
    ['greenvale', 'millhaven', 0.7, 0.1, true, 'the Southern Farm Road'], ['millhaven', 'crossfield', 0.7, 0.1, false, 'the Southern Farm Road'],
    // lesser paths
    ['aurelia', 'oldbridge', 0.5, 0.15, true, 'the Aure path'], ['oldbridge', 'bellford', 0.5, 0.15, false, 'the Aure path'], ['bellford', 'dunmore', 0.4, 0.3, false, 'the cliff path'], ['dunmore', 'eastwatch', 0.4, 0.3, false, 'the cliff path'],
    ['eastwatch', 'eastmarch', 0.6, 0.15, false, 'the castle road'], ['goldmere', 'eastmarch', 0.5, 0.2, false, 'the castle road'], ['westhaven', 'westcliff', 0.6, 0.15, false, 'the castle road'],
    ['westhaven', 'pinecrest', 0.4, 0.35, false, 'the Blackpine track'], ['pinecrest', 'wolfden', 0.35, 0.45, false, 'the Blackpine track'], ['wolfden', 'frostmere', 0.4, 0.35, false, 'the Frostwood track'],
    ['pinecrest', 'kettleby', 0.4, 0.35, false, 'the Blackpine track'], ['thornwick', 'brackenhurst', 0.45, 0.3, false, 'the moor road'], ['brackenhurst', 'highmere', 0.4, 0.35, false, 'the moor road'],
    ['bellford', 'foxley', 0.5, 0.15, false, 'the Aure path'], ['foxley', 'larkspur', 0.45, 0.2, false, 'the coast path'], ['foxley', 'greenvale', 0.55, 0.12, false, 'the farm lane'],
    ['rivermouth', 'marshby', 0.4, 0.25, false, 'the marsh path'], ['marshby', 'redwater', 0.4, 0.25, false, 'the marsh path'], ['redwater', 'saltmere', 0.45, 0.25, false, 'the salt path'],
    ['elmstead', 'fernbrook', 0.4, 0.3, false, 'the Greenwood track'], ['ashford', 'sunfield', 0.5, 0.15, false, 'the farm lane'], ['millhaven', 'oldbridge', 0.45, 0.15, false, 'the farm lane'],
  ];

  // ruins of older times, in the wild places
  const RUINS = [
    { id: 'vaelhold', name: 'the ruins of Vaelhold', x: 48, y: 12, note: 'a broken keep of the old kings, above the Frostwood' },
    { id: 'blackabbey', name: 'Black Abbey', x: 18, y: 36, note: 'a roofless abbey deep in Blackpine' },
    { id: 'sunkenhall', name: 'the Sunken Hall', x: 56, y: 82, note: 'a hall half-swallowed by the Greenwood' },
    { id: 'watchstone', name: 'the Watchstone', x: 100, y: 28, note: 'a ring of standing stones on the eastern moor' },
    { id: 'drownedtower', name: 'the Drowned Tower', x: 58, y: 46, note: 'a tower standing in the shallows of Lake Eldor' },
  ];

  // ---------- the land itself ----------
  const nz = (x, y, s) => O.fbm(x, y, s, 3);
  function landAt(x, y) {
    const wx = x + (nz(x / 14, y / 14, 501) - 0.5) * 14, wy = y + (nz(x / 14, y / 14, 503) - 0.5) * 12;
    const d = ((wx - 62) / 58) ** 2 + ((wy - 48) / 44) ** 2;
    return d < 1;
  }
  const segDist = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1; const t = O.clamp(((px - a[0]) * dx + (py - a[1]) * dy) / l2, 0, 1); return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t)); };
  function riverAt(x, y) { for (const r of RIVERS) for (let i = 1; i < r.pts.length; i++) { const w = 0.32 + i * 0.045; if (segDist(x, y, r.pts[i - 1], r.pts[i]) < w) return r; } return null; }
  function lakeAt(x, y) { for (const l of LAKES) { const wob = (nz(x / 3, y / 3, 11) - 0.5) * 0.35; if (((x - l.x) / l.rx) ** 2 + ((y - l.y) / l.ry) ** 2 < 1 + wob) return l; } return null; }
  function regionAt(x, y) {
    let best = null, bv = 1;
    for (const r of REGIONS) { const wob = (nz(x / 5, y / 5, r.x) - 0.5) * 0.7; const v = ((x - r.x) / r.rx) ** 2 + ((y - r.y) / r.ry) ** 2 - wob; if (v < bv) { bv = v; best = r; } }
    return best ? { r: best, depth: 1 - bv } : null;
  }
  // 'sea' | 'beach' | 'lake' | 'river' | 'peak' | 'mountain' | 'forest' | 'farm' | 'grass' | 'moor' | 'marsh'
  function terrainAt(x, y) {
    if (!landAt(x, y)) return 'sea';
    if (!landAt(x + 1.2, y) || !landAt(x - 1.2, y) || !landAt(x, y + 1.2) || !landAt(x, y - 1.2)) return 'beach';
    if (lakeAt(x, y)) return 'lake';
    if (riverAt(x, y)) return 'river';
    const g = regionAt(x, y);
    if (g) {
      if (g.r.kind === 'mountain') return g.depth > 0.55 ? 'peak' : 'mountain';
      if (g.r.kind === 'forest') return 'forest';
    }
    if (y < 22 && x > 74) return 'moor';
    const blob = (cx, cy, rx, ry, seed) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + (nz(x / 5, y / 5, seed) - 0.5) * 1.2;
    if (blob(28, 66, 7, 5, 9) || blob(20, 70, 5, 4, 13)) return 'marsh';
    if ((blob(64, 64, 22, 10, 77) || blob(86, 64, 10, 7, 79) || blob(42, 58, 7, 5, 81)) && nz(x / 3, y / 3, 83) > 0.3) return 'farm';
    return nz(x / 4, y / 4, 31) > 0.68 ? 'forest' : 'grass';
  }
  function regionName(x, y) { const g = regionAt(x, y); if (g) return g.r.name; const t = terrainAt(x, y); return t === 'farm' ? 'the farmlands' : t === 'moor' ? 'the moors' : t === 'marsh' ? 'the marshes' : 'open country'; }

  function places(Sx) {
    return S.map(([id, name, kind, x, y, pop, region, area, title, produces]) => Sx({ id, name, kind, x, y, pop, region, area, leader: `${title} of ${name.replace(' Castle', '')}`, produces,
      wealth: kind === 'capital' ? 0.85 : kind === 'castle' ? 0.8 : id === 'goldmere' ? 0.75 : kind === 'town' || kind === 'port' ? 0.55 : kind === 'hamlet' ? 0.3 : 0.42,
      guards: kind === 'capital' ? 60 : kind === 'castle' ? 40 : kind === 'town' || kind === 'port' ? 12 : kind === 'village' ? 3 : 1,
      priority: kind === 'castle' ? 'security' : produces.grain > 60 ? 'food' : 'roads', detailed: id === 'ashford' }));
  }
  function roads() { return ROADS.map(([a, b, q, d, br, name]) => ({ a, b, quality: q, danger: d, bridge: br, name, damaged: false })); }

  O.Eldoria = { W, H, REGIONS, LAKES, RIVERS, RUINS, SETTLEMENTS: S, ROADS, places, roads, terrainAt, landAt, regionAt, regionName, riverAt, lakeAt };
})();
