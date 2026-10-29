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

  // ---------- controls: tabs of big tiles, each showing what it would look like ----------
  const hairNames = Object.keys(P.hair).filter((k) => k !== 'grey' && k !== 'white');
  const clothCols = ['russet', 'forest', 'darkBrown', 'black', 'woad', 'navy', 'crimson', 'plum', 'ochre', 'greyWool', 'undyed', 'olive', 'teal', 'madder'];
  const cap = (t) => t[0].toUpperCase() + t.slice(1);
  let tab = 'body';
  const TABS = [['body', 'Body'], ['face', 'Face'], ['hair', 'Hair'], ['clothes', 'Clothes'], ['hat', 'Hat & cloak']];
  // a small picture of you with one thing changed
  const thumbCache = new Map();
  function thumb(patch, crop) {
    const sp = Object.assign({}, spec, crop === 'head' && !('hat' in patch) ? { hat: 'none' } : {}, patch), key = crop + JSON.stringify(sp);
    let fr = thumbCache.get(key);
    if (!fr) { fr = Ch.frame(O.Creator.appearanceFromSpec(sp), 0, 'idle', 0); if (thumbCache.size > 300) thumbCache.clear(); thumbCache.set(key, fr); }
    const c = document.createElement('canvas'), ctx = c.getContext('2d');
    if (crop === 'head') { c.width = 60; c.height = 60; ctx.imageSmoothingEnabled = false; ctx.drawImage(fr, 6, Ch.FH - 48, 20, 20, 0, 0, 60, 60); }
    else { c.width = 48; c.height = 72; ctx.imageSmoothingEnabled = false; ctx.drawImage(fr, 0, Ch.FH - 48, 32, 48, 0, 0, 48, 72); }
    return c;
  }
  function section(title, ...kids) { const d = document.createElement('div'); if (title) { const h = document.createElement('div'); h.className = 'cc-h'; h.textContent = title; d.appendChild(h); } kids.forEach((k) => k && d.appendChild(k)); return d; }
  function tiles(key, opts, crop) {
    const d = document.createElement('div'); d.className = 'cc-tiles';
    for (const [v, lab, patch] of opts) {
      const b = document.createElement('button'); b.className = 'cc-tile'; b.setAttribute('aria-pressed', spec[key] === v);
      b.append(thumb(patch || { [key]: v }, crop), document.createTextNode(lab));
      b.onclick = () => { update(key, v); pane(); };
      d.appendChild(b);
    }
    return d;
  }
  function swatchRow(key, list, own) {
    const d = document.createElement('div'); d.className = 'cc-sw';
    if (own) { const b = document.createElement('button'); b.className = 'cc-own'; b.title = 'As the style has it'; b.setAttribute('aria-label', b.title); b.setAttribute('aria-pressed', !spec[key]); b.onclick = () => { update(key, ''); pane(); }; d.appendChild(b); }
    for (const [v, hex, name] of list) { const b = document.createElement('button'); b.style.background = hex; b.title = cap(name.replace(/([A-Z])/g, ' $1').toLowerCase()); b.setAttribute('aria-label', b.title); b.setAttribute('aria-pressed', spec[key] === v); b.onclick = () => { update(key, v); pane(); }; d.appendChild(b); }
    return d;
  }
  function slider(label, key, min, max, step, show) {
    const l = document.createElement('label'); l.className = 'cc-slide';
    const t = document.createElement('span'); t.textContent = label;
    const r = document.createElement('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = spec[key];
    const v = document.createElement('b'); const sh = () => { v.textContent = show ? show(spec[key]) : ''; }; sh();
    r.oninput = () => { update(key, +r.value); sh(); };
    l.append(t, r, v); return l;
  }
  const word = (v, lo, mid, hi) => (v < -0.3 ? lo : v > 0.3 ? hi : mid);
  function pane() {
    const root = $('controls'); root.innerHTML = '';
    const add = (...k) => k.forEach((x) => root.appendChild(x));
    if (tab === 'body') add(
      section('You are', tiles('sex', [['m', 'A man', { sex: 'm', style: 'hooded', hairStyle: O.Char.HAIR_STYLES_M.includes(spec.hairStyle) ? spec.hairStyle : 'short' }], ['f', 'A woman', { sex: 'f', style: 'hoodedDress', hairStyle: O.Char.HAIR_STYLES_F.includes(spec.hairStyle) ? spec.hairStyle : 'long' }]], 'body')),
      section('Skin', swatchRow('skin', P.skin.map((h, i) => [i, h, 'Tone ' + (i + 1)]))),
      section(null, slider('Age', 'age', 16, 80, 1, (v) => String(v)), slider('Height', 'height', -1, 1, 0.1, (v) => word(v, 'Short', 'Middling', 'Tall')), slider('Build', 'build', -1, 1, 0.1, (v) => word(v, 'Slight', 'Middling', 'Broad'))));
    if (tab === 'face') add(
      section('Eyes', tiles('eyeType', [[0, 'Bright'], [1, 'Wide'], [2, 'Narrow']], 'head')),
      section('Eye colour', swatchRow('eyes', Object.entries(P.eyes).map(([k, h]) => [k, h, k]))),
      section('Set', tiles('eyeGap', [[0, 'Close'], [1, 'Wide set']], 'head')),
      section('Nose', tiles('nose', [[0, 'Small'], [1, 'Straight'], [2, 'Broad']], 'head')),
      section('Brows', tiles('brow', [[0, 'Faint'], [1, 'Fine'], [2, 'Heavy']], 'head')),
      section('Freckles', tiles('freckles', [[false, 'None'], [true, 'Freckled']], 'head')),
      section(null, slider('Jaw', 'jaw', 0, 0.4, 0.05, (v) => (v < 0.12 ? 'Soft' : v > 0.28 ? 'Square' : 'Firm'))));
    if (tab === 'hair') add(
      section('Style', tiles('hairStyle', (spec.sex === 'f' ? Ch.HAIR_STYLES_F : Ch.HAIR_STYLES_M).map((h) => [h, cap(h)]), 'head')),
      section('Colour', swatchRow('hair', hairNames.map((k) => [k, P.hair[k], k]))),
      section('Grey', tiles('hairGrey', [[false, 'Not yet'], [true, 'Greying']], 'head')),
      spec.sex === 'm' ? section('Beard', tiles('beard', [...new Set(Ch.BEARDS)].map((h) => [h, cap(h)]), 'head')) : null);
    if (tab === 'clothes') add(
      section('Look', tiles('style', Object.entries(O.Creator.STYLES).filter(([, st]) => spec.sex === 'f' || !st.dress).map(([k, st]) => [k, st.label, { style: k, tunic: '', trousers: '' }]), 'body')),
      section(spec.sex === 'f' ? 'Bodice' : 'Tunic', swatchRow('tunic', clothCols.map((k) => [k, P.cloth[k], k]), true)),
      section('Hose', swatchRow('trousers', clothCols.map((k) => [k, P.cloth[k], k]), true)));
    if (tab === 'hat') add(
      section('On your head', tiles('hat', [['style', 'As the look'], ['none', 'Bare'], ['hood', 'Hood'], ['cap', 'Cap'], ['feather', 'Feathered'], ['straw', 'Straw hat'], ['kettle', 'Kettle helm']], 'head')),
      section('Cloak', tiles('cloak', [[false, 'None'], [true, 'Cloak']], 'body')),
      spec.cloak ? section('Cloak colour', swatchRow('cloakCol', clothCols.map((k) => [k, P.cloth[k], k]))) : null);
  }
  function tabs() {
    const d = $('ccTabs'); d.innerHTML = '';
    for (const [k, l] of TABS.filter(([k0]) => !fitting || k0 === 'clothes' || k0 === 'hat')) { const b = document.createElement('button'); b.textContent = l; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', k === tab); b.onclick = () => { tab = k; tabs(); pane(); }; d.appendChild(b); }
  }
  function update(k, v) {
    spec[k] = v;
    if (k === 'sex') { spec.style = v === 'f' ? 'hoodedDress' : 'hooded'; spec.tunic = ''; spec.trousers = ''; if (v === 'f' && !O.Char.HAIR_STYLES_F.includes(spec.hairStyle)) spec.hairStyle = 'long'; if (v === 'm' && !O.Char.HAIR_STYLES_M.includes(spec.hairStyle)) spec.hairStyle = 'short'; }
    if (k === 'style') { spec.tunic = ''; spec.trousers = ''; }
    player = O.Creator.appearanceFromSpec(spec);
    try { localStorage.setItem('outlaw.spec', JSON.stringify(spec)); } catch (e) { /* ignore */ }
    sub();
  }
  function sub() { const e = document.getElementById('ccSub'); if (e) e.textContent = `${spec.age} years old, ${O.Creator.STYLES[spec.style].label.toLowerCase()}`; }
  function nameplate() {
    const root = $('nameplate'); root.innerHTML = '';
    const mk = (id, key, ph) => { const i = document.createElement('input'); i.type = 'text'; i.id = id; i.value = spec[key]; i.placeholder = ph; i.maxLength = 16; i.oninput = () => update(key, i.value.trim() || (key === 'name' ? 'Nameless' : '')); return i; };
    const s2 = document.createElement('div'); s2.className = 'cc-sub'; s2.id = 'ccSub';
    root.append(mk('fName', 'name', 'Name'), mk('fSurname', 'surname', 'Surname'), s2); sub();
  }
  function buildControls() { tabs(); pane(); nameplate(); }
  $('ccRandom').onclick = () => {
    if (fitting) return endFitting(false);
    const r = O.RNG(Date.now() & 0xffffffff); const sex = r.chance(0.5) ? 'm' : 'f';
    Object.assign(spec, {
      sex, age: r.int(17, 60), skin: r.int(0, 7), hair: r.pick(hairNames), hairStyle: r.pick(sex === 'm' ? Ch.HAIR_STYLES_M : Ch.HAIR_STYLES_F), beard: r.pick(Ch.BEARDS), hairGrey: false,
      eyes: r.pick(Object.keys(P.eyes)), height: +r.float(-1, 1).toFixed(1), build: +r.float(-1, 1).toFixed(1), eyeType: r.int(0, 2), nose: r.int(0, 2), brow: r.int(0, 2), jaw: +r.float(0, 0.35).toFixed(2), eyeGap: r.int(0, 1), freckles: r.chance(0.2),
      style: r.pick(sex === 'm' ? ['wanderer', 'hooded', 'ragged', 'rider', 'fence', 'gentry'] : ['dress', 'hoodedDress', 'hooded', 'wanderer', 'rider']), tunic: '', trousers: '', hat: 'style', cloakCol: r.pick(clothCols), cloak: r.chance(0.5),
      name: r.pick(sex === 'm' ? ['Wat', 'Hob', 'Will', 'Adam', 'Gil', 'Tom', 'Rafe', 'Osric', 'Jack', 'Hal'] : ['Maud', 'Alys', 'Joan', 'Agnes', 'Elena', 'Isolde', 'Meg', 'Cecily', 'Rose', 'Edith']),
      surname: r.pick(['Tyler', 'Scarlock', 'Fletcher', 'Ward', 'Blackwood', 'Hale', 'Crowe', 'Marsh', 'Thorne', 'Reeve']),
    });
    update('age', spec.age); buildControls();
  };

  // ---------- the portrait: you, turning slowly, or as you turn yourself ----------
  const prev = $('preview'), pctx = prev.getContext('2d');
  const TURN = [0, 1, 3, 2]; let turn = 0, turnAt = -1, manual = 0;
  for (const b of document.querySelectorAll('.cc-turn')) b.onclick = () => { turn = (turn + +b.dataset.turn + 4) % 4; manual = performance.now(); };
  function sizePreview() { prev.width = 200; prev.height = 270; }
  function drawPreview(t) {
    if (turnAt < 0) turnAt = t;
    if (!manual || t - manual > 6000) { if (t - turnAt > 2600) { turn = (turn + 1) % 4; turnAt = t; } }
    pctx.clearRect(0, 0, prev.width, prev.height); pctx.imageSmoothingEnabled = false;
    const A = Ch.ANIMS.idle, f = Math.floor((t / 1000) * A.fps) % A.frames, sc = 5, x = (200 - 32 * sc) / 2, y = 270 - Ch.FH * sc - 4;
    pctx.fillStyle = 'rgba(120,90,40,.22)'; pctx.beginPath(); pctx.ellipse(100, y + Ch.GROUND * sc, 46, 9, 0, 0, 7); pctx.fill();
    pctx.drawImage(Ch.frame(player, TURN[turn], 'idle', f), x, y, 32 * sc, Ch.FH * sc);
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
      crowd.push({ a, dir: r.int(0, 7), anim: r.pick(['idle', 'idle', 'walk', 'talk', 'work', 'eat']), off: r.int(0, 5) });
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
      cctx.drawImage(Ch.frame(c.a, c.dir, c.anim, f), x * s, y * s, 32 * s, Ch.FH * s);
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
      fctx.drawImage(Ch.frame(a, 0, 'idle', f), x * s, y * s, 32 * s, Ch.FH * s);
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

  // ---------- one-time character creation ----------
  // Shown only when a new life begins; afterwards the player is who they made.
  let open = false, done = null;
  // at the tailor's: only the clothes and the hat, paid for when they're made
  let fitting = null; const CLOTHES = ['style', 'tunic', 'trousers', 'hat', 'cloak', 'cloakCol'];
  function showWardrobe(opts, cb) {
    fitting = { price: opts.price || 12, shop: opts.shop || 'the tailor', was: JSON.parse(JSON.stringify(spec)), cb };
    open = true; tab = 'clothes'; turn = 0; turnAt = -1; buildControls(); $('tab-forge').hidden = false; resize();
    $('beginLife').textContent = `Have them made (₳${fitting.price})`; $('ccRandom').textContent = 'Leave as I was';
    for (const i of document.querySelectorAll('#nameplate input')) i.disabled = true;
  }
  function endFitting(keep) {
    const f = fitting; if (!f) return; fitting = null; open = false; $('tab-forge').hidden = true;
    $('beginLife').textContent = 'Begin your life'; $('ccRandom').textContent = 'Surprise me';
    if (!keep) { Object.assign(spec, f.was); player = O.Creator.appearanceFromSpec(spec); try { localStorage.setItem('outlaw.spec', JSON.stringify(spec)); } catch (e) { /* ignore */ } }
    f.cb && f.cb(keep ? player : null, f);
  }
  function showCreator(cb) { open = true; done = cb; turn = 0; turnAt = -1; buildControls(); $('tab-forge').hidden = false; resize(); }
  $('beginLife').onclick = () => {
    if (fitting) { const changed = CLOTHES.some((k) => JSON.stringify(spec[k]) !== JSON.stringify(fitting.was[k])); if (changed && O.PlayerState && O.PlayerState.money < fitting.price) { O.Panels && O.Panels.toast(`That's ₳${fitting.price}, and you haven't it.`, 'bad'); return; } return endFitting(changed); }
    open = false; $('tab-forge').hidden = true;
    try { localStorage.setItem('outlaw.created', '1'); } catch (e) { /* ignore */ }
    const f = done; done = null; f && f(player);
  };
  function resize() { sizePreview(); }
  window.addEventListener('resize', resize);
  buildControls(); resize();
  function loop(t) { if (open) drawPreview(t); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
  // a new face for the same life: the heir who takes over
  const setPlayer = (a, sp) => { player = a; if (sp) { spec = sp; try { localStorage.setItem('outlaw.spec', JSON.stringify(sp)); } catch (e) { /* ignore */ } } };
  O.Forge = { get player() { return player; }, spec: () => spec, setPlayer, showCreator, showWardrobe, created: () => { try { return localStorage.getItem('outlaw.created') === '1'; } catch (e) { return true; } } };
})();
