// How you look, as the person in front of you sees it: the weapon in your hand, mail or a padded jack,
// your clothes and any jewellery, mud and stink, a fresh cut or a black eye, a limp, the smell of ale, a
// hood and mask, the load in your arms. They react to it: wary of a drawn blade, cool to the filthy, kind
// to the hurt. What's in your satchel they can't see unless you show it.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, G = O.Data.GOODS;
    function looks() {
      const out = [], f = O.Forge && O.Forge.player, P = game.player;
      if (f && f.style && O.Creator && O.Creator.STYLES[f.style]) out.push(`dressed as a ${O.Creator.STYLES[f.style].label.toLowerCase().replace('gentleman', f.sex === 'f' ? 'gentlewoman' : 'gentleman')}`);
      if (PS.equipped && PS.equipped !== 'fists' && PS.items.includes(PS.equipped)) out.push(`with a ${G[PS.equipped]?.name.toLowerCase() || PS.equipped} in hand (drawn steel makes folk wary)`);
      const arm = ['mail', 'gambeson', 'helm'].filter((k) => PS.items.includes(k)); if (arm.length) out.push(`wearing ${arm.map((k) => G[k].name.toLowerCase()).join(' and ')}`);
      if ((PS.worn || []).length) out.push(`wearing ${PS.worn.map((k) => G[k]?.name.toLowerCase() || k).join(', ')}`);
      if (PS.disguise) out.push('hooded and masked, the face hidden');
      const g = PS.grime || 0; if (g > 0.7) out.push('filthy and smelling of it'); else if (g > 0.4) out.push('travel-stained and grubby');
      const fresh = (PS.wounds || []).filter((w) => O.SimRef.cur && O.SimRef.cur.day - (w.day || 0) <= 2 && (w.sev || 0) > 0.3);
      if (fresh.length) out.push(`with ${fresh.slice(0, 2).map((w) => `a fresh ${w.kind || 'cut'}${w.part ? ' on the ' + w.part : ''}`).join(' and ')}`);
      if (PS.hp < 35) out.push('battered and limping'); else if (PS.hp < 60) out.push('looking knocked about');
      if ((PS.tipsy || 0) >= 2) out.push('smelling of ale and swaying a little'); else if ((PS.tipsy || 0) >= 1) out.push('with ale on the breath');
      if (PS.carry && PS.carry.good) out.push(`carrying ${G[PS.carry.good]?.name.toLowerCase() || PS.carry.good} in their arms`);
      if (PS.hunger < 20) out.push('looking hungry, hollow-cheeked');
      if (P && P.guard) out.push('with their fists up');
      return out;
    }
    O.playerLooks = looks;
    (O.extraLines = O.extraLines || []).push(() => { const l = looks(); return l.length ? `How the player looks to you right now: ${l.join('; ')}. React to what you see, as you would.` : ''; });
  }
  O.LooksSetup = { setup };
})();
