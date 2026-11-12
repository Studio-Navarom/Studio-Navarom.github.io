"use strict";

importScripts("journal.js?v=m1-perf-opt5", "biosphere.js?v=m1-perf-opt5",
  "evolution.js?v=m1-perf-opt5", "patronage.js?v=m1-perf-opt5", "orbit.js?v=m1-perf-opt5",
  "space.js?v=m1-perf-opt5", "warfare.js?v=m1-perf-opt5", "fauna-evolution.js?v=m1-perf-opt5",
  "life-chronicle.js?v=m1-perf-opt5", "galaxy.js?v=m1-perf-opt5");

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
      self.postMessage({ info: Galaxy.summary(system), state: data.checkpoint ? system : undefined, stepMilliseconds, stepCount: data.count });
    } else if (data.type === "snapshot") {
      self.postMessage({ state: system });
    }
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
