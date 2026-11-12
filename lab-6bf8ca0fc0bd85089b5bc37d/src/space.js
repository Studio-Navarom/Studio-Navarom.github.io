"use strict";
const Space = (() => {
  const E = Evolution, B = Biosphere;
  const MISSIONS = {
    explore: { name: "Průzkumná sonda", energy: 28, supplies: 10 },
    base: { name: "Robotická příprava", energy: 90, supplies: 42 },
    colony: { name: "Kolonizační loď", energy: 145, supplies: 48 },
    trade: { name: "Obchodní výprava", energy: 15, supplies: 10 },
    attack: { name: "Vojenská výprava", energy: 70, supplies: 25 }
  };
  const point = B.position, SIZE = B.W * B.H;
  const OUTPOST_STOCK = B.STATION_SUPPLY;
  const TWO_STATION_DEMAND = 0.45 + 2 * 3.2;
  function init(state) { state.expeditions ??= []; state.nextExpeditionId ??= 1; state.tradeRoutes ??= []; state.relations ??= {}; }
  function relation(state, a, b) {
    if (a === b) return 100;
    state.relations ??= {};
    const pair = [a, b].sort((a, b) => a - b).join(":"), first = state.nations[a], second = state.nations[b];
    if (state.relations[pair] === undefined) {
      let local;
      for (const world of state.worlds) {
        const s = world.biosphere, x = s?.communities?.find(c => c.active && c.civilization === a), y = s?.communities?.find(c => c.active && c.civilization === b);
        if (x && y) { local = s.diplomacy[[x.realm,y.realm].sort((a,b)=>a-b).join(":")]; if (local !== undefined) break; }
      }
      state.relations[pair] = local ?? (first?.nature === "broker" || second?.nature === "broker" ? 20 : first?.nature !== second?.nature ? 15 : -10);
    }
    return state.relations[pair];
  }
  function changeRelation(state, a, b, amount) {
    if (a === b) return;
    state.relations ??= {};
    const pair = [a, b].sort((a, b) => a - b).join(":");
    state.relations[pair] = B.clampValue(relation(state, a, b) + amount, -100, 100);
    for (const world of state.worlds) if (world.biosphere) {
      const s = world.biosphere;
      for (const x of (s.communities ?? []).filter(c => c.active && c.civilization === a)) for (const y of (s.communities ?? []).filter(c => c.active && c.civilization === b)) if (x.realm !== y.realm) s.diplomacy[[x.realm, y.realm].sort((a, b) => a - b).join(":")] = state.relations[pair];
    }
  }
  function members(world, id) { return (world?.biosphere?.communities ?? []).filter(c => c.active && c.civilization === id); }
  function people(world, id) { return members(world, id).reduce((sum, c) => sum + c.people, 0); }
  function crewProfiles(world, id) {
    return [...new Set(members(world, id).filter(c => c.people > 0).map(c => E.actorProfile(world.biosphere, c)))];
  }
  function crewPopulation(world, id, profile) {
    return members(world, id).reduce((sum, c) => sum + (E.actorProfile(world.biosphere, c) === profile ? c.people : 0), 0);
  }
  function takePeople(world, id, number, residents = [], selectedProfile) {
    const list = members(world, id).filter(c => !selectedProfile || E.actorProfile(world.biosphere, c) === selectedProfile);
    const available = list.reduce((sum, c) => sum + c.people, 0), take = Math.min(number, available * 0.2);
    for (const c of list) {
      const count = available > 0 ? c.people * take / available : 0;
      const profile = E.actorProfile(world.biosphere,c), group = residents.find(g => g.profile === profile);
      if (group) group.people += count; else if (count > 0) residents.push({ profile, people: count });
      c.people -= count;
    }
    Patronage.commitPopulation(world); return take;
  }
  function targetOwner(state, world, exclude = 0) {
    const list = (world?.biosphere?.communities ?? []).filter(c => c.active && c.civilization !== exclude).sort((a, b) => b.people - a.people);
    return list[0]?.civilization ?? 0;
  }
  function missionPartner(state, world, id, partner) {
    if (partner === undefined || partner === null) return targetOwner(state, world, id);
    return partner !== id && people(world, partner) > 0 ? partner : 0;
  }
  function colonyBlock(state, from, id = state?.patron?.id, infrastructureOnly = false) {
    if (!state || !from?.biosphere || !id || !E.owns(state, from, id)) return "Vyber vlastní obydlený svět.";
    if (!E.spaceflight(state, from, id)) return E.portStatus(state, from, id);
    if (!E.knows(state, id, "colonization")) return "Dokonči výzkum Kolonizace.";
    if (people(from, id) < 1200) return "Kolonizace potřebuje alespoň 1 200 vlastních obyvatel na zdrojovém světě.";
    const development=E.cityDevelopment(from,id);
    if (!development.ready) {
      if (development.plots < 40) return "Domovské město potřebuje větší funkční zástavbu.";
      if (development.homes < 12) return "Domovské město potřebuje víc obyvatelných domů.";
      if (!development.factory) return "Domovské město potřebuje funkční továrnu.";
      return "Domovské město se ještě musí rozvinout v moderní město.";
    }
    if (infrastructureOnly) return "";
    const g = E.grid(state, from, id);
    const {energy, supplies} = MISSIONS.colony;
    const missing = E.priceLabel({energy:Math.max(0, energy + 35 - g.reserve), supplies:Math.max(0, supplies - g.supplies)});
    return missing === "Zdarma" ? "" : "Na start chybí " + missing + " při zachování rezervy 35 E.";
  }
  function block(state, from, to, type, id = state?.patron?.id, options = {}) {
    if (!state || !MISSIONS[type] || !from?.biosphere || !to?.biosphere || from === to || !state.worlds.includes(to)) return "Vyber zdroj a jiný cílový svět.";
    if (!id || !E.owns(state, from, id)) return "Výpravy můžeš zadávat vlastní civilizaci.";
    if (!E.spaceflight(state, from, id)) return E.portStatus(state, from, id);
    if (type === "colony") {
      if (!E.science(state, id).discoveries[to.id]) return "Počkej na návrat sondy se vzorkem z cílové planety.";
      const sourceIssue = colonyBlock(state, from, id);
      if (sourceIssue) return sourceIssue;
      if (state.ships.length >= 14) return "Na cestě je již 14 lodí.";
      const profile = selectedCrew(from, id, options.profile);
      if (!profile) return "Vyber obyvatele, kteří poletí.";
      const report = assessment(state, to, id, profile, options.fresh);
      return report.level === "blocked" ? report.issue : "";
    }
    const spec = MISSIONS[type], g = E.grid(state, from, id);
    if (g.reserve < spec.energy + 35 || g.supplies < spec.supplies) return "Chybí místní cena " + E.priceLabel(spec) + " a rezerva 35 E.";
    if (state.ships.length >= 14) return "Na cestě je již 14 lodí.";
    if (type === "explore" && state.expeditions.some(r => r.civilization === id && r.target === to.id && r.type === "explore" && ["out", "return"].includes(r.status))) return "Průzkumná sonda k tomuto světu už letí.";
    if (type === "base") {
      if (!E.knows(state, id, "robotics") || !E.knows(state, id, "climate")) return "Příprava potřebuje Robotiku a Regulaci klimatu.";
      if (to.biosphere.robotBases?.some(b => b.civilization === id)) return 'Na světě již máš kolonii. Další infrastrukturu rozvíjej v Osadách.';
      if (state.ships.some(s => s.civilization === id && s.destination === to.id && s.missionType === "base")) return "Robotická příprava již míří k cíli.";
    }
    if (type === "trade") {
      const other = missionPartner(state, to, id, options.partner); if (!other) return "Obchod potřebuje obydlený svět jiné civilizace.";
      if (relation(state, id, other) < 0) return "Obchod potřebuje nezáporné vztahy. Pomoz sousedům nebo pošli materiál.";
    }
    if (type === "attack") {
      const other = missionPartner(state, to, id, options.partner); if (!other) return "Na cíli není vybraná cizí civilizace.";
      if (state.nations[id].nature === "broker") return "Smíšená společnost může obchodovat a bránit se, ale cizí města vojensky nepřebírá.";
      if (!E.knows(state, id, "colonization")) return "Výprava potřebuje technologii přepravy posádek.";
      if (members(from, id).reduce((sum, c) => sum + c.guards, 0) < 4) return "Připrav alespoň čtyři obránce na zdrojové planetě.";
    }
    return "";
  }
  function selectedCrew(world, id, profile) {
    const available = crewProfiles(world, id);
    return profile ? available.includes(profile) ? profile : null : available.length === 1 ? available[0] : null;
  }
  function colonyLaunchIssue(state, from, to, id, options) {
    const issue = block(state, from, to, "colony", id, {...options, fresh:true});
    if (issue) return issue;
    const report = assessment(state, to, id, selectedCrew(from, id, options.profile));
    return report.level === "risk" && !options.acceptRisk ? "Potvrď rizikové osídlení. " + report.issue : "";
  }
  function start(state, from, to, type, id = state.patron?.id, options = {}) {
    init(state);
    const issue = type === "colony" ? colonyLaunchIssue(state, from, to, id, options) : block(state, from, to, type, id, options);
    if (issue) return issue;
    const profile = selectedCrew(from, id, options.profile);
    const colonySite = type === "colony" ? assessment(state, to, id, profile).tile : undefined;
    const spec = MISSIONS[type]; if (!E.pay(state, from, id, spec, 35)) return "Místní zdroje se změnily.";
    const record = { id: state.nextExpeditionId++, type, civilization: id, origin: from.id, originName: from.name,
      target: to.id, targetName: to.name, status: "out", began: state.time, date: E.dateAt(state), people: 0, residents: [], note: "Na cestě" };
    if (type === "trade" || type === "attack") record.partner = missionPartner(state, to, id, options.partner);
    if (type === "colony") record.people = takePeople(from, id, Math.min(2400, Math.max(240, crewPopulation(from, id, profile) * 0.07)), record.residents, profile);
    if (type === "attack") {
      record.people = takePeople(from, id, 100, record.residents); record.troops = 4;
      let left = 4; for (const c of members(from, id)) { const n = Math.min(left, c.guards); c.guards -= n; left -= n; }
    }
    state.expeditions.push(record);
    Orbit.launchManaged(state, from, to, { missionType: type, recordId: record.id, civilization: id, partner: record.partner, surveyedLanding: type === "colony", colonySite,
      people: record.people, profile, residents: structuredClone(record.residents), cargo: type === "colony" ? 36 : type === "base" ? 18 : type === "trade" ? 10 : 0 });
    Orbit.event(state, E.nationLabel(state,id) + " · " + spec.name + " míří z " + from.name + " na " + to.name + ".", "good",
      {category:type === "attack" || type === "trade" ? "civic" : "orbit"});
    return "";
  }
  function record(state, ship) { return state.expeditions?.find(r => r.id === ship.recordId); }
  function lost(state, ship, reason) {
    init(state);
    if (ship.people > 0 && !ship.lossAccounted) { state.stats.losses += ship.people; state.stats.crewLost = (state.stats.crewLost ?? 0) + ship.people; ship.lossAccounted = true; }
    const r = record(state, ship); if (r) { r.status = "lost"; r.note = reason; r.ended = state.time; }
    const destination = r?.targetName ?? ship.targetName;
    const title = r ? MISSIONS[r.type]?.name ?? "Výprava" : ship.surveyedLanding ? MISSIONS.colony.name : "Loď";
    Orbit.event(state, (destination ? destination + " · " : "") + title + " · " + reason, "bad",
      ship.people > 0 ? {kind: "crew-loss", civilization: ship.civilization, worldId: r?.target ?? ship.destination, cause: reason} : {});
  }
  function landingGround(s, i, actor, allowIce = false) {
    if (B.contaminated(s, i)) return false;
    if (E.ground(s, i, actor)) return true;
    // Landers can clear snow on real land; they must not remove a floating ice foundation.
    return allowIce && actor.profile !== "cold" && (!s.ocean[i] || s.height[i] >= 0.45)
      && s.water[i] < 0.27 && s.fire[i] < 0.08 && s.lava[i] < 0.07;
  }
  const surveyCache = new WeakMap();

  function seasonalForecast(state, world) {
    const s = world.biosphere, {peri, apo} = world.orbit;
    const key = [s.time, s.navigationRevision, s.lastImpact?.time, s.plots.length, world.orbitAlert, world.orbitLabel, peri, apo, s.legacyClimate, ...s.stations.map(station =>
      [station.tile, station.mode, station.profile, station.fraction, B.stationFault(s, station)].join("/"))].join(":");
    const cached = surveyCache.get(world);
    if (cached?.surface === s && cached.key === key) return cached;
    const forecast = {surface:s, key, reports:new Map(), temperatures:B.seasonalTemperatures(s, E.seasonalHeats(state, world))};
    surveyCache.set(world, forecast);
    return forecast;
  }

  function territoryOpen(s, i, id) {
    const claimant = s.towns[s.claims[i] - 1];
    return !claimant || claimant.civilization === id || claimant.abandoned;
  }


  // A colony is founded by the first landing module, not by its first residents.
  // Infrastructure exists on the surface independently from community/population objects.
  function baseDistance(s, a, b) {
    const x = point(a), y = point(b), dx = Math.abs(x.x - y.x);
    return Math.hypot(Math.min(dx, B.W - dx), x.y - y.y);
  }
  function nearbyBase(state, world, id, tile) {
    return world.biosphere.robotBases?.find(b => b.civilization === id && baseDistance(world.biosphere, b.tile, tile) <= 12);
  }
  function baseCandidates(s, base, used = new Set(), min = 2, max = 11) {
    const center = point(base.tile), result = [];
    for (let dy = -11; dy <= 11; dy++) for (let dx = -11; dx <= 11; dx++) {
      const y = Math.floor(center.y) + dy, x = (Math.floor(center.x) + dx + B.W) % B.W;
      if (y < 0 || y >= B.H) continue;
      const gap = Math.hypot(dx, dy), i = x + y * B.W;
      if (gap < min || gap > max || used.has(i) || s.urban[i] || s.noBuild[i] || B.worksiteReserved(s, i)) continue;
      if (!E.ground(s, i, base) || !E.sameRegion(s, i, base.tile, base)) continue;
      if (s.damage[i] >= 0.62 || s.fire[i] >= 0.10 || s.lava[i] >= 0.07 || E.floodDepth(s, i, base) > 0.32) continue;
      const claim = s.towns[s.claims[i] - 1];
      if (claim && claim.civilization !== base.civilization && !claim.abandoned) continue;
      result.push({ i, gap });
    }
    return result;
  }
  function automaticSourceSite(s, base, used = new Set()) {
    const active = s.power.plants.filter(p => s.damage[p.tile] < 0.62);
    const hydroDrops = new Set([ ...active.filter(p => p.kind === 'hydro').map(p => B.hydroDrop(s, p.tile).key),
      ...[...used].map(i => B.hydroDrop(s,i).key) ]);
    let best = null, top = -Infinity;
    for (const {i, gap} of baseCandidates(s, base, used, 1.8, 11)) {
      if (active.some(p => baseDistance(s, p.tile, i) < 2.3)) continue;
      const wind = B.powerPotential(s, i, 'wind', 1);
      const hydro = B.hydroDrop(s, i);
      for (const [kind, output] of [['wind',wind],['hydro',hydro.potential]]) {
        if (kind === 'hydro' && (output < 1.2 || hydro.key < 0 || hydroDrops.has(hydro.key))) continue;
        const score = output - gap * 0.08 + (kind === 'hydro' ? 0.10 : 0);
        if (score > top) { best = {kind, tile:i, output}; top = score; }
      }
    }
    return best;
  }
  function climateMode(s, i, profile) {
    const target = E.climateTarget(profile), temperature = s.temperature[i];
    if (profile === 'cold' && temperature >= B.FREEZE_AT + 0.09) return 'cool';
    if (temperature < target - 0.10) return 'heat';
    if (temperature > target + 0.10) return 'cool';
    if (s.wet[i] > 0.65) return 'dry';
    if (s.wet[i] < 0.14 && profile !== 'cold') return 'wet';
    return temperature < target ? 'heat' : 'cool';
  }
  function automaticStationSite(s, base, used = new Set()) {
    const stations = B.placedStations(s).filter(st => !st.destroyed && st.civilization === base.civilization);
    let best = null, top = -Infinity;
    for (const {i, gap} of baseCandidates(s, base, used, 2.8, 11)) {
      if (stations.some(st => baseDistance(s, st.tile, i) < 5.3)) continue;
      const mode = climateMode(s, i, base.profile), center = point(i);
      let advantage = 0;
      // Prefer the frontier that can help the greatest number of currently marginal tiles.
      for (let dy = -5; dy <= 5; dy += 2) for (let dx = -5; dx <= 5; dx += 2) {
        if (dx * dx + dy * dy > 31) continue;
        const y = Math.floor(center.y) + dy;
        if (y < 0 || y >= B.H) continue;
        const x = (Math.floor(center.x) + dx + B.W) % B.W, j = x + y * B.W;
        if (s.ocean[j] && !E.ground(s,j,base)) continue;
        const now = E.comfort(s, j, base);
        if (now < 0.96) {
          const projected = mode === 'heat' || mode === 'cool' ? E.comfort(s,j,base,s.temperature[j] + (mode === 'heat' ? 0.16 : -0.16))
            : mode === 'wet' ? Math.max(now, Math.min(0.65, now + (0.23 - s.wet[j]) * 0.7))
            : Math.max(now, Math.min(0.65, now + (s.wet[j] - 0.65) * 0.7));
          advantage += Math.max(0, projected - now) + (projected > now + 0.04 ? 0.06 : 0);
        }
      }
      // At the outer edge a station opens new territory instead of overlapping the base.
      const score = advantage + gap * 0.045 + (mode === 'heat' || mode === 'cool' ? 0.03 : 0);
      if (score > top) { best = {tile:i, mode, benefit:advantage}; top = score; }
    }
    return best;
  }
  function baseGuardStatus(state, world, base) {
    const s = world.biosphere;
    const near = (s.communities ?? []).filter(c => c.active && c.people > 0 && c.civilization === base.civilization && baseDistance(s,c.home,base.tile) <= 12);
    const guards = Math.max(0,Math.floor(base.guards ?? 0)) + near.reduce((a,c)=>a + Math.max(0,c.guards||0),0);
    const foreigners = (s.communities ?? []).filter(c => c.active && c.civilization !== base.civilization && c.people >= 20
      && baseDistance(s,c.home,base.tile) <= 10 && E.sameRegion(s,c.home,base.tile,{profile:c.profile}));
    return { guards, nearby:near, foreigners };
  }
  // The robot-first settlement is not abandoned while the originating civilization can
  // still send colonists. A populated native world does not override this pre-arrival state.
  // Once the first crew has *landed successfully*, normal defense/capture rules resume.
  // Do not infer settlement from world.pop: it may belong entirely to the native nations.
  function basePreparationActive(state, world, base) {
    if (!world?.biosphere?.robotBases?.includes(base) || base.colonyCore || base.everSettled) return false;
    const id = base.civilization;
    if (!state.nations?.[id]) return false;
    const ownLanding = (world.biosphere.communities ?? []).some(c => c.active && c.people > 0
      && c.civilization === id && baseDistance(world.biosphere,c.home,base.tile) <= 12);
    if (ownLanding) return false;
    const inFlight = (state.ships ?? []).some(ship => ship.missionType === 'colony'
      && ship.civilization === id && ship.destination === world.id && ship.people > 0);
    return inFlight || state.worlds.some(source => people(source,id) > 0);
  }
  function baseGuard(state, world, base, withdraw = false) {
    if (!world?.biosphere?.robotBases?.includes(base) || base.civilization !== state.patron?.id) return 'Základna nepatří tvé civilizaci.';
    const status = baseGuardStatus(state, world, base);
    if (withdraw) {
      if (!(base.guards > 0) || !status.nearby.length) return 'V blízkosti není vlastní osada, do které lze obránce vrátit.';
      base.guards--; status.nearby[0].guards = (status.nearby[0].guards ?? 0) + 1;
      return '';
    }
    const source = status.nearby.find(c => c.guards > 0);
    if (!source) return 'Nejdříve vycvič obránce v blízké vlastní osadě. Robotická základna nevytváří vojáky sama.';
    if ((base.guards ?? 0) >= 6) return 'Základna má maximální počet šesti přidělených obránců.';
    source.guards--; base.guards = (base.guards ?? 0) + 1;
    return '';
  }
  function expandBase(state, world, base) {
    if (!world?.biosphere?.robotBases?.includes(base) || base.civilization !== state.patron?.id) return 'Základna nepatří tvé civilizaci.';
    if (!E.knows(state, base.civilization, 'robotics') || !E.knows(state, base.civilization, 'climate')) return 'Nejprve dokonči Robotiku a Regulaci klimatu.';
    if (E.energyBlock(state,base.civilization)) return 'Nejprve odemkni energetiku společnou vírou 10/10.';
    const s = world.biosphere, id = base.civilization, grid = E.grid(state,world,id);
    const ownPlants = s.power.plants.filter(p => p.civilization === id && s.damage[p.tile] < 0.62),
      ownStations = B.placedStations(s).filter(p => p.civilization === id && !p.destroyed);
    const estimated = ownPlants.reduce((sum,p) => sum+B.powerPotential(s,p.tile,p.kind,1),0);
    const needSource = ownPlants.length < 2 || Math.max(grid.output,estimated) < grid.demand + 4.2;
    if (!needSource && ownStations.length >= B.MAX_STATIONS) return 'Kolonie dosáhla limitu teraformerů.';
    if (!needSource && ownStations.length < B.MAX_STATIONS) {
      const destination = automaticStationSite(s,base);
      if (destination) {
        const kit = s.stations.some(st => st.tile < 0 && st.civilization === id);
        const charge = kit ? {energy:0,supplies:0} : {energy:70,supplies:24};
        if (!kit && !E.pay(state,world,id,charge,20)) return 'Teraformer potřebuje 70 E + 24 M a ponechání 20 E v baterii.';
        const station = kit ? s.stations.find(st=>st.tile<0&&st.civilization===id) : B.receiveStation(s);
        Object.assign(station,{tile:destination.tile,civilization:id,profile:base.profile,mode:destination.mode,pending:true,manualMode:false});
        B.reservePlot(s,destination.tile,0,B.STATION_TILE); E.focus(state,world,id);
        Orbit.event(state,world.name+' · Kolonie automaticky umístila teraformer ('+B.STATION_MODES[destination.mode]+') na okraj dostupné oblasti.','good');
        return '';
      }
    }
    if (s.power.plants.length >= 24) return 'Síť dosáhla limitu 24 elektráren.';
    const source = automaticSourceSite(s,base);
    if (!source) return 'V dosahu základny není bezpečné volné místo pro další zdroj nebo rozšíření teraformeru.';
    if (source.kind === 'wind') {
      const error=E.installWind(state,world,point(source.tile),id);
      if (error) return error;
    } else {
      if (!E.pay(state,world,id,{energy:16,supplies:12},20)) return 'Vodní turbína potřebuje 16 E + 12 M a ponechání 20 E.';
      B.commissionPlant(s,'hydro',source.tile,0,id,base.profile);
      const plant=s.power.plants[s.power.plants.length-1];plant.robot=true;
      Orbit.event(state,world.name+' · Kolonie postavila vodní turbínu u toku se spádem.','good');
    }
    return '';
  }
  function baseSecurityStep(state,world,dt) {
    const s=world.biosphere;
    for (const base of s.robotBases ?? []) {
      const status=baseGuardStatus(state,world,base);
      // Older saves may lack everSettled even when the first off-world landing happened.
      // Native modern towns have different civilization IDs and must not count here.
      if (!base.everSettled && (status.nearby.length || s.towns.some(town =>
        town.civilization === base.civilization && town.orbitalColony))) base.everSettled=true;
      const preparing=basePreparationActive(state,world,base);
      // Preparation remains a live, owned robot colony, not an undefended abandoned town.
      // Clear stale occupation threats imported from a save before this rule existed.
      if (preparing) base.occupation=null;
      const grid=E.grid(state,world,base.civilization);
      // Assigned guards consume supplies; at zero supplies they cannot remain forever.
      if (base.guards > 0) {
        const upkeep=base.guards * 0.025 * dt;
        if (grid?.supplies >= upkeep) grid.supplies -= upkeep;
        else {base.guardStarvation=(base.guardStarvation??0)+dt;if(base.guardStarvation>35){base.guards=Math.max(0,base.guards-1);base.guardStarvation=0;}}
        if (grid?.supplies >= upkeep) base.guardStarvation=0;
      }
      if (preparing || status.nearby.length || status.guards > 0 || !status.foreigners.length) { base.occupation=null;continue; }
      // No capture in the middle of a living allied settlement; those already use town conflict rules.
      const enemy=status.foreigners.sort((a,b)=>baseDistance(s,a.home,base.tile)-baseDistance(s,b.home,base.tile))[0];
      if (base.occupation?.civilization !== enemy.civilization) {
        base.occupation={civilization:enemy.civilization,since:state.time};
        Orbit.event(state,world.name+' · Nechráněná kolonie '+E.nationLabel(state,base.civilization)+' je ohrožena blízkým kmenem '+E.nationLabel(state,enemy.civilization)+'.','warn');
        continue;
      }
      if (state.time - base.occupation.since < 35) continue;
      const old=base.civilization, next=enemy.civilization;
      base.civilization=next; base.profile=enemy.profile; base.guards=0; base.occupation=null;
      const servedHere = tile => baseDistance(s,tile,base.tile)<=12 && !s.robotBases.some(other =>
        other !== base && other.civilization === old && baseDistance(s,tile,other.tile) < baseDistance(s,tile,base.tile));
      for (const plant of s.power.plants) if (plant.civilization === old && servedHere(plant.tile)
        && !B.infrastructureTown(s,s.towns[plant.town-1],old)) {
        plant.civilization=next;plant.profile=enemy.profile;plant.output=0;
      }
      for (const station of s.stations) if (station.civilization===old && station.tile>=0 && servedHere(station.tile)
        && !B.infrastructureTown(s,s.towns[s.plotTown[station.tile]-1],old)) {
        station.civilization=next;station.profile=enemy.profile;station.draw=station.load=station.fraction=0;station.pending=true;
      }
      // The local stocks stay on their respective grids: capture creates no currency.
      E.economies(state,world);E.focus(state,world,next);
      Orbit.event(state,world.name+' · Nebráněnou robotickou základnu převzala civilizace '+E.nationLabel(state,next)+' od '+E.nationLabel(state,old)+'. Zařízení zůstala na místě.','warn');
    }
  }
  function siteRank(s, i, profile, base) {
    const rank = E.comfort(s, i, profile) * 2 + s.plants[i] * 0.5 + s.soil[i] * 0.3;
    if (!base) return rank;
    const p = point(i), origin = point(base.tile), dx = Math.abs(p.x - origin.x);
    return rank - Math.hypot(Math.min(dx, B.W - dx), p.y - origin.y) * 0.06;
  }

  function thermalNeed(s, i, profile, temp) {
    if (profile === "cold" && s.ice[i] >= 0.16 && temp > B.FREEZE_AT) return "cool";
    if (E.comfort(s, i, profile, temp) >= 0.4) return "";
    return temp < E.climateTarget(profile) ? "heat" : "cool";
  }

  function seasonalProblem(s, i, profile, temp) {
    const need = thermalNeed(s, i, profile, temp);
    if (need === "heat") return "oblast příliš vychladne";
    if (need === "cool") return profile === "cold" && s.ice[i] >= 0.16 ? "může roztát sníh nebo nosný led" : "oblast se přehřívá";
    if (profile === "cold" && s.ice[i] < 0.16) return "chybí sníh nebo pevný led";
    if (E.floodDepth(s, i, profile) >= (profile === "warm" ? 0.20 : 0.27)) return "hrozí zaplavení";
    const moisture = E.moisture(s, i, profile), tolerance = E.wetTolerance(s, i, profile);
    if (profile === "warm" && tolerance < 0.75) return "půda je příliš podmáčená";
    if (profile === "temperate" && moisture < 0.12) return "půda je příliš suchá";
    const crops = profile === "warm" ? (0.28 + 0.08 * B.clampValue(s.wet[i] / 0.25, 0, 1)) * 2.4
      : B.clampValue((moisture - 0.11) * 1.9, 0, 1) * 0.9 + moisture * 0.3;
    return Math.max(crops * tolerance, E.forage(s, i, profile)) < 0.45 ? "chybí podmínky pro obživu" : "";
  }

  function assessment(state, world, id, profile, fresh = false) {
    const s = world.biosphere, actor = {profile};
    const base = s.robotBases?.find(b => b.civilization === id && b.profile === profile);
    const {temperatures, reports} = seasonalForecast(state, world);
    const reportKey = id + ":" + profile;
    if (!fresh && reports.has(reportKey)) return reports.get(reportKey);
    const report = value => { reports.set(reportKey, value); return value; };
    const usable = new Uint8Array(SIZE);
    const phase = ["V horké části oběhu", "Během oběhu", "Ve studené části oběhu"];
    let best = -1, score = -Infinity, bestIssue = "", ready = -1, readyScore = -Infinity;
    for (let i = 0; i < SIZE; i++) {
      const home = s.towns[s.plotTown[i] - 1];
      const occupied = s.urban[i] && !(s.urban[i] === 4 && home?.civilization === id && home.profile === profile && !home.abandoned);
      if (occupied || !territoryOpen(s, i, id) || !landingGround(s, i, actor, true)) continue;
      const safety = s.urban[i] ? 0 : B.settlementSafety(s, i, actor);
      if (!Number.isFinite(safety)) continue;
      const hot = seasonalProblem(s, i, profile, temperatures[0][i]);
      const cold = seasonalProblem(s, i, profile, temperatures[2][i]);
      const middle = !hot && !cold && seasonalProblem(s, i, profile, temperatures[1][i]);
      const now = !hot && !cold && !middle && seasonalProblem(s, i, profile, s.temperature[i]);
      const issue = hot || cold || middle || now;
      if (!issue) usable[i] = 1;
      const rank = siteRank(s, i, profile, base) + safety + (issue ? 0 : 3);
      if (rank > score) {
        best = i; score = rank;
        bestIssue = [hot && phase[0] + " " + hot + ".", cold && cold !== hot && phase[2] + " " + cold + ".",
          middle && phase[1] + " " + middle + ".", now && "Právě teď " + now + "."].filter(Boolean).join(" ");
      }
    }
    if (best < 0) return report({level:"blocked", tile:-1, issue:"Pro tyto obyvatele teď chybí bezpečné místo k přistání."});
    const queue = new Uint16Array(SIZE);
    for (let i = 0; i < SIZE; i++) {
      if (!usable[i]) continue;
      usable[i] = 0; queue[0] = i;
      let end = 1, bestTile = i, bestRank = -Infinity;
      for (let head = 0; head < end; head++) {
        const tile = queue[head], rank = siteRank(s, tile, profile, base)
          + (s.urban[tile] ? 0 : B.settlementSafety(s, tile, actor));
        if (rank > bestRank) { bestTile = tile; bestRank = rank; }
        for (const neighbors of s.neighbors) {
          const next = neighbors[tile];
          if (!usable[next]) continue;
          usable[next] = 0; queue[end++] = next;
        }
      }
      if (end >= 6 && bestRank > readyScore) { ready = bestTile; readyScore = bestRank; }
    }
    const orbitIssue = world.orbitAlert !== "ok" ? (world.orbitLabel || "Dráha se mění").toLocaleLowerCase("cs") : "";
    if (ready >= 0 && !orbitIssue) return report({level:"ready", tile:ready, issue:"Vhodná oblast i v krajních částech oběhu."});
    return report({level:"risk", tile:ready >= 0 ? ready : best,
      issue: [orbitIssue ? "Pozor na dráhu: " + orbitIssue + "." : "", ready < 0 ? bestIssue || "Vhodná oblast je příliš malá pro rozvoj osady." : ""].filter(Boolean).join(" ")});
  }
  function site(state, world, id, allowIce = false, residentProfile = state.nations[id]?.profile ?? "temperate", forSettlement = false, forBase = false) {
    const s = world.biosphere, actor = { profile: residentProfile }, base = s.robotBases?.find(b => b.civilization === id);
    let best = -1, score = -Infinity;
    for (let i = 0; i < SIZE; i++) {
      if (s.urban[i] || !landingGround(s, i, actor, allowIce) || forBase && s.robotBases.some(base => base.tile === i)) continue;
      if (!territoryOpen(s, i, id)) continue;
      const safety = forSettlement ? B.settlementSafety(s, i, actor) : 0;
      if (!Number.isFinite(safety)) continue;
      const value = siteRank(s, i, residentProfile, base) + safety;
      if (value > score) { score = value; best = i; }
    }
    return best;
  }
  function prepareBase(state, ship, world) {
    const s = world.biosphere, id = ship.civilization, actor = { profile: E.PROFILES[ship.profile] ? ship.profile : state.nations[id].profile };
    s.robotBases ??= [];
    const home = site(state, world, id, true, actor.profile, false, true); if (home < 0) return "Roboty nenašly bezpečnou pevninu.";
    const origin = point(home), used = new Set();
    const nearby = [];
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = Math.floor(origin.x + dx + B.W) % B.W, y = Math.floor(origin.y + dy); if (y < 0 || y >= B.H) continue;
      const i = x + y * B.W, claimant = s.towns[s.claims[i] - 1];
      if (!s.urban[i] && landingGround(s, i, actor, true) && (!claimant || claimant.civilization === id)
        && (actor.profile !== "cold" || E.sameRegion(s, home, i, actor))) nearby.push(i);
    }
    if (nearby.length < 3) return "Pro základnu chybí tři sousední stavební místa.";
    const base = { civilization: id, profile: actor.profile, tile: home, founded: state.time, date: E.dateAt(state), guards: 0 };
    // Plan on the untouched terrain first: a failed landing must not leave phantom infrastructure.
    const sources = [];
    for (let n=0;n<2;n++) {
      const next = automaticSourceSite(s,base,used);
      if (!next) break;
      sources.push(next); used.add(next.tile);
    }
    let destination = automaticStationSite(s,base,used);
    // A small viable island may have no outer fringe; use a safe nearby fallback.
    if (!destination) {
      const fallback=nearby.find(i=>!used.has(i));
      if (fallback!==undefined) destination={tile:fallback,mode:climateMode(s,fallback,actor.profile)};
    }
    if (sources.length<2 || !destination) return 'Roboty nenašly vhodná místa pro dva obnovitelné zdroje a teraformer.';
    s.robotBases.push(base);
    const g = E.grid(state, world, id); g.reserve = Math.min(B.POWER_LIMIT,g.reserve+20); g.supplies = Math.min(100, g.supplies + ship.cargo);
    for (const source of sources) {
      B.commissionPlant(s, source.kind, source.tile, 0, id, actor.profile);
      s.power.plants[s.power.plants.length-1].robot=true;
    }
    const station = B.receiveStation(s);
    Object.assign(station,{tile:destination.tile,civilization:id,profile:actor.profile,mode:destination.mode,pending:true,manualMode:false});
    B.reservePlot(s,destination.tile,0,B.STATION_TILE); E.focus(state,world);
    return "";
  }
  function passengerGroups(state, ship) {
    const groups = [], total = (ship.residents ?? []).filter(g => E.PROFILES[g.profile] && Number.isFinite(g.people) && g.people > 0).reduce((sum,g) => sum+g.people,0);
    if (total > 0) for (const g of ship.residents) {
      if (!E.PROFILES[g.profile] || !(g.people > 0) || !Number.isFinite(g.people)) continue;
      const group = groups.find(x => x.profile === g.profile), count = ship.people * g.people / total;
      if (group) group.people += count; else groups.push({profile:g.profile,people:count});
    }
    else groups.push({profile:E.PROFILES[ship.profile] ? ship.profile : state.nations[ship.civilization]?.profile ?? 'temperate',people:ship.people});
    return groups;
  }
  function colonize(state, ship, world) {
    let landed = 0, failed = 0, failure = "";
    for (const group of passengerGroups(state,ship)) {
      if (!(group.people > 0)) continue;
      const part = {...ship, ...group, recordId:undefined, targetName:world.name, destination:world.id,
        cargo:(ship.cargo ?? 0)*group.people/Math.max(1,ship.people)};
      const issue = settleProfile(state,part,world);
      if (issue) { failed += group.people; failure = issue; lost(state, part, issue); }
      else landed += group.people;
    }
    const r = record(state,ship);
    if (r) {
      r.status = landed > 0 ? 'landed' : 'lost';
      r.ended = state.time;
      r.note = landed > 0 ? 'Kolonie založena nebo posílena' + (failed > 0 ? ' · ' + Math.floor(failed) + ' členů posádky nepřistálo. ' + failure : '') : failure || 'Na cíli není bezpečné přistání.';
    }
    return landed > 0;
  }
  function settleProfile(state, ship, world) {
    const id = ship.civilization; if (!state.nations[id]) return "Civilizace výpravy není dostupná.";
    const s = world.biosphere, first = world.pop <= 0, foreign = members(world,id).length < (s.communities ?? []).filter(c => c.active).length;
    const own = members(world, id).filter(c => c.profile === ship.profile && (!ship.surveyedLanding || E.ground(s, c.home, c)));
    let founded;
    if (own.length) {
      const total = own.reduce((sum,c) => sum+c.people,0);
      for (const c of own) c.people += ship.people * c.people / Math.max(1, total);
    } else {
      const report = ship.surveyedLanding ? assessment(state, world, id, ship.profile, true) : null;
      const home = report ? report.tile : site(state, world, id, true, ship.profile, true);
      if (home < 0) {
        const i = ship.colonySite;
        const cause = Number.isInteger(i) && i >= 0 && i < SIZE ? E.centerHazard(s, ship, i) : "";
        return "Při příletu se nenašlo bezpečné místo k přistání."
          + (cause ? " Plánované místo: " + cause.toLocaleLowerCase("cs") + "." : "");
      }
      if (ship.profile !== "cold") { s.ice[home] = 0; s.water[home] = 0; }
      E.invalidateGround(s);
      const realm = [3, ...Array.from({ length: 60 }, (_, i) => i + 4)].find(n => !s.towns.some(t => t.realm === n && t.civilization !== id && !t.abandoned)) ?? 3;
      s.realmCivilizations ??= {}; s.realmCivilizations[realm] = id; s.nextCommunityId ??= 1;
      const town = { home, realm, civilization: id, profile: ship.profile, orbitalColony: true, count: 1, weight: 1, founded: s.time,
        importedEra: 6, cold: 0, factory: -1, walkers: [], nextJourney: s.time + 15, communityId: s.nextCommunityId++ };
      s.towns.push(town); B.reservePlot(s, home, s.towns.length, 4);
      s.communities ??= []; s.communities.push({ id: town.communityId, civilization: id, realm, town: s.towns.length - 1, home,
        people: ship.people, active: true, nature: state.nations[id].nature, profile: town.profile, food: 80, faith: E.science(state, id).faith,
        guards: 0, populationFactor: 1, job: null, nextAuto: s.time + 10, hungryAt: 0 });
      s.cultures ??= {}; s.cultures[realm] = state.nations[id].nature;
      founded = { kind: "settlement-founded", civilization: id, worldId: world.id,
        communityId: town.communityId, settlement: "Osada " + town.communityId, tile: home };
    }
    world.pop += ship.people; s.populationTotal = world.pop;
    if (first) { world.colony = true; s.colonialCivilization = id; s.colonizedAt = s.time; s.colony = s.towns.find(t => t.civilization === id).home; }
    // Even direct settlement without a preceding robotic mission establishes a durable colony core.
    // It does not get free generators, fuel or terraformers; existing infrastructure stays persistent.
    const bases = s.robotBases ??= [];
    const establishedBase = bases.find(b => b.civilization === id && members(world,id).some(c => baseDistance(s,b.tile,c.home) <= 12));
    // A successful landing ends the preparation protection for this nation's outposts
    // on the target world, even when climatic hazards forced a landing farther away.
    // Keep the flag after the last inhabitants die: abandoned bases are capturable again.
    for (const ownedBase of bases) if (ownedBase.civilization === id) {
      ownedBase.everSettled=true;
      ownedBase.occupation=null;
    }
    if (!establishedBase) {
      const home=members(world,id).find(c=>c.profile===ship.profile)?.home;
      if (Number.isInteger(home)) bases.push({civilization:id,profile:ship.profile,tile:home,founded:state.time,date:E.dateAt(state),guards:0,colonyCore:true});
    }
    const g = E.grid(state, world, id); g.reserve = Math.max(g.reserve, 20); g.supplies = Math.min(100, g.supplies + ship.cargo);
    Patronage.sync(state, world); E.focus(state, world);
    planetStage(state, id);
    Orbit.event(state, world.name + " · Přistála civilizace " + E.nationLabel(state,id) + " s " + Math.floor(ship.people).toLocaleString("cs-CZ") + " obyvateli · " + E.profile(ship.profile).climate + (foreign ? ". Místní národy zůstávají samostatné; přílet je nepřipojuje." : "."), "good", founded);
    return "";
  }
  function returnTo(state, ship, from, type, cargo = 0) {
    const r = record(state, ship), home = state.worlds.find(p => p.id === r.origin && E.owns(state, p, ship.civilization))
      ?? state.worlds.find(p => E.owns(state, p, ship.civilization));
    if (!home) { lost(state, ship, "Chybí přeživší vlastní svět pro návrat."); return; }
    r.status = "return"; r.note = "Návrat na " + home.name;
    Orbit.launchManaged(state, from, home, { missionType: type, recordId: r.id, civilization: ship.civilization,
      sampleWorld: ship.sampleWorld ?? from.id, sampleName: ship.sampleName ?? from.name, sampleProfile: ship.sampleProfile ?? from.biosphere.bioProfile,
      people: 0, cargo });
  }
  function arrive(state, ship, world) {
    init(state); const r = record(state, ship), id = ship.civilization;
    if (!state.nations[id]) { lost(state, ship, "Původní civilizace zanikla."); return; }
    if (ship.missionType === "explore") {
      const pool = E.science(state, id); pool.climateKnown[world.id] = world.biosphere.bioProfile;
      if (r) r.note = "Vzorky odebrány; rozhoduje bezpečný návrat.";
      returnTo(state, ship, world, "samples"); return;
    }
    if (ship.missionType === "samples") {
      const pool = E.science(state, id), fresh = !pool.discoveries[ship.sampleWorld];
      if (fresh) pool.discoveries[ship.sampleWorld] = { name: ship.sampleName, profile: ship.sampleProfile, date: E.dateAt(state) };
      if (r) { r.status = "returned"; r.ended = state.time; r.note = fresh ? "Vzorek doručen · hodnocení osídlení je dostupné" : "Opakované vzorky · svět už byl prozkoumán"; }
      Orbit.event(state, E.nationLabel(state,id) + " · Vzorky ze světa " + ship.sampleName + " dorazily domů." + (fresh ? " Hodnocení osídlení je dostupné." : " Tento svět je již prozkoumaný."), "good"); return;
    }
    if (ship.missionType === "base") {
      const issue = prepareBase(state, ship, world); if (issue) { lost(state, ship, issue); return; }
      if (r) { r.status = 'landed'; r.note = 'Kolonie založena · dvě automaticky vybrané elektrárny a teraformer'; }
      Orbit.event(state,world.name+' · Kolonie '+E.nationLabel(state,id)+' založena: dva vhodně rozmístěné zdroje energie a teraformer. Správa je dostupná v Osadách.','good');return;
    }
    if (ship.missionType === "colony") { colonize(state, ship, world); return; }
    if (ship.missionType === "supply") {
      const recipient = ship.recipientCivilization || id, g = E.grid(state, world, recipient);
      if (!g || !E.owns(state, world, recipient)) { lost(state, ship, "Cíl nemá vlastní sklad nebo robotickou základnu."); return; }
      const delivered = Math.min(ship.cargo, 100 - g.supplies); g.supplies += delivered;
      const base = world.biosphere.robotBases?.find(b => b.civilization === recipient);
      if (base && delivered > 0) base.supplied = true;
      if (r) { r.status = "landed"; r.delivered = delivered; r.note = "Doručeno " + Math.floor(delivered) + " M"; }
      if (recipient !== id) changeRelation(state, id, recipient, 8);
      Orbit.event(state, world.name + " · Doručeno " + Math.floor(delivered) + " M pro " + E.nationLabel(state,recipient) + ".", "good"); return;
    }
    if (ship.missionType === "trade") {
      const other = missionPartner(state, world, id, ship.partner ?? r?.partner); if (!other || relation(state, id, other) < 0) { lost(state, ship, "Obchodní partner již výměnu nepřijímá."); return; }
      const g = E.grid(state, world, other); g.supplies = Math.max(0, Math.min(100, g.supplies + ship.cargo - 8));
      g.tradeUntil = state.time + 120; g.tradeBonus = 0.12;
      changeRelation(state, id, other, 8); returnTo(state, ship, world, "trade-return", 8); return;
    }
    if (ship.missionType === "trade-return") {
      const g = E.grid(state, world, id); if (!g) { lost(state, ship, "Domovský sklad už není dostupný."); return; }
      g.supplies = Math.min(100, g.supplies + ship.cargo); g.tradeUntil = state.time + 120; g.tradeBonus = 0.12;
      if (r) { r.status = "returned"; r.note = "Obchod dokončen · výroba materiálu +0,12 M/s po 120 s"; } return;
    }
    if (ship.missionType === "attack") {
      const enemy = missionPartner(state, world, id, ship.partner ?? r?.partner), target = members(world, enemy).sort((a, b) => a.guards - b.guards)[0];
      if (!target) { lost(state, ship, "Cílová civilizace již nemá město."); return; }
      changeRelation(state, id, enemy, -60);
      world.biosphere.spaceConflicts ??= []; world.biosphere.spaceConflicts.push({ civilization: id, enemy, targetId: target.id, began: state.time, recordId: r.id, people: ship.people, residents: structuredClone(passengerGroups(state,ship)), troops: r.troops });
      r.status = "battle"; r.note = "Výsadek bojuje u města " + (target.name || target.id); return;
    }
  }
  function supplyBlock(state, from, to, amount, reserve = 25, id = state.patron?.id) {
    if (!Number.isInteger(amount) || amount < 1 || amount > 60) return "Vyber 1 až 60 M.";
    if (!Number.isInteger(reserve) || reserve < 0 || amount + reserve > 100) return "Náklad a rezerva se musí vejít do 100 M.";
    if (!to?.biosphere || from === to || !E.owns(state, from, id)) return "Vyber vlastní zdroj a jiný svět se skladem.";
    if (!E.spaceflight(state, from, id)) return E.portStatus(state, from, id);
    const recipient = E.owns(state, to, id) ? id : targetOwner(state, to);
    if (!recipient) return "Prázdný svět nejprve vybav robotickou základnou.";
    const g = E.grid(state, from, id);
    if (g.reserve < 28 + 35 || g.supplies < amount + reserve) return "Chybí 28 E + " + amount + " M a nastavená místní rezerva.";
    if (state.ships.length >= 14) return "Na cestě je již 14 lodí.";
    return "";
  }
  function supply(state, from, to, amount = 44, reserve = 25, id = state.patron?.id) {
    init(state); const issue = supplyBlock(state, from, to, amount, reserve, id); if (issue) return issue;
    if (!E.pay(state, from, id, { energy: 28, supplies: amount }, 35)) return "Místní prostředky se změnily.";
    const r = { id: state.nextExpeditionId++, type: "supply", civilization: id, origin: from.id, originName: from.name,
      target: to.id, targetName: to.name, status: "out", began: state.time, date: E.dateAt(state), note: amount + " M na cestě", people: 0 };
    state.expeditions.push(r);
    Orbit.launchManaged(state, from, to, { missionType: "supply", recordId: r.id, civilization: id, recipientCivilization: E.owns(state, to, id) ? id : targetOwner(state, to), cargo: amount });
    Orbit.event(state, from.name + " → " + to.name + " · Odstartovalo " + amount + " M."); return "";
  }
  function dispatchSupplies(state) {
    init(state);
    for (const plan of state.supplyRoutes) {
      const id = plan.civilization ??= state.patron?.id ?? 0;
      const from = state.worlds.find(p => p.id === plan.from), to = state.worlds.find(p => p.id === plan.to), backup = state.worlds.find(p => p.id === plan.backup);
      if (!to || !E.owns(state, to, id)) continue;
      const g = E.grid(state, to, id), inbound = state.ships.filter(s => s.civilization === id && s.destination === to.id && s.missionType === "supply");
      if (inbound.length >= 2) continue;
      const amount = plan.amount ?? 44;
      const source = [from, backup].find(p => p && E.knows(state, id, "navigation")
        && !supplyBlock(state, p, to, amount, plan.reserve, id)
        && keepsExpansionBudget(state, p, id, 28, amount));
      if (!source) continue;
      const projected = g.supplies + inbound.reduce((sum, s) => sum + s.cargo, 0) + Math.min(0, g.supplyRate) * Orbit.flightTime(source, to);
      if (projected <= 100 - (plan.amount ?? 44)) supply(state, source, to, plan.amount ?? 44, plan.reserve, id);
    }
  }
  function route(state, from, to, backup, amount, reserve, id = state.patron?.id) {
    if (!E.knows(state, id, "navigation") || !E.owns(state, from, id) || !E.owns(state, to, id) || from === to) return "Linka potřebuje Vesmírný program a dva vlastní světy.";
    if (backup && (!E.owns(state, backup, id) || backup === from || backup === to)) return "Záloha musí být třetí vlastní svět.";
    if (!Number.isInteger(amount) || amount < 1 || amount > 60 || !Number.isInteger(reserve) || reserve < 0 || reserve > 100 - amount) return "Náklad a ponechaná rezerva musí dohromady vejít do 100 M.";
    const plan = { from: from.id, to: to.id, backup: backup?.id ?? null, amount, reserve, civilization: id };
    const i = state.supplyRoutes.findIndex(p => p.to === to.id && p.civilization === id); if (i < 0) state.supplyRoutes.push(plan); else state.supplyRoutes[i] = plan;
    Orbit.event(state, "Linka " + from.name + " → " + to.name + " bude vozit " + amount + " M.", "good"); return "";
  }
  const PROJECTS = { auto: "Automatický rozvoj", economy: "Soběstačné zázemí",
    port: "Kosmodrom z místních zdrojů", import: "Kosmodrom s dovozem materiálu" };

  function keepsExpansionBudget(state, world, id, energy, supplies) {
    if (state.nations[id]?.expansion?.from !== world.id) return true;
    const g = E.grid(state, world, id);
    return g.reserve - energy >= MISSIONS.colony.energy + 35 && g.supplies - supplies >= MISSIONS.colony.supplies;
  }

  function planetStage(state, id = state.patron?.id) {
    const nation = state.nations?.[id];
    if (!nation) return "local";
    const worlds = state.worlds.filter(world => people(world, id) > 0);
    const port = worlds.some(world => E.builtPort(state, world, id));
    if (worlds.length >= 2 && port) nation.planetary = true;
    return nation.planetary ? (port ? "planetary" : "recovery") : "local";
  }

  function setProject(state, world, kind, reserve, id = state.patron?.id) {
    if (!world || !state.worlds.includes(world) || !people(world, id) || !Object.hasOwn(PROJECTS, kind))
      return "Vyber vlastní obydlenou planetu.";
    if (planetStage(state, id) === "local") return "Planetární projekty otevře první obydlená kolonie a vlastní kosmodrom.";
    if (!Number.isInteger(reserve) || reserve < 0 || reserve > 65) return "Zadej rezervu od 0 do 65 M.";
    const g = E.grid(state, world, id);
    g.project = kind; g.exportReserve = reserve;
    if (kind === "port" || kind === "import") g.program.manualPause = false;
    else if (kind === "economy" && g.program.active) { g.program.active = false; E.refreshScience(state, id); }
    return "";
  }

  function projectStatus(state, world, id = state.patron?.id) {
    const g = E.grid(state, world, id);
    if (!g || !people(world, id)) return "";
    if (g.project === "economy") {
      const ready = g.output - g.demand >= E.PORT_DRAW && g.supplyRate >= 0 && g.supplies >= 25;
      return ready ? "Soběstačné zázemí · připraveno" : "Soběstačné zázemí · rozvoj místní sítě a skladu";
    }
    if (g.project === "import") {
      const inbound = state.ships.some(ship => ship.missionType === "supply" && ship.destination === world.id && ship.civilization === id);
      return PROJECTS.import + " · " + (inbound ? "materiál na cestě" : E.portStatus(state, world, id));
    }
    return g.project === "port" ? PROJECTS.port + " · " + E.portStatus(state, world, id) : E.portStatus(state, world, id);
  }

  function developProject(state, world, sources, id, protectedWorld) {
    const g = E.grid(state, world, id);
    const kind = g.project;
    if (!kind || kind === "auto" || world === protectedWorld) return;
    if (kind === "import" && g.supplies < 30
      && !state.supplyRoutes.some(plan => plan.to === world.id && plan.civilization === id)
      && !state.ships.some(ship => ship.missionType === "supply" && ship.destination === world.id && ship.civilization === id)) {
      const from = sources.find(source => source !== protectedWorld && !supplyBlock(state, source, world, 35, E.grid(state, source, id).exportReserve ?? 25, id));
      if (from) supply(state, from, world, 35, E.grid(state, from, id).exportReserve ?? 25, id);
    }
    const free = members(world, id).find(c => !c.job);
    const needsPower = g.output - g.demand < (g.program.active ? 0.1 : 1.44);
    if (free && needsPower && !E.order(state, world, free, "energy", null, true)) return;
    if (free && kind !== "import" && g.supplies < 45 && g.supplyRate < 0.08
      && !E.order(state, world, free, "mine", null, true)) return;
    if (kind !== "economy" && !g.program.active && !g.program.manualPause && g.output > g.demand + 0.15
      && !E.spaceBlock(state, world, id)) E.spaceProgram(state, world, id, true);
  }

  function step(state, dt) {
    init(state);
    for (const world of state.worlds) if (world.biosphere) {
      const s = world.biosphere;
      baseSecurityStep(state,world,dt);
      for (const m of s.monuments) if (m.builtAt !== null && !m.date) m.date = E.dateAt(state, s.originTime + m.builtAt);
      for (const conflict of s.spaceConflicts ?? []) {
        if (conflict.finished || state.time - conflict.began < 6) continue;
        conflict.finished = true;
        const target = s.communities.find(c => c.id === conflict.targetId && c.civilization === conflict.enemy && c.active);
        const r = state.expeditions.find(r => r.id === conflict.recordId);
        if (!target) { state.stats.losses += conflict.people; state.stats.crewLost += conflict.people; if (r) { r.status = "lost"; r.note = "Cíl výsadku zanikl."; } continue; }
        const strength = conflict.troops * 1.8, defense = 1 + target.guards * 0.9 + Math.min(4, Math.sqrt(target.people / 10000));
        if (strength > defense) {
          const realm = s.towns.find(t => t.civilization === conflict.civilization)?.realm ?? [3,4,5,6,7,8,9,10].find(realm => !s.towns.some(t => t.realm === realm)) ?? 10;
          Patronage.transferTown(state, world, target.town, conflict.civilization, realm);
          colonize(state, {civilization:conflict.civilization, people:conflict.people, residents:conflict.residents, cargo:0}, world); Patronage.commitPopulation(world);
          target.guards = 1; target.job = null; s.cultures[realm] = state.nations[conflict.civilization].nature;
          if (r) { r.status = "landed"; r.note = "Město převzato. Jeho původní obyvatelé zůstávají."; }
          Orbit.event(state, world.name + " · " + E.nationLabel(state,conflict.civilization) + " převzala město " + (target.name || target.id) + ".", "bad");
        } else {
          target.guards = Math.max(0, target.guards - 1); state.stats.losses += conflict.people; state.stats.crewLost += conflict.people;
          if (r) { r.status = "lost"; r.note = "Obránci výsadek odrazili."; }
          Orbit.event(state, world.name + " · Obránci odrazili vojenskou výpravu.", "bad");
        }
      }
      s.spaceConflicts = (s.spaceConflicts ?? []).filter(c => !c.finished || state.time - c.began < 12);
    }
    for (const route of state.tradeRoutes) {
      if (state.time < (route.next ?? 0) || state.expeditions.some(r => r.civilization === route.civilization && r.origin === route.from && r.target === route.to && r.type === "trade" && ["out", "return"].includes(r.status))) continue;
      let from = state.worlds.find(p => p.id === route.from);
      const to = state.worlds.find(p => p.id === route.to);
      if (!to) continue;
      route.partner ??= targetOwner(state, to, route.civilization) || undefined;
      const options = { partner: route.partner };
      if (!from || !E.owns(state, from, route.civilization) || !E.spaceflight(state, from, route.civilization)) {
        from = state.worlds.find(p => !block(state, p, to, "trade", route.civilization, options));
        if (from) route.from = from.id;
      }
      route.next = state.time + 60;
      if (!block(state, from, to, "trade", route.civilization, options)
        && keepsExpansionBudget(state, from, route.civilization, MISSIONS.trade.energy, MISSIONS.trade.supplies))
        start(state, from, to, "trade", route.civilization, options);
    }
    if (state.time < (state.nextNationAI ?? 0)) return;
    state.nextNationAI = state.time + 3;
    for (const nation of Object.values(state.nations)) {
      if (state.time < (nation.nextAI ?? 0)) continue;
      nation.nextAI = state.time + 8;
      const worlds = state.worlds.filter(p => E.owns(state, p, nation.id) && people(p, nation.id) > 0);
      if (!worlds.length) continue;
      planetStage(state, nation.id);
      const pool = E.science(state, nation.id);
      const home = worlds.find(p => E.builtPort(state, p, nation.id)) ?? worlds.find(p => E.civEra(state, p, nation.id) >= 5) ?? worlds[0];
      const dispatchReady = !state.ships.some(ship => ship.civilization === nation.id && ship.missionType !== "supply");
      const targets = state.worlds.filter(p => p.biosphere && !worlds.includes(p));
      const expansion = targets.filter(p => !nation.noSettlement?.includes(p.id));
      const plan = dispatchReady && planColony(state, nation.id, worlds, expansion, pool);
      nation.expansion = plan ? { from: plan.from.id, to: plan.to.id } : null;
      if (plan && !start(state, plan.from, plan.to, "colony", nation.id, {profile:plan.profile})) { nation.expansion = null; continue; }
      const protectedWorld = plan?.from;
      for (const world of worlds) developProject(state, world, worlds, nation.id, protectedWorld);
      if (protectedWorld) continue;
      if (prepareRobotOutpost(state, nation.id, worlds, expansion, pool)) continue;
      const list = members(home, nation.id), free = list.find(c => !c.job), g = E.grid(state, home, nation.id);
      const underPressure = worlds.some(world => Warfare.tensions(state, world, nation.id).length);
      const advanced = underPressure ? ["robotics", "colonization"] : ["colonization", "robotics"];
      const next = pool.faith >= 10 && !pool.science.active && !pool.science.manualPause
        ? ["navigation", "space", ...advanced, "climate", "agriculture", "power", "military"]
          .find(key => !E.knows(state, nation.id, key) && E.TECH[key].requires.every(required => E.knows(state, nation.id, required))) : null;
      if (free && E.civEra(state, home, nation.id) >= 5 && (!g.project || g.project === "auto")) {
        if (g.output - g.demand < (g.program.active || pool.science.active ? 0.15 : 1.45)
          && !E.order(state, home, free, "energy", null, true)) continue;
        const pending = worlds.reduce((total, world) => total + members(world,nation.id).filter(c => c.job?.kind === "science").length * 3, 0);
        if (next && !pool.science.funded[next] && pool.points + pending < E.TECH[next].vb && g.output > g.demand
          && !E.order(state, home, free, "science", null, true)) continue;
        if (g.supplies < 40 && g.supplyRate < 0.08 && !E.order(state, home, free, "mine", null, true)) continue;
      }
      if (next && !E.researchBlock(state, home, next, nation.id)) { E.research(state, home, next, nation.id, true); continue; }
      if ((!g.project || g.project === "auto") && !g.program.active && !g.program.manualPause && !E.spaceBlock(state, home, nation.id)) {
        E.spaceProgram(state, home, nation.id, true); continue;
      }
      const launchWorld = worlds.find(p => E.spaceflight(state, p, nation.id));
      if (!launchWorld || !dispatchReady) continue;
      const unknown = targets.find(p => !pool.discoveries[p.id]);
      if (unknown && !block(state, launchWorld, unknown, "explore", nation.id)) { start(state, launchWorld, unknown, "explore", nation.id); continue; }
      const profile = crewProfiles(launchWorld, nation.id)[0];
      const target = expansion.find(p => pool.discoveries[p.id] && !block(state, launchWorld, p, "base", nation.id)
        && assessment(state, p, nation.id, profile).level === "risk" && site(state, p, nation.id, true, profile) >= 0);
      if (target) { start(state, launchWorld, target, "base", nation.id, {profile}); continue; }
      const enemy = state.worlds.find(p => p !== launchWorld && targetOwner(state, p, nation.id) && relation(state, nation.id, targetOwner(state, p, nation.id)) < 0);
      if (enemy && nation.nature === "hunter" && E.knows(state, nation.id, "colonization")) {
        if (free && list.reduce((n, c) => n + c.guards, 0) < 4 && !E.actionBlock(state, home, free, "guard", null, true)) E.order(state, home, free, "guard", null, true);
        else if (!block(state, launchWorld, enemy, "attack", nation.id)) { start(state, launchWorld, enemy, "attack", nation.id); continue; }
      }
      const partner = state.worlds.find(p => p !== launchWorld && targetOwner(state, p, nation.id) && relation(state, nation.id, targetOwner(state, p, nation.id)) >= 0);
      if (partner && !block(state, launchWorld, partner, "trade", nation.id)) start(state, launchWorld, partner, "trade", nation.id);
    }
  }
  function outpostSupplyIssue(state, world, id) {
    const base = world?.biosphere?.robotBases?.find(b => b.civilization === id);
    if (!base || people(world, id) > 0) return "";
    const supplied = base.supplied || state.expeditions.some(r => r.type === "supply" && r.status === "landed"
      && r.civilization === id && r.target === world.id && r.began >= base.founded && (r.delivered ?? 1) > 0);
    if (supplied && E.grid(state, world, id).supplies >= OUTPOST_STOCK) return "";
    return state.ships.some(s => s.missionType === "supply" && s.destination === world.id && s.recipientCivilization === id)
      ? "Materiál pro robotickou základnu je na cestě."
      : "Robotická základna čeká na dovoz materiálu.";
  }

  function outpostBuildingSite(s, base, near) {
    const origin = point(base.tile), reference = point(near);
    let best = -1, score = Infinity;
    for (let dy = -11; dy <= 11; dy++) for (let dx = -11; dx <= 11; dx++) {
      const y = Math.floor(origin.y) + dy, x = (Math.floor(origin.x) + dx + B.W) % B.W;
      if (y < 0 || y >= B.H || Math.hypot(dx, dy) >= 12) continue;
      const i = x + y * B.W, xGap = Math.abs(x + 0.5 - reference.x);
      const rank = Math.hypot(Math.min(xGap, B.W - xGap), y + 0.5 - reference.y) + Math.hypot(dx, dy) * 0.25;
      const claim = s.towns[s.claims[i] - 1];
      if (rank >= score || s.urban[i] || s.noBuild[i] || B.worksiteReserved(s, i) || !E.ground(s, i, base)
        || claim && claim.civilization !== base.civilization) continue;
      best = i; score = rank;
    }
    return best;
  }

  function prepareRobotOutpost(state, id, sources, targets, pool) {
    for (const world of targets) {
      const s = world.biosphere, base = s.robotBases?.find(b => b.civilization === id);
      if (!base || !pool.discoveries[world.id]) continue;
      const profile = E.PROFILES[base.profile] ? base.profile : state.nations[id].profile;
      const g = E.grid(state, world, id), survey = assessment(state, world, id, profile);
      const stations = B.placedStations(s).filter(station => station.civilization === id);
      const mode = survey.level === "risk" && world.orbitAlert === "ok" && stations.length < 2 && E.knows(state, id, "climate")
        ? seasonalForecast(state, world).temperatures.map(temps => thermalNeed(s, survey.tile, profile, temps[survey.tile]))
          .find(need => need && !stations.some(station => station.mode === need)) : "";
      const tile = mode ? outpostBuildingSite(s, base, survey.tile) : -1;
      const supplyIssue = outpostSupplyIssue(state, world, id);
      if (supplyIssue) {
        if (survey.level !== "ready" && tile < 0 && base.supplied) continue;
        if (state.ships.some(ship => ship.missionType === "supply" && ship.destination === world.id && ship.recipientCivilization === id)) continue;
        const from = sources.find(source => !supplyBlock(state, source, world, 44, 25, id));
        if (from && !supply(state, from, world, 44, 25, id)) return true;
        continue;
      }
      if (tile < 0) continue;
      if (g.output < TWO_STATION_DEMAND) {
        const wind = s.power.plants.filter(p => p.civilization === id && p.kind === "wind" && s.damage[p.tile] < 0.62);
        if (wind.length < 3 && !E.installWind(state, world, point(tile), id)) return true;
        continue;
      }
      if (E.buildStation(state, world, point(tile), id)) continue;
      const station = s.stations.find(station => station.tile === tile);
      station.mode = mode;
      Orbit.event(state, world.name + " · Roboty civilizace " + E.nationLabel(state, id) + " postavily z místního materiálu teraformer pro "
        + (mode === "heat" ? "ohřev v chladné části oběhu." : "chlazení v horké části oběhu."), "good");
      return true;
    }
    return false;
  }

  function planColony(state, id, sources, targets, pool) {
    for (const from of sources) {
      if (colonyBlock(state, from, id, true)) continue;
      const available = targets.filter(p => pool.discoveries[p.id]);
      available.sort((a, b) => Number(Boolean(b.biosphere.robotBases?.some(base => base.civilization === id)))
        - Number(Boolean(a.biosphere.robotBases?.some(base => base.civilization === id))));
      for (const to of available) {
        if (outpostSupplyIssue(state, to, id)) continue;
        for (const profile of crewProfiles(from, id)) {
          if (assessment(state, to, id, profile).level === "ready") return { from, to, profile };
        }
      }
    }
    return null;
  }
  return { MISSIONS, init, relation, changeRelation, people, takePeople, crewProfiles, selectedCrew, assessment, targetOwner, colonyBlock, colonyLaunchIssue, block, start, lost, arrive, colonize,
    supplyBlock, supply, dispatchSupplies, route, outpostSupplyIssue, step, site, planetStage, PROJECTS, setProject, projectStatus, keepsExpansionBudget,
    baseGuardStatus, basePreparationActive, baseGuard, expandBase, automaticSourceSite, automaticStationSite, prepareBase, baseSecurityStep };
})();

