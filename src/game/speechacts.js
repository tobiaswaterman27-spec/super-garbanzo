// Said, not clicked. Everything the talk card used to offer as a button is done by saying it, in any
// words: ask for work, a room, a haircut or to see the wares; confess, pay the tithe, give alms; hand
// over a letter or a gift; ask to join the gang or for the night's work; threaten with your blade. If
// the person you're talking to is someone who could do it, it happens; otherwise the talk goes on as
// talk. (Without free speech the old buttons come back.)
'use strict';
(function () {
  const SAY = [
    ['hair', /\b(hair ?cut|cut my hair|trim my|shave|beard|my hair)\b/i],
    ['confess', /\b(confess|confession|i have sinned|shrive)\b/i],
    ['tithe', /\btithe\b/i],
    ['alms', /\b(alms|for the poor)\b/i],
    ['treat', /\b(treat|heal|see to|patch me up|look at) (me|my)|\bi('?m| am) (sick|ill|hurt|wounded|injured|poorly)|\bmy (wound|cut|burn|leg|arm) (hurts|is)/i],
    ['tailor', /\b(new clothes|make me (a|some) (clothes|tunic|dress|cloak)|measure me)\b/i],
    ['lessons', /\b(lessons?|teach me (to read|my letters|letters)|learn (to read|my letters))\b/i],
    ['room', /\b((a |your )?(room|bed) for the night|rent a (room|bed)|somewhere to sleep|need a bed)\b/i],
    ['wares', /\b(your wares|show me what|what (do you|have you got to) sell|what'?s for sale|what have you got)\b/i],
    ['horses', /\b(horses? for sale|buy a horse|sell me a horse)\b/i],
    ['letter', /\b(a letter for you|i have a letter|this letter is for you|here'?s (a|your) letter)\b/i],
    ['gift', /\b(a (little )?gift|a present|i('?ve)? (brought|got) you (something|this)|this is for you)\b/i],
    ['notice', /\b(hand in my notice|i give (my )?notice|i('?m| am) (quitting|leaving your service)|i quit)\b/i],
    ['raise', /\b(a raise|more pay|pay me more|better wage|raise my wage)\b/i],
    ['whohires', /\b(who('?s| is) (hiring|taking on)|anyone (hiring|taking on)|where (can|could) i (find )?work)\b/i],
    ['askjob', /\b(any (work|job)s?( going| for me)?|need (a hand|hands|help)|take me on|hire me|work for you|looking for (work|a job))\b/i],
    ['askwork', /\b(any (work|job)s?( going| for me)?|take me on|hire me|looking for (work|a job))\b/i],
    ['dayhand', /\b(extra (pair of )?hands|a day'?s work|work today)\b/i],
    ['otherjob', /\b(other work|another (job|post)|different (job|work))\b/i],
    ['hiredwork', /\b(hired work|odd jobs?)\b/i],
    ['bounties', /\bbount(y|ies)\b/i],
    ['court', /\b(serve at court|work at (the )?(court|castle)|a post at court)\b/i],
    ['vouch', /\bvouch for me\b/i],
    ['shilling', /\b(king'?s (coin|shilling)|enlist|join the (army|host))\b/i],
    ['fence', /\b(stolen|no questions asked|fence (some|these|my)|hot goods)\b/i],
    ['gfence', /\b(what i lifted|the take|hand over (the|what))\b/i],
    ['gwho', /\b(outside the law|anyone crooked|who'?s crooked|where (are|is) the (gang|thieves))\b/i],
    ['gjoin', /\b(join (you|your|the) (gang|lot|crew)|run with you|want in|be one of you)\b/i],
    ['gtask', /\b(any (work|job) for me|what'?s the job|give me a job)\b/i],
    ['gmanage', /\b(night'?s work|the job tonight)\b/i],
    ['grank', /\b(where do i stand|my (rank|standing))\b/i],
    ['grecruit', /\bput in a word\b/i],
    ['recruit', /\b(sound (you|them) out|would you join)\b/i],
    ['plot', /\b(a rising|rise up|overthrow)\b/i],
    ['rebel', /\bjoin the (rebellion|rebels|rising)\b/i],
    ['postern', /\b(open (a|the) (gate|postern)|the postern)\b/i],
    ['blackmail', /\b(letter of yours|i know (your|what you)|unless you pay)\b/i],
    ['rob', /\b(your money or|hand over your (purse|money)|this is a robbery|give me your (purse|money|coin))\b/i],
  ];
  function setup(game) {
    const npcUI = O.npcUI; if (!npcUI || !O.AIChat) return;
    const free = () => !!(O.AI && O.AI.ready);
    const keys = new Set(SAY.map(([k]) => k));
    const _btn = npcUI.extraButtons;
    const offered = (q) => (_btn ? _btn(q) : []);
    // the buttons go when you can say it yourself
    npcUI.extraButtons = (q) => { const out = offered(q); return free() ? out.filter(([k]) => !keys.has(k)) : out; };
    const _say = O.AIChat.say;
    O.AIChat.say = function (q, text, render, opt) {
      if (q && typeof text === 'string' && !(opt && opt.gift) && free()) {
        const can = new Set(offered(q).map(([k]) => k));
        const hit = SAY.find(([k, re]) => can.has(k) && re.test(text));
        if (hit) {
          (q._conv = q._conv || []).push({ who: 'p', t: text });
          const res = npcUI.onExtra(q, hit[0], (line, b) => { if (line) { q._conv.push({ who: 'q', t: line }); render(line, b); } });
          void res; return Promise.resolve();
        }
      }
      return _say.apply(this, arguments);
    };
    O.SpeechActs = { SAY };
  }
  O.SpeechActsSetup = { setup };
})();
