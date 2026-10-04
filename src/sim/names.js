// Names. No two living people in Eldoria share a full name, and every new life draws a different
// people: the pools are wide (plain English and Norman given names, surnames from trades, places,
// nicknames and fathers' names), and a registry turns away any name already in use.
'use strict';
(function () {
  const M = ['Adam', 'Ailwin', 'Alan', 'Alard', 'Aldous', 'Alexander', 'Alfred', 'Alric', 'Ambrose', 'Anselm', 'Arnold', 'Aubrey', 'Baldwin', 'Barnabas', 'Bartholomew', 'Benedict', 'Bennet', 'Bernard', 'Bertram', 'Brian', 'Cecil', 'Clement', 'Colin', 'Conrad', 'Cuthbert', 'Daniel', 'David', 'Denis', 'Drogo', 'Durand', 'Eadric', 'Edgar', 'Edmund', 'Edric', 'Edward', 'Edwin', 'Elias', 'Emery', 'Ernald', 'Eustace', 'Everard', 'Faramond', 'Fulk', 'Gamel', 'Geoffrey', 'Gerard', 'Gervase', 'Gilbert', 'Giles', 'Godfrey', 'Godric', 'Godwin', 'Goscelin', 'Gregory', 'Guy', 'Hamon', 'Harold', 'Hamo', 'Henry', 'Herbert', 'Hereward', 'Hervey', 'Hob', 'Hubert', 'Hugh', 'Humphrey', 'Ingram', 'Ivo', 'Jack', 'James', 'Jocelin', 'John', 'Jordan', 'Josce', 'Kenelm', 'Lambert', 'Lawrence', 'Leofric', 'Leonard', 'Lucas', 'Mark', 'Martin', 'Matthew', 'Maurice', 'Michael', 'Miles', 'Nicholas', 'Nigel', 'Norman', 'Odo', 'Osbert', 'Osmund', 'Oswald', 'Paine', 'Paul', 'Percival', 'Peter', 'Philip', 'Piers', 'Rainald', 'Ralph', 'Randal', 'Raymond', 'Reginald', 'Reynold', 'Richard', 'Robert', 'Roger', 'Roland', 'Rolf', 'Saer', 'Samson', 'Serlo', 'Silvester', 'Simon', 'Stephen', 'Swein', 'Theobald', 'Thomas', 'Thurstan', 'Tobias', 'Turold', 'Umfrey', 'Urian', 'Vivian', 'Walter', 'Warin', 'Wat', 'Wido', 'William', 'Wimund', 'Wulfric', 'Wulfstan'];
  const F = ['Ada', 'Adela', 'Agatha', 'Agnes', 'Alda', 'Aldith', 'Alice', 'Alina', 'Alys', 'Amabel', 'Amice', 'Anabel', 'Annora', 'Ascelina', 'Aubrey', 'Avelina', 'Avice', 'Basilia', 'Beatrice', 'Bertha', 'Blanche', 'Cecily', 'Christina', 'Clarice', 'Constance', 'Dionisia', 'Douce', 'Edith', 'Ela', 'Eleanor', 'Ellen', 'Elena', 'Emeline', 'Emma', 'Ermengard', 'Estrild', 'Eva', 'Felicia', 'Florence', 'Galiena', 'Gillian', 'Godiva', 'Grecia', 'Gundred', 'Gunnora', 'Hawise', 'Helewise', 'Hilda', 'Idonea', 'Isabel', 'Isolda', 'Ivetta', 'Jacoba', 'Joan', 'Joanna', 'Juliana', 'Katherine', 'Laura', 'Leticia', 'Lettice', 'Lucy', 'Mabel', 'Madeline', 'Margaret', 'Margery', 'Marion', 'Mary', 'Matilda', 'Maud', 'Millicent', 'Muriel', 'Nesta', 'Nicola', 'Orabel', 'Parnel', 'Petronella', 'Philippa', 'Primrose', 'Richenda', 'Rohesia', 'Rose', 'Sabina', 'Sarah', 'Scholastica', 'Sibyl', 'Sybil', 'Susanna', 'Theophania', 'Tiffany', 'Ursula', 'Wymarc', 'Yvette'];
  const TRADE = ['Archer', 'Arrowsmith', 'Baker', 'Barber', 'Barker', 'Baxter', 'Bowyer', 'Brewer', 'Butcher', 'Carpenter', 'Carter', 'Chandler', 'Chapman', 'Collier', 'Cook', 'Cooper', 'Cutler', 'Draper', 'Dyer', 'Falconer', 'Farmer', 'Fisher', 'Fletcher', 'Forester', 'Fowler', 'Fuller', 'Gardner', 'Glover', 'Hayward', 'Hooper', 'Hunter', 'Joiner', 'Mason', 'Mercer', 'Miller', 'Mower', 'Packer', 'Page', 'Parker', 'Plowman', 'Potter', 'Reeve', 'Roper', 'Saddler', 'Salter', 'Sawyer', 'Shepherd', 'Skinner', 'Slater', 'Smith', 'Spicer', 'Spinner', 'Steward', 'Tanner', 'Taylor', 'Thatcher', 'Tiler', 'Turner', 'Tucker', 'Vintner', 'Wainwright', 'Walker', 'Ward', 'Weaver', 'Webb', 'Wheeler', 'Woodward', 'Wright'];
  const NICK = ['Armstrong', 'Black', 'Blunt', 'Brown', 'Bunce', 'Doolittle', 'Fairfax', 'Fox', 'Gay', 'Golightly', 'Goodfellow', 'Gray', 'Hardy', 'Hale', 'Kemp', 'Long', 'Merriman', 'Moody', 'Noble', 'Proud', 'Read', 'Russell', 'Sharp', 'Short', 'Small', 'Sparrow', 'Speed', 'Strong', 'Swift', 'Truelove', 'Wise', 'White', 'Young', 'Lightfoot', 'Peacock', 'Crane', 'Drake', 'Hawk', 'Wolf', 'Bull', 'Lamb', 'Finch', 'Wren'];
  const ROOT = ['Ash', 'Brad', 'Brook', 'Black', 'Bram', 'Bur', 'Cal', 'Crom', 'Dun', 'East', 'Elm', 'Fair', 'Fern', 'Gold', 'Green', 'Har', 'Hart', 'Hazel', 'High', 'Hol', 'Kings', 'Lang', 'Lin', 'Mar', 'Mil', 'Mor', 'North', 'Oak', 'Pen', 'Red', 'Rush', 'Sal', 'Sand', 'Shep', 'Stan', 'Stock', 'Stone', 'Thorn', 'Wake', 'Wal', 'West', 'Whit', 'Wick', 'Wil', 'Win', 'Wood'];
  const SUF = ['by', 'combe', 'cott', 'dale', 'den', 'field', 'ford', 'ham', 'hurst', 'ley', 'more', 'ridge', 'shaw', 'stead', 'thorpe', 'ton', 'well', 'wick', 'worth', 'bury'];
  const SUR = [...TRADE, ...NICK, ...ROOT.flatMap((r) => SUF.map((s) => r + s)), ...M.slice(0, 60).map((n) => n + 'son'), ...M.slice(0, 30).map((n) => 'Fitz' + n.toLowerCase())];

  const used = new Set();
  // a name not already in use: keep the surname (it's the family's), change the given name if need be
  function claim(sex, first, sur, rng) {
    const pool = sex === 'f' ? F : M;
    let f = first || rng.pick(pool), tries = 0;
    while (used.has(f + ' ' + sur) && tries++ < 60) f = rng.pick(pool);
    if (used.has(f + ' ' + sur)) { const by = [' the Younger', ' the Elder', ' of the Hill', ' of the Brook', ' Junior']; for (const b of by) if (!used.has(f + ' ' + sur + b)) { sur = sur + b; break; } }
    used.add(f + ' ' + sur);
    return [f, sur];
  }
  function release(first, sur) { used.delete(first + ' ' + sur); }
  // a family name nobody in the realm has yet, if one can be found
  const usedSur = new Set();
  function surname(rng) { for (let i = 0; i < 40; i++) { const s = rng.pick(SUR); if (!usedSur.has(s)) { usedSur.add(s); return s; } } return rng.pick(SUR); }

  // each new life draws its own people
  function lifeSeed() {
    let s = null; try { s = localStorage.getItem('outlaw.lifeSeed'); } catch (e) { /* storage blocked */ }
    if (!s) { s = String((Math.random() * 1e9) | 0); try { localStorage.setItem('outlaw.lifeSeed', s); } catch (e) { /* storage blocked */ } }
    return +s;
  }
  function newLife() { try { localStorage.removeItem('outlaw.lifeSeed'); } catch (e) { /* storage blocked */ } }

  O.Names = { M, F, SUR, claim, release, surname, used, lifeSeed, newLife };
  if (O.Data) { O.Data.NAMES.m = M; O.Data.NAMES.f = F; O.Data.NAMES.sur = SUR; }
})();
