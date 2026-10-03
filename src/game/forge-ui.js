// UI wiring for the Sprite Forge (character creation) screen.
'use strict';
(function () {
  const P = O.Pal, Ch = O.Char;
  const $ = (id) => document.getElementById(id);
  let spec = O.Creator.defaultSpec();
  try { const s = localStorage.getItem('outlaw.spec'); if (s) spec = Object.assign(spec, JSON.parse(s)); } catch (e) { /* storage unavailable */ }
  let player = O.Creator.appearanceFromSpec(spec);
  let anim = 'walk';

  // ---------- ground texture shared by the views ----------
  function groundTile(w, h, seed, kind = 'grass') {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); const img = ctx.createImageData(w, h);
    const g = P.makeRamp(kind === 'grass' ? '#5d8a3e' : '#8a6a44', 0.8), d = P.makeRamp('#8a6a44', 0.8);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = O.fbm(x / 9, y / 9, seed, 3), fine = O.noise2(x * 1.7, y * 1.7, seed + 9);
      let col;
      if (kind === 'path' && Math.abs(y - h * 0.62) < 7 + n * 6) col = d[n > 0.55 ? 3 : n > 0.4 ? 2 : 1];
      else col = g[fine > 0.86 ? 4 : n > 0.58 ? 3 : n > 0.42 ? 2 : 1];
      // occasional grass blades
      if (kind !== 'path' || Math.abs(y - h * 0.62) >= 7 + n * 6) if (O.noise2(x * 3.1, y * 3.1, seed + 3) > 0.93) col = g[4];
      const i = (y * w + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); return c;
  }
  function shadow(ctx, x, y, w) { // pixel ellipse shadow under feet
    ctx.fillStyle = 'rgba(20,14,30,0.35)';
    const hw = Math.floor(w / 2);
    ctx.fillRect(x - hw + 2, y - 1, w - 4, 3); ctx.fillRect(x - hw, y, w, 1);
  }

  // ---------- controls ----------
  function seg(opts, val, on) {
    const d = document.createElement('div'); d.className = 'seg';
    for (const [v, lab] of opts) { const b = document.createElement('button'); b.textContent = lab; b.setAttribute('aria-pressed', v === val); b.onclick = () => { on(v); [...d.children].forEach((x) => x.setAttribute('aria-pressed', x === b)); }; d.appendChild(b); }
    return d;
  }
  function swatches(list, val, on, label) {
    const d = document.createElement('div'); d.className = 'sw'; d.setAttribute('aria-label', label);
    for (const [v, hex, name] of list) { const b = document.createElement('button'); b.style.background = hex; b.title = name; b.setAttribute('aria-label', name); b.setAttribute('aria-pressed', v === val); b.onclick = () => { on(v); [...d.children].forEach((x) => x.setAttribute('aria-pressed', x === b)); }; d.appendChild(b); }
    return d;
  }
  function select(id, opts, val, on) {
    const s = document.createElement('select'); s.id = id;
    for (const [v, lab] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = lab; if (v === val) o.selected = true; s.appendChild(o); }
    s.onchange = () => on(s.value); return s;
  }
  function range(id, min, max, step, val, on) { const r = document.createElement('input'); r.type = 'range'; r.id = id; r.min = min; r.max = max; r.step = step; r.value = val; r.oninput = () => on(+r.value); return r; }
  function field(label, el) { const l = document.createElement('label'); const s = document.createElement('span'); s.className = 'lbl'; s.textContent = label; l.append(s, el); return l; }
  function group(title, ...kids) { const g = document.createElement('div'); g.className = 'group'; if (title) { const s = document.createElement('span'); s.className = 'lbl'; s.textContent = title; g.appendChild(s); } kids.forEach((k) => g.appendChild(k)); return g; }
  function row(...kids) { const r = document.createElement('div'); r.className = 'row'; kids.forEach((k) => r.appendChild(k)); return r; }
  function chk(label, val, on) { const l = document.createElement('label'); l.className = 'chk'; const i = document.createElement('input'); i.type = 'checkbox'; i.checked = val; i.onchange = () => on(i.checked); l.append(i, document.createTextNode(label)); return l; }

  function update(k, v) {
    spec[k] = v;
    if (k === 'sex') { spec.style = v === 'f' ? 'hoodedDress' : 'hooded'; if (v === 'f' && O.Char.HAIR_STYLES_M.includes(spec.hairStyle) && !O.Char.HAIR_STYLES_F.includes(spec.hairStyle)) spec.hairStyle = 'long'; buildControls(); }
    player = O.Creator.appearanceFromSpec(spec);
    try { localStorage.setItem('outlaw.spec', JSON.stringify(spec)); } catch (e) { /* ignore */ }
    nameplate(); drawSheet();
  }
  function nameplate() {
    $('nameplate').innerHTML = '';
    $('nameplate').append(document.createTextNode(`${spec.name} ${spec.surname}`));
    const s = document.createElement('span'); s.textContent = `AGE ${spec.age} · ${Ch.ageStage(spec.age).replace(/([A-Z])/g, ' $1').toUpperCase()} · ${O.Creator.STYLES[spec.style].label.toUpperCase()}`;
    $('nameplate').append(s);
  }

  function buildControls() {
    const root = $('controls'); root.innerHTML = '';
    const h = document.createElement('h2'); h.textContent = 'Who are you?'; root.appendChild(h);
    const name = document.createElement('input'); name.type = 'text'; name.id = 'fName'; name.value = spec.name; name.oninput = () => update('name', name.value || 'Nameless');
    const sur = document.createElement('input'); sur.type = 'text'; sur.id = 'fSurname'; sur.value = spec.surname; sur.oninput = () => update('surname', sur.value);
    root.appendChild(group(null, row(field('Name', name), field('Surname', sur))));
    root.appendChild(group('Body',
      row(seg([['m', 'Man'], ['f', 'Woman']], spec.sex, (v) => update('sex', v))),
      field(`Age`, range('fAge', 16, 80, 1, spec.age, (v) => update('age', v))),
      row(field('Height', range('fHeight', -1, 1, 0.1, spec.height, (v) => update('height', v))), field('Build', range('fBuild', -1, 1, 0.1, spec.build, (v) => update('build', v)))),
      field('Skin', swatches(P.skin.map((h, i) => [i, h, 'Skin tone ' + (i + 1)]), spec.skin, (v) => update('skin', v), 'Skin tone')),
    ));
    const hairNames = Object.keys(P.hair).filter((k) => k !== 'grey' && k !== 'white');
    const styles = [...new Set([...Ch.HAIR_STYLES_M, ...Ch.HAIR_STYLES_F])];
    root.appendChild(group('Face & hair',
      field('Hair colour', swatches(hairNames.map((k) => [k, P.hair[k], k]), spec.hair, (v) => update('hair', v), 'Hair colour')),
      row(chk('Greying', spec.hairGrey, (v) => update('hairGrey', v))),
      row(field('Hairstyle', select('fHair', styles.map((s) => [s, s[0].toUpperCase() + s.slice(1)]), spec.hairStyle, (v) => update('hairStyle', v))),
        ...(spec.sex === 'm' ? [field('Beard', select('fBeard', [...new Set(Ch.BEARDS)].map((s) => [s, s[0].toUpperCase() + s.slice(1)]), spec.beard, (v) => update('beard', v)))] : [])),
      field('Eyes', swatches(Object.entries(P.eyes).map(([k, h]) => [k, h, k]), spec.eyes, (v) => update('eyes', v), 'Eye colour')),
      row(field('Eye shape', select('fEyeT', [[0, 'Bright'], [1, 'Wide'], [2, 'Narrow']], spec.eyeType, (v) => update('eyeType', +v))),
        field('Nose', select('fNose', [[0, 'Small'], [1, 'Straight'], [2, 'Broad']], spec.nose, (v) => update('nose', +v)))),
      row(field('Jaw', range('fJaw', 0, 0.4, 0.05, spec.jaw, (v) => update('jaw', v))), field('Eye spacing', range('fGap', 0, 1, 1, spec.eyeGap, (v) => update('eyeGap', v)))),
      row(field('Brows', select('fBrow', [[0, 'Faint'], [1, 'Fine'], [2, 'Heavy']], spec.brow, (v) => update('brow', +v))), chk('Freckles', spec.freckles, (v) => update('freckles', v))),
    ));
    const clothCols = ['russet', 'forest', 'darkBrown', 'black', 'woad', 'navy', 'crimson', 'plum', 'ochre', 'greyWool', 'undyed', 'olive', 'teal', 'madder'];
    root.appendChild(group('Clothing',
      field('Style', select('fStyle', Object.entries(O.Creator.STYLES).map(([k, s]) => [k, s.label]), spec.style, (v) => { spec.tunic = ''; update('style', v); buildControls(); })),
      field('Tunic / bodice', swatches(clothCols.map((k) => [k, P.cloth[k], k]), spec.tunic, (v) => update('tunic', v), 'Tunic colour')),
      field('Trousers', swatches(clothCols.map((k) => [k, P.cloth[k], k]), spec.trousers, (v) => update('trousers', v), 'Trouser colour')),
      row(field('Headwear', select('fHat', [['style', 'Match style'], ['none', 'Bare head'], ['hood', 'Hood'], ['cap', 'Cap'], ['feather', 'Feathered cap'], ['straw', 'Straw hat'], ['kettle', 'Kettle helm']], spec.hat, (v) => update('hat', v)))),
      row(chk('Cloak', spec.cloak, (v) => update('cloak', v))),
      field('Cloak colour', swatches(clothCols.map((k) => [k, P.cloth[k], k]), spec.cloakCol, (v) => update('cloakCol', v), 'Cloak colour')),
    ));
    root.appendChild(group('Gear',
      field('In hand', select('fItem', [['none', 'Nothing'], ['dagger', 'Dagger'], ['sword', 'Sword'], ['axe', 'Axe'], ['bread', 'Stolen loaf'], ['mug', 'Tankard']], spec.item, (v) => update('item', v))),
      row(chk('Bow on back', spec.bow, (v) => update('bow', v)), chk('Sword at hip', spec.scabbard, (v) => update('scabbard', v))),
    ));
    const rnd = document.createElement('button'); rnd.className = 'btn ghost'; rnd.textContent = 'Randomise';
    rnd.onclick = () => {
      const r = O.RNG(Date.now() & 0xffffffff); const sex = r.chance(0.5) ? 'm' : 'f';
      Object.assign(spec, {
        sex, age: r.int(17, 60), skin: r.int(0, 7), hair: r.pick(hairNames), hairStyle: r.pick(sex === 'm' ? Ch.HAIR_STYLES_M : Ch.HAIR_STYLES_F), beard: r.pick(Ch.BEARDS),
        eyes: r.pick(Object.keys(P.eyes)), height: +r.float(-1, 1).toFixed(1), build: +r.float(-1, 1).toFixed(1), eyeType: r.int(0, 2), nose: r.int(0, 2), brow: r.int(0, 2), jaw: +r.float(0, 0.35).toFixed(2),
        style: r.pick(sex === 'm' ? ['wanderer', 'hooded', 'ragged', 'rider', 'fence', 'gentry'] : ['dress', 'hoodedDress', 'hooded', 'wanderer', 'rider']), tunic: '', trousers: '', cloakCol: r.pick(clothCols), cloak: r.chance(0.5), item: r.pick(['none', 'dagger', 'sword', 'axe']), bow: r.chance(0.4),
        name: r.pick(sex === 'm' ? ['Wat', 'Hob', 'Will', 'Adam', 'Gil', 'Tom', 'Rafe', 'Osric', 'Jack', 'Hal'] : ['Maud', 'Alys', 'Joan', 'Agnes', 'Elena', 'Isolde', 'Meg', 'Cecily', 'Rose', 'Edith']),
        surname: r.pick(['Tyler', 'Scarlock', 'Fletcher', 'Ward', 'Blackwood', 'Hale', 'Crowe', 'Marsh', 'Thorne', 'Reeve']),
      });
      buildControls(); update('age', spec.age);
    };
    root.appendChild(group(null, rnd));
  }

  // ---------- preview ----------
  const prev = $('preview'), pctx = prev.getContext('2d');
  const PS = () => (window.innerWidth < 600 ? 2 : 4);
  let previewGround = null;
  function sizePreview() {
    const s = PS(); prev.width = 4 * 40 * s; prev.height = 64 * s;
    prev.style.width = prev.width + 'px'; prev.style.height = prev.height + 'px';
    previewGround = groundTile(160, 64, 11, 'path');
  }
  function drawPreview(t) {
    const s = PS();
    pctx.imageSmoothingEnabled = false;
    pctx.drawImage(previewGround, 0, 0, 160 * s, 64 * s);
    const A = Ch.ANIMS[anim]; const f = Math.floor((t / 1000) * A.fps) % A.frames;
    const order = [0, 1, 2, 3];
    order.forEach((d, i) => {
      const x = i * 40 + 4, y = 10;
      if (anim !== 'sleep') { pctx.save(); pctx.scale(s, s); shadow(pctx, x + 16, y + Ch.GROUND, 16); pctx.restore(); }
      pctx.drawImage(Ch.frame(player, d, anim, f), x * s, y * s, 32 * s, 48 * s);
    });
  }
  function buildAnimChips() {
    const d = $('animChips'); d.innerHTML = '';
    Object.keys(Ch.ANIMS).forEach((k) => {
      const b = document.createElement('button'); b.textContent = k.toUpperCase(); b.setAttribute('aria-pressed', k === anim);
      b.onclick = () => { anim = k; [...d.children].forEach((x) => x.setAttribute('aria-pressed', x === b)); };
      d.appendChild(b);
    });
  }

  // ---------- crowd ----------
  const roles = ['villager', 'villager', 'farmer', 'farmhand', 'blacksmith', 'baker', 'guard', 'innkeeper', 'merchant', 'doctor', 'priest', 'woodcutter', 'miller', 'fisher', 'courier', 'noble', 'outlaw'];
  let crowd = [], region = 'south', crowdSeed = 1;
  function makeCrowd() {
    const r = O.RNG(crowdSeed * 977 + region.length);
    const wealth = +$('crowdWealth').value;
    crowd = [];
    for (let i = 0; i < 40; i++) {
      const age = r.weighted([[r.int(3, 7), 1], [r.int(8, 12), 1], [r.int(13, 17), 1], [r.int(18, 44), 4], [r.int(45, 64), 2], [r.int(65, 85), 1.2]]);
      const role = age < 13 ? 'child' : r.pick(roles);
      const a = Ch.makeAppearance(r.int(1, 1e9), { age, role, region, wealth: O.clamp(wealth + r.float(-0.25, 0.25), 0, 1) });
      crowd.push({ a, dir: r.int(0, 3), anim: r.pick(['idle', 'idle', 'walk', 'talk', 'work', 'eat']), off: r.int(0, 5) });
    }
    const leg = $('crowdLegend'); leg.innerHTML = '';
    const counts = {}; crowd.forEach((c) => { counts[c.a.stage] = (counts[c.a.stage] || 0) + 1; });
    Object.entries(counts).forEach(([k, v]) => { const d = document.createElement('div'); d.innerHTML = `<b>${v}</b> ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`; leg.appendChild(d); });
  }
  const crowdC = $('crowd'), cctx = crowdC.getContext('2d'); let crowdGround = null;
  function sizeCrowd() {
    const s = window.innerWidth < 600 ? 2 : 3, cols = window.innerWidth < 600 ? 5 : 10;
    crowdC.width = cols * 34 * s; crowdC.height = Math.ceil(40 / cols) * 50 * s; crowdC.dataset.cols = cols; crowdC.dataset.s = s;
    crowdGround = groundTile(cols * 34, Math.ceil(40 / cols) * 50, 5, 'grass');
  }
  function drawCrowd(t) {
    const s = +crowdC.dataset.s, cols = +crowdC.dataset.cols;
    cctx.imageSmoothingEnabled = false;
    cctx.drawImage(crowdGround, 0, 0, crowdGround.width * s, crowdGround.height * s);
    crowd.forEach((c, i) => {
      const x = (i % cols) * 34 + 1, y = Math.floor(i / cols) * 50;
      const A = Ch.ANIMS[c.anim]; const f = (Math.floor((t / 1000) * A.fps) + c.off) % A.frames;
      cctx.save(); cctx.scale(s, s); shadow(cctx, x + 16, y + Ch.GROUND, 14); cctx.restore();
      cctx.drawImage(Ch.frame(c.a, c.dir, c.anim, f), x * s, y * s, 32 * s, 48 * s);
    });
  }

  // ---------- family / genetics ----------
  let family = null, famSeed = 3;
  function makeFamily() {
    const r = O.RNG(famSeed * 7919);
    const dadG = Ch.randomGenes(r, r.pick(['north', 'south', 'east', 'west'])), mumG = Ch.randomGenes(r, r.pick(['north', 'south', 'east', 'west']));
    const gdad = Ch.makeAppearance(r.int(1, 1e9), { sex: 'm', age: 72, genes: dadG, role: 'villager' });
    const dad = Ch.makeAppearance(r.int(1, 1e9), { sex: 'm', age: 41, genes: dadG, role: r.pick(['blacksmith', 'farmer', 'miller', 'merchant']) });
    const mum = Ch.makeAppearance(r.int(1, 1e9), { sex: 'f', age: 38, genes: mumG, role: r.pick(['baker', 'villager', 'innkeeper']) });
    const kidsAges = [19, 15, 10, 6, 2];
    const kids = kidsAges.map((age) => { const g = Ch.inheritGenes(r, mumG, dadG); const sex = r.chance(0.5) ? 'm' : 'f'; return Ch.makeAppearance(r.int(1, 1e9), { sex, age, genes: g, role: age < 13 ? 'child' : 'villager' }); });
    gdad.label = 'Grandfather, 72'; dad.label = 'Father, 41'; mum.label = 'Mother, 38';
    kids.forEach((k, i) => (k.label = `${k.sex === 'm' ? 'Son' : 'Daughter'}, ${kidsAges[i]}`));
    family = { gdad, dad, mum, kids };
    const leg = $('familyLegend'); leg.innerHTML = '';
    [gdad, dad, mum, ...kids].forEach((p) => { const d = document.createElement('div'); d.innerHTML = `<b>${p.label}</b><br>${p.genes.hair.replace(/([A-Z])/g, ' $1').toLowerCase()} hair, ${p.genes.eyes} eyes`; leg.appendChild(d); });
  }
  const famC = $('family'), fctx = famC.getContext('2d'); let famGround = null;
  function sizeFam() { const s = window.innerWidth < 600 ? 2 : 3; famC.width = 8 * 34 * s; famC.height = 56 * s; famC.dataset.s = s; famGround = groundTile(8 * 34, 56, 21, 'grass'); }
  function drawFamily(t) {
    const s = +famC.dataset.s; fctx.imageSmoothingEnabled = false;
    fctx.drawImage(famGround, 0, 0, famGround.width * s, famGround.height * s);
    const all = [family.gdad, family.dad, family.mum, ...family.kids];
    const f = Math.floor((t / 1000) * 3) % 4;
    all.forEach((a, i) => {
      const x = i * 34 + 1, y = 4;
      fctx.save(); fctx.scale(s, s); shadow(fctx, x + 16, y + Ch.GROUND, 14); fctx.restore();
      fctx.drawImage(Ch.frame(a, 0, 'idle', f), x * s, y * s, 32 * s, 48 * s);
    });
  }

  // ---------- sprite sheet ----------
  function drawSheet() {
    const sh = Ch.sheet(player); const c = $('sheet'); const s = window.innerWidth < 600 ? 1 : 2;
    c.width = sh.canvas.width * s; c.height = sh.canvas.height * s;
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#2a3a24'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(sh.canvas, 0, 0, c.width, c.height);
  }

  // ---------- tabs & loop ----------
  let tab = 'forge';
  document.querySelectorAll('.tab').forEach((b) => b.onclick = () => {
    tab = b.dataset.tab;
    document.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', x === b));
    ['forge', 'crowd', 'blood', 'sheet'].forEach((k) => ($('tab-' + k).hidden = k !== tab));
  });
  ['north', 'east', 'south', 'west'].forEach(() => {});
  $('regionSeg').replaceWith(Object.assign(seg([['north', 'North'], ['east', 'East'], ['south', 'South'], ['west', 'West']], region, (v) => { region = v; makeCrowd(); }), { id: 'regionSeg' }));
  $('reroll').onclick = () => { crowdSeed++; makeCrowd(); };
  $('crowdWealth').oninput = () => makeCrowd();
  $('newFamily').onclick = () => { famSeed++; makeFamily(); };

  function resize() { sizePreview(); sizeCrowd(); sizeFam(); drawSheet(); }
  window.addEventListener('resize', resize);
  buildControls(); buildAnimChips(); nameplate(); makeCrowd(); makeFamily(); resize();
  function loop(t) {
    if (tab === 'forge') drawPreview(t);
    else if (tab === 'crowd') drawCrowd(t);
    else if (tab === 'blood') drawFamily(t);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  O.Forge = { get player() { return player; }, spec: () => spec };
})();
