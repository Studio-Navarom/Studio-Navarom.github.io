"use strict";
const Orbit = (() => {
  const TAU = Math.PI * 2;
  const MU = 196000;
  const SUN = 28;
  const INNER = 108;
  const OUTER = 182;
  const BASE_ZONE = { inner: INNER, outer: OUTER };
  const SHORT_PREVIEW = 2.5;
  const PROBE_RADIUS = 3;
  const PROBE_FORECAST = 16;
  const PROBE_DEPARTURE = 1.1;
  const SHIP_ENERGY = { supply: 28, freight: 18, evac: 48 };
  const CARGO = {
    supply: { name: "Zásoby", energy: SHIP_ENERGY.supply, cargo: 44, materials: 0 },
    station: { name: "Teraformační stanice", energy: 82, cargo: 18, materials: 16, plan: "climate" },
    plans: { name: "Technologické plány", energy: SHIP_ENERGY.freight, cargo: 0, materials: 0 }
  };
  const ROUTE_RESERVE = 25, ROUTE_MAX_RESERVE = 100 - CARGO.supply.cargo;
  const EXIT = 820;
  const SOFTENING_SQUARED = 49;
  const ENCOUNTER_PULL = 0.1;
  const IMPULSE = 0.49;
  const MAX_SPEED = 85;
  const STEP = 1 / 90;
  const LIMIT = 18;
  const VISITOR_RADII = [2.8, 4.8, 7.5];
  const VISITOR_WARNING_TIME = 14;
  const GUIDE = { x: 132, y: 0, vx: 0, vy: -Math.sqrt(MU / 132) };
  const NAMES = ["Terra", "Nival", "Vesna", "Rubra", "Ceres", "Tilia", "Vesta", "Echo", "Iris", "Nox", "Fauna", "Lumen"];
  const STAGES = [0, 2.5, 8.5, 16, 27];
  const MASSES = [520, 760, 1040];
  const MASS_LABELS = ["Lehká planeta", "Střední planeta", "Těžká planeta"];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function elements({ x, y, vx, vy }) {
    const r = Math.max(1, Math.hypot(x, y));
    const h = x * vy - y * vx;
    const energy = (vx * vx + vy * vy) / 2 - MU / r;
    const eccentricity = Math.sqrt(Math.max(0, 1 + 2 * energy * h * h / (MU * MU)));
    const peri = h * h / (MU * (1 + eccentricity));
    const major = energy < 0 ? -MU / (2 * energy) : Infinity;
    return { peri, apo: major * (1 + eccentricity), period: TAU * Math.sqrt(major ** 3 / MU) };
  }

  function orbitClass({ peri, apo }, { inner, outer } = BASE_ZONE) {
    if (peri >= inner && apo <= outer) return "green";
    if (peri <= outer && apo >= inner) return "cross";
    return "outside";
  }

  function mutualPull(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const gapSquared = dx * dx + dy * dy;
    // Compare the pair's pull with the star's pull on the more affected world.
    const weightedMass = Math.max(b.mass * (a.x * a.x + a.y * a.y), a.mass * (b.x * b.x + b.y * b.y));
    return Math.sqrt(gapSquared) * weightedMass / (MU * Math.pow(gapSquared + SOFTENING_SQUARED, 1.5));
  }

  function acceleration(bodies, mutualWorlds = true) {
    for (const p of bodies) {
      const pull = -MU / Math.pow(Math.max(16 * 16, p.x * p.x + p.y * p.y), 1.5);
      p.ax = p.x * pull;
      p.ay = p.y * pull;
    }
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      // Probes and visitors are test particles appended after the planets.
      if (a.mass === 0) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        // In stable mode, planets cannot destabilize one another; probes still feel their pull.
        if (!mutualWorlds && b.mass !== 0) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const pull = 1 / Math.pow(dx * dx + dy * dy + SOFTENING_SQUARED, 1.5);
        a.ax += dx * pull * b.mass;
        a.ay += dy * pull * b.mass;
        b.ax -= dx * pull * a.mass;
        b.ay -= dy * pull * a.mass;
      }
    }
  }

  // Leapfrog uses the same gravity model for live motion and the aiming preview.
  function advance(bodies, dt, mutualWorlds = true) {
    const half = dt * 0.5;
    acceleration(bodies, mutualWorlds);
    for (const p of bodies) {
      p.vx += p.ax * half;
      p.vy += p.ay * half;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    acceleration(bodies, mutualWorlds);
    for (const p of bodies) {
      p.vx += p.ax * half;
      p.vy += p.ay * half;
    }
  }

  function touching(a, b) {
    const x = a.x - b.x, y = a.y - b.y, reach = a.radius + b.radius;
    return Math.abs(x) <= reach && Math.abs(y) <= reach && Math.hypot(x, y) <= reach;
  }

  function impacts(bodies, contact) {
    const gone = new Set();
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      if (gone.has(a)) continue;
      const r = Math.hypot(a.x, a.y);
      if (r < SUN + a.radius) {
        gone.add(a);
        contact(a, null, "sun");
        continue;
      }
      if (r > EXIT) {
        gone.add(a);
        contact(a, null, "escape");
        continue;
      }
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        if (gone.has(b) || !touching(a, b)) continue;
        gone.add(a);
        gone.add(b);
        contact(a, b, "collision");
        break;
      }
    }
    if (gone.size) {
      for (let i = bodies.length - 1; i >= 0; i--) {
        if (gone.has(bodies[i])) bodies.splice(i, 1);
      }
    }
  }

  function body(shot, id) {
    const kind = (id - 1) % NAMES.length;
    const tier = kind % MASSES.length;
    const radius = 8.5 + tier * 1.1;
    const name = NAMES[kind] + (id > NAMES.length ? " " + (1 + Math.floor((id - 1) / NAMES.length)) : "");
    return { ...shot, id, name, kind, radius, mass: MASSES[tier], massLabel: MASS_LABELS[tier] };
  }

  function cleanPlanetName(value) {
    return typeof value === "string"
      ? value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 40)
      : "";
  }

  function planetNameTaken(state, name, exceptId) {
    const key = name.toLocaleLowerCase("cs-CZ");
    return state.worlds.some(p => p.id !== exceptId && p.name.toLocaleLowerCase("cs-CZ") === key);
  }

  function copyWorlds(worlds) {
    return worlds.map(p => ({ id: p.id, name: p.name, x: p.x, y: p.y, vx: p.vx, vy: p.vy, mass: p.mass, radius: p.radius }));
  }

  // Predict an actual contact using the same leapfrog gravity as the simulation.
  // A straight-line closest-approach warning is insufficient for curved orbits.
  function predictImpact(state, horizon = 2.6) {
    if (!state.worlds.length) return null;
    const bodies = copyWorlds(state.worlds);
    const dt = STEP * 4;
    for (let elapsed = 0; elapsed <= horizon; elapsed += dt) {
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        if (Math.hypot(a.x, a.y) <= SUN + a.radius) {
          return { kind: "sun", aId: a.id, aName: a.name, bId: null,
            eta: elapsed, x: a.x, y: a.y };
        }
        if (Math.hypot(a.x, a.y) >= EXIT) continue;
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j];
        if (touching(a, b)) {
            return { kind: "collision", aId: a.id, aName: a.name,
              bId: b.id, bName: b.name, eta: elapsed,
              x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          }
        }
      }
      advance(bodies, dt, state.physics !== "stable");
    }
    return null;
  }

  function visitorLabel(visitor) {
    return visitor.comet ? "Kometa" : ["Malý asteroid", "Velký asteroid", "Obří asteroid"][visitor.tier];
  }

  function newVisitor(time) {
    const roll = Math.random();
    const tier = roll < 0.78 ? 0 : roll < 0.96 ? 1 : 2;
    const angle = Math.random() * TAU;
    const entry = EXIT - 18;
    const speed = 28 + Math.random() * 12;
    const peri = 24 + Math.random() ** 1.65 * 225;
    // Set the inbound velocity from the perihelion of an unbound solar orbit.
    const energy = speed * speed / 2 - MU / entry;
    const tangent = peri * Math.sqrt(2 * (energy + MU / peri)) / entry * (Math.random() < 0.5 ? -1 : 1);
    const inward = Math.sqrt(speed * speed - tangent * tangent);
    return { tier, comet: tier === 0 && Math.random() < 0.57, latitude: 0.23 + Math.random() * 0.54,
      x: Math.cos(angle) * entry, y: Math.sin(angle) * entry,
      vx: -Math.cos(angle) * inward - Math.sin(angle) * tangent,
      vy: -Math.sin(angle) * inward + Math.cos(angle) * tangent,
      mass: 0, radius: VISITOR_RADII[tier], trail: [], trailAt: time, scanAt: time, warning: null };
  }

  function visitorTarget(visitor, worlds) {
    return worlds.find(p => distance(p, visitor) <= p.radius + visitor.radius);
  }

  function forecastVisitor(state) {
    if (!state.worlds.some(hasObservatory)) return null;
    const visitor = { ...state.visitor };
    const worlds = copyWorlds(state.worlds);
    const dt = STEP * 5;
    const ignore = () => {};
    for (let elapsed = 0; elapsed <= VISITOR_WARNING_TIME && worlds.length; elapsed += dt) {
      const radius = Math.hypot(visitor.x, visitor.y);
      if (radius <= SUN + visitor.radius || radius >= EXIT) return null;
      const target = visitorTarget(visitor, worlds);
      if (target) {
        const world = state.worlds.find(p => p.id === target.id);
        return hasObservatory(world) ? { worldId: target.id, at: state.time + elapsed } : null;
      }
      advance([...worlds, visitor], dt, state.physics !== "stable");
      impacts(worlds, ignore);
    }
    return null;
  }

  function restoreVisitor(state) {
    const visitor = state.visitor;
    if (!Number.isFinite(state.visitorAt)) state.visitorAt = state.time + 44 + Math.random() * 50;
    if (state.mode !== "biosphere" || !visitor || !Number.isInteger(visitor.tier) || !VISITOR_RADII[visitor.tier]
      || ![visitor.x, visitor.y, visitor.vx, visitor.vy].every(Number.isFinite)) {
      state.visitor = null;
      return;
    }
    visitor.mass = 0;
    visitor.radius = VISITOR_RADII[visitor.tier];
    visitor.comet = visitor.tier === 0 && visitor.comet === true;
    visitor.latitude = Number.isFinite(visitor.latitude) ? clamp(visitor.latitude, 0.23, 0.77) : 0.5;
    visitor.trail = Array.isArray(visitor.trail) ? visitor.trail.filter(p => Number.isFinite(p?.x) && Number.isFinite(p.y)).slice(-74) : [];
    visitor.trailAt = visitor.scanAt = state.time;
    visitor.warning = forecastVisitor(state);
  }

  function predict(shot, worlds, id, full = true, stable = false) {
    const newBody = body(shot, id);
    const copy = copyWorlds(worlds);
    copy.push(newBody);
    const orbit = elements(newBody);
    const duration = full ? clamp(orbit.period * 1.025, 6, 104) : SHORT_PREVIEW;
    const dt = 0.13;
    const points = [{ x: shot.x, y: shot.y }];
    let near = Math.hypot(shot.x, shot.y);
    let far = near;
    let hit = null;
    let planet = null;
    let encounter = null;
    let strongestPull = ENCOUNTER_PULL;
    const check = (a, b, reason) => {
      if (a !== newBody && b !== newBody) return;
      hit = reason;
      planet = a === newBody ? b : a;
    };
    impacts(copy, check);
    for (let i = 0; !hit && i * dt < duration; i++) {
      advance(copy, dt, !stable);
      impacts(copy, check);
      const radius = Math.hypot(newBody.x, newBody.y);
      near = Math.min(near, radius);
      far = Math.max(far, radius);
      for (const other of copy) {
        if (other === newBody) continue;
        const pull = mutualPull(newBody, other);
        if (pull > strongestPull) {
          strongestPull = pull;
          encounter = other.name;
        }
      }
      if (i % 3 === 2 || hit) points.push({ x: newBody.x, y: newBody.y });
    }
    const range = { peri: Math.min(orbit.peri, near), apo: Math.max(orbit.apo, far) };
    return { ...range, points, hit, planet: planet?.name, encounter, massLabel: newBody.massLabel, type: orbitClass(range) };
  }

  function hasObservatory(world) {
    return Boolean(world?.pop > 0 && (world.biosphere ? Biosphere.settlementEra(world.biosphere) >= 6 : world.tech));
  }

  function hasSpaceflight(world) {
    if (world?.biosphere && typeof Evolution !== "undefined") { const state = Evolution.stateOf(world); return state ? Evolution.spaceflight(state, world, world.biosphere.power.viewOwner) : false; }
    const policy = world?.biosphere?.researchPolicy;
    return Boolean(world?.tech && world.pop >= 30 && (!policy || policy.faith >= 10 && policy.spaceFunded) && hasObservatory(world));
  }

  function canLaunchProbe(world) {
    if (world?.biosphere && typeof Space !== "undefined") return !Space.colonyBlock(Evolution.stateOf(world), world);
    if (!hasSpaceflight(world)) return false;
    if (!world.biosphere) return true;
    if (!world.biosphere.researchPolicy) return false;
    const power = world.biosphere.power;
    return power.work >= Biosphere.PROBE_WORK && power.reserve >= Biosphere.PROBE_MIN_RESERVE && world.supply >= Biosphere.PROBE_CARGO;
  }

  function probeBody(from, impulse) {
    const speed = Math.hypot(impulse.vx, impulse.vy);
    if (!Number.isFinite(speed) || speed < 2.6) return null;
    const offset = (from.radius + PROBE_RADIUS + 1) / speed;
    return {
      kind: "probe", mass: 0, radius: PROBE_RADIUS, origin: from.id, age: 0,
      x: from.x + impulse.vx * offset, y: from.y + impulse.vy * offset,
      vx: from.vx + impulse.vx, vy: from.vy + impulse.vy
    };
  }

  function landingRadius(world) {
    return world.radius + PROBE_RADIUS + 7;
  }

  function probeTarget(probe, worlds) {
    return worlds.find(p => (p.id !== probe.origin || probe.age >= PROBE_DEPARTURE)
      && distance(p, probe) <= landingRadius(p));
  }

  // Check the whole traveled segment so a fast probe cannot jump through the star.
  function sunContact(from, to, radius = PROBE_RADIUS) {
    const limit = SUN + radius;
    const c = from.x * from.x + from.y * from.y - limit * limit;
    if (c <= 0) return { x: from.x, y: from.y, fraction: 0 };
    const dx = to.x - from.x, dy = to.y - from.y;
    const a = dx * dx + dy * dy;
    if (a < 1e-16) return null;
    const b = 2 * (from.x * dx + from.y * dy);
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    const fraction = (-b - Math.sqrt(discriminant)) / (2 * a);
    return fraction >= 0 && fraction <= 1 ? { x: from.x + dx * fraction, y: from.y + dy * fraction, fraction } : null;
  }

  function inDeepSpace(probe) {
    const radius = Math.hypot(probe.x, probe.y);
    return radius > EXIT && probe.x * probe.vx + probe.y * probe.vy > 0
      && probe.vx ** 2 + probe.vy ** 2 >= 2 * MU / radius;
  }

  function predictProbe(impulse, worlds, from, stable = false) {
    const probe = probeBody(from, impulse);
    if (!probe) return null;
    const copy = copyWorlds(worlds);
    const points = [{ x: from.x, y: from.y }, { x: probe.x, y: probe.y }];
    const dt = 1 / 20;
    let target;
    let deep = false;
    let sun = false;
    for (let i = 0; i < PROBE_FORECAST / dt; i++) {
      const previous = { x: probe.x, y: probe.y };
      advance([...copy, probe], dt, !stable);
      impacts(copy, () => {});
      probe.age += dt;
      const contact = sunContact(previous, probe, probe.radius);
      if (contact) {
        sun = true; probe.x = contact.x; probe.y = contact.y;
        probe.age -= dt * (1 - contact.fraction);
      } else target = probeTarget(probe, copy);
      if (!sun && !target) {
        deep = inDeepSpace(probe);
      }
      if (i % 4 === 0 || target || deep || sun) points.push({ x: probe.x, y: probe.y });
      if (target || deep || sun) break;
    }
    return { probe: true, points, target: target?.name, returned: target?.id === from.id, deep, sun, hit: sun ? "sun" : null, travel: probe.age };
  }

  function make(mode = "campaign") {
    const state = {
      mode, climateVersion: mode === "biosphere" ? 2 : 1, physics: mode === "biosphere" ? "stable" : "free",
      time: 0, rate: 1, paused: false, worlds: [], ships: [], effects: [], events: [], history: [], staggeredSurfaces: true,
      zone: { ...BASE_ZONE }, mission: null, nextId: 1, probes: [], voyages: [], nextProbeId: 1,
      visitor: null, visitorAt: 44 + Math.random() * 50,
      everCivilization: false, everSpace: false, crisis: false, goal: false, expanded: false, over: false,
      logisticsAt: 0, trafficAt: 0, supplyRoutes: [],
      stats: { thrown: 0, destroyed: 0, losses: 0, peak: 0, crewLost: 0, destroyedProbes: 0 }
    };
    if (typeof Evolution !== "undefined") { Evolution.init(state); Evolution.historicalTime(state); state.evolutionVersion = 1; }
    if (mode === "scenario") {
      const terra = launch(state, GUIDE, true);
      const nivalRadius = 208;
      const angle = -0.94;
      const speed = Math.sqrt(MU / nivalRadius);
      const nival = launch(state, {
        x: nivalRadius * Math.cos(angle), y: nivalRadius * Math.sin(angle),
        vx: -speed * Math.sin(angle), vy: speed * Math.cos(angle)
      }, true);
      Object.assign(terra, {
        age: 32, life: 35, stage: 4, record: 4, nativeFounded: true, tech: true,
        pop: 240000, supply: 90, infrastructure: 1, self: true, inZone: true
      });
      Object.assign(nival, { age: 12, colony: true, tech: true, pop: 28000, supply: 50 });
      state.everCivilization = true;
      state.everSpace = true;
      state.stats.peak = terra.pop + nival.pop;
      event(state, "Terra zásobuje kolonii na studeném Nivalu.");
      prepareMission(state, terra);
    } else {
      event(state, "Soustava je připravena k prvnímu hodu.");
    }
    return state;
  }

  function event(state, message, tone = "", details = {}) {
    const entry = { ...details, time: state.time, message, tone, ...(typeof Evolution !== "undefined" ? { date: Evolution.dateAt(state) } : {}) };
    const action = globalThis.playerActionContext;
    if (action?.state === state) {
      (state.playerChronicle ??= []).push({ ...entry, civilization: action.civilization || state.patron?.id || 0, civilizationName: action.civilization ? action.civilizationName : state.patron?.name ?? action.civilizationName });
    }
    state.events.push(entry);
    (state.history ??= []).push(entry);
    if (state.history.length > 20000) { const removed = state.history.shift(); state.historyTruncatedBefore = removed.time; }
  }

  function launch(state, shot, initial = false, name) {
    const requestedName = cleanPlanetName(name);
    if (state.over || state.worlds.length >= LIMIT || requestedName && planetNameTaken(state, requestedName)) return null;
    const p = {
      ...body(shot, state.nextId++),
      age: 0, life: 0, stage: 0, record: 0, nativeFounded: false, colony: false,
      tech: false, pop: 0, missionPeople: 0, supply: 0, infrastructure: 0, self: false, inZone: false,
      orbit: elements(shot), orbitBaseline: elements(shot), orbitCheck: 0,
      orbitAlert: "ok", orbitAlertKey: "ok", orbitLabel: "STABILNÍ", orbitWarnAt: -100,
      lifeNoticeAt: 0, drought: false, launchAt: 0, supplyRate: 0, frontierTime: 0, frontierReady: false,
      trail: [], trailAt: 0
    };
    if (requestedName) p.name = requestedName;
    else {
      const baseName = p.name;
      for (let suffix = 2; planetNameTaken(state, p.name); suffix++) p.name = baseName + " " + suffix;
    }
    if (state.mode === "biosphere") {
      p.terrainSeed = Math.floor(Math.random() * 0x100000000) >>> 0;
      p.biosphere = Biosphere.create(p.terrainSeed);
      p.weatherClock = nextSurfacePhase(state.worlds);
      if (typeof Evolution !== "undefined") Evolution.configureWorld(state, p);
      if (typeof LifeChronicle !== "undefined") LifeChronicle.begin(p);
    }
    state.worlds.push(p);
    if (!initial) {
      state.stats.thrown++;
      event(state, p.name + " byla vypuštěna.");
    }
    return p;
  }

  const surfacePhase = clock => Number.isFinite(clock) ? ((clock % Biosphere.STEP) + Biosphere.STEP) % Biosphere.STEP : 0;

  // Start in the widest gap between existing surface ticks. Each world keeps
  // the same fixed timestep and continues to evolve while off screen.
  function nextSurfacePhase(worlds) {
    const phases = worlds.filter(p => p.biosphere).map(p => surfacePhase(p.weatherClock)).sort((a, b) => a - b);
    if (!phases.length) return 0;
    let widest = 0, midpoint = 0;
    for (let i = 0; i < phases.length; i++) {
      const end = phases[i + 1] ?? phases[0] + Biosphere.STEP;
      const gap = end - phases[i];
      if (gap <= widest) continue;
      widest = gap;
      midpoint = phases[i] + gap / 2;
    }
    return surfacePhase(midpoint);
  }

  function restoreSurfaceSchedule(state) {
    if (state.staggeredSurfaces === true) return;
    const worlds = state.worlds.filter(p => p.biosphere);
    const origin = surfacePhase(worlds[0]?.weatherClock);
    for (const [i, world] of worlds.entries()) {
      world.weatherClock = surfacePhase(origin + i * Biosphere.STEP / worlds.length);
    }
    state.staggeredSurfaces = true;
  }

  function launchProbe(state, from, impulse, plan) {
    if (state.over || !state.worlds.includes(from) || !canLaunchProbe(from)) return null;
    const surveyedLanding = Boolean(from.biosphere && typeof Space !== "undefined");
    const owner = typeof Evolution !== "undefined" ? state.patron?.id : null;
    const target = plan && state.worlds.find(p => p.id === plan.targetId);
    if (surveyedLanding && (!plan || Space.colonyLaunchIssue(state, from, target, owner, plan))) return null;
    const probe = probeBody(from, impulse);
    if (!probe) return null;
    if (from.biosphere) from.biosphere.power.reserve -= Biosphere.PROBE_ENERGY;
    const id = state.nextProbeId++;
    const name = "Sonda " + String(id).padStart(2, "0");
    const residents = [];
    const profile = surveyedLanding ? Space.selectedCrew(from, owner, plan.profile) : undefined;
    const people = typeof Space !== "undefined" && owner ? Space.takePeople(from, owner, 2400, residents,
      profile) : Math.min(2400, Math.max(12, Math.floor(from.pop * 0.07)));
    const cargo = from.biosphere ? Biosphere.PROBE_CARGO : Math.min(50, from.supply * 0.5);
    const missionPeople = Math.min(from.missionPeople, people);
    if (!(typeof Space !== "undefined" && owner)) from.pop -= people;
    from.missionPeople -= missionPeople;
    from.supply -= cargo;
    Object.assign(probe, {
      id, name, originName: from.name, people, residents, cargo, missionPeople,
      civilization: typeof Patronage !== "undefined" ? Patronage.origin(state, from) : null,
      status: "flight", trail: [], trailAt: 0
    });
    if (surveyedLanding) Object.assign(probe, {surveyedLanding, colonyTarget:target.id, targetName:target.name,
      colonySite:Space.assessment(state, target, owner, profile).tile});
    state.probes.push(probe);
    event(state, name + " s posádkou odstartovala z planety " + from.name + ".");
    return probe;
  }

  function residentPopulation(state) {
    return state.worlds.reduce((sum, p) => sum + p.pop, 0);
  }

  function transitPopulation(state) {
    return state.ships.reduce((sum, ship) => sum + ship.people, 0)
      + state.probes.reduce((sum, probe) => sum + probe.people, 0)
      + state.worlds.reduce((sum, world) => sum + (world.biosphere?.spaceConflicts ?? []).filter(c => !c.finished).reduce((n,c) => n + c.people, 0), 0);
  }

  function population(state) {
    return residentPopulation(state) + transitPopulation(state);
  }

  function prepareMission(state, home) {
    const shift = Math.max(44, Math.ceil(home.orbit.apo - INNER + 12));
    const initialPeople = Math.floor(home.pop);
    home.missionPeople = initialPeople;
    state.mission = {
      phase: "briefing", homeId: home.id, homeName: home.name, duration: clamp(home.orbit.period * 2, 36, 68),
      future: { inner: INNER + shift, outer: OUTER + shift }, priority: "supplies",
      began: 0, evacAt: 0, initialPeople, lastTarget: null,
      driftAnnounced: false, outcome: null
    };
    state.rate = 1;
    event(state, "Slunce zesílí a obyvatelné pásmo se posune. Připrav evakuaci planety " + home.name + ".", "warn");
  }

  function beginMission(state) {
    const mission = state.mission;
    if (mission?.phase !== "briefing") return;
    mission.phase = "active";
    mission.began = state.time;
    mission.evacAt = state.time;
    state.paused = false;
    event(state, "Začal odpočet do přesunu pásma.", "warn");
  }

  function missionTarget(state, candidates = state.worlds) {
    const { homeId, future } = state.mission;
    const home = state.worlds.find(p => p.id === homeId);
    const suitable = candidates.filter(p => p.id !== homeId && viable(p) && orbitClass(p.orbit, future) === "green");
    suitable.sort((a, b) => Number(b.self) - Number(a.self)
      || Number(b.pop > 0) - Number(a.pop > 0)
      || (home ? distance(home, a) - distance(home, b) : a.id - b.id));
    return suitable[0] ?? null;
  }

  function safeEvacuees(state) {
    const { homeId, future } = state.mission;
    let safe = 0;
    const worlds = [];
    for (const p of state.worlds) {
      if (p.id === homeId || !p.self || !p.missionPeople || orbitClass(p.orbit, future) !== "green") continue;
      safe += p.missionPeople;
      worlds.push(p.name);
    }
    return { people: Math.floor(safe), worlds };
  }

  function updateZone(state) {
    const mission = state.mission;
    if (mission?.phase !== "active") return;
    const elapsed = state.time - mission.began;
    const notice = 7;
    const t = clamp((elapsed - notice) / (mission.duration - notice), 0, 1);
    const drift = t * t * (3 - 2 * t);
    state.zone.inner = INNER + (mission.future.inner - INNER) * drift;
    state.zone.outer = OUTER + (mission.future.outer - OUTER) * drift;
    if (t > 0 && !mission.driftAnnounced) {
      mission.driftAnnounced = true;
      event(state, "Zelené pásmo se začalo posouvat od Slunce.", "warn");
    }
  }

  function finishMission(state) {
    const mission = state.mission;
    const saved = safeEvacuees(state);
    const success = saved.people >= Math.ceil(mission.initialPeople / 2);
    mission.outcome = { ...saved, success };
    mission.phase = "finished";
    state.paused = true;
    state.rate = 1;
    event(state, "Přesun pásma skončil. " + (success ? "Evakuace se podařila." : "V bezpečí je méně než polovina obyvatel."), success ? "good" : "warn");
  }

  function stageAt(life) {
    let stage = STAGES.length - 1;
    while (life < STAGES[stage]) stage--;
    return stage;
  }

  function recoverUninhabitedWorld(state, world) {
    const s = world.biosphere;
    if (!s || world.pop > 0 || !s.towns.length) return;
    Biosphere.loseSettlement(s);
    world.nativeFounded = world.colony = world.self = world.frontierReady = false;
    world.frontierTime = world.infrastructure = world.missionPeople = 0;
    if (!s.robotBases.length) {
      world.tech = false;
      delete state.spacePrograms?.[world.id];
    }
    world.stage = [0, 1, 2, 2][s.era];
    markVoyageLoss(state, world, "extinction");
    event(state, world.name + " · Hranice bývalých osad zanikly. Krajina se vrací k přírodnímu vývoji.", "good",
      { kind: "settlement-recovery", worldId: world.id });
  }

  function developBiosphere(state, p, dt, harshness, radius) {
    const surface = p.biosphere;
    recoverUninhabitedWorld(state, p);
    const { inner, outer } = state.zone;
    const heatPerUnit = 0.58 / (outer - inner);
    const heat = typeof Evolution !== "undefined" ? Evolution.heatAt(state,radius) : clamp(0.53 + ((inner + outer) / 2 - radius) * heatPerUnit, -0.62, 1.5);
    const nativeZone = typeof Evolution !== "undefined" ? Evolution.habitatZone(state, p.biosphere.bioProfile) : state.zone;
    const orbitalExposure = clamp(Math.max(nativeZone.inner - p.orbit.peri, p.orbit.apo - nativeZone.outer) * heatPerUnit, 0, 1.5);
    const irradiance = clamp((((inner + outer) / 2) / Math.max(SUN, radius)) ** 2, 0.16, 1.16);
    const power = surface.power;
    const wasReady = power.work >= Biosphere.PROBE_WORK;
    p.weatherClock += dt;
    while (p.weatherClock >= Biosphere.STEP - 1e-8) {
      p.weatherClock -= Biosphere.STEP;
      const researchOwner = typeof Patronage !== "undefined" ? Patronage.prepareScience(state, p) : null;
      const detailed = typeof PerformanceHUD !== "undefined" && PerformanceHUD.active;
      const biosphereAt = detailed ? performance.now() : 0;
      Biosphere.step(surface, { heat, inZone: p.inZone, colony: p.colony && p.pop > 0, supply: p.supply, population: p.pop, orbitalExposure, irradiance, state, world: p },
        (message, tone, category) => event(state, p.name + " · " + message, tone, {category, worldId:p.id}));
      if (detailed) PerformanceHUD.mark("biosphere", performance.now() - biosphereAt);
      Warfare.step(state, p);
      if (typeof LifeChronicle !== "undefined") LifeChronicle.observe(state, p, radius, nativeZone);
      if (typeof Patronage !== "undefined") Patronage.finishScience(state, p, researchOwner);
      const settlementAt = detailed ? performance.now() : 0;
      if (typeof Patronage !== "undefined") Patronage.stepWorld(state, p, Biosphere.STEP);
      if (detailed) PerformanceHUD.mark("settlements", performance.now() - settlementAt);
      if (surface.warCasualties > 0 && p.pop > 1) {
        const lost = Math.min(surface.warCasualties, p.pop - 1);
        p.missionPeople *= 1 - lost / p.pop;
        p.pop -= lost;
        surface.recentPopulationLoss = { cause: "válečné ztráty", at: surface.time, amount: lost };
        state.stats.losses += lost;
      }
    }
    p.stage = [0, 1, 2, 2, 3, 3, 4][Biosphere.settlementEra(surface)];
    if (surface.era >= 4 && surface.tribes.length && p.pop === 0 && !p.nativeFounded && !p.colony) {
      p.nativeFounded = true;
      p.pop = 12000;
      if (!surface.nativeRestart) p.supply = 72;
      p.infrastructure = 0.52;
      state.everCivilization = true;
    }
    const otherSatellite = power.grids && Object.entries(power.grids).some(([id, grid]) => grid.work >= Biosphere.SATELLITE_WORK && grid.program.funded
      && Evolution.science(state, Number(id)).faith >= 10);
    if (p.pop > 0 && !p.tech && (otherSatellite || power.work >= Biosphere.SATELLITE_WORK
      && (!surface.researchPolicy || surface.researchPolicy.faith >= 10 && surface.researchPolicy.spaceFunded))) {
      p.tech = true;
      state.everSpace = true;
      event(state, "Na planetě " + p.name + " odstartovala první družice.", "good");
    }
    if (!wasReady && power.work >= Biosphere.PROBE_WORK) event(state, p.name + " · Planetární síť dokončila kosmodrom.", "good");
    developPopulation(state, p, dt, surface.supported, harshness);
    recoverUninhabitedWorld(state, p);
    const frontier = p.colony && p.pop > 0 && p.supply > 0 && Biosphere.placedStations(surface).length > 0
      && p.orbit.apo > state.zone.outer && viable(p);
    if (!p.frontierReady) {
      p.frontierTime = frontier ? p.frontierTime + dt : 0;
      if (p.frontierTime >= p.orbit.period) {
        p.frontierReady = true;
        event(state, p.name + " · Základna přežila celý oběh.", "good");
      }
    }
  }

  function develop(state, p, dt) {
    p.age += dt;
    const radius = Math.hypot(p.x, p.y);
    const { inner, outer } = state.zone;
    const lifeZone = p.biosphere && typeof Evolution !== "undefined" ? Evolution.habitatZone(state, p.biosphere.bioProfile) : state.zone;
    p.inZone = radius >= lifeZone.inner && radius <= lifeZone.outer;
    if (p.age >= p.orbitCheck) {
      p.orbit = elements(p);
      checkOrbit(state, p);
      p.orbitCheck = p.age + 0.35;
    }
    const stable = orbitClass(p.orbit, state.zone) === "green";
    const harshness = clamp(Math.max(inner - radius, radius - outer) / 29, 0, 1);
    if (p.biosphere) {
      developBiosphere(state, p, dt, harshness, radius);
      return;
    }
    const growth = stable ? 1 : 0.87;
    p.life = clamp(p.life + dt * (p.inZone ? growth : -1.04 - harshness * 1.32), 0, 35);
    const stage = stageAt(p.life);
    if (stage > p.record) {
      p.record = stage;
      const milestones = [
        "", "První mikroby na planetě ", "Rozvinutá biosféra na planetě ",
        "Vznik civilizace na planetě ", "První družice u planety "
      ];
      event(state, milestones[stage] + p.name + ".", stage > 2 ? "good" : "");
    }
    if (stage === 0 && p.stage > 0 && p.age >= p.lifeNoticeAt) {
      event(state, "Původní život na planetě " + p.name + " zanikl po opuštění zóny.", "warn");
      p.lifeNoticeAt = p.age + 14;
    }
    p.stage = stage;

    if (stage >= 3 && !p.nativeFounded && !p.colony && p.pop === 0) {
      p.nativeFounded = true;
      p.pop = 12000;
      p.supply = 82;
      p.infrastructure = 0.52;
      state.everCivilization = true;
    }
    if (stage >= 4 && p.pop > 0 && !p.tech) {
      p.tech = true;
      state.everSpace = true;
    }
    developPopulation(state, p, dt, stable, harshness);
  }

  function developPopulation(state, p, dt, stable, harshness) {
    if (p.biosphere && typeof Evolution !== "undefined") { Evolution.populationStep(state, p, dt); return; }
    if (p.pop <= 0) { p.supplyRate = 0; return; }

    const wasSelf = p.self;
    const protection = clamp(p.biosphere?.townShelter ?? 0, 0, 1);
    const orbitStress = (p.biosphere?.orbitalStress ?? 0) * (1 - protection * 0.82);
    p.infrastructure = clamp(p.infrastructure + dt * ((stable ? 0.16 : -0.105) - orbitStress * 0.042), 0, 1);
    const engineered = (p.biosphere?.legacyClimate ?? 0) >= 0.83 || protection >= 0.65;
    const dryness = p.biosphere?.dryStress ?? 0;
    const frost = p.biosphere?.frostStress ?? 0;
    const hazard = p.biosphere?.disasterRate ?? 0;
    const power = p.biosphere?.power;
    const strain = power?.strain ?? 0;
    const smog = power?.pollution ?? 0;
    const environmentalCosts = Math.max(0, dryness - 0.45) * 22 + frost * 9 + hazard * 28 + orbitStress * 3.1
      + strain * 3.4 + smog * 4.2;
    const fuel = power?.fuelUse ?? 0;
    const trade = (p.biosphere?.trade ?? 0) * (stable ? 1.4 : 0.45);
    p.self = stable && (p.inZone || engineered) && p.infrastructure >= 0.92 && dryness < 0.82 && hazard < 0.09
      && orbitStress < 0.32 && strain < 0.72 && 7.5 + trade >= environmentalCosts + fuel;
    if (p.self && !wasSelf) event(state, p.name + " vyrábí vlastní zásoby.", "good");
    const outpost = p.biosphere && p.colony && !p.self;
    const scale = outpost ? 0.17 + clamp(p.pop / 180000, 0, 1) * 0.17 : 1;
    const change = p.self ? 7.5 : outpost && !p.inZone ? -0.62 - harshness * 0.34 + p.biosphere.shelter * 0.48
      : stable ? 0.75 : outpost ? -0.55 : -(p.inZone ? 2.4 : 3.75 + harshness * 0.8);
    const upkeep = environmentalCosts * scale + fuel;
    p.supplyRate = change + trade - upkeep;
    p.supply = clamp(p.supply + p.supplyRate * dt, 0, 100);
    const starving = p.supply <= 0;
    const mortality = (starving ? 0.43 : 0) + hazard;
    if (mortality > 0) {
      const before = p.pop;
      p.pop *= Math.exp(-mortality * dt);
      if (p.pop < 1) p.pop = 0;
      p.missionPeople *= p.pop / before;
      state.stats.losses += before - p.pop;
      if (starving && !p.drought) {
        event(state, "Na planetě " + p.name + " došly zásoby.", "bad");
        p.drought = true;
      }
      if (p.pop === 0) {
        p.self = false;
        p.tech = false;
        p.infrastructure = 0;
        p.supplyRate = p.frontierTime = 0;
        p.frontierReady = false;
        markVoyageLoss(state, p, "extinction");
        event(state, (p.colony ? "Kolonie" : "Civilizace") + " na planetě " + p.name + " zanikla.", "bad");
      }
    }
    if (!starving) p.drought = false;
    if (!starving && p.pop > 0) {
      let capacity = p.self ? 8200000 : 180000;
      let growthRate = p.self ? 0.115 : 0.034;
      if (p.biosphere) {
        growthRate *= clamp(p.biosphere.foodSecurity ?? 1, 0, 1);
        growthRate *= 0.28 * (1 - dryness * 0.75) * Math.max(0.1, 1 - hazard * 8) * (1 - orbitStress * 0.55);
        const era = Biosphere.settlementEra(p.biosphere);
        if (era >= 6) {
          capacity = Math.min(capacity, 1400000 + 6800000 * clamp(power.age / 190, 0, 1));
          const services = 0.42 + 0.58 * clamp((power.reserve - Biosphere.CITY_RESERVE) / 110, 0, 1);
          growthRate *= 0.53 * Math.sqrt(Math.max(0, 1 - p.pop / capacity)) * services * (1 - strain * 0.85);
        } else {
          capacity = Math.min(capacity, era < 5 ? 90000 : 1400000);
        }
      }
      if (p.pop < capacity) p.pop = Math.min(capacity, p.pop * Math.exp(growthRate * dt));
    }
  }

  function viable(p) {
    return p.age > 0.65 && p.orbit.peri > SUN + p.radius + 5 && p.orbit.apo < EXIT - 25;
  }

  function flightTime(from, to) {
    return clamp(12 + distance(from, to) / 24, 16, 65);
  }

  function route(ship, target) {
    ship.destination = target.id;
    ship.sx = ship.x;
    ship.sy = ship.y;
    ship.elapsed = 0;
    ship.hold = null;
    const dx = target.x - ship.x;
    const dy = target.y - ship.y;
    const gap = Math.max(1, Math.hypot(dx, dy));
    const closest = clamp(-(ship.x * dx + ship.y * dy) / (gap * gap), 0, 1);
    const nearX = ship.x + dx * closest;
    const nearY = ship.y + dy * closest;
    const side = -dy * nearX + dx * nearY >= 0 ? 1 : -1;
    const bow = Math.max(18, 134 - Math.hypot(nearX, nearY));
    ship.bx = -dy / gap * side * bow;
    ship.by = dx / gap * side * bow;
    ship.duration = flightTime(ship, target);
    ship.startAngle = Math.atan2(ship.y, ship.x); ship.startRadius = Math.hypot(ship.x, ship.y);
    ship.targetAngle = ship.lastTargetAngle = Math.atan2(target.y, target.x);
  }

  function send(state, from, to, kind, order = null) {
    const civilization = typeof Patronage !== "undefined" ? Patronage.origin(state, from) : null;
    const spec = order ? CARGO[order.payload] : null;
    if (from.biosphere) from.biosphere.power.reserve -= spec?.energy ?? SHIP_ENERGY[kind];
    let people = 0;
    let cargo = spec?.cargo ?? (kind === "supply" ? CARGO.supply.cargo : 12);
    if (kind === "evac") {
      people = Math.floor(Math.min(from.missionPeople, from.pop * 0.45, Math.ceil(state.mission.initialPeople * 0.13)));
      const founding = to.pop === 0;
      cargo = Math.min(founding ? 30 : 10, from.supply * (founding ? 0.36 : 0.16));
      if (state.mission.lastTarget !== to.id) {
        event(state, "Evakuační lodě míří z planety " + from.name + " na " + to.name + ".", "good");
        state.mission.lastTarget = to.id;
      }
    }
    const residents = [];
    if (typeof Space !== "undefined" && civilization && people > 0) people = Space.takePeople(from, civilization, people, residents);
    else from.pop -= people;
    const missionPeople = Math.min(people, from.missionPeople);
    from.missionPeople -= missionPeople;
    from.supply -= cargo + (spec?.materials ?? 0);
    from.launchAt = state.time + 1.15;
    const ship = { kind, guided: true, people, residents, missionPeople, cargo, x: from.x, y: from.y, heading: 0, origin: from.id, hold: null, trail: [], trailAt: 0,
      civilization };
    if (order) Object.assign(ship, order);
    route(ship, to);
    state.ships.push(ship);
    if (order) event(state, spec.name + " míří z planety " + from.name + " na " + to.name + ".");
    else if (kind === "supply" && to.supply < 30) event(state, "Nouzové zásoby míří na planetu " + to.name + ".");
    return ship;
  }

  function missingPlans(from, to) {
    return Object.keys(Biosphere.RESEARCH).filter(key => Biosphere.knows(from.biosphere, key) && !Biosphere.knows(to.biosphere, key));
  }

  function cargoBlock(state, from, to, payload, reserve = ROUTE_RESERVE) {
    if (state.over || state.mode !== "biosphere" || !Object.hasOwn(CARGO, payload)) return "Let není dostupný.";
    if (!from?.biosphere || !to?.biosphere || from === to || !state.worlds.includes(from) || !state.worlds.includes(to)
      || to.pop <= 0 || !viable(to)) return "Vyber dva různé světy a obydlený cíl na bezpečné dráze.";
    if (typeof Patronage !== "undefined" && !from.biosphere.researchPolicy) return "Dodavatelem může být planeta tvé civilizace.";
    if (!hasSpaceflight(from)) return "Dodavatel potřebuje první družici.";
    const spec = CARGO[payload];
    if (spec.plan && !Biosphere.knows(from.biosphere, spec.plan)) return "Dodavatel potřebuje výzkum " + Biosphere.RESEARCH[spec.plan].name + ".";
    if (spec.plan && !from.biosphere.towns.some(town => Biosphere.workingFactory(from.biosphere, town))) return "Výroba potřebuje funkční továrnu.";
    if (payload === "plans" && !missingPlans(from, to).length) return "Cíl už má všechny dostupné plány dodavatele.";
    if (payload === "station") {
      const reserved = state.ships.filter(ship => ship.destination === to.id && ship.payload === "station").length;
      const kits = to.biosphere.stations.filter(station => station.tile < 0).length;
      if (Biosphere.placedStations(to.biosphere).length + kits + reserved >= Biosphere.MAX_STATIONS)
        return "Cíl už má nebo očekává sady pro všech 12 teraformerů.";
    }
    if (payload !== "supply" && payload !== "station" && state.ships.some(s => s.destination === to.id && s.payload === payload)) return "Stejný náklad už letí.";
    if (state.ships.length >= 14) return "Ve vesmíru už je 14 nákladních lodí.";
    if (from.launchAt > state.time) return "Kosmodrom čeká na další start.";
    if (from.biosphere.power.reserve < spec.energy + Biosphere.CITY_RESERVE) return "Dodavateli chybí energie pro let a rezervu měst.";
    if (from.supply < spec.cargo + spec.materials + reserve) return "Dodavateli by po startu nezůstala nastavená rezerva zásob.";
    return "";
  }

  function launchCargo(state, from, to, payload, reserve) {
    const floor = Number.isFinite(reserve) ? clamp(Math.floor(reserve), 0, ROUTE_MAX_RESERVE) : ROUTE_RESERVE;
    if (cargoBlock(state, from, to, payload, floor)) return null;
    const plans = payload === "plans" ? missingPlans(from, to)
      : payload === "station" ? ["climate"] : [];
    return send(state, from, to, payload === "supply" ? "supply" : "freight", { payload, plans });
  }

  function buildSurfaceTool(state, world, tool, point) {
    if (state.over || !state.worlds.includes(world) || !world?.biosphere) return "Vyber existující svět.";
    if (typeof Evolution !== "undefined" && !Evolution.owns(state, world)) return "Vyber vlastní osadu nebo robotickou základnu.";
    if (tool === "windplant") return Evolution.installWind(state, world, point);
    if (tool === "station" && typeof Evolution !== "undefined") return Evolution.buildStation(state, world, point);
    const s = world.biosphere;
    if (tool === "station") {
      const result = Biosphere.buildStation(s, point, world.supply, world.pop);
      if (!result.error) world.supply -= result.supplies;
      return result.error;
    }
    if (tool !== "hydro") return "Neznámý stavební nástroj.";
    if (typeof Evolution !== "undefined") return Evolution.installOutpostHydro(state, world, point);
    const issue = Biosphere.installHydro(s, point, world.supply);
    if (!issue) world.supply -= Biosphere.HYDRO_SUPPLY;
    return issue;
  }

  function manageBuilding(state, world, id, action) {
    if (state.over || !state.worlds.includes(world) || !world.biosphere) return "Vyber existující planetu.";
    if (action !== "repair" && action !== "demolish") return "Neznámá akce.";
    let successor = null;
    if (typeof Evolution !== "undefined") {
      Evolution.focus(state, world); const b = Biosphere.buildings(world.biosphere).find(b => b.id === id);
      const issue = Evolution.buildingAccess(state, world, b, action);
      if (issue) return issue;
      if (b.ancient) successor = Evolution.ruinSuccessor(state, world, b);
    }
    const result = action === "repair" ? Biosphere.repairBuilding(world.biosphere, id, world.supply, world.pop || world.biosphere.robotBases?.length || 0, successor)
      : Biosphere.demolishBuilding(world.biosphere, id);
    if (result.error) return result.error;
    if (action === "repair") world.supply -= result.supplies;
    event(state, world.name + " · " + result.building.name + (action === "repair" ? " – oprava dokončena." : " – odstraněno."), "good");
    return "";
  }

  function navigationReady(world) {
    return Boolean(world?.biosphere && hasSpaceflight(world) && Biosphere.knows(world.biosphere, "navigation"));
  }

  function routeBlock(state, from, to, backup) {
    if (state.over || state.mode !== "biosphere" || !state.worlds.includes(from) || !state.worlds.includes(to) || from === to
      || !to?.biosphere || to.pop <= 0 || !viable(to))
      return "Vyber dva různé světy a obydlený cíl na bezpečné dráze.";
    if (typeof Patronage !== "undefined" && from?.biosphere && !from.biosphere.researchPolicy) return "Vyber hlavního dodavatele ze své civilizace.";
    if (!navigationReady(from)) return "Hlavní dodavatel potřebuje družici a navigaci.";
    if (backup && (!state.worlds.includes(backup) || backup === from || backup === to || !navigationReady(backup)))
      return "Záloha musí být třetí svět s družicí a navigací.";
    return "";
  }

  function setSupplyRoute(state, from, to, backup, reserve) {
    if (routeBlock(state, from, to, backup) || !Number.isFinite(reserve)) return false;
    const link = { from: from.id, to: to.id, backup: backup?.id ?? null, reserve: clamp(Math.floor(reserve), 0, ROUTE_MAX_RESERVE) };
    const index = state.supplyRoutes.findIndex(plan => plan.to === to.id);
    if (index < 0) state.supplyRoutes.push(link);
    else state.supplyRoutes[index] = link;
    refreshNetwork(state);
    event(state, "Zásobovací linka " + from.name + " → " + to.name + " je nastavená.", "good");
    return true;
  }

  function removeSupplyRoute(state, targetId) {
    const index = state.supplyRoutes.findIndex(route => route.to === targetId);
    if (index < 0) return false;
    state.supplyRoutes.splice(index, 1);
    refreshNetwork(state);
    return true;
  }

  function incomingCargo(state, targetId) {
    const inbound = state.ships.filter(s => s.destination === targetId && s.cargo > 0);
    return { count: inbound.length, amount: inbound.reduce((sum, s) => sum + s.cargo, 0),
      eta: Math.min(...inbound.map(s => Math.max(0, s.duration - s.elapsed))) };
  }

  function routeWorlds(state, plan) {
    const byId = id => state.worlds.find(p => p.id === id);
    return { from: byId(plan.from), to: byId(plan.to), backup: byId(plan.backup) };
  }

  function refreshNetwork(state) {
    if (state.mode !== "biosphere") return;
    const linked = new Set();
    for (const plan of state.supplyRoutes) {
      const { from, to, backup } = routeWorlds(state, plan);
      if (!to?.pop || !viable(to)) continue;
      for (const source of [from, backup]) {
        if (!navigationReady(source)) continue;
        linked.add(source.id);
        linked.add(to.id);
      }
    }
    for (const world of state.worlds) if (world.biosphere) world.biosphere.power.linked = linked.has(world.id);
  }

  function dispatchSupplyRoutes(state) {
    if (typeof Space !== "undefined") { Space.dispatchSupplies(state); return; }
    state.supplyRoutes = state.supplyRoutes.filter(plan => state.worlds.some(p => p.id === plan.to && p.pop > 0));
    refreshNetwork(state);
    for (const plan of state.supplyRoutes) {
      const { from, to, backup } = routeWorlds(state, plan);
      const inbound = incomingCargo(state, to.id);
      if (inbound.count >= 2) continue;
      const source = [from, backup].find(p => navigationReady(p) && !cargoBlock(state, p, to, "supply", plan.reserve));
      if (!source) continue;
      const projected = to.supply + inbound.amount + Math.min(0, to.supplyRate) * flightTime(source, to);
      if (projected <= 56) launchCargo(state, source, to, "supply", plan.reserve);
    }
  }

  function restoreEconomy(state) {
    for (const ship of state.ships) {
      if (ship.payload === "atmosphere") { ship.payload = "plans"; ship.plans = ["climate"]; }
      if (Array.isArray(ship.plans)) ship.plans = ship.plans.filter(key => Object.hasOwn(Biosphere.RESEARCH, key));
    }
    const routes = new Map();
    if (Array.isArray(state.supplyRoutes)) for (const plan of state.supplyRoutes) {
      if (!Number.isInteger(plan?.from) || !Number.isInteger(plan.to) || plan.from === plan.to
        || !state.worlds.some(p => p.id === plan.to)) continue;
      routes.set((plan.civilization ?? state.patron?.id ?? 0) + ":" + plan.to, { from: plan.from, to: plan.to,
        civilization: plan.civilization ?? state.patron?.id ?? 0, amount: Number.isFinite(plan.amount) ? clamp(plan.amount, 1, 60) : 44,
        backup: Number.isInteger(plan.backup) && plan.backup !== plan.to && plan.backup !== plan.from ? plan.backup : null,
        reserve: Number.isFinite(plan.reserve) ? clamp(Math.floor(plan.reserve), 0, ROUTE_MAX_RESERVE) : ROUTE_RESERVE });
    }
    state.supplyRoutes = [...routes.values()];
    for (const p of state.worlds) {
      p.supplyRate = Number.isFinite(p.supplyRate) ? p.supplyRate : 0;
      p.frontierTime = Number.isFinite(p.frontierTime) ? Math.max(0, p.frontierTime) : 0;
      p.frontierReady = p.frontierReady === true && p.pop > 0;
    }
    refreshNetwork(state);
  }

  function canSendShip(world, kind) {
    const floor = kind === "freight" ? Biosphere.PROBE_MIN_RESERVE : Biosphere.CITY_RESERVE;
    return !world.biosphere || world.biosphere.power.reserve >= SHIP_ENERGY[kind] + floor;
  }

  function dispatch(state) {
    if (state.mode === "biosphere") { dispatchSupplyRoutes(state); return; }
    if (state.ships.length >= 14) return;
    const available = state.worlds.filter(p => hasSpaceflight(p) && p.launchAt <= state.time);
    const mission = state.mission?.phase === "active" ? state.mission : null;
    const target = mission ? missionTarget(state) : null;
    const evacuating = mission?.priority === "evacuation";
    if (evacuating && target?.pop > 0 && state.time >= mission.evacAt
      && state.ships.filter(ship => ship.kind === "evac").length < 2) {
      const from = available.find(p => p.id === mission.homeId && p.missionPeople >= 1 && canSendShip(p, "evac"))
        ?? available.find(p => p.missionPeople >= 1 && orbitClass(p.orbit, mission.future) !== "green" && canSendShip(p, "evac"));
      if (from) {
        send(state, from, target, "evac");
        mission.evacAt = state.time + 4.1;
        return;
      }
    }
    const settled = evacuating ? available.filter(p => p.id !== mission.homeId || p.missionPeople < 1) : available;
    const sources = settled.filter(p => p.self && p.supply >= 50 && canSendShip(p, "supply"));
    const destinations = state.worlds.filter(viable);
    const inbound = new Map();
    for (const ship of state.ships) {
      inbound.set(ship.destination, (inbound.get(ship.destination) ?? 0) + ship.cargo);
    }
    const plannedSupply = p => p.supply + (inbound.get(p.id) ?? 0);
    if (mission?.priority === "supplies" && target?.pop > 0 && !target.self
      && plannedSupply(target) < 87 && sources.length) {
      send(state, sources[0], target, "supply");
      return;
    }
    const dependent = destinations
      .filter(p => p.pop > 0 && !p.self && plannedSupply(p) < 69)
      .sort((a, b) => plannedSupply(a) - plannedSupply(b));
    if (sources.length && dependent.length) {
      send(state, sources[0], dependent[0], "supply");
      return;
    }
    const traders = sources.filter(p => canSendShip(p, "freight"));
    if (state.time < state.trafficAt || state.ships.length || traders.length < 2) return;
    state.trafficAt = state.time + 6.5;
    const order = Math.floor(state.time / 6.5) % traders.length;
    send(state, traders[order], traders[(order + 1) % traders.length], "freight");
  }

  function arrive(state, ship, target) {
    if (typeof Space !== "undefined" && ship.missionType) { Space.arrive(state, ship, target); return; }
    if (typeof Space !== "undefined" && target.biosphere && ship.people > 0 && ship.civilization) {
      if (Space.colonize(state, ship, target)) target.missionPeople += ship.missionPeople || 0;
      return;
    }
    if (Object.hasOwn(CARGO, ship.payload)) {
      const surface = target.biosphere;
      if (!surface || target.pop <= 0) {
        event(state, target.name + " · Opuštěná základna nepřevzala náklad.", "warn");
        return;
      }
      if (ship.payload === "station") Biosphere.receiveStation(surface);
      if (Array.isArray(ship.plans)) Biosphere.receivePlans(surface, ship.plans);
      if (Array.isArray(ship.plans) && typeof Patronage !== "undefined") Patronage.receiveScience(state, target, ship.plans);
      event(state, target.name + " · Přistál náklad · " + CARGO[ship.payload].name.toLowerCase()
        + (ship.payload === "station" ? ". Umísti stanici na povrchu." : "."), "good");
    }
    target.supply = clamp(target.supply + ship.cargo, 0, 100);
    if (state.mode !== "biosphere" && target.pop > 0 && (ship.kind === "supply" || ship.kind === "freight")) {
      const source = state.worlds.find(world => world.id === ship.origin && world !== target);
      const grid = source?.biosphere?.power;
      if (grid && hasSpaceflight(source) && grid.work >= Biosphere.PROBE_WORK && !grid.linked) {
        grid.linked = true;
        event(state, source.name + " · Meziplanetární síť doručila náklad na planetu " + target.name + ".", "good");
      }
    }
    if (ship.kind === "supply" && state.mission?.phase === "active" && target === missionTarget(state)) {
      event(state, "Zásoby dorazily na planetu " + target.name + ".");
    }
    if (!ship.people) return;
    const first = target.pop === 0;
    target.pop += ship.people;
    target.missionPeople += ship.missionPeople;
    if (!target.biosphere) target.tech = true;
    if (first) {
      target.colony = true;
      if (target.biosphere && ship.civilization) { target.biosphere.colonialCivilization = ship.civilization; target.biosphere.colonialSeedPending = true; }
      target.infrastructure = Math.max(target.infrastructure, 0.08);
      if (target.biosphere) target.biosphere.power.reserve = Math.max(target.biosphere.power.reserve, 20);
      // Campaign landing alerts may return to normal time. In free evolution,
      // do not silently overwrite the player's 4×/12× time selection.
      if (state.mode !== "biosphere" && target.biosphere && !target.inZone) state.rate = 1;
      if (ship.kind === "evac") event(state, "Evakuační loď přistála na planetě " + target.name + ".", "good");
    }
  }

  function destroyProbe(state, probeId) {
    const index = state.probes.findIndex(p => p.id === probeId);
    if (index < 0) return false;
    const [probe] = state.probes.splice(index, 1);
    loseProbe(state, probe, "self-destruct");
    return true;
  }

  function loseProbe(state, probe, reason) {
    const victims = Math.max(0, probe.people);
    state.stats.losses += victims;
    state.stats.crewLost = (state.stats.crewLost ?? 0) + victims;
    state.stats.destroyedProbes = (state.stats.destroyedProbes ?? 0) + 1;
    recordVoyage(state, probe, "destroyed", null, reason);
    state.effects.push({ x: probe.x, y: probe.y, age: 0, seed: probe.id * 29 + 7, collision: false });
    event(state, probe.name + (reason === "sun" ? " zanikla při pádu do Slunce. Zahynulo " : " byla na rozkaz autodestrukována. Zahynulo ")
      + Math.floor(victims).toLocaleString("cs-CZ") + " členů posádky.", "bad",
      victims ? {kind: "crew-loss", civilization: probe.civilization, cause: reason === "sun" ? "pád sondy do Slunce" : "autodestrukce sondy"} : {});
  }

  function orbitSafety(p, worlds, physics) {
    const orbit = p.orbit;
    if (!orbit || !Number.isFinite(orbit.peri)) return { key: "escape", grade: "bad", label: "ÚNIKOVÁ DRÁHA" };
    if (orbit.peri < SUN + p.radius + 7) return { key: "sun", grade: "bad", label: "RIZIKO PÁDU DO SLUNCE" };
    if (!Number.isFinite(orbit.apo) || orbit.apo >= EXIT - 25)
      return { key: "escape", grade: "bad", label: "HROZÍ ÚNIK ZE SOUSTAVY" };
    for (const other of worlds) {
      if (p === other) continue;
      const dx = other.x - p.x, dy = other.y - p.y;
      const dvx = other.vx - p.vx, dvy = other.vy - p.vy;
      const speed2 = dvx * dvx + dvy * dvy;
      if (speed2 < 0.00001) continue;
      const t = clamp(-(dx * dvx + dy * dvy) / speed2, 0, 2.5);
      const closest = Math.hypot(dx + dvx * t, dy + dvy * t);
      const collision = p.radius + other.radius;
      if (t > 0.05 && closest < collision + 4 && Math.hypot(dx, dy) < 170)
        return { key: "collision:" + other.id, grade: "bad", label: "HROZÍ SRÁŽKA · " + other.name };
    }
    if (physics === "free" && p.orbitBaseline) {
      const b = p.orbitBaseline;
      const shift = Math.max(Math.abs(orbit.peri - b.peri) / Math.max(32, b.peri),
        Math.abs(orbit.apo - b.apo) / Math.max(32, Number.isFinite(b.apo) ? b.apo : orbit.apo));
      if (shift > 0.33) return { key: "drift-bad", grade: "bad", label: "VÝRAZNÁ ZMĚNA DRÁHY" };
      if (shift > 0.13) return { key: "drift", grade: "warn", label: "DRÁHA SE MĚNÍ" };
    }
    return { key: "ok", grade: "ok", label: "STABILNÍ DRÁHA" };
  }

  function checkOrbit(state, p) {
    const risk = orbitSafety(p, state.worlds, state.physics);
    if (risk.key !== p.orbitAlertKey && risk.grade !== "ok" && state.time - (p.orbitWarnAt ?? -100) > 3) {
      event(state, p.name + ": " + risk.label.toLowerCase() + ".", risk.grade === "bad" ? "bad" : "warn");
      p.orbitWarnAt = state.time;
    }
    p.orbitAlertKey = risk.key;
    p.orbitAlert = risk.grade;
    p.orbitLabel = risk.label;
  }

  function recordVoyage(state, probe, status, target, lossReason) {
    const { id, name, originName, people } = probe;
    state.voyages.push({ id, name, originName, people, status, target: target?.name, targetId: target?.id, lossReason });
  }

  function markVoyageLoss(state, world, reason) {
    for (const voyage of state.voyages) {
      if (voyage.status !== "landed" || (voyage.targetId == null ? voyage.target !== world.name : voyage.targetId !== world.id)) continue;
      voyage.status = "colony-lost";
      voyage.lossReason = reason;
    }
  }

  function flyProbe(state, probe, dt, previous) {
    probe.age += dt;
    const contact = sunContact(previous, probe, probe.radius);
    if (contact) {
      probe.x = contact.x; probe.y = contact.y;
      loseProbe(state, probe, "sun");
      return false;
    }
    const target = probeTarget(probe, state.worlds);
    if (target) {
      const returned = target.id === probe.origin;
      const founded = target.pop === 0;
      if (probe.surveyedLanding) {
        if (!returned && target.id !== probe.colonyTarget) {
          const reason = "Loď dorazila k jinému světu, než pro který byla výprava schválena.";
          Space.lost(state, {...probe, targetName:target.name, destination:target.id}, reason);
          recordVoyage(state, probe, "destroyed", target, reason);
          return false;
        }
        if (!Space.colonize(state, probe, target)) {
          recordVoyage(state, probe, "destroyed", target, "Při příletu chybělo bezpečné místo k přistání.");
          return false;
        }
        target.missionPeople += probe.missionPeople || 0;
      } else arrive(state, probe, target);
      recordVoyage(state, probe, returned ? "returned" : "landed", target);
      if (returned) event(state, probe.name + " se vrátila domů na planetu " + target.name + ".", "good");
      else event(state, probe.name + " přistála na planetě " + target.name + (founded ? " a založila kolonii." : "."), "good");
      return false;
    }
    if (inDeepSpace(probe)) {
      recordVoyage(state, probe, "deep");
      event(state, probe.name + " opustila soustavu. Posádka je pohřešovaná, nikoli potvrzeně mrtvá.", "warn");
      return false;
    }
    if (probe.status === "flight" && probe.age >= PROBE_FORECAST) {
      probe.status = "drift";
      event(state, probe.name + " pokračuje na volné dráze.");
    }
    if (probe.age >= probe.trailAt) {
      probe.trail.push({ x: probe.x, y: probe.y });
      if (probe.trail.length > 16) probe.trail.shift();
      probe.trailAt = probe.age + 0.085;
    }
    return true;
  }

  function fly(state, ship, dt) {
    const oldX = ship.x;
    const oldY = ship.y;
    const destroyInSun = contact => {
      const victims = Math.max(0, ship.people);
      state.stats.losses += victims;
      state.stats.crewLost = (state.stats.crewLost ?? 0) + victims;
      state.effects.push({ x: contact.x, y: contact.y, age: 0, seed: (ship.origin ?? 1) * 29 + 7, collision: false });
      if (typeof Space !== "undefined" && ship.missionType) { ship.lossAccounted = true; Space.lost(state, ship, "Pád do Slunce"); }
      event(state, "Loď zanikla při pádu do Slunce." + (victims ? " Zahynulo " + Math.floor(victims).toLocaleString("cs-CZ") + " členů posádky." : " Náklad je ztracen."), "bad",
        victims ? {kind: "crew-loss", civilization: ship.civilization, cause: "pád lodi do Slunce"} : {});
    };
    const initialContact = sunContact(ship, ship);
    if (initialContact) { destroyInSun(initialContact); return false; }
    let target = state.worlds.find(p => p.id === ship.destination);
    if (!target) {
      if (ship.missionType && typeof Space !== "undefined") { Space.lost(state, ship, "Cílový svět zanikl."); return false; }
      if (!ship.people) {
        if (ship.payload) event(state, "Cílový svět zanikl. Náklad byl ztracen.", "bad");
        return false;
      }
      const reserved = new Set(state.ships.filter(s => s !== ship && s.people > 0).map(s => s.destination));
      const landing = state.worlds.filter(p => viable(p) && (ship.kind === "evac" || !reserved.has(p.id)));
      if (ship.kind === "evac") target = missionTarget(state, landing);
      target ??= landing.find(p => orbitClass(p.orbit, state.zone) === "green") ?? landing.find(p => p.pop > 0);
      if (target) {
        route(ship, target);
        event(state, "Osadníci mění kurz k planetě " + target.name + ".", "warn");
      } else {
        if (!ship.hold) {
          ship.hold = { elapsed: 0, angle: Math.atan2(ship.y, ship.x), radius: Math.hypot(ship.x, ship.y) };
          event(state, "Osídlovací loď čeká na nový svět. Palivo vystačí jen na omezenou dobu.", "warn");
        }
        ship.hold.elapsed += dt;
        ship.hold.angle -= dt * 0.16;
        ship.hold.radius += (clamp(ship.hold.radius, 66, 185) - ship.hold.radius) * dt;
        ship.x = Math.cos(ship.hold.angle) * ship.hold.radius;
        ship.y = Math.sin(ship.hold.angle) * ship.hold.radius;
        if (ship.hold.elapsed > 13) {
          state.stats.losses += ship.people;
          event(state, "Osídlovací lodi došlo palivo.", "bad");
          return false;
        }
      }
    }
    if (target) {
      ship.elapsed += dt;
      const t = Math.min(1, ship.elapsed / ship.duration);
      const u = 1 - t;
      if (ship.guided) {
        const angle = Math.atan2(target.y, target.x);
        ship.targetAngle += ((angle - ship.lastTargetAngle + Math.PI * 3) % TAU) - Math.PI;
        ship.lastTargetAngle = angle;
        const start = ship.startAngle ?? Math.atan2(ship.sy, ship.sx);
        let delta = ship.targetAngle - start;
        if (ship.elapsed <= dt * 1.01) { delta = ((delta + Math.PI * 3) % TAU) - Math.PI; ship.targetAngle = start + delta; }
        const heading = start + t * (ship.targetAngle - start), radius = u * (ship.startRadius ?? Math.hypot(ship.sx, ship.sy)) + t * Math.hypot(target.x, target.y);
        ship.x = Math.cos(heading) * radius; ship.y = Math.sin(heading) * radius;
      } else {
        ship.x = u * ship.sx + t * target.x + 2 * u * t * ship.bx;
        ship.y = u * ship.sy + t * target.y + 2 * u * t * ship.by;
      }
      if (ship.people > 0) ship.cargo = Math.max(0, ship.cargo - dt * 0.04 * ship.people / 2400);
    }
    const contact = sunContact({ x: oldX, y: oldY }, ship);
    if (contact) { destroyInSun(contact); return false; }
    if (target && ship.elapsed >= ship.duration) {
      arrive(state, ship, target);
      return false;
    }
    if (Math.abs(oldX - ship.x) + Math.abs(oldY - ship.y) > 0.001) {
      ship.heading = Math.atan2(ship.y - oldY, ship.x - oldX);
    }
    if (state.time >= ship.trailAt) {
      ship.trail.push({ x: ship.x, y: ship.y });
      if (ship.trail.length > 12) ship.trail.shift();
      ship.trailAt = state.time + 0.08;
    }
    return true;
  }

  function loss(state, a, b, reason) {
    const x = b ? (a.x + b.x) / 2 : a.x;
    const y = b ? (a.y + b.y) / 2 : a.y;
    state.stats.destroyed += b ? 2 : 1;
    state.stats.losses += a.pop + (b?.pop ?? 0);
    markVoyageLoss(state, a, reason);
    if (b) markVoyageLoss(state, b, reason);
    const civilizations = [...new Set([a, b].flatMap(world =>
      (world?.biosphere?.communities ?? []).filter(c => c.active && c.people > 0).map(c => c.civilization)))];
    if (reason === "escape") {
      event(state, a.name + " opustila soustavu.", "warn", {kind: "world-loss", civilizations, cause: "opuštění soustavy"});
      return;
    }
    const asteroid = reason === "asteroid";
    state.effects.push({ x, y, age: 0, seed: a.id * 23, collision: Boolean(b) || asteroid, visitor: asteroid });
    const message = asteroid ? "Dopad obřího asteroidu zničil planetu " + a.name + "."
      : b ? "Srážka planet " + a.name + " a " + b.name + " zničila oba světy." : a.name + " shořela při pádu do Slunce.";
    const cause = asteroid ? "dopad obřího asteroidu" : b ? "srážka planet" : "pád do Slunce";
    event(state, message, "bad", {kind: "world-loss", civilizations, cause});
  }

  function strikeWorld(state, world, visitor) {
    if (visitor.tier === 2) {
      loss(state, world, null, "asteroid");
      state.worlds.splice(state.worlds.indexOf(world), 1);
      return;
    }
    const large = visitor.tier === 1;
    let fires = 0;
    if (world.biosphere) {
      const bearing = Math.atan2(visitor.y - world.y, visitor.x - world.x);
      const point = { x: (bearing / TAU + 0.5) * Biosphere.W, y: visitor.latitude * Biosphere.H };
      fires = Biosphere.meteorImpact(world.biosphere, point, large, visitor.comet);
    }
    state.effects.push({ x: world.x, y: world.y, age: 0, seed: world.id * 45 + 9, visitor: true,
      strength: large ? 1 : visitor.comet ? 0.72 : 0.46 });
    if (!large) {
      event(state, world.name + " · " + (visitor.comet ? "Dopad komety poškodil širší okolí kráteru"
        + (fires ? " a založil ohniska požáru." : ".") : "Dopad malého asteroidu vytvořil kráter."), "warn", {category:"surface", worldId:world.id});
      return;
    }
    const victims = Math.min(world.pop * 0.5, Math.max(0, world.pop - 1));
    if (world.pop > 0) world.missionPeople *= (world.pop - victims) / world.pop;
    world.pop -= victims;
    state.stats.losses += victims;
    world.supply *= 0.55;
    if (world.biosphere) world.biosphere.power.reserve *= 0.65;
    world.infrastructure *= 0.72;
    const vx = visitor.vx - world.vx, vy = visitor.vy - world.vy;
    const speed = Math.hypot(vx, vy);
    const circular = Math.sqrt(MU / Math.max(SUN, Math.hypot(world.x, world.y)));
    const kick = Math.min(24 / world.mass, 0.045 * circular / Math.max(speed, 0.001));
    world.vx += vx * kick;
    world.vy += vy * kick;
    world.orbit = elements(world);
    checkOrbit(state, world);
    const toll = victims >= 1 ? " Oběti " + Math.round(victims).toLocaleString("cs-CZ") + "." : "";
    event(state, world.name + " · Velký asteroid poškodil povrch a změnil oběžnou dráhu." + toll, "bad");
  }

  function flyVisitor(state) {
    const visitor = state.visitor;
    const radius = Math.hypot(visitor.x, visitor.y);
    const sun = radius <= SUN + visitor.radius;
    const target = !sun && radius <= EXIT ? visitorTarget(visitor, state.worlds) : null;
    if (sun || radius > EXIT || target) {
      if (target) strikeWorld(state, target, visitor);
      if (sun) state.effects.push({ x: visitor.x, y: visitor.y, age: 0, seed: 371, strength: 0.35 });
      state.visitor = null;
      state.visitorAt = state.time + 65 + Math.random() * 90;
      return;
    }
    if (state.time >= visitor.trailAt) {
      visitor.trail.push({ x: visitor.x, y: visitor.y });
      if (visitor.trail.length > 74) visitor.trail.shift();
      visitor.trailAt = state.time + 0.085;
    }
    if (state.time >= visitor.scanAt) {
      const warning = forecastVisitor(state);
      if (warning && warning.worldId !== visitor.warning?.worldId) {
        const world = state.worlds.find(p => p.id === warning.worldId);
        event(state, world.name + " · Observatoř předpovídá dopad. " + visitorLabel(visitor) + " je na kolizní dráze.", "bad");
      }
      visitor.warning = warning;
      visitor.scanAt = state.time + 0.60;
    } else if (visitor.warning && !hasObservatory(state.worlds.find(p => p.id === visitor.warning.worldId))) {
      visitor.warning = null;
    }
  }

  function independentCount(state) {
    return state.worlds.filter(p => p.self && (state.mode !== "biosphere" || p.orbitAlert !== "bad")).length;
  }

  function step(state, dt = STEP, calendarEra) {
    if (state.over || state.mission?.phase === "briefing") return;
    state.time += dt;
    if (typeof Evolution !== "undefined") Evolution.advanceCalendar(state, dt, calendarEra);
    updateZone(state);
    if (state.mode === "biosphere" && !state.visitor && state.worlds.length && state.time >= state.visitorAt) {
      state.visitor = newVisitor(state.time);
    }
    const probePositions = state.probes.map(probe => ({ x: probe.x, y: probe.y }));
    const moving = state.probes.length || state.visitor ? [...state.worlds, ...state.probes] : state.worlds;
    if (state.visitor) moving.push(state.visitor);
    advance(moving, dt, state.physics !== "stable");
    impacts(state.worlds, (a, b, reason) => loss(state, a, b, reason));
    if (state.visitor) flyVisitor(state);
    const detailed = typeof PerformanceHUD !== "undefined" && PerformanceHUD.active;
    const planetsAt = detailed ? performance.now() : 0;
    for (const p of state.worlds) {
      develop(state, p, dt);
      if (p.age >= p.trailAt) {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 120) p.trail.shift();
        p.trailAt = p.age + 0.14;
      }
    }
    if (detailed) PerformanceHUD.mark("planets", performance.now() - planetsAt);
    for (let i = state.ships.length - 1; i >= 0; i--) {
      if (!fly(state, state.ships[i], dt)) state.ships.splice(i, 1);
    }
    for (let i = state.probes.length - 1; i >= 0; i--) {
      if (!flyProbe(state, state.probes[i], dt, probePositions[i])) state.probes.splice(i, 1);
    }
    if ((state.everSpace || state.supplyRoutes.length) && state.time >= state.logisticsAt) {
      state.logisticsAt = state.time + 0.64;
      dispatch(state);
    }
    const spaceAt = detailed ? performance.now() : 0;
    if (typeof Space !== "undefined") Space.step(state, dt);
    if (detailed) PerformanceHUD.mark("space", performance.now() - spaceAt);
    const patronAt = detailed ? performance.now() : 0;
    if (typeof Patronage !== "undefined") Patronage.update(state);
    if (detailed) PerformanceHUD.mark("patronCheck", performance.now() - patronAt);
    for (let i = state.effects.length - 1; i >= 0; i--) {
      const effect = state.effects[i];
      effect.age += dt;
      if (effect.age > 2.2) state.effects.splice(i, 1);
    }
    const total = population(state);
    state.stats.peak = Math.max(state.stats.peak, total);
    const independent = independentCount(state);
    if (state.mode !== "scenario" && independent >= 2 && !state.goal) {
      state.goal = true;
      event(state, "Dva světy jsou soběstačné.", "good");
    }
    if (state.mode === "biosphere" && independent >= 3 && !state.expanded) {
      state.expanded = true;
      event(state, "Tři světy jsou soběstačné. Soustava může dál růst ve volné hře.", "good");
    }
    if (state.mode === "campaign" && state.goal && !state.mission) {
      const home = state.worlds.find(p => p.self && p.tech && p.pop > 0);
      if (home) prepareMission(state, home);
    }
    const crisis = state.everSpace && independent === 0 && total >= 1;
    if (crisis && !state.crisis) {
      // Keep manual speed control intact in the sandbox. A supply crisis is
      // reported as an event; it must not reset the time multiplier.
      if (state.mode !== "biosphere") state.rate = 1;
      const warning = state.mission?.phase === "active"
        ? "Soustava přišla o zdroj zásob. Kolonie musí přečkat posun pásma se stávajícími zásobami."
        : "Soustava přišla o zdroj zásob. Přidej obyvatelný svět, dokud kolonisté mohou odletět.";
      event(state, warning, "bad");
    }
    state.crisis = crisis;
    if (state.everCivilization && total < 1 && (state.mode !== "biosphere" || !state.worlds.length)) state.over = true;
    if (state.mission?.phase === "active" && state.time - state.mission.began >= state.mission.duration) {
      finishMission(state);
    }
  }

  function launchManaged(state, from, to, options) {
    const ship = { kind: "freight", guided: true, people: 0, missionPeople: 0, cargo: 0, x: from.x, y: from.y, heading: 0,
      origin: from.id, hold: null, trail: [], trailAt: 0, ...options };
    route(ship, to); state.ships.push(ship); return ship;
  }

  return { recoverUninhabitedWorld, restoreSurfaceSchedule, launchManaged, TAU, MU, SUN, INNER, OUTER, EXIT, GUIDE, IMPULSE, MAX_SPEED, STEP, LIMIT, ENCOUNTER_PULL, clamp,
    distance, elements, mutualPull, orbitClass, make, launch, cleanPlanetName, planetNameTaken, step, predict, population, residentPopulation, transitPopulation, independentCount, event,
    beginMission, missionTarget, safeEvacuees, hasSpaceflight, canLaunchProbe, landingRadius,
    predictProbe, launchProbe, destroyProbe, orbitSafety, checkOrbit, predictImpact, visitorLabel, restoreVisitor,
    CARGO, ROUTE_RESERVE, ROUTE_MAX_RESERVE, cargoBlock, launchCargo, buildSurfaceTool, flightTime, navigationReady,
    routeBlock, setSupplyRoute, removeSupplyRoute, incomingCargo, routeWorlds, restoreEconomy, manageBuilding };
})();
