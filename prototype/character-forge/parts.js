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

  /* ---------- box helper ---------- */

  function b(x, y, z, w, h, d) { return { x: x, y: y, z: z, w: w, h: h, d: d }; }

  /* ---------- hair ----------
   *
   * Every piece is anchored to TOP (= hh + 0.5) and overlaps the cap by 1.2
   * units. Pieces that merely *touched* left a one-pixel seam ringing the
   * skull once the model was rotated, which is the gap that was showing.
   */

  function top(hh) { return hh + 0.5; }

  function capBox(hw, hh, hd, thickness) {
    const t = thickness === undefined ? 2.4 : thickness;
    return b(-hw / 2 - 0.35, top(hh) - t, -hd / 2 - 0.35, hw + 0.7, t, hd + 0.7);
  }

  function backBox(hw, hh, hd, len, thick) {
    const t = thick === undefined ? 1.2 : thick;
    return b(-hw / 2 - 0.35, top(hh) - 1.2 - len, -hd / 2 - 0.35, hw + 0.7, len + 1.2, t);
  }

  function sideBoxes(hw, hh, hd, len, thick) {
    const t = thick === undefined ? 0.95 : thick;
    return [
      b(-hw / 2 - 0.35, top(hh) - 1.2 - len, -hd / 2 - 0.35, t, len + 1.2, hd + 0.7),
      b(hw / 2 + 0.35 - t, top(hh) - 1.2 - len, -hd / 2 - 0.35, t, len + 1.2, hd + 0.7)
    ];
  }

  function fringeBox(hw, hh, hd, drop) {
    const d0 = drop === undefined ? 1.4 : drop;
    return b(-hw / 2 - 0.35, top(hh) - 1.2 - d0, hd / 2 - 0.55, hw + 0.7, d0 + 1.2, 1.05);
  }

  const HAIR_STYLES = [
    {
      id: 'bald', label: 'Bald', femaleBias: 0.02,
      build: function () { return []; }
    },
    {
      id: 'buzz', label: 'Buzzed', femaleBias: 0.06,
      build: function (hw, hh, hd) {
        return [capBox(hw, hh, hd, 1.6), backBox(hw, hh, hd, 0.6, 0.7)]
          .concat(sideBoxes(hw, hh, hd, 0.6, 0.6));
      }
    },
    {
      id: 'crop', label: 'Cropped', femaleBias: 0.18,
      build: function (hw, hh, hd) {
        return [capBox(hw, hh, hd, 2.2), fringeBox(hw, hh, hd, 0.7), backBox(hw, hh, hd, 1.5)]
          .concat(sideBoxes(hw, hh, hd, 1.2));
      }
    },
    {
      id: 'bowl', label: 'Bowl cut', femaleBias: 0.4,
      build: function (hw, hh, hd) {
        return [capBox(hw, hh, hd), fringeBox(hw, hh, hd, 1.7), backBox(hw, hh, hd, 2.4)]
          .concat(sideBoxes(hw, hh, hd, 2.4));
      }
    },
    {
      id: 'sidepart', label: 'Side part', femaleBias: 0.3,
      build: function (hw, hh, hd) {
        return [
          capBox(hw, hh, hd),
          // the parting: a thicker sweep on one side, a flat sweep on the other
          b(-hw / 2 - 0.35, top(hh) - 3.1, hd / 2 - 0.55, hw * 0.6, 1.9, 1.05),
          b(hw * 0.1, top(hh) - 2.5, hd / 2 - 0.55, hw * 0.4 + 0.35, 1.3, 1.05),
          backBox(hw, hh, hd, 1.6)
        ].concat(sideBoxes(hw, hh, hd, 1.5));
      }
    },
    {
      id: 'spiky', label: 'Spiked', femaleBias: 0.2,
      build: function (hw, hh, hd) {
        // A thick cap, then each spike gets a wide base sunk into that cap and a
        // narrower tip above it, so the spikes read as one joined mass of hair
        // rather than separate floating blocks.
        const out = [capBox(hw, hh, hd, 2.6), backBox(hw, hh, hd, 1.0, 0.9)];
        const t = top(hh);
        const spikes = [
          [-2.9, -1.9, 2.0], [-0.9, 0.9, 2.7], [1.3, -0.7, 2.2],
          [2.2, 1.7, 1.7], [-1.6, -2.9, 1.6], [0.4, 2.4, 1.9]
        ];
        for (let i = 0; i < spikes.length; i++) {
          const sx = spikes[i][0] * (hw / 8), sz = spikes[i][1] * (hd / 8), hgt = spikes[i][2];
          // The base is buried in the cap and the tip is buried in the base —
          // each pair overlaps by a full unit, so the spikes read as one mass
          // of hair rising out of the scalp rather than floating blocks.
          out.push(b(sx, t - 1.4, sz, 2.2, 2.2, 2.2));
          out.push(b(sx + 0.45, t - 0.4, sz + 0.45, 1.3, hgt + 1.1, 1.3));
        }
        return out.concat(sideBoxes(hw, hh, hd, 0.8, 0.7));
      }
    },
    {
      id: 'mohawk', label: 'Mohawk', femaleBias: 0.25,
      build: function (hw, hh, hd) {
        const t = top(hh);
        return [
          b(-hw / 2 - 0.35, t - 1.3, -hd / 2 - 0.35, hw + 0.7, 1.3, hd + 0.7),
          b(-1.1, t - 0.6, -hd / 2 - 0.2, 2.2, 2.0, hd + 0.4),
          b(-0.8, t + 1.2, -hd / 2 + 0.4, 1.6, 1.4, hd - 0.4)
        ];
      }
    },
    {
      id: 'topknot', label: 'Top knot', femaleBias: 0.45,
      build: function (hw, hh, hd) {
        return [
          capBox(hw, hh, hd, 2.2),
          b(-1.7, top(hh) - 0.6, -1.7, 3.4, 2.4, 3.4),
          backBox(hw, hh, hd, 1.4)
        ].concat(sideBoxes(hw, hh, hd, 1.2));
      }
    },
    {
      id: 'shoulder', label: 'Shoulder length', femaleBias: 0.66,
      build: function (hw, hh, hd) {
        return [capBox(hw, hh, hd), fringeBox(hw, hh, hd, 1.3), backBox(hw, hh, hd, 5.2, 1.4)]
          .concat(sideBoxes(hw, hh, hd, 4.4, 1.1));
      }
    },
    {
      id: 'long', label: 'Long', femaleBias: 0.78,
      build: function (hw, hh, hd) {
        return [capBox(hw, hh, hd), fringeBox(hw, hh, hd, 1.2), backBox(hw, hh, hd, 9.0, 1.5)]
          .concat(sideBoxes(hw, hh, hd, 6.6, 1.2));
      }
    },
    {
      id: 'ponytail', label: 'Ponytail', femaleBias: 0.7,
      build: function (hw, hh, hd) {
        return [
          capBox(hw, hh, hd), backBox(hw, hh, hd, 1.6),
          b(-1.2, top(hh) - 4.2, -hd / 2 - 1.9, 2.4, 2.2, 1.8),
          b(-1.0, top(hh) - 9.2, -hd / 2 - 2.3, 2.0, 5.2, 1.7)
        ].concat(sideBoxes(hw, hh, hd, 1.6));
      }
    },
    {
      id: 'braids', label: 'Twin braids', femaleBias: 0.85,
      build: function (hw, hh, hd) {
        const out = [capBox(hw, hh, hd), fringeBox(hw, hh, hd, 1.2), backBox(hw, hh, hd, 2.2)]
          .concat(sideBoxes(hw, hh, hd, 2.0));
        for (let side = 0; side < 2; side++) {
          const sx = side === 0 ? -hw / 2 - 1.1 : hw / 2 - 0.4;
          for (let k = 0; k < 4; k++) {
            const w = 1.6 - k * 0.16;
            out.push(b(sx + (1.5 - w) / 2, top(hh) - 3.6 - k * 1.7, -0.9 - k * 0.22, w, 1.8, 1.7));
          }
        }
        return out;
      }
    },
    {
      id: 'pigtails', label: 'Pigtails', femaleBias: 0.88,
      build: function (hw, hh, hd) {
        return [
          capBox(hw, hh, hd), fringeBox(hw, hh, hd, 1.3), backBox(hw, hh, hd, 1.8),
          b(-hw / 2 - 2.3, top(hh) - 4.6, -1.5, 2.5, 2.9, 2.9),
          b(hw / 2 - 0.2, top(hh) - 4.6, -1.5, 2.5, 2.9, 2.9)
        ].concat(sideBoxes(hw, hh, hd, 2.0));
      }
    },
    {
      id: 'curly', label: 'Curled', femaleBias: 0.55,
      build: function (hw, hh, hd) {
        // overlapping puffs, each sunk into the cap so no seams open up
        const out = [capBox(hw, hh, hd, 2.2)].concat(sideBoxes(hw, hh, hd, 1.6));
        const t = top(hh);
        const puffs = [
          [-hw / 2 - 0.9, t - 2.0, -1.7], [hw / 2 - 1.4, t - 2.0, -1.7],
          [-hw / 2 - 0.8, t - 3.9, -2.4], [hw / 2 - 1.5, t - 3.9, -2.4],
          [-2.4, t - 0.9, -hd / 2 - 1.1], [0.3, t - 0.9, -hd / 2 - 1.1],
          [-2.5, t - 0.7, hd / 2 - 1.2], [0.4, t - 0.7, hd / 2 - 1.2]
        ];
        for (let i = 0; i < puffs.length; i++) {
          out.push(b(puffs[i][0], puffs[i][1], puffs[i][2], 2.4, 2.4, 2.4));
        }
        return out;
      }
    },
    {
      id: 'bun', label: 'Coiled bun', femaleBias: 0.82,
      build: function (hw, hh, hd) {
        return [
          capBox(hw, hh, hd), fringeBox(hw, hh, hd, 1.0), backBox(hw, hh, hd, 2.0),
          b(-2.0, top(hh) - 3.4, -hd / 2 - 2.5, 4.0, 3.6, 2.8)
        ].concat(sideBoxes(hw, hh, hd, 2.4));
      }
    }
  ];

  /* ---------- moustaches ----------
   *
   * Separate from beards, and always seated below the nose (the nose bottoms
   * out at y 2.5, the mouth starts at 1.9).
   */

  const MOUSTACHE_Y = 1.92;

  const MOUSTACHES = [
    { id: 'none', label: 'None', maleBias: 0.4, build: function () { return []; } },
    {
      id: 'thin', label: 'Thin', maleBias: 0.14,
      build: function (hw, hh, hd) {
        return [b(-1.7, MOUSTACHE_Y + 0.1, hd / 2 - 0.12, 3.4, 0.5, 0.62)];
      }
    },
    {
      id: 'full', label: 'Full', maleBias: 0.18,
      build: function (hw, hh, hd) {
        return [b(-2.1, MOUSTACHE_Y, hd / 2 - 0.12, 4.2, 0.72, 0.72)];
      }
    },
    {
      id: 'handlebar', label: 'Handlebar', maleBias: 0.1,
      build: function (hw, hh, hd) {
        return [
          b(-2.0, MOUSTACHE_Y, hd / 2 - 0.12, 4.0, 0.68, 0.7),
          b(-2.9, MOUSTACHE_Y + 0.5, hd / 2 - 0.12, 0.9, 0.62, 0.66),
          b(2.0, MOUSTACHE_Y + 0.5, hd / 2 - 0.12, 0.9, 0.62, 0.66)
        ];
      }
    },
    {
      id: 'walrus', label: 'Walrus', maleBias: 0.09,
      build: function (hw, hh, hd) {
        return [
          b(-2.4, MOUSTACHE_Y - 0.35, hd / 2 - 0.12, 4.8, 1.05, 0.8),
          b(-2.0, MOUSTACHE_Y - 0.75, hd / 2 - 0.1, 4.0, 0.5, 0.7)
        ];
      }
    }
  ];

  /* ---------- beards ----------
   *
   * No moustache component anywhere in here; the two are chosen independently.
   * Side panels stop short of the cheekbone so the face stays readable.
   */

  const BEARDS = [
    { id: 'none', label: 'Clean shaven', maleBias: 0.3, build: function () { return []; } },
    {
      id: 'stubble', label: 'Stubble', maleBias: 0.18,
      build: function (hw, hh, hd) {
        return [
          b(-hw / 2 + 0.2, 0.35, hd / 2 - 0.1, hw - 0.4, 1.5, 0.4),
          b(-hw / 2 - 0.4, 0.35, -hd / 2 + 1.6, 0.4, 1.9, hd - 1.6),
          b(hw / 2, 0.35, -hd / 2 + 1.6, 0.4, 1.9, hd - 1.6)
        ];
      }
    },
    {
      id: 'chin', label: 'Chin patch', maleBias: 0.09,
      build: function (hw, hh, hd) {
        return [b(-1.1, 0.25, hd / 2 - 0.12, 2.2, 1.3, 0.7)];
      }
    },
    {
      id: 'goatee', label: 'Goatee', maleBias: 0.12,
      build: function (hw, hh, hd) {
        return [
          b(-1.3, 0.1, hd / 2 - 0.12, 2.6, 1.8, 0.75),
          b(-1.0, -1.4, hd / 2 - 0.5, 2.0, 1.5, 1.2)
        ];
      }
    },
    {
      id: 'chops', label: 'Mutton chops', maleBias: 0.06,
      build: function (hw, hh, hd) {
        return [
          b(-hw / 2 - 0.5, 1.0, -hd / 2 + 1.8, 0.65, 2.8, hd - 1.6),
          b(hw / 2 - 0.15, 1.0, -hd / 2 + 1.8, 0.65, 2.8, hd - 1.6)
        ];
      }
    },
    {
      id: 'short', label: 'Short beard', maleBias: 0.13,
      build: function (hw, hh, hd) {
        return [
          b(-hw / 2 + 0.1, 0.0, hd / 2 - 0.12, hw - 0.2, 1.9, 0.8),
          b(-hw / 2 - 0.5, 0.0, -hd / 2 + 1.4, 0.6, 2.4, hd - 1.3),
          b(hw / 2 - 0.1, 0.0, -hd / 2 + 1.4, 0.6, 2.4, hd - 1.3),
          b(-hw / 2 + 0.7, -0.9, hd / 2 - 1.7, hw - 1.4, 1.1, 1.9)
        ];
      }
    },
    {
      id: 'full', label: 'Full beard', maleBias: 0.08,
      build: function (hw, hh, hd) {
        return [
          b(-hw / 2 - 0.1, -0.9, hd / 2 - 0.15, hw + 0.2, 2.7, 0.92),
          b(-hw / 2 - 0.55, -0.5, -hd / 2 + 1.0, 0.68, 3.2, hd - 0.9),
          b(hw / 2 - 0.13, -0.5, -hd / 2 + 1.0, 0.68, 3.2, hd - 0.9),
          b(-hw / 2 + 0.6, -2.6, hd / 2 - 2.2, hw - 1.2, 1.9, 2.4)
        ];
      }
    },
    {
      id: 'long', label: 'Long beard', maleBias: 0.04,
      build: function (hw, hh, hd) {
        return [
          b(-hw / 2 - 0.1, -1.3, hd / 2 - 0.15, hw + 0.2, 3.1, 0.92),
          b(-hw / 2 - 0.55, -0.9, -hd / 2 + 1.0, 0.68, 3.6, hd - 0.9),
          b(hw / 2 - 0.13, -0.9, -hd / 2 + 1.0, 0.68, 3.6, hd - 0.9),
          b(-hw / 2 + 0.7, -4.6, hd / 2 - 2.5, hw - 1.4, 3.4, 2.7),
          b(-1.7, -7.0, hd / 2 - 2.3, 3.4, 2.5, 2.3)
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
