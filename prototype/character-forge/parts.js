/* parts.js — the appearance vocabulary: palettes, hair, facial hair, names.
 *
 * Everything here is data. Hair and beards are box sets expressed in head-bone
 * space, so they scale with the skull and rotate with it for free.
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
    { id: 'darkbrown', label: 'Dark brown', hex: '#3a2416' },
    { id: 'brown', label: 'Brown', hex: '#5c3a1e' },
    { id: 'hazel', label: 'Hazel', hex: '#87652e' },
    { id: 'amber', label: 'Amber', hex: '#a87a2a' },
    { id: 'green', label: 'Green', hex: '#41684a' },
    { id: 'moss', label: 'Moss', hex: '#5c6f42' },
    { id: 'blue', label: 'Blue', hex: '#3f6486' },
    { id: 'pale', label: 'Pale blue', hex: '#6d92ad' },
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

  /* ---------- hair ---------- */

  // Box helper. Coordinates are head-bone space: the skull occupies
  // x -hw/2..hw/2, y 0..hh, z -hd/2..hd/2, with +Z as the face.
  function b(x, y, z, w, h, d) { return { x: x, y: y, z: z, w: w, h: h, d: d }; }

  function capBox(hw, hh, hd, thickness) {
    const t = thickness === undefined ? 1.9 : thickness;
    return b(-hw / 2 - 0.3, hh - t + 0.4, -hd / 2 - 0.3, hw + 0.6, t, hd + 0.6);
  }

  function backBox(hw, hh, hd, len, thick) {
    const t = thick === undefined ? 1.0 : thick;
    return b(-hw / 2 - 0.3, hh - 2.0 - len, -hd / 2 - 0.3 - t + 0.4, hw + 0.6, len, t);
  }

  function sideBoxes(hw, hh, hd, len, thick) {
    const t = thick === undefined ? 0.8 : thick;
    return [
      b(-hw / 2 - 0.3, hh - 2.0 - len, -hd / 2 - 0.3, t, len, hd + 0.6),
      b(hw / 2 + 0.3 - t, hh - 2.0 - len, -hd / 2 - 0.3, t, len, hd + 0.6)
    ];
  }

  function fringeBox(hw, hh, hd, drop) {
    return b(-hw / 2 - 0.3, hh - 1.7 - (drop || 1.4), hd / 2 + 0.3 - 0.9, hw + 0.6, drop || 1.4, 0.9);
  }

  const HAIR_STYLES = [
    {
      id: 'bald', label: 'Bald', femaleBias: 0.02,
      build: function () { return []; }
    },
    {
      id: 'buzz', label: 'Buzzed', femaleBias: 0.06,
      build: function (hw, hh, hd) {
        return [capBox(hw, hh, hd, 1.4), backBox(hw, hh, hd, 1.6, 0.5)].concat(sideBoxes(hw, hh, hd, 1.6, 0.5));
      }
    },
    {
      id: 'crop', label: 'Cropped', femaleBias: 0.18,
      build: function (hw, hh, hd) {
        return [capBox(hw, hh, hd), fringeBox(hw, hh, hd, 1.0), backBox(hw, hh, hd, 2.6, 0.8)]
          .concat(sideBoxes(hw, hh, hd, 2.2, 0.7));
      }
    },
    {
      id: 'bowl', label: 'Bowl cut', femaleBias: 0.4,
      build: function (hw, hh, hd) {
        return [capBox(hw, hh, hd), fringeBox(hw, hh, hd, 2.0), backBox(hw, hh, hd, 3.4, 1.0)]
          .concat(sideBoxes(hw, hh, hd, 3.4, 0.9));
      }
    },
    {
      id: 'sidepart', label: 'Side part', femaleBias: 0.3,
      build: function (hw, hh, hd) {
        return [
          capBox(hw, hh, hd),
          b(-hw / 2 - 0.3, hh - 3.4, hd / 2 - 0.6, hw * 0.55, 1.6, 1.0),
          b(hw * 0.05, hh - 2.8, hd / 2 - 0.6, hw * 0.45 + 0.3, 1.0, 1.0),
          backBox(hw, hh, hd, 2.4, 0.8)
        ].concat(sideBoxes(hw, hh, hd, 2.4, 0.7));
      }
    },
    {
      id: 'spiky', label: 'Spiked', femaleBias: 0.2,
      build: function (hw, hh, hd) {
        const out = [capBox(hw, hh, hd, 1.8), backBox(hw, hh, hd, 1.8, 0.7)];
        const spikes = [[-2.6, -1.6], [-0.8, 1.0], [1.2, -0.6], [2.4, 1.6], [-1.4, -2.6], [0.6, 2.4]];
        for (let i = 0; i < spikes.length; i++) {
          const s = spikes[i];
          out.push(b(s[0] * (hw / 8), hh + 0.2, s[1] * (hd / 8), 1.5, 1.4 + (i % 3) * 0.6, 1.5));
        }
        return out.concat(sideBoxes(hw, hh, hd, 1.4, 0.5));
      }
    },
    {
      id: 'mohawk', label: 'Mohawk', femaleBias: 0.25,
      build: function (hw, hh, hd) {
        return [
          b(-0.9, hh - 0.6, -hd / 2 - 0.3, 1.8, 3.0, hd + 0.6),
          b(-hw / 2 - 0.3, hh - 1.4, -hd / 2 - 0.3, hw + 0.6, 1.0, hd + 0.6)
        ];
      }
    },
    {
      id: 'topknot', label: 'Top knot', femaleBias: 0.45,
      build: function (hw, hh, hd) {
        return [
          capBox(hw, hh, hd),
          b(-1.6, hh + 0.4, -1.6, 3.2, 2.6, 3.2),
          backBox(hw, hh, hd, 2.2, 0.8)
        ].concat(sideBoxes(hw, hh, hd, 2.0, 0.7));
      }
    },
    {
      id: 'shoulder', label: 'Shoulder length', femaleBias: 0.66,
      build: function (hw, hh, hd) {
        return [capBox(hw, hh, hd), fringeBox(hw, hh, hd, 1.6), backBox(hw, hh, hd, 6.0, 1.2)]
          .concat(sideBoxes(hw, hh, hd, 5.2, 1.0));
      }
    },
    {
      id: 'long', label: 'Long', femaleBias: 0.78,
      build: function (hw, hh, hd) {
        return [capBox(hw, hh, hd), fringeBox(hw, hh, hd, 1.4), backBox(hw, hh, hd, 10.0, 1.4)]
          .concat(sideBoxes(hw, hh, hd, 7.5, 1.1));
      }
    },
    {
      id: 'ponytail', label: 'Ponytail', femaleBias: 0.7,
      build: function (hw, hh, hd) {
        return [
          capBox(hw, hh, hd),
          backBox(hw, hh, hd, 2.4, 0.9),
          b(-1.1, hh - 3.6, -hd / 2 - 1.9, 2.2, 2.0, 1.6),
          b(-0.9, hh - 8.4, -hd / 2 - 2.4, 1.8, 5.0, 1.6)
        ].concat(sideBoxes(hw, hh, hd, 2.6, 0.8));
      }
    },
    {
      id: 'braids', label: 'Twin braids', femaleBias: 0.85,
      build: function (hw, hh, hd) {
        const out = [capBox(hw, hh, hd), fringeBox(hw, hh, hd, 1.4), backBox(hw, hh, hd, 3.0, 1.0)];
        for (let side = 0; side < 2; side++) {
          const sx = side === 0 ? -hw / 2 - 1.2 : hw / 2 - 0.2;
          for (let k = 0; k < 4; k++) {
            const w = 1.5 - (k * 0.18);
            out.push(b(sx + (1.4 - w) / 2, hh - 4.2 - k * 1.7, -0.9 - k * 0.25, w, 1.7, 1.6));
          }
        }
        return out;
      }
    },
    {
      id: 'pigtails', label: 'Pigtails', femaleBias: 0.88,
      build: function (hw, hh, hd) {
        return [
          capBox(hw, hh, hd), fringeBox(hw, hh, hd, 1.5), backBox(hw, hh, hd, 2.4, 0.9),
          b(-hw / 2 - 2.4, hh - 4.6, -1.4, 2.4, 2.8, 2.8),
          b(hw / 2 + 0.0, hh - 4.6, -1.4, 2.4, 2.8, 2.8)
        ].concat(sideBoxes(hw, hh, hd, 2.6, 0.8));
      }
    },
    {
      id: 'curly', label: 'Curled', femaleBias: 0.55,
      build: function (hw, hh, hd) {
        const out = [capBox(hw, hh, hd, 2.0)];
        const puffs = [
          [-hw / 2 - 1.0, hh - 1.4, -1.6], [hw / 2 - 1.2, hh - 1.4, -1.6],
          [-hw / 2 - 0.9, hh - 3.4, -2.4], [hw / 2 - 1.3, hh - 3.4, -2.4],
          [-2.2, hh - 0.2, -hd / 2 - 1.2], [0.4, hh - 0.2, -hd / 2 - 1.2],
          [-2.4, hh + 0.2, hd / 2 - 1.0], [0.6, hh + 0.2, hd / 2 - 1.0]
        ];
        for (let i = 0; i < puffs.length; i++) {
          out.push(b(puffs[i][0], puffs[i][1], puffs[i][2], 2.2, 2.2, 2.2));
        }
        return out;
      }
    },
    {
      id: 'bun', label: 'Coiled bun', femaleBias: 0.82,
      build: function (hw, hh, hd) {
        return [
          capBox(hw, hh, hd), fringeBox(hw, hh, hd, 1.2),
          backBox(hw, hh, hd, 2.6, 1.0),
          b(-1.9, hh - 3.0, -hd / 2 - 2.6, 3.8, 3.6, 2.8)
        ].concat(sideBoxes(hw, hh, hd, 3.0, 0.9));
      }
    }
  ];

  /* ---------- facial hair ---------- */

  const FACIAL_HAIR = [
    { id: 'none', label: 'Clean shaven', maleBias: 0.22, build: function () { return []; } },
    {
      id: 'stubble', label: 'Stubble', maleBias: 0.16,
      build: function (hw, hh, hd) {
        return [
          b(-hw / 2 - 0.2, 0.6, hd / 2 - 0.1, hw + 0.4, 2.6, 0.45),
          b(-hw / 2 - 0.45, 0.6, -hd / 2 + 1.2, 0.45, 2.2, hd - 1.2),
          b(hw / 2, 0.6, -hd / 2 + 1.2, 0.45, 2.2, hd - 1.2)
        ];
      }
    },
    {
      id: 'moustache', label: 'Moustache', maleBias: 0.12,
      build: function (hw, hh, hd) {
        return [b(-1.9, 2.5, hd / 2 - 0.1, 3.8, 0.9, 0.7)];
      }
    },
    {
      id: 'goatee', label: 'Goatee', maleBias: 0.12,
      build: function (hw, hh, hd) {
        return [
          b(-1.7, 2.5, hd / 2 - 0.1, 3.4, 0.9, 0.7),
          b(-1.2, 0.3, hd / 2 - 0.1, 2.4, 1.9, 0.75)
        ];
      }
    },
    {
      id: 'chops', label: 'Mutton chops', maleBias: 0.08,
      build: function (hw, hh, hd) {
        return [
          b(-hw / 2 - 0.5, 1.4, -hd / 2 + 1.4, 0.7, 3.6, hd - 1.0),
          b(hw / 2 - 0.2, 1.4, -hd / 2 + 1.4, 0.7, 3.6, hd - 1.0)
        ];
      }
    },
    {
      id: 'short', label: 'Short beard', maleBias: 0.14,
      build: function (hw, hh, hd) {
        return [
          b(-1.9, 2.5, hd / 2 - 0.1, 3.8, 0.9, 0.8),
          b(-hw / 2 - 0.3, 0.0, hd / 2 - 0.1, hw + 0.6, 2.2, 0.85),
          b(-hw / 2 - 0.55, 0.0, -hd / 2 + 1.0, 0.6, 2.6, hd - 0.8),
          b(hw / 2 - 0.05, 0.0, -hd / 2 + 1.0, 0.6, 2.6, hd - 0.8),
          b(-hw / 2 + 0.4, -1.0, hd / 2 - 1.6, hw - 0.8, 1.2, 1.8)
        ];
      }
    },
    {
      id: 'full', label: 'Full beard', maleBias: 0.11,
      build: function (hw, hh, hd) {
        return [
          b(-2.1, 2.5, hd / 2 - 0.1, 4.2, 1.0, 0.85),
          b(-hw / 2 - 0.35, -1.0, hd / 2 - 0.15, hw + 0.7, 3.2, 0.95),
          b(-hw / 2 - 0.6, -0.6, -hd / 2 + 0.8, 0.7, 3.4, hd - 0.6),
          b(hw / 2 - 0.1, -0.6, -hd / 2 + 0.8, 0.7, 3.4, hd - 0.6),
          b(-hw / 2 + 0.5, -3.0, hd / 2 - 2.2, hw - 1.0, 2.2, 2.4)
        ];
      }
    },
    {
      id: 'long', label: 'Long beard', maleBias: 0.05,
      build: function (hw, hh, hd) {
        return [
          b(-2.1, 2.5, hd / 2 - 0.1, 4.2, 1.0, 0.85),
          b(-hw / 2 - 0.35, -1.4, hd / 2 - 0.15, hw + 0.7, 3.9, 0.95),
          b(-hw / 2 - 0.6, -1.0, -hd / 2 + 0.8, 0.7, 3.6, hd - 0.6),
          b(hw / 2 - 0.1, -1.0, -hd / 2 + 0.8, 0.7, 3.6, hd - 0.6),
          b(-hw / 2 + 0.6, -5.0, hd / 2 - 2.6, hw - 1.2, 3.8, 2.8),
          b(-1.6, -7.6, hd / 2 - 2.4, 3.2, 2.8, 2.4)
        ];
      }
    }
  ];

  /* ---------- face feature variation ---------- */

  const EYE_SHAPES = [
    { id: 'round', label: 'Round', w: 1.9, h: 1.5 },
    { id: 'even', label: 'Even', w: 2.0, h: 1.2 },
    { id: 'narrow', label: 'Narrow', w: 2.2, h: 0.9 },
    { id: 'wide', label: 'Wide', w: 2.1, h: 1.7 },
    { id: 'hooded', label: 'Hooded', w: 1.8, h: 1.0 }
  ];

  const BROW_SHAPES = [
    { id: 'flat', label: 'Flat', inner: 0, outer: 0, thick: 0.55 },
    { id: 'raised', label: 'Raised', inner: 0.0, outer: 0.55, thick: 0.5 },
    { id: 'angled', label: 'Angled', inner: -0.5, outer: 0.35, thick: 0.6 },
    { id: 'arched', label: 'Arched', inner: 0.45, outer: 0.1, thick: 0.45 },
    { id: 'heavy', label: 'Heavy', inner: -0.2, outer: -0.1, thick: 0.95 }
  ];

  const NOSE_SHAPES = [
    { id: 'small', label: 'Small', w: 1.3, h: 1.1, len: 0.55 },
    { id: 'straight', label: 'Straight', w: 1.5, h: 1.5, len: 0.8 },
    { id: 'broad', label: 'Broad', w: 2.1, h: 1.4, len: 0.75 },
    { id: 'long', label: 'Long', w: 1.4, h: 2.2, len: 0.9 },
    { id: 'hooked', label: 'Hooked', w: 1.5, h: 1.9, len: 1.15 },
    { id: 'button', label: 'Button', w: 1.6, h: 1.0, len: 0.6 }
  ];

  const GARMENTS = [
    { id: 'tunic', label: 'Tunic', femaleBias: 0.35 },
    { id: 'jerkin', label: 'Jerkin', femaleBias: 0.3 },
    { id: 'dress', label: 'Long dress', femaleBias: 0.92 },
    { id: 'robe', label: 'Robe', femaleBias: 0.5 }
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
    SKIN_TONES, HAIR_COLOURS, EYE_COLOURS, CLOTH_COLOURS, LEATHER_COLOURS,
    HAIR_STYLES, FACIAL_HAIR, EYE_SHAPES, BROW_SHAPES, NOSE_SHAPES, GARMENTS,
    MALE_NAMES, FEMALE_NAMES, SURNAMES,
    box: b
  };
})(window);
