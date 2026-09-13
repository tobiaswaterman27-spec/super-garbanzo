/* parts.js — the appearance vocabulary: palettes, hair, facial hair, garments.
 *
 * Everything here is data. Hair and beards are box sets expressed in head-bone
 * space, so they scale with the skull and rotate with it for free.
 *
 * Head-bone space: the skull occupies x -hw/2..hw/2, y 0..hh, z -hd/2..hd/2,
 * with +Z as the face. The vertical layout of the face is fixed:
 *
 *   y 5.6 .. 8.5   hair / fringe
 *   y 5.0 .. 5.6   brows
 *   y 3.7 .. 5.0   eyes
 *   y 2.5 .. 4.2   nose
 *   y 1.9 .. 2.5   moustache
 *   y 1.1 .. 1.9   mouth
 *   y 0.0 .. 1.1   chin
 */
(function (global) {
  'use strict';

  /* ---------- palettes ---------- */

  const SKIN_TONES = [
    { id: 'porcelain', label: 'Porcelain', hex: '#f2d3bb' },
    { id: 'fair', label: 'Fair', hex: '#e8bd9a' },
    { id: 'light', label: 'Light', hex: '#dca87e' },
    { id: 'warm', label: 'Warm', hex: '#c78e62' },
    { id: 'olive', label: 'Olive', hex: '#ad7a4e' },
    { id: 'tan', label: 'Tan', hex: '#94633c' },
    { id: 'bronze', label: 'Bronze', hex: '#79502f' },
    { id: 'umber', label: 'Umber', hex: '#603d24' },
    { id: 'deep', label: 'Deep', hex: '#4a2e1b' },
    { id: 'ebony', label: 'Ebony', hex: '#372014' }
  ];

  const HAIR_COLOURS = [
    { id: 'raven', label: 'Raven', hex: '#1d1a1c' },
    { id: 'soot', label: 'Soot', hex: '#2e2723' },
    { id: 'darkbrown', label: 'Dark brown', hex: '#432d1e' },
    { id: 'brown', label: 'Brown', hex: '#5d3c22' },
    { id: 'chestnut', label: 'Chestnut', hex: '#7a4a25' },
    { id: 'auburn', label: 'Auburn', hex: '#8a3f21' },
    { id: 'ginger', label: 'Ginger', hex: '#a8511f' },
    { id: 'copper', label: 'Copper', hex: '#bd6a2a' },
    { id: 'sand', label: 'Sand', hex: '#b79358' },
    { id: 'wheat', label: 'Wheat', hex: '#cdae6f' },
    { id: 'flaxen', label: 'Flaxen', hex: '#ddc98d' },
    { id: 'ash', label: 'Ash', hex: '#8d8377' },
    { id: 'iron', label: 'Iron', hex: '#6e6a66' },
    { id: 'silver', label: 'Silver', hex: '#b3aea6' },
    { id: 'white', label: 'White', hex: '#ded9d0' }
  ];

  const EYE_COLOURS = [
    { id: 'darkbrown', label: 'Dark brown', hex: '#4a2f1c' },
    { id: 'brown', label: 'Brown', hex: '#6b4522' },
    { id: 'hazel', label: 'Hazel', hex: '#8a6a30' },
    { id: 'amber', label: 'Amber', hex: '#a87a2a' },
    { id: 'green', label: 'Green', hex: '#46714f' },
    { id: 'moss', label: 'Moss', hex: '#5c6f42' },
    { id: 'blue', label: 'Blue', hex: '#456c90' },
    { id: 'pale', label: 'Pale blue', hex: '#7099b4' },
    { id: 'grey', label: 'Grey', hex: '#6b7178' }
  ];

  // Dyes a peasant kingdom could actually produce — woad, madder, weld, walnut.
  const CLOTH_COLOURS = [
    { id: 'undyed', label: 'Undyed wool', hex: '#b9ab8f' },
    { id: 'flax', label: 'Flax', hex: '#a99676' },
    { id: 'walnut', label: 'Walnut', hex: '#6d4f35' },
    { id: 'bark', label: 'Bark', hex: '#54402e' },
    { id: 'moss', label: 'Moss green', hex: '#4f5c39' },
    { id: 'forest', label: 'Forest', hex: '#37472f' },
    { id: 'woad', label: 'Woad blue', hex: '#3c5068' },
    { id: 'slate', label: 'Slate', hex: '#454e5b' },
    { id: 'madder', label: 'Madder red', hex: '#7d3630' },
    { id: 'oxblood', label: 'Oxblood', hex: '#5a2a29' },
    { id: 'weld', label: 'Weld yellow', hex: '#9c8235' },
    { id: 'saffron', label: 'Saffron', hex: '#b58b30' },
    { id: 'plum', label: 'Plum', hex: '#4e3548' },
    { id: 'charcoal', label: 'Charcoal', hex: '#33333a' }
  ];

  const LEATHER_COLOURS = [
    { id: 'tan', label: 'Tan', hex: '#7a5735' },
    { id: 'brown', label: 'Brown', hex: '#5b4028' },
    { id: 'dark', label: 'Dark', hex: '#3f2d1d' },
    { id: 'black', label: 'Black', hex: '#2a2420' }
  ];

  const BRASS = '#9c7b33';

  /* ---------- shape helpers ---------- */

  const G = global.Geo;

  // Must match the skull in character.js, so hair sits concentric with it.
  const HEAD_E = 0.42;
  const HAIRLINE = 5.75;   // just clear of the brows, which top out at 5.6

  function b(x, y, z, w, h, d) { return G.box(x, y, z, w, h, d); }

  // The crown is a dome *concentric with the skull*, sliced off at the
  // hairline. Sitting a separate rounded lump on top of the head instead is
  // what made every character look like they were wearing a mushroom.
  function crown(hw, hh, hd, hairline, grow) {
    const g = grow === undefined ? 0.35 : grow;
    return G.dome(0, hh / 2, 0, hw / 2 + g, hh / 2 + g, hd / 2 + g, HEAD_E,
      hairline === undefined ? HAIRLINE : hairline, 4, 12);
  }

  // Hair falling down the back, narrowing as it goes.
  function fall(hw, hh, hd, len, width, taperTo, fromY) {
    const w = hw * (width === undefined ? 1 : width);
    const top = fromY === undefined ? 6.4 : fromY;
    return G.slab(-w / 2, top - len, -hd / 2 - 0.55, w, len, 1.8, 1,
      taperTo === undefined ? 0.78 : taperTo);
  }

  function sideFall(hw, hh, hd, len, taperTo, fromY) {
    const t = taperTo === undefined ? 0.75 : taperTo;
    const top = fromY === undefined ? 6.2 : fromY;
    return [
      G.slab(-hw / 2 - 0.45, top - len, -hd / 2 - 0.1, 1.25, len, hd + 0.2, 1, t),
      G.slab(hw / 2 - 0.8, top - len, -hd / 2 - 0.1, 1.25, len, hd + 0.2, 1, t)
    ];
  }

  // `drop` is how far below the hairline it hangs over the brow.
  function fringe(hw, hh, hd, drop) {
    const d0 = drop === undefined ? 0.5 : drop;
    return G.slab(-hw / 2 + 0.2, HAIRLINE - d0, hd / 2 - 1.1, hw - 0.4, d0 + 0.9, 1.6, 1, 0.92);
  }

  /* ---------- hair ---------- */

  const HAIR_STYLES = [
    {
      id: 'bald', label: 'Bald', femaleBias: 0.02,
      build: function () { return []; }
    },
    {
      id: 'buzz', label: 'Buzzed', femaleBias: 0.06,
      build: function (hw, hh, hd) {
        return [crown(hw, hh, hd, 6.1, 0.18)];
      }
    },
    {
      id: 'crop', label: 'Cropped', femaleBias: 0.18,
      build: function (hw, hh, hd) {
        return [crown(hw, hh, hd), fringe(hw, hh, hd, 0.45), fall(hw, hh, hd, 1.5, 0.95)];
      }
    },
    {
      id: 'bowl', label: 'Bowl cut', femaleBias: 0.4,
      build: function (hw, hh, hd) {
        return [crown(hw, hh, hd, 5.5), fringe(hw, hh, hd, 1.4), fall(hw, hh, hd, 2.6, 1, 0.95)]
          .concat(sideFall(hw, hh, hd, 2.8, 0.95));
      }
    },
    {
      id: 'sidepart', label: 'Side part', femaleBias: 0.3,
      build: function (hw, hh, hd) {
        return [
          crown(hw, hh, hd),
          // a sweep across the brow, thicker on one side
          G.slab(-hw / 2 + 0.1, HAIRLINE - 0.9, hd / 2 - 1.1, hw * 0.58, 1.9, 1.7, 1, 0.62),
          G.slab(hw * 0.02, HAIRLINE - 0.3, hd / 2 - 1.1, hw * 0.46, 1.3, 1.6, 1, 0.72),
          fall(hw, hh, hd, 1.5, 0.95)
        ];
      }
    },
    {
      id: 'spiky', label: 'Spiked', femaleBias: 0.2,
      build: function (hw, hh, hd) {
        // Real spikes: pyramids rising out of the crown and leaning outward,
        // rather than stacked cubes pretending to be points.
        const out = [crown(hw, hh, hd, 6.0, 0.25)];
        const spikes = [
          [-2.6, -1.7, 3.4, -0.9, -0.7], [-0.5, 0.8, 4.3, -0.2, 0.5],
          [1.7, -1.0, 3.8, 0.8, -0.5], [2.5, 1.4, 3.0, 1.1, 0.8],
          [-1.9, 2.4, 3.2, -0.6, 1.0], [0.6, -2.8, 3.6, 0.2, -1.1],
          [-3.0, 0.6, 2.8, -1.2, 0.3], [1.2, 2.7, 2.6, 0.5, 1.2]
        ];
        for (let i = 0; i < spikes.length; i++) {
          const sx = spikes[i][0] * (hw / 8), sz = spikes[i][1] * (hd / 8);
          const len = spikes[i][2], lx = spikes[i][3], lz = spikes[i][4];
          out.push(G.pyramid(sx - 1.2, hh - 1.7, sz - 1.2, 2.4, len, 2.4, lx, lz));
        }
        return out;
      }
    },
    {
      id: 'mohawk', label: 'Mohawk', femaleBias: 0.25,
      build: function (hw, hh, hd) {
        const out = [crown(hw, hh, hd, 6.6, 0.14)];
        for (let i = 0; i < 5; i++) {
          const t = i / 4;
          const sz = -hd / 2 + 0.6 + t * (hd - 1.2);
          const hgt = 2.2 + Math.sin(t * Math.PI) * 1.6;
          out.push(G.pyramid(-1.0, hh - 1.6, sz - 0.9, 2.0, hgt, 1.8, 0, 0));
        }
        return out;
      }
    },
    {
      id: 'topknot', label: 'Top knot', femaleBias: 0.45,
      build: function (hw, hh, hd) {
        return [
          crown(hw, hh, hd),
          G.taper(-0.9, hh + 0.1, -0.9, 1.8, 1.3, 1.8, 0.8),
          G.superellipsoid(0, hh + 2.0, 0, 1.8, 1.6, 1.8, 0.85, 4, 8),
          fall(hw, hh, hd, 1.3, 0.9)
        ];
      }
    },
    {
      id: 'shoulder', label: 'Shoulder length', femaleBias: 0.66,
      build: function (hw, hh, hd) {
        return [crown(hw, hh, hd), fringe(hw, hh, hd, 0.7), fall(hw, hh, hd, 5.6, 1.0, 0.72)]
          .concat(sideFall(hw, hh, hd, 4.6, 0.7));
      }
    },
    {
      id: 'long', label: 'Long', femaleBias: 0.78,
      build: function (hw, hh, hd) {
        return [crown(hw, hh, hd), fringe(hw, hh, hd, 0.6), fall(hw, hh, hd, 9.8, 1.02, 0.6)]
          .concat(sideFall(hw, hh, hd, 7.0, 0.62));
      }
    },
    {
      id: 'ponytail', label: 'Ponytail', femaleBias: 0.7,
      build: function (hw, hh, hd) {
        return [
          crown(hw, hh, hd),
          fall(hw, hh, hd, 1.5, 0.95),
          G.superellipsoid(0, 6.0, -hd / 2 - 1.2, 1.5, 1.3, 1.3, 0.8, 4, 8),
          // the tail itself, tapering and swept back
          G.slab(-1.1, 0.4, -hd / 2 - 2.8, 2.2, 5.6, 2.2, 0.45, 1.0, 0, -0.9)
        ];
      }
    },
    {
      id: 'braids', label: 'Twin braids', femaleBias: 0.85,
      build: function (hw, hh, hd) {
        const out = [crown(hw, hh, hd), fringe(hw, hh, hd, 0.6), fall(hw, hh, hd, 2.0, 1)];
        for (let side = 0; side < 2; side++) {
          const sx = side === 0 ? -hw / 2 - 0.9 : hw / 2 - 0.9;
          for (let k = 0; k < 5; k++) {
            const w = 1.9 - k * 0.22;
            out.push(G.superellipsoid(sx + 0.9, 5.4 - k * 1.55, -0.5 - k * 0.3,
              w / 2, 0.95, w / 2, 0.75, 3, 7));
          }
        }
        return out;
      }
    },
    {
      id: 'pigtails', label: 'Pigtails', femaleBias: 0.88,
      build: function (hw, hh, hd) {
        return [
          crown(hw, hh, hd), fringe(hw, hh, hd, 0.6), fall(hw, hh, hd, 1.7, 0.95),
          G.superellipsoid(-hw / 2 - 1.0, 5.6, -0.4, 2.0, 1.9, 1.9, 0.8, 4, 8),
          G.superellipsoid(hw / 2 + 1.0, 5.6, -0.4, 2.0, 1.9, 1.9, 0.8, 4, 8)
        ];
      }
    },
    {
      id: 'curly', label: 'Curled', femaleBias: 0.55,
      build: function (hw, hh, hd) {
        // a mass of overlapping balls rather than a slab
        const out = [crown(hw, hh, hd, 5.6, 0.25)];
        const ring = [
          [-3.4, 0.4, -1.6], [3.4, 0.4, -1.6], [-3.2, -1.6, -2.0], [3.2, -1.6, -2.0],
          [-2.2, 1.4, -4.0], [1.4, 1.4, -4.0], [-2.4, 1.2, 3.2], [1.6, 1.2, 3.2],
          [-1.0, 2.4, 0.0], [1.6, 2.2, -2.2], [0.0, -1.8, -4.2]
        ];
        for (let i = 0; i < ring.length; i++) {
          out.push(G.superellipsoid(ring[i][0], 6.6 + ring[i][1], ring[i][2],
            1.5, 1.4, 1.5, 0.85, 3, 7));
        }
        return out;
      }
    },
    {
      id: 'bun', label: 'Coiled bun', femaleBias: 0.82,
      build: function (hw, hh, hd) {
        return [
          crown(hw, hh, hd), fringe(hw, hh, hd, 0.45), fall(hw, hh, hd, 1.6, 0.95),
          G.superellipsoid(0, 6.4, -hd / 2 - 1.9, 2.4, 2.2, 2.0, 0.8, 4, 9)
        ];
      }
    }
  ];

  /* ---------- moustaches ----------
   *
   * Always seated below the nose (which bottoms out at y 2.5) and above the
   * mouth (which starts at 1.9). They sit proud of the face, not flush to it.
   */

  const MOUSTACHE_Y = 1.92;

  const MOUSTACHES = [
    { id: 'none', label: 'None', maleBias: 0.4, build: function () { return []; } },
    {
      id: 'thin', label: 'Thin', maleBias: 0.14,
      build: function (hw, hh, hd) {
        return [G.slab(-1.7, MOUSTACHE_Y + 0.1, hd / 2 - 0.15, 3.4, 0.5, 0.85, 1, 0.8)];
      }
    },
    {
      id: 'full', label: 'Full', maleBias: 0.18,
      build: function (hw, hh, hd) {
        return [G.slab(-2.1, MOUSTACHE_Y, hd / 2 - 0.2, 4.2, 0.8, 1.1, 0.85, 1)];
      }
    },
    {
      id: 'handlebar', label: 'Handlebar', maleBias: 0.1,
      build: function (hw, hh, hd) {
        return [
          G.slab(-2.0, MOUSTACHE_Y, hd / 2 - 0.2, 4.0, 0.7, 1.0, 0.9, 1),
          // curled ends, tapering to a point and sweeping upward
          G.taper(-3.1, MOUSTACHE_Y + 0.3, hd / 2 - 0.15, 1.2, 1.1, 0.85, 0.25, -0.35, 0),
          G.taper(1.9, MOUSTACHE_Y + 0.3, hd / 2 - 0.15, 1.2, 1.1, 0.85, 0.25, 0.35, 0)
        ];
      }
    },
    {
      id: 'walrus', label: 'Walrus', maleBias: 0.09,
      build: function (hw, hh, hd) {
        return [G.slab(-2.5, MOUSTACHE_Y - 0.9, hd / 2 - 0.25, 5.0, 1.7, 1.3, 1, 0.78)];
      }
    }
  ];

  /* ---------- beards ----------
   *
   * No moustache component anywhere in here. Long beards hang off the chin and
   * taper to a point rather than being a brick glued to the jaw.
   */

  const BEARDS = [
    { id: 'none', label: 'Clean shaven', maleBias: 0.3, build: function () { return []; } },
    {
      id: 'stubble', label: 'Stubble', maleBias: 0.18,
      build: function (hw, hh, hd) {
        return [G.superellipsoid(0, 1.1, 0.35, hw / 2 + 0.12, 1.7, hd / 2 + 0.12, 0.45, 4, 9)];
      }
    },
    {
      id: 'chin', label: 'Chin patch', maleBias: 0.09,
      build: function (hw, hh, hd) {
        return [G.slab(-1.1, 0.2, hd / 2 - 0.4, 2.2, 1.4, 1.1, 0.8, 1)];
      }
    },
    {
      id: 'goatee', label: 'Goatee', maleBias: 0.12,
      build: function (hw, hh, hd) {
        return [
          G.slab(-1.3, 0.0, hd / 2 - 0.5, 2.6, 1.8, 1.3, 0.85, 1),
          G.taper(-1.0, -2.2, hd / 2 - 0.6, 2.0, 2.3, 1.3, 0.3, 0, 0.2)
        ];
      }
    },
    {
      id: 'chops', label: 'Mutton chops', maleBias: 0.06,
      build: function (hw, hh, hd) {
        return [
          G.slab(-hw / 2 - 0.55, 0.9, -hd / 2 + 1.6, 1.0, 3.0, hd - 1.4, 1, 0.55),
          G.slab(hw / 2 - 0.45, 0.9, -hd / 2 + 1.6, 1.0, 3.0, hd - 1.4, 1, 0.55)
        ];
      }
    },
    {
      id: 'short', label: 'Short beard', maleBias: 0.13,
      build: function (hw, hh, hd) {
        return [
          G.superellipsoid(0, 0.8, 0.5, hw / 2 + 0.25, 2.1, hd / 2 + 0.25, 0.45, 4, 9),
          G.slab(-hw / 2 + 0.7, -1.2, hd / 2 - 1.9, hw - 1.4, 1.6, 2.2, 1, 0.75)
        ];
      }
    },
    {
      id: 'full', label: 'Full beard', maleBias: 0.08,
      build: function (hw, hh, hd) {
        return [
          G.superellipsoid(0, 0.5, 0.6, hw / 2 + 0.4, 2.4, hd / 2 + 0.4, 0.45, 5, 10),
          G.slab(-hw / 2 + 0.4, -3.0, hd / 2 - 2.4, hw - 0.8, 3.2, 2.8, 1, 0.7)
        ];
      }
    },
    {
      id: 'long', label: 'Long beard', maleBias: 0.04,
      build: function (hw, hh, hd) {
        return [
          G.superellipsoid(0, 0.3, 0.6, hw / 2 + 0.4, 2.5, hd / 2 + 0.4, 0.45, 5, 10),
          G.slab(-hw / 2 + 0.5, -4.4, hd / 2 - 2.5, hw - 1.0, 4.4, 2.9, 1, 0.66),
          // it hangs free of the chin and comes to a point
          G.taper(-1.7, -8.0, hd / 2 - 2.2, 3.4, 3.8, 2.4, 0.22, 0, 0.1)
        ];
      }
    }
  ];

  /* ---------- face feature variation ---------- */

  const EYE_SHAPES = [
    { id: 'round', label: 'Round', w: 1.62, h: 1.28 },
    { id: 'even', label: 'Even', w: 1.72, h: 1.1 },
    { id: 'narrow', label: 'Narrow', w: 1.8, h: 0.84 },
    { id: 'wide', label: 'Wide', w: 1.72, h: 1.45 },
    { id: 'hooded', label: 'Hooded', w: 1.62, h: 0.92 }
  ];

  // inner/outer are vertical offsets at each end of the brow; `gap` widens the
  // space between the pair so they never meet in the middle.
  const BROW_SHAPES = [
    { id: 'flat', label: 'Flat', inner: 0, outer: 0, thick: 0.5, gap: 0.5 },
    { id: 'raised', label: 'Raised', inner: 0.0, outer: 0.5, thick: 0.48, gap: 0.55 },
    { id: 'angled', label: 'Angled', inner: -0.45, outer: 0.32, thick: 0.55, gap: 0.4 },
    { id: 'arched', label: 'Arched', inner: 0.42, outer: 0.08, thick: 0.44, gap: 0.6 },
    { id: 'heavy', label: 'Heavy', inner: -0.18, outer: -0.08, thick: 0.85, gap: 0.35 },
    { id: 'fine', label: 'Fine', inner: 0.1, outer: 0.22, thick: 0.36, gap: 0.7 }
  ];

  const NOSE_SHAPES = [
    { id: 'small', label: 'Small', w: 1.3, h: 1.1, len: 0.55 },
    { id: 'straight', label: 'Straight', w: 1.5, h: 1.5, len: 0.8 },
    { id: 'broad', label: 'Broad', w: 2.1, h: 1.3, len: 0.72 },
    { id: 'long', label: 'Long', w: 1.4, h: 2.0, len: 0.88 },
    { id: 'hooked', label: 'Hooked', w: 1.5, h: 1.8, len: 1.1 },
    { id: 'button', label: 'Button', w: 1.6, h: 0.95, len: 0.6 }
  ];

  /* ---------- garments ----------
   *
   * The medieval read comes from the silhouette: a tunic that falls past the
   * belt to mid-thigh over hose, not a t-shirt tucked into trousers.
   */

  const GARMENTS = [
    { id: 'tunic', label: 'Tunic & hose', femaleBias: 0.3, skirt: 4.2, sleeves: 'long', belt: true },
    { id: 'surcoat', label: 'Surcoat', femaleBias: 0.4, skirt: 5.4, sleeves: 'long', belt: true, tabard: true },
    { id: 'jerkin', label: 'Jerkin', femaleBias: 0.22, skirt: 3.2, sleeves: 'short', belt: true },
    { id: 'dress', label: 'Long dress', femaleBias: 0.94, skirt: 7.6, sleeves: 'long', belt: true },
    { id: 'robe', label: 'Robe', femaleBias: 0.5, skirt: 6.4, sleeves: 'wide', belt: false, hood: true }
  ];

  /* ---------- names ---------- */

  const MALE_NAMES = [
    'Aldric', 'Edwin', 'Thomas', 'Garrick', 'Bran', 'Cedric', 'Roland', 'Hugh',
    'Oswin', 'Wulfric', 'Merek', 'Godwin', 'Alaric', 'Dunstan', 'Leofric',
    'Rowan', 'Emeric', 'Baldwin', 'Corbin', 'Halden', 'Osric', 'Warin',
    'Tobias', 'Rurik', 'Maddox', 'Everard', 'Gilbert', 'Harlan', 'Ansel',
    'Brom', 'Cuthbert', 'Drogo', 'Elric', 'Fenwick', 'Gregor', 'Hamon'
  ];

  const FEMALE_NAMES = [
    'Mara', 'Elspeth', 'Rowena', 'Isolde', 'Maud', 'Agnes', 'Beatrix', 'Edith',
    'Gwyneth', 'Linnet', 'Sibyl', 'Thea', 'Wynn', 'Aveline', 'Cecily', 'Morwen',
    'Alys', 'Briony', 'Constance', 'Dervla', 'Eluned', 'Hawise', 'Ingrid',
    'Joslyn', 'Katrin', 'Leofgyth', 'Mabel', 'Nesta', 'Orla', 'Petronel',
    'Rhiannon', 'Sabina', 'Tamsin', 'Ursel', 'Verity', 'Winifred'
  ];

  const SURNAMES = [
    'Blackwood', 'Harrow', 'Thatcher', 'Fletcher', 'Mason', 'Cooper', 'Ashdown',
    'Greaves', 'Marsh', 'Weaver', 'Stoneford', 'Hale', 'Brackley', 'Vance',
    'Orme', 'Quill', 'Corvin', 'Millward', 'Underhill', 'Rookwood', 'Skelton',
    'Fairweather', 'Pike', 'Cartwright', 'Lockwood', 'Barrow', 'Wren', 'Holt'
  ];

  global.Parts = {
    SKIN_TONES, HAIR_COLOURS, EYE_COLOURS, CLOTH_COLOURS, LEATHER_COLOURS, BRASS,
    HAIR_STYLES, MOUSTACHES, BEARDS, EYE_SHAPES, BROW_SHAPES, NOSE_SHAPES, GARMENTS,
    MALE_NAMES, FEMALE_NAMES, SURNAMES,
    box: b
  };
})(window);
