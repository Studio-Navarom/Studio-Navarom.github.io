"use strict";

const Galaxy = (() => {
  const HOME = "Výchozí soustava", LIMIT = 4;
  const sharedTime = state => state.time + (state.galaxyEpoch ?? 0);
  const started = state => sharedTime(state) > 0 || state.worlds.length > 0 || state.nextId > 1 || state.stats.thrown > 0;
  const yieldFrame = () => new Promise(resolve => setTimeout(resolve, 0));

  function enable(state) {
    state.galaxyEpoch ??= 0;
    if (state.galaxySeed === undefined) {
      Evolution.historicalTime(state).months = Evolution.dateAt(state).months;
      state.galaxySeed = Math.floor(Math.random() * 0x100000000);
    }
    return state;
  }

  function withRandom(state, action) {
    const random = Math.random;
    Math.random = () => {
      state.galaxySeed = (Math.imul(state.galaxySeed, 1664525) + 1013904223) >>> 0;
      return state.galaxySeed / 0x100000000;
    };
    try { return action(); }
    finally { Math.random = random; }
  }

  function step(state, era) {
    // Finished systems still share the galaxy clock. Their orbits and life have ended.
    if (state.over) {
      state.time += Orbit.STEP;
      if (era !== undefined) Evolution.advanceCalendar(state, Orbit.STEP, era);
      return;
    }
    if (state.galaxySeed === undefined) Orbit.step(state, Orbit.STEP, era);
    else withRandom(state, () => Orbit.step(state, Orbit.STEP, era));
  }

  function stepBackground(state, count, era) {
    for (let i = 0; i < count; i++) step(state, era);
    // Background events already belong to this system's history. The UI
    // rebuilds its recent log from that history when the player switches.
    state.events.length = 0;
  }

  function summary(state) {
    const nations = new Set();
    let inhabited = 0;
    for (const world of state.worlds) {
      const settlements = (world.biosphere?.communities ?? []).filter(c => c.active && c.people > 0);
      if (settlements.length) inhabited++;
      for (const community of settlements) if (community.civilization) nations.add(community.civilization);
    }
    return { time: sharedTime(state), started: started(state), worlds: state.worlds.length, people: Orbit.residentPopulation(state),
      transit: Orbit.transitPopulation(state), nations: nations.size, inhabited, era: era(state) };
  }

  const era = state => Math.max(Evolution.historicalTime(state).era, ...state.worlds.map(world => world.biosphere?.era ?? 0));

  function copyCalendar(from, to) {
    const calendar = Evolution.historicalTime(from);
    const offset = to.time - from.time;
    to.calendar = { ...calendar, segments: calendar.segments.map(segment => ({ ...segment, time: segment.time + offset })) };
  }

  function createSystem(source, name, planetCount = 0) {
    if (!Number.isInteger(planetCount) || planetCount < 0 || planetCount > Orbit.LIMIT) throw new RangeError("Neplatný počet planet.");
    const state = enable(Orbit.make("biosphere"));
    state.time = sharedTime(source);
    state.visitorAt += state.time;
    copyCalendar(source, state);
    state.events.length = 0;
    state.history.length = 0;
    Orbit.event(state, "Byla založena soustava " + name + ".");
    if (planetCount) withRandom(state, () => {
      for (let i = 0; i < planetCount; i++) {
        const r = 112 + 34 * i + Math.random() * 4, angle = Math.random() * Orbit.TAU;
        const speed = Math.sqrt(Orbit.MU / r);
        state.worldOptions.profile = r < 190 ? "warm" : r <= 290 ? "temperate" : "cold";
        Orbit.launch(state, { x: r * Math.cos(angle), y: r * Math.sin(angle),
          vx: speed * Math.sin(angle), vy: -speed * Math.cos(angle) }, true);
      }
      state.worldOptions.profile = "temperate";
      Orbit.event(state, name + " · Vzniklo " + planetCount + " planet na výchozích kruhových drahách.", "good");
    });
    return state;
  }

  // The worker owns the other system. A checkpoint and deterministic steps allow
  // it to continue locally if the browser stops the worker or refuses to start it.
  function background(initial, workerURL) {
    let state = initial, info = summary(state), sinceCheckpoint = 0;
    const batches = [];
    let worker = null, pending = null, reading = null, disposed = false, reply = null;
    // Execution status is diagnostic metadata, never part of the saved simulation.
    let fallbackReason = workerURL ? "Web Worker není dostupný." : "Hra není spuštěna přes HTTP(S).";
    let lastWorkerStepMs = 0, lastWorkerStepCount = 0, lastWorkerRoundTripMs = 0;

    function closeWorker() {
      worker?.terminate();
      worker = null;
    }

    function request(message) {
      return new Promise((resolve, reject) => {
        const sentAt = performance.now();
        const timer = setTimeout(() => {
          reply = null;
          reject(new Error("Vlákno soustavy neodpovídá."));
        }, 8000);
        reply = {
          resolve(data) {
            clearTimeout(timer);
            if (message.type === "advance") lastWorkerRoundTripMs = performance.now() - sentAt;
            resolve(data);
          },
          reject(error) { clearTimeout(timer); reject(error); }
        };
        try { worker.postMessage(message); }
        catch (error) {
          clearTimeout(timer);
          reply = null;
          reject(error);
        }
      });
    }

    async function recover(extraBatch) {
      fallbackReason = "Výpočetní vlákno selhalo, pokračuje bezpečná obnova na hlavním vlákně.";
      closeWorker();
      const replay = extraBatch ? [...batches, extraBatch] : batches;
      let steps = 0;
      for (const batch of replay) {
        if (disposed) return;
        stepBackground(state, batch.count, batch.era);
        steps += batch.count;
        if (steps >= 8) { steps = 0; await yieldFrame(); }
      }
      sinceCheckpoint = 0;
      batches.length = 0;
      info = summary(state);
    }

    function track(promise) {
      pending = promise.finally(() => { pending = null; });
      // The animation loop polls waiting. Snapshot callers await the same work.
      pending.catch(() => {});
      return pending;
    }

    if (workerURL && typeof Worker !== "undefined") {
      try {
        worker = new Worker(workerURL);
        fallbackReason = "";
        worker.onmessage = ({ data }) => {
          const receiver = reply;
          reply = null;
          if (data.error) receiver?.reject(new Error(data.error));
          else receiver?.resolve(data);
        };
        worker.onerror = event => {
          event.preventDefault();
          const receiver = reply;
          reply = null;
          if (receiver) receiver.reject(new Error("Vlákno soustavy se zastavilo."));
          else if (!disposed) track(recover());
        };
        worker.onmessageerror = () => {
          const receiver = reply;
          reply = null;
          if (receiver) receiver.reject(new Error("Stav soustavy se nepodařilo předat."));
        };
        track(request({ type: "init", state }).catch(() => recover()));
      } catch (error) {
        fallbackReason = "Výpočetní vlákno se nepodařilo vytvořit: " + (error?.message || error);
        closeWorker();
      }
    }

    async function readState() {
      await pending;
      if (disposed) throw new Error("Soustava už byla zavřena.");
      if (worker) {
        const data = await track(request({ type: "snapshot" }).catch(async () => { await recover(); return null; }));
        if (data) { state = data.state; sinceCheckpoint = 0; batches.length = 0; }
      }
      if (disposed) throw new Error("Soustava už byla zavřena.");
      info = summary(state);
      return state;
    }

    return {
      get waiting() { return pending !== null || reading !== null; },
      get threaded() { return worker !== null; },
      get execution() { return worker ? "worker" : "main"; },
      get fallbackReason() { return worker ? "" : fallbackReason; },
      get workerStepMs() { return worker ? lastWorkerStepMs : null; },
      get workerStepCount() { return worker ? lastWorkerStepCount : null; },
      get workerRoundTripMs() { return worker ? lastWorkerRoundTripMs : null; },
      get currentInfo() { return worker ? info : summary(state); },
      get era() { return worker ? info.era : era(state); },
      async syncedInfo() {
        await pending;
        return worker ? info : summary(state);
      },
      advance(count, calendarEra) {
        if (disposed || pending || reading) return;
        if (!worker) {
          stepBackground(state, count, calendarEra);
          return;
        }
        const batch = { count, era: calendarEra };
        track(request({ type: "advance", ...batch, checkpoint: sinceCheckpoint + count >= 900 }).then(data => {
          batches.push(batch);
          sinceCheckpoint += count;
          info = data.info;
          if (Number.isFinite(data.stepMilliseconds)) {
            lastWorkerStepMs = data.stepMilliseconds;
            lastWorkerStepCount = data.stepCount || batch.count;
          }
          if (data.state) { state = data.state; sinceCheckpoint = 0; batches.length = 0; }
        }).catch(() => recover(batch)));
      },
      snapshot() {
        return reading ??= readState().finally(() => { reading = null; });
      },
      dispose() {
        disposed = true;
        const receiver = reply;
        reply = null;
        receiver?.reject(new Error("Soustava byla zavřena."));
        closeWorker();
      }
    };
  }

  return { HOME, LIMIT, sharedTime, started, enable, step, stepBackground, summary, era, copyCalendar, createSystem, background };
})();
