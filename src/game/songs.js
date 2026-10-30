// Songs. Every town has its old songs, and new ones are made: the minstrels and the town's own singers
// put what happens into verse (a bear killed in the woods, an outlaw who robs the rich, a hard winter, a
// wedding), and a song goes from mouth to mouth till half the town knows it, and on to other towns with
// the travellers. Of an evening in the tavern they sing them, a line at a time and then all together;
// at work some hum; and ask anyone for a song and they'll sing you one they know, if they're willing.
'use strict';
(function () {
  const OLD = [
    { title: 'The Miller\'s Daughter', lines: ['The miller\'s daughter by the weir,', 'She sang the water still,', 'And every lad from far and near', 'Came courting up the hill.'] },
    { title: 'Bring In the Sheaves', lines: ['Bring in the sheaves and bind them tight,', 'The sun is on the stubble,', 'We\'ll reap by day and dance by night', 'And never mind the trouble.'] },
    { title: 'The Long Road Home', lines: ['I left my love at Michaelmas', 'To walk the long road home,', 'The frost lay white upon the grass', 'And I was all alone.'] },
    { title: 'Old Tom the Tinker', lines: ['Old Tom the tinker mends a pot', 'And sells it back to you,', 'He swears it\'s good, but it is not,', 'And so says Tom\'s wife too.'] },
    { title: 'The Green Holly', lines: ['Green grows the holly on the hill,', 'Red are the berries bright,', 'Come in, come in, and drink your fill', 'Upon this winter night.'] },
    { title: 'The Ferryman', lines: ['Row me over, ferryman,', 'The water\'s deep and wide,', 'I\'ll pay you when I can, good man,', 'Upon the other side.'] },
    { title: 'Shepherd\'s Lament', lines: ['My flock is scattered on the moor,', 'The wind is in the west,', 'I\'ll count them all at the fold door', 'And then I\'ll take my rest.'] },
    { title: 'The Ale Is Brown', lines: ['The ale is brown, the bread is new,', 'The fire burns warm and bright,', 'So pass the jug from me to you', 'And sing away the night.'] },
  ];
  function setup(game) {
    const SP = O.Sim.prototype, PS = O.PlayerState, cur = () => O.SimRef.cur;
    const songs = () => (PS.songBook = PS.songBook || OLD.map((x, i) => Object.assign({ id: 'old' + i, old: true }, x)));
    const byId = (id) => songs().find((x) => x.id === id);
    const knows = (p) => (p.songs = p.songs || []);
    // everyone grows up knowing a few of the old songs
    const seed = (s) => { if (s._songsSeeded) return; s._songsSeeded = true; for (const p of s.people) if (p.age >= 6 && !p.songs) { const r = O.RNG(O.hash('songs', p.id)); p.songs = OLD.map((x, i) => 'old' + i).filter(() => r.chance(0.35)); } };
    // new songs out of what happens
    let composing = false;
    async function compose(s, about, maker) {
      if (composing) return null; composing = true;
      try {
        let song = null;
        if (O.AI && O.AI.ready && O.AI.json) {
          const out = await O.AI.json(`Write a short medieval folk song, the kind sung in an English village tavern, about this: ${about}\nReply ONLY with JSON {"title":"...","lines":["...","...","...","..."]}. Four short rhyming lines, plain words, no dashes, no modern words, no names of real places. Keep it singable.`);
          if (out && typeof out.title === 'string' && Array.isArray(out.lines) && out.lines.length >= 2) song = { title: out.title.slice(0, 40).replace(/[–—]/g, ','), lines: out.lines.slice(0, 6).map((l) => String(l).slice(0, 70).replace(/[–—]/g, ',')) };
        }
        if (!song) return null;
        song.id = 'new' + Date.now().toString(36); song.about = about; song.made = s.day; song.place = s.world.placeId; song.maker = maker ? maker.name : null;
        songs().push(song); if (maker) knows(maker).push(song.id);
        s.log(`A new song goes round ${s.world.name}: "${song.title}"${maker ? `, made by ${maker.name}` : ''}.`, 'social');
        return song;
      } catch (e) { return null; } finally { composing = false; }
    }
    O.composeSong = compose;
    // what's worth a song: deeds of the newcomer, and the town's big moments
    const sung = new Set();
    const _log = SP.log;
    SP.log = function (text, kind) {
      _log.apply(this, arguments);
      if (this !== cur() || sung.has(text) || !['disaster', 'crime', 'politics', 'life', 'event', 'war'].includes(kind)) return;
      if (!/(stranger|newcomer|bear|wolf|wed|crowned|harvest|flood|fire|storm|outlaw|war|battle|plague|knighted|champion)/i.test(text) || Math.random() > 0.35) return;
      sung.add(text);
      const maker = this.people.filter((p) => p.alive !== false && p.age >= 16 && (/minstrel|bard|fiddler|musician|piper/.test(p.job?.role || '') || this.has(p, 'creative') || this.has(p, 'social'))).sort(() => Math.random() - 0.5)[0];
      setTimeout(() => compose(this, text, maker), 2000 + Math.random() * 8000);
    };
    // songs spread: each day a few who know one teach a friend, and travellers carry them on
    const _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments); seed(this);
      for (const p of this.people) {
        const k = knows(p); if (!k.length || p.alive === false || Math.random() > 0.3) continue;
        const fr = [...p.rel.entries()].filter(([id, x]) => id !== 0 && x.affinity > 0.1).map(([id]) => this.byId.get(id)).filter(Boolean);
        const z = fr[Math.floor(Math.random() * fr.length)]; if (!z || z.age < 5) continue;
        const id = k[Math.floor(Math.random() * k.length)]; if (!knows(z).includes(id)) knows(z).push(id);
      }
      return r;
    };
    // singing it: line by line, over their heads, and a fiddle under it
    function sing(q, song, chorus) {
      if (!song || !O.Speech) return; let i = 0;
      const next = () => { if (i >= song.lines.length || q.alive === false) return; O.Speech.say(q, '♪ ' + song.lines[i] + ' ♪', 3.2); O.gesture && O.gesture(q, 'dance', 1.5);
        if (O.Sound) { const f = [262, 294, 330, 392][i % 4]; O.Sound.play('pluck', f, 0.4); }
        for (const z of chorus || []) if (i === song.lines.length - 1) setTimeout(() => O.Speech.say(z, '♪ ' + song.lines[i - 0] + ' ♪', 3), 400);
        i++; setTimeout(next, 3300); };
      next();
    }
    O.singSong = sing;
    // of an evening in the tavern (and now and then at work), someone strikes up
    let at = 0;
    game.hooks.update.push((dt) => {
      at -= dt; if (at > 0) return; at = 25 + Math.random() * 20;
      const s = cur(); if (!s || !game.scene || O.panelOpen) return; seed(s);
      const there = [...game.scene.actors.values()].map((a) => a.person).filter((z) => z && z.age >= 6 && knows(z).length && !(O.npcUI && O.npcUI.talking() === z));
      if (!there.length) return;
      const evening = s.hour >= 18 || s.hour < 1, tavern = game.scene.b.type === 'tavern' || (s.biz.get(game.scene.b.id) || {}).type === 'tavern';
      if (!(evening && tavern) && Math.random() > 0.15) return;
      const q = there[Math.floor(Math.random() * there.length)], k = knows(q), song = byId(k[Math.floor(Math.random() * k.length)]);
      if (!song) return;
      if (!(evening && tavern)) { O.Speech && O.Speech.say(q, '♪ ' + song.lines[0] + ' ♪', 3); return; } // (a line hummed at work)
      sing(q, song, there.filter((z) => z !== q && knows(z).includes(song.id)).slice(0, 4));
      if (!PS.songs) PS.songs = []; if (!PS.songs.includes(song.id)) PS.songs.push(song.id);
    });
    // asked for a song in talk
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) {
      if (a && a.do === 'sing') { const k = knows(q); if (!k.length) return null; const want = String(a.song || '').toLowerCase(); const song = (want && k.map(byId).find((x) => x && x.title.toLowerCase().includes(want))) || byId(k[Math.floor(Math.random() * k.length)]); if (!song) return null; O.npcUI && O.npcUI.closeTalk && setTimeout(() => sing(q, song), 600); (PS.songs = PS.songs || []).includes(song.id) || PS.songs.push(song.id); return null; }
      if (a && a.do === 'make_song') { compose(s, String(a.about || 'the player').slice(0, 160), q); return `${q.first} goes off humming, making a song of it.`; }
      return base.apply(this, arguments);
    };
    (O.extraActs = O.extraActs || []).push('sing {"song"?} (you sing one of the songs you know, if asked and willing)', 'make_song {"about"} (you are a singer and agree to make a new song about something)');
    (O.extraLines = O.extraLines || []).push((s, q) => { seed(s); const k = knows(q).map(byId).filter(Boolean); return k.length ? `Songs you know: ${k.slice(0, 6).map((x) => `"${x.title}"${x.about ? ' (a new one, about ' + x.about.slice(0, 60) + ')' : ''}`).join(', ')}.` : ''; });
  }
  O.SongsSetup = { setup };
})();
