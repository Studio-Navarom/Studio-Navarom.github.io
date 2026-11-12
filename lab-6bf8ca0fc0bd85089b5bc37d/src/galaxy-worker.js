"use strict";

importScripts("journal.js?v=m1-perf-opt7", "biosphere.js?v=m1-perf-opt7",
  "evolution.js?v=m1-perf-opt7", "patronage.js?v=m1-perf-opt7", "orbit.js?v=m1-perf-opt7",
  "space.js?v=m1-perf-opt7", "warfare.js?v=m1-perf-opt7", "fauna-evolution.js?v=m1-perf-opt7",
  "life-chronicle.js?v=m1-perf-opt7", "galaxy.js?v=m1-perf-opt7");

let system;
self.onmessage = ({ data }) => {
  try {
    if (data.type === "init") {
      system = data.state;
      self.postMessage({});
    } else if (data.type === "advance") {
      const startedAt = performance.now();
      Galaxy.stepBackground(system, data.count, data.era);
      const stepMilliseconds = performance.now() - startedAt;
      // Report progress immediately. When a safety checkpoint is due, send it
      // separately with a sequence number, so the main thread can continue
      // running while the worker serializes its large world state.
      self.postMessage({ info: Galaxy.summary(system), stepMilliseconds, stepCount: data.count });
      if (data.checkpoint) {
        const cloneStarted = performance.now();
        self.postMessage({ type: "checkpoint", sequence: data.sequence, state: system });
        self.postMessage({ type: "checkpoint-stat", sequence: data.sequence,
          cloneMs: performance.now() - cloneStarted });
      }
    } else if (data.type === "snapshot") {
      self.postMessage({ state: system });
    }
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
