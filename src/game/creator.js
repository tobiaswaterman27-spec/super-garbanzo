// Character creation screen: builds the player's Appearance from explicit choices,
// with a live 4-direction animated preview, a generated crowd and a genetics demo.
'use strict';
(function () {
  const P = O.Pal, C = P.cloth;

  const STYLES = {
    wanderer: { label: 'Wanderer', over: 'russet', overLen: 1, legs: 'brown', hat: null, cloak: null },
    hooded: { label: 'Hooded outlaw', over: 'forest', overLen: 1, legs: 'darkBrown', hat: 'hood', hatCol: 'forest', cloak: 'forest' },
    ragged: { label: 'Ragged poacher', over: 'undyed', overLen: 1, legs: 'greyWool', hat: null, cloak: null, sleeves: 'short' },
    rider: { label: 'Horse thief', over: 'darkBrown', overLen: 2, legs: 'black', hat: 'feather', hatCol: 'black', cloak: null },
    fence: { label: 'Fence', over: 'plum', overLen: 1, legs: 'navy', hat: 'cap', hatCol: 'plum', cloak: null },
    gentry: { label: 'Gentleman thief', over: 'navy', overLen: 1, legs: 'black', hat: 'feather', hatCol: 'crimson', cloak: 'crimson', trim: true },
    dress: { label: 'Kirtle & bodice', dress: true, over: 'forest', skirt: 'woad', legs: 'brown', hat: null, cloak: null },
    hoodedDress: { label: 'Hooded kirtle', dress: true, over: 'black', skirt: 'russet', legs: 'brown', hat: 'hood', hatCol: 'black', cloak: 'black' },
  };
  const ITEMS = { none: null, dagger: 'dagger', sword: 'sword', axe: 'axe', bread: 'bread', mug: 'mug' };

  function appearanceFromSpec(s) {
    const genes = {
      skin: s.skin, hair: s.hair, hairCurl: 0.3, eyes: s.eyes, height: s.height, build: s.build,
      face: { eyeGap: s.eyeGap, eyeType: s.eyeType, nose: s.nose, jaw: s.jaw, brow: s.brow, ears: 0, freckles: s.freckles },
    };
    const a = O.Char.makeAppearance(O.hash(s.name, s.surname) + 7, { sex: s.sex, age: s.age, genes, role: 'outlaw', hairStyle: s.hairStyle, beard: s.sex === 'm' ? s.beard : 'none', wealth: 0.4 });
    a.hair = P.mat(P.hair[s.hairGrey ? (s.age > 68 ? 'white' : 'grey') : s.hair], 'hair');
    a.hairStyle = s.hairStyle; a.beard = s.sex === 'm' && s.age >= 16 ? s.beard : 'none';
    const st = STYLES[s.style];
    const o = a.outfit;
    o.over = P.mat(C[s.tunic || st.over]); o.overLen = st.overLen ?? 0; o.legs = P.mat(C[s.trousers || st.legs]);
    o.skirt = st.dress ? P.mat(C[st.skirt]) : null; o.skirtLen = st.dress ? 1 : 0; o.dress = !!st.dress;
    o.sleeves = st.sleeves || 'long'; o.hat = s.hat === 'style' ? st.hat : (s.hat === 'none' ? null : s.hat);
    o.hatMat = P.mat(C[st.hatCol || s.tunic || st.over]);
    if (o.hat === 'kettle') o.hatMat = P.mat(P.metal.iron, 'metal');
    if (o.hat === 'straw') o.hatMat = P.mat('#d6b45e');
    o.cloak = s.cloak ? P.mat(C[s.cloakCol]) : null;
    o.trim = st.trim ? P.mat(P.metal.gold, 'metal') : null;
    o.item = ITEMS[s.item]; o.backItem = s.bow ? 'bow' : null; o.pouch = true; o.boots = true;
    o.apron = null; o.tabard = null; o.armour = null; o.sideItem = s.item === 'sword' ? null : (s.scabbard ? 'sword' : null);
    a.name = s.name; a.surname = s.surname;
    O.Char.invalidate(a);
    return a;
  }

  function defaultSpec() {
    return {
      name: 'Wat', surname: 'Tyler', sex: 'm', age: 27, skin: 2, hair: 'chestnut', hairGrey: false, hairStyle: 'messy',
      beard: 'stubble', eyes: 'hazel', height: 0.2, build: 0.1, eyeGap: 0, eyeType: 0, nose: 1, jaw: 0.15, brow: 1, freckles: false,
      style: 'hooded', tunic: '', trousers: '', hat: 'style', cloak: true, cloakCol: 'forest', item: 'dagger', bow: true, scabbard: false,
    };
  }

  O.Creator = { STYLES, ITEMS, appearanceFromSpec, defaultSpec };
})();
