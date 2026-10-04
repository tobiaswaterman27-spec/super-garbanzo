// Words spoken aloud in the street or a room, shown as a little parchment bubble over the speaker's
// head. You only hear what is said near you: past earshot nothing shows. Used by the criers, by
// people chatting, arguing and fighting with each other, and by anyone calling out to you.
'use strict';
(function () {
  function setup(game) {
    const st = document.createElement('style');
    st.textContent = `.speech-layer{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:3}
.speech{position:absolute;transform:translate(-50%,-100%);max-width:260px;background:#f4e8c8;color:#2a1d14;border:2px solid #2a1d14;box-shadow:2px 2px 0 rgba(20,12,8,.45);padding:3px 7px;font:14px/1.3 Georgia,serif;text-align:center;white-space:normal;transition:opacity .25s}
.speech:after{content:'';position:absolute;left:50%;bottom:-7px;margin-left:-4px;border:4px solid transparent;border-top:5px solid #2a1d14}
.speech.shout{background:#fff1c2;font-weight:bold}.speech.angry{background:#f2cdbd}.speech.far{opacity:.55}`;
    document.head.appendChild(st);
    const layer = document.createElement('div'); layer.className = 'speech-layer'; layer.style.display = 'none'; // words aren't shown over people's heads: they talk, and you hear it in what they tell you
    const host = game.canvas.parentElement || document.body; if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; host.appendChild(layer);
    const live = new Map();
    const EAR = 230;
    // where a speaker is in the view right now (null if not here)
    const posOf = (w) => {
      if (!w) return null;
      if (w.agent && w.id != null) { if (game.scene) return game.scene.personPos(w); return w.agent.hidden || w.agent.inside != null ? null : [w.agent.x, w.agent.y]; }
      return w.x != null ? [w.x, w.y] : null;
    };
    const inEarshot = (w, r = EAR) => { const p = posOf(w); return !!p && Math.hypot(p[0] - game.player.x, p[1] - game.player.y) <= r; };
    function say(who, text, secs = 3.5, kind = '', range = EAR) {
      if (!who || !text) return false;
      const key = who.id != null ? 'p' + who.id : who;
      let b = live.get(key);
      if (!b) { b = { el: document.createElement('div') }; b.el.className = 'speech'; layer.appendChild(b.el); live.set(key, b); }
      secs = Math.max(secs, 2.2 + text.length * 0.055); // long enough to read
      b.who = who; b.until = game.t + secs; b.range = range; b.el.textContent = text; b.el.className = 'speech' + (kind ? ' ' + kind : '');
      if (who.agent) { who.agent.talking = Math.max(who.agent.talking || 0, secs); }
      return inEarshot(who, range);
    }
    game.hooks.drawTop.push((ctx, cam) => {
      const r = game.canvas.getBoundingClientRect(), hr = layer.getBoundingClientRect(), sc = r.width / game.canvas.width;
      for (const [k, b] of live) {
        const p = posOf(b.who);
        if (game.t > b.until || (b.who.alive === false)) { b.el.remove(); live.delete(k); continue; }
        const d = p ? Math.hypot(p[0] - game.player.x, p[1] - game.player.y) : 1e9;
        if (!p || d > b.range || O.panelOpen) { b.el.style.display = 'none'; continue; }
        b.el.style.display = '';
        b.el.classList.toggle('far', d > b.range * 0.75);
        b.el.style.left = (r.left - hr.left + (p[0] - cam.x) * sc) + 'px';
        b.el.style.top = (r.top - hr.top + (p[1] - 38 - cam.y) * sc) + 'px';
        b._x = p[0]; b._y = p[1] - 38; b._shown = true;
      }
      // two people talking close together: the later words sit above the earlier, never on top of them
      const shown = [...live.values()].filter((b) => b.el.style.display !== 'none').sort((a, c) => a.until - c.until);
      for (let i = 1; i < shown.length; i++) for (let j = 0; j < i; j++) {
        const A = shown[j].el.getBoundingClientRect(), B = shown[i].el.getBoundingClientRect();
        if (A.right > B.left && B.right > A.left && A.bottom > B.top && B.bottom > A.top) shown[i].el.style.top = (parseFloat(shown[i].el.style.top) - (B.bottom - A.top) - 4) + 'px';
      }
    });
    // leaving a building or a town clears what was being said there
    const clear = () => { for (const b of live.values()) b.el.remove(); live.clear(); };
    O.Speech = { say, clear, inEarshot, posOf, EAR };
  }
  O.SpeechSetup = { setup };
})();
