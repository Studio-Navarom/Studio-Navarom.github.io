"use strict";
const Warfare = (() => {
  const B = Biosphere, E = Evolution;
  const RULES = {
    firstRelation: -75, firstFights: 3, firstCombat: 120, capacityLoss: 0.25,
    sustainedLoss: 18, quiet: 210, preparation: 18, retaliationDelay: 20,
    nuclearCooldown: 300, conventionalCooldown: 65, contamination: 100,
    conventional: { energy: 14, supplies: 12 }, nuclear: { energy: 28, supplies: 22 }
  };
  const population = (s, id) => (s.communities ?? []).filter(c => c.active && c.civilization === id && c.people > 0);
  const keyOf = (a, b) => a < b ? a + ":" + b : b + ":" + a;
  const get = s => s.warfare ??= { wars: {}, flights: [], impacts: [], nextSalvo: 1, lockedUntil: 0 };
  const wrapped = (x, width) => ((x + width * 1.5) % width) - width / 2;
  const separation = (a, b) => {
    const x = B.position(a), y = B.position(b);
    return Math.hypot(wrapped(y.x - x.x, B.W), y.y - x.y);
  };
  function strength(s, communities) {
    const own = new Map(communities.map(c => [c.town + 1, c]));
    let total = communities.reduce((n, c) => n + c.people / 1800
      + (E.centerHazard(s, c) ? 0 : 3), 0);
    for (const tile of s.plots) {
      const crew = own.get(s.plotTown[tile]);
      if (!crew || s.damage[tile] >= 0.62 || B.contaminated(s, tile) || !E.ground(s, tile, crew)) continue;
      const type = s.urban[tile];
      if (type === 2) total += 0.24;
      else if (type >= 5) total += 1.25;
    }
    return total;
  }
  function contact(state, world, battle) {
    const s = world.biosphere;
    const ids = battle.sides.map(side => s.towns[side - 1]?.civilization);
    if (!ids[0] || !ids[1] || ids[0] === ids[1]) return;
    const w = get(s), key = keyOf(...ids);
    let war = w.wars[key];
    if (!war || s.time - war.lastContact >= RULES.quiet) {
      war = w.wars[key] = {
        ids, lastContact: s.time, fights: 0, combat: 0, baseline: {}, lossSince: {},
        stance: {}, attempts: {}, conventionalAt: s.time + RULES.conventionalCooldown
      };
      for (const id of ids) war.baseline[id] = strength(s, population(s, id));
    }
    battle.conflictKey = key;
    battle.contactAt = s.time;
    war.lastContact = s.time;
    war.fights++;
    Space.changeRelation(state, ...ids, -18);
  }
  function tickBattle(s, battle) {
    const war = s.warfare?.wars[battle.conflictKey];
    if (!war) return;
    war.combat += B.STEP;
    war.lastContact = s.time;
  }
  function launcher(state, world, id, crew) {
    if (!E.knows(state, id, "space")) return null;
    const s = world.biosphere;
    const sites = crew.filter(c => !E.centerHazard(s, c) && s.damage[c.home] < 0.62);
    const factory = sites.find(c => B.workingFactory(s, s.towns[c.town]));
    if (factory) return s.towns[factory.town].factory;
    return E.spaceflight(state, world, id) ? sites[0]?.home ?? null : null;
  }
  const canPay = (g, cost) => Boolean(g && g.reserve >= cost.energy + 10 && g.supplies >= cost.supplies);
  function targets(s, crew) {
    return crew.slice().sort((a, b) => Number(B.workingFactory(s, s.towns[b.town]))
      - Number(B.workingFactory(s, s.towns[a.town])) || b.people - a.people || a.id - b.id);
  }
  function launch(state, world, w, war, plan, type, from, opponents, grid) {
    const s = world.biosphere, cost = RULES[type];
    const available = targets(s, opponents);
    const target = plan.target === undefined ? available[0] : available.find(c => c.id === plan.target);
    if (!target) return false;
    const second = type === "nuclear" && available.find(c => c.id !== target.id
      && !B.contaminated(s, c.home) && separation(target.home, c.home) >= 9);
    const double = second && canPay(grid, { energy: cost.energy * 2, supplies: cost.supplies * 2 })
      && B.hash(w.nextSalvo, plan.id, s.seed) < 0.33;
    const selected = double ? [target, second] : [target];
    if (!E.pay(state, world, plan.id, { energy: cost.energy * selected.length, supplies: cost.supplies * selected.length }, 10)) return false;
    const salvo = w.nextSalvo++;
    for (const c of selected) w.flights.push({
      salvo, type, from, to: c.home, id: plan.id, enemy: plan.enemy, key: keyOf(plan.id, plan.enemy),
      start: s.time, end: s.time + 5 + separation(from, c.home) / 6
    });
    const message = E.nationLabel(state, plan.id) + " → " + E.nationLabel(state, plan.enemy)
      + (type === "nuclear" ? " · Jaderný odpal" : " · Raketový útok")
      + (selected.length > 1 ? " · " + selected.length + " hlavice" : "");
    Orbit.event(state, world.name + " · " + message, "bad",
      { category: "civic", worldId: world.id, civilization: plan.id, enemy: plan.enemy, tile: target.home, kind: "missile-launch" });
    if (type === "nuclear") {
      if (plan.reply) war.replied = true;
      else war.first = plan.id;
      w.lockedUntil = s.time + RULES.nuclearCooldown;
    }
    return true;
  }
  function impact(state, world, w, shot) {
    const s = world.biosphere, nuclear = shot.type === "nuclear";
    const center = B.position(shot.to), damageRadius = nuclear ? 5 : 1, radius = nuclear ? 6 : damageRadius;
    if (nuclear) s.contamination ??= {};
    for (let y = -radius; y <= radius; y++) for (let x = -radius; x <= radius; x++) {
      const distance = Math.hypot(x, y), row = Math.floor(center.y) + y;
      if (distance > radius || row < 0 || row >= B.H) continue;
      const tile = row * B.W + ((Math.floor(center.x) + x + B.W) % B.W);
      if (s.ocean[tile] && !s.urban[tile] && s.ice[tile] < 0.3) continue;
      const intensity = nuclear && distance > 4 ? 0.20 - (distance - 4) * 0.09 : 1 - distance / (nuclear ? 5 : 2);
      if (nuclear) {
        const duration = distance <= 4 ? 0.65 + 0.35 * intensity : 0.72 - (distance - 4) * 0.16;
        s.contamination[tile] = Math.max(s.contamination[tile] ?? 0, s.time + RULES.contamination * duration);
        s.plants[tile] = 0;
      }
      if (distance <= damageRadius && s.urban[tile]) {
        s.damage[tile] = B.clampValue(s.damage[tile] + intensity * (nuclear ? 0.66 : 0.28), 0, 1);
        s.damageCause[tile] = nuclear ? 10 : 11;
      }
      if (distance <= (nuclear ? 2 : 0)) s.fire[tile] = Math.max(s.fire[tile], nuclear ? 0.83 : 0.58);
    }
    w.impacts.push({ tile: shot.to, time: s.time, type: shot.type, radius, id: shot.id, enemy: shot.enemy, salvo: shot.salvo });
    Orbit.event(state, world.name + " · " + (nuclear ? "Jaderný dopad" : "Dopad rakety")
      + " · " + E.nationLabel(state, shot.id) + " → " + E.nationLabel(state, shot.enemy), "bad",
      { category: "civic", worldId: world.id, civilization: shot.id, enemy: shot.enemy, tile: shot.to, kind: "missile-impact" });
    const war = w.wars[shot.key];
    const owner = s.towns[s.plotTown[shot.to] - 1]?.civilization;
    if (nuclear && war?.first === shot.id && owner === shot.enemy) {
      war.lastContact = s.time;
      war.replyAt ??= s.time + RULES.retaliationDelay;
    }
  }
  const pressured = (s, war, id) => war.lossSince[id] !== undefined && s.time - war.lossSince[id] >= RULES.sustainedLoss;
  function eligible(s, w, war, id, relation) {
    if (relation > RULES.firstRelation || s.time - war.lastContact >= RULES.quiet
      || war.stance[id]?.mode === "calm" && war.stance[id].until > s.time) return false;
    if (war.first) return id !== war.first && !war.replied && war.replyAt !== undefined
      && s.time >= war.replyAt && s.time - war.replyAt <= 70;
    return s.time >= w.lockedUntil && war.fights >= RULES.firstFights && war.combat >= RULES.firstCombat
      && pressured(s, war, id);
  }
  function decide(state, world, w, war) {
    const s = world.biosphere, [a, b] = war.ids, relation = Space.relation(state, a, b);
    const residents = { [a]: population(s, a), [b]: population(s, b) };
    for (const id of war.ids) {
      if (war.baseline[id] > 0 && strength(s, residents[id]) <= war.baseline[id] * (1 - RULES.capacityLoss)) war.lossSince[id] ??= s.time;
      else delete war.lossSince[id];
    }
    if (war.plan) {
      const plan = war.plan, crew = residents[plan.id], opponents = residents[plan.enemy];
      const from = launcher(state, world, plan.id, crew), grid = s.power.grids?.[plan.id];
      const target = opponents.some(c => c.id === plan.target);
      if (from === null || from !== plan.from || !target || !eligible(s, w, war, plan.id, relation)
        || !canPay(grid, RULES.nuclear)) delete war.plan;
      else if (s.time >= plan.at) {
        launch(state, world, w, war, plan, "nuclear", from, opponents, grid);
        delete war.plan;
      }
      return;
    }
    for (const id of war.ids) {
      const enemy = id === a ? b : a, opponents = residents[enemy];
      if (!opponents.length) continue;
      const from = launcher(state, world, id, residents[id]), grid = s.power.grids?.[id];
      if (from === null) continue;
      if (eligible(s, w, war, id, relation) && E.knows(state, id, "robotics") && canPay(grid, RULES.nuclear)
        && s.time >= (war.attempts[id] ?? 0)) {
        war.attempts[id] = s.time + (war.first ? 75 : 30);
        const harder = war.stance[id]?.mode === "hard" && war.stance[id].until > s.time;
        const enemyCanReply = E.knows(state, enemy, "robotics") && launcher(state, world, enemy, opponents) !== null;
        const chance = war.first ? 0.60 : enemyCanReply ? 0.40 : 0.62;
        if (B.hash(Math.floor(s.time / 2), id + enemy * 997, s.seed) < chance + (harder ? 0.14 : 0)) {
          war.plan = { id, enemy, from, target: targets(s, opponents)[0].id,
            reply: Boolean(war.first), at: s.time + RULES.preparation };
          return;
        }
      }
      if (!war.first && war.fights >= 2 && relation <= -50 && s.time >= war.conventionalAt
        && !(war.stance[id]?.mode === "calm" && war.stance[id].until > s.time)
        && launch(state, world, w, war, { id, enemy }, "conventional", from, opponents, grid)) {
        war.conventionalAt = s.time + RULES.conventionalCooldown;
        return;
      }
    }
  }
  function step(state, world) {
    const s = world.biosphere, w = s.warfare;
    if (!w) return;
    w.flights = w.flights.filter(shot => {
      if (s.time < shot.end) return true;
      impact(state, world, w, shot);
      return false;
    });
    w.impacts = w.impacts.filter(hit => s.time - hit.time < (hit.type === "nuclear" ? RULES.contamination : 12));
    if (s.time < (w.nextDecision ?? 0)) return;
    w.nextDecision = s.time + 2;
    for (const tile in s.contamination) if (s.contamination[tile] <= s.time) delete s.contamination[tile];
    for (const [key, war] of Object.entries(w.wars)) {
      if (s.time - war.lastContact >= RULES.quiet && !w.flights.some(shot => shot.key === key)) delete w.wars[key];
      else decide(state, world, w, war);
    }
  }
  function stance(state, world, enemy, mode) {
    const id = state.patron?.id;
    const war = id && world.biosphere.warfare?.wars[keyOf(id, enemy)];
    if (!war || !["calm", "hard"].includes(mode)) return;
    const s = world.biosphere;
    war.stance[id] = { mode, until: s.time + 90 };
    if (mode === "calm") {
      const target = population(s, enemy)[0], source = population(s, id)[0];
      if (target && source) Patronage.setDiplomaticGoal(state, world, source.id, target.id);
    }
  }
  function tensions(state, world, id) {
    const s = world.biosphere;
    return Object.values(s.warfare?.wars ?? {}).filter(war => war.ids.includes(id)
      && war.fights >= 2 && s.time - war.lastContact < RULES.quiet).flatMap(war => {
      const enemy = war.ids.find(side => side !== id);
      const seat = population(s, id)[0];
      return seat && Space.relation(state, id, enemy) <= -50 ? [{ enemy, tile: seat.home,
        mode: war.stance[id]?.until > s.time ? war.stance[id].mode : "" }] : [];
    });
  }
  function restore(s) {
    const tile = i => Number.isInteger(i) && i >= 0 && i < B.W * B.H;
    if (s.contamination) s.contamination = Object.fromEntries(Object.entries(s.contamination)
      .filter(([i, expiry]) => tile(Number(i)) && Number.isFinite(expiry) && expiry > s.time));
    const w = s.warfare;
    if (!w) return;
    if (!w.wars || !Array.isArray(w.flights) || !Array.isArray(w.impacts)) throw new Error("Neplatný záznam konfliktů planety.");
    w.flights = w.flights.filter(shot => shot && tile(shot.from) && tile(shot.to)
      && Number.isFinite(shot.start) && Number.isFinite(shot.end) && shot.end > shot.start);
    w.impacts = w.impacts.filter(hit => hit && tile(hit.tile) && Number.isFinite(hit.time));
    for (const [key, war] of Object.entries(w.wars)) if (!Array.isArray(war?.ids) || war.ids.length !== 2
      || !Number.isFinite(war.combat) || !Number.isFinite(war.lastContact) || !war.baseline || !war.lossSince || !war.stance || !war.attempts)
      delete w.wars[key];
  }
  return { contact, tickBattle, step, tensions, stance, restore };
})();
