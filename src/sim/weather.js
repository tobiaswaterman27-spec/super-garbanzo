// Weather and seasons. Weather is a Markov chain stepped every game hour, biased by season.
// It feeds the simulation (people shelter, work slows, roads get muddy, storms damage roofs) and
// the renderer (rain, puddles, cloud shadows, fog, snow cover, lightning).
'use strict';
(function () {
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const SEASON_DAYS = 14;
  // transition weights per season: from any state toward these
  const BIAS = {
    spring: { clear: 4, cloudy: 4, rain: 3, heavy: 1, storm: 0.4, fog: 1.5, snow: 0, heat: 0, hail: 0.3 },
    summer: { clear: 7, cloudy: 3, rain: 1.5, heavy: 0.6, storm: 0.7, fog: 0.4, snow: 0, heat: 2, hail: 0.25 },
    autumn: { clear: 3, cloudy: 5, rain: 4, heavy: 1.5, storm: 0.8, fog: 2.5, snow: 0.2, heat: 0, hail: 0.35 },
    winter: { clear: 3, cloudy: 5, rain: 1, heavy: 0.3, storm: 0.3, fog: 2, snow: 4, heat: 0, hail: 0.2 },
  };
  // each kind comes light, moderate or hard
  const LABELS = {
    clear: ['Clear', 'Clear', 'Clear'], cloudy: ['A few clouds', 'Overcast', 'Dark skies'], rain: ['Drizzle', 'Rain', 'Heavy rain'], heavy: ['Heavy rain', 'Heavy rain', 'Downpour'],
    storm: ['Thunder about', 'Thunderstorm', 'Violent storm'], fog: ['Mist', 'Fog', 'Thick fog'], snow: ['Light snow', 'Snow', 'Blizzard'], heat: ['Warm', 'Hot', 'Heatwave'], hail: ['Sleet and hail', 'Hail', 'Hailstorm'],
  };

  class Weather {
    constructor(sim) {
      this.sim = sim; this.kind = 'clear'; this.next = 'clear'; this.blend = 1; this.wet = 0; this.snowCover = 0; this.wind = 0.3;
      this.lastHour = -1; this.flash = 0; this.rng = O.RNG(9091);
      this.forced = null; this.level = 1;
    }
    get season() { return SEASONS[Math.floor((this.sim.day - 1) / SEASON_DAYS + 1) % 4]; } // day 1 = summer
    get dayOfSeason() { return ((this.sim.day - 1) % SEASON_DAYS) + 1; }
    get raining() { return this.kind === 'rain' || this.kind === 'heavy' || this.kind === 'storm' || this.kind === 'hail'; }
    get severe() { return this.kind === 'heavy' || this.kind === 'storm' || this.kind === 'hail' && this.level >= 2 || (this.kind === 'snow' && (this.snowCover > 0.5 || this.level === 3)); }
    get label() { return (LABELS[this.kind] || LABELS.clear)[O.clamp(this.level - 1, 0, 2)]; }
    intensity() { const base = { clear: 0, cloudy: 0, rain: 0.45, heavy: 0.85, storm: 0.9, fog: 0, snow: 0.5, heat: 0, hail: 0.7 }[this.kind] || 0; return Math.min(1, base * (0.65 + this.level * 0.25)); }

    hourly() {
      const r = this.rng, season = this.season;
      if (this.forced) { this.kind = this.forced; }
      else if (r.chance(0.22)) {
        const w = Object.entries(BIAS[season]).map(([k, v]) => [k, v * (k === this.kind ? 3 : 1)]);
        const nk = r.weighted(w);
        if (nk !== this.kind || r.chance(0.3)) this.level = nk === 'heavy' ? 3 : r.weighted([[1, 4], [2, 4], [3, nk === 'storm' || nk === 'snow' && season === 'winter' ? 2.5 : 1.2]]);
        if (nk === 'hail' && nk !== this.kind) this.sim.log(this.level >= 3 ? 'Hailstones the size of peas are hammering down.' : 'A shower of hail rattles on the roofs.', 'weather');
        if (nk === 'snow' && this.level === 3 && nk !== this.kind) this.sim.log('A blizzard is blowing in.', 'weather');
        if (nk !== this.kind) { this.kind = nk; if (nk === 'storm') this.sim.log(`A storm rolls in over ${this.sim.world.name}.`, 'weather'); if (nk === 'snow' && this.snowCover < 0.1) this.sim.log('The first snow is falling.', 'weather'); }
      }
      this.wind = this.kind === 'storm' ? 0.8 + this.level * 0.07 : this.kind === 'heavy' ? 0.7 : this.kind === 'snow' && this.level === 3 ? 1 : this.kind === 'hail' ? 0.4 + this.level * 0.15 : 0.2 + r.next() * 0.15 + (this.kind === 'cloudy' ? this.level * 0.08 : 0);
      // storms damage roofs: buildings lose condition; the damage becomes repair work
      if (this.kind === 'storm' && r.chance(0.35)) {
        const b = r.pick(this.sim.world.buildings.filter((x) => !x.site));
        b.condition = Math.max(0.15, b.condition - r.float(0.08, 0.2));
        b.needsRepair = true; b.dirty = true;
        this.sim.log(`The storm tore at the roof of ${b.type === 'house' ? 'a house on ' + (b.bottom > 35 ? 'Mill Lane' : "the King's Road") : b.name}.`, 'weather');
      }
    }
    tick(dtm) {
      const h = Math.floor(this.sim.minute / 60);
      if (h !== this.lastHour) { this.lastHour = h; this.hourly(); }
      const rainK = this.intensity();
      if (this.raining) this.wet = Math.min(1, this.wet + 0.004 * dtm * rainK);
      else this.wet = Math.max(0, this.wet - 0.0012 * dtm * (this.kind === 'heat' ? 3 : this.kind === 'clear' ? 1.5 : 0.6));
      if (this.kind === 'snow') this.snowCover = Math.min(1, this.snowCover + 0.0012 * dtm * this.level);
      else if (this.season !== 'winter' || this.kind === 'rain' || this.kind === 'heat') this.snowCover = Math.max(0, this.snowCover - 0.0015 * dtm * (this.season === 'winter' ? 0.3 : 2));
      if (this.kind === 'hail') this.hailCover = Math.min(0.5, (this.hailCover || 0) + 0.004 * dtm * this.level); else this.hailCover = Math.max(0, (this.hailCover || 0) - 0.003 * dtm);
    }
  }

  O.Weather = Weather; O.SEASONS = SEASONS; O.SEASON_DAYS = SEASON_DAYS;
})();
