"use strict";
/* M1-PERF: opt-in, read-only diagnostics. No simulation state is changed here. */
const PerformanceHUD = (() => {
  const $ = id => document.getElementById(id);
  const panel = $("perf-panel"), toggle = $("perf-toggle"), exportButton = $("perf-export"), resetButton = $("perf-reset");
  const results = {
    fps: $("perf-fps"), expected: $("perf-expected"), actual: $("perf-actual"),
    steps: $("perf-steps"), simulation: $("perf-simulation"), render: $("perf-render"),
    interface: $("perf-interface"), frame: $("perf-frame"), notes: $("perf-note"),
    history: $("perf-history"), state: $("perf-state")
  };
  let active = false;
  let samples = [];
  let windowStart = 0;
  let frameCount = 0, stepCount = 0, simulationTime = 0, renderTime = 0, interfaceTime = 0, frameTime = 0;
  let currentRate = 1, lastReason = "", recentError = "", currentContext = {}, currentStepSeconds = 1 / 90;
  let detailTimes = Object.create(null), detailCounts = Object.create(null);
  let budgets = 0, budgetFrames = 0, workerBlockFrames = 0, budgetBlockFrames = 0, stepCapBlockFrames = 0;
  const format = value => Number.isFinite(value) ? value.toFixed(1).replace(".", ",") : "—";
  const resetWindow = now => {
    windowStart = now;
    frameCount = stepCount = simulationTime = renderTime = interfaceTime = frameTime = 0;
    lastReason = "";
    detailTimes = Object.create(null); detailCounts = Object.create(null);
    budgets = budgetFrames = workerBlockFrames = budgetBlockFrames = stepCapBlockFrames = 0;
  };
  function updateDisplay(row) {
    if (!row) return;
    results.fps.textContent = format(row.fps);
    results.expected.textContent = row.requestedRate + "×";
    results.actual.textContent = format(row.effectiveRate) + "×";
    results.steps.textContent = format(row.stepsPerSecond) + "/s";
    results.simulation.textContent = format(row.simulationMsPerSecond) + " ms/s";
    results.render.textContent = format(row.renderMsPerSecond) + " ms/s";
    results.interface.textContent = format(row.interfaceMsPerSecond) + " ms/s";
    results.frame.textContent = format(row.busyMsPerFrame) + " ms";
    results.state.textContent = row.context?.phase || "Běží";
    const workerStatus = $("perf-worker-status");
    if (workerStatus) {
      const other = row.context?.otherSystems || 0;
      const running = row.context?.backgroundWorkerSystems || 0;
      const local = row.context?.backgroundMainSystems || 0;
      workerStatus.textContent = !other ? "Vedlejší soustavy: žádné."
        : "Vzdálené soustavy: " + running + " ve Web Workerech, " + local + " na hlavním vlákně."
          + (row.context?.backgroundBusySystems ? " Zpracovává se: " + row.context.backgroundBusySystems + "." : "")
          + (local ? " " + (row.context.backgroundFallbackReasons || []).join(" ") : "");
    }
    const messages = [];
    if (row.reason) messages.push(row.reason);
    if (row.workerBlockedFramePercent > 5) messages.push("Vlákna čekají v " + format(row.workerBlockedFramePercent) + " % snímků.");
    const slower = (row.context?.backgroundWorkerDurations ?? []).reduce((worst, next) =>
      !worst || next.roundTripMs > worst.roundTripMs ? next : worst, null);
    if (slower && row.workerBlockedFramePercent > 10 && slower.roundTripMs > 25) {
      messages.push("Nejpomalejší poslední dávka: " + slower.name + " (" + slower.planets
        + " planet, " + format(slower.roundTripMs) + " ms). ");
    }
    if (row.budgetBlockedFramePercent > 5) messages.push("Simulace využívá časový limit v " + format(row.budgetBlockedFramePercent) + " % snímků.");
    if ((row.context?.backgroundMainSystems || 0) > 0 && (row.context?.otherSystems || 0) > 0) {
      messages.push("Vedlejší soustavy zatěžují hlavní vlákno. Pro hru z disku použij SPUSTIT_COSMOEVOLVE.bat.");
    }
    if (!row.reason && row.requestedRate > 1 && row.effectiveRate < row.requestedRate * .72) {
      messages.push("Počítač pravděpodobně nestíhá cílové tempo; porovnej zátěž simulace, mapy a HUD.");
    }
    if (row.requestedRate >= 4 && row.fps < 25 && !row.reason) messages.push("Nízké FPS mohou omezovat dosažitelnou rychlost.");
    if (recentError) messages.push("Poslední chyba: " + recentError);
    results.notes.textContent = messages.join(" ") || "Zatím bez zjevného omezení. Porovnej měření při 1×, 4× a 12×.";
    results.history.textContent = samples.length + " vzorků · nejvýše 5 minut historie";
    if ($("perf-breakdown")) {
      const labels = { planets: "Vývoj planet (včetně povrchu)", biosphere: "Klima a biosféra", settlements: "Osady a AI", patronSync: "Synchronizace osad", patronCheck: "Kontrola patronátu", space: "Vesmírný program", hudBase: "Původní HUD", hudManagement: "Rozšířená správa", hudCards: "HUD: přehled planet", hudSurface: "HUD: povrch", hudEconomy: "HUD: ekonomika", hudBuildings: "HUD: budovy", hudPatron: "HUD: patronát", hudCatalogueBuild: "HUD: sestavení osad", hudCatalogueReuse: "HUD: opětovné použití katalogu", hudStatus: "HUD: stav", hudVoyages: "HUD: výpravy", hudLog: "HUD: kronika", bioWeather: "Biosféra: počasí a mikrobi", bioConditions: "Biosféra: podmínky", bioVegetation: "Biosféra: vegetace a krize", bioWildlife: "Biosféra: fauna", bioSettlementGrowth: "Biosféra: růst sídel", bioEnergy: "Biosféra: energetika", bioSocieties: "Biosféra: život společnosti" };
      const sorted = Object.entries(row.detailMsPerSecond || {}).sort((a, b) => b[1] - a[1]);
      $("perf-breakdown").textContent = sorted.length ? sorted.map(([key, ms]) =>
        (labels[key] || key) + ": " + format(ms) + " ms/s").join(" · ")
        : "Podrobnosti se zaznamenají při běhu simulace.";
    }
    const scheduler = $("perf-scheduler");
    if (scheduler) scheduler.textContent = "OPT5 · rozpočet " + format(row.averageSimulationBudgetMs) + " ms/snímek"
      + " · limit CPU " + format(row.budgetBlockedFramePercent) + " % snímků"
      + " · čekání na vlákna " + format(row.workerBlockedFramePercent) + " % snímků"
      + " · limit kroků " + format(row.stepCapBlockedFramePercent) + " % snímků";
  }
  function flush(now) {
    if (!windowStart || !frameCount) { resetWindow(now); return; }
    const duration = Math.max(.001, (now - windowStart) / 1000);
    const row = {
      at: new Date().toISOString(),
      durationSeconds: Number(duration.toFixed(3)),
      requestedRate: currentRate,
      effectiveRate: Number((stepCount * currentStepSeconds / duration).toFixed(2)), // measured against the engine's actual timestep
      fps: Number((frameCount / duration).toFixed(1)),
      stepsPerSecond: Number((stepCount / duration).toFixed(1)),
      simulationMsPerSecond: Number((simulationTime / duration).toFixed(2)),
      renderMsPerSecond: Number((renderTime / duration).toFixed(2)),
      interfaceMsPerSecond: Number((interfaceTime / duration).toFixed(2)),
      busyMsPerFrame: Number((frameTime / frameCount).toFixed(2)),
      averageSimulationBudgetMs: Number((budgets / Math.max(1, budgetFrames)).toFixed(2)),
      workerBlockedFramePercent: Number((workerBlockFrames / frameCount * 100).toFixed(2)),
      budgetBlockedFramePercent: Number((budgetBlockFrames / frameCount * 100).toFixed(2)),
      stepCapBlockedFramePercent: Number((stepCapBlockFrames / frameCount * 100).toFixed(2)),
      reason: lastReason,
      context: { ...currentContext },
      // Inclusive sub-metrics (nested categories overlap); do not sum these.
      detailMsPerSecond: Object.fromEntries(Object.entries(detailTimes).map(([key, ms]) => [key, Number((ms / duration).toFixed(2))])),
      detailCallsPerSecond: Object.fromEntries(Object.entries(detailCounts).map(([key, n]) => [key, Number((n / duration).toFixed(2))]))
    };
    samples.push(row);
    if (samples.length > 150) samples.shift();
    updateDisplay(row);
    resetWindow(now);
  }
  function record({ now, steps = 0, rate = 1, stepSeconds = 1 / 90, simMs = 0, drawMs = 0, uiMs = 0, busyMs = 0,
    simBudgetMs = 0, workerBlocked = false, budgetBlocked = false, stepCapBlocked = false, reason = "", context = {} }) {
    if (!active) return;
    // Separate windows for each selected rate: no mixed 1x / 4x / 12x results.
    if (!windowStart) { resetWindow(now); currentRate = rate; }
    if (rate !== currentRate) { flush(now); currentRate = rate; }
    currentStepSeconds = stepSeconds;
    frameCount++;
    stepCount += steps;
    simulationTime += simMs;
    renderTime += drawMs;
    interfaceTime += uiMs;
    frameTime += busyMs;
    if (simBudgetMs > 0) { budgets += simBudgetMs; budgetFrames++; }
    if (workerBlocked) workerBlockFrames++;
    if (budgetBlocked) budgetBlockFrames++;
    if (stepCapBlocked) stepCapBlockFrames++;
    if (reason) lastReason = reason;
    currentContext = context;
    if (now - windowStart >= 2000) flush(now);
  }
  function mark(label, milliseconds) {
    if (!active || !Number.isFinite(milliseconds) || milliseconds < 0) return;
    detailTimes[label] = (detailTimes[label] ?? 0) + milliseconds;
    detailCounts[label] = (detailCounts[label] ?? 0) + 1;
  }
  function clear() {
    samples = [];
    resetWindow(0);
    recentError = "";
    if ($("perf-breakdown")) $("perf-breakdown").textContent = "Měření podrobností dosud nezačalo.";
    if ($("perf-worker-status")) $("perf-worker-status").textContent = "Vedlejší soustavy: čekám na měření.";
    if ($("perf-scheduler")) $("perf-scheduler").textContent = "OPT5: čekám na měření propustnosti a čekání.";
    for (const [name, element] of Object.entries(results)) {
      if (name === "notes") element.textContent = "Nech hru běžet alespoň 2 sekundy, pak porovnej rychlosti.";
      else if (name === "history") element.textContent = "Zatím žádné vzorky";
      else if (name === "state") element.textContent = "Měření zapnuto";
      else element.textContent = "—";
    }
  }
  function enable(value) {
    active = Boolean(value);
    panel.hidden = !active;
    toggle.setAttribute("aria-expanded", String(active));
    toggle.setAttribute("aria-pressed", String(active));
    if (active) clear();
  }
  function exportReport() {
    if (!samples.length) {
      results.notes.textContent = "Pro export počkej alespoň na jeden dokončený dvousekundový vzorek.";
      return;
    }
    const report = {
      application: "CosmoEvolve", version: "M1-PERF OPT5", capturedAt: new Date().toISOString(),
      explanation: "Volitelné měření na tomto počítači. ms/s je čas hlavního vlákna na reálnou sekundu (ne celkové vytížení CPU). Skutečná rychlost je odvozena od provedených simulačních kroků, nikoli od popisku tlačítka. Nezahrnuje dobu výpočtu ve Web Workerech.",
      notes: "Vnořené časy se překrývají. Jednotlivé díly biosféry jsou podmnožinou celkové biosféry, díly HUD podmnožinou původního HUD. Tyto skupiny nesčítejte.",
      diagnostics: { lastError: recentError, sampleCount: samples.length }, samples
    };
    const file = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "CosmoEvolve_M1_PERF_" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
    document.body.append(anchor);
    anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  toggle.addEventListener("click", () => enable(!active));
  resetButton.addEventListener("click", clear);
  exportButton.addEventListener("click", exportReport);
  return {
    get active() { return active; }, record, mark,
    noteError(error) { if (active) recentError = String(error?.message || error).slice(0, 200); },
    enable,
    // Inspectable by automated tests, never modifies simulation or saves.
    getSamples: () => samples.map(row => ({ ...row }))
  };
})();
