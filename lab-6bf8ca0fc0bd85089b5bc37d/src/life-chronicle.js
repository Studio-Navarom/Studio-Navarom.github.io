"use strict";

const LifeChronicle = (() => {
  const B = Biosphere;
  const phases = { near: "Před vnitřní hranicí pásma", in: "Ve vhodném pásmu", far: "Za vnější hranicí pásma" };
  const climateKinds = new Set(["phase", "freeze", "thaw", "storm", "clear"]);
  const speciesKinds = new Set(["appearance", "return", "absence", "migration"]);
  const evolutionKinds = new Set(["adaptation", "branch", "extinction", "faunaStage"]);
  const speciesKeys = Object.keys(B.FAUNA);
  const eventLimit = 160, readingLimit = 120;

  function isSettled(s) {
    return Boolean(s.tribes.length || s.towns.some(town => !town.abandoned && town.count > 0));
  }

  function activeAnimals(s) {
    return [
      ...s.herds.filter(herd => herd.size > 0.03),
      ...s.packs.filter(pack => (pack.energy ?? 0.7) > 0.02)
    ];
  }

  const microbialCover = s => s.era >= 1 && Number.isFinite(s.microbeCoverage) ? Math.round(s.microbeCoverage * 100) : 0;

  function population() {
    return { present: false, seen: false, missing: 0, lastMigration: null, exposure: {} };
  }

  function begin(world) {
    const s = world.biosphere;
    const species = Object.fromEntries(speciesKeys.map(key => [key, population()]));
    for (const animal of activeAnimals(s)) {
      if (!Object.hasOwn(species, animal.species)) continue;
      species[animal.species].present = species[animal.species].seen = true;
    }
    return world.lifeChronicle = {
      version: 1, settled: isSettled(s), era: s.era, refuge: s.lifeRefuge ?? 0, storm: s.storm, iceReference: null, phase: null,
      species, events: [], readings: [], totalEvents: 0, lastReading: null, current: null
    };
  }

  function remember(list, entry, limit) {
    list.push(entry);
    if (list.length > limit) list.shift();
  }

  function observe(state, world, radius, zone) {
    const s = world.biosphere, record = world.lifeChronicle ?? begin(world);
    const phase = radius < zone.inner ? "near" : radius > zone.outer ? "far" : "in";
    const cells = B.W * B.H, ice = Math.round(s.iceCover / cells * 100);
    const time = state.time;
    const note = (kind, value) => {
      remember(record.events, { id: ++record.totalEvents, time, kind, value }, eventLimit);
    };

    if (typeof FaunaEvolution !== "undefined") for (const event of FaunaEvolution.events(s)) note(event.kind, event.value);
    if (record.phase && phase !== record.phase) note("phase", phase);
    if (record.iceReference === null) record.iceReference = ice;
    const iceChange = ice - record.iceReference;
    if (Math.abs(iceChange) >= 5) {
      note(iceChange > 0 ? "freeze" : "thaw", ice);
      record.iceReference = ice;
    }
    if (Boolean(s.storm) !== Boolean(record.storm)) note(s.storm ? "storm" : "clear");
    if (s.lifeRefuge && s.lifeRefuge !== record.refuge) note("refuge", s.lifeRefuge);
    if (s.era === 0 && record.era > 0) note("collapse", 0);
    else if (s.era > record.era) note(s.era === 1 && s.lifeRecovery === "recovered" ? "rebirth" : "era", s.era);
    const settled = isSettled(s);
    if (record.settled !== settled) {
      record.settled = settled;
      note(settled ? "settled" : "resettlement");
    }

    const counts = {}, moving = new Set();
    for (const animal of activeAnimals(s)) {
      const key = animal.species, data = Object.hasOwn(record.species, key) && record.species[key];
      if (!data) continue;
      const i = Math.floor(animal.x) + Math.floor(animal.y) * B.W;
      if (!Number.isFinite(s.temperature[i]) || !Number.isFinite(s.wet[i])) continue;
      counts[key] = (counts[key] ?? 0) + 1;
      const exposure = data.exposure[phase] ??= { groupSeconds: 0, temperature: 0, moisture: 0 };
      exposure.groupSeconds += B.STEP;
      exposure.temperature += s.temperature[i] * B.STEP;
      exposure.moisture += s.wet[i] * B.STEP;
      if (!B.FAUNA[key].predator && animal.migrating && Number.isFinite(animal.previousX)
        && (animal.x !== animal.previousX || animal.y !== animal.previousY)) moving.add(key);
    }

    for (const key of speciesKeys) {
      const data = record.species[key];
      if (counts[key]) {
        if (!data.present) {
          note(data.seen ? "return" : "appearance", key);
          data.present = data.seen = true;
        }
        data.missing = 0;
        if (moving.has(key) && (data.lastMigration === null || time - data.lastMigration >= 18)) {
          note("migration", key);
          data.lastMigration = time;
        }
      } else if (data.present && (data.missing += B.STEP) >= 2) {
        data.present = false;
        note("absence", key);
      }
    }

    const phaseChanged = record.phase !== phase;
    record.phase = phase;
    record.era = s.era;
    record.refuge = s.lifeRefuge ?? 0;
    record.storm = s.storm;
    if (phaseChanged || record.lastReading === null || time - record.lastReading >= 2) {
      const climate = {
        time, phase, ice, radius: Math.round(radius), vegetation: Math.round(s.green / cells * 100),
        rain: Math.round(s.rainfall / cells * 100), moisture: Math.round(s.moisture * 100),
        water: Math.round(s.openWater / cells * 100)
      };
      remember(record.readings, climate, readingLimit);
      record.lastReading = time;
      record.current = { climate, counts, microbes: microbialCover(s) };
    }
  }

  function label(event) {
    const name = Object.hasOwn(B.FAUNA, event.value) ? B.FAUNA[event.value].name : "";
    switch (event.kind) {
      case "phase": return "Poloha na dráze · " + phases[event.value];
      case "freeze": return "Led se rozšířil na " + event.value + " % povrchu.";
      case "thaw": return "Podíl ledu na povrchu klesl na " + event.value + " %.";
      case "storm": return "Na povrchu vznikla bouřka.";
      case "clear": return "Bouřka ustoupila.";
      case "era": return "Dosažená etapa života · " + B.eras[event.value];
      case "collapse": return "Původní život na planetě zanikl.";
      case "refuge": return B.refugeText[event.value];
      case "rebirth": return B.rebirthText;
      case "settled": return "Vzniklo osídlení. Přehled života pokračuje jako statistika.";
      case "resettlement": return "Osídlení zaniklo. Přírodní vývoj může vést k novým kmenům.";
      case "appearance": return "První zaznamenané skupiny · " + name;
      case "return": return "Opět zaznamenané skupiny · " + name;
      case "absence": return "Poslední aktivní skupiny zmizely · " + name;
      case "migration": return "Stáda se přesouvají v méně vhodném prostředí · " + name;
      case "faunaStage": return "Vývojové stadium · " + event.value;
      default: return evolutionKinds.has(event.kind) ? event.value : "";
    }
  }

  function validEvent(event) {
    if (!event || !Number.isFinite(event.time) || !Number.isSafeInteger(event.id) || event.id <= 0) return false;
    if (event.kind === "phase") return Object.hasOwn(phases, event.value);
    if (event.kind === "freeze" || event.kind === "thaw") return validPercent(event.value);
    if (evolutionKinds.has(event.kind)) return typeof event.value === "string" && event.value.length <= 240;
    if (speciesKinds.has(event.kind)) return Object.hasOwn(B.FAUNA, event.value);
    if (event.kind === "refuge") return Number.isInteger(event.value) && event.value >= 1 && event.value <= 3;
    if (event.kind === "rebirth") return event.value === 1;
    if (event.kind === "era") return Number.isInteger(event.value) && event.value >= 0 && event.value < B.eras.length;
    return ["collapse", "settled", "resettlement", "storm", "clear"].includes(event.kind);
  }

  const validPercent = value => Number.isFinite(value) && value >= 0 && value <= 100;
  function validReading(item) {
    return item && Number.isFinite(item.time) && Object.hasOwn(phases, item.phase) && Number.isFinite(item.radius)
      && [item.ice, item.vegetation, item.rain, item.moisture, item.water].every(validPercent);
  }

  function restore(world) {
    const old = world.lifeChronicle, record = begin(world);
    if (old?.version !== 1) return;
    record.settled ||= old.settled === true;
    record.events = Array.isArray(old.events) ? old.events.slice(-eventLimit).filter(validEvent) : [];
    record.totalEvents = Math.max(0, ...record.events.map(event => event.id));
    if (world.biosphere.era === 0 && !world.biosphere.lifeRecovery && record.events.some(event => event.kind === "collapse")) {
      B.beginLifeRecovery(world.biosphere);
    }
    record.readings = Array.isArray(old.readings) ? old.readings.slice(-readingLimit).filter(validReading) : [];
    record.lastReading = record.readings.at(-1)?.time ?? null;
    record.iceReference = validPercent(old.iceReference) ? old.iceReference : null;
    record.phase = Object.hasOwn(phases, old.phase) ? old.phase : null;
    for (const key of speciesKeys) {
      const saved = old.species?.[key], target = record.species[key];
      target.seen ||= saved?.seen === true;
      for (const phase of Object.keys(phases)) {
        const sample = saved?.exposure?.[phase];
        if (sample && Number.isFinite(sample.groupSeconds) && sample.groupSeconds > 0
          && Number.isFinite(sample.temperature) && Number.isFinite(sample.moisture)) {
          target.exposure[phase] = { groupSeconds: sample.groupSeconds, temperature: sample.temperature, moisture: sample.moisture };
        }
      }
      if (saved?.present === true && !target.present) {
        target.present = true;
        target.missing = Number.isFinite(saved.missing) ? Math.max(0, Math.min(saved.missing, 2)) : 0;
      }
      if (Number.isFinite(saved?.lastMigration)) target.lastMigration = saved.lastMigration;
    }
    const climate = record.readings.at(-1);
    if (climate) {
      const counts = {};
      for (const animal of activeAnimals(world.biosphere)) {
        if (Object.hasOwn(B.FAUNA, animal.species)) counts[animal.species] = (counts[animal.species] ?? 0) + 1;
      }
      record.current = { climate, counts, microbes: microbialCover(world.biosphere) };
    }
  }

  return { begin, observe, restore, label, phases, isEvolution: event => evolutionKinds.has(event.kind) || ["collapse", "refuge", "rebirth"].includes(event.kind), isClimate: event => climateKinds.has(event.kind) };
})();
