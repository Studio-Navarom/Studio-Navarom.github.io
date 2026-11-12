"use strict";
// Persistent nations, local grids, shared science and the common historical calendar.
const Evolution = (() => {
  const B = Biosphere, W = B.W, H = B.H, SIZE = W * H, clamp = B.clampValue;
  const PROFILES = {
    temperate: { name: "Mírnomilní", climate: "mírné podnebí", hint: "Vlhká souš a mírná teplota. Led ani hluboká voda nejsou průchozí.", offset: 0, color: "#78e5cf" },
    cold: { name: "Chladnomilní", climate: "chladné podnebí", hint: "Prospívají na chladné souši i pevném ledě. Při zakládání osad dávají přednost vhodné souši. Ohrožuje je přehřívání a tání ledu pod osadou.", offset: -0.34, color: "#a8dcff" },
    warm: { name: "Teplomilní", climate: "horké podnebí", hint: "Prospívají v horku a suchu bez zavlažování. Další horko jim nevadí; potřebují potravu ze suchomilného ekosystému. Mráz, deště a zaplavení je ohrožují.", offset: 0.28, color: "#ffbc82" }
  };
  const TECH = {
    agriculture: { name: "Zemědělství", work: 24, vb: 4, energy: 8, supplies: 6, requires: [], note: "Fungující pole mají o 15 % vyšší výnos, pokud to dovolí místní podmínky." },
    power: { name: "Rozvoj energetiky", work: 28, vb: 6, energy: 10, supplies: 8, requires: [], note: "Fungující větrné a vodní zdroje mají o 10 % vyšší výkon." },
    military: { name: "Vojenství", work: 28, vb: 6, energy: 10, supplies: 8, requires: [], note: "Místní obránci spotřebují o 20 % méně jídla." },
    navigation: { name: "Vesmírný program", work: 24, vb: 4, energy: 8, supplies: 6, requires: [], note: "Plánování letů a automatické zásobovací linky. Předchází Kosmické technice." },
    space: { name: "Kosmická technika", work: 36, vb: 8, energy: 14, supplies: 10, requires: ["navigation"], note: "Odemkne stavbu kosmodromu a vysílání průzkumných sond." },
    robotics: { name: "Robotika", work: 28, vb: 6, energy: 12, supplies: 10, requires: ["space"], note: "Robotická příprava, jaderná energetika a o 20 % nižší odběr nově zadaných akcí Věda." },
    climate: { name: "Regulace klimatu", work: 42, vb: 10, energy: 18, supplies: 12, requires: ["space", "robotics"], note: "Teraformery: ohřát, ochladit, vysušit a zvlhčit; vodní turbíny." },
    colonization: { name: "Kolonizace", work: 54, vb: 12, energy: 20, supplies: 15, requires: ["space"], note: "Odemkne kolonizační lodě. Před startem potřebuješ vzorek z cílového světa." }
  };
  for (const [key, value] of Object.entries(TECH)) B.RESEARCH[key] = value;
  for (let i = B.REALMS.length; i < 64; i++) B.REALMS.push({ name: "Národ " + i, color: ["#bda5ed", "#edbd76", "#77c8e5", "#df95b5", "#a5d586"][i % 5] });
  const SCIENCE_UPKEEP_PER_ORDER = 0.15; // E/s permanently per completed assignment producing 3 VB.
  const PORT_DRAW = 0.8, PORT_SUPPLIES = 0.035, PORT_GRACE = 12;
  const MINE_OUTPUT = 0.55, MINE_FOOD = 0.15, WINTER_STOCK_TARGET = 24;
  const GRID_FIELDS = ["reserve", "output", "demand", "strain", "age", "work", "deficient", "programDraw", "stationDraw", "scienceDraw", "scienceDemand", "scienceBaseLoad", "stationGenerator", "fuelUse", "nextBuild", "pollution", "linked"];
  const bound = new WeakMap();
  const contexts = new WeakMap();
  const point = B.position;
  const tile = p => ((Math.floor(p.x) % W + W) % W) + clamp(Math.floor(p.y), 0, H - 1) * W;
  const distance = (a, b) => Math.hypot(Math.min(Math.abs(a.x - b.x), W - Math.abs(a.x - b.x)), a.y - b.y);
  const profile = value => PROFILES[value] ?? PROFILES.temperate;
  const climateTarget = value => value === "cold" ? 0.055 : 0.47 + profile(value).offset;
  const nativeProfile = s => PROFILES[s.bioProfile] ? s.bioProfile : "temperate";
  const lifeTemperature = (s, i) => temperature(s, i, nativeProfile(s));
  const actorProfile = (s, actor) => {
    const value = typeof actor === "string" ? actor : actor?.profile ?? s.towns[s.plotTown[typeof actor === "number" ? actor : actor?.home] - 1]?.profile;
    return PROFILES[value] ? value : nativeProfile(s);
  };
  // Compatibility index used by older activity checks; physical temperature is never changed here.
  const climateIndex = (raw, type) => type === "cold" ? 0.47 + Math.max(0, raw - B.FREEZE_AT) * 2
    : type === "warm" ? 0.47 - Math.max(0, 0.42 - raw) * 1.6 : raw;
  const temperature = (s, i, actor) => climateIndex(s.temperature[i], actorProfile(s, actor));
  const comfort = (s, i, actor, raw = s.temperature[i]) => {
    const temp = climateIndex(raw, actorProfile(s, actor));
    return clamp((temp - 0.12) / 0.20, 0, 1) * clamp((1.01 - temp) / 0.20, 0, 1);
  };
  // Physical oceans stay oceans. Only cold-adapted actors can use their frozen surface.
  const stableIce = (s, i) => s.ice[i] >= 0.65 && s.water[i] <= s.ice[i] * 0.35 + 0.03;
  const frozenGround = (s, i) => s.ice[i] > 0.16 && (stableIce(s, i) || s.height[i] >= 0.45 && s.water[i] < 0.27);
  const footing = (s, i, actor) => {
    if (!Number.isInteger(i) || i < 0 || i >= SIZE) return false;
    if (actorProfile(s, actor) === "cold") return (!s.ocean[i] || s.height[i] >= 0.45) && s.water[i] < 0.27 || stableIce(s, i);
    return !s.ocean[i] && s.water[i] < 0.27 && s.ice[i] < 0.24;
  };
  const ground = (s, i, actor) => footing(s, i, actor) && s.fire[i] < 0.09 && s.lava[i] < 0.07;
  const floodDepth = (s, i, actor) => actorProfile(s, actor) === "cold" && frozenGround(s, i) ? 0 : s.water[i];
  const iceFailure = (s, i, actor) => actorProfile(s, actor) === "cold" && s.height[i] < 0.45 && Boolean(s.ocean[i]) && !stableIce(s, i);
  const moisture = (s, i, actor) => actorProfile(s, actor) === "cold" ? Math.max(s.wet[i], Math.min(0.65, s.ice[i] * 0.5)) : s.wet[i];
  const wetTolerance = (s, i, actor) => actorProfile(s, actor) === "warm" ? 1 - clamp((Math.max(s.wet[i], s.rain[i] * 4) - 0.62) / 0.38, 0, 1) * 0.55 : 1;
  const waterNeed = (s, actor) => actorProfile(s, actor) === "warm" ? 0 : 0.21;
  const forage = (s, i, actor) => B.contaminated(s, i) ? 0 : clamp((s.plants[i] * (actorProfile(s, actor) === "warm" ? 2.4 : 0.9) + (actorProfile(s, actor) === "warm" ? 0 : moisture(s, i, actor) * 0.3)
    + (actorProfile(s, actor) === "cold" && frozenGround(s, i) ? Math.min(0.45, s.ice[i] * 0.35) * (s.microbes?.[i] ?? 0) * 0.8 : 0)) * wetTolerance(s, i, actor), 0, 1.3);
  function harvest(s, c, farming = false) {
    const farms = s.plots.filter(i => s.plotTown[i] === c.town + 1 && s.urban[i] === 2
      && (B.contaminated(s, i) || s.damage[i] < 0.62 && ground(s, i, c)));
    const crops = Math.max(forage(s, c.home, c), farms.length ? farms.reduce((sum, i) => sum + forage(s, i, c), 0) / farms.length * 0.95 * (farming ? 1.15 : 1) : 0);
    const fish = typeof FaunaEvolution !== "undefined" && !B.contaminated(s, c.home) ? FaunaEvolution.fishing(s, c.home) : 0;
    return Math.min(1.3, crops + fish);
  }
  function centerHazard(s, actor, i = actor.home) {
    if (B.contaminated(s, i)) return "Kontaminované centrum osady";
    if (s.lava[i] >= 0.07) return "Láva zasáhla centrum osady";
    if (s.fire[i] >= 0.09) return "Požár v centru osady";
    if (iceFailure(s, i, actor)) return "Taje nosný led pod osadou";
    if (floodDepth(s, i, actor) >= 0.27 || !footing(s, i, actor) && s.ocean[i]) return "Centrum osady je zaplavené";
    if (!footing(s, i, actor)) return "Centrum osady pokrývá led";
    return "";
  }
  function orderHazard(s, c, economic = false) {
    const hazard = centerHazard(s, c);
    if (hazard) return hazard;
    const t = temperature(s, c.home, c);
    if (economic ? comfort(s, c.home, c) < 0.08 : t < 0.18 || t > 0.91)
      return t < 0.5 ? "Příliš nízká teplota pro tento pokyn" : "Příliš vysoká teplota pro tento pokyn";
    return "";
  }
  function environment(s, c) {
    const i = c.home, type = actorProfile(s, c), temp = s.temperature[i];
    const hazard = centerHazard(s, c);
    let reason = "";
    if (s.lava[i] >= 0.07) reason = "Osídlení zasáhla láva";
    else if (s.fire[i] >= 0.09) reason = "Osídlení ohrožuje požár";
    else if (iceFailure(s, i, c)) reason = "Taje jejich led";
    else if (floodDepth(s, i, c) > (type === "warm" ? 0.20 : 0.35)) reason = "Půda je zaplavená";
    else if (hazard) reason = hazard;
    else if (type === "cold" && comfort(s, i, c) < 0.4) reason = "Příliš teplé prostředí";
    else if (type === "warm" && (s.ice[i] >= 0.24 || comfort(s, i, c) < 0.4)) reason = "Půda je příliš studená";
    else if (type === "warm" && wetTolerance(s, i, c) < 0.75) reason = "Dlouhé deště a podmáčení";
    else if (type === "temperate" && comfort(s, i, c) < 0.4) reason = temp < 0.23 ? "Silný mráz" : "Přehřátá krajina";
    else if (type === "temperate" && moisture(s, i, c) < 0.12) reason = "Vyschlá půda";
    else if (Number.isFinite(c.food) && c.food < Math.max(1, (c.consumption ?? 0.65) * 8)) reason = "Dochází potrava";
    return { label: reason ? "Strádají" : "Prospívají", reason: reason || (type === "cold" ? "Vhodné chladné prostředí" : type === "warm" ? "Teplá suchá půda" : "Vhodné prostředí"), tone: reason ? "warn" : "good" };
  }
  const navigationCache = new WeakMap();
  function invalidateGround(s) { s.navigationRevision = (s.navigationRevision ?? 0) + 1; }
  function regions(s, actor) {
    const type = actorProfile(s, actor) === "cold" ? "cold" : "temperate", entries = navigationCache.get(s) ?? {};
    navigationCache.set(s, entries);
    const old = entries[type], revision = s.navigationRevision ?? 0;
    if (old && old.time === s.time && old.revision === revision && old.physical === s.regionRevision) return old.labels;
    const mask = new Uint8Array(SIZE), labels = new Uint16Array(SIZE), queue = new Uint16Array(SIZE);
    for (let i = 0; i < SIZE; i++) mask[i] = Number(ground(s, i, type));
    let region = 0;
    for (let i = 0; i < SIZE; i++) {
      if (!mask[i] || labels[i]) continue;
      labels[i] = ++region; queue[0] = i; let end = 1;
      for (let j = 0; j < end; j++) for (const list of s.neighbors) {
        const next = list[queue[j]];
        if (!mask[next] || labels[next]) continue;
        labels[next] = region; queue[end++] = next;
      }
    }
    entries[type] = { labels, time: s.time, revision, physical: s.regionRevision }; return labels;
  }
  const sameRegion = (s, a, b, actor = a) => { const map = regions(s, actor); return Boolean(map[a] && map[a] === map[b]); };
  // Political identity and residents' physiology are independent.
  function uniqueColor(state, id, preferred) {
    const used = new Set(Object.values(state.nations).filter(n => n.id !== id).map(n => n.color?.toLowerCase()));
    if (/^#[0-9a-f]{6}$/i.test(preferred ?? '') && !used.has(preferred.toLowerCase())) return preferred;
    for (let attempt = 0; ; attempt++) {
      const h = ((id * 137.508 + attempt * 47.3) % 360) / 60, chroma = .52, m = .27;
      const x = chroma * (1 - Math.abs(h % 2 - 1));
      const rgb = h < 1 ? [chroma,x,0] : h < 2 ? [x,chroma,0] : h < 3 ? [0,chroma,x] : h < 4 ? [0,x,chroma] : h < 5 ? [x,0,chroma] : [chroma,0,x];
      const color = '#' + rgb.map(v => Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');
      if (!used.has(color)) return color;
    }
  }
  function nationLabel(state, id) {
    const nation = state.nations?.[id]; if (!nation) return 'Civilizace ' + id;
    const key = name => String(name).normalize('NFKC').trim().toLocaleLowerCase('cs-CZ');
    const namesakes = Object.values(state.nations).filter(n => key(n.name) === key(nation.name));
    if (namesakes.length < 2) return nation.name;
    const home = state.worlds.find(w => w.id === nation.homeWorld)?.name ?? nation.homeWorldName ?? ('svět ' + nation.homeWorld);
    return nation.name + ' · původ ' + home + (namesakes.some(n => n.id !== id && n.homeWorld === nation.homeWorld) ? ' · národ ' + id : '');
  }
  function nationClimate(state, id) {
    const types = new Set(state.worlds.flatMap(w => (w.biosphere?.communities ?? []).filter(c => c.active && c.civilization === id).map(c => actorProfile(w.biosphere,c))));
    return types.size > 1 ? 'smíšené podnební nároky' : profile([...types][0] ?? state.nations?.[id]?.profile).climate;
  }
  function init(state) {
    state.climateVersion = state.climateVersion === 2 ? 2 : 1;
    state.nations ??= {}; state.knowledgePools ??= {}; state.spacePrograms ??= {};
    if (state.identityVersion !== 1) {
      // Keep the patron's existing colour; resolve other collisions once on import.
      const nations = Object.values(state.nations).sort((a,b) => Number(b.id === state.patron?.id) - Number(a.id === state.patron?.id) || a.id-b.id), used = new Set();
      for (const nation of nations) {
        nation.homeWorldName ??= state.worlds.find(w => w.id === nation.homeWorld)?.name;
        if (used.has(nation.color?.toLowerCase())) nation.color = uniqueColor(state,nation.id);
        used.add(nation.color?.toLowerCase());
      }
      state.identityVersion = 1;
    }
    state.nextCivilizationId = Math.max(1, state.nextCivilizationId ?? 1, ...Object.keys(state.nations).map(id => Number(id) + 1));
    state.worldOptions ??= { evolution: "natural", profile: "temperate", age: "young" };
    state.guideProfile = PROFILES[state.guideProfile] ? state.guideProfile : "temperate";
    state.tutorial ??= { hidden: false, completed: {} }; state.tutorial.completed ??= {};
  }
  function science(state, id, prepared = false) {
    if (!prepared) init(state); const pool = state.knowledgePools["civil:" + id] ??= { faith: 0 };
    pool.science ??= { active: null, progress: {}, funded: {} }; pool.science.progress ??= {}; pool.science.funded ??= {};
    pool.points = Number.isFinite(pool.points) ? Math.max(0, pool.points) : 0;
    pool.discoveries ??= {}; pool.climateKnown ??= {};
    for (const key of Object.keys(TECH)) pool.science.progress[key] ??= 0;
    return pool;
  }
  function identity(state, world, c, town, prepared = false) {
    if (!prepared) init(state); const s = world.biosphere; s.realmCivilizations ??= {};
    let id = c.civilization || town.civilization || s.realmCivilizations[c.realm];
    if (!id) id = state.nextCivilizationId++;
    state.nextCivilizationId = Math.max(state.nextCivilizationId, id + 1);
    const old = state.knowledgePools["realm:" + world.id + ":" + c.realm];
    if (old && !state.knowledgePools["civil:" + id]) state.knowledgePools["civil:" + id] = structuredClone(old);
    const nation = state.nations[id] ??= { id, name: state.patron?.id === id ? state.patron.name : (s.nativeFoundersVersion >= 3 ? s.tribes.find(t => t.realm === c.realm)?.name : null) ?? B.REALMS[c.realm].name,
      nature: c.nature, profile: PROFILES[c.profile] ? c.profile : PROFILES[town.profile] ? town.profile : nativeProfile(s), color: uniqueColor(state,id,B.REALMS[c.realm].color),
      homeWorld: world.id, homeWorldName: world.name, founded: state.time, started: state.time, nextAI: state.time + 8 };
    c.civilization = town.civilization = id;
    c.profile = town.profile = PROFILES[c.profile] ? c.profile : PROFILES[town.profile] ? town.profile : nation.profile;
    town.civilizationColor = nation.color;
    s.realmCivilizations[c.realm] ??= id;
    const pool = science(state, id, true); pool.name = nation.name;
    return nation;
  }
  function current(state, world) {
    const s = world.biosphere, ids = [...new Set((s.communities ?? []).filter(c => c.active).map(c => c.civilization).filter(Boolean))];
    for (const base of s.robotBases ?? []) if (!ids.includes(base.civilization)) ids.push(base.civilization);
    return ids.includes(state.patron?.id) ? state.patron.id : ids[0] ?? 0;
  }
  function emptyGrid(reserve = 0, supplies = 0) {
    return { reserve, supplies, output: 0, demand: 0, strain: 0, age: 0, work: 0, deficient: 0,
      programDraw: 0, stationDraw: 0, scienceDraw: 0, scienceDemand: 0, scienceBaseLoad: 0, stationGenerator: 0, fuelUse: 0, nextBuild: 0, pollution: 0, linked: false,
      supplyRate: 0, program: { funded: false, active: false }, nextBasicBuild: 0 };
  }
  function economies(state, world) {
    if (!world?.biosphere) return null;
    contexts.set(world, state);
    init(state); const s = world.biosphere, power = s.power;
    s.robotBases ??= []; s.mines ??= []; power.grids ??= {};
    const ids = [...new Set((s.communities ?? []).filter(c => c.active && c.civilization).map(c => c.civilization))];
    for (const base of s.robotBases) if (!ids.includes(base.civilization)) ids.push(base.civilization);
    if (!power.economiesVersion && ids.length) {
      const total = (s.communities ?? []).filter(c => c.active).reduce((sum, c) => sum + c.people, 0);
      const reserve = Number.isFinite(power.reserve) ? power.reserve : 0, stock = Number.isFinite(world.supply) ? world.supply : 0;
      for (const id of ids) {
        const share = total ? (s.communities ?? []).filter(c => c.active && c.civilization === id).reduce((sum, c) => sum + c.people, 0) / total : 1 / ids.length;
        const g = power.grids[id] = emptyGrid(reserve * share, stock * share);
        for (const f of ["age", "work", "linked"]) g[f] = power[f] ?? g[f];
        const oldProgram = state.spacePrograms[world.id];
        if (oldProgram?.funded && state.patron?.id === id) g.program = { ...oldProgram };
        if (g.program.funded && g.work > 0) {
          const pool = science(state, id);
          for (const key of ["navigation", "space"]) { pool.science.progress[key] = TECH[key].work; pool.science.funded[key] = true; }
        }
      }
      power.economiesVersion = 1;
    }
    for (const id of ids) {
      const g = power.grids[id] ??= emptyGrid();
      // Old saves acquire a clean baseline; previously completed VB actions are not charged retroactively.
      if (!Number.isFinite(g.scienceBaseLoad) || g.scienceBaseLoad < 0) g.scienceBaseLoad = 0;
    }
    for (const plant of power.plants) {
      plant.civilization ??= s.towns[plant.town - 1]?.civilization ?? s.colonialCivilization ?? ids[0];
      plant.profile = s.towns[plant.town - 1]?.profile ?? plant.profile ?? state.nations[plant.civilization]?.profile ?? nativeProfile(s);
    }
    for (const station of s.stations) {
      station.civilization ??= s.towns[s.plotTown[station.tile] - 1]?.civilization ?? s.colonialCivilization ?? ids[0];
      station.profile = s.towns[s.plotTown[station.tile] - 1]?.profile ?? station.profile ?? state.nations[station.civilization]?.profile ?? nativeProfile(s);
    }
    if (ids.length && bound.get(world) !== power) {
      power.viewOwner = current(state, world);
      for (const key of GRID_FIELDS) Object.defineProperty(power, key, { enumerable: true, configurable: true,
        get() { return this.grids[this.viewOwner]?.[key] ?? (key === "linked" ? false : 0); },
        set(value) { if (this.grids[this.viewOwner]) this.grids[this.viewOwner][key] = value; } });
      for (const key of ["supply", "supplyRate"]) Object.defineProperty(world, key, { enumerable: true, configurable: true,
        get() { return this.biosphere.power.grids[this.biosphere.power.viewOwner]?.[key === "supply" ? "supplies" : "supplyRate"] ?? 0; },
        set(value) { const g = this.biosphere.power.grids[this.biosphere.power.viewOwner]; if (g) g[key === "supply" ? "supplies" : "supplyRate"] = value; } });
      bound.set(world, power);
    }
    return power.grids;
  }
  function grid(state, world, id = state.patron?.id) {
    return economies(state, world)?.[id] ?? null;
  }
  function focus(state, world, id = current(state, world)) {
    if (!world?.biosphere) return;
    economies(state, world); const s = world.biosphere;
    if (!s.power.grids[id]) return;
    s.power.viewOwner = id; s.power.controller = state.patron?.id ?? 0;
    const g = s.power.grids[id], pool = science(state, id);
    s.research = pool.science;
    s.researchPolicy = { faith: pool.faith, funded: pool.science.funded, spaceFunded: g.program.funded, spaceActive: g.program.active, civilization: id };
    state.spacePrograms[world.id] = g.program;
  }
  function withOwner(state, world, id, fn) {
    const previous = world.biosphere.power.viewOwner; focus(state, world, id);
    try { return fn(); } finally { focus(state, world, previous); }
  }
  function owns(state, world, id = state.patron?.id) {
    return Boolean(id && world?.biosphere && ((world.biosphere.communities ?? []).some(c => c.active && c.civilization === id)
      || (world.biosphere.robotBases ?? []).some(b => b.civilization === id)));
  }
  function pay(state, world, id, cost, reserve = 0) {
    const g = grid(state, world, id);
    if (!g || g.reserve + 1e-7 < (cost.energy ?? 0) + reserve || g.supplies + 1e-7 < (cost.supplies ?? 0)) return false;
    g.reserve -= cost.energy ?? 0; g.supplies -= cost.supplies ?? 0; return true;
  }
  function wallet(state, id = state.patron?.id) {
    let energy = 0, supplies = 0, output = 0, demand = 0, food = 0;
    for (const world of state.worlds) {
      if (!owns(state, world, id)) continue;
      const g = grid(state, world, id); energy += g.reserve; supplies += g.supplies; output += g.output; demand += g.demand;
      food += (world.biosphere.communities ?? []).filter(c => c.active && c.civilization === id).reduce((sum, c) => sum + c.food, 0);
    }
    return { energy, supplies, output, demand, food, points: id ? science(state, id).points : 0, faith: id ? science(state, id).faith : 0, knowledge: id ? Object.keys(science(state, id).discoveries).length : 0 };
  }
  // Imported technology is a floor, never a ceiling on the world's later development.
  function settlementEra(s, town) { return Math.max(s.era, town?.importedEra ?? 0); }
  function civEra(state, world, id) {
    const list = (world.biosphere.communities ?? []).filter(c => c.active && c.civilization === id);
    return list.length ? Math.max(...list.map(c => settlementEra(world.biosphere, world.biosphere.towns[c.town]))) : (world.biosphere.robotBases ?? []).some(b => b.civilization === id) ? 6 : 0;
  }
  // Recommended launch bands are distinct from the full biological tolerance.
  // Older universes retain their radial temperature law on import.
  function habitatZone(state, type = state.guideProfile) {
    if (state.climateVersion === 2) return type === 'warm' ? {inner:44,outer:190} : type === 'cold' ? {inner:290,outer:820} : {inner:190,outer:290};
    const base = state.zone, middle = (base.inner+base.outer)/2, gradient = .58/(base.outer-base.inner);
    return type === 'cold' ? {inner:middle+(.53-B.FREEZE_AT)/gradient,outer:820} : type === 'warm' ? {inner:44,outer:middle+(.53-.42)/gradient} : {...base};
  }
  function zone(state, type = state.guideProfile) {
    if (state.climateVersion === 2) return type === 'warm' ? {inner:60,outer:190} : type === 'cold' ? {inner:290,outer:390} : {inner:190,outer:290};
    const cold = habitatZone(state,'cold').inner;
    return type === 'warm' ? {inner:44,outer:state.zone.inner} : type === 'cold' ? {inner:cold,outer:Math.max(300,cold+80)} : {inner:state.zone.inner,outer:cold};
  }
  function starterShot(state) {
    if(state.climateVersion!==2) return {...Orbit.GUIDE};
    const radius={warm:120,cold:340,temperate:240}[state.worldOptions?.profile]??240;
    return {x:radius,y:0,vx:0,vy:-Math.sqrt(Orbit.MU/radius)};
  }
  function heatAt(state, radius) {
    if (state.climateVersion !== 2) return clamp(.53+((state.zone.inner+state.zone.outer)/2-radius)*.58/(state.zone.outer-state.zone.inner),-.62,1.5);
    const anchors = [[44,1.5],[60,1.5],[190,.82],[290,.09],[390,-.55],[820,-.62]];
    if (radius<=anchors[0][0]) return 1.5;
    for(let n=1;n<anchors.length;n++) if(radius<=anchors[n][0]) {
      const [a,ta]=anchors[n-1],[b,tb]=anchors[n];return ta+(tb-ta)*(radius-a)/(b-a);
    }
    return -.62;
  }
  function seasonalHeats(state, world) {
    const { peri, apo } = world.orbit;
    const near = Number.isFinite(peri) ? peri : Math.hypot(world.x, world.y);
    const far = Number.isFinite(apo) ? apo : Orbit.EXIT;
    return [near, (near + far) / 2, far].map(radius => heatAt(state, radius));
  }
  function cityDevelopment(world, civilization) {
    const s = world.biosphere;
    const cities = (s?.communities ?? []).filter(c=>c.active&&c.civilization===civilization).map(c=>{
      const town=s.towns[c.town], plots=s.plots.filter(i=>s.plotTown[i]===c.town+1&&s.urban[i]>=1&&s.urban[i]<=5&&s.damage[i]<.62);
      const homes=plots.filter(i=>s.urban[i]===3||s.urban[i]===4).length;
      const factory=town.factory>=0&&s.urban[town.factory]===5&&B.workingFactory(s,town);
      return {name:c.name||'Osada '+c.id,plots:plots.length,homes,factory,ready:B.townEra(s,town)>=6&&plots.length>=40&&homes>=12&&factory};
    });
    return cities.find(c=>c.ready) ?? cities.sort((a,b)=>b.plots-a.plots)[0] ?? {plots:0,homes:0,factory:false,ready:false};
  }
  function historicalTime(state) {
    if (!state.calendar) {
      const era = Math.max(0, ...state.worlds.map(p => p.biosphere?.era ?? 0));
      state.calendar = { months: state.time > 0 ? state.time * 240 : 0, era, segments: [{ time: 0, months: 0, rate: state.time > 0 ? 240 : 480000000 }] };
    }
    return state.calendar;
  }
  function advanceCalendar(state, dt, sharedEra) {
    const c = historicalTime(state);
    const era = Math.max(c.era, sharedEra ?? Math.max(0, ...state.worlds.map(p => p.biosphere?.era ?? 0)));
    const rates = [480000000, 300000000, 96000000, 24000000, 240, 12, 2];
    const rate = rates[era] ?? 2;
    if (c.segments.at(-1).rate !== rate) c.segments.push({ time: state.time - dt, months: c.months, rate });
    c.era = era; c.months += dt * rate;
  }
  function dateAt(state, time = state.time) {
    const c = historicalTime(state);
    let segment = c.segments[0];
    for (const s of c.segments) { if (s.time > time) break; segment = s; }
    const months = Math.max(0, state.galaxySeed !== undefined && time === state.time ? c.months
      : segment.months + (time - segment.time) * segment.rate);
    return { year: Math.floor(months / 12), month: Math.floor(months % 12) + 1, months };
  }
  function dateLabel(date) {
    return new Intl.NumberFormat("cs-CZ").format(date.year) + " · " + String(date.month).padStart(2, "0");
  }
  function duration(state, seconds) {
    const c = historicalTime(state), months = Math.max(0, seconds * c.segments.at(-1).rate);
    return months >= 12 ? new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 }).format(months / 12) + " let" : Math.max(1, Math.ceil(months)) + " měsíců";
  }
  function configureWorld(state, world, settings = state.worldOptions) {
    const s = world.biosphere; if (!s) return;
    const types = Object.keys(PROFILES);
    s.bioProfile = PROFILES[settings.profile] ? settings.profile : types[Math.floor(B.hash(world.id, s.seed, 311) * types.length)];
    s.evolutionMode = settings.evolution === "accelerated" ? "accelerated" : "natural";
    s.originTime = state.time; s.geologicalAge = settings.age === "old" ? 2500000000 : 0;
    const ages = { old: [3, 31], tribal: [4, 74], cities: [5, 134], modern: [6, 212] };
    if (ages[settings.age]) [s.era, s.progress] = ages[settings.age];
    world.nativeProfile = s.bioProfile;
    B.initializeClimate(s, heatAt(state, Math.hypot(world.x,world.y)));
  }
  function sciencePool(state, world, id = state.patron?.id) {
    return owns(state, world, id) ? { key: "civil:" + id, pool: science(state, id) } : null;
  }
  function knows(state, id, key) {
    const research = state.knowledgePools?.["civil:" + id]?.science;
    return Boolean(id && TECH[key] && research?.funded?.[key] && research.progress?.[key] >= TECH[key].work);
  }
  const scienceOrderDraw = (state, id) => knows(state, id, "robotics") ? 0.8 : 1;
  function researchBlock(state, world, key, id = state.patron?.id) {
    if (!TECH[key] || !owns(state, world, id)) return "Vyber vlastní obydlený svět.";
    const pool = science(state, id), spec = TECH[key];
    if (pool.faith < 10) return "Nejprve společná víra " + pool.faith + " / 10.";
    if (knows(state, id, key)) return "Technologie je dokončená pro celou civilizaci.";
    if (civEra(state, world, id) < 5) return "Výzkum potřebuje města.";
    const missing = spec.requires.filter(k => !knows(state, id, k));
    if (missing.length) return "Nejprve dokonči: " + missing.map(k => TECH[k].name).join(", ") + ".";
    if (!pool.science.funded[key]) {
      if (pool.points < spec.vb) return "Chybí " + Math.ceil(spec.vb - pool.points) + " VB. Zadej městu Vědu.";
      const g = grid(state, world, id);
      if (g.reserve < spec.energy + 20 || g.supplies < spec.supplies) return "Chybí místní cena zahájení nebo rezerva 20 E.";
    }
    return "";
  }
  function research(state, world, key, id = state.patron?.id, autonomous = false) {
    const pool = science(state, id);
    if (pool.science.active === key) { pool.science.active = null; if (!autonomous) pool.science.manualPause = true; return ""; }
    const issue = researchBlock(state, world, key, id); if (issue) return issue;
    const spec = TECH[key];
    if (!pool.science.funded[key]) {
      if (!pay(state, world, id, spec, 20)) return "Nedostatek místních zdrojů.";
      pool.points -= spec.vb; pool.science.funded[key] = true;
    }
    pool.science.active = key;
    pool.science.activeSource = autonomous ? "automatic" : "player";
    if (!autonomous) pool.science.manualPause = false;
    Orbit.event(state, state.nations[id].name + " zahajuje výzkum " + spec.name + ".", "good");
    refreshScience(state, id); return "";
  }
  function refreshScience(state, id) {
    for (const world of state.worlds) if (owns(state, world, id) && world.biosphere.power.viewOwner === id) focus(state, world, id);
  }
  function spaceBlock(state, world, id = state.patron?.id) {
    if (!owns(state, world, id)) return "Vyber vlastní svět.";
    if (!knows(state, id, "space")) return "Nejprve Vesmírný program a výzkum Kosmická technika.";
    if (civEra(state, world, id) < 6) return "Kosmodrom potřebuje moderní civilizaci.";
    const g = grid(state, world, id);
    if (g.work >= B.PROBE_WORK && g.program.funded) return "Kosmodrom je dokončený.";
    if (!g.program.funded && (g.reserve < 80 || g.supplies < 25)) return "Zahájení stojí 60 E + 25 M; zůstane 20 E.";
    return "";
  }
  function spaceProgram(state, world, id = state.patron?.id, autonomous = false) {
    const issue = spaceBlock(state, world, id); if (issue) return issue;
    const g = grid(state, world, id);
    if (!g.program.funded) { if (!pay(state, world, id, { energy: 60, supplies: 25 }, 20)) return "Nedostatek prostředků."; g.program.funded = true; }
    g.program.active = !g.program.active;
    if (!autonomous) g.program.manualPause = !g.program.active;
    refreshScience(state, id); return "";
  }
  function builtPort(state, world, id = state?.patron?.id) {
    const g = grid(state, world, id);
    return Boolean(g && owns(state, world, id) && science(state, id).faith >= 10 && knows(state, id, "space") && g.program.funded && g.work >= B.PROBE_WORK);
  }
  function spaceflight(state, world, id = state?.patron?.id) {
    return Boolean(builtPort(state, world, id) && grid(state, world, id).program.online !== false);
  }
  function portStatus(state, world, id = state?.patron?.id) {
    if (!world?.biosphere || !owns(state, world, id)) return "Bez vlastního kosmodromu";
    const g = grid(state, world, id);
    if (!builtPort(state, world, id)) return g.program.funded
      ? "Stavba kosmodromu · " + Math.floor(g.work / B.PROBE_WORK * 100) + " %" : "Bez kosmodromu";
    if (g.program.online === false) return "Kosmodrom mimo provoz · čeká na energii a materiál";
    return "Kosmodrom v provozu" + (g.supplyRate < 0 ? " · místní materiál ubývá" : "");
  }
  const CONSTRUCTION = { energy: "wind", mine: "mine" };
  const POWER_PROJECTS = {
    wind: { energy: 0, supplies: 18 },
    hydro: { energy: B.HYDRO_ENERGY, supplies: B.HYDRO_SUPPLY },
    nuclear: { energy: 50, supplies: 48 }
  };
  function actionCosts(state, world, c, action) {
    const city = civEra(state, world, c.civilization) >= 5;
    // Science is not paid twice: 12 M at assignment, then 1 E/s for up to 20 s of actual work.
    if (action === "science") return { food: 0, energy: 0, supplies: 12 };
    if (action === "mine") return { food: 0, energy: 8, supplies: 12 };
    // A mature city does not switch from food to E/M before the shared knowledge unlock (faith 10/10).
    if (action === "guard" && city && science(state, c.civilization).faith >= 10) return { food: 0, energy: 12, supplies: 14 };
    if (action === "gift" && city && science(state, c.civilization).faith >= 10) return { food: 0, energy: 5, supplies: 16 };
    return { food: Math.ceil((Patronage.ACTIONS[action]?.food ?? 0) * clamp(Math.sqrt(Math.max(1, c.people) / 4000), 0.7, 4)), energy: 0, supplies: 0 };
  }
  const priceLabel = cost => [cost.food && Math.ceil(cost.food) + " J", cost.energy && Math.ceil(cost.energy) + " E", cost.supplies && Math.ceil(cost.supplies) + " M"].filter(Boolean).join(" + ") || "Zdarma";
  function energyBlock(state, id) {
    const faith = science(state, id).faith;
    return faith < 10 ? "Energetika vyžaduje společnou víru 10/10. Teď máš " + faith + "/10." : "";
  }
  function energyPlan(state, world, c, g, era, budget, reserved) {
    const id = c.civilization, s = world.biosphere;
    const plants = s.power.plants.filter(p => p.civilization === id && s.damage[p.tile] < 0.78);
    const reserve = era >= 6 ? B.CITY_RESERVE : 8;
    const plan = (source, keep = 0) => {
      const cost = POWER_PROJECTS[source];
      if (budget.energy < cost.energy + keep || budget.supplies < cost.supplies) return null;
      const site = constructionSite(s, c, source, reserved);
      return site === undefined ? null : { cost: { food: 0, ...cost }, source, site, reserve: keep };
    };
    const hasNuclear = budget.nuclear || s.power.plants.some(p => p.civilization === id && p.kind === "nuclear")
      || s.communities.some(other => other.active && other.civilization === id && other.job?.source === "nuclear");
    if (!hasNuclear && plants.some(p => p.output > 0) && g.output - g.demand < 2 && era >= 6
      && knows(state, id, "robotics") && B.workingFactory(s, s.towns[c.town])) {
      const nuclear = plan("nuclear", reserve);
      if (nuclear) return nuclear;
    }
    const wind = plan("wind");
    const pending = s.communities.filter(other => other.active && other.job && other.job.phase !== "return"
      && (other.job.kind === "energy" || other.job.kind === "hydro")).length;
    const hydro = s.power.plants.length + pending + (reserved?.size ?? 0) < 24 && knows(state, id, "climate") ? plan("hydro", reserve) : null;
    if (hydro && (!wind || B.hydroPotential(s, hydro.site) > B.powerPotential(s, wind.site, "wind", 1))) return hydro;
    return wind;
  }
  function actionQuote(state, world, c, action, target, autonomous = false, budget, reserved) {
    const blocked = issue => ({ issue });
    if (!c?.active || !world?.biosphere || state.over) return blocked("Osada není dostupná.");
    if (!autonomous && c.civilization !== state.patron?.id) return blocked("Pokyn patří vlastní civilizaci.");
    if (action === "energy") {
      const locked = energyBlock(state, c.civilization);
      if (locked) return blocked(locked);
    }
    if (c.job) return blocked(jobProgress(world.biosphere, c).label + ". Nejprve musí skončit současný úkol.");
    const hazard = orderHazard(world.biosphere, c, true);
    const era = civEra(state, world, c.civilization), g = grid(state, world, c.civilization);
    if (action === "energy") {
      if (hazard) return blocked(hazard + ".");
      if (era < 5) return blocked("Tento pokyn se zpřístupní ve městech.");
      const available = budget ?? { energy: g?.reserve ?? 0, supplies: g?.supplies ?? 0 };
      const plan = g && energyPlan(state, world, c, g, era, available, reserved);
      if (!plan) return blocked(available.supplies < POWER_PROJECTS.wind.supplies
        ? "Chybí místní materiál nebo energie pro dostupný zdroj. Větrník stojí 18 M."
        : "V dosahu není vhodné místo pro dostupný zdroj energie.");
      return { issue: "", ...plan };
    }
    const cost = actionCosts(state, world, c, action);
    if (c.food < cost.food || !g || g.reserve < cost.energy || g.supplies < cost.supplies) return blocked((hazard ? hazard + ". " : "") + "Chybí místní prostředky: " + priceLabel({food:Math.max(0,cost.food-c.food),energy:Math.max(0,cost.energy-(g?.reserve??0)),supplies:Math.max(0,cost.supplies-(g?.supplies??0))}) + ". Celková cena " + priceLabel(cost) + ".");
    if (hazard) return blocked(hazard + ".");
    if ((action === "mine" || action === "science") && era < 5) return blocked("Tento pokyn se zpřístupní ve městech.");
    if (action === "science" && science(state, c.civilization).faith < 10) return blocked("Věda potřebuje společnou víru 10 / 10.");
    if (action === "guard" && c.guards >= Patronage.guardCapacity(state, world, c)) return blocked("Další jednotku osada dlouhodobě neuživí nebo nemá dost obyvatel.");
    if (action === "gift" && (!target || target.civilization === c.civilization)) return blocked("Vyber osadu jiné civilizace.");
    const site = action === "mine" ? constructionSite(world.biosphere, c, "mine", reserved) : c.home;
    if (site === undefined) return blocked("V dosahu není volné místo pro důl.");
    return { issue: "", cost, site };
  }
  function actionBlock(state, world, c, action, target, autonomous = false) {
    return actionQuote(state, world, c, action, target, autonomous).issue;
  }
  function powerGround(s, i, c, kind) {
    if (kind === "hydro") return B.canBuild(s, i, c) && B.hydroPotential(s, i) >= 1;
    if (kind === "nuclear") return B.canBuild(s, i, c) && !s.ocean[i] && s.ice[i] < 0.18;
    return true;
  }
  function constructionSite(s, c, kind, reserved = new Map(), except = null) {
    const origin = point(c.home), candidates = [];
    const drops = kind === "hydro" ? new Set([
      ...s.power.plants.filter(p => p.kind === "hydro" && s.damage[p.tile] < 0.78).map(p => B.hydroDrop(s, p.tile).key),
      ...s.communities.filter(c => c.job && c.job !== except && c.job.phase !== "return" && jobConstruction(c.job) === "hydro").map(c => B.hydroDrop(s, c.job.target).key),
      ...Array.from(reserved).filter(([, source]) => source === "hydro").map(([i]) => B.hydroDrop(s, i).key)
    ]) : null;
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
      const p = { x: (origin.x + dx + W) % W, y: origin.y + dy }; if (p.y < 0 || p.y >= H) continue;
      const i = tile(p), d = Math.hypot(dx, dy);
      if (d < 2 || d > 8 || s.urban[i] || s.noBuild[i] || B.contaminated(s, i) || reserved.has(i) || B.worksiteReserved(s, i, except) || !ground(s, i, c) || comfort(s, i, c) < 0.18 || !sameRegion(s, i, c.home, c)) continue;
      const claimant = s.towns[s.claims[i] - 1]; if (claimant && claimant.civilization !== c.civilization) continue;
      if (!powerGround(s, i, c, kind) || drops?.has(B.hydroDrop(s, i).key)) continue;
      const score = (kind === "mine" ? s.height[i] : B.powerPotential(s, i, kind, 1) / 10) - d * 0.025;
      candidates.push({ i, score });
    }
    candidates.sort((a, b) => b.score - a.score); return candidates[0]?.i;
  }
  function orbitalSettlement(world, c) {
    const s = world.biosphere;
    return s.towns[c.town]?.orbitalColony || c.home === s.colony && c.civilization === s.colonialCivilization;
  }
  function energyOutpost(world, id, p) {
    const s = world?.biosphere;
    if (!s || !id) return false;
    return s.robotBases?.some(base => base.civilization === id && (!p || distance(point(base.tile), p) < 12))
      || s.communities?.some(c => c.active && c.civilization === id && orbitalSettlement(world, c) && (!p || distance(point(c.home), p) <= 10));
  }
  function surfaceEnergyBlock(state, world, id, p) {
    return energyBlock(state, id) || (energyOutpost(world, id, p) ? "" : "Stav u vlastní kolonie nebo robotické základny. Ve městě zadej pokyn v nabídce Spravovat osady.");
  }
  function installWind(state, world, p, id = state.patron?.id, paid = false, job = null) {
    if (!owns(state, world, id)) return "Vyber vlastní svět nebo robotickou základnu.";
    const locked = paid ? energyBlock(state, id) : surfaceEnergyBlock(state, world, id, p);
    if (locked) return locked;
    const s = world.biosphere, i = tile(p), c = (s.communities ?? [])
      .filter(c => c.active && c.civilization === id && (paid ? c.job === job : orbitalSettlement(world, c) && distance(point(c.home), p) <= 10))
      .sort((a, b) => distance(point(a.home), p) - distance(point(b.home), p))[0];
    const base = s.robotBases.find(base => base.civilization === id && distance(point(base.tile), p) < 12);
    const actor = c ?? base ?? { profile: state.nations[id].profile };
    if (B.contaminated(s, i)) return "Stavba musí počkat, až ustoupí kontaminace.";
    if (!ground(s, i, actor) || s.urban[i] || s.noBuild[i] || B.worksiteReserved(s, i, job) || !base && (!c || distance(point(c.home), p) > 10)) return actor.profile === "cold"
      ? "Vyber volnou souš nebo pevný led u vlastního města či robotické základny." : "Vyber volnou souš u vlastního města nebo robotické základny.";
    const claimant = s.towns[s.claims[i] - 1]; if (claimant && claimant.civilization !== id) return "Místo patří jiné civilizaci.";
    if (!paid && !pay(state, world, id, { supplies: 18 })) return "Větrník potřebuje 18 místních M.";
    B.reservePlot(s, i, c ? c.town + 1 : 0, 6);
    s.power.plants.push({ tile: i, town: c ? c.town + 1 : 0, kind: "wind", output: 0, civilization: id, profile: actor.profile, robot: !c });
    Orbit.event(state, world.name + " · " + state.nations[id].name + " dokončuje větrnou elektrárnu.", "good"); return "";
  }
  function installOutpostHydro(state, world, p, id = state.patron?.id) {
    const locked = surfaceEnergyBlock(state, world, id, p);
    if (locked) return locked;
    const g = grid(state, world, id);
    const issue = withOwner(state, world, id, () => B.installHydro(world.biosphere, p, g.supplies));
    if (!issue) g.supplies -= B.HYDRO_SUPPLY;
    return issue;
  }
  function order(state, world, c, action, target, autonomous = false, quote = actionQuote(state, world, c, action, target, autonomous)) {
    if (quote.issue) return quote.issue;
    const s = world.biosphere, { cost, source } = quote;
    let destination = quote.site;
    if (action === "gift") { const route = B.walkPath(s, c.home, target.home, true, c); if (!route.length && c.home !== target.home) return "Obchod potřebuje průchozí pěší spojení. Přes moře použij kmenové dary nebo meziplanetární linku."; destination = target.home; }
    if (!pay(state, world, c.civilization, cost, quote.reserve)) return "Místní prostředky se změnily.";
    c.food -= cost.food;
    c.job = { kind: action, source, playerOrdered: !autonomous, began: s.time, work: 0, paid: cost.food, paidEnergy: cost.energy, paidSupplies: cost.supplies,
      ...(action === "science" ? { energyPerSecond: scienceOrderDraw(state, c.civilization), powerFraction: 0, powerPaused: true } : {}),
      ...point(c.home), profile: c.profile, economic: true, target: destination, targetId: target?.id, destination: -1, route: [], phase: CONSTRUCTION[action] || action === "gift" ? "out" : "work", cargo: action === "gift" ? 16 : 0 };
    Orbit.event(state, world.name + " · " + Patronage.name(c) + " · " + (Patronage.ACTIONS[action]?.name ?? action) + ": " + priceLabel(cost) + "."); return "";
  }
  const jobConstruction = job => job.kind === "hydro" ? "hydro" : job.kind === "energy" ? job.source ?? "wind" : CONSTRUCTION[job.kind];
  const workNeeded = job => job.source === "nuclear" ? 32
    : { faith: 10, energy: 16, hydro: 16, science: 20, mine: 18, guard: job.economic ? 14 : 10, gift: job.economic ? 2 : 1, gather: 3, materials: 8 }[job.kind] ?? 10;
  function refundConstruction(state, world, c, job) {
    if (!jobConstruction(job) || job.phase === "return") return;
    const g = grid(state, world, c.civilization);
    if (g) { g.reserve = Math.min(B.POWER_LIMIT, g.reserve + (job.paidEnergy || 0)); g.supplies = Math.min(100, g.supplies + (job.paidSupplies || 0)); }
  }
  function advanceJob(state, world, c, dt) {
    const s = world.biosphere, job = c.job; if (!job) return;
    if (job.kind === "gift" && job.partnerCivilization && job.phase !== "return"
      && !s.communities.some(target => target.id === job.targetId && target.active
        && target.civilization === job.partnerCivilization && target.civilization !== c.civilization)) {
      job.phase = "return"; job.cargo = job.paidSupplies; job.delivered = true;
    }
    const kind = jobConstruction(job);
    if ((job.kind === "energy" || job.kind === "hydro") && job.phase !== "return" && energyBlock(state, c.civilization)) {
      refundConstruction(state, world, c, job);
      c.job = null;
      Orbit.event(state, world.name + " · Rozestavěná elektrárna vyžaduje společnou víru 10/10. Materiál se vrátil do místního skladu v rámci jeho kapacity.", "warn");
      return;
    }
    if (kind && job.phase !== "return") {
      const i = job.target, claimant = s.towns[s.claims[i] - 1];
      if (s.urban[i] || s.noBuild[i] || B.contaminated(s, i) || B.worksiteReserved(s, i, job) || !ground(s, i, c) || comfort(s, i, c) < 0.18
        || claimant && claimant.civilization !== c.civilization || !powerGround(s, i, c, kind)) {
        const replacement = constructionSite(s, c, kind, undefined, job);
        if (replacement === undefined) {
          refundConstruction(state, world, c, job); c.job = null;
          Orbit.event(state, world.name + " · Staveniště není dostupné. Materiál vrácen do místního skladu v rámci jeho kapacity.", "warn"); return;
        }
        job.target = replacement; job.phase = "out"; job.work = 0; job.destination = -1; job.route = [];
      }
    }
    job.blocked = !ground(s, tile(job), c) || comfort(s, tile(job), c) < 0.08;
    // Energy-waiting science jobs must not expire just because the grid is temporarily deficient.
    if (s.time - job.began > 220 && !(job.kind === 'science' && job.energyPerSecond > 0)) { refundConstruction(state, world, c, job); c.job = null; Orbit.event(state, world.name + " · Úkol " + Patronage.ACTIONS[job.kind].name + " nedokončen.", "warn"); return; }
    if (job.blocked) return;
    if (job.phase === "out") { if (!B.walk(s, job, point(job.target), 0.36, true)) return; job.phase = "work"; }
    if (job.phase === "return") { if (B.walk(s, job, point(c.home), 0.36, true)) { if (job.kind === "gift" && job.delivered) { const g = grid(state, world, c.civilization); g.supplies = Math.min(100, g.supplies + job.cargo); } c.job = null; } return; }
    // New science assignments advance only by the electrical power actually allocated by powerStep.
    // Legacy saves (already charged 20 E upfront) have no energyPerSecond and are not charged again.
    if (job.kind === "science" && job.energyPerSecond > 0) {
      const fraction = clamp(Number(job.powerFraction) || 0, 0, 1);
      job.powerPaused = fraction < 0.001;
      if (job.powerPaused) return;
      job.work += dt * fraction;
    } else job.work += dt;
    const needed = workNeeded(job);
    if (job.work < needed) return;
    if (kind === "wind") { const issue = installWind(state, world, point(job.target), c.civilization, true, job); if (issue) { job.blocked = true; return; } }
    if (kind === "hydro" || kind === "nuclear") {
      if (kind === "hydro" && s.power.plants.length >= 24) { job.blocked = true; return; }
      B.commissionPlant(s, kind, job.target, c.town + 1, c.civilization, c.profile);
      const name = kind === "hydro" ? "vodní turbínu" : "jadernou elektrárnu";
      Orbit.event(state, world.name + " · " + Patronage.name(c) + " dokončuje " + name + ".", "good");
    }
    if (job.kind === "science") {
      science(state, c.civilization).points += 3;
      // The completed research infrastructure stays in operation after the +3 VB payout.
      // Store the load on the planet which performed this job, not on every colony.
      const g = grid(state, world, c.civilization);
      if (g) g.scienceBaseLoad = Math.round((g.scienceBaseLoad + SCIENCE_UPKEEP_PER_ORDER) * 100) / 100;
      Orbit.event(state, state.nations[c.civilization].name + " získává 3 společné VB. Energetické nároky civilizace rostou o +" + SCIENCE_UPKEEP_PER_ORDER.toFixed(2).replace('.', ',') + " E/s.", "good");
    }
    if (job.kind === "mine") {
      B.reservePlot(s, job.target, c.town + 1, 11); s.mines.push({ tile: job.target, civilization: c.civilization, town: c.town + 1 });
      Orbit.event(state, world.name + " · Otevřen těžební důl. Výnos závisí na energii a provozu osady.", "good");
    }
    if (job.kind === "guard") Patronage.finishRecruitment(state, world, c);
    if (job.kind === "gift") {
      const other = s.communities.find(x => x.id === job.targetId && x.active);
      if (other) {
        const recipient = grid(state, world, other.civilization), source = grid(state, world, c.civilization);
        recipient.supplies = Math.min(100, recipient.supplies + job.cargo - 12); job.cargo = 12; job.delivered = true;
        for (const g of [source, recipient]) { g.tradeUntil = state.time + 120; g.tradeBonus = 0.10; }
        const pair = [c.realm, other.realm].sort((a, b) => a - b).join(":");
        if (typeof Space !== "undefined") Space.changeRelation(state, c.civilization, other.civilization, 15);
        else s.diplomacy[pair] = Math.min(100, (s.diplomacy[pair] ?? 0) + 15);
        if (s.diplomacy[pair] >= 60) Patronage.transferTown(state, world, other.town, c.civilization, c.realm);
      }
    }
    if (kind || job.kind === "gift") job.phase = "return"; else c.job = null;
  }
  function jobProgress(s, c) {
    const j = c.job; if (!j) return { percent: 0, label: "Připraveno", phase: "idle", detail: "Osada je volná pro nový pokyn." };
    const name = Patronage.ACTIONS[j.kind]?.name ?? j.kind;
    const distance = (a,b) => Math.hypot(Math.min(Math.abs(a.x-b.x),W-Math.abs(a.x-b.x)),a.y-b.y);
    const origin=point(c.home), target=j.target>=0?point(j.target):s.communities.find(c=>c.id===j.targetId)?point(s.communities.find(c=>c.id===j.targetId).home):origin;
    const leg = destination => clamp(1-distance(j,destination)/Math.max(1,distance(origin,target)),0,1);
    const returning=Boolean(j.returning||j.delivered||j.phase==='return');
    const local=['faith','guard','science'].includes(j.kind);
    const needed=workNeeded(j);
    let phase=returning?'return':!local&&j.work<=0&&j.phase==='out'?'out':'work';
    let percent=returning?85+14*leg(origin):local?99*clamp(j.work/needed,0,1):phase==='out'?20*leg(target):20+65*clamp(j.work/needed,0,1);
    if(j.blocked)phase='blocked';
    if (j.kind === 'science' && j.energyPerSecond > 0 && !j.blocked && j.powerPaused) phase='power';
    const labels={out:'Cesta na místo',work:'Práce probíhá',return:'Návrat do osady',blocked:'Čeká na bezpečnou cestu nebo prostředí',power:'Čeká na energii'};
    return { percent:Math.min(99,Math.max(0,Math.floor(percent))),label:name+' · '+labels[phase],phase,detail:labels[phase]+(phase==='power'?' · Při nedostatku výroby se práce zastaví. Pokrok zůstává zachovaný.':returning?' · Výsledek práce může být hotový, osada se uvolní po návratu skupiny.':phase==='blocked'?' · Pokyn zůstává rozpracovaný. Po zlepšení podmínek může pokračovat.':j.kind==='science'&&j.energyPerSecond>0?' · Odběr '+j.energyPerSecond+' E/s, skutečně '+(j.energyPerSecond*(j.powerFraction||0)).toFixed(2)+' E/s.':'') };
  }
  function protectSettlements(state, world, id, people, grid) {
    const s = world.biosphere;
    if (s.time < (grid.nextClimateReview ?? 0) || !knows(state, id, "climate")) return;
    grid.nextClimateReview = s.time + 4;
    const needs = [];
    for (const c of people) {
      if (c.era < 5) continue;
      const town = s.towns[c.town];
      const raw = s.temperature[c.home], health = comfort(s, c.home, c);
      if (health >= 0.45 || centerHazard(s, c)) {
        delete town.climateStress;
        continue;
      }
      const mode = raw < climateTarget(c.profile) ? "heat" : "cool";
      if (town.climateStress?.mode !== mode || s.time - town.climateStress.last > 5) {
        town.climateStress = { mode, since: s.time, last: s.time };
        continue;
      }
      town.climateStress.last = s.time;
      if (s.time - town.climateStress.since >= 12) needs.push({ c, mode, health });
    }
    if (!needs.length || grid.output - grid.demand < B.STATION_THERMAL_DRAW
      || grid.reserve < B.STATION_ENERGY + 20 || grid.supplies < B.STATION_SUPPLY + 8) return;
    const stations = B.placedStations(s).filter(station => station.civilization === id && s.damage[station.tile] < 0.62);
    if (stations.length >= B.MAX_STATIONS) return;
    for (const { c, mode } of needs.sort((a, b) => a.health - b.health || b.c.people - a.c.people)) {
      const home = point(c.home);
      // Existing nearby equipment belongs to the operator, including stations they turned off.
      if (stations.some(station => distance(point(station.tile), home) <= B.STATION_REACH * 0.6)) continue;
      const candidates = [];
      for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
        const reach = Math.hypot(dx, dy), y = home.y + dy;
        if (reach < 2 || reach > 7 || y < 0 || y >= H) continue;
        const p = { x: (home.x + dx + W) % W, y }, i = tile(p), claimant = s.towns[s.claims[i] - 1];
        if (s.ocean[i] || s.urban[i] || s.noBuild[i] || !ground(s, i, c) || !sameRegion(s, c.home, i, c)
          || claimant && claimant.civilization !== id || B.worksiteReserved(s, i)
          || !Number.isFinite(B.settlementSafety(s, i, c))) continue;
        candidates.push({ p, score: reach + s.water[i] * 4 });
      }
      candidates.sort((a, b) => a.score - b.score);
      for (const { p } of candidates) {
        if (buildStation(state, world, p, id)) continue;
        const station = s.stations.find(item => item.tile === tile(p));
        station.mode = mode;
        Orbit.event(state, world.name + " · " + Patronage.name(c) + " postavila teraformer kvůli "
          + (mode === "heat" ? "dlouhotrvajícímu chladu." : "dlouhotrvajícímu horku."), "good",
          { category: "civic", worldId: world.id, civilization: id, tile: station.tile });
        return;
      }
    }
  }
  function powerStep(state, world, population, irradiance, requests, report) {
    const s = world.biosphere; economies(state, world);
    for (const [idText, g] of Object.entries(s.power.grids)) {
      const id = Number(idText), nation = state.nations[id]; if (!nation) continue;
      const people = (s.communities ?? []).filter(c => c.active && c.civilization === id), towns = people.map(c => s.towns[c.town]);
      const bases = s.robotBases.filter(b => b.civilization === id), modern = civEra(state, world, id) >= 6;
      if (!towns.length && !bases.length) {
        g.output = g.demand = g.programDraw = g.stationDraw = g.scienceDraw = g.scienceDemand = 0;
        g.program.draw = 0;
        if (g.work >= B.PROBE_WORK && g.program.funded) g.program.online = false;
        continue;
      }
      g.age += B.STEP;
      const heating = people.length ? people.reduce((sum, c) => sum + (1 - comfort(s, c.home, c)), 0) / people.length : 0;
      const cityDemand = towns.length ? (modern ? 2.2 : 0.5) + towns.length * 0.55 + Math.sqrt(people.reduce((sum, c) => sum + c.people, 0) / 1000000) * 1.7 + heating * 5 : 0.45;
      // Existing laboratory infrastructure is part of baseline load even while no science is running.
      const demand = cityDemand + g.scienceBaseLoad;
      let generation = 0, thermal = 0, nuclearFuel = 0, pollution = 0;
      const plants = s.power.plants.filter(p => p.civilization === id);
      const efficientRenewables = knows(state, id, "power");
      for (const plant of plants) {
        const i = plant.tile, active = s.urban[i] && s.damage[i] < 0.62 && footing(s, i, plant) && floodDepth(s, i, plant) < 0.34 && s.fire[i] < 0.12 && s.lava[i] < 0.07;
        plant.output = active ? B.powerPotential(s, i, plant.kind, irradiance) : 0;
        if (plant.profile === "cold" && active && plant.kind === "wind") plant.output /= clamp(1 - s.ice[i] * 0.7, 0.25, 1);
        if (efficientRenewables && (plant.kind === "wind" || plant.kind === "hydro")) plant.output *= 1.1;
        if (plant.kind === "thermal") { plant.output = g.reserve < 35 && g.supplies > 4 ? Math.min(plant.output, Math.max(0, demand - generation + 1)) : 0; thermal += plant.output; if (plant.output) { s.smog[i] = Math.min(1, s.smog[i] + 0.025); pollution += 0.05; } }
        else {
          if (plant.kind === "nuclear") {
            if (g.supplies < 5 || s.ice[i] >= 0.18 || s.ocean[i] || !people.some(c => c.town + 1 === plant.town)) plant.output = 0;
            nuclearFuel += plant.output * 0.015;
          }
          generation += plant.output;
        }
      }
      const ownRequests = requests.filter(r => r.station.civilization === id), load = ownRequests.reduce((sum, r) => sum + r.load, 0);
      const spare = Math.max(0, generation + thermal - demand);
      const stationPower = Math.min(load, spare + Math.max(0, g.reserve - 8) / B.STEP);
      for (const request of ownRequests) {
        const station = request.station; station.pending = false; station.load = request.load;
        const available = load ? stationPower * request.load / load : 0, battery = Math.min(Math.max(0, request.load - available), station.battery / B.STEP);
        station.battery -= battery * B.STEP; station.draw = available + battery; station.fraction = station.load ? station.draw / station.load : 0;
      }
      const port = g.program;
      port.draw = 0;
      if (g.work >= B.PROBE_WORK && port.funded && towns.length) {
        const net = generation + thermal - demand - stationPower;
        const available = g.supplies >= 1 && net + Math.max(0, g.reserve - 8) / B.STEP >= PORT_DRAW;
        if (port.online === false) {
          if (g.supplies >= 3 && g.reserve >= 20 && net >= PORT_DRAW) { port.online = true; port.shortage = 0; }
        } else {
          port.shortage = available ? 0 : (port.shortage ?? 0) + B.STEP;
          if (port.shortage >= PORT_GRACE) port.online = false;
        }
        if (available && port.online !== false) port.draw = PORT_DRAW;
      } else if (g.work >= B.PROBE_WORK && port.funded) port.online = false;
      // A science action is a physical grid load, not free progress after paying its starting cost.
      // Power order: city basics + permanent science infrastructure -> equipment -> city science jobs -> strategic research.
      const labJobs = people.filter(c => c.job?.kind === 'science' && c.job.energyPerSecond > 0 && c.job.phase === 'work' && !c.job.blocked);
      const scienceDemand = labJobs.reduce((sum, c) => sum + c.job.energyPerSecond, 0);
      const baseBalance = generation + thermal - demand - stationPower - port.draw;
      const batteryHeadroom = Math.max(0, (g.reserve - 20) / B.STEP - Math.max(0, -baseBalance));
      const scienceBudget = Math.max(0, baseBalance) + batteryHeadroom;
      const scienceDraw = Math.min(scienceDemand, scienceBudget);
      for (const c of labJobs) {
        c.job.powerFraction = scienceDemand > 0 ? scienceDraw / scienceDemand : 0;
        c.job.powerPaused = c.job.powerFraction < 0.001;
      }
      let researchDraw = 0; const pool = science(state, id), key = pool.science.active;
      if (pool.faith >= 10 && g.reserve >= 20 && g.supplies >= 2 && civEra(state, world, id) >= 5) {
        const budget = Math.max(0, spare - stationPower - port.draw - scienceDraw);
        if (key && pool.science.funded[key] && TECH[key]) {
          const amount = Math.min(B.STEP * 0.45, budget * B.STEP / 3.2, TECH[key].work - pool.science.progress[key]);
          pool.science.progress[key] += amount; researchDraw += amount * 3.2 / B.STEP;
          if (pool.science.progress[key] >= TECH[key].work - 1e-7) { pool.science.progress[key] = TECH[key].work; pool.science.active = null; report(nation.name + " dokončuje " + TECH[key].name + ".", "good"); }
        } else if (g.program.active && g.program.funded && knows(state, id, "space")) {
          const amount = Math.min(B.STEP * 0.45, budget * B.STEP / 3.2, B.PROBE_WORK - g.work);
          g.work += amount; researchDraw += amount * 3.2 / B.STEP;
          if (g.work >= B.PROBE_WORK - 1e-7) { g.work = B.PROBE_WORK; g.program.active = false; report(nation.name + " dokončuje místní kosmodrom.", "good"); }
        }
      }
      g.output = generation + thermal; g.demand = demand + stationPower + port.draw + scienceDraw + researchDraw;
      g.programDraw = researchDraw; g.stationDraw = stationPower; g.scienceDraw = scienceDraw; g.scienceDemand = scienceDemand;
      g.stationGenerator = 0; g.fuelUse = thermal * 0.14 + nuclearFuel; g.pollution = pollution;
      g.reserve = clamp(g.reserve + (g.output - g.demand) * B.STEP, 0, B.POWER_LIMIT);
      if (people.length) protectSettlements(state, world, id, people, g);
      g.strain += ((g.reserve < 0.1 && g.output < demand ? 1 : 0) - g.strain) * 0.05;
      // Only non-player civilizations may commission a basic plant autonomously.
      // The player's first wind plant must follow a completed 'Rozvíjet energetiku' order.
      if (id !== state.patron?.id && pool.faith >= 10 && civEra(state, world, id) >= 5 && plants.filter(p => s.damage[p.tile] < 0.62).length < 1 && s.time >= g.nextBasicBuild && g.supplies >= 18 && people.length) {
        g.nextBasicBuild = s.time + 40;
        const c = people.find(c => !c.job);
        if (c) order(state, world, c, "energy", null, true);
      }
    }
    focus(state, world);
  }
  function populationStep(state, world, dt) {
    const s = world.biosphere;
    if (!s.populationVersion || Math.abs(world.pop - (s.populationTotal ?? world.pop)) > 1e-7) Patronage.sync(state, world);
    economies(state, world);
    const list = (s.communities ?? []).filter(c => c.active), before = world.pop;
    for (const c of list) c.mineFoodRate = 0;
    let independent = false;
    for (const [idText, g] of Object.entries(s.power.grids)) {
      const id = Number(idText), own = list.filter(c => c.civilization === id), era = civEra(state, world, id);
      g.mineRate = g.baseSupplyRate = 0;
      if (!own.length) { if (s.robotBases.some(b => b.civilization === id)) { g.supplies = Math.max(0, g.supplies - dt * 0.015); g.baseSupplyRate = g.supplyRate = -0.015; } continue; }
      const health = own.reduce((sum, c) => sum + comfort(s, c.home, c) * wetTolerance(s, c.home, c), 0) / own.length;
      const production = (era >= 6 ? 0.8 : era >= 5 ? 0.5 : 0.18) * health;
      const upkeep = (era >= 5 ? 0.2 : 0.08) + (1 - health) * 0.55 + g.fuelUse + (g.program.draw > 0 ? PORT_SUPPLIES : 0);
      const localBalance = production - upkeep;
      const trade = g.tradeUntil > state.time ? g.tradeBonus ?? 0 : 0;
      const surplus = Math.max(0, localBalance);
      // In favorable weather temperate settlements can bank more of their real surplus until the winter reserve is restored.
      const stockShortfall = Math.max(0, WINTER_STOCK_TARGET - g.supplies);
      const winterRefill = dt > 0 && stockShortfall > 0 && surplus > 0 && own.every(c => c.profile === "temperate")
        ? Math.min(stockShortfall / dt, surplus * 0.8 * clamp((health - 0.55) / 0.30, 0, 1)) : 0;
      g.baseSupplyRate = Math.min(0, localBalance) + surplus * 0.1 + winterRefill + trade;
      let room = Math.max(0, 100 - g.supplies - g.baseSupplyRate * dt);
      if (g.reserve > 1 && dt > 0 && room > 0) for (const mine of s.mines) {
        if (mine.civilization !== id || s.urban[mine.tile] !== 11 || s.damage[mine.tile] >= 0.62) continue;
        const crew = own.find(c => c.town + 1 === mine.town);
        if (!crew || !ground(s, mine.tile, crew)) continue;
        const available = Math.max(0, crew.food - Patronage.basicFoodReserve(state, crew));
        const work = Math.min(dt, available / MINE_FOOD, room / MINE_OUTPUT);
        crew.food -= work * MINE_FOOD;
        crew.mineFoodRate += work * MINE_FOOD / dt;
        g.mineRate += work * MINE_OUTPUT / dt;
        room -= work * MINE_OUTPUT;
        if (room <= 0) break;
      }
      g.supplyRate = g.baseSupplyRate + g.mineRate;
      g.supplies = clamp(g.supplies + g.supplyRate * dt, 0, 100);
      if (g.supplyRate >= 0 && health > 0.5) independent = true;
      for (const c of own) {
        const flood = Math.max(0, floodDepth(s, c.home, c) - (c.profile === "warm" ? 0.20 : 0.35)) * (c.profile === "warm" ? 0.19 : 0.12);
        const thaw = iceFailure(s, c.home, c) ? 0.06 : 0;
        const fire = s.fire[c.home] * 0.25, lava = s.lava[c.home] * 0.5;
        const town = s.towns[c.town];
        const shelter = town?.housingCondition ?? 1 - s.damage[c.home];
        const exposure = 1 - comfort(s, c.home, c);
        const thermal = exposure * (0.001 + (1 - shelter) * 0.010);
        const loss = flood + thaw + fire + lava + thermal;
        const capacity = era >= 6 ? 8200000 : era >= 5 ? 1400000 : 120000;
        const growth = c.food > 1 && g.supplies > 1 ? 0.0018 * health * Math.max(0, 1 - world.pop / capacity) * (era >= 6 ? 0.5 : 1) : 0;
        const factor = Math.exp((growth - loss) * dt), old = c.people;
        const rates = [flood, thaw, fire, lava, thermal];
        const causes = ["zaplavení", "tání nosného ledu", "požár", "láva",
          s.temperature[c.home] < climateTarget(c.profile) ? "silný mráz" : "přehřátí"];
        if (loss > 0 && loss >= growth) {
          const primary = rates.indexOf(Math.max(...rates));
          c.lastPopulationRisk = { cause: causes[primary], at: s.time, intensity: rates[primary] };
        }
        c.people *= factor;
        if (c.people < 1) {
          const cause = loss > 0 ? causes[rates.indexOf(Math.max(...rates))]
            : c.hungryAt > 0 ? Patronage.hungerCause(world, c) : "";
          Patronage.recordSettlementLoss(state, world, c, cause);
          s.tribes = s.tribes.filter(tribe => tribe.home !== c.home);
          c.active = false; s.towns[c.town].abandoned = true; c.job = null;
          c.people = 0;
        }
        if (loss > growth) state.stats.losses += Math.max(0, old - c.people);
      }
    }
    if (list.length) Patronage.commitPopulation(world);
    if (before > 0 && world.missionPeople > 0) world.missionPeople *= Math.min(1, world.pop / before);
    world.self = independent; world.infrastructure = clamp(world.infrastructure + dt * (independent ? 0.015 : -0.003), 0, 1);
    if (before > 0 && world.pop === 0) {
      const liveBases=(s.robotBases??[]).length;
      Orbit.event(state,world.name+' · Poslední osadníci vymřeli.'+(liveBases?' Kolonie a její automatická zařízení zůstávají v provozu.':''),'bad');
      if (!liveBases) world.tech=false;
    }
  }
  function release(state) {
    if (!state.patron) return "Žádnou civilizaci nevedeš.";
    const old = state.patron, nation = state.nations[old.id];
    if (nation) nation.lastReleased = state.time;
    (state.patronHistory ??= []).push({ ...old, ended: state.time, reason: "released" });
    state.patron = null;
    for (const world of state.worlds) if (world.biosphere) focus(state, world);
    Orbit.event(state, old.name + " pokračuje samostatně. Patronát byl dobrovolně ukončen.", "good"); return "";
  }
  function ruinSuccessor(state, world, building) {
    const s = world.biosphere, town = s.towns[s.claims[building.tile] - 1];
    if (!state.patron || !town || town.civilization !== state.patron.id ||
      !s.communities.some(c => c.active && c.id === town.communityId)) return null;
    return town;
  }
  function buildingAccess(state, world, building, action) {
    if (!building) return "Stavba už není dostupná.";
    if (!state.patron) return "Nejprve přijmi patronát civilizace.";
    if (building.ancient) {
      const s = world.biosphere, town = ruinSuccessor(state, world, building);
      if (!town) return "Trosky musí ležet na území vlastní obydlené osady.";
      if (action !== "repair") return "";
      const id = town.civilization, plant = building.plant?.kind;
      if ((building.station || plant === "hydro") && !knows(state, id, "climate")) return "Obnova vyžaduje Regulaci klimatu.";
      if (plant === "nuclear" && !knows(state, id, "robotics")) return "Obnova vyžaduje Robotiku.";
      if (building.plant && science(state, id).faith < 10) return "Obnova zdroje vyžaduje víru 10 / 10.";
      if (building.port && s.ports.some(port => s.towns[port.town] === town)) return "Osada už má přístav.";
      if (building.kind === 5 && settlementEra(s, town) < 6) return "Obnova továrny potřebuje moderní osadu.";
      if (building.kind === 5 && town.factory >= 0) return "Osada už má továrnu.";
      return "";
    }
    if (buildingOwner(building) !== state.patron.id) return "Stavba patří jiné civilizaci.";
    if (action === "repair" && !owns(state, world)) return "Obnova potřebuje vlastní osadu nebo robotickou základnu.";
    return "";
  }
  function buildingOwner(building) { return building.ancient ? 0 : building.station?.civilization ?? building.plant?.civilization ?? building.monument?.civilization ?? building.town?.civilization ?? 0; }
  function buildStation(state, world, p, id = state.patron?.id) {
    if (!owns(state, world, id)) return "Vyber vlastní město nebo robotickou základnu.";
    const s = world.biosphere, i = tile(p), local = (s.communities ?? []).filter(c => c.active && c.civilization === id).sort((a,b) => distance(point(a.home),p)-distance(point(b.home),p))[0],
      actor = local ?? s.robotBases.find(b => b.civilization === id) ?? { profile: state.nations[id]?.profile };
    if (B.contaminated(s, i)) return "Stavba musí počkat, až ustoupí kontaminace.";
    if (!ground(s, i, actor) || s.urban[i] || B.worksiteReserved(s, i)) return "Teraformer potřebuje volnou bezpečnou pevninu.";
    const supporter = (s.communities ?? []).some(c => c.active && c.civilization === id && distance(point(c.home), p) <= 12)
      || s.robotBases.some(b => b.civilization === id && distance(point(b.tile), p) <= 12)
      || s.stations.some(b => b.civilization === id && !b.destroyed && b.mode !== "off" && distance(point(b.tile), p) <= 13);
    if (!supporter) return "Stav u vlastní osady, základny nebo funkčního teraformeru.";
    const claimant = s.towns[s.claims[i] - 1];
    if (claimant && claimant.civilization !== id) return "Místo patří jiné civilizaci.";
    if (s.stations.filter(b => b.civilization === id && b.tile >= 0 && !b.destroyed).length >= B.MAX_STATIONS) return "Dosažen limit teraformerů.";
    const kit = s.stations.find(b => b.civilization === id && b.tile < 0);
    if (!kit && !knows(state, id, "climate")) return "Nejprve odemkni Regulaci klimatu.";
    if (!kit && !pay(state, world, id, { energy: B.STATION_ENERGY, supplies: B.STATION_SUPPLY }, 20)) return "Stavba stojí 70 E + 24 M; ponech 20 E.";
    const station = kit ?? B.receiveStation(s);
    Object.assign(station, { tile: i, civilization: id, profile: actor.profile, mode: "off", pending: true });
    B.reservePlot(s, i, s.plotTown[i] || 0, B.STATION_TILE); focus(state, world); return "";
  }
  function manageBuildings(state, world, ids, action, preview = false) {
    const result = { count: 0, skipped: 0, energy: 0, supplies: 0, reasons: {}, ids: [] };
    if (!world?.biosphere || !state.patron) return result;
    const s = world.biosphere, g = grid(state, world), initial = g && { energy: g.reserve, supplies: g.supplies }, byId = new Map(B.buildings(s).map(b => [b.id, b]));
    for (const id of ids) {
      const b = byId.get(id);
      let error = buildingAccess(state, world, b, action);
      if (!error && action === "clear" && b.health > 0) error = "Nejde o trosky.";
      let quote;
      if (!error && action === "repair") {
        quote = B.repairQuote(s, b, g.supplies, world.pop || s.robotBases.length, b.ancient ? ruinSuccessor(state, world, b) : null);
        error = quote.error;
      }
      if (!error && !preview) error = Orbit.manageBuilding(state, world, id, action === "repair" ? "repair" : "demolish");
      if (error) { result.skipped++; result.reasons[error] = (result.reasons[error] ?? 0) + 1; continue; }
      if (action === "repair") {
        result.energy += quote.energy; result.supplies += quote.supplies;
        if (preview) { g.reserve -= quote.energy; g.supplies -= quote.supplies; }
      }
      result.count++; result.ids.push(id);
    }
    if (preview && g) { g.reserve = initial.energy; g.supplies = initial.supplies; }
    return result;
  }
  function restore(state) {
    init(state); historicalTime(state);
    if (!state.evolutionVersion) {
      for (const pool of Object.values(state.knowledgePools)) if (pool.science) {
        if (pool.science.progress.climate >= 23 && pool.science.funded.climate) pool.science.progress.climate = TECH.climate.work;
        if (pool.science.progress.navigation >= 19 && pool.science.funded.navigation) pool.science.progress.navigation = TECH.navigation.work;
      }
    }
    state.evolutionVersion = 1;
    for (const world of state.worlds) if (world.biosphere) {
      const s = world.biosphere; s.bioProfile = nativeProfile(s); s.originTime ??= Math.max(0, state.time - s.time);
      // Preserve automated outposts and their defense across older saves and restored simulations.
      s.robotBases ??= [];
      for (const key of ["citySelection", "cityExpanded"]) {
        const ref = state.interface?.[key], prefix = world.id + ":robot:";
        if (typeof ref !== "string" || !ref.startsWith(prefix)) continue;
        const base = s.robotBases[Number(ref.slice(prefix.length))];
        state.interface[key] = base ? world.id + ":base:" + base.tile : "";
      }
      for (const base of s.robotBases) {
        base.guards = Number.isFinite(base.guards) ? Math.max(0,Math.min(6,Math.floor(base.guards))) : 0;
        if (!PROFILES[base.profile]) base.profile = state.nations[base.civilization]?.profile ?? nativeProfile(s);
      }
      s.evolutionMode = s.evolutionMode === "accelerated" ? "accelerated" : "natural";
      for (const c of s.communities ?? []) { const town = s.towns[c.town]; if (town) identity(state, world, c, town); }
      // Drop phantom/duplicate mines, reconcile their owners with their actual plot.
      const seenMines = new Set();
      s.mines = (s.mines ?? []).filter(m => Number.isInteger(m.tile) && s.urban[m.tile] === 11 && !seenMines.has(m.tile) && seenMines.add(m.tile));
      for (const m of s.mines) { const town = s.towns[s.plotTown[m.tile] - 1]; if (town) { m.town = s.plotTown[m.tile]; m.civilization = town.civilization; } }
      for (const [index, town] of s.towns.entries()) if (town.civilization && s.communities.some(c => c.id === town.communityId && c.active)) Patronage.transferTown(state, world, index, town.civilization, town.realm, true);
      economies(state, world); B.reconcileInfrastructure(s); focus(state, world);
      for (const monument of s.monuments) if (monument.builtAt !== null && !monument.date) monument.date = dateAt(state, s.originTime + monument.builtAt);
    }
    for (const event of state.history ?? []) event.date ??= dateAt(state, event.time);
  }
  return { centerHazard, orderHazard, PROFILES, TECH, nationLabel, nationClimate, profile, climateTarget, climateIndex, nativeProfile, actorProfile, lifeTemperature, temperature, comfort, ground, footing, stableIce, frozenGround, environment,
    floodDepth, iceFailure, moisture, wetTolerance, waterNeed, forage, harvest, regions, sameRegion, invalidateGround, init, identity, science,
    economies, grid, focus, withOwner, owns, pay, wallet, civEra, settlementEra, zone, habitatZone, heatAt, seasonalHeats, starterShot, cityDevelopment, historicalTime, advanceCalendar, dateAt, dateLabel, duration,
    configureWorld, sciencePool, knows, scienceOrderDraw, researchBlock, research, refreshScience, spaceBlock, spaceProgram, spaceflight, builtPort, portStatus, PORT_DRAW,
    actionCosts, priceLabel, actionQuote, actionBlock, energyBlock, energyOutpost, CONSTRUCTION, constructionSite, installWind, installOutpostHydro, buildStation, buildingOwner, buildingAccess, ruinSuccessor, manageBuildings, order, advanceJob, jobProgress, powerStep, populationStep, release, restore,
    stateOf: world => contexts.get(world) };
})();
