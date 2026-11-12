"use strict";

const FaunaEvolution = (() => {
  const B = Biosphere;
  const offsets = [-0.12, -0.06, 0, 0.06, 0.12];
  const founder = [0, 0.04, 0.92, 0.04, 0];
  const generationTime = 12, schoolLimit = 8, branchLimit = 24;
  const stages = ["Mikrobiální život", "Vegetace", "Vodní živočichové", "Pobřežní populace", "Suchozemská a ledová zvěř"];
  const mean = genes => genes.shares.reduce((sum, share, i) => sum + share * offsets[i], 0);
  const active = (animal, predator) => predator ? (animal.energy ?? 0.7) > 0.02 : animal.size > 0.03;
  const tile = ({ x, y }) => Math.floor(y) * B.W + Math.floor(x);
  const distance = (a, b) => {
    const dx = Math.abs(a.x - b.x);
    return Math.hypot(Math.min(dx, B.W - dx), a.y - b.y);
  };
  const location = ({ x, y }) => " (pole " + Math.floor(x) + ", " + Math.floor(y) + ")";
  const adaptation = shift => shift < 0 ? "větší snášenlivost chladu" : "větší snášenlivost horka";
  const state = s => s.faunaEvolution ??= {
    branches: {}, nextBranch: 1, schools: [], seedAt: 0, stages: [], events: []
  };
  const genetics = (parent, shares = parent?.shares ?? founder) => ({
    shares: [...shares], fitness: offsets.map(() => 0), time: 0, generation: parent?.generation ?? 0,
    branch: parent?.branch ?? 0, isolated: 0, reported: parent?.reported ?? 0
  });

  function comfort(s, animal, i, baseComfort) {
    const genes = animal.genes;
    if (!genes || !genes.generation) return baseComfort(s, i, animal);
    return genes.shares.reduce((sum, share, j) => sum + share * baseComfort(s, i, animal, offsets[j]), 0);
  }

  function inherit(parent, child) {
    if (parent.genes) child.genes = genetics(parent.genes);
  }

  function name(s, animal) {
    return s.faunaEvolution?.branches[animal.genes?.branch]?.name ?? B.FAUNA[animal.species]?.name ?? "Zvěř";
  }

  function nextGeneration(genes) {
    const selected = genes.shares.map((share, i) => share * Math.exp(genes.fitness[i] / genes.time * 5));
    const total = selected.reduce((sum, value) => sum + value, 0);
    // Small, symmetric variation at each generation. Climate only changes which variants leave offspring.
    genes.shares = selected.map((value, i) => {
      const left = selected[i - 1] ?? value, right = selected[i + 1] ?? value;
      return (value * 0.97 + (left + right) * 0.015) / total;
    });
    genes.fitness.fill(0);
    genes.time = 0;
    genes.generation++;
  }

  function evolve(s, e, groups, baseComfort) {
    const ready = [];
    for (const animal of groups) {
      const genes = animal.genes ??= genetics();
      const i = tile(animal);
      const support = B.FAUNA[animal.species].predator ? animal.energy : B.animalFood(s, i, animal);
      if (support < 0.16 || !B.canBuild(s, i, animal)) continue;
      genes.time += B.STEP;
      for (let j = 0; j < offsets.length; j++) genes.fitness[j] += B.STEP * baseComfort(s, i, animal, offsets[j]);
      if (genes.time >= generationTime) {
        nextGeneration(genes);
        ready.push(animal);
      }
    }
    for (const animal of ready) {
      const genes = animal.genes, shift = mean(genes);
      if (Math.abs(shift) >= 0.03 && Math.sign(shift) !== genes.reported) {
        genes.reported = Math.sign(shift);
        const message = name(s, animal) + " · po " + genes.generation + " generacích se prosazuje " + adaptation(shift) + location(animal) + ".";
        if (!e.events.some(event => event.kind === "adaptation" && event.value === message)) {
          e.events.push({ kind: "adaptation", value: message });
        }
      }
      const others = groups.filter(other => other !== animal && other.species === animal.species
        && (other.genes?.branch ?? 0) === genes.branch);
      const regions = typeof Evolution === "undefined" ? s.region : Evolution.regions(s, animal);
      const region = regions[tile(animal)];
      const near = others.filter(other => distance(animal, other) <= 10 && regions[tile(other)] === region);
      if (near.length) {
        // Exchange inherited variants where groups of the same lineage can actually meet.
        genes.shares = genes.shares.map((share, j) => share * 0.90
          + near.reduce((sum, other) => sum + (other.genes?.shares ?? founder)[j], 0) * 0.10 / near.length);
      }
      const distinct = Math.abs(shift) >= 0.036 && others.some(other => Math.abs(shift - (other.genes ? mean(other.genes) : 0)) >= 0.035);
      genes.isolated = distinct && region && !near.length ? genes.isolated + 1 : 0;
      if (genes.isolated < 4 || genes.generation < 5 || Object.keys(e.branches).length >= branchLimit) continue;
      const id = e.nextBranch++, parent = name(s, animal);
      const branchName = B.FAUNA[animal.species].name + " · " + (shift < 0 ? "chladná" : "teplá") + " větev " + id;
      e.branches[id] = { name: branchName, species: animal.species };
      genes.branch = id;
      genes.isolated = 0;
      e.events.push({ kind: "branch", value: branchName + " vzniká z izolované populace (" + parent + ")" + location(animal) + "." });
    }
    const living = new Set(groups.map(animal => animal.genes?.branch));
    for (const [id, branch] of Object.entries(e.branches)) {
      if (living.has(Number(id))) continue;
      e.events.push({ kind: "extinction", value: branch.name + " · zanikla poslední skupina této větve." });
      delete e.branches[id];
    }
  }

  function waterQuality(s, i) {
    if (s.water[i] <= 0.32 || s.ice[i] >= 0.30 || s.lava[i] >= 0.07) return 0;
    return s.marineFood[i] * Math.max(0, 1 - Math.abs(s.temperature[i] - 0.50) * 1.4);
  }

  function shoreQuality(s, i) {
    if (s.ocean[i] || s.water[i] >= 0.30 || s.ice[i] >= 0.24 || s.fire[i] >= 0.09 || s.lava[i] >= 0.07) return 0;
    const water = Math.max(...s.neighbors.map(side => waterQuality(s, side[i])));
    return water * Math.min(0.9, s.wet[i] * 2);
  }

  function fishing(s, home) {
    const shore = [home, ...s.neighbors.map(side => side[home])];
    if (!shore.some(i => waterQuality(s, i) >= 0.12)) return 0;
    const origin = B.position(home);
    return (s.faunaEvolution?.schools ?? []).reduce((food, group) => {
      const gap = distance(origin, B.position(group.tile));
      if (gap > 5 || group.size < 0.10 || waterQuality(s, group.tile) < 0.12) return food;
      return Math.max(food, group.size * (1 - gap / 6) * 0.35);
    }, 0);
  }

  function hasAquaticRefuge(s) {
    return s.faunaEvolution?.schools.some(group => group.size > 0.10
      && Math.max(waterQuality(s, group.tile), group.coastal ? shoreQuality(s, group.tile) : 0) >= 0.18) ?? false;
  }

  function aquaticLife(s, e) {
    const coastalBefore = e.schools.some(group => group.coastal);
    e.schools = s.era < 2 ? [] : e.schools.filter(group => group.size > 0.03);
    if (coastalBefore && !e.schools.some(group => group.coastal)) {
      e.events.push({ kind: "extinction", value: "Zanikla poslední pobřežní populace." });
    }
    if (s.era < 2) return;
    for (const group of e.schools.slice()) {
      if (s.time >= group.moveAt) {
        group.moveAt = s.time + 1.5;
        const candidates = [group.tile, ...s.neighbors.map(side => side[group.tile])];
        const score = i => {
          const water = waterQuality(s, i), shore = group.coastal ? shoreQuality(s, i) : 0;
          if (Math.max(water, shore) <= 0) return -1;
          const nearShore = s.neighbors.some(side => shoreQuality(s, side[i]) >= 0.12);
          return water + shore * 1.6 + (nearShore ? 0.10 : 0) + B.hash(i, Math.floor(s.time / 1.5), s.seed) * 0.08;
        };
        group.tile = candidates.reduce((best, i) => score(i) > score(best) ? i : best, group.tile);
      }
      const shore = group.coastal ? shoreQuality(s, group.tile) : 0;
      const capacity = Math.max(waterQuality(s, group.tile), shore);
      group.size = B.clampValue(group.size + (capacity - group.size) * 0.04, 0, 1);
      if (capacity < 0.18) continue;
      group.time += B.STEP;
      if (s.neighbors.some(side => shoreQuality(s, side[group.tile]) >= 0.12)) group.coastTime += B.STEP;
      if (group.time < generationTime) continue;
      group.generation++;
      group.coastGenerations = group.coastTime >= group.time * 0.6 ? group.coastGenerations + 1 : 0;
      group.time = group.coastTime = 0;
      if (!group.coastal && group.coastGenerations >= 2 && group.size >= 0.16 && e.schools.length < schoolLimit
        && !e.schools.some(other => other.coastal && distance(B.position(group.tile), B.position(other.tile)) <= 5)) {
        const offspring = group.size * 0.38;
        group.size -= offspring;
        group.coastGenerations = 0;
        e.schools.push({ ...group, size: offspring, coastal: true });
        e.events.push({ kind: "branch", value: "Z vodní populace vzniká pobřežní větev" + location(B.position(group.tile)) + ". Potravu hledá i na vlhkém břehu." });
      }
    }
    if (s.time < e.seedAt || e.schools.length >= schoolLimit
      || e.schools.filter(group => !group.coastal).length >= schoolLimit - 2) return;
    e.seedAt = s.time + 5;
    let best = -1, bestScore = 0;
    for (let i = 0; i < s.water.length; i++) {
      const quality = waterQuality(s, i);
      if (quality < 0.18 || (s.microbes?.[i] ?? 0) < 0.10) continue;
      const coastal = s.neighbors.some(side => shoreQuality(s, side[i]) >= 0.12);
      const score = quality + (coastal ? 0.25 : 0) + B.hash(i, Math.floor(s.time / 5), s.seed) * 0.25;
      if (score <= bestScore || e.schools.some(group => distance(B.position(i), B.position(group.tile)) < 7)) continue;
      best = i; bestScore = score;
    }
    if (best >= 0) e.schools.push({ tile: best, size: 0.26, coastal: false, moveAt: s.time, time: 0,
      generation: 0, coastTime: 0, coastGenerations: 0 });
  }

  function step(s, baseComfort) {
    if (s.era < 1 && !s.faunaEvolution) return;
    const e = state(s);
    const groups = [...s.herds.filter(a => active(a, false)), ...s.packs.filter(a => active(a, true))];
    evolve(s, e, groups, baseComfort);
    aquaticLife(s, e);
    const reached = [s.microbeCoverage > 0.001, s.green > 1,
      e.schools.some(group => !group.coastal && group.size > 0.03),
      e.schools.some(group => group.coastal && group.size > 0.03), groups.length > 0];
    reached.forEach((seen, i) => {
      if (!seen || e.stages.includes(i)) return;
      e.stages.push(i);
      e.events.push({ kind: "faunaStage", value: stages[i] });
    });
    if (e.events.length > 160) e.events.splice(0, e.events.length - 160);
  }

  function events(s) {
    return s.faunaEvolution?.events.splice(0) ?? [];
  }

  function habitatSummary(s) {
    const groups = [
      { label: "Souš", count: 0, climate: 0, food: 0 },
      { label: "Chlad", count: 0, climate: 0, food: 0 },
      { label: "Voda", count: 0, climate: 0, food: 0 }
    ];
    for (const animal of s.herds) {
      if (!active(animal, false)) continue;
      const spec = B.FAUNA[animal.species];
      if (!spec) continue;
      const adaptedToCold = spec.profile === "temperate" && animal.genes && mean(animal.genes) <= -0.03;
      const group = groups[spec.profile === "cold" || adaptedToCold ? 1 : 0], i = tile(animal);
      group.count++;
      if (B.animalFood(s, i, animal) < 0.16) {
        group.food++;
        group.foodTile ??= i;
      } else if (B.animalHabitat(s, i, animal) < 0.42) {
        group.climate++;
        group.climateTile ??= i;
      }
    }
    for (const school of s.faunaEvolution?.schools ?? []) {
      if (school.size <= 0.03) continue;
      groups[2].count++;
      const quality = Math.max(waterQuality(s, school.tile), school.coastal ? shoreQuality(s, school.tile) : 0);
      if (quality < 0.18) {
        groups[2].climate++;
        groups[2].climateTile ??= school.tile;
      }
    }
    return groups;
  }

  function overview(s) {
    const e = s.faunaEvolution;
    const groups = new Map();
    for (const [animals, predator] of [[s.herds, false], [s.packs, true]]) for (const animal of animals) {
      if (!active(animal, predator)) continue;
      const label = name(s, animal), genes = animal.genes;
      const entry = groups.get(label) ?? { label, count: 0, generation: 0, shift: 0 };
      entry.count++;
      if (genes) {
        entry.generation = Math.max(entry.generation, genes.generation);
        if (Math.abs(mean(genes)) > Math.abs(entry.shift)) entry.shift = mean(genes);
      }
      groups.set(label, entry);
    }
    for (const coastal of [false, true]) {
      const schools = e?.schools.filter(group => group.size > 0.03 && group.coastal === coastal) ?? [];
      const label = stages[coastal ? 3 : 2];
      if (schools.length) groups.set(label, { label, count: schools.length,
        generation: Math.max(...schools.map(group => group.generation)), shift: 0 });
    }
    return { groups: [...groups.values()], stages: stages.map((label, i) => ({ label, reached: e?.stages.includes(i) ?? false })) };
  }

  function restore(s) {
    const e = s.faunaEvolution;
    const animals = [...s.herds, ...s.packs];
    if (!e || typeof e !== "object" || Array.isArray(e)) {
      delete s.faunaEvolution;
      for (const animal of animals) delete animal.genes;
      return;
    }
    const natural = value => Number.isSafeInteger(value) && value >= 0;
    const inRange = (value, low, high) => Number.isFinite(value) && value >= low && value <= high;
    const validStage = i => natural(i) && i < stages.length;
    e.stages = [...new Set(Array.isArray(e.stages) ? e.stages.filter(validStage) : [])];
    e.schools = Array.isArray(e.schools) ? e.schools.filter(group => group && natural(group.tile) && group.tile < B.W * B.H
      && inRange(group.size, 0, 1) && Number.isFinite(group.moveAt) && natural(group.generation)
      && inRange(group.time, 0, generationTime) && inRange(group.coastTime, 0, group.time)
      && natural(group.coastGenerations) && typeof group.coastal === "boolean").slice(0, schoolLimit) : [];
    e.branches = Object.fromEntries(Object.entries(e.branches ?? {}).filter(([id, branch]) =>
      natural(Number(id)) && Number(id) > 0 && branch && Object.hasOwn(B.FAUNA, branch.species)
      && typeof branch.name === "string" && branch.name.length <= 100).slice(0, branchLimit));
    e.nextBranch = Math.max(1, natural(e.nextBranch) ? e.nextBranch : 1, ...Object.keys(e.branches).map(id => Number(id) + 1));
    e.seedAt = Number.isFinite(e.seedAt) ? e.seedAt : s.time;
    e.events = [];
    for (const animal of animals) {
      const genes = animal.genes;
      if (!genes) continue;
      const validList = (values, max) => Array.isArray(values) && values.length === offsets.length
        && values.every(value => inRange(value, 0, max + 1e-9));
      if (!inRange(genes.time, 0, generationTime) || !validList(genes.shares, 1)
        || Math.abs(genes.shares.reduce((sum, share) => sum + share, 0) - 1) > 1e-6
        || !validList(genes.fitness, genes.time) || !natural(genes.generation) || !natural(genes.isolated)
        || ![-1, 0, 1].includes(genes.reported)) {
        delete animal.genes;
      } else if (e.branches[genes.branch]?.species !== animal.species) genes.branch = 0;
    }
  }

  return { comfort, inherit, name, step, events, overview, habitatSummary, adaptation, hasAquaticRefuge, fishing, restore };
})();
