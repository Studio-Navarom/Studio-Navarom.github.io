"use strict";
// Settlement food and patronage are separate from the existing planetary power grid.
const Patronage = (() => {
  const NATURES = { hunter: "Lovecká", keeper: "Ochranitelská", broker: "Smíšená" };
  const ACTIONS = {
    energy: { name: "Rozvoj energetiky", food: 0, note: "Osada vybere vhodný zdroj a místo podle místní sítě, prostředí, zásob a odemčených technologií." },
    hydro: { name: "Rozvoj energetiky", food: 0, note: "Dokončení vodní turbíny z dřívější hry." },
    science: { name: "Věda", food: 0, note: "12 M při zadání a energie při práci. Po dokončení +3 VB a trvale +0,15 E/s pro vědecké zázemí této planety." },
    mine: { name: "Těžba", food: 0, note: "8 E + 12 M. Důl při těžbě spotřebovává jídlo své osady." },
    gather: { name: "Obživa", food: 8, note: "Skupina vyrazí na lov nebo sběr. Jídlo přiveze až při návratu." },
    materials: { name: "Připravit materiál", food: 4, note: "Výprava pro dřevo a kámen doplní místní sklad po návratu. Osada musí mít dost jídla i pro obyvatele." },
    guard: { name: "Výcvik jednotek", food: 24, note: "Vyškolí až dvě jednotky podle udržitelné kapacity osady." },
    gift: { name: "Dary sousedům", food: 30, note: "Doručené jídlo zlepší vztahy. Při důvěře 60 se osada může připojit." },
    faith: { name: "Společný obřad", food: 25, note: "Za místní jídlo a čas získáš bod víry. Základní přírodní síly zůstávají zdarma." }
  };
  const W = Biosphere.W, H = Biosphere.H, SIZE = W * H;
  const clamp = Biosphere.clampValue;
  const point = Biosphere.position;
  const at = (x, y) => Math.floor((x % W + W) % W) + Math.floor(clamp(y, 0, H - 0.001)) * W;
  const gap = (a, b) => Math.hypot(Math.min(Math.abs(a.x - b.x), W - Math.abs(a.x - b.x)), a.y - b.y);
  const key = (a, b) => [a, b].sort((x, y) => x - y).join(":");
  const alive = (s, town) => town && town.count > 0 && !town.abandoned && s.damage[town.home] < 0.78;
  const scale = c => clamp(Math.sqrt(Math.max(1, c.people) / 4000), 0.7, 4);
  const capacity = c => Math.round((140 + (c.faith >= 3 ? 60 : 0)) * scale(c));
  const guardRation = (state, c) => scale(c) * (Evolution.knows(state, c.civilization, "military") ? 0.08 : 0.10);
  const guardUpkeep = (state, c) => guardRation(state, c) * c.guards;
  const basicFoodReserve = (state, c) => 10 * (0.65 * scale(c) + guardUpkeep(state, c));
  function foodHarvest(state, s, c) {
    if (!safe(s, c.home, c)) return 0;
    const temperature = Evolution.temperature(s, c.home, c);
    const climate = clamp((temperature - 0.16) / 0.14, 0, 1) * clamp((0.95 - temperature) / 0.15, 0, 1);
    return scale(c) * ((Biosphere.contaminated(s, c.home) ? 0 : 0.2) + Evolution.harvest(s, c, Evolution.knows(state, c.civilization, "agriculture"))) * climate;
  }
  function guardCapacity(state, world, c) {
    const harvest = c.guardHarvest ?? foodHarvest(state, world.biosphere, c);
    const surplus = harvest - 0.65 * scale(c);
    return Math.max(0, Math.min(Math.floor(c.people / 120), Math.floor(Math.max(0, surplus) * 0.95 / guardRation(state, c))));
  }
  function finishRecruitment(state, world, c) {
    const count = Math.max(0, Math.min(2, guardCapacity(state, world, c) - c.guards));
    c.guards += count;
    return count;
  }
  const cost = (c, action) => c.era >= 5 && c.faith >= 10 && ["guard", "gift"].includes(action) ? 0 : Math.ceil(ACTIONS[action].food * scale(c));
  const info = c => c.faith < 3 ? "3 víry: společná sýpka, větší sklad jídla."
    : c.faith < 6 ? "6 víry: rada strážců, silnější obrana."
    : c.faith < 10 ? "10 víry: společná řeč, účinnější dary, energetika a věda." : "Kmenové znalosti jsou dokončené.";

  const RESEARCH_COSTS = Object.fromEntries(Object.entries(Evolution.TECH).map(([key, spec]) => [key, spec]));
  const SPACE_COST = { energy: 60, supplies: 25 };
  const ownerKey = (world, c) => c.civilization ? "civil:" + c.civilization : "realm:" + world.id + ":" + c.realm;
  const cleanName = (value, size) => String(value ?? "").trim().slice(0, size);

  function ensureKnowledge(state) {
    state.knowledgePools ??= {};
    state.spacePrograms ??= {};
    if (state.knowledgeVersion !== 1) {
      // Old positions stored faith separately in every settlement. Sum earned contributions once.
      for (const world of state.worlds) for (const c of world.biosphere?.communities ?? []) {
        const key = ownerKey(world, c), pool = state.knowledgePools[key] ??= { faith: 0 };
        pool.faith = Math.min(10, pool.faith + (Number.isFinite(c.faith) ? clamp(c.faith, 0, 10) : 0));
      }
      state.knowledgeVersion = 1;
    }
    return state.knowledgePools;
  }
  function knowledge(state, world, c) {
    const pools = ensureKnowledge(state), key = ownerKey(world, c);
    const pool = pools[key] ??= { faith: 0 };
    if (!pool.name) pool.name = state.patron?.id === c.civilization ? state.patron.name : Biosphere.REALMS[c.realm].name;
    pool.science ??= { active: null, progress: { climate: 0, navigation: 0 }, funded: {} };
    return pool;
  }
  function updateFaithMirrors(state, key, pool) {
    for (const world of state.worlds) for (const c of world.biosphere?.communities ?? []) if (ownerKey(world, c) === key) {
      c.faith = pool.faith;
      const town = world.biosphere.towns[c.town];
      if (town) town.guardBonus = pool.faith >= 6 ? 0.2 : 0;
    }
  }
  function reservedFaith(state, key) {
    return state.worlds.reduce((sum, world) => sum + (world.biosphere?.communities ?? []).filter(c => c.active && ownerKey(world, c) === key && c.job?.kind === "faith").length, 0);
  }
  function sciencePool(state, world) { return Evolution.sciencePool(state, world); }  function pushScience(state, key, pool) { Evolution.refreshScience(state, Number(key.split(":")[1])); }  function prepareScience(state, world) {
    if (!world?.biosphere) return null;
    Evolution.focus(state, world);
    return Evolution.sciencePool(state, world)?.key ?? null;
  }  function finishScience(state, world, key) { Evolution.focus(state, world); }  function researchFundingBlock(state, world, project) { return Evolution.researchBlock(state, world, project); }  function selectResearch(state, world, project) { return Evolution.research(state, world, project); }  function spaceBlock(state, world) { return Evolution.spaceBlock(state, world); }  function selectSpace(state, world) { return Evolution.spaceProgram(state, world); }  function receiveScience(state, world, plans) {
    const shared = sciencePool(state, world); if (!shared) return;
    for (const name of plans) if (Biosphere.RESEARCH[name]) { shared.pool.science.progress[name] = Biosphere.RESEARCH[name].work; shared.pool.science.funded[name] = true; }
    Evolution.refreshScience(state, state.patron.id);
  }
  // Each settlement owns its residents. The planetary count is only an aggregate.
  function commitPopulation(world) {
    const s = world.biosphere;
    world.pop = (s.communities ?? []).reduce((sum, c) => sum + (c.active ? Math.max(0, c.people || 0) : 0), 0);
    s.populationTotal = world.pop;
    return world.pop;
  }
  // A loss can be detected in two different places: the live population model
  // or a later reconciliation, after buildings/ground or the planetary population
  // changed elsewhere. Reconciliation must not throw away the known conditions.
  function settlementLossEvidence(world, c) {
    const s = world.biosphere, town = s.towns[c.town];
    if (!town) return { cause: "sídlo už neexistuje v seznamu osad", certainty: "unknown" };
    const i = town.home;
    const damaged = s.damage[i] >= 0.78;
    const damage = Biosphere.damageCause(s, i);
    if (town.abandoned && s.damageCause[i] === 7) return { cause: "opuštění původního sídla při přesunu obyvatel", certainty: "observed", abandonment: true };
    if (damaged) return { cause: damage || "zničení centra osady; přesný původ poškození není znám", certainty: damage ? "observed" : "unknown" };
    const hazard = Evolution.centerHazard(s, c, i);
    if (hazard) return { cause: hazard.toLocaleLowerCase("cs"), certainty: "observed" };
    if (town.abandoned) return { cause: "osada je označena jako opuštěná; důvod opuštění není doložen", certainty: "unknown", abandonment: true };
    if (town.count <= 0) return { cause: "zánik posledních obytných staveb", certainty: "observed" };
    if (c.hungryAt > 0 && c.food <= 0.01) return { cause: hungerCause(world, c), certainty: "observed" };
    const recent = c.lastPopulationRisk;
    if (recent?.cause && Number.isFinite(recent.at) && s.time - recent.at <= 24)
      return { cause: recent.cause, certainty: "likely", lastObservedAt: recent.at };
    const external = s.recentPopulationLoss;
    if (external?.cause && Number.isFinite(external.at) && s.time - external.at <= 2)
      return { cause: external.cause, certainty: "likely", lastObservedAt: external.at };
    if (world.pop <= 0) return { cause: "celkový zánik obyvatel planety; bezprostřední spouštěč není doložen", certainty: "unknown" };
    return { cause: "přerušení osídlení; v okamžiku zániku nebyl zaznamenán jednoznačný spouštěč", certainty: "unknown" };
  }
  function recordSettlementLoss(state, world, c, cause, evidence = null) {
    const settlement = c.name || "Osada " + c.id;
    const colony = world.biosphere.towns[c.town]?.orbitalColony;
    const details = evidence ?? (cause ? { cause, certainty: "observed" } : settlementLossEvidence(world, c));
    const reason = cause || details.cause;
    const certainty = cause ? "observed" : details.certainty ?? "unknown";
    const qualifier = certainty === "likely" ? " Pravděpodobná příčina: "
      : certainty === "unknown" ? " Zjištění: " : " Příčina: ";
    const message = world.name + " · " + settlement + (details.abandonment ? " · Osada byla opuštěna." : colony ? " · Kolonie zanikla." : " · Osídlení zaniklo.")
      + qualifier + reason + ".";
    const s = world.biosphere, town = s.towns[c.town], i = town?.home;
    Orbit.event(state, message, details.abandonment ? "warn" : "bad", {
      kind: details.abandonment ? "settlement-abandoned" : "settlement-loss", civilization: c.civilization, worldId: world.id,
      worldName: world.name, communityId: c.id, settlement, tile: i ?? c.home, cause: reason, certainty,
      lossContext: { population: c.people, planetPopulation: world.pop, food: c.food,
        townCount: town?.count ?? 0, townAbandoned: Boolean(town?.abandoned),
        centerDamage: i === undefined ? null : Number(s.damage[i].toFixed(3)),
        centerTemperature: i === undefined ? null : Number(s.temperature[i].toFixed(3)),
        centerWater: i === undefined ? null : Number(s.water[i].toFixed(3)),
        lastRisk: c.lastPopulationRisk?.cause ?? null }
    });
  }

  function hungerCause(world, c) {
    const reason = Evolution.environment(world.biosphere, c).reason;
    return reason && reason !== "Dochází potrava" ? "hlad · " + reason.toLocaleLowerCase("cs") : "hlad";
  }

  function reconcilePopulation(state, world) {
    const s = world.biosphere, list = s.communities, active = list.filter(c => c.active);
    if (!s.populationVersion) {
      if (!active.length) return; // A young world's first population has not settled yet.
      const stored = active.reduce((n, c) => n + (Number.isFinite(c.people) ? Math.max(0, c.people) : 0), 0);
      const weights = active.reduce((n, c) => n + Math.max(1, s.towns[c.town].count) * (c.populationFactor ?? 1), 0);
      for (const c of active) {
        c.people = world.pop * (stored ? Math.max(0, c.people || 0) / stored : Math.max(1, s.towns[c.town].count) * (c.populationFactor ?? 1) / weights);
        delete c.newResidents;
      }
      for (const c of list) if (!c.active) c.people = 0;
      s.populationVersion = 1; s.populationTotal = world.pop;
    } else {
      // Older orbital events apply a planet-wide casualty count. Apply that delta
      // proportionally to residents, once, never using the amount of housing.
      const delta = world.pop - (s.populationTotal ?? world.pop);
      if (Math.abs(delta) > 1e-7) {
        const residents = list.filter(c => Number.isFinite(c.people) && c.people > 0);
        const total = residents.reduce((sum, c) => sum + c.people, 0);
        if (total) for (const c of residents) c.people *= Math.max(0, total + delta) / total;
      }
      for (const c of active.filter(c => c.newResidents)) {
        const town = s.towns[c.town], migration = town.residentOrigin;
        const source = migration ? list.find(x => x.id === migration.id)
          : list.filter(x => x.id !== c.id && x.active && !x.newResidents && x.civilization === c.civilization)
            .sort((a, b) => b.people - a.people)[0];
        const available = source ? Math.max(0, source.people - (migration?.all ? 0 : 1)) : 0;
        const proposed = Math.min(available, migration?.all ? available : migration?.people ?? Math.min(200, available * 0.12));
        const count = proposed >= 1 ? proposed : 0;
        c.people = count;
        if (count > 0) { source.people -= count; c.profile = town.profile = source.profile; }
        if (count > 0) {
          const settlement = c.name || "Osada " + c.id, origin = source.name || "Osada " + source.id;
          const abandoned = Boolean(migration?.all);
          Orbit.event(state, world.name + " · " + (c.civilizationName ?? "Civilizace") + " · Přesun obyvatel: "
            + Math.floor(count) + " obyvatel z " + origin + " do " + settlement
            + (abandoned ? " · Původní osada je opuštěná." : " · Původní osada pokračuje."), "good", {
            kind: "settlement-migration", civilization: c.civilization, worldId: world.id, tile: c.home,
            fromCommunity: source.id, toCommunity: c.id, people: count, settlement,
            founded: Boolean(c.fresh), abandoned, origin, originTile: source.home
          });
        }
        delete town.residentOrigin; delete c.newResidents;
      }
      let lost = 0, lostSettlements = 0, unexplainedSettlements = 0;
      for (const c of list) if (!c.active && c.people > 0) {
        const town = s.towns[c.town], evidence = settlementLossEvidence(world, c);
        if (c.people >= 1) {
          recordSettlementLoss(state, world, c, "", evidence);
          lostSettlements++;
          if (evidence.certainty === "unknown") unexplainedSettlements++;
        }
        lost += c.people;
        c.people = 0;
        c.job = null;
        if (town) {
          town.abandoned = true;
          s.tribes = s.tribes.filter(tribe => tribe.home !== town.home);
        }
      }
      // Multiple unexplained deactivations in one sync are a possible population
      // reconciliation defect, not evidence that the same disaster killed everyone.
      if (lostSettlements >= 2 && unexplainedSettlements) Orbit.event(state,
        world.name + " · Pozor: " + lostSettlements + " osad zmizelo v jednom kroku; u " + unexplainedSettlements
          + " není doložen bezprostřední spouštěč. Zkontroluj synchronizaci populace a poslední události.",
        "warn", { kind: "population-anomaly", worldId: world.id, settlements: lostSettlements,
          unexplained: unexplainedSettlements, cause: "hromadná neobjasněná změna stavu osad" });
      if (lost) {
        state.stats.losses += lost;
        if (world.missionPeople > 0) world.missionPeople *= Math.max(0, 1 - lost / Math.max(1, world.pop));
      }
      for (const c of active) if (!(c.people > 0)) { c.active = false; s.towns[c.town].abandoned = true; c.job = null; }
    }
    commitPopulation(world);
  }
  function transferTown(state, world, townIndex, civilization, realm, preserveWork = false) {
    const s = world.biosphere, town = s.towns[townIndex], nation = state.nations?.[civilization];
    if (!town || !nation) return;
    const c = s.communities.find(c => c.id === town.communityId);
    const previousOwner=c?.civilization, previousName=Evolution.nationLabel(state,previousOwner);
    const residentProfile = Evolution.PROFILES[c?.profile] ? c.profile : Evolution.PROFILES[town.profile] ? town.profile : state.nations[previousOwner]?.profile ?? Evolution.nativeProfile(s);
    town.realm = realm; town.civilization = civilization; town.profile = residentProfile;
    town.civilizationColor = nation.color;
    s.realmCivilizations ??= {}; s.realmCivilizations[realm] = civilization;
    s.cultures[realm] = nation.nature;
    if (c) {
      c.realm = realm; c.civilization = civilization; c.profile = residentProfile; c.nature = nation.nature;
      if (!preserveWork) { c.job = null; c.guards = 0; delete c.diplomaticGoal; }
    }
    if (c?.active && previousOwner && previousOwner !== civilization && !preserveWork) {
      const settlement = c.name || "Osada " + c.id;
      Orbit.event(state, world.name + " · Změna správy: " + settlement + " · " + previousName + " → " + Evolution.nationLabel(state, civilization)
        + " · " + Math.floor(c.people) + " obyvatel přechází s osadou. Podnební nároky zůstávají: " + Evolution.profile(residentProfile).climate + ".", "warn", {
        kind: "settlement-owner", civilization, previousOwner, worldId: world.id, communityId: c.id, tile: town.home, settlement, people: c.people
      });
    }
    // Existing stocks remain in the former nation's local account. Buildings and
    // their future production follow the transferred settlement; no stocks are minted.
    for (const plant of s.power.plants) if (plant.town === townIndex + 1) { plant.civilization = civilization; plant.profile = residentProfile; plant.output = 0; }
    for (const mine of s.mines ?? []) if (mine.town === townIndex + 1 || s.plotTown[mine.tile] === townIndex + 1) mine.civilization = civilization;
    for (const station of s.stations) if (s.plotTown[station.tile] === townIndex + 1) {
      station.civilization = civilization; station.profile = residentProfile; station.draw = station.load = station.fraction = 0; station.pending = true;
    }
    for (const monument of s.monuments) if (monument.town === townIndex + 1) monument.civilization = civilization;
  }
  function sync(state, world) {
    const detailed = typeof PerformanceHUD !== "undefined" && PerformanceHUD.active;
    const syncAt = detailed ? performance.now() : 0;
    let phaseAt = syncAt;
    const phase = label => {
      if (!detailed) return;
      const now = performance.now();
      PerformanceHUD.mark(label, now - phaseAt);
      phaseAt = now;
    };
    const s = world.biosphere;
    if (!s) return [];
    ensureKnowledge(state);
    s.communities ??= []; s.cultures ??= {}; s.diplomacy ??= {}; s.nextCommunityId ??= 1;
    const used = new Set();
    for (const town of s.towns) {
      if (!Number.isInteger(town.communityId) || town.communityId < 1 || used.has(town.communityId)) town.communityId = s.nextCommunityId++;
      used.add(town.communityId); s.nextCommunityId = Math.max(s.nextCommunityId, town.communityId + 1);
    }

    // OPT1: index existing communities once per synchronization. The original
    // Array.find scanned all communities again for every town. The index is
    // local to this call so ownership changes never leave a stale cache.
    const communitiesById = new Map(s.communities.map(item => [item.id, item]));
    Evolution.init(state);
    for (const [index, town] of s.towns.entries()) {
      let c = communitiesById.get(town.communityId);
      if (!c) {
        if (!alive(s, town) || world.pop <= 0) continue;
        const nearbyPack = s.packs.some(pack => (pack.energy ?? 1) > 0.03 && gap(pack, point(town.home)) < 10);
        s.cultures[town.realm] ??= town.realm === 3 ? (state.patron && s.colonialCivilization === state.patron.id ? state.patron.nature ?? "broker" : "broker")
          : nearbyPack ? "hunter" : s.plants[town.home] >= 0.35 ? "keeper" : "broker";
        const family = s.communities.find(item => item.realm === town.realm && item.civilization && item.active);
        c = { id: town.communityId, realm: town.realm, nature: s.cultures[town.realm], civilization: town.civilization ?? family?.civilization ?? (town.realm === 3 ? s.colonialCivilization ?? null : null),
          profile: town.profile ?? Evolution.nativeProfile(s), food: 0, faith: 0, guards: 0, populationFactor: 1, job: null, nextAuto: s.time + 12 + index * 3, starved: false, hungryAt: 0 };
        s.communities.push(c); communitiesById.set(c.id, c); c.fresh = true; c.newResidents = true; c.people = 0;
      }
      if (c.realm !== town.realm || town.civilization && c.civilization !== town.civilization) {
        transferTown(state, world, index, town.civilization || s.realmCivilizations?.[town.realm], town.realm);
      }
      if (s.populationVersion && !c.active && c.people === 0 && alive(s, town)) c.newResidents = true;
      c.town = index; c.home = town.home; c.active = world.pop > 0 && alive(s, town);
      c.nature = s.cultures[town.realm] ?? c.nature ?? "broker";
      const nation = Evolution.identity(state, world, c, town, true); c.era = Evolution.settlementEra(s, town);
      const pool = knowledge(state, world, c);
      c.faith = pool.faith;
      c.civilizationName = Evolution.nationLabel(state,nation.id);
      town.civilizationName = c.civilizationName; town.settlementName = c.name || "Osada " + c.id;

      town.guardCount = c.guards; town.guardBonus = c.faith >= 6 ? 0.2 : 0;
    }
    // OPT1: this was a full towns scan for every community.
    const townIds = new Set(s.towns.map(town => town.communityId));
    for (const c of s.communities) if (!townIds.has(c.id)) c.active = false;
    phase("patronSyncIdentity");
    reconcilePopulation(state, world);
    phase("patronSyncPopulation");
    const active = s.communities.filter(c => c.active);
    for (const c of active) {
      if (c.fresh) { c.food = capacity(c) * 0.54; delete c.fresh; }
      c.food = clamp(c.food, 0, capacity(c));
    }
    if (active.some(c => c.civilization && c.civilization === s.colonialCivilization)) s.colonialSeedPending = false;
    // OPT6: diplomatic defaults depend on a *pair of realms*, not on every
    // combination of their settlements. Preserve first-seen realm order and
    // first-seen natures so existing/default relations stay byte-for-byte equal.
    const realmFounders = [];
    const seenRealms = new Set();
    for (const c of active) if (!seenRealms.has(c.realm)) {
      seenRealms.add(c.realm);
      realmFounders.push(c);
    }
    for (const a of realmFounders) for (const b of realmFounders) if (a.realm !== b.realm) {
      const pair = key(a.realm, b.realm);
      s.diplomacy[pair] ??= a.nature === "broker" || b.nature === "broker" ? 20 : a.nature === b.nature ? -10 : 15;
    }
    phase("patronSyncDiplomacy");
    const grids = Evolution.economies(state, world);
    if (s.nativeRestart && active.length) {
      if (world.nativeFounded && !world.colony) {
        for (const id of new Set(active.map(c => c.civilization))) {
          const residents = active.filter(c => c.civilization === id).reduce((sum, c) => sum + c.people, 0);
          grids[id].supplies = 72 * residents / world.pop;
        }
      }
      delete s.nativeRestart;
    }
    phase("patronSyncEconomy");
    prepareScience(state, world);
    phase("patronSyncScience");
    if (detailed) PerformanceHUD.mark("patronSync", performance.now() - syncAt);
    return active;
  }

  const relation = (s, a, b) => a.realm === b.realm ? 100 : s.diplomacy[key(a.realm, b.realm)] ?? 0;
  function route(s, a, b, actor = a) {
    if (a.home === b.home) return { sea: false, target: b.home };
    if (Evolution.sameRegion(s, a.home, b.home, actor) && Biosphere.walkPath(s, a.home, b.home, true, actor).length)
      return { sea: false, target: b.home };
    const from = s.ports.find(port => port.town === a.town && port.open);
    const to = s.ports.find(port => port.town === b.town && port.open);
    if (!from || !to) return null;
    const path = Biosphere.seaPath(s, from.water, to.water, SIZE);
    if (!path || !Biosphere.walkPath(s, a.home, from.land, true, actor).length && a.home !== from.land
      || !Biosphere.walkPath(s, to.land, b.home, true, actor).length && to.land !== b.home) return null;
    return { sea: true, fromLand: from.land, fromWater: from.water, toLand: to.land, toWater: to.water,
      path: path.slice(1).reverse(), target: b.home };
  }

  function foodSite(s, c) {
    const origin = point(c.home), candidates = [];
    for (let i = 0; i < SIZE; i++) {
      if (Biosphere.contaminated(s, i) || !Evolution.sameRegion(s, i, c.home, c) || !Evolution.ground(s, i, c) || Evolution.temperature(s, i, c) < 0.2 || Evolution.temperature(s, i, c) > 0.89) continue;
      const distance = gap(origin, point(i));
      if (distance < 2 || distance > 17) continue;
      const value = Evolution.forage(s, i, c);
      if (value > 0.22) candidates.push({ tile: i, score: value - distance * 0.012, prey: -1 });
    }
    if (c.nature !== "keeper") for (const [index, herd] of s.herds.entries()) {
      const i = at(herd.x, herd.y), distance = gap(origin, herd);
      if (herd.size >= 0.26 && distance < 19 && Evolution.sameRegion(s, i, c.home, c) && Biosphere.canBuild(s, i, c))
        candidates.push({ tile: i, prey: index, score: herd.size * (c.nature === "hunter" ? 1.3 : 0.95) - distance * 0.012 });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, 18).find(site => site.tile === c.home || Biosphere.walkPath(s, c.home, site.tile, true, c).length);
  }

  function materialSite(s, c) {
    const origin = point(c.home), candidates = [];
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
      const distance = Math.hypot(dx, dy), y = origin.y + dy;
      if (distance < 2 || distance > 8 || y < 0 || y >= H) continue;
      const i = at(origin.x + dx, y), claimant = s.towns[s.claims[i] - 1];
      if (s.ocean[i] || s.urban[i] || Biosphere.contaminated(s, i) || !safe(s, i, c)
        || !Evolution.sameRegion(s, i, c.home, c) || claimant && claimant.civilization !== c.civilization) continue;
      const wood = s.plants[i], stone = clamp((s.height[i] - 0.39) * 4, 0, 1);
      const quality = Math.max(wood, stone);
      if (quality >= 0.10) candidates.push({ tile: i, score: quality - distance * 0.05 });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates.find(site => Biosphere.walkPath(s, c.home, site.tile, true, c).length);
  }

  const MATERIAL_WORK = 8, MATERIAL_AUTO_TARGET = 16;
  function block(state, world, c, action, target, autonomous = false) {
    const s = world?.biosphere;
    if ((Evolution.CONSTRUCTION[action] || action === "science") || c?.era >= 5 && c.faith >= 10 && ["guard", "gift"].includes(action)) return Evolution.actionBlock(state, world, c, action, target, autonomous);
    if (!s || !c?.active || world.pop <= 0 || state.over) return "Osada už není obydlená.";
    if (action === "hydro" || !Object.hasOwn(ACTIONS, action)) return "Neznámý pokyn.";
    if (!autonomous && (!state.patron || c.civilization !== state.patron.id)) return "Tuto osadu nevedeš. Patronát můžeš přijmout, dokud žádnou civilizaci nevedeš.";
    if (c.job) return Evolution.jobProgress(s,c).label + ". Nejprve musí skončit současný úkol.";
    const hazard = Evolution.orderHazard(s, c);
    if (c.food < cost(c, action)) return (hazard ? hazard + ". " : "") + "Chybí " + Math.ceil(cost(c, action) - c.food) + " jídla v této osadě.";
    if (hazard) return hazard + ".";
    if (action === "materials") {
      const g = Evolution.grid(state, world, c.civilization);
      if (!g || g.supplies >= 100) return "Místní sklad materiálu je plný.";
      if (c.food - cost(c, action) < basicFoodReserve(state, c)) return "Osada nejprve potřebuje rezervu jídla.";
      if (!materialSite(s, c)) return "V dosahu není bezpečné místo pro sběr dřeva nebo kamene.";
    }
    if (action === "gather" && !foodSite(s, c)) return "V dosahu není dostupná potrava. Pomoz vegetaci vodou a vhodnou teplotou nebo obnov přístup ke zvěři.";
    if (action === "guard" && c.guards >= guardCapacity(state, world, c)) return "Další jednotku osada dlouhodobě neuživí nebo nemá dost obyvatel.";
    if (action === "faith" && c.faith + reservedFaith(state, ownerKey(world, c)) >= 10) return c.faith >= 10 ? "Společná víra je dokončená." : "Zbývající body víry už připravují jiné osady.";
    if (action === "gift") {
      if (!target?.active || target.id === c.id || target.realm === c.realm) return "Vyber osadu jiné společnosti.";
      if (s.battle?.sides.some(side => [c.town, target.town].includes(side - 1))) return "Nejprve musí skončit probíhající střet.";
      if (!route(s, c, target)) return "Chybí bezpečná cesta. Mezi ostrovy potřebuješ otevřené přístavy a průjezdnou vodu.";
    }
    return "";
  }

  function order(state, world, id, action, targetId, autonomous = false) {
    const list = sync(state, world), c = list.find(item => item.id === id), target = list.find(item => item.id === targetId);
    if ((Evolution.CONSTRUCTION[action] || action === "science") || c?.era >= 5 && c.faith >= 10 && ["guard", "gift"].includes(action)) return Evolution.order(state, world, c, action, target, autonomous);
    const issue = block(state, world, c, action, target, autonomous);
    if (issue) return issue;
    const s = world.biosphere, paid = cost(c, action);
    let extra = {};
    if (action === "gather") {
      const site = foodSite(s, c); extra = { target: site.tile, prey: site.prey, returning: false, cargo: 0 };
    } else if (action === "materials") {
      extra = { target: materialSite(s, c).tile, prey: -1, returning: false, cargo: 0 };
    } else if (action === "gift") extra = { targetId, cargo: paid, itinerary: route(s, c, target), leg: "out" };
    c.food -= paid;
    c.job = { kind: action, playerOrdered: !autonomous, began: s.time, work: 0, paid, phase: "out", ...point(c.home), destination: -1, route: [], ...extra };
    if (!autonomous) Orbit.event(state, world.name + " · " + name(c) + " · " + ACTIONS[action].name + ": vydáno " + paid + " jídla.");
    return "";
  }

  function name(c) { return (c.civilizationName || Biosphere.REALMS[c.realm].name) + " · " + (c.name || "Osada " + c.id); }
  function report(state, world, c, message, tone = "") {
    Orbit.event(state, world.name + " · " + name(c) + " · " + message, tone, {category:"civic", worldId:world.id});
  }

  function setDiplomaticGoal(state, world, sourceId, targetId) {
    const list = sync(state, world), source = list.find(c => c.id === sourceId);
    if (!source || source.civilization !== state.patron?.id || state.over) return "Pokyn je dostupný pouze vlastní osadě.";
    if (targetId === null) { delete source.diplomaticGoal; return ""; }
    const target = list.find(c => c.id === targetId);
    if (!target || target.civilization === source.civilization) return "Vyber obydlenou osadu jiné civilizace.";
    source.diplomaticGoal = { id: target.id, civilization: target.civilization };
    report(state, world, source, "Diplomatický cíl · " + name(target) + ".", "good");
    return "";
  }

  function armyBlock(state, world, source, target) {
    if (!source?.active || source.civilization !== state.patron?.id || state.over) return "Armádu můžeš vyslat z vlastní osady.";
    if (!target?.active || target.civilization === source.civilization || target.realm === source.realm) return "Vyber obydlenou osadu jiné civilizace.";
    if (world.biosphere.communities.some(c => c.active && c.civilization === source.civilization && c.job?.kind === "gift"
      && !c.job.delivered && c.job.targetId === target.id)) return "Počkej, až poslové doručí dar do cílové osady.";
    return Biosphere.armyReadiness(world.biosphere, source, target);
  }

  function orderArmy(state, world, sourceId, targetId) {
    const list = sync(state, world), source = list.find(c => c.id === sourceId), target = list.find(c => c.id === targetId);
    const blocked = armyBlock(state, world, source, target);
    if (blocked) return blocked;
    const s = world.biosphere;
    const issue = Biosphere.directArmy(s, source, target, (message, tone) => report(state, world, source, message, tone));
    if (issue) return issue;
    if (source.diplomaticGoal?.id === target.id) delete source.diplomaticGoal;
    const current = Space.relation(state, source.civilization, target.civilization);
    Space.changeRelation(state, source.civilization, target.civilization, Math.min(-25, -10 - current));
    return "";
  }

  function chooseDiplomacy(state, world, source, list) {
    const s = world.biosphere, goal = source.diplomaticGoal;
    const eligible = target => target.active && target.civilization !== source.civilization
      && target.realm !== source.realm && relation(s, source, target) < 60
      && !s.battle?.sides.some(side => side === source.town + 1 || side === target.town + 1)
      && !s.boats.some(boat => boat.kind === "landing" && !boat.returning
        && ((boat.from === source.town && boat.to === target.town)
          || (boat.from === target.town && boat.to === source.town)))
      && !list.some(other => other.civilization === source.civilization && other.job?.kind === "gift"
        && other.job.targetId === target.id);
    let targets;
    if (goal) {
      const target = list.find(c => c.id === goal.id && c.civilization === goal.civilization);
      if (!target || target.civilization === source.civilization) delete source.diplomaticGoal;
      targets = target && eligible(target) ? [target] : [];
    } else {
      targets = list.filter(target => eligible(target) && relation(s, source, target) >= 0
        && gap(point(source.home), point(target.home)) <= 18)
        .sort((a, b) => gap(point(source.home), point(a.home)) - gap(point(source.home), point(b.home)));
    }
    if (!targets.length) return false;
    const price = Evolution.actionCosts(state, world, source, "gift");
    if (source.food - price.food < basicFoodReserve(state, source) * 2) return false;
    if (price.energy || price.supplies) {
      const g = Evolution.grid(state, world, source.civilization);
      if (g.reserve < price.energy + 20 || g.supplies < price.supplies + 12) return false;
      if (!Space.keepsExpansionBudget(state, world, source.civilization, price.energy, price.supplies)) return false;
    }
    for (const target of targets) {
      if (order(state, world, source.id, "gift", target.id, true)) continue;
      source.job.partnerCivilization = target.civilization;
      return true;
    }
    return false;
  }
  const safe = (s, i, c) => Evolution.ground(s, i, c) && Evolution.temperature(s, i, c) >= 0.16 && Evolution.temperature(s, i, c) <= 0.94;

  function moveGift(s, job, home) {
    const plan = job.itinerary;
    if (!plan.sea) return Biosphere.walk(s, job, point(home), 0.43, true);
    if (job.leg === "out") {
      if (!Biosphere.walk(s, job, point(plan.fromLand), 0.43, true)) return false;
      if (!Biosphere.seaOpen(s, plan.fromWater)) { job.blocked = true; return false; }
      Object.assign(job, point(plan.fromWater), { previousX: point(plan.fromWater).x, previousY: point(plan.fromWater).y });
      job.leg = "sea";
    }
    if (job.leg === "sea") {
      const here = at(job.x, job.y), next = plan.path.at(-1);
      if (!Biosphere.seaOpen(s, here) || next !== undefined && !Biosphere.seaOpen(s, next)) { job.blocked = true; return false; }
      job.blocked = false; job.previousX = job.x; job.previousY = job.y;
      if (next !== undefined) {
        const target = point(next), dx = ((target.x - job.x + W * 1.5) % W) - W / 2, dy = target.y - job.y, distance = Math.hypot(dx, dy);
        if (distance < 0.34) { job.x = target.x; job.y = target.y; plan.path.pop(); }
        else { job.x = (job.x + dx / distance * 0.34 + W) % W; job.y += dy / distance * 0.34; }
        return false;
      }
      if (!safe(s, plan.toLand, job)) { job.blocked = true; return false; }
      Object.assign(job, point(plan.toLand), { destination: -1, route: [] }); job.leg = "in";
    }
    return Biosphere.walk(s, job, point(home), 0.43, true);
  }

  function advanceJob(state, world, c, dt) {
    const s = world.biosphere, job = c.job;
    if (!job) return;
    if (job.economic) { Evolution.advanceJob(state, world, c, dt); return; }
    if (s.time - job.began > 150) {
      report(state, world, c, job.delivered ? "Dary byly předány, ale poslové se včas nevrátili."
        : ["faith", "guard"].includes(job.kind) ? "Přípravu se nepodařilo dokončit. Vydané jídlo se nevrací."
        : "Výprava se včas nevrátila. Náklad je ztracen.", "warn");
      c.job = null; return;
    }
    if (job.kind === "guard" || job.kind === "faith") {
      job.blocked = !safe(s, c.home, c);
      if (job.blocked) return;
      job.work += dt;
      if (job.work < 10) return;
      if (job.kind === "guard") {
        const count = finishRecruitment(state, world, c);
        report(state, world, c, count ? "Výcvik dokončen. Nové jednotky: " + count + "." : "Výcvik skončil bez náboru. Osada už další jednotky neuživí.", count ? "good" : "warn");
      }
      else {
        const pool = knowledge(state, world, c); pool.faith = Math.min(10, pool.faith + 1);
        updateFaithMirrors(state, ownerKey(world, c), pool);
        report(state, world, c, "Společný obřad posílil víru celé civilizace na " + pool.faith + "." + ([3, 6, 10].includes(pool.faith) ? " Nová znalost platí ve všech jejích osadách." : ""), "good");
      }
      c.job = null; return;
    }
    if (job.kind === "gift") {
      if (job.delivered) {
        if (moveGift(s, job, c.home)) c.job = null;
        return;
      }
      const target = s.communities.find(item => item.id === job.targetId && item.active);
      if (!target || target.realm === c.realm || job.partnerCivilization && job.partnerCivilization !== target.civilization) { report(state, world, c, "Dary už nemají původního příjemce. Výprava končí.", "warn"); c.job = null; return; }
      if (!moveGift(s, job, target.home)) return;
      target.food = Math.min(capacity(target), target.food + job.cargo);
      const pair = key(c.realm, target.realm), change = c.faith >= 10 ? 18 : 12;
      if (typeof Space !== "undefined") Space.changeRelation(state, c.civilization, target.civilization, change);
      else s.diplomacy[pair] = clamp((s.diplomacy[pair] ?? 0) + change, -100, 100);
      report(state, world, c, "Doručeno " + job.cargo + " jídla osadě " + target.id + ". Vztah " + s.diplomacy[pair] + ".", "good");
      if (s.diplomacy[pair] >= 60 && (!state.patron || target.civilization !== state.patron.id)) {
        const oldKnowledge = knowledge(state, world, target), joinedKnowledge = knowledge(state, world, c);
        joinedKnowledge.faith = Math.max(joinedKnowledge.faith, oldKnowledge.faith);
        transferTown(state, world, target.town, c.civilization, c.realm);
        s.societyAt = s.time;
        updateFaithMirrors(state, ownerKey(world, c), joinedKnowledge);
        report(state, world, c, "Sousední osada se dobrovolně připojila.", "good");
      }
      const homeward = route(s, target, c, c);
      if (homeward) {
        job.delivered = true; job.cargo = 0; job.itinerary = homeward; job.leg = "out"; job.destination = -1; job.route = [];
      } else c.job = null;
      return;
    }
    const i = at(job.x, job.y);
    if (!safe(s, i, c)) job.returning = true;
    if (job.returning) {
      if (!Biosphere.walk(s, job, point(c.home), 0.46, true)) return;
      if (job.kind === "materials") {
        const g = Evolution.grid(state, world, c.civilization);
        const accepted = g ? Math.max(0, Math.min(job.cargo, 100 - g.supplies)) : 0;
        if (accepted > 0) g.supplies += accepted;
        report(state, world, c, accepted > 0 ? "Výprava uložila " + Number(accepted.toFixed(1)) + " M." : "Výprava nedoplnila materiál. Sklad je plný nebo se nepodařilo nic nasbírat.", accepted > 0 ? "good" : "warn");
        c.job = null; return;
      }
      const accepted = Math.min(job.cargo, capacity(c) - c.food); c.food += accepted;
      report(state, world, c, accepted > 0 ? "Výprava přivezla " + Math.floor(accepted) + " jídla." : "Lovci a sběrači se vrátili bez úlovku.", accepted > 0 ? "good" : "warn");
      c.job = null; return;
    }
    const prey = job.prey >= 0 ? s.herds[job.prey] : null;
    const target = prey && prey.size >= 0.12 ? prey : point(job.target);
    job.blocked = Biosphere.contaminated(s, at(target.x, target.y)) || !safe(s, at(target.x, target.y), c);
    if (job.blocked || s.time - job.began > 75) { job.returning = true; return; }
    if (!Biosphere.walk(s, job, target, 0.43, true)) return;
    job.work += dt;
    if (job.work < (job.kind === "materials" ? MATERIAL_WORK : 3)) return;
    if (job.kind === "materials") {
      const wood = s.plants[job.target], stone = clamp((s.height[job.target] - 0.39) * 4, 0, 1);
      job.cargo = Math.round(5 + 5 * Math.max(wood, stone));
      if (wood > stone) s.plants[job.target] = Math.max(0, wood - 0.025);
    } else if (job.prey >= 0) {
      if (prey?.size >= 0.12) { const take = Math.min(0.18, prey.size); prey.size -= take; job.cargo = Math.round(take * 240 * scale(c)); }
    } else {
      const food = clamp(Evolution.forage(s, job.target, c), 0, 1);
      job.cargo = Math.round(food * 48 * scale(c)); s.plants[job.target] = Math.max(0, s.plants[job.target] - 0.035);
    }
    job.returning = true;
  }

  function stepWorld(state, world, dt) {
    const s = world.biosphere, list = sync(state, world);
    const harvestWeight = 1 - Math.exp(-dt / 25);
    for (const c of list) {
      c.harvest = foodHarvest(state, s, c);
      c.guardHarvest ??= c.harvest;
      c.guardHarvest += (c.harvest - c.guardHarvest) * harvestWeight;
      c.consumption = 0.65 * scale(c) + guardUpkeep(state, c);
      c.food = clamp(c.food + (c.harvest - c.consumption) * dt, 0, capacity(c));
      if (c.food < c.consumption * 10 && !c.starved) { c.starved = true; report(state, world, c, "Jídlo dochází. Pomoz krajině nebo zajisti obživu.", "warn"); }
      if (c.food > c.consumption * 20) c.starved = false;
      if (c.food <= 0.01) {
        c.hungryAt += dt;
        if (c.guards > 0) { c.guards = Math.max(0, c.guards - 1); report(state, world, c, "Kvůli hladu se část armády rozchází.", "warn"); }
        const lost = Math.min(world.pop, c.people * dt * 0.04);
        c.people = Math.max(0, c.people - lost);
        world.pop -= lost; s.populationTotal = world.pop; state.stats.losses += lost;
        if (world.missionPeople > 0) world.missionPeople *= Math.max(0, 1 - lost / Math.max(1, world.pop + lost));
        if (c.people < 1 && c.hungryAt > 20) {
          s.towns[c.town].abandoned = true; s.towns[c.town].count = 0; c.active = false; c.job = null;
          recordSettlementLoss(state, world, c, hungerCause(world, c));
          s.tribes = s.tribes.filter(tribe => tribe.home !== c.home);
          state.stats.losses += c.people;
          c.people = 0;
          continue;
        }
      } else c.hungryAt = 0;
      const tribe = s.tribes.find(tribe => tribe.home === c.home);
      if (tribe) tribe.food = clamp(c.food / Math.max(1, capacity(c) * 0.7), 0, 1);
      if (c.job) c.job.profile = c.profile;
      advanceJob(state, world, c, dt);
      c.patrols ??= [];
      const visibleGuards = Math.min(2, c.guards);
      c.patrols.length = Math.min(c.patrols.length, visibleGuards);
      while (c.patrols.length < visibleGuards) c.patrols.push({ ...point(c.home), goal: c.home, route: [], destination: -1 });
      for (const [index, guard] of c.patrols.entries()) {
        guard.profile = c.profile;
        if (!safe(s, c.home, c)) continue;
        if (Biosphere.walk(s, guard, point(guard.goal), 0.22, true)) {
          const center = point(c.home), side = (Math.floor(s.time / 3) + index) % 4;
          const candidate = at(center.x + [2,0,-2,0][side], center.y + [0,2,0,-2][side]);
          guard.goal = safe(s, candidate, c) && Evolution.sameRegion(s, candidate, c.home, c) ? candidate : c.home;
        }
      }
      if (!c.job && s.time >= c.nextAuto) {
        c.nextAuto = s.time + 14 + c.id % 5;
        if (c.food < capacity(c) * 0.5) order(state, world, c.id, "gather", 0, true);
        else if ((c.guards < 2 && (s.border?.a === c.town + 1 || s.border?.b === c.town + 1))
          || (c.guards < 4 && s.navalRecruit === c.town)) order(state, world, c.id, "guard", 0, true);
        else if (Evolution.grid(state, world, c.civilization)?.supplies < MATERIAL_AUTO_TARGET
          && !list.some(other => other.civilization === c.civilization && other.job?.kind === "materials")
          && !order(state, world, c.id, "materials", 0, true)) continue;
        else if (c.diplomaticGoal && chooseDiplomacy(state, world, c, list)) continue;
        else if (c.food > capacity(c) * 0.8 && c.faith < 10) order(state, world, c.id, "faith", 0, true);
        else if (!c.diplomaticGoal) chooseDiplomacy(state, world, c, list);
      }
    }
    const beforeCommit = world.pop;
    const counted = list.length ? commitPopulation(world) : world.pop;
    if (beforeCommit > 0 && world.missionPeople > 0) world.missionPeople *= Math.min(1, counted / beforeCommit);
    s.foodSecurity = counted ? list.reduce((sum, c) => sum + c.people * clamp(c.food / Math.max(1, c.consumption * 12), 0, 1), 0) / counted : 1;
  }

  function members(state) {
    if (!state.patron) return [];
    return state.worlds.flatMap(world => world.biosphere ? sync(state, world).filter(c => c.civilization === state.patron.id).map(c => ({ world, community: c })) : []);
  }
  function populationBreakdown(state, id = state.patron?.id) {
    let residents = 0, traveling = 0;
    if (!id) return { residents, traveling };
    for (const world of state.worlds) {
      const surface = world.biosphere;
      if (!surface) continue;
      const communities = (surface.communities ?? []).filter(c => c.active && c.civilization === id);
      residents += communities.reduce((sum, c) => sum + c.people, 0);
      if (!communities.length && surface.colonialSeedPending && surface.colonialCivilization === id)
        residents += Math.max(0, world.pop);
      for (const conflict of surface.spaceConflicts ?? [])
        if (!conflict.finished && conflict.civilization === id) traveling += conflict.people;
    }
    for (const ship of [...state.ships, ...state.probes])
      if (ship.civilization === id && !["deep", "destroyed"].includes(ship.status)) traveling += ship.people || 0;
    return { residents, traveling };
  }
  function population(state) {
    const { residents, traveling } = populationBreakdown(state);
    return Math.floor(residents + traveling);
  }
  function update(state) {
    if (!state.patron) return;
    // OPT1: a confirmed living patron settlement is enough to keep patronage.
    // The former members() call synchronized *every* planet at each orbital
    // microstep (90 times per second at 1×). Settlement reconciliation still
    // runs during every original Biosphere/Patronage world step. When no
    // definitely living settlement exists, use the original full check so
    // colony arrivals, losses and pending missions retain their semantics.
    const patronId = state.patron.id;
    for (const world of state.worlds) {
      const s = world.biosphere;
      if (!s || world.pop <= 0) continue;
      if ((s.communities ?? []).some(c => {
        if (!c.active || c.civilization !== patronId) return false;
        const town = s.towns[c.town];
        return town?.communityId === c.id && town.civilization === patronId
          && town.count > 0 && !town.abandoned && s.damage[town.home] < 0.78;
      })) return;
    }
    if (members(state).length || population(state) > 0) return;
    (state.patronHistory ??= []).push({ ...state.patron, ended: state.time });
    const id = state.patron.id;
    const last = (state.history ?? []).findLast(entry => entry.time >= Math.max(state.patron.started ?? 0, state.time - 2 * Orbit.STEP)
      && (entry.civilization === id && ["settlement-loss", "settlement-abandoned", "crew-loss"].includes(entry.kind)
        || entry.kind === "settlement-owner" && entry.previousOwner === id
        || entry.kind === "world-loss" && entry.civilizations?.includes(id)));
    const cause = last?.kind === "settlement-owner" ? "změna správy poslední osady" : last?.cause;
    const message = "Patronát skončil. Civilizace " + state.patron.name + " přišla o poslední osídlení nebo posádku."
      + (last ? " " + last.message : " Příčina není zaznamenaná.");
    state.patronLoss = { civilization: id, name: state.patron.name, time: state.time,
      date: Evolution.dateAt(state), message, cause, acknowledged: false };
    Orbit.event(state, message, "bad", {kind: "patron-ended", civilization: id, cause});
    state.patron = null;
  }
  function adopt(state, world, id, chosenName) {
    if (state.patron) return "Nejprve se vzdej současného patronátu.";
    const c = sync(state, world).find(item => item.id === id);
    if (!c || state.over) return "Vybraná civilizace není dostupná.";
    const nation = state.nations[c.civilization], name = String(chosenName || nation.name).trim().slice(0, 40) || nation.name;
    nation.name = name;
    state.patron = { ...nation, name, started: state.time };
    Evolution.science(state, nation.id).name = name;
    if (nation.profile) state.guideProfile = nation.profile;
    for (const p of state.worlds) if (p.biosphere) sync(state, p);
    Orbit.event(state, name + " přijímá tvůj patronát. Znalosti, sídla a sklady zůstávají této civilizaci.", "good");
    return "";
  }  function pick(state, world, location) {
    const list = sync(state, world), owner = world.biosphere.plotTown[at(location.x, location.y)];
    return list.find(c => c.town === owner - 1) ?? list.map(c => ({ c, gap: gap(point(c.home), location) })).filter(item => item.gap < 2.3).sort((a, b) => a.gap - b.gap)[0]?.c;
  }
  function creditHunt(s, home, amount) {
    const c = s.communities?.find(item => item.home === home && item.active);
    if (c) c.food = Math.min(capacity(c), c.food + amount * 50 * scale(c));
  }
  function origin(state, world) { return state.patron && world.biosphere && sync(state, world).some(c => c.civilization === state.patron.id) ? state.patron.id : null; }
  // OPT2: a read-only catalogue can be shared by several views during the same
  // synchronous HUD pass. The cache is discarded before the next simulation
  // frame or player event. Core simulation and direct actions never use it.
  let hudCatalogue = null;
  function withHudCatalogue(callback) {
    const previous = hudCatalogue;
    hudCatalogue = new WeakMap();
    try { return callback(); }
    finally { hudCatalogue = previous; }
  }
  function catalog(state) {
    const cached = hudCatalogue?.get(state);
    const detailed = typeof PerformanceHUD !== "undefined" && PerformanceHUD.active;
    if (cached) {
      if (detailed) PerformanceHUD.mark("hudCatalogueReuse", 0);
      return cached;
    }
    const started = detailed ? performance.now() : 0;
    const items = state.worlds.flatMap(world => world.biosphere ? sync(state, world).map(community => ({ world, community,
      id: world.id + ":" + community.id, faction: ownerKey(world, community) })) : []);
    // All founders must be known before disambiguating their display names.
    for (const item of items) {
      const label = Evolution.nationLabel(state,item.community.civilization);
      item.factionName = item.community.civilizationName = label;
      item.world.biosphere.towns[item.community.town].civilizationName = label;
    }
    if (hudCatalogue) hudCatalogue.set(state, items);
    if (detailed) PerformanceHUD.mark("hudCatalogueBuild", performance.now() - started);
    return items;
  }
  function renameSettlement(state, world, id, value) {
    const c = sync(state, world).find(item => item.id === id);
    if (!c || !state.patron || c.civilization !== state.patron.id) return "Přejmenovat můžeš vlastní obydlenou osadu.";
    const chosen = cleanName(value, 48); if (!chosen) return "Zadej název osady.";
    c.name = chosen; world.biosphere.towns[c.town].settlementName = chosen;
    Orbit.event(state, world.name + " · Osada se nyní jmenuje " + chosen + ".", "good"); return "";
  }
  function renameCivilization(state, value, id = state.patron?.id) {
    const nation = state.nations?.[id];
    if (!nation) return "Civilizace už není dostupná.";
    const chosen = cleanName(value, 40);
    if (!chosen) return "Zadej název civilizace.";
    if (nation.name === chosen) return "";
    const previous = nation.name;
    nation.name = chosen;
    if (state.patron?.id === id) state.patron.name = chosen;
    const pool = ensureKnowledge(state)["civil:" + id];
    if (pool) pool.name = chosen;
    for (const world of state.worlds) if (world.biosphere) sync(state, world);
    Orbit.event(state, "Civilizace " + previous + " se nyní jmenuje " + chosen + ".", "good");
    return "";
  }
  function batchOrder(state, entries, action, targetRef, preview = false) {
    const result = { started: 0, skipped: 0, food: 0, energy: 0, supplies: 0, reasons: {} }, virtual = {}, budgets = {}, sites = {};
    for (const item of entries) {
      const world = state.worlds.find(p => p.id === item.world.id);
      const c = world && sync(state, world).find(c => c.id === item.community.id);
      const target = world && targetRef?.worldId === world.id ? world.biosphere.communities.find(c => c.id === targetRef.id && c.active) : null;
      const budgetKey = world?.id + ":" + c?.civilization;
      const g = preview && c && Evolution.grid(state, world, c.civilization);
      const available = g ? (budgets[budgetKey] ??= { energy: g.reserve, supplies: g.supplies }) : null;
      const reserved = preview ? (sites[world?.id] ??= new Map()) : undefined;
      const energy = action === "energy" && c
        ? Evolution.actionQuote(state, world, c, action, target, false, available, reserved) : null;
      let issue = !world || !c ? "Osada už není dostupná." : energy ? energy.issue : block(state, world, c, action, target);
      const owner = c && ownerKey(world, c);
      if (!issue && action === "faith" && c.faith + reservedFaith(state, owner) + (preview ? virtual[owner] ?? 0 : 0) >= 10) issue = "Zbývající víru už připravují jiné osady.";
      if (!issue && action === "gift" && targetRef?.worldId !== world.id) issue = "Příjemce darů je na jiném světě.";
      const price = !issue && (energy?.cost ?? Evolution.actionCosts(state, world, c, action));
      if (!issue && preview && available) {
        if (available.energy < price.energy + (energy?.reserve ?? 0) || available.supplies < price.supplies) issue = "Pro další osadu chybí místní E/M.";
        let site = energy?.site;
        if (!issue && action === "mine") {
          site = Evolution.constructionSite(world.biosphere, c, "mine", reserved);
          if (site === undefined) issue = "V dosahu není volné pracoviště.";
        }
        if (!issue) {
          available.energy -= price.energy; available.supplies -= price.supplies;
          if (site !== undefined) reserved.set(site, energy?.source ?? "mine");
          if (energy?.source === "nuclear") available.nuclear = true;
        }
      }
      if (!issue && !preview) issue = energy ? Evolution.order(state, world, c, action, target, false, energy) : order(state, world, c.id, action, target?.id);
      if (issue) { result.skipped++; result.reasons[issue] = (result.reasons[issue] ?? 0) + 1; }
      else { result.started++; result.food += price.food; result.energy += price.energy; result.supplies += price.supplies; if (preview && action === "faith") virtual[owner] = (virtual[owner] ?? 0) + 1; }
    }
    return result;
  }
  function restore(state) {
    for (const entries of [state.history, state.playerChronicle]) {
      if (!Array.isArray(entries)) continue;
      for (const event of entries) {
        if (event?.kind === "settlement-migration" && typeof event.message === "string")
          event.message = event.message.replace(/(Přesun obyvatel: \d+) duší z /, "$1 obyvatel z ");
      }
    }
    state.patronHistory = Array.isArray(state.patronHistory) ? state.patronHistory.filter(item => item && typeof item.name === "string").slice(-100) : [];
    if (!state.patron || !Number.isInteger(state.patron.id) || state.patron.id < 1 || typeof state.patron.name !== "string") state.patron = null;
    const integer = (v, fallback = 0) => Number.isInteger(v) && v >= 0 ? v : fallback;
    let largest = state.patron?.id ?? 0;
    ensureKnowledge(state);
    for (const pool of Object.values(state.knowledgePools)) {
      pool.faith = Number.isFinite(pool.faith) ? clamp(pool.faith, 0, 10) : 0;
      pool.name = cleanName(pool.name, 40);
      pool.science ??= { active: null, progress: {}, funded: {} };
      pool.science.progress ??= {}; pool.science.funded ??= {};
      for (const project of Object.keys(Biosphere.RESEARCH)) {
        pool.science.progress[project] = Number.isFinite(pool.science.progress[project]) ? clamp(pool.science.progress[project], 0, Biosphere.RESEARCH[project].work) : 0;
        pool.science.funded[project] = pool.science.funded[project] === true;
      }
      if (!Biosphere.RESEARCH[pool.science.active]) pool.science.active = null;
    }
    for (const [id, program] of Object.entries(state.spacePrograms)) state.spacePrograms[id] = { funded: program?.funded === true, active: program?.active === true };
    for (const world of state.worlds) if (world.biosphere) {
      const s = world.biosphere, ids = new Set();
      s.communities = Array.isArray(s.communities) ? s.communities.filter(c => c && Number.isInteger(c.id) && c.id > 0 && !ids.has(c.id) && ids.add(c.id)).map(c => {
        c.food = Number.isFinite(c.food) ? Math.max(0, c.food) : 0; c.faith = clamp(integer(c.faith), 0, 10);
        c.guards = Number.isSafeInteger(c.guards) ? Math.max(0, c.guards) : 0;
        if (!Number.isFinite(c.guardHarvest) || c.guardHarvest < 0) delete c.guardHarvest;
        if (!Number.isSafeInteger(c.diplomaticGoal?.id) || c.diplomaticGoal.id < 1
          || !Number.isSafeInteger(c.diplomaticGoal?.civilization) || c.diplomaticGoal.civilization < 1) delete c.diplomaticGoal;
        c.name = cleanName(c.name, 48);
        c.populationFactor = Number.isFinite(c.populationFactor) ? clamp(c.populationFactor, 0, 100) : 1;
        c.civilization = integer(c.civilization) || null; largest = Math.max(largest, c.civilization ?? 0);
        c.nextAuto = Number.isFinite(c.nextAuto) ? c.nextAuto : s.time + 10;
        c.patrols = []; c.hungryAt = 0;
        const job = c.job;
        const validTile = i => Number.isInteger(i) && i >= 0 && i < SIZE;
        if (job && (!Object.hasOwn(ACTIONS, job.kind) || !Number.isFinite(job.began) || !Number.isFinite(job.work)
          || !Number.isFinite(job.paid) || !Number.isFinite(job.x) || !Number.isFinite(job.y) || job.x < 0 || job.x >= W || job.y < 0 || job.y >= H
          || ["gather", "materials"].includes(job.kind) && (!validTile(job.target) || !Number.isInteger(job.prey) || !Number.isFinite(job.cargo)
            || job.kind === "materials" && (job.prey !== -1 || job.cargo < 0 || job.cargo > 10))
          || job.kind === "gift" && !job.economic && (!Number.isInteger(job.targetId) || !job.itinerary || !Number.isFinite(job.cargo)
            || job.itinerary.sea && (![job.itinerary.fromLand,job.itinerary.fromWater,job.itinerary.toLand,job.itinerary.toWater].every(validTile)
              || !Array.isArray(job.itinerary.path) || job.itinerary.path.length > SIZE || !job.itinerary.path.every(validTile))))) c.job = null;
        if (c.job?.kind === "energy" && !["wind", "hydro", "nuclear"].includes(c.job.source)) delete c.job.source;
        if (c.job) { c.job.destination = -1; c.job.route = []; c.job.previousX = c.job.x; c.job.previousY = c.job.y; }
        return c;
      }) : [];
      if (!s.cultures || typeof s.cultures !== "object") s.cultures = {};
      for (const realm of Object.keys(s.cultures).map(Number)) if (s.cultures[realm] !== undefined && !Object.hasOwn(NATURES, s.cultures[realm])) s.cultures[realm] = "broker";
      if (!s.diplomacy || typeof s.diplomacy !== "object") s.diplomacy = {};
      for (const [pair, value] of Object.entries(s.diplomacy)) s.diplomacy[pair] = Number.isFinite(value) ? clamp(value, -100, 100) : 0;
      s.nextCommunityId = Math.max(integer(s.nextCommunityId, 1), ...s.communities.map(c => c.id + 1));
      sync(state, world);
    }
    state.nextCivilizationId = Math.max(largest + 1, integer(state.nextCivilizationId, 1));
    Evolution.restore(state);
  }
  return { recordSettlementLoss, hungerCause, NATURES, ACTIONS, sync, commitPopulation, transferTown, members, population, populationBreakdown, adopt, pick, stepWorld, update, order, block, cost, capacity, info, relation, name, creditHunt, origin, restore,
    catalog, withHudCatalogue, ownerKey, knowledge, reservedFaith, batchOrder, renameSettlement, renameCivilization, RESEARCH_COSTS, SPACE_COST, sciencePool,
    guardCapacity, guardUpkeep, basicFoodReserve, finishRecruitment, setDiplomaticGoal, armyBlock, orderArmy,
    prepareScience, finishScience, researchFundingBlock, selectResearch, spaceBlock, selectSpace, receiveScience };
})();
