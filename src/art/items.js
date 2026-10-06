// Every item in the realm, drawn: a 16-pixel icon for the satchel and the shop, and a smaller version
// for when it's set down on a table, a counter or the ground. Each good is drawn from a shape (a loaf,
// a sack, a jug, a bar of iron, a coil of rope, a blade...) in its own colours, shaded with the same
// material raster as everything else, then outlined so it reads at a glance.
'use strict';
(function () {
  const P = () => O.Pal;
  // good -> [shape, main colour, second colour]
  const LOOK = {
    wheat: ['sheaf', '#d8b048', '#a88a30'], barley: ['sheaf', '#c8a848', '#9a7a30'], oats: ['sheaf', '#d8c888', '#a89a58'], flax: ['sheaf', '#8aa860', '#c8c0a0'], hemp: ['sheaf', '#7a9050', '#a8a070'], woad: ['sheaf', '#5a7a5a', '#3a5a8a'], madder: ['sheaf', '#9a5a3a', '#c83a2a'], hay: ['bale', '#d8c070', '#b0984a'],
    flour: ['sack', '#e6dcc4', '#b8a888'], malt: ['sack', '#c8a070', '#9a7a50'], salt: ['sack', '#f0f0ec', '#c8c8c0'], spices: ['sack', '#b8602a', '#e8a040'], charcoal: ['sack', '#3a3a3e', '#6a5a4a'], coal: ['sack', '#2a2a30', '#5a5048'], sand: ['sack', '#e0c890', '#b0985a'], fx_sack: ['sack', '#c8b088', '#9a8060'],
    bread: ['loaf', '#c88a45', '#8a5a2a'], pie: ['pie', '#c8903e', '#8a5a2a'], cake: ['pie', '#d8a860', '#f0e0b0'], cheese: ['wheel', '#e8c860', '#c8a040'], butter: ['pat', '#f0e080', '#c8b860'],
    cabbage: ['round', '#6a9a44', '#4a7a30'], apples: ['basket', '#c83a2a', '#8a6a3a'], grapes: ['basket', '#6a3a7a', '#8a6a3a'], eggs: ['basket', '#f0e8d8', '#8a6a3a'], fish: ['fish', '#9aa8b0', '#6a7880'], meat: ['meat', '#a83a3a', '#e8d8c8'], venison: ['meat', '#8a2a2a', '#d8c8b8'], sausage: ['sausage', '#9a4a3a', '#c86a4a'],
    meal: ['bowl', '#a0603a', '#8a6239'], stew: ['bowl', '#8a7a3a', '#8a6239'], honey: ['pot', '#e8a830', '#a8743a'], milk: ['jug', '#f4f0e8', '#b8744a'], ale: ['mug', '#c8902e', '#7a5634'], wine: ['flask', '#7a1a2a', '#3a5a3a'],
    logs: ['logs', '#7c5a38', '#c8a070'], firewood: ['logs', '#8a6239', '#d0a878'], planks: ['planks', '#b08850', '#8a6239'], bark: ['logs', '#5a4030', '#8a6a4a'], peat: ['brick', '#4a3a2a', '#6a5038'], clay: ['brick', '#a8704a', '#c8906a'], bricks: ['brick', '#a85a3a', '#c87a5a'], stone: ['brick', '#9a968e', '#c8c4bc'],
    iron: ['bar', '#7a7e88', '#a8acb4'], silver: ['bar', '#c8ccd4', '#f0f2f6'], gold: ['nugget', '#e8c040', '#fff0a0'], glass: ['pane', '#a8d0d8', '#e8f8ff'], pitch: ['pot', '#1c1418', '#3a2a20'], potash: ['pot', '#c8c0b0', '#8a7a6a'], ink: ['pot', '#1a1a3a', '#4a3a6a'],
    wool: ['fleece', '#ece6d8', '#c8c0b0'], cloth: ['bolt', '#8a7a6a', '#6a5a4a'], linen: ['bolt', '#ece4cc', '#c8c0a8'], silk: ['bolt', '#c8407a', '#f0c0d8'], dyedcloth: ['bolt', '#3a5a9a', '#a83a3a'], clothes: ['tunic', '#6a7a4a', '#4a5a3a'], disguise: ['tunic', '#24222a', '#121016'], letter_in: ['letter', '#efe6cc', '#a8382f'], shoes: ['shoes', '#5a3a28', '#3a2418'], leather: ['hide', '#8a5a34', '#6a4024'], hide: ['hide', '#b08a6a', '#8a6a4a'],
    rope: ['coil', '#b89a68', '#8a7048'], nets: ['net', '#9a8a6a', '#6a5a4a'], feathers: ['feather', '#f0ece4', '#a8a090'], parchment: ['scroll', '#ece2c8', '#c8b898'], letter: ['letter', '#ece2c8', '#a8382f'], beeswax: ['brick', '#e8c050', '#c8a030'], tallow: ['brick', '#f0e8d0', '#c8c0a0'], soap: ['brick', '#e0e0c8', '#b8b8a0'],
    candles: ['candle', '#f0e8d0', '#e8a030'], lantern: ['lantern', '#c8a040', '#f0d070'], cup: ['cup', '#b8744a', '#8a5432'], jug: ['jug', '#b8744a', '#8a5432'], pot: ['pot', '#a8643a', '#7a4a2a'], bucket: ['bucket', '#8a6239', '#4a4a52'], broom: ['broom', '#8a6239', '#c8a050'],
    tools: ['tool', '#8a6239', '#9aa0aa'], hammer: ['hammer', '#8a6239', '#7a7e88'], spade: ['spade', '#8a6239', '#9aa0aa'], sickle: ['sickle', '#8a6239', '#c8ccd4'], shears: ['shears', '#9aa0aa', '#5a5a62'], nails: ['nails', '#7a7e88', '#a8acb4'], horseshoes: ['horseshoe', '#7a7e88', '#a8acb4'], rod: ['rod', '#6a4a2c', '#d8d0c0'],
    dagger: ['blade', '#c8ccd4', '#b8902a'], sword: ['sword', '#c8ccd4', '#b8902a'], axe: ['axe', '#8a6239', '#c8ccd4'], bow: ['bow', '#8a5a2a', '#e8e0d0'], arrows: ['arrows', '#8a6a3a', '#f0ece4'], helm: ['helm', '#8a8e98', '#5a5e68'], mail: ['mail', '#8a8e98', '#5a5e68'],
    saddle: ['saddle', '#7a4a2a', '#c8a040'], harness: ['coil', '#6a4024', '#c8a040'], wheel: ['wheel', '#8a6239', '#4a4a52'], cart: ['cart', '#8a6239', '#4a4a52'], boat: ['boat', '#8a6239', '#5a3a28'], tent: ['tent', '#d8c8a0', '#8a6239'], cask: ['barrel', '#8a6239', '#4a4a52'],
    ring: ['ring', '#e8c040', '#c83a3a'], brooch: ['brooch', '#e8c040', '#c83a3a'], necklace: ['ring', '#e8c040', '#3a60c8'], circlet: ['ring', '#f0d060', '#3a9a5a'], spoon: ['spoon', '#c8ccd4', '#f0f2f6'], candlestick: ['candlestick', '#9a9a96', '#f0e8d0'], key: ['key', '#c8a040', '#8a6a20'], coins: ['coins', '#c8ccd4', '#e8c040'], coin: ['coins', '#c8ccd4', '#e8c040'],
    berries: ['round', '#8a2a5a', '#3a6a2a'], mushrooms: ['round', '#d8c0a0', '#8a5a3a'],
    medicine: ['flask', '#6a9ad0', '#c8b8a0'], herbs: ['herbs', '#5a9a40', '#3a6a2a'], furniture: ['chair', '#8a6239', '#6a4a2c'],
  };
  const lookOf = (k) => {
    if (LOOK[k]) return LOOK[k];
    const g = O.Data && O.Data.GOODS[k];
    if (g && g.furniture) return ['furn:' + g.furniture, '#8a6239', '#6a4a2c'];
    return ['round', '#a0a0a0', '#808080'];
  };

  // draw shape s into buffer B (size n) with colours a, b
  function paint(B, n, shape, a, b) {
    const p = P(), m = (h, k = 'cloth') => p.mat(h, k), W = (h) => m(h, 'wood'), M = (h) => m(h, 'metal');
    const c = n / 2, u = n / 16; // scale everything from a 16-pixel design
    const X = (v) => v * u, blob = (x, y, rx, ry, mt, pw = 2) => B.blob(X(x), X(y), X(rx), X(ry), mt, { power: pw }), rect = (x, y, w, h, mt, sh = 2) => B.rect(Math.round(X(x)), Math.round(X(y)), Math.max(1, Math.round(X(w))), Math.max(1, Math.round(X(h))), mt, sh), cap = (x1, y1, x2, y2, r1, r2, mt) => B.capsule(X(x1), X(y1), X(x2), X(y2), Math.max(0.5, X(r1)), Math.max(0.5, X(r2)), mt), dot = (x, y, mt, sh = 2) => B.plot(Math.round(X(x)), Math.round(X(y)), mt, sh);
    void c;
    if (shape.startsWith('furn:')) return furnIcon(shape.slice(5), { blob, rect, cap, dot, W, M, m, a, b });
    switch (shape) {
      case 'sheaf': for (let i = -2; i <= 2; i++) cap(8 + i * 0.8, 14, 8 + i * 2, 4, 0.6, 0.5, m(a, 'hair')); for (let i = -2; i <= 2; i++) blob(8 + i * 2, 3.5, 1.1, 1.8, m(b, 'hair')); rect(5.5, 9, 5, 1.4, m('#8a6239'), 1); break;
      case 'bale': rect(2, 5, 12, 8, m(a, 'hair'), 2); for (let x = 3; x < 14; x += 2) rect(x, 5, 0.6, 8, m(b, 'hair'), 1); rect(2, 7.5, 12, 0.8, m('#8a6239'), 1); rect(2, 10.5, 12, 0.8, m('#8a6239'), 1); break;
      case 'sack': blob(8, 10, 5.5, 5, m(a), 2); blob(8, 4.5, 2.2, 1.6, m(a), 2); rect(6, 5.5, 4, 1.2, m('#7a5634'), 1); dot(6.5, 9, m(b), 1); dot(9.5, 12, m(b), 1); break;
      case 'loaf': blob(8, 9.5, 6.5, 4, m(a, 'wood'), 2); for (const x of [5, 8, 11]) cap(x - 1, 7.5, x + 1, 9.5, 0.4, 0.4, m(b, 'wood')); break;
      case 'pie': blob(8, 10, 6.5, 3.6, m(b, 'wood'), 2.5); blob(8, 8.6, 6, 2.6, m(a, 'wood'), 2); for (const x of [5, 8, 11]) dot(x, 8.5, m('#f0d8a0'), 3); break;
      case 'wheel': blob(8, 9, 6.5, 4.5, m(a), 2); rect(1.5, 9, 13, 3, m(b), 1); blob(8, 7.5, 6.3, 2.2, m('#f0e090'), 3); break;
      case 'pat': rect(3, 7, 10, 5, m(a), 2); rect(3, 6, 10, 1.5, m('#fff4b0'), 3); break;
      case 'round': blob(8, 9, 5.5, 5, m(a), 2); dot(7, 7, m('#a8d070'), 3); dot(10, 10, m(b), 1); dot(5, 10, m(b), 1); break;
      case 'basket': blob(8, 11, 6.2, 3.6, m('#b08850', 'wood'), 3); for (const [x, y] of [[5.5, 7.5], [8, 6.8], [10.5, 7.6], [6.8, 9], [9.4, 9]]) blob(x, y, 1.7, 1.6, m(a), 2); for (let x = 3; x < 14; x += 2) dot(x, 12, m('#8a6239'), 1); break;
      case 'fish': blob(7.5, 9, 6, 2.4, M(a), 2); B.poly([[X(13), X(9)], [X(15.5), X(6.5)], [X(15.5), X(11.5)]], [0.2, 0, 0.9], M(b)); dot(4, 8.5, m('#1c1418'), 0); break;
      case 'meat': blob(7, 9, 5.5, 4, m(a), 2); blob(7, 9, 3, 2, m('#c85a5a'), 2); cap(11, 9, 14.5, 7, 0.9, 0.9, m(b)); blob(14.5, 6.8, 1.2, 1.2, m(b)); break;
      case 'sausage': for (let i = 0; i < 3; i++) cap(3 + i * 4, 9 - (i % 2), 6 + i * 4, 9 - ((i + 1) % 2), 1.6, 1.6, m(a)); break;
      case 'bowl': blob(8, 10.5, 6.5, 3.6, W(b), 2); blob(8, 8, 5.6, 1.6, m(a), 2); dot(6, 8, m('#f0c080'), 3); break;
      case 'pot': blob(8, 9.5, 5, 5, m(b, 'wood'), 2); rect(5, 3.5, 6, 2, m(b, 'wood'), 2); rect(6, 3, 4, 1, m(a), 3); break;
      case 'jug': blob(8, 10, 4.5, 4.5, m(b, 'wood'), 2); rect(6, 3, 4, 4, m(b, 'wood'), 2); cap(12, 7, 13, 11, 0.6, 0.6, m(b, 'wood')); rect(6.5, 3, 3, 1, m(a), 3); break;
      case 'mug': rect(4, 4, 7, 10, W(b), 2); rect(11, 6, 2.4, 5, W(b), 1); rect(4, 3.5, 7, 2.2, m('#f0e8d0'), 3); rect(4.5, 6, 6, 0.6, m('#4a3a2a'), 1); rect(4.5, 11, 6, 0.6, m('#4a3a2a'), 1); break;
      case 'flask': blob(8, 10.5, 4.6, 4.2, M(a), 2); rect(6.8, 2.5, 2.4, 4, M(b), 2); rect(6.5, 2, 3, 1, m('#8a6239'), 2); break;
      case 'cup': rect(5, 6, 6, 7, m(a, 'wood'), 2); rect(5, 6, 6, 1, m(b, 'wood'), 3); break;
      case 'bucket': B.poly([[X(3.5), X(5)], [X(12.5), X(5)], [X(11.5), X(14)], [X(4.5), X(14)]], [0, -0.2, 0.9], W(a)); rect(3.5, 7, 9, 0.8, M(b), 1); rect(4, 12, 8, 0.8, M(b), 1); cap(4, 5, 8, 1.5, 0.4, 0.4, M(b)); cap(12, 5, 8, 1.5, 0.4, 0.4, M(b)); rect(4.5, 5, 7, 1, m('#5a8ab8'), 3); break;
      case 'logs': for (const [x, y] of [[4.5, 10.5], [11.5, 10.5], [8, 5.5]]) { blob(x, y, 3.2, 3.2, W(a), 2); blob(x, y, 1.8, 1.8, W(b), 3); dot(x, y, W(a), 1); } break;
      case 'planks': for (let i = 0; i < 4; i++) { rect(1.5, 4 + i * 2.6, 13, 2.2, W(i % 2 ? a : b), 2); dot(3, 5 + i * 2.6, m('#4a3020'), 0); } break;
      case 'brick': rect(2, 6, 12, 7, m(a), 2); rect(2, 6, 12, 1.4, m(b), 3); rect(7.8, 7.4, 0.6, 5.6, m('#3a2a20'), 0); break;
      case 'bar': B.poly([[X(1.5), X(12)], [X(14.5), X(12)], [X(12), X(5.5)], [X(4), X(5.5)]], [0, -0.6, 0.8], M(a)); cap(4.5, 6, 11.5, 6, 0.5, 0.5, M(b)); break;
      case 'nugget': blob(8, 9, 4.5, 3.6, M(a), 1.6); dot(6.5, 8, M(b), 3); dot(9, 10, M(b), 3); break;
      case 'pane': rect(3, 3, 10, 10, M('#6a5a4a'), 1); rect(4, 4, 8, 8, M(a), 3); cap(5, 10, 9, 5, 0.4, 0.4, M(b)); break;
      case 'fleece': for (const [x, y] of [[5, 9], [8, 7], [11, 9], [6.5, 11.5], [9.5, 11.5]]) blob(x, y, 3, 2.6, m(a, 'hair'), 2); break;
      case 'bolt': cap(3, 6, 13, 6, 3.4, 3.4, m(a)); blob(3, 6, 1.6, 3.4, m(b), 2); for (let x = 5; x < 13; x += 3) rect(x, 3, 0.5, 6, m(b), 1); rect(4, 11, 9, 3, m(a), 2); break;
      case 'tunic': B.poly([[X(4), X(3)], [X(12), X(3)], [X(15), X(7)], [X(12.5), X(8)], [X(12), X(14)], [X(4), X(14)], [X(3.5), X(8)], [X(1), X(7)]], [0, -0.1, 0.9], m(a)); rect(6.5, 3, 3, 1.5, m(b), 1); rect(4, 9, 8, 0.8, m('#6a4a2c'), 1); break;
      case 'shoes': for (const x of [3, 9]) { blob(x + 2.5, 11, 3, 2.2, m(a, 'wood'), 2); rect(x, 7, 3, 4, m(a, 'wood'), 2); rect(x, 12.5, 5.5, 0.8, m(b), 0); } break;
      case 'hide': B.poly([[X(3), X(4)], [X(13), X(3)], [X(14.5), X(9)], [X(12), X(14)], [X(4), X(13.5)], [X(1.5), X(8)]], [0, -0.1, 0.9], m(a)); dot(8, 8, m(b), 1); break;
      case 'coil': for (let r = 5.5; r > 1.5; r -= 1.6) B.shape(0, 0, n, n, (x, y) => { const d = Math.hypot(x - X(8), (y - X(9)) * 1.3); return d <= X(r) && d > X(r - 1); }, () => [0, -0.3, 0.9], m(a)); dot(8, 9, m(b), 1); break;
      case 'net': for (let i = 2; i < 14; i += 3) { cap(i, 2, i + 1, 14, 0.3, 0.3, m(a)); cap(2, i, 14, i + 1, 0.3, 0.3, m(a)); } for (const [x, y] of [[4, 4], [12, 12]]) blob(x, y, 1, 1, m('#d8c8a0'), 2); break;
      case 'feather': cap(4, 13, 12, 3, 0.3, 0.3, m(b)); for (let k = 0; k < 6; k++) { cap(5 + k * 1.3, 12 - k * 1.6, 3 + k * 1.3, 10 - k * 1.6, 0.6, 0.5, m(a)); cap(6 + k * 1.3, 12 - k * 1.6, 8.5 + k * 1.3, 11 - k * 1.6, 0.6, 0.5, m(a)); } break;
      case 'scroll': rect(3, 4, 10, 9, m(a), 3); cap(2.5, 4, 13.5, 4, 1.2, 1.2, m(b)); cap(2.5, 13, 13.5, 13, 1.2, 1.2, m(b)); for (let y = 6; y < 12; y += 1.6) rect(4.5, y, 7, 0.5, m('#4a3a2a'), 1); break;
      case 'letter': rect(2, 4, 12, 9, m(a), 3); B.poly([[X(2), X(4)], [X(14), X(4)], [X(8), X(9)]], [0, -0.3, 0.9], m('#d8ccb0')); blob(8, 8.8, 1.6, 1.6, m(b), 2); break;
      case 'candle': for (const x of [5, 8, 11]) { rect(x - 1, 6, 2, 8, m(a), 3); dot(x, 4.5, m(b), 3); dot(x, 5.3, m('#fff0a0'), 3); } break;
      case 'lantern': rect(5, 5, 6, 8, M(a), 2); rect(6, 6, 4, 6, m(b), 3); cap(6, 5, 8, 2, 0.4, 0.4, M(a)); cap(10, 5, 8, 2, 0.4, 0.4, M(a)); rect(4.5, 13, 7, 1, M(a), 1); break;
      case 'broom': cap(4, 13, 12, 2, 0.5, 0.5, W(a)); B.poly([[X(1), X(14)], [X(6), X(10)], [X(8), X(12)], [X(4), X(16)]], [0, -0.2, 0.9], m(b, 'hair')); break;
      case 'tool': cap(3, 13, 11, 4, 0.8, 0.8, W(a)); rect(9, 2, 6, 3, M(b), 3); break;
      case 'hammer': cap(4, 14, 9, 5, 0.8, 0.8, W(a)); rect(6, 2, 7, 4, M(b), 2); break;
      case 'spade': cap(8, 1, 8, 9, 0.7, 0.7, W(a)); rect(6, 1, 4, 1, W(a), 2); B.poly([[X(5), X(9)], [X(11), X(9)], [X(10.5), X(14.5)], [X(5.5), X(14.5)]], [0, -0.2, 0.9], M(b)); break;
      case 'sickle': cap(3, 14, 6, 10, 0.8, 0.8, W(a)); for (let k = 0; k < 10; k++) { const t = k / 9 * Math.PI * 1.05; dot(6 + Math.sin(t) * 5, 10 - Math.cos(t) * 5.5 + 1, M(b), 3 - (k > 7 ? 1 : 0)); } break;
      case 'shears': cap(3, 13, 11, 3, 0.6, 0.4, M(a)); cap(5, 13, 13, 3.5, 0.6, 0.4, M(a)); blob(4, 13, 1.6, 1.6, M(b), 2); break;
      case 'nails': for (let i = 0; i < 5; i++) cap(3 + i * 2.2, 13 - (i % 2), 4 + i * 2.2, 5, 0.4, 0.4, M(i % 2 ? a : b)); for (let i = 0; i < 5; i++) rect(2.2 + i * 2.2, 4.5, 2, 0.8, M(b), 3); break;
      case 'horseshoe': for (let k = 0; k <= 12; k++) { const t = (k / 12) * Math.PI * 1.25 - Math.PI * 0.125; blob(8 - Math.cos(t) * 4.5, 10 - Math.sin(t) * 5, 1.1, 1.1, M(a), 2); } dot(5, 9, m('#1c1418'), 0); dot(11, 9, m('#1c1418'), 0); break;
      case 'rod': cap(2, 14, 14, 2, 0.5, 0.3, W(a)); for (let k = 0; k < 8; k++) dot(14 - k * 0.2, 2 + k * 1.4, m(b), 2); break;
      case 'blade': cap(3, 13, 12, 3, 1.1, 0.5, M(a)); cap(2, 10, 6, 14, 0.7, 0.7, M(b)); break;
      case 'sword': cap(2, 14, 13, 2, 1.0, 0.6, M(a)); cap(2, 10.5, 5.5, 14, 0.7, 0.7, M(b)); cap(1.5, 14.5, 2.5, 13.5, 0.9, 0.9, M(b)); break;
      case 'axe': cap(4, 14, 10, 3, 0.8, 0.8, W(a)); blob(11.5, 4.5, 3, 2.4, M(b), 2); break;
      case 'bow': for (let k = 0; k <= 14; k++) { const t = k / 14; dot(5 + Math.sin(t * Math.PI) * 4, 1.5 + t * 13, W(a), 2); } cap(5, 1.5, 5, 14.5, 0.3, 0.3, m(b)); break;
      case 'arrows': for (let i = 0; i < 4; i++) { cap(3 + i * 2.5, 14, 6 + i * 2.5, 2, 0.4, 0.4, W(a)); blob(6 + i * 2.5, 2.4, 0.9, 1.2, M('#9aa0aa'), 2); blob(3.2 + i * 2.5, 12.8, 1, 1.4, m(b), 2); } break;
      case 'helm': blob(8, 9, 6, 6, M(a), 2); rect(2, 9, 12, 5, M(a), 2); rect(4, 10, 8, 1.2, m('#1c1418'), 0); rect(7.4, 10, 1.2, 4, M(b), 1); break;
      case 'mail': B.poly([[X(3), X(3)], [X(13), X(3)], [X(15), X(8)], [X(12.5), X(8)], [X(12.5), X(14)], [X(3.5), X(14)], [X(3.5), X(8)], [X(1), X(8)]], [0, -0.1, 0.9], M(a)); for (let y = 4; y < 14; y += 1.5) for (let x = 4; x < 12; x += 1.5) dot(x + ((y * 2) % 2), y, M(b), 1); break;
      case 'saddle': blob(8, 8, 6.5, 3.5, m(a, 'wood'), 2); blob(4, 6, 2.5, 2, m(a, 'wood'), 2); rect(7, 10, 2, 4, m(b), 2); blob(8, 14, 1.4, 1.2, M(b), 2); break;
      case 'wheel': for (let k = 0; k < 16; k++) { const t = k / 16 * 6.283; blob(8 + Math.cos(t) * 5.5, 8 + Math.sin(t) * 5.5, 1.1, 1.1, W(a), 2); } for (let k = 0; k < 4; k++) { const t = k / 4 * 3.1416; cap(8 - Math.cos(t) * 5, 8 - Math.sin(t) * 5, 8 + Math.cos(t) * 5, 8 + Math.sin(t) * 5, 0.4, 0.4, W(a)); } blob(8, 8, 1.4, 1.4, M(b), 2); break;
      case 'cart': rect(2, 5, 12, 5, W(a), 2); blob(5, 12, 2.6, 2.6, W('#5a3a28'), 2); blob(5, 12, 0.8, 0.8, M(b), 2); cap(13, 8, 15.5, 6, 0.4, 0.4, W(a)); break;
      case 'boat': B.poly([[X(1), X(8)], [X(15), X(8)], [X(12), X(13)], [X(4), X(13)]], [0, 0.3, 0.9], W(a)); rect(1, 8, 14, 1, W(b), 3); cap(8, 2, 8, 8, 0.3, 0.3, W(b)); break;
      case 'tent': B.poly([[X(8), X(2)], [X(15), X(14)], [X(1), X(14)]], [0.3, -0.3, 0.9], m(a)); B.poly([[X(8), X(6)], [X(10), X(14)], [X(6), X(14)]], [0, 0, 1], m('#3a2a20')); break;
      case 'barrel': blob(8, 8.5, 5, 6, W(a), 1.8); rect(3, 4.5, 10, 0.8, M(b), 1); rect(3, 12.5, 10, 0.8, M(b), 1); break;
      case 'ring': for (let k = 0; k < 14; k++) { const t = k / 14 * 6.283; dot(8 + Math.cos(t) * 4, 10 + Math.sin(t) * 2.4, M(a), 3); } blob(8, 6, 1.8, 1.8, m(b), 2); break;
      case 'brooch': blob(8, 8, 5, 5, M(a), 2); blob(8, 8, 2.2, 2.2, m(b), 2); break;
      case 'spoon': cap(3, 13, 9, 6, 0.6, 0.6, M(a)); blob(10.5, 4.5, 2.2, 1.7, M(a), 2); break;
      case 'candlestick': rect(7, 5, 2, 8, M(a), 3); rect(5, 13, 6, 1.5, M(a), 2); rect(7, 2, 2, 3, m(b), 3); break;
      case 'key': blob(4.5, 8, 2.8, 2.8, M(a), 2); blob(4.5, 8, 1, 1, m('#1c1418'), 2); rect(7, 7.2, 7, 1.6, M(a), 3); rect(11.5, 8.8, 2, 2, M(a), 2); break;
      case 'coins': for (const [x, y] of [[5, 11], [10, 11], [7.5, 8]]) { blob(x, y, 2.8, 1.8, M(a), 2); dot(x, y - 0.5, M(b), 3); } break;
      case 'herbs': for (let i = 0; i < 5; i++) cap(5 + i * 1.5, 14, 2.5 + i * 2.5, 3, 0.5, 0.9, m(i % 2 ? a : b)); rect(6, 11, 4, 1.2, m('#8a6239'), 1); break;
      case 'chair': return furnIcon('chair', { blob, rect, cap, dot, W, M, m, a, b });
      default: blob(8, 8, 5, 5, m(a), 2);
    }
  }
  // small drawings of furniture for the furniture goods
  function furnIcon(k, f) {
    const { blob, rect, cap, W, M, m, a, b } = f;
    switch (k) {
      case 'chair': case 'stool': rect(4, 8, 8, 1.6, W(a), 3); for (const x of [4, 11]) rect(x, 9, 1.2, 5, W(b), 1); if (k === 'chair') { rect(4, 2, 1.2, 7, W(b), 2); rect(10.8, 2, 1.2, 7, W(b), 2); rect(4, 3, 8, 1.2, W(a), 2); } break;
      case 'table': case 'longtable': case 'counter': case 'bar': case 'desk': case 'workbench': case 'doughtable': case 'butcherblock': rect(1.5, 6, 13, 2.5, W(a), 3); rect(2, 8.5, 1.4, 6, W(b), 1); rect(12.6, 8.5, 1.4, 6, W(b), 1); if (k === 'counter' || k === 'bar') rect(1.5, 8.5, 13, 5.5, W(b), 2); if (k === 'butcherblock') rect(2, 4, 12, 2, W('#c89a6a'), 3); break;
      case 'bed': case 'double': case 'cradle': rect(1.5, 7, 13, 5, m('#c8b898'), 3); rect(1.5, 5, 2, 9, W(a), 2); rect(12.5, 8, 2, 6, W(a), 2); rect(3.5, 9, 9, 3, m('#7a5a9a'), 2); rect(3.5, 7, 3, 2, m('#f0ece4'), 3); break;
      case 'chest': rect(2, 6, 12, 8, W(a), 2); rect(2, 6, 12, 2, W(b), 3); rect(7, 8, 2, 2, M('#c8a040'), 3); break;
      case 'wardrobe': case 'cupboard': case 'dresser': case 'bookcase': case 'shelf': case 'rack': rect(3, 1.5, 10, 13, W(a), 2); rect(7.6, 2, 0.8, 12, W(b), 1); if (k === 'bookcase' || k === 'shelf') for (const y of [5, 9, 13]) { rect(3, y, 10, 0.8, W(b), 1); for (let x = 4; x < 12; x += 1.6) rect(x, y - 2.5, 1, 2.5, m(['#a8382f', '#3a5a9a', '#6a8a3a'][Math.floor(x) % 3]), 2); } break;
      case 'barrel': case 'vat': case 'washtub': blob(8, 9, 5, k === 'washtub' ? 3.5 : 5.5, W(a), 1.8); rect(3, 6, 10, 0.8, M('#4a4a52'), 1); rect(3, 12, 10, 0.8, M('#4a4a52'), 1); break;
      case 'anvil': rect(2, 5, 12, 3, M('#4a4a52'), 3); rect(5, 8, 6, 3, M('#3a3a42'), 2); rect(3, 11, 10, 3, M('#4a4a52'), 2); break;
      case 'cauldron': blob(8, 10, 5.5, 4.5, M('#3a3a42'), 2); rect(2.5, 6, 11, 1.2, M('#5a5a62'), 3); break;
      case 'candlestand': rect(7.3, 4, 1.4, 10, M('#8a8a86'), 3); rect(5, 13.5, 6, 1, M('#8a8a86'), 2); rect(7.2, 2, 1.6, 2, m('#f0e8d0'), 3); break;
      case 'oven': case 'kiln': case 'forge': case 'fireplace': blob(8, 9, 6.5, 6, m(k === 'forge' ? '#7a7e88' : '#b8826a'), 2); rect(1.5, 9, 13, 5, m(k === 'forge' ? '#7a7e88' : '#b8826a'), 2); blob(8, 11, 3, 2.5, m('#1c1418'), 2); blob(8, 12, 1.6, 1, m('#f08a30'), 3); break;
      case 'millstone': blob(8, 9, 6.5, 4, m('#9a968e'), 2); blob(8, 7.5, 6.5, 3, m('#c8c4bc'), 2); blob(8, 7.5, 1, 0.8, m('#4a4a4a'), 2); break;
      case 'loom': case 'spinning': rect(2, 3, 1.4, 11, W(a), 2); rect(12.6, 3, 1.4, 11, W(a), 2); rect(2, 3, 12, 1.4, W(a), 2); for (let x = 4; x < 12; x += 1.4) rect(x, 4.4, 0.4, 7, m('#c8b898'), 3); break;
      case 'rug': rect(1, 5, 14, 7, m('#a8382f'), 2); rect(3, 7, 10, 3, m('#d8a050'), 2); break;
      case 'crate': rect(2.5, 4, 11, 10, W(a), 2); cap(3, 4.5, 13, 13.5, 0.4, 0.4, W(b)); rect(2.5, 4, 11, 1.2, W(b), 3); break;
      case 'sack': blob(8, 10, 5, 4.5, m('#c8b088'), 2); blob(8, 5, 2, 1.4, m('#c8b088'), 2); break;
      case 'woodpile': for (const [x, y] of [[4.5, 11], [11.5, 11], [8, 6]]) { blob(x, y, 3, 3, W('#7c5a38'), 2); blob(x, y, 1.6, 1.6, W('#c8a070'), 3); } break;
      case 'plant': rect(5, 10, 6, 4, m('#a8643a'), 2); for (let i = 0; i < 5; i++) blob(5 + i * 1.5, 6 + (i % 2), 1.8, 2.4, m('#4a8a3a'), 2); break;
      case 'ballotbox': rect(3, 4, 10, 7, W(a), 2); rect(5.5, 4, 5, 0.8, m('#1c1418'), 0); rect(4, 11, 1.2, 4, W(b), 1); rect(10.8, 11, 1.2, 4, W(b), 1); break;
      default: rect(3, 4, 10, 10, W(a), 2);
    }
  }
  // a dark outline round the drawing so it reads on any ground
  function outline(c) {
    const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height), a = d.data, w = c.width, h = c.height, out = new Uint8ClampedArray(a);
    for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
      const k = (y * w + i) * 4; if (a[k + 3] > 40) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = i + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < w && yy < h && a[(yy * w + xx) * 4 + 3] > 40; });
      if (nb) { out[k] = 34; out[k + 1] = 24; out[k + 2] = 30; out[k + 3] = 230; }
    }
    d.data.set(out); x.putImageData(d, 0, 0); return c;
  }
  const cache = new Map();
  function draw(k, n) {
    const key = k + ':' + n; if (cache.has(key)) return cache.get(key);
    const [shape, a, b] = lookOf(k), B = new O.MatBuffer(n, n); B.part(1);
    try { paint(B, n, shape, a, b); } catch (e) { B.blob(n / 2, n / 2, n / 3, n / 3, P().mat(a), { power: 2 }); }
    const c = outline(B.toCanvas()); cache.set(key, c); return c;
  }
  // icon for lists (16 px) and the smaller one for the ground or a table top (12 px)
  O.ItemArt = { icon: (k) => draw(k, 16), small: (k) => draw(k, 12), LOOK };
})();
