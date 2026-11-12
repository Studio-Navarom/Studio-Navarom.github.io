"use strict";

const ids = [
  "patron-strip", "patron-label", "patron-civilization", "patron-population", "patron-overview", "patron-open",
  "resource-hud", "resource-food", "resource-energy", "resource-stock", "resource-faith",
  "economy-energy", "economy-stock", "economy-science", "economy-space",
  "patron-dialog", "patron-description", "patron-food", "patron-food-meter", "patron-food-flow",
  "patron-faction-nav", "patron-faction-prev", "patron-faction-next", "patron-faction-label", "patron-browse", "patron-previous", "patron-next", "patron-position", "patron-selected", "patron-selected-civ", "patron-filter-count",
  "patron-renaming", "patron-settlement-name", "patron-civilization-name", "patron-rename-settlement", "patron-rename-civilization", "patron-batch", "patron-batch-summary",
  "patron-target-prev", "patron-target-next", "patron-target-label", "patron-faith", "patron-faith-next", "patron-guards", "patron-task", "patron-relation", "patron-feedback", "patron-find", "patron-choose",
  "patron-confirm", "patron-confirm-message", "patron-name", "patron-save-feedback", "patron-adopt", "patron-save-adopt", "export-log", "log-filter", "log-quiet", "journal-export-dialog", "journal-export-filter",
  "map", "field", "wordmark", "year", "pause", "readout", "run-status", "forecast",
  "field-name", "surface-map", "surface-open", "surface-readout", "surface-status",
  "map-planet-controls", "map-planet-previous", "map-planet-next", "map-planets-toggle", "map-planet-picker", "map-planets-close",
  "map-picker-label", "map-planet-list-title", "map-context-list", "map-picker-status",
  "surface-tools", "orbit-tools", "weather-tip", "surface-panel", "surface-era", "surface-moisture",
  "surface-rain", "surface-fire", "surface-report", "input-footer",
  "surface-power", "power-stage", "power-reserve", "power-flow", "power-sources",
  "station-tool", "hydro-tool", "station-controls", "station-status", "station-pick",
  "buildings-strip", "buildings-open", "buildings-preview-title", "buildings-preview-summary", "buildings-preview", "buildings-preview-note",
  "buildings-dialog", "buildings-world", "buildings-filter", "buildings-summary", "buildings-list", "buildings-feedback",
  "building-confirm", "building-confirm-title", "building-confirm-text", "building-demolish",
  "economy-strip", "economy-open", "economy-goal", "economy-dialog", "economy-from", "economy-to", "economy-backup",
  "economy-reserve", "economy-research-status", "economy-delivery-status", "economy-route-status", "economy-feedback",
  "economy-route-save", "economy-route-remove", "economy-routes",
  "surface-in", "surface-out", "surface-scale", "surface-fit", "surface-pan",
  "launch-preparation", "world-options", "new-planet-name", "new-planet-name-feedback", "planet-mode", "orbit-in", "orbit-out", "orbit-scale", "orbit-fit",
  "voyages", "voyage-count", "voyage-list", "voyage-losses", "voyage-loss-count", "voyage-loss-list",
  "physics-tools", "orbit-monitor", "orbit-monitor-value", "storage-open", "storage-dialog", "storage-message",
  "impact-banner", "impact-heading", "impact-detail",
  "save-local", "load-local", "export-save", "import-save", "save-file",
  "destroy-probe", "destroy-probe-title", "destroy-probe-detail", "result-crew-lost", "result-missing",
  "forecast-title", "forecast-value", "callout", "callout-title", "callout-text", "live-badge",
  "population", "transit-population", "goal-label", "goal-title", "goal-detail", "world-count", "world-list", "world-navigation", "world-previous", "world-next", "world-position", "empty",
  "ship-count", "log", "help", "restart", "instructions", "reset-confirm", "reset-title", "reset-text",
  "reset-action", "results", "result-note", "result-lost", "result-peak", "result-worlds", "result-throws",
  "mission-bar", "mission-meter", "mission-time", "mission-progress", "mission-start", "mission-priority",
  "legend-forecast", "legend-future", "mission-result", "mission-result-title", "mission-result-note",
  "mission-result-saved", "mission-result-share",
  "galaxy-open", "galaxy-enter", "galaxy-tools", "galaxy-tools-map", "galaxy-status", "galaxy-current", "calendar-label", "result-galaxy", "galaxy-map", "galaxy-form", "galaxy-create", "galaxy-name", "galaxy-limit",
  "galaxy-confirm", "galaxy-confirm-text", "galaxy-delete", "galaxy-cancel-delete", "galaxy-remove-open"
];
const ui = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
const rates = [...document.querySelectorAll("[data-rate]")];
const priorities = [...document.querySelectorAll("[data-priority]")];
const physicsButtons = [...document.querySelectorAll("[data-physics]")];
const weatherTools = [...document.querySelectorAll("[data-weather]")];
const brushSizes = [...document.querySelectorAll("[data-brush-size]")];
const researchButtons = [...document.querySelectorAll("[data-research-key]")];
const cargoButtons = [...document.querySelectorAll("[data-cargo]")];
const stationModes = [...document.querySelectorAll("[data-station-mode]")];
const surfaceReturnButtons = document.querySelectorAll(".surface-return");
const context = ui.map.getContext("2d", { alpha: false });
const groundContext = ui["surface-map"].getContext("2d", { alpha: false });
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const number = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });
const yearAt = time => Evolution.dateAt(sim, time).year;
const compact = new Intl.NumberFormat("cs-CZ", { notation: "compact", maximumFractionDigits: 1 });
const decimal = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 });
const PAGE_SIZES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
const cards = new Map();
const buildingPreviews = new Map();
const guideExamples=new Map();
function starterExample(full) {
  const shot=Evolution.starterShot(sim),key=shot.x+":"+Boolean(full);
  if(!guideExamples.has(key)) guideExamples.set(key,Orbit.predict(shot,[],1,full,sim.physics==="stable"));
  return guideExamples.get(key);
}
const ORBIT_FIT = Object.freeze({ zoom: 1, x: 0, y: 0 });
const ORBIT_MAX_ZOOM = 9;

let sim = Orbit.make("biosphere");
const galaxyOthers = new Map();
let galaxyId = 0, galaxyName = Galaxy.HOME, galaxyNextId = 1, galaxyBusy = false, galaxyRemoval = null;
let galaxyViewing = false, galaxySelected = 0;
let selected = 0;
let launchMode = null;
let voyageKey = "";
let pendingProbeId = null;
let orbitCamera = null;
let orbitDirty = true;
let view;
let backdrop;
let renderedInner;
let pointer = null;
let keyboard = null;
let aim = null;
let pendingShot = null;
let nextForecast = 0;
let lastFrame = 0;
// M1-PERF OPT4: frame scheduler. The adaptive allowance responds to the real
// cost of painting and UI, without changing a single physics/biosphere step.
// Browser refresh rate (typically 30 or 60 Hz) is inferred from frame timestamps.
let frameIntervalEstimate = 33.3;
let frameFixedCostEstimate = 6;
let frameCpuDuration = 0;
function simulationFrameBudget() {
  const target = frameIntervalEstimate < 24 ? 16.67 : 33.33;
  return Math.max(7.5, Math.min(24, target - frameFixedCostEstimate - 3));
}
function accountFrameWork(totalMs, simMs) {
  const fixed = Math.max(0, Math.min(45, totalMs - simMs));
  frameFixedCostEstimate = frameFixedCostEstimate * 0.88 + fixed * 0.12;
  frameCpuDuration = totalMs;
}
// A simulation/render error must not permanently lose the animation loop. A
// rate change can restart a stopped loop without spawning a second one.
let frameQueued = false;
let consecutiveFrameErrors = 0;
let lastFrameError = "";
function queueGameFrame() {
  if (frameQueued) return;
  frameQueued = true;
  requestAnimationFrame(now => {
    frameQueued = false;
    try {
      frame(now);
      consecutiveFrameErrors = 0;
    } catch (error) {
      PerformanceHUD.noteError(error);
      console.error("CosmoEvolve: simulační/vykreslovací chyba", error);
      const message = String(error?.message || error);
      if (lastFrameError !== message) {
        lastFrameError = message;
        const feedback = document.getElementById("clock-feedback");
        if (feedback) { feedback.textContent = "Simulace byla po chybě pozastavena. Zkus znovu 1×/4×/12× nebo exportuj uloženou hru."; feedback.hidden = false; }
      }
      sim.paused = true;
      accumulator = 0;
      lastFrame = 0;
      if (++consecutiveFrameErrors < 2) queueGameFrame();
    }
  });
}
let accumulator = 0;
let nextUI = 0;
let perfContextAt = 0, perfContextCache = {};
let afterEnd = 0;
let resultsShown = false;
let missionResultShown = false;
let missionCheckpoint = null;
let surfaceId = 0;
let stationPickerWorld = 0;
let preferredStation = 0;
let buildingFocus = null;
let pendingDemolition = null;
let pendingPatron = null;
let adoptingPatron = false;
let patronBrowser = { filter: "mine", faction: "", selected: "", target: "", batch: false };
let weatherTool = "wind";
let weatherRadius = Biosphere.BRUSH_RADII.medium;
let weatherPointer = null;
let groundCursor = null;
let windStart = null;
let nextGroundFrame = 0;
let surfaceCamera = SurfaceView.FIT;
let surfacePan = false;
let impactScene = null;
let nextImpactScan = 0;
let impactDraw = null;

function drawWordmark() {
  const letters = {
    C: ["01111", "11000", "11000", "11000", "11000", "11000", "01111"],
    O: ["01110", "11011", "11011", "11011", "11011", "11011", "01110"],
    S: ["01111", "11000", "11000", "01110", "00011", "00011", "11110"],
    M: ["10001", "11011", "11111", "10101", "10001", "10001", "10001"],
    E: ["11111", "11000", "11000", "11110", "11000", "11000", "11111"],
    V: ["11011", "11011", "11011", "11011", "11011", "01010", "00100"],
    L: ["11000", "11000", "11000", "11000", "11000", "11000", "11111"]
  };
  const add = (word, start, fill) => {
    let drawing = "";
    [...word].forEach((char, i) => letters[char].forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === "1") drawing += "M" + (start + i * 6 + x) + " " + y + "h1v1h-1z";
      }
    }));
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", drawing);
    path.setAttribute("fill", fill);
    ui.wordmark.append(path);
  };
  add("COSMO", 0, "#edf3f8");
  add("EVOLVE", 31, "#c9f38e");
}

function resize() {
  const w = ui.field.clientWidth;
  const surfaceHeight = !galaxyViewing && surfaceId && w > 24 ? ((w - 24) * Biosphere.H / Biosphere.W + 68) + "px" : "";
  if (ui.field.style.height !== surfaceHeight) ui.field.style.height = surfaceHeight;
  const h = ui.field.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const worldWidth = w > 660 ? 620 : w > 460 ? 514 : 426;
  const aimScale = Math.min(w / worldWidth, h / 436);
  const fitScale = Math.max(1, Math.min(w, h) - 38) / (2 * Orbit.EXIT);
  view = { w, h, dpr, aimScale, fitScale };
  setOrbitCamera(orbitCamera ?? { zoom: aimScale * 0.68 / fitScale, x: 0, y: 0 });
  ui.map.width = Math.round(w * dpr);
  ui.map.height = Math.round(h * dpr);
  ui["surface-map"].width = ui.map.width;
  ui["surface-map"].height = ui.map.height;
  nextGroundFrame = 0;
  redrawBackdrop();
  revealWorldCard();
}

function setOrbitCamera(camera) {
  const { w, h, fitScale } = view;
  const zoom = Orbit.clamp(camera.zoom, 1, ORBIT_MAX_ZOOM);
  const scale = fitScale * zoom;
  const limitX = Math.max(0, Orbit.EXIT - w / (2 * scale));
  const limitY = Math.max(0, Orbit.EXIT - h / (2 * scale));
  const x = zoom === 1 ? 0 : Orbit.clamp(camera.x, -limitX, limitX);
  const y = zoom === 1 ? 0 : Orbit.clamp(camera.y, -limitY, limitY);
  orbitCamera = { zoom, x, y };
  Object.assign(view, { zoom: zoom === 1 ? "wide" : "orbit", scale, cx: w / 2 - x * scale, cy: h / 2 - y * scale });
  orbitDirty = true;
  put(ui["orbit-scale"], Math.round(zoom * 100) + " %");
  ui["orbit-out"].disabled = ui["orbit-fit"].disabled = zoom === 1;
  ui["orbit-in"].disabled = zoom === ORBIT_MAX_ZOOM;
}

function zoomOrbit(magnification, anchor) {
  if (!view || pointer || impactScene || viewedPlanet()) return;
  const zoom = Orbit.clamp(magnification, 1, ORBIT_MAX_ZOOM);
  if (zoom === orbitCamera.zoom) return;
  const scale = view.fitScale * zoom;
  const dx = anchor ? anchor.x - view.w / 2 : 0;
  const dy = anchor ? anchor.y - view.h / 2 : 0;
  setOrbitCamera(zoom === 1 ? ORBIT_FIT : { zoom,
    x: orbitCamera.x + dx * (1 / view.scale - 1 / scale),
    y: orbitCamera.y + dy * (1 / view.scale - 1 / scale) });
}

function panOrbit(dx, dy) {
  if (orbitCamera.zoom === 1 || (!dx && !dy)) return;
  setOrbitCamera({ zoom: orbitCamera.zoom, x: orbitCamera.x - dx / view.scale, y: orbitCamera.y - dy / view.scale });
}

function redrawBackdrop() {
  backdrop = Art.staticField(view, Evolution.zone(sim), backdrop);
  renderedInner = Evolution.zone(sim).inner;
  orbitDirty = false;
}

function put(el, value) {
  if (el.textContent !== String(value)) el.textContent = value;
}

function armedProbe() {
  return launchMode?.kind === "probe" ? sim.worlds.find(p => p.id === launchMode.worldId && Orbit.canLaunchProbe(p)) : null;
}

function availableLaunchSite() {
  return sim.worlds.find(p => p.id === selected) ?? sim.worlds.find(Orbit.canLaunchProbe) ?? sim.worlds.find(Orbit.hasSpaceflight);
}

function viewedPlanet() {
  return surfaceId ? sim.worlds.find(p => p.id === surfaceId) : null;
}

function selectedSurface() {
  return sim.worlds.find(p => p.id === selected && p.biosphere) ?? sim.worlds.find(p => p.biosphere);
}

function clearWeatherAim() {
  const id = weatherPointer?.id;
  weatherPointer = null;
  groundCursor = null;
  windStart = null;
  const map = ui["surface-map"];
  map.classList.remove("is-panning");
  if (id !== undefined && map.hasPointerCapture(id)) map.releasePointerCapture(id);
}

function showSurface(p, focus = true) {
  clearAim();
  launchMode = null;
  setMapPicker(false);
  if (surfaceId !== p?.id) surfaceCamera = SurfaceView.FIT;
  surfaceId = p?.id ?? 0;
  if (p) selected = p.id;
  setSurfacePan(false);
  nextGroundFrame = 0;
  updateUI();
  if (focus) (p ? ui["surface-map"] : ui.map).focus({ preventScroll: true });
}

function updateSurfaceUI() {
  const p = viewedPlanet();
  if (!p && surfaceId) {
    surfaceId = 0;
    clearWeatherAim();
  }
  const active = Boolean(p) && !galaxyViewing;
  ui.field.classList.toggle("galaxy-active", galaxyViewing);
  document.body.dataset.gameView = galaxyViewing ? "galaxy" : active ? mapNavigationMode : "orbit";
  ui["galaxy-map"].hidden = ui["galaxy-tools"].hidden = ui["galaxy-tools-map"].hidden = !galaxyViewing;
  ui["galaxy-open"].setAttribute("aria-pressed", String(galaxyViewing));
  syncMapPicker(active);
  if (ui.field.classList.toggle("surface-active", active) !== Boolean(ui.field.style.height)) resize();
  for (const id of ["surface-map", "surface-readout", "surface-tools", "surface-panel"]) ui[id].hidden = !active;
  for (const id of ["map", "readout", "orbit-tools", "launch-preparation"]) ui[id].hidden = active || galaxyViewing;
  const available = selectedSurface();
  ui["surface-open"].hidden = !available || sim.over || galaxyViewing;
  ui["surface-open"].title = available ? "Povrch planety " + available.name : "";
  for (const button of surfaceReturnButtons) {
    button.hidden = !active;
    if (p) button.setAttribute("aria-label", "Soustava · návrat z planety " + p.name);
  }
  put(ui["field-name"], galaxyViewing ? "Mapa galaxie" : active ? p.name : sim.mode === "biosphere" ? galaxyName : "Sluneční soustava");
  ui["galaxy-open"].hidden = sim.mode !== "biosphere";
  const calendarLabel = galaxyOthers.size ? "Kalendář galaxie" : "Kalendář soustavy";
  put(ui["calendar-label"], calendarLabel);
  ui.year.setAttribute("aria-label", calendarLabel);
  ui["galaxy-current"].hidden = !galaxyOthers.size;
  put(ui["galaxy-current"], galaxyOthers.size ? " · " + galaxyName : "");
  put(ui["input-footer"], active ? "KOLEČKO / + − · PŘIBLÍŽENÍ   /   TAHEM VÍTR A TERÉN, PODRŽENÍM TEPLO A CHLAD"
    : "TAHEM POSUŇ MAPU · + − PŘIBLÍŽENÍ · PŘED HODEM ZVOL AKCI");
  if (!active) return;
  const s = p.biosphere;
  const power = s.power;
  const kits = s.stations.filter(station => station.tile < 0 && station.civilization === sim.patron?.id).length;
  const placed = s.stations.filter(station => station.tile >= 0);
  const installed = Biosphere.placedStations(s).length > 0;
  const canPlaceStation = Evolution.owns(sim, p) && (Evolution.knows(sim, sim.patron.id, "climate") || kits > 0);
  ui["station-tool"].hidden = !canPlaceStation;
  ui["station-tool"].title = kits ? "Sady k umístění: " + kits : "Místní stavba: 70 E a 24 M; ponech 20 E.";
  put(ui["station-tool"], kits ? "Umístit teraformer (" + kits + ")" : "Teraformer · 70 E / 24 M");
  put(ui["hydro-tool"], "Vodní turbína · 16 E / 12 M");
  ui["hydro-tool"].hidden = p.pop <= 0 || !Biosphere.knows(s, "climate");
  if (weatherTool === "station" && ui["station-tool"].hidden) {
    weatherTool = "wind"; setSurfacePan(surfacePan);
  }
  ui["station-controls"].hidden = !placed.length;
  const picker = ui["station-pick"], signature = p.id + ":" + placed.map(station => station.id + "/" + Number(station.destroyed || s.damage[station.tile] >= 0.78)).join(",");
  if (picker.dataset.signature !== signature) {
    const wanted = stationPickerWorld === p.id ? preferredStation || Number(picker.value) : 0;
    picker.replaceChildren(...placed.map(station => {
      const option = document.createElement("option"); option.value = String(station.id);
      option.textContent = "Teraformer " + station.id + (station.destroyed || s.damage[station.tile] >= 0.78 ? " · trosky" : ""); return option;
    }));
    picker.value = String(placed.find(station => station.id === wanted)?.id ?? placed.find(station => !station.destroyed)?.id ?? placed[0]?.id ?? "");
    picker.dataset.signature = signature; stationPickerWorld = p.id;
  } else if (preferredStation && placed.some(station => station.id === preferredStation)) picker.value = String(preferredStation);
  preferredStation = 0;
  const station = placed.find(station => station.id === Number(picker.value));
  if (station) {
    const item = Biosphere.buildings(s).find(item => item.station === station);
    const info = item?.status;
    put(ui["station-status"], (info?.label ?? "") + " · " + decimal.format(station.draw) + " / " + decimal.format(station.load)
      + " E/s · Kondice " + (item?.health ?? 0) + " % · Baterie " + Math.ceil(station.battery) + " E"
      + (info?.detail ? " · " + info.detail : ""));
    ui["station-controls"].dataset.tone = info?.tone ?? "";
  }
  for (const button of stationModes) {
    button.disabled = !station || station.destroyed || s.damage[station.tile] >= 0.78 || p.pop <= 0;
    button.setAttribute("aria-pressed", String(station?.mode === button.dataset.stationMode));
  }
  ui["surface-power"].hidden = p.pop <= 0 || Biosphere.settlementEra(s) < 6 && !installed;
  if (!ui["surface-power"].hidden) {
    const balance = power.output - power.demand;
    put(ui["power-stage"], Biosphere.ENERGY_STAGES[Biosphere.energyStage(s, p.tech)]);
    put(ui["power-reserve"], "Energie " + Math.floor(power.reserve) + " / " + Biosphere.POWER_LIMIT + " E"
      + (balance > 0.1 && power.reserve < Biosphere.POWER_LIMIT ? " ↑" : balance < -0.1 ? " ↓" : ""));
    ui["surface-power"].dataset.tone = balance < -0.1 || power.strain > 0.25 ? "warn" : "";
    const flows = "Výroba " + decimal.format(power.output) + " · Města "
      + decimal.format(Math.max(0, power.demand - power.programDraw - power.stationDraw - (power.scienceDraw ?? 0) - (power.scienceBaseLoad ?? 0)))
      + " · Vědecké zázemí " + decimal.format(power.scienceBaseLoad ?? 0)
      + " · Věda " + decimal.format(power.scienceDraw ?? 0)
      + " · Výzkum " + decimal.format(power.programDraw) + " · Stanice " + decimal.format(power.stationDraw) + " E/s";
    put(ui["power-flow"], flows);
    const sources = { wind: 0, solar: 0, thermal: power.stationGenerator, hydro: 0 };
    for (const plant of power.plants) sources[plant.kind] += plant.output;
    const fuel = power.fuelUse > 0.02 ? " · Palivo " + decimal.format(power.fuelUse) + " M/s" : "";
    put(ui["power-sources"], power.plants.length || power.stationGenerator ? "Vítr " + decimal.format(sources.wind)
      + " · Slunce " + decimal.format(sources.solar) + " · Voda " + decimal.format(sources.hydro)
      + " · Záloha " + decimal.format(sources.thermal) + " E/s" + fuel : "Staví se první zdroj");
  }
  const cold = Math.hypot(p.x, p.y) > sim.zone.outer;
  const climate = p.inZone ? "V obyvatelném pásmu" : cold ? "Mrazivá část oběhu" : "Horká část oběhu";
  const disaster = { lava: "Láva v zástavbě", flood: "Povodeň v zástavbě", fire: "Požár v zástavbě", dry: "Dlouhé sucho", cold: "Mráz · lidé se ukrývají" }[s.urbanAlert];
  const recentImpact = s.lastImpact && s.time - s.lastImpact.time < 5;
  const dusty = s.impactDust > 0.06;
  const weather = disaster || (recentImpact ? "Čerstvý dopad" : dusty ? "Prach po dopadu" : s.storm ? "Bouřka · riziko blesků" : s.fires ? "Hoří porost"
    : s.volcanoes.length ? "Aktivní sopka" : s.lavaArea ? "Láva chladne"
    : s.battle ? "Probíhá boj na hranici" : s.rainfall > 0 ? "Probíhají srážky" : climate);
  ui["surface-readout"].dataset.state = disaster || s.fires || recentImpact ? "bad" : dusty || s.volcanoes.length || s.lavaArea || s.battle || s.storm || !p.inZone ? "warn" : "";
  put(ui["surface-status"], sim.paused ? "ČAS POZASTAVEN · " + weather.toUpperCase() : weather.toUpperCase());
  put(ui["surface-era"], p.colony && p.pop > 0 ? Biosphere.eras[Biosphere.settlementEra(s)] : stageName(p));
  put(ui["surface-moisture"], Math.round(s.moisture * 100) + " %");
  put(ui["surface-rain"], s.rainfall ? Math.max(1, Math.round(s.rainfall / (Biosphere.W * Biosphere.H) * 100)) + " %" : "0 %");
  put(ui["surface-fire"], s.fires ? "Hoří" : "Klid");
  ui["surface-fire"].dataset.tone = s.fires ? "warn" : "";
  const hunt = s.tribes.some(tribe => tribe.hunter);
  const migration = s.tribes.some(tribe => tribe.goal);
  const hasErrand = task => s.towns.some(town => town.walkers?.some(walker => walker.errand?.task === task));
  const colony = p.colony && p.pop > 0 ? "Podpora osad " + Math.round(s.townShelter * 100)
    + " % · Zátěž prostředí " + Math.round(s.orbitalStress * (1 - s.townShelter * 0.82) * 100) + " %." : "";
  const actors = p.pop > 0 && (s.battle ? "Na hranici se bojuje." : s.expeditions.some(trip => trip.volcanic) ? "Osadníci ustupují před lávou."
    : s.expeditions.some(trip => trip.fleeing) ? "Osadníci míří za teplem."
    : s.boats.some(boat => boat.blocked) ? "Loď čeká na průjezdnou vodní cestu."
    : s.boats.some(boat => boat.kind === "settle") ? "Osadníci plují k novému pobřeží."
    : s.expeditions.length ? "Výprava hledá místo pro novou osadu." : s.border?.tension >= 7 ? "Na hranici roste napětí."
    : migration ? "Část obyvatel se přesouvá." : hunt ? "Lovci jsou na výpravě."
    : hasErrand("water") ? "Obyvatelé nosí vodu do osad." : hasErrand("field") ? "Lidé míří na pole."
    : hasErrand("town") ? "Lidé procházejí mezi domy." : s.relation ? s.relation + "." : s.tribes.length ? "Kmeny žijí u vody." : "");
  const percent = tiles => Math.round(tiles / (Biosphere.W * Biosphere.H) * 100) + " %";
  const ground = (s.landform ? s.landform + " · " : "") + "Vodní plocha " + percent(s.openWater) + " · Led " + percent(s.iceCover)
    + (s.springs.length ? " · Prameny " + s.springs.length : "")
    + (s.volcanoes.length ? " · Aktivní sopky " + s.volcanoes.length : "") + ".";
  const damage = [s.floodPlots && "Zaplavené domy " + s.floodPlots, s.burnedPlots && "Hořící domy " + s.burnedPlots,
    s.lavaPlots && "Domy zasažené lávou " + s.lavaPlots,
    s.coldPlots && "Domy v mrazu " + s.coldPlots,
    s.ruins && "Trosky " + s.ruins].filter(Boolean).join(" · ");
  const towns = s.towns.filter(town => !town.abandoned && town.count > 0).length;
  const factories = s.towns.filter(town => Biosphere.workingFactory(s, town)).length;
  const monuments = s.monuments.filter(m => m.builtAt !== null);
  const openRoutes = s.links.filter(link => link.open).length;
  const society = [towns && "Osady " + towns, factories && "Továrny " + factories,
    openRoutes && "Cesty se zásobami " + openRoutes, s.airLink && "Letecká linka",
    s.ports.some(port => port.town >= 0) && "Přístavy " + s.ports.filter(port => port.town >= 0).length, s.seaLinks.length && "Lodní spojení " + s.seaLinks.length,
    s.boats.length && "Lodě na vodě " + s.boats.length,
    monuments.length && "Monumenty " + monuments.length].filter(Boolean).join(" · ");
  const oldest = monuments.length && "Stáří nejstaršího monumentu "
    + number.format(Math.floor((Evolution.dateAt(sim).months - Math.min(...monuments.map(m => (m.date ?? Evolution.dateAt(sim, (s.originTime ?? 0) + m.builtAt)).months))) / 12)) + " let.";
  const leader = s.dominant && "Převahu má " + Biosphere.REALMS[s.dominant].name + ".";
  const dust = dusty ? "Prach po dopadu dočasně ochlazuje povrch." : "";
  const smoke = power.pollution > 0.055 ? "Kouř snižuje úrodu v okolí tepelných zdrojů." : "";
  const organisms = s.era >= 1 && s.era <= 2 ? "Mikrobiální kolonie: " + decimal.format((s.microbeCoverage ?? 0) * 100) + " % " + (s.bioProfile === "warm" ? "vhodného povrchu. Horkomilný život se rozvíjí i na suché půdě." : s.bioProfile === "cold" ? "vody a ledu. Další mráz chladnomilnému životu nevadí." : "vody. Život potřebuje mírné teplo a vláhu.")
    : "";
  put(ui["surface-report"], [climate + ".", ground, organisms, dust, smoke, damage && damage + ".", actors, society && society + ".", oldest, leader, colony].filter(Boolean).join(" "));
}

function probeReadiness(world) {
  if (world?.biosphere && typeof Space !== "undefined") return Space.colonyBlock(sim, world) || "Kolonizační loď připravena · 145 E + 48 M";
  if (!world || world.pop <= 0) return "Vyber obydlenou planetu";
  if (world.pop < 30) return "Čeká na posádku";
  if (!world.biosphere) return Orbit.hasSpaceflight(world) ? "Připravená sonda" : "Čeká na vesmírnou civilizaci";
  const policy = world.biosphere.researchPolicy;
  if (!policy) return "Nejprve přijmi patronát nad civilizací";
  if (policy.faith < 10) return "Nejprve společná víra " + policy.faith + " / 10";
  if (!policy.spaceFunded) return "Zahaj placený vesmírný program";
  const power = world.biosphere.power;
  if (Biosphere.settlementEra(world.biosphere) < 6) return "Čeká na moderní civilizaci";
  const waiting = power.age >= 7 && power.programDraw < 0.02 ? " · čeká na energii" : "";
  if (!world.tech) return "Vývoj družice " + Math.min(100, Math.floor(power.work / Biosphere.SATELLITE_WORK * 100)) + " %" + waiting;
  if (power.work < Biosphere.PROBE_WORK) return "Kosmodrom " + Math.max(0, Math.floor((power.work - Biosphere.SATELLITE_WORK) / (Biosphere.PROBE_WORK - Biosphere.SATELLITE_WORK) * 100)) + " %" + waiting;
  if (power.reserve < Biosphere.PROBE_MIN_RESERVE) return "Do startu chybí " + Math.ceil(Biosphere.PROBE_MIN_RESERVE - power.reserve) + " E";
  if (world.supply < Biosphere.PROBE_CARGO) return "Sonda potřebuje " + Biosphere.PROBE_CARGO + " bodů zásob";
  return "Sonda připravena";
}

function updateForecast(model, shot) {
  const title = ui["forecast-title"];
  const value = ui["forecast-value"];
  ui.forecast.hidden = !model;
  if (!model) return;
  if (model.probe) {
    let label = "VOLNÁ DRÁHA";
    let detail = "Sonda poletí po vypočtené dráze.";
    if (model.sun) {
      label = "PÁD DO SLUNCE — ZÁNIK SONDY";
      detail = "Tato dráha zasáhne Slunce. Sonda i posádka budou ztraceny.";
    } else if (model.target) {
      label = model.returned ? "NÁVRAT DOMŮ" : "PŘISTÁNÍ NA PLANETĚ " + model.target.toUpperCase();
      detail = model.target + " · " + decimal.format(model.travel) + " s letu";
    } else if (model.deep) {
      label = "LET DO HLUBOKÉHO VESMÍRU";
      detail = "Posádka zamíří za okraj soustavy.";
    }
    ui.forecast.dataset.tone = model.sun ? "bad" : model.target ? "good" : model.deep ? "warn" : "";
    put(title, label);
    put(value, detail);
    return;
  }
  const full = sim.mode === "training";
  let label = full ? "DRÁHA MIMO ZÓNU" : "PRVNÍ ÚSEK DRÁHY";
  let tone = full ? "warn" : "";
  let detail;
  if (model.hit === "sun") {
    label = "PÁD DO SLUNCE";
    tone = "bad";
  } else if (model.hit === "collision") {
    label = "HROZÍ SRÁŽKA";
    tone = "bad";
    detail = "Průsečík s planetou " + model.planet;
  } else if (model.hit === "escape" || (full && model.apo > Orbit.EXIT)) {
    label = "ÚNIK ZE SOUSTAVY";
    tone = "warn";
  } else if (full && model.type === "cross") {
    label = "DRÁHA OPOUŠTÍ ZÓNU";
  } else if (model.encounter) {
    label = "TĚSNÝ PRŮLET";
    tone = "warn";
  } else if (full && model.type === "green") {
    label = "CELÁ DRÁHA V ZÓNĚ";
    tone = "good";
  }
  if (!model.hit && model.encounter) detail = "Gravitační vliv planety " + model.encounter;
  ui.forecast.dataset.tone = tone;
  put(title, label);
  put(value, detail ?? model.massLabel + " · rychlost " + decimal.format(Math.hypot(shot.vx, shot.vy)));
}

function describeWorld(p) {
  if (p.orbit.peri < Orbit.SUN + p.radius) return ["Hrozí pád do Slunce", "bad"];
  if (!Number.isFinite(p.orbit.apo) || p.orbit.apo > Orbit.EXIT) return ["Úniková dráha", "warn"];
  const orbit = Orbit.orbitClass(p.orbit, Evolution.zone(sim));
  if (orbit === "green") return ["Dráha v zelené zóně", ""];
  if (orbit === "cross") return [p.inZone ? "Výstředná dráha" : "Dočasně mimo zónu", "warn"];
  return [p.orbit.apo < Evolution.zone(sim).inner ? "Příliš blízko Slunci" : "Studená dráha", "warn"];
}

// Prezentační ukazatele: odpovídají podkladovým barvám v SurfaceView.terrain().
// Nemění hodnoty s.plants ani biologické ukazatele používané simulací.
function visibleVegetationMetrics(s) {
  const total = s.plants.length;
  let visible = 0, land = 0, landDensity = 0;
  for (let i = 0; i < total; i++) {
    const rock = s.height[i];
    const flooded = s.water[i] > 0.17;
    const highRock = !flooded && rock > 0.95;
    const frozen = s.ice[i] > (highRock ? 0.045 : 0.14);
    const desert = s.temperature[i] >= 0.40 && s.wet[i] < 0.34
      && s.plants[i] < 0.42 && s.ice[i] < 0.24;
    // Podklad zeleného políčka vzniká pouze mimo vodu, skálu, sníh a poušť.
    const greenBase = !flooded && !highRock && !frozen
      && (s.plants[i] > 0.55 || (s.plants[i] > 0.23 && !desert));
    if (greenBase) visible++;
    if (!s.ocean[i]) {
      land++;
      // Průměrná vegetační biomasa na souši. Zakrytá vegetace se nezobrazuje.
      if (!flooded && !highRock && !frozen) {
        landDensity += Math.max(0, Math.min(1, s.plants[i]));
      }
    }
  }
  return { coverage: total ? visible / total * 100 : 0,
    landDensity: land ? landDensity / land * 100 : 0,
    visibleTiles: visible, landTiles: land, totalTiles: total };
}

// OPT2: 500ms presentation-only window for full-map temperature/vegetation scans.
// Population and orbit data remain current on every HUD refresh; nothing is
// written into the simulated world and the cached snapshot is never saved.
const displayWorldClimate = new WeakMap();
function worldMetrics(world) {
  const surface = world.biosphere, now = performance.now();
  let climate = displayWorldClimate.get(surface);
  if (!climate || now - climate.at >= 500 || now < climate.at) {
    let total = 0;
    for (let i = 0; i < surface.temperature.length; i++) total += surface.temperature[i];
    const mean = total / surface.temperature.length;
    const flora = visibleVegetationMetrics(surface);
    const celsius = Math.round((mean - Biosphere.FREEZE_AT) * 500) / 10 || 0;
    climate = { at: now, temperature: decimal.format(celsius) + " °C",
      green: decimal.format(flora.coverage) + " %", landGreen: decimal.format(flora.landDensity) + " %" };
    displayWorldClimate.set(surface, climate);
  }
  const { period, apo } = world.orbit;
  const bound = Number.isFinite(period) && apo <= Orbit.EXIT;
  return {
    temperature: climate.temperature,
    period: bound ? decimal.format(period) + " s" : "Bez oběhu",
    people: number.format(Math.floor(world.pop)),
    green: climate.green,
    landGreen: climate.landGreen,
    bound
  };
}

function stageName(p) {
  if (p.biosphere) {
    if (p.pop <= 0 && p.biosphere.robotBases?.some(base => !base.colonyCore)) return "Robotická základna";
    if (p.colony) {
      if (p.pop <= 0) return "Opuštěná kolonie";
      if (p.self) return "Soběstačná kolonie";
      const link = sim.supplyRoutes.find(plan => plan.to === p.id);
      const worlds = link && Orbit.routeWorlds(sim, link);
      const connected = worlds && [worlds.from, worlds.backup].some(Orbit.navigationReady);
      return connected || Orbit.incomingCargo(sim, p.id).count ? "Zásobovaná základna" : "Závislá základna";
    }
    return Biosphere.eras[p.biosphere.era];
  }
  if (p.self && p.tech) return p.colony ? "Soběstačná kolonie" : "Vesmírná civilizace";
  if (p.pop > 0 && p.colony) return "Kolonie";
  if (p.pop > 0 && p.tech) return "Vesmírná civilizace";
  if (p.pop > 0) return "Civilizace";
  if (p.colony) return "Opuštěná kolonie";
  return ["Holá skála", "Mikroby", "Biosféra", "Biosféra", "Biosféra"][p.stage];
}

function reconcileWorldSelection() {
  const previous = [...cards.keys()];
  const nearby = id => sim.worlds[Math.min(Math.max(0, previous.indexOf(id)), sim.worlds.length - 1)];
  if (surfaceId && !sim.worlds.some(p => p.id === surfaceId)) {
    const next = nearby(surfaceId);
    surfaceId = next?.biosphere ? next.id : 0;
    selected = next?.id ?? 0;
    surfaceCamera = SurfaceView.FIT;
    buildingFocus = null;
    nextGroundFrame = 0;
    clearWeatherAim();
  }
  if (!sim.worlds.some(p => p.id === selected)) selected = nearby(selected)?.id ?? 0;
}

function selectWorld(p, focusCard = false) {
  if (!p || !sim.worlds.includes(p)) return;
  clearWeatherAim();
  clearAim();
  launchMode = null;
  buildingFocus = null;
  if (surfaceId && p.biosphere) showSurface(p, false);
  else { selected = p.id; updateUI(); }
  if (focusCard && !ui["world-list"].hidden) cards.get(p.id)?.node.focus({ preventScroll: true });
}

function browseWorld(direction, focusCard = false) {
  const worlds = orderedWorlds(), count = worlds.length;
  if (count < 2) return;
  const index = Math.max(0, worlds.findIndex(p => p.id === selected));
  selectWorld(worlds[(index + direction + count) % count], focusCard);
}

function orderedWorlds(worlds = sim.worlds) {
  const radius = world => {
    if (!world.orbit) return -Infinity;
    const mean = (world.orbit.peri + world.orbit.apo) / 2;
    return Number.isFinite(mean) ? mean : Infinity;
  };
  return [...worlds].sort((a, b) => radius(a) - radius(b) || a.id - b.id);
}

function revealWorldCard() {
  const list = ui["world-list"], row = cards.get(selected)?.row;
  if (!row || list.hidden) return;
  const box = list.getBoundingClientRect(), item = row.getBoundingClientRect();
  if (item.top < box.top) list.scrollTop -= box.top - item.top;
  else if (item.bottom > box.bottom) list.scrollTop += item.bottom - box.bottom;
}

let mapNavigationMode = "orbit", mapNavigationKind = "", mapPickerContent = "";
const mapNavigationLabels = {
  galaxy: { list: "Soustavy", title: "Soustavy v galaxii", previous: "Předchozí soustava", next: "Další soustava" },
  orbit: { list: "Planety", title: "Planety v soustavě", previous: "Předchozí planeta", next: "Další planeta" },
  surface: { list: "Civilizace", title: "Civilizace na planetě", previous: "Předchozí civilizace", next: "Další civilizace" },
  civic: { list: "Osady", title: "Osady a základny", previous: "Předchozí osada", next: "Další osada" }
};

function setMapNavigationMode(mode) {
  if (mapNavigationMode === mode) return;
  mapNavigationMode = mode;
  syncMapPicker(Boolean(viewedPlanet()));
}

function mapChoices(kind) {
  if (kind === "galaxy") return { current: galaxySelected, entries: galaxySystems().map(system => ({...system, detail: galaxySummaryText(system.info)})) };
  if (kind === "surface") return GameInterface.mapCivilizations(viewedPlanet());
  if (kind === "civic") return GameInterface.mapSettlements();
  return { current: selected, entries: orderedWorlds().map(world => ({ id: world.id, name: world.name })) };
}

function renderMapCivilizations(choices) {
  const list = ui["map-context-list"];
  const items = new Map([...list.querySelectorAll("[data-map-choice]")].map(button => [button.dataset.mapChoice, button]));
  const rows = choices.entries.map(item => {
    let button = items.get(String(item.id));
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "map-context-choice";
      button.dataset.mapChoice = String(item.id);
      button.append(document.createElement("strong"), document.createElement("small"));
    }
    put(button.firstElementChild, item.name);
    put(button.lastElementChild, item.detail);
    button.setAttribute("aria-current", String(item.id === choices.current));
    button.disabled = galaxyBusy;
    return button;
  });
  if (!rows.length) {
    put(list, "Na této planetě zatím nejsou žádné civilizace.");
  } else if (list.children.length !== rows.length || rows.some((row, i) => row !== list.children[i])) {
    list.replaceChildren(...rows);
  }
}

function setMapPicker(open, focus = false, content = "") {
  const picker = ui["map-planet-picker"];
  const expanded = Boolean(open && mapNavigationKind && !galaxyBusy);
  const previous = mapPickerContent;
  const kind = expanded ? content || mapNavigationKind : "";
  if (picker.hidden === !expanded && previous === kind) return;
  mapPickerContent = kind;
  picker.hidden = !expanded;
  const civilizationToggle = document.getElementById("map-civilizations-toggle");
  ui["map-planets-toggle"].setAttribute("aria-expanded", String(expanded && kind !== "civilizations"));
  civilizationToggle.setAttribute("aria-expanded", String(expanded && kind === "civilizations"));
  ui.map.inert = ui["surface-map"].inert = ui["galaxy-map"].inert = expanded;
  if (expanded) {
    clearAim();
    clearWeatherAim();
    if (kind === "civic") GameInterface.prepareMapSettlements();
    syncMapPicker(Boolean(viewedPlanet()));
    updateUI();
  }
  if (focus) (expanded ? ui["map-planets-close"] : previous === "civilizations" ? civilizationToggle : ui["map-planets-toggle"])
    .focus({ preventScroll: true });
}

function syncMapPicker(onSurface) {
  const list = ui["world-list"], picker = ui["map-planet-picker"], context = ui["map-context-list"];
  const kind = galaxyViewing ? "galaxy" : onSurface ? (mapNavigationMode === "civic" ? "civic" : "surface") : sim.mode === "biosphere" ? "orbit" : "";
  if (kind !== mapNavigationKind) {
    setMapPicker(false);
    mapNavigationKind = kind;
    context.replaceChildren();
    delete context.dataset.html;
    put(ui["map-picker-status"], "");
  }
  const management = document.getElementById("map-management-content");
  const mapList = document.getElementById("map-world-list");
  mapList.hidden = picker.hidden || kind !== "orbit";
  if (!mapList.hidden) syncMapWorldCards(true);
  const civilizations = kind === "surface" || mapPickerContent === "civilizations";
  management.hidden = civilizations;
  context.hidden = !civilizations && kind !== "galaxy";
  document.getElementById("map-civilization-controls").hidden = kind !== "civic";
  ui["map-planet-controls"].hidden = !kind;
  if (!kind) return;
  const labels = mapNavigationLabels[kind];
  put(ui["map-planet-list-title"], civilizations ? "Civilizace na planetě" : labels.title);
  const choices = mapChoices(kind);
  const current = choices.entries.findIndex(entry => entry.id === choices.current);
  const entry = choices.entries[current];
  const name = entry?.shortName ?? entry?.name;
  put(ui["map-picker-label"], name ?? (kind === "surface" ? "Bez civilizace" : labels.list));
  ui["map-planets-toggle"].setAttribute("aria-label", labels.list + (name ? " · " + name : ""));
  for (const [id, direction, label] of [["map-planet-previous", -1, labels.previous], ["map-planet-next", 1, labels.next]]) {
    const button = ui[id], count = choices.entries.length;
    button.disabled = galaxyBusy || count < (kind === "civic" && current < 0 ? 1 : 2);
    button.setAttribute("aria-label", label);
    const target = button.disabled ? null : current < 0 ? choices.entries[direction < 0 ? count - 1 : 0]
      : choices.entries[(current + direction + count) % count];
    button.title = target ? label + " · " + target.name : label;
  }
  if (kind === "civic") {
    const groups = GameInterface.mapCivilizations(viewedPlanet());
    const name = groups.entries.find(group => group.id === groups.current)?.name;
    put(document.getElementById("map-civilization-label"), name ?? "Bez civilizace");
    document.getElementById("map-civilizations-toggle").setAttribute("aria-label", "Civilizace" + (name ? " · " + name : ""));
    for (const id of ["map-civilization-previous", "map-civilization-next"])
      document.getElementById(id).disabled = groups.entries.length < 2;
  }
  if (!picker.hidden && civilizations) GameInterface.renderCivilizationPicker();
  else if (!picker.hidden && kind === "galaxy") renderMapCivilizations(choices);
}

function browseMapContext(direction) {
  if (mapNavigationKind === "galaxy") {
    const systems = galaxySystems(false), index = systems.findIndex(system => system.id === galaxySelected);
    selectGalaxySystem(systems[(index + direction + systems.length) % systems.length].id);
  } else if (mapNavigationKind === "surface") {
    GameInterface.browseMapCivilization(direction);
  } else if (mapNavigationKind === "civic") GameInterface.browseMapSettlement(direction);
  else if (mapNavigationKind === "orbit") browseWorld(direction);
}

function openPlanetFromList(world) {
  if (!world?.biosphere) return;
  const fromMap = !ui["map-planet-picker"].hidden;
  showSurface(world, !fromMap);
  if (fromMap) ui["map-planets-toggle"].focus({ preventScroll: true });
  else ui["surface-map"].scrollIntoView?.({ block: "center" });
}

// OPT1: identical reads within one HUD refresh share the same planet summary.
// Never retain this between refreshes: settlement ownership and populations are live.
let uiPresenceSnapshot = null;
function worldPresence(world) {
  const previous = uiPresenceSnapshot?.get(world);
  if (previous) return previous;
  const surface = world.biosphere;
  const groups = new Map();
  const groupFor = id => {
    if (!groups.has(id)) groups.set(id, {id, settlements: 0, cities: 0, people: 0, installations: new Map()});
    return groups.get(id);
  };
  for (const community of surface?.communities ?? []) {
    const town = surface.towns[community.town];
    if (!community.active || community.people <= 0) continue;
    const group = groupFor(community.civilization);
    group.people += community.people;
    if (!town || town.abandoned || surface.damage[town.home] >= 0.78) continue;
    group.settlements++;
    if (Biosphere.townEra(surface, town) >= 5) group.cities++;
  }
  for (const asset of surface ? Biosphere.surfaceInstallations(surface) : []) {
    const counts = groupFor(asset.owner).installations;
    counts.set(asset.name, (counts.get(asset.name) ?? 0) + 1);
  }
  const result = [...groups.values()];
  if (uiPresenceSnapshot) uiPresenceSnapshot.set(world, result);
  return result;
}

function worldSettlementLabel(settlements, cities) {
  const count = (value, forms) => value + " " + forms[value === 1 ? 0 : value >= 2 && value <= 4 ? 1 : 2];
  return count(settlements, ["sídlo", "sídla", "sídel"])
    + (cities ? " · z toho " + count(cities, ["město", "města", "měst"]) : "");
}

function updateWorldPresence(card, world) {
  const groups = worldPresence(world);
  const total = groups.reduce((count, group) => count + group.settlements, 0);
  const cities = groups.reduce((count, group) => count + group.cities, 0);
  put(card.settlementSummary, total ? worldSettlementLabel(total, cities)
    : groups.length ? "Technika na povrchu · bez obydlených sídel" : "Bez obydlených sídel");
  card.details.hidden = !groups.length;
  if (!card.details.open || card.details.hidden) return;
  const entries = groups.map(group => {
    const label = Evolution.nationLabel(sim, group.id);
    const own = group.id === sim.patron?.id ? " · Tvoje civilizace" : "";
    const stats = group.settlements ? [worldSettlementLabel(group.settlements, group.cities), number.format(Math.floor(group.people)) + " obyv."] : [];
    for (const [name, count] of group.installations) stats.push(count > 1 ? count + "× " + name : name);
    return [label + own, stats.join(" · "), sim.nations[group.id]?.color ?? "#9aaec2"];
  });
  const signature = JSON.stringify(entries);
  if (card.civilizations.dataset.signature === signature) return;
  card.civilizations.dataset.signature = signature;
  card.civilizations.replaceChildren(...entries.map(([name, stats, color]) => {
    const row = document.createElement("li"), title = document.createElement("strong"), swatch = document.createElement("i");
    swatch.className = "world-owner-swatch";
    swatch.style.backgroundColor = color;
    swatch.setAttribute("aria-hidden", "true");
    title.textContent = name;
    row.append(swatch, title, " · " + stats);
    return row;
  }));
}

function updateWorldNature(card, world) {
  const s = world.biosphere;
  const overview = document.getElementById("planet-overview");
  const showsNature = overview && !overview.parentElement.closest("[hidden]");
  card.nature.hidden = !s || world.id === surfaceId && Boolean(showsNature);
  if (card.nature.hidden || !card.nature.open) return;
  const flora = visibleVegetationMetrics(s);
  put(card.flora, s.era < 2 ? "Vegetace se zatím nerozvinula."
    : "Vegetace souše: " + decimal.format(flora.landDensity) + " %.");
  const habitats = ["Zkontroluj teplotu a vhodná místa na souši.", "Zkontroluj teplotu a stav ledu.", "Zkontroluj teplotu a kapalnou vodu."];
  const groups = FaunaEvolution.habitatSummary(s);
  for (const [i, group] of groups.entries()) {
    const warning = group.climate + group.food;
    const row = card.fauna.children[i], count = group.count;
    const population = count === 1 ? "1 skupina" : count <= 4 ? count + " skupiny" : count + " skupin";
    put(row.querySelector("strong"), group.label);
    const condition = !warning ? "vhodné podmínky" : warning < count ? "některé strádají" : count === 1 ? "strádá" : "strádají";
    put(row.querySelector("span"), count ? population + " · " + condition : "Zatím bez skupin");
    put(row.querySelector("small"), group.climate ? habitats[i] : group.food ? "V okolí ubývá potrava." : "");
    row.dataset.tone = warning ? "warn" : "";
  }
}

function updateWorldMetrics(card, world, visible = !surfaceId) {
  card.facts.hidden = !visible || !world.biosphere;
  card.pop.hidden = !card.facts.hidden;
  if (card.facts.hidden) return;
  const metrics = worldMetrics(world);
  for (const [name, node] of Object.entries(card.metrics)) put(node, metrics[name]);
}

function updateCards() {
  const worlds = orderedWorlds(), present = new Set(worlds.map(p => p.id));
  const showDetails = !ui["world-list"].hidden || !document.getElementById("map-world-list").hidden;
  let restoreFocus = false;
  for (const [id, card] of cards) {
    if (present.has(id)) continue;
    if (card.row.contains(document.activeElement)) restoreFocus = true;
    card.row.remove();
    cards.delete(id);
  }
  if (selected && !present.has(selected)) selected = sim.worlds.at(-1)?.id ?? 0;
  let preceding = ui.empty;
  for (const p of worlds) {
    if (!cards.has(p.id)) {
      const row = document.createElement("article");
      row.className = "world-row";
      row.dataset.worldId = String(p.id);
      row.innerHTML = '<div class="world-row-main">'
        + '<button class="world world-select" type="button"><span class="world-top"><i class="planet-icon" aria-hidden="true"></i>'
        + '<span class="world-name"></span><span class="world-stage"></span></span></button>'
        + '<div class="world-meta"><span class="world-orbit"></span><span class="world-pop"></span>'
        + '<span class="orbital-meta" data-tone=""><span class="orbit-health">STABILNÍ DRÁHA</span></span></div>'
        + '<div class="world-inhabitants"><strong class="world-settlement-summary"></strong>'
        + '<span class="world-energy" hidden></span>'
        + '<span class="supply" hidden><span>Místní materiál</span><progress max="100" aria-label="Místní materiál"></progress><span class="supply-text"></span></span></div>'
        + '<button type="button" class="btn world-surface">Otevřít povrch</button>'
        + '<button type="button" class="btn world-manage" hidden>Akce planety</button>'
        + '<button type="button" class="btn world-rename-inline" data-world-rename="' + p.id + '" aria-label="Přejmenovat planetu" title="Přejmenovat planetu">✎</button></div>'
        + '<dl class="world-facts" aria-label="Základní údaje planety" hidden>'
        + '<div><dt>Prům. teplota</dt><dd class="world-temperature"></dd></div>'
        + '<div><dt>Oběh při 1×</dt><dd class="world-period"></dd></div>'
        + '<div><dt>Obyvatelé</dt><dd class="world-people"></dd></div>'
        + '<div title="Průměrná hustota rostlinstva na souši, bez zaplavených, zaledněných a holých skalnatých ploch"><dt>Vegetace souše</dt><dd class="world-land-green"></dd></div></dl>'
        + '<div class="world-project-progress" hidden></div>'
        + '<details class="world-details"><summary>Civilizace, osídlení a technika</summary>'
        + '<ul class="world-civilizations"></ul></details>'
        + '<details class="world-details world-nature"><summary>Flóra a fauna</summary>'
        + '<p class="world-flora"></p><ul class="world-fauna">'
        + '<li><strong></strong><span></span><small></small></li>'.repeat(3) + '</ul></details>';
      const node = row.querySelector(".world-select");
      node.title = p.massLabel;
      const surface = row.querySelector(".world-surface");
      surface.addEventListener("click", () => {
        const world = sim.worlds.find(item => item.id === p.id);
        openPlanetFromList(world);
      });
      const part = selector => row.querySelector(selector);
      const card = {
        row, node, surface, manage: part(".world-manage"), icon: part(".planet-icon"), name: part(".world-name"), stage: part(".world-stage"),
        meta: part(".world-meta"), orbit: part(".world-orbit"), pop: part(".world-pop"),
        facts: part(".world-facts"),
        metrics: { temperature: part(".world-temperature"), period: part(".world-period"),
          people: part(".world-people"), landGreen: part(".world-land-green") },
        details: part(".world-details"), civilizations: part(".world-civilizations"),
        nature: part(".world-nature"), flora: part(".world-flora"), fauna: part(".world-fauna"),
        settlementSummary: part(".world-settlement-summary"), energy: part(".world-energy"), health: part(".orbital-meta"), healthText: part(".orbit-health"),
        supply: part(".supply"), meter: part("progress"), stock: part(".supply-text")
      };
      card.nature.addEventListener("toggle", () => {
        const world = sim.worlds.find(item => item.id === p.id);
        if (world) updateWorldNature(card, world);
      });
      card.details.addEventListener("toggle", () => {
        if (!card.details.open) return;
        const world = sim.worlds.find(item => item.id === p.id);
        if (world) updateWorldPresence(card, world);
      });
      put(card.name, p.name);
      card.manage.addEventListener("click", () => {
        const world = sim.worlds.find(item => item.id === p.id);
        if (world) GameInterface.manageMapWorld(world);
      });
      node.addEventListener("click", () => {
        const world = sim.worlds.find(item => item.id === p.id);
        selectWorld(world);
      });
      ui["world-list"].append(row);
      cards.set(p.id, card);
    }
    const card = cards.get(p.id);
    // KOMPAS: the list of planets is scoped to the observed civilization;
    // orbital physics and the actual planet selection remain untouched.
    const watched = globalThis.CosmoCompass?.id() ?? null;
    card.row.hidden = Boolean(watched && !globalThis.CosmoCompass.local(p,watched));
    if (card.row.previousElementSibling !== preceding) preceding.after(card.row);
    preceding = card.row;
    put(card.name, p.name); // Names may be changed by the player after this row was created.
    const [orbit, tone] = describeWorld(p);
    card.row.dataset.selected = String(p.id === selected);
    card.node.setAttribute("aria-pressed", String(p.id === selected));
    card.node.tabIndex = p.id === selected ? 0 : -1;
    card.surface.hidden = !p.biosphere;
    card.manage.hidden = !sim.patron || Space.people(p, sim.patron.id) <= 0;
    const viewing = p.id === surfaceId;
    put(card.surface, viewing ? "Zobrazit povrch" : "Otevřít povrch");
    card.surface.classList.toggle("primary", viewing);
    card.surface.setAttribute("aria-label", "Otevřít povrch planety " + p.name);
    card.icon.style.setProperty("--planet", Art.planetColor(p));
    put(card.stage, stageName(p));
    put(card.orbit, p.biosphere?.fires ? "Požár na povrchu" : orbit);
    card.health.dataset.tone = p.orbitAlert === "bad" ? "bad" : p.orbitAlert === "warn" ? "warn" : "";
    put(card.healthText, p.orbitLabel || "STABILNÍ DRÁHA");
    put(card.pop, p.pop > 0 ? compact.format(p.pop) + " obyv." : "");
    card.pop.title = p.pop > 0 ? number.format(Math.floor(p.pop)) + " obyvatel" : "";
    card.meta.dataset.tone = p.biosphere?.fires ? "bad" : tone;
    if (showDetails) {
      updateWorldMetrics(card, p, true);
      updateWorldPresence(card, p);
      updateWorldNature(card, p);
    }
    card.supply.hidden = p.pop <= 0;
    if (!card.supply.hidden) {
      const level = Math.floor(p.supply);
      card.meter.value = level;
      card.meter.dataset.tone = level < 20 ? "bad" : level < 45 ? "warn" : "";
      put(card.stock, level + " %");
    }
    card.energy.hidden = !p.biosphere || p.pop <= 0;
    if (!card.energy.hidden) {
      const power = p.biosphere.power;
      card.energy.dataset.tone = power.output < power.demand - 0.1 ? "warn" : "";
      put(card.energy, "Stupeň " + Biosphere.energyStage(p.biosphere, p.tech) + " · " + Math.floor(power.reserve) + " E · "
        + (Biosphere.settlementEra(p.biosphere) < 6 ? "Místní síť" : probeReadiness(p)));
    }
  }
  ui.empty.hidden = sim.worlds.length > 0;
  put(ui["world-count"], String(sim.worlds.length).padStart(2, "0"));
  const index = worlds.findIndex(p => p.id === selected), count = worlds.length;
  put(ui["world-position"], count ? (index + 1) + " / " + count + " · " + (worlds[index]?.name ?? "Vyber planetu") : "0 / 0");
  for (const [id, direction, label] of [["world-previous", -1, "Předchozí"], ["world-next", 1, "Další"]]) {
    const target = count ? worlds[(Math.max(0, index) + direction + count) % count] : null;
    ui[id].disabled = count < 2;
    ui[id].title = target && count > 1 ? label + " planeta: " + target.name : "Přidej další planetu";
  }
  const key = selected + ":" + worlds.map(p => p.id).join(",");
  if (ui["world-list"].dataset.selection !== key) {
    revealWorldCard();
    ui["world-list"].dataset.selection = key;
  }
  if (restoreFocus) cards.get(selected)?.node.focus({ preventScroll: true });
  syncMapWorldCards();
}

// Mirror the same current planet cards in the map picker without moving the live management panel.
// The mirror is intentionally presentation-only; events are forwarded to the live model.
let mapWorldCardsAt = 0;
function syncMapWorldCards(force = false) {
  const list = document.getElementById("map-world-list");
  if (!list || list.hidden || !ui["world-list"]) return;
  const now = performance.now();
  if (!force && now - mapWorldCardsAt < 700) return;
  const y = list.scrollTop;
  list.replaceChildren(...[...ui["world-list"].children].map(node => {
    const clone = node.cloneNode(true);
    // Mirrored rows must never duplicate document IDs used by the live UI.
    if (clone.id) clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach(child => child.removeAttribute("id"));
    return clone;
  }));
  list.scrollTop = y;
  mapWorldCardsAt = now;
}

document.getElementById("map-world-list").addEventListener("click", event => {
  const target = event.target;
  const row = target.closest(".world-row");
  if (!row) return;
  const id = Number(row.dataset.worldId);
  const world = sim.worlds.find(p => p.id === id);
  if (!world) return;
  if (target.closest(".world-details summary")) {
    event.preventDefault();
    // Toggle the real card first; mirrored disclosures never lose their state on refresh.
    const detail = target.closest(".world-details");
    const live = cards.get(id);
    const source = detail.classList.contains("world-nature") ? live?.nature : live?.details;
    if (source) { source.open = !source.open; updateCards(); syncMapWorldCards(true); }
  } else if (target.closest("[data-world-rename]")) {
    ui["world-list"].querySelector('[data-world-rename="' + id + '"]')?.click();
  } else if (target.closest(".world-manage")) {
    GameInterface.manageMapWorld(world);
  } else if (target.closest(".world-surface")) {
    openPlanetFromList(world);
  } else if (target.closest(".world-select")) {
    selectWorld(world);
    syncMapWorldCards(true);
  }
});
let journalMode = null, journalPreview = null;

function journalScope() {
  return ui["log-filter"].value === "auto" ? journalMode ?? (surfaceId ? "surface" : "orbit") : ui["log-filter"].value;
}

function setJournalMode(mode) {
  if (journalMode === mode) return;
  journalMode = mode;
  renderJournalPreview();
}

function renderJournalPreview(queued = []) {
  const scope = journalScope(), quiet = ui["log-quiet"].checked, history = sim.history ?? [];
  const oldest = history[0];
  if (journalPreview?.sim === sim && journalPreview.scope === scope && journalPreview.quiet === quiet
    && journalPreview.oldest === oldest && !queued.some(item => Journal.matches(item, scope, quiet))) return;
  journalPreview = {sim, scope, quiet, oldest};
  const rows = [];
  for (let i = history.length - 1; i >= 0 && rows.length < 16; i--) {
    const item = history[i];
    if (!Journal.matches(item, scope, quiet)) continue;
    const row = document.createElement("li");
    const time = document.createElement("time");
    const message = document.createElement("span");
    time.textContent = Evolution.dateLabel(item.date ?? Evolution.dateAt(sim, item.time));
    time.title = "Rok " + time.textContent;
    message.textContent = item.message;
    row.dataset.tone = item.tone;
    row.append(time, message);
    rows.push(row);
  }
  if (!rows.length) {
    const empty = document.createElement("li");
    empty.textContent = "Pro tento výběr zatím nejsou žádné události.";
    rows.push(empty);
  }
  ui.log.replaceChildren(...rows);
}

function flushLog() {
  renderJournalPreview(sim.events.splice(0));
}

const journalPreferencesKey = "cosmoevolve.journal.v1";
try {
  const preferences = JSON.parse(localStorage.getItem(journalPreferencesKey));
  if ([...ui["log-filter"].options].some(option => option.value === preferences?.filter))
    ui["log-filter"].value = preferences.filter;
  if (typeof preferences?.quiet === "boolean") ui["log-quiet"].checked = preferences.quiet;
} catch { /* Default to the current game mode. */ }
for (const id of ["log-filter", "log-quiet"]) ui[id].addEventListener("change", () => {
  try {
    localStorage.setItem(journalPreferencesKey, JSON.stringify({filter:ui["log-filter"].value, quiet:ui["log-quiet"].checked}));
  } catch { /* The selection is still usable in this session. */ }
  renderJournalPreview();
});

function updateVoyages() {
  const records = [...sim.probes, ...sim.voyages];
  const key = records.length + "|" + records.map(record => record.id + "-" + record.status).join(",");
  if (key === voyageKey) return;
  voyageKey = key;
  records.sort((a, b) => b.id - a.id);
  ui.voyages.hidden = records.length === 0;
  const missing = records.reduce((sum, record) => sum + (record.status === "deep" ? record.people : 0), 0);
  const labels = {
    flight: "Na cestě", drift: "Na volné dráze", deep: "Pohřešovaná v hlubokém vesmíru",
    landed: "Přistání", returned: "Návrat domů", destroyed: "Zničena · posádka zahynula", "colony-lost": "Ztráta kolonie"
  };
  const reasons = { escape: "Únik ze soustavy", collision: "Srážka planet", asteroid: "Dopad obřího asteroidu",
    sun: "Pád do Slunce", "self-destruct": "Autodestrukce", extinction: "Osídlení zaniklo", gone: "Svět ztracen" };
  const rows = [], losses = [];
  for (const record of records) {
    const row = document.createElement("li");
    row.className = "voyage";
    row.dataset.status = record.status;
    const name = document.createElement("b");
    const status = document.createElement("span");
    const crew = document.createElement("small");
    put(name, record.name);
    put(status, labels[record.status] + (record.target ? " · " + record.target : ""));
    put(crew, record.status === "destroyed" && record.lossReason ? (reasons[record.lossReason] ?? "Ztráta sondy") + " · " + number.format(record.people) + " lidí na palubě"
      : record.status === "colony-lost"
      ? (reasons[record.lossReason] ?? reasons.gone) + " · " + number.format(record.people) + " lidí při startu"
      : "Z planety " + record.originName + " · " + number.format(record.people) + " lidí");
    row.append(name, status, crew);
    if (record.status === "flight" || record.status === "drift") {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "probe-action";
      action.textContent = "Autodestrukce";
      action.setAttribute("aria-label", "Autodestrukce sondy " + record.name);
      action.addEventListener("click", () => {
        const active = sim.probes.find(p => p.id === record.id);
        if (!active) return;
        pendingProbeId = active.id;
        put(ui["destroy-probe-title"], "Autodestrukce · " + active.name);
        put(ui["destroy-probe-detail"], "Na palubě je " + number.format(active.people)
          + " lidí. Sonda odstartovala z planety " + active.originName + ".");
        ui["destroy-probe"].returnValue = "";
        ui["destroy-probe"].showModal();
        updateStatus();
      });
      row.append(action);
    }
    (record.status === "colony-lost" || record.status === "destroyed" ? losses : rows).push(row);
  }
  put(ui["voyage-count"], missing ? number.format(missing) + " POHŘEŠOVÁNO" : String(rows.length).padStart(2, "0"));
  ui["voyage-list"].replaceChildren(...rows);
  ui["voyage-losses"].hidden = losses.length === 0;
  put(ui["voyage-loss-count"], String(losses.length).padStart(2, "0"));
  ui["voyage-loss-list"].replaceChildren(...losses);
}

function modalOpen() {
  return ui.instructions.open || ui["reset-confirm"].open || ui.results.open
    || ui["journal-export-dialog"].open || ui["mission-result"].open || ui["destroy-probe"].open || ui["storage-dialog"].open || (ui["economy-dialog"].open && !ui["economy-dialog"].classList.contains("inline-economy")) || (ui["buildings-dialog"].open && !ui["buildings-dialog"].classList.contains("inline-buildings")) || ui["building-confirm"].open
    || ui["patron-dialog"].open || ui["patron-confirm"].open;
}

function updateStatus() {
  let status = "ČEKÁ NA PRVNÍ HOD";
  let state = "";
  let badge = "PŘIPRAVENO";
  let title = "01 / PŘÍPRAVA PLANETY";
  let message = "Vytvoř první planetu.";
  let calloutTone = "";
  const existing = sim.worlds.length;
  const mission = sim.mission;
  if (existing || sim.stats.thrown || sim.mode === "scenario") {
    status = "SIMULACE BĚŽÍ";
    badge = "V PROVOZU";
    title = "02 / EVOLUCE";
    message = "Sleduj vývoj planety. Čas můžeš zrychlit tlačítky 4× a 12×.";
    if (existing === 0) {
      status = "ČEKÁ NA DALŠÍ HOD";
      title = "ZKUS NOVOU DRÁHU";
      message = "Začni uvnitř pásma a táhni kolmo ke spojnici planety a Slunce.";
    } else if (!sim.everSpace && !sim.worlds.some(p => Orbit.orbitClass(p.orbit, sim.zone) === "green")) {
      title = "DRÁHA MIMO ZÓNU";
      message = "Zkus další hod. Aby život vydržel, měla by celá dráha ležet v zeleném pásmu.";
      calloutTone = "warn";
    }
  }
  if (sim.everSpace) {
    title = "03 / VÝPRAVY";
    message = existing < 2 ? "Vytvoř další planetu. Po dokončení kosmodromu otevři Výzkum a logistika → Výpravy."
      : "V přehledu Výzkum a logistika → Výpravy vyber zdroj a cíl. Průzkumnou sondu vyšleš kliknutím na její kartu.";
  }
  if (sim.goal) {
    title = "DVA SOBĚSTAČNÉ SVĚTY";
    message = "Můžeš přidávat další světy. Blízké průlety mění oběžné dráhy.";
  }
  if (sim.crisis) {
    status = "NOUZOVÝ STAV";
    badge = "NOUZE";
    state = "bad";
    title = "ZÁCHRANNÝ HOD";
    message = "Přidej svět v zeleném pásmu a vyšleš k němu sondu z přeživší kolonie.";
    calloutTone = "warn";
  }
  if (mission?.phase === "briefing") {
    status = "MISE ČEKÁ NA START";
    badge = "PŘÍPRAVA MISE";
    state = "warn";
    title = "04 / PŘESUN OBYVATELNÉHO PÁSMA";
    message = "Slunce zesílí. Zlaté kruhy ukazují, kde bude možné přežít. Připrav přesun obyvatel z planety " + mission.homeName + ".";
    calloutTone = "warn";
  }
  if (mission?.phase === "active") {
    status = mission.driftAnnounced ? "PÁSMO SE POSOUVÁ" : "ČAS NA PŘÍPRAVU";
    badge = "EVAKUAČNÍ MISE";
    state = "warn";
    title = "04 / EVAKUACE";
    calloutTone = "warn";
    const target = Orbit.missionTarget(sim);
    if (!target) {
      message = "Hoď záložní planetu na dráhu uvnitř zlatě vyznačeného budoucího pásma.";
    } else if (target.pop === 0) {
      message = "V přehledu Výzkum a logistika → Výpravy vyber planetu " + target.name + " jako cíl průzkumu. Po příletu mohou následovat další lodě.";
    } else if (mission.priority === "evacuation") {
      message = "Evakuační lodě mají přednost. Jejich cílem je " + target.name + ".";
      if (!target.self && target.pop > 0 && target.supply < 28) {
        const supplier = sim.worlds.some(p => p.self && p.tech);
        message = target.name + " má málo zásob. " + (supplier
          ? "Přepni na Zásoby a nech kolonii doplnit sklad."
          : "Kolonie potřebuje vydržet, než ji dostihne obyvatelné pásmo.");
      }
    } else if (target.self || target.supply >= 65) {
      message = target.name + " je připravený přijmout obyvatele. Přepni prioritu lodí na Evakuace.";
    } else {
      message = "Lodě připravují zásoby pro planetu " + target.name + ". Pak přepni prioritu na Evakuace.";
    }
  }
  if (mission?.phase === "finished" && !sim.crisis) {
    title = mission.outcome.success ? "EVAKUACE SPLNĚNA" : "PŘESUN PÁSMA SKONČIL";
    message = "Soustava dál obíhá v nové obyvatelné zóně.";
  }
  const source = armedProbe();
  if (source) {
    title = "SONDA M PLANETY " + source.name.toUpperCase();
    message = "Ruční míření kolonizační lodě: tahem vyber dráhu k cíli. Běžné výpravy startují automaticky v nabídce Výpravy.";
    if (source.biosphere) {
      message += " Po startu zbude " + Math.floor(source.biosphere.power.reserve - Biosphere.PROBE_ENERGY)
        + " E a " + Math.floor(source.supply - Biosphere.PROBE_CARGO) + " % zásob.";
    }
    calloutTone = "";
  }
  if (sim.mode === "biosphere" && !source && existing && !sim.crisis) {
    if (sim.expanded) {
      title = "VOLNÁ HRA";
      message = "Rozšiřuj soustavu a zkus překonat dosavadní vrchol populace v této hře.";
    } else if (sim.goal) {
      title = "DALŠÍ SOBĚSTAČNÝ SVĚT";
      message = "Dva světy už dosáhly soběstačnosti. Rozviň třetí a udrž při životě i první dva.";
    } else if (!sim.everSpace) {
      title = "02 / ŽIVOT NA POVRCHU";
      message = "Vyber planetu v přehledu a otevři její povrch. Větrem dostaneš vláhu do suché krajiny.";
    }
  }
  if (launchMode?.kind === "planet") {
    title = "VYPUŠTĚNÍ PLANETY";
    message = existing ? "Začni tahem na místě, odkud má planeta vyletět. Směr a délka tahu určí dráhu."
      : "Táhni z modré planetky po šipce. Pusť ji a sleduj oběžnou dráhu.";
    calloutTone = "";
  }
  const visitor = sim.visitor;
  const warning = visitor?.warning;
  if (!impactScene) {
    const threatened = warning && sim.worlds.find(p => p.id === warning.worldId);
    ui["impact-banner"].hidden = !threatened;
    if (threatened) {
      status = "HROZÍ DOPAD";
      badge = "VÝSTRAHA";
      state = "bad";
      put(ui["impact-heading"], "HROZÍ DOPAD · " + threatened.name);
      const seconds = Math.max(1, Math.ceil(warning.at - sim.time));
      put(ui["impact-detail"], Orbit.visitorLabel(visitor) + " · Odhad do střetu " + seconds + " s při 1×");
    } else if (visitorOnMap()) {
      status = Orbit.visitorLabel(visitor).toUpperCase() + (visitorPlaybackRate() < sim.rate ? " · ČAS ZPOMALEN" : " · PRŮLET");
    }
  }
  if (impactScene && !sim.over) {
    status = impactScene.hit ? "PLANETY ZNIČENY" : "KRITICKÁ KOLIZE";
    badge = impactScene.hit ? "KATASTROFA" : "HROZÍ SRÁŽKA";
    state = "bad";
    title = impactScene.hit ? "KOLIZE PLANET" : "POSLEDNÍ CHVÍLE PLANET";
    message = impactScene.hit ? "Srážka právě zničila oba světy." : "Kamera sleduje ohrožené planety. Čas je zpomalený.";
    calloutTone = "warn";
  }
  if (sim.over) {
    status = "CIVILIZACE ZANIKLA";
    badge = "KONEC HRY";
    state = "bad";
    title = "KONEC HRY";
    message = "Statistiky hry jsou připravené.";
    calloutTone = "warn";
  } else if (pointer?.mode || keyboard) {
    status = "MÍŘENÍ · ČAS STOJÍ";
    state = "warn";
  } else if (sim.paused || modalOpen()) {
    status = "ČAS POZASTAVEN";
    state = "warn";
  }
  ui.readout.dataset.state = state;
  ui["live-badge"].dataset.tone = sim.over || sim.crisis || warning ? "bad" : "";
  put(ui["run-status"], status);
  put(ui["live-badge"], badge);
  put(ui["callout-title"], title);
  put(ui["callout-text"], message);
  ui.callout.dataset.tone = calloutTone;
  ui.callout.hidden = Boolean(pointer?.mode || keyboard || surfaceId);
}

function updateMissionUI(independent) {
  const mission = sim.mission;
  const underway = Boolean(mission && mission.phase !== "finished");
  ui["mission-bar"].hidden = !underway;
  ui["legend-future"].hidden = !underway;
  ui["goal-detail"].hidden = !mission;
  if (!mission) {
    if (sim.mode === "biosphere") {
      const secondStage = sim.goal || independent >= 2;
      const expanded = sim.expanded || independent >= 3;
      put(ui["goal-label"], expanded ? "Volná hra" : secondStage ? "Biosféra · 2. etapa" : "Biosféra · 1. etapa");
      put(ui["goal-title"], expanded ? "Milník tří světů splněn" : secondStage ? "Založ třetí soběstačný svět"
        : sim.worlds.length ? "Vytvoř dva soběstačné světy" : "Usaď planetu do zeleného pásma");
      ui["goal-detail"].hidden = !secondStage;
      put(ui["goal-detail"], expanded ? "Soustavu můžeš dál rozšiřovat a měnit podmínky na planetách."
        : "Rozviň další planetu nebo ji osídli sondou. Udrž při životě i první dva světy.");
      return;
    }
    put(ui["goal-label"], sim.goal ? "Splněno" : sim.mode === "campaign" ? "První etapa" : "Cíl tréninku");
    put(ui["goal-title"], sim.goal ? "Dva světy dosáhly soběstačnosti" : "Vytvoř dva soběstačné světy");
    return;
  }
  const ready = mission.phase === "briefing";
  const elapsed = ready ? 0 : sim.time - mission.began;
  const remaining = Math.max(0, mission.duration - elapsed);
  const saved = mission.outcome ?? Orbit.safeEvacuees(sim);
  ui["mission-start"].hidden = !ready;
  ui["mission-priority"].hidden = ready;
  ui["mission-meter"].dataset.tone = remaining < 10 ? "bad" : "";
  put(ui["mission-time"], Math.ceil(remaining) + " s");
  ui["mission-progress"].value = Orbit.clamp(elapsed / mission.duration, 0, 1);
  for (const button of priorities) button.setAttribute("aria-pressed", String(mission.priority === button.dataset.priority));
  put(ui["goal-label"], mission.outcome ? "Výsledek mise" : "Stěhování obyvatelné zóny");
  put(ui["goal-title"], mission.outcome
    ? mission.outcome.success ? "Evakuace splněna" : "Evakuace nedokončena"
    : "Zachraň polovinu obyvatel z planety " + mission.homeName);
  put(ui["goal-detail"], number.format(saved.people) + " z " + number.format(mission.initialPeople) + " původních obyvatel v bezpečí");
}

function setWorldOptions(select, choices, preferred = select.value) {
  choices = orderedWorlds(choices);
  const key = choices.map(p => p.id + "/" + p.name).join("|");
  if (select.dataset.choices !== key) {
    select.replaceChildren(...choices.map(p => {
      const option = document.createElement("option");
      option.value = String(p.id);
      option.textContent = p.name;
      return option;
    }));
    select.dataset.choices = key;
  }
  const next = choices.find(p => String(p.id) === String(preferred)) ?? choices[0];
  select.value = next ? String(next.id) : "";
}

function economySelection() {
  const world = field => sim.worlds.find(p => p.id === Number(ui["economy-" + field].value));
  return { from: world("from"), to: world("to"), backup: world("backup"), reserve: ui["economy-reserve"].valueAsNumber };
}

function economyOptions(choices, preferred = {}) {
  setWorldOptions(ui["economy-from"], choices, preferred.from);
  const { from } = economySelection();
  setWorldOptions(ui["economy-to"], choices.filter(p => p !== from), preferred.to);
  const { to } = economySelection();
  const backups = choices.filter(p => p !== from && p !== to && Orbit.navigationReady(p));
  setWorldOptions(ui["economy-backup"], [{ id: 0, name: "Bez zálohy" }, ...backups]);
}

function loadRouteControls() {
  const { to } = economySelection();
  const saved = sim.supplyRoutes.find(plan => plan.to === to?.id);
  ui["economy-reserve"].value = saved?.reserve ?? Orbit.ROUTE_RESERVE;
  const select = ui["economy-backup"];
  select.value = String(saved?.backup ?? 0);
  if (!select.value) select.value = "0";
}

function economyResult(message) {
  put(ui["economy-feedback"], message);
  updateUI();
}

function frontierNote(choices) {
  const cold = choices.filter(p => p.colony && p.orbit.apo > sim.zone.outer);
  const outpost = cold.find(p => p.id === selected) ?? cold.find(p => p.frontierReady) ?? cold[0];
  if (!outpost) return "Průkopnický cíl · Udrž studenou základnu celý oběh.";
  const link = sim.supplyRoutes.find(plan => plan.to === outpost.id);
  const backup = link && Orbit.routeWorlds(sim, link).backup;
  const ready = Orbit.navigationReady(backup) && backup.supply >= link.reserve + Orbit.CARGO.supply.cargo
    && backup.biosphere.power.reserve >= Orbit.CARGO.supply.energy + Biosphere.CITY_RESERVE;
  const progress = outpost.frontierReady ? "Celý oběh přežit"
    : "Oběh " + Math.floor(100 * Math.min(1, outpost.frontierTime / outpost.orbit.period)) + " %";
  return outpost.name + " · " + progress + (ready ? " · Záloha připravena" : " · Připrav záložního dodavatele");
}

function updateEconomyUI() {
  const choices = sim.worlds.filter(p => p.pop > 0 && p.biosphere);
  ui["economy-strip"].hidden = sim.mode !== "biosphere" || !choices.length || sim.over;
  ui["economy-open"].disabled = Boolean(impactScene);
  if (!ui["economy-strip"].hidden) put(ui["economy-goal"], frontierNote(choices));
  if (!ui["economy-dialog"].open) return;
  economyOptions(choices);
  const { from, to, backup, reserve } = economySelection();
  const validReserve = Number.isInteger(reserve) && reserve >= 0 && reserve <= Orbit.ROUTE_MAX_RESERVE;
  const s = from?.biosphere;
  const active = s?.research.active;
  const shared = from && Patronage.sciencePool(sim, from);
  const program = from && sim.spacePrograms?.[from.id];
  put(ui["economy-energy"], s ? Math.floor(s.power.reserve) + " E" : "—");
  put(ui["economy-stock"], from ? Math.floor(from.supply) + " M" : "—");
  put(ui["economy-science"], shared ? shared.pool.points + " VB" : "—");
  const balance = s ? shared ? shared.pool.faith < 10 ? "Věda je uzamčená: nejprve dokonči společnou víru 10 / 10."
    : active ? "Společný výzkum: " + Biosphere.RESEARCH[active].name + " · " + decimal.format(s.power.programDraw) + " E/s z této planety."
    : program?.active ? "Místní vesmírný program · " + Math.floor(s.power.work / Biosphere.PROBE_WORK * 100) + " %."
    : program?.funded && s.power.work >= Biosphere.PROBE_WORK ? "Kosmodrom je dokončený. Start sondy zaplatíš samostatně; další společný výzkum můžeš zvolit níže."
    : "Vyber a zaplať projekt. Bez pokynu věda ani vesmírný program tvé civilizace neběží." : "Pozoruješ autonomní civilizaci. Vlastní projekty zahájíš u své civilizace." : "Vyber dodavatele.";
  put(ui["economy-research-status"], balance);
  for (const button of researchButtons) {
    const key = button.dataset.researchKey;
    const issue = s ? Patronage.researchFundingBlock(sim, from, key) : "Vyber dodavatele.";
    const progress = s ? Math.floor(100 * s.research.progress[key] / Biosphere.RESEARCH[key].work) : 0;
    button.disabled = Boolean(issue && active !== key);
    button.setAttribute("aria-pressed", String(active === key));
    const detail = active === key ? "Vybráno. Kliknutím pozastavíš. " + Biosphere.researchWait(s, from.pop, from.supply, key) : issue || "Kliknutím zahájíš nebo obnovíš společný projekt. Potom zavři okno.";
    const price = Patronage.RESEARCH_COSTS[key];
    put(button.querySelector(".order-price"), shared?.pool.science.funded[key] ? "Zahájení zaplaceno · další práce spotřebovává energii"
      : "Zahájení " + price.energy + " E + " + price.supplies + " M · další práce až " + decimal.format(Biosphere.RESEARCH[key].work * 3.2) + " E");
    put(button.querySelector("small"), progress + " % · " + detail);
  }
  const spaceIssue = from ? Patronage.spaceBlock(sim, from) : "Vyber dodavatele.";
  ui["economy-space"].disabled = Boolean(spaceIssue && !program?.active);
  ui["economy-space"].setAttribute("aria-pressed", String(Boolean(program?.active)));
  put(ui["economy-space"].querySelector(".order-price"), program?.funded ? "Zahájení zaplaceno · provoz z místní energie" : "Zahájení 60 E + 20 M · další práce až 179,2 E");
  put(ui["economy-space"].querySelector("small"), (shared?.pool.faith >= 10 && program?.funded ? Math.floor(s.power.work / Biosphere.PROBE_WORK * 100) + " % · " : "")
    + (program?.active ? "Kliknutím pozastavíš místní program." : spaceIssue || "Kliknutím zahájíš placený místní program."));
  const inbound = to && Orbit.incomingCargo(sim, to.id);
  const runway = to?.supplyRate < -0.01 ? decimal.format(Math.max(0, to.supply / -to.supplyRate)) + " s výdrže" : "Zásoby neklesají";
  const delivery = to ? Math.floor(to.supply) + " zásob · " + runway + (inbound.count
    ? " · Přílet za " + decimal.format(inbound.eta) + " s při 1×"
    : from ? " · Let asi " + decimal.format(Orbit.flightTime(from, to)) + " s při 1×" : "") : "Vyber obydlený cíl.";
  put(ui["economy-delivery-status"], delivery);
  const reserveIssue = validReserve ? "" : "Rezerva musí být 0 až " + Orbit.ROUTE_MAX_RESERVE + " M.";
  for (const button of cargoButtons) {
    const key = button.dataset.cargo;
    const spec = Orbit.CARGO[key];
    const issue = reserveIssue || Orbit.cargoBlock(sim, from, to, key, reserve);
    button.disabled = Boolean(issue);
    put(button.querySelector(".order-price"), spec.energy + " E + " + (spec.cargo + spec.materials) + " M");
    put(button.querySelector("small"), issue || "Připraveno ke startu.");
  }
  const routeIssue = reserveIssue || Orbit.routeBlock(sim, from, to, backup);
  const current = sim.supplyRoutes.find(plan => plan.to === to?.id);
  ui["economy-route-save"].disabled = Boolean(routeIssue);
  ui["economy-route-remove"].disabled = !current;
  put(ui["economy-route-status"], routeIssue || (current ? "Na tento cíl už vede linka. Uložením ji upravíš."
    : "Loď odletí podle výdrže cíle, dostupné energie a nastavené rezervy."));
  const lines = sim.supplyRoutes.map(plan => {
    const worlds = Orbit.routeWorlds(sim, plan);
    const available = [worlds.from, worlds.backup].find(p => Orbit.navigationReady(p)
      && !Orbit.cargoBlock(sim, p, worlds.to, "supply", plan.reserve));
    return (worlds.from?.name ?? "Ztracený dodavatel") + " → " + (worlds.to?.name ?? "Ztracený cíl")
      + " · Rezerva " + plan.reserve + (worlds.backup ? " · Záloha " + worlds.backup.name : "")
      + (available ? " · Připraven " + available.name : " · Čeká na dostupného dodavatele");
  });
  const list = ui["economy-routes"], key = lines.join("|");
  if (list.dataset.key !== key) {
    list.replaceChildren(...lines.map(line => {
      const row = document.createElement("li");
      row.textContent = line;
      return row;
    }));
    list.dataset.key = key;
  }
}

// OPT2: Profiling wrappers are completely inactive when the diagnostics panel
// is closed and never change the call order of the existing renderers.
function measureHudPart(label, callback) {
  if (!PerformanceHUD.active) return callback();
  const start = performance.now();
  try { return callback(); }
  finally { PerformanceHUD.mark(label, performance.now() - start); }
}
function updateUI() {
  reconcileWorldSelection();
  const year = String(yearAt(sim.time)).padStart(6, "0").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  put(ui.year, year);
  renderSystemOverview();
  const independent = Orbit.independentCount(sim);
  const source = armedProbe();
  const timeLocked = sim.over || sim.mission?.phase === "briefing" || Boolean(impactScene);
  if (launchMode && (timeLocked || launchMode.kind === "probe" && !source)) {
    launchMode = null;
    clearAim();
  }
  const planetArmed = launchMode?.kind === "planet";
  const launchSite = source ?? availableLaunchSite();
  ui["planet-mode"].disabled = timeLocked || sim.worlds.length >= Orbit.LIMIT;
  ui["planet-mode"].setAttribute("aria-pressed", String(planetArmed));
  put(ui["planet-mode"], planetArmed ? "Zrušit hod" : "Vypustit planetu");
  ui["planet-mode"].title = sim.worlds.length >= Orbit.LIMIT ? "Soustava je plná" : "Zapnout míření planety";
  ui.map.classList.toggle("is-aiming", Boolean(launchMode));
  put(ui["legend-forecast"], source ? "Předpověď letu" : sim.mode === "training" ? "Předpověď" : "Krátká předpověď");
  for (const button of physicsButtons) button.setAttribute("aria-pressed", String(sim.physics === button.dataset.physics));
  const critical = sim.worlds.filter(p => p.orbitAlert === "bad").length;
  const warnings = sim.worlds.filter(p => p.orbitAlert === "warn").length;
  const visitorWarning = sim.visitor?.warning;
  ui["orbit-monitor"].dataset.tone = impactScene || visitorWarning || critical ? "bad" : warnings ? "warn" : "";
  put(ui["orbit-monitor-value"], impactScene ? (impactScene.hit ? "KATASTROFA" : "HROZÍ SRÁŽKA")
    : visitorWarning ? "HROZÍ DOPAD" : critical ? critical + " KRITICKÝCH" : warnings ? warnings + " VAROVÁNÍ" : "VŠE V POŘÁDKU");
  updateMissionUI(independent);
  put(ui["ship-count"], (sim.ships.length + sim.probes.length) + " NA CESTĚ");
  ui.pause.setAttribute("aria-pressed", String(sim.paused));
  ui.pause.setAttribute("aria-label", sim.paused ? "Spustit čas" : "Pozastavit čas");
  ui.pause.disabled = timeLocked || galaxyBusy;
  for (const button of rates) {
    button.disabled = timeLocked || galaxyBusy;
    button.setAttribute("aria-pressed", String(sim.rate === Number(button.dataset.rate)));
  }
  measureHudPart("hudCards", updateCards);
  measureHudPart("hudSurface", updateSurfaceUI);
  measureHudPart("hudEconomy", updateEconomyUI);
  measureHudPart("hudBuildings", updateBuildingsUI);
  // The old patron strip is permanently hidden by the MATRIOŠKA layout.
  // Its original native dialog remains 100% live when opened; otherwise the
  // shared management panel obtains its current data through the UI catalogue.
  if (!ui["world-navigation"].classList.contains("top-management") || ui["patron-dialog"].open)
    measureHudPart("hudPatron", updatePatronUI);
  measureHudPart("hudStatus", updateStatus);
  measureHudPart("hudVoyages", updateVoyages);
  measureHudPart("hudLog", flushLog);
}

function clearPlanetNameFeedback() {
  ui["new-planet-name-feedback"].hidden = true;
  ui["new-planet-name"].removeAttribute("aria-invalid");
}

function readPlanetLaunchName() {
  const input = ui["new-planet-name"], feedback = ui["new-planet-name-feedback"];
  const name = Orbit.cleanPlanetName(input.value);
  if (!name || !Orbit.planetNameTaken(sim, name)) return name;
  put(feedback, "Jiná planeta v této soustavě už používá stejný název.");
  feedback.hidden = false;
  input.setAttribute("aria-invalid", "true");
  ui["world-options"].open = true;
  input.focus();
  return null;
}

function launch(shot, mode) {
  if (!mode || mode !== launchMode || impactScene || sim.mission?.phase === "briefing") return;
  if (mode.kind === "probe") {
    const source = armedProbe();
    if (source && mode.plan) {
      const target = sim.worlds.find(p => p.id === mode.plan.targetId);
      const issue = Space.colonyLaunchIssue(sim, source, target, sim.patron?.id, mode.plan);
      if (issue) {
        launchMode = null;
        GameInterface.openFlights(source, target);
        economyResult(issue);
        return;
      }
    }
    if (source && Orbit.launchProbe(sim, source, shot, mode.plan)) launchMode = null;
  } else {
    const name = readPlanetLaunchName();
    if (name === null) launchMode = null;
    else {
      const world = Orbit.launch(sim, shot, false, name);
      if (world) {
        selected = world.id;
        ui["new-planet-name"].value = "";
        clearPlanetNameFeedback();
        launchMode = null;
      }
    }
  }
  updateUI();
}

function clearAim() {
  const id = pointer?.id;
  pointer = null;
  ui.map.classList.remove("is-panning");
  if (id !== undefined && ui.map.hasPointerCapture(id)) ui.map.releasePointerCapture(id);
  keyboard = null;
  aim = null;
  pendingShot = null;
  nextForecast = 0;
  updateForecast(null);
}

function loadRun(state) {
  finishImpactScene();
  clearAim();
  clearWeatherAim();
  setMapPicker(false);
  for (const id of ["patron-settlement-name", "patron-civilization-name"]) delete ui[id].dataset.binding;
  sim = state;
  Orbit.restoreSurfaceSchedule(sim);
  nextImpactScan = sim.time;
  buildingPreviews.clear();
  ui["new-planet-name"].value = "";
  clearPlanetNameFeedback();
  ui["world-options"].open = !sim.stats.thrown && !sim.worlds.length;
  surfaceId = 0;
  launchMode = null;
  orbitCamera = null;
  voyageKey = "";
  pendingProbeId = null;
  pendingDemolition = buildingFocus = null; stationPickerWorld = preferredStation = 0;
  sim.events = (sim.history ?? []).slice(-16);
  selected = sim.mission?.homeId ?? 0;
  accumulator = 0;
  afterEnd = 0;
  resultsShown = false;
  missionResultShown = false;
  nextUI = 0;
  for (const card of cards.values()) card.row.remove();
  cards.clear();
  ui.log.replaceChildren();
  updateUI();
  resize();
}

function reset(mode = sim.mode) {
  clearGalaxy();
  missionCheckpoint = null;
  loadRun(Orbit.make(mode));
}

function replayMission() {
  clearGalaxy();
  const state = structuredClone(missionCheckpoint);
  Orbit.event(state, "Mise je připravena k dalšímu pokusu.", "warn");
  loadRun(state);
}

function results() {
  resultsShown = true;
  const missing = sim.voyages.reduce((sum, record) => sum + (record.status === "deep" ? record.people : 0), 0);
  const note = missing ? " V hlubokém vesmíru je pohřešováno " + number.format(missing) + " členů posádek." : "";
  put(ui["result-note"], "Osídlení soustavy skončilo." + note);
  put(ui["result-lost"], number.format(sim.stats.losses));
  put(ui["result-peak"], number.format(sim.stats.peak));
  put(ui["result-worlds"], sim.stats.destroyed);
  put(ui["result-throws"], sim.stats.thrown);
  put(ui["result-crew-lost"], number.format(sim.stats.crewLost ?? 0));
  put(ui["result-missing"], number.format(missing));
  ui["result-galaxy"].hidden = !galaxyOthers.size;
  ui.results.showModal();
}

function showMissionResult() {
  const { outcome, initialPeople } = sim.mission;
  missionResultShown = true;
  ui["mission-result"].dataset.tone = outcome.success ? "good" : "warn";
  ui["mission-result"].returnValue = "";
  put(ui["mission-result-title"], outcome.success ? "Evakuace splněna" : "Evakuace nedokončena");
  put(ui["mission-result-note"], outcome.worlds.length
    ? "Zachránění obyvatelé žijí na " + (outcome.worlds.length === 1 ? "soběstačné planetě " : "soběstačných planetách ") + outcome.worlds.join(", ") + "."
    : "Do konce přesunu se původním obyvatelům nepodařilo usadit na soběstačném světě.");
  put(ui["mission-result-saved"], number.format(outcome.people) + " / " + number.format(initialPeople));
  put(ui["mission-result-share"], Math.round(outcome.people / initialPeople * 100) + " %");
  ui["mission-result"].showModal();
}

// Cinematic mode is deliberately a camera/UI effect: orbital physics stays unchanged.
function finishImpactScene() {
  impactScene = null;
  impactDraw = null;
  nextImpactScan = sim?.time ?? 0;
  if (ui["impact-banner"]) ui["impact-banner"].hidden = true;
  if (ui.field) ui.field.classList.remove("impact-active");
}
function beginImpactScene(hit) {
  if (impactScene || sim.over) return;
  const a = sim.worlds.find(p => p.id === hit.aId);
  const b = sim.worlds.find(p => p.id === hit.bId);
  if (!a || (hit.kind === "collision" && !b)) return;
  clearAim();
  clearWeatherAim();
  if (surfaceId) showSurface(null);
  selected = a.id;
  launchMode = null;
  impactScene = { ...hit, started: sim.time, hit: false, hold: 0,
    focus: { x: hit.x, y: hit.y }, originalRate: sim.rate };
  impactDraw = null;
  ui["impact-banner"].hidden = false;
  ui.field.classList.add("impact-active");
  put(ui["impact-heading"], hit.kind === "sun" ? "HROZÍ PÁD DO SLUNCE" : "HROZÍ SRÁŽKA PLANET");
  put(ui["impact-detail"], hit.kind === "sun"
    ? "Sleduješ poslední chvíle planety " + a.name + ". Simulace zpomaluje."
    : "Sleduješ poslední chvíle: " + a.name + " a " + b.name + ". Simulace zpomaluje.");
  Orbit.event(sim, hit.kind === "sun" ? "Kritické varování: " + a.name + " míří do Slunce."
    : "Kritické varování: blíží se srážka planet " + a.name + " a " + b.name + ".", "bad");
  updateUI();
}
function scanImpact() {
  if (impactScene || sim.over || sim.time < nextImpactScan || !sim.worlds.length) return;
  nextImpactScan = sim.time + 0.18;
  const predicted = Orbit.predictImpact(sim, 2.6);
  if (predicted && predicted.eta > 0.03 && predicted.eta < 2.6) beginImpactScene(predicted);
}
function advanceImpactScene(elapsed) {
  const scene = impactScene;
  if (!scene) return;
  const a = sim.worlds.find(p => p.id === scene.aId);
  const b = sim.worlds.find(p => p.id === scene.bId);
  if (!scene.hit && (a === undefined || (scene.bId !== null && b === undefined))) {
    scene.hit = true;
    scene.hold = 0;
    afterEnd = 0;
    put(ui["impact-heading"], scene.kind === "sun" ? "PLANETA ZANIKLA" : "SRÁŽKA PLANET");
    put(ui["impact-detail"], scene.kind === "sun"
      ? scene.aName + " byla zničena při pádu do Slunce."
      : scene.aName + " a " + scene.bName + " byly zničeny.");
  }
  if (scene.hit) {
    scene.hold += elapsed;
    if (!sim.over && scene.hold >= 1.8) finishImpactScene();
  } else if (sim.time > scene.started + 4.6) {
    Orbit.event(sim, "Planety se nakonec vyhnuly přímému střetu.", "warn");
    finishImpactScene();
  }
}
function impactCamera() {
  const scene = impactScene;
  if (!scene || !view) return view;
  const a = sim.worlds.find(p => p.id === scene.aId);
  const b = sim.worlds.find(p => p.id === scene.bId);
  if (a || b) {
    const mx = a && b ? (a.x + b.x) / 2 : (a || b).x;
    const my = a && b ? (a.y + b.y) / 2 : (a || b).y;
    scene.focus = { x: mx, y: my };
  }
  const dist = a && b ? Orbit.distance(a, b) : 0;
  const scale = Math.min(4.1, Math.max(0.85, Math.min(view.w / (dist + 115), view.h / (dist + 115))));
  return { ...view, zoom: "cinematic", scale,
    cx: view.w / 2 - scene.focus.x * scale,
    cy: view.h / 2 - scene.focus.y * scale };
}

function visitorOnMap() {
  if (!view || !sim.visitor || viewedPlanet()) return false;
  const x = sim.visitor.x * view.scale + view.cx;
  const y = sim.visitor.y * view.scale + view.cy;
  return x >= -24 && x <= view.w + 24 && y >= -24 && y <= view.h + 24;
}

function visitorPlaybackRate() {
  // Slow time only for an actual danger or immediate impact aftermath.
  // A harmless passing object must not cap 4× and 12× to the same speed.
  if (sim.visitor?.warning || sim.effects.some(effect => effect.visitor && effect.age < 1.5)) return Math.min(sim.rate, 1);
  return sim.rate;
}

function galaxyHasStarted() {
  return Galaxy.started(sim) || [...galaxyOthers.values()].some(entry => entry.background.currentInfo.started);
}

function frame(now) {
  // M1-PERF is read-only and completely inactive until the player opens it.
  const measure = PerformanceHUD.active;
  const frameCpuStart = performance.now();
  const perfStart = measure ? frameCpuStart : 0;
  let perfSteps = 0, perfSimMs = 0, perfUiMs = 0, perfDrawMs = 0, perfBlocked = "";
  let frameSimMs = 0, frameWorkerBlocked = false, frameBudgetBlocked = false;
  let frameStepCapBlocked = false, frameBudgetMs = 0, framePendingStepCount = 0;
  const perfFinish = () => {
    if (!measure) return;
    const workers = [...galaxyOthers.values()].map(entry => entry.background);
    const workerCount = workers.filter(background => background.threaded).length;
    const mainCount = workers.length - workerCount;
    if (!perfSteps) {
      if (sim.paused) perfBlocked = "Čas je pozastavený.";
      else if (document.hidden) perfBlocked = "Prohlížeč je na pozadí.";
      else if (sim.over) perfBlocked = "Soustava skončila.";
      else if (galaxyBusy) perfBlocked = "Čeká se na galaktické výpočty.";
      else if (modalOpen()) perfBlocked = "Otevřený dialog pozastavuje simulaci.";
      else if (pointer?.mode || keyboard) perfBlocked = "Nedokončený hod nebo ovládání mapy.";
      else if (sim.mission?.phase === "briefing") perfBlocked = "Čeká se na zahájení mise.";
      else if (!galaxyHasStarted()) perfBlocked = "Soustava zatím nebyla spuštěna.";
    }
    if (now - perfContextAt >= 1500) {
      let settlements = 0, residents = 0;
      for (const world of sim.worlds) for (const community of world.biosphere?.communities ?? []) {
        if (community.active && community.people > 0) { settlements++; residents += community.people; }
      }
      perfContextCache = { inhabitedSettlements: settlements, settlementResidents: residents };
      perfContextAt = now;
    }
    PerformanceHUD.record({
      now, steps: perfSteps, rate: sim.rate, stepSeconds: Orbit.STEP, simMs: perfSimMs, uiMs: perfUiMs, drawMs: perfDrawMs,
      busyMs: performance.now() - perfStart, reason: perfBlocked,
      simBudgetMs: frameBudgetMs, workerBlocked: frameWorkerBlocked,
      budgetBlocked: frameBudgetBlocked, stepCapBlocked: frameStepCapBlocked,
      context: {
        phase: galaxyViewing ? "Galaxie" : surfaceId ? "Povrch" : "Soustava",
        planets: sim.worlds.length,
        otherSystems: galaxyOthers.size,
        backgroundWorkerSystems: workerCount,
        backgroundMainSystems: mainCount,
        backgroundBusySystems: workers.filter(background => background.waiting).length,
        backgroundWorkerDurations: [...galaxyOthers.values()].filter(entry =>
          entry.background.threaded && entry.background.workerStepCount > 0)
          .map(entry => ({ name: entry.name, planets: entry.background.currentInfo.worlds,
            steps: entry.background.workerStepCount,
            ms: Number(entry.background.workerStepMs.toFixed(2)),
            roundTripMs: Number(entry.background.workerRoundTripMs.toFixed(2)),
            msPerStep: Number((entry.background.workerStepMs / entry.background.workerStepCount).toFixed(3)) })),
        pendingSteps: framePendingStepCount,
        frameIntervalEstimateMs: Number(frameIntervalEstimate.toFixed(2)),
        frameFixedCostEstimateMs: Number(frameFixedCostEstimate.toFixed(2)),
        backgroundFallbackReasons: mainCount ? [...new Set(workers.filter(background => !background.threaded)
          .map(background => background.fallbackReason).filter(Boolean))].slice(0, 3) : [],
        ships: sim.ships.length,
        probes: sim.probes.length,
        patron: Boolean(sim.patron),
        paused: Boolean(sim.paused),
        ...perfContextCache
      }
    });
  };
  const frameInterval = lastFrame ? now - lastFrame : 0;
  const elapsed = frameInterval ? Math.min(0.28, frameInterval / 1000) : 0;
  // Long pauses are not the display's refresh rate. Ignore them when estimating
  // how much CPU time a real interactive frame can afford.
  if (frameInterval >= 12 && frameInterval <= 55) {
    frameIntervalEstimate = frameIntervalEstimate * 0.9 + frameInterval * 0.1;
  }
  lastFrame = now;
  const full = sim.mode === "training";
  const galaxyOpen = galaxyViewing;
  if (pendingShot && now >= nextForecast) {
    const source = armedProbe();
    const forecast = source ? Orbit.predictProbe(pendingShot, sim.worlds, source, sim.physics === "stable")
      : Orbit.predict(pendingShot, sim.worlds, sim.nextId, full, sim.physics === "stable");
    aim = { shot: pendingShot, forecast };
    pendingShot = null;
    nextForecast = now + (sim.worlds.length > 7 ? 48 : 0);
    updateForecast(aim.forecast, aim.shot);
  }
  if (sim.over) {
    afterEnd += elapsed;
    for (const effect of sim.effects) effect.age += elapsed;
    const catastrophe = impactScene || sim.effects.some(effect => effect.visitor && effect.collision);
    if (!resultsShown && afterEnd >= (catastrophe ? 2.15 : 0.62) && !modalOpen()) results();
  } else if (sim.mission?.phase === "finished" && !missionResultShown) {
    if (!modalOpen()) showMissionResult();
  } else if (galaxyHasStarted() && sim.mission?.phase !== "briefing"
    && !sim.paused && !galaxyBusy && !pointer?.mode && !keyboard && !modalOpen() && !document.hidden
    && !(impactScene?.hit)) {
    const perfSimulationStart = performance.now();
    const surface = viewedPlanet()?.biosphere;
    const rate = impactScene ? (reduceMotion.matches ? 1 : 0.65) : visitorPlaybackRate();
    // Bound catch-up and CPU work separately. Under load time slows down instead
    // of accumulating an ever-growing debt that freezes input for seconds.
    // At 30 FPS the old 18-step cap alone limited 12x to at most 6x.
    // Keep a bounded backlog to protect controls when a remote worker is slow,
    // but size it to the requested rate and the observed refresh interval.
    const frameStepLimit = Math.min(72, Math.max(18, Math.ceil(rate * Math.max(elapsed, 1 / 60) / Orbit.STEP) + 6));
    accumulator = Math.min(accumulator + elapsed * rate, Orbit.STEP * frameStepLimit);
    frameBudgetMs = simulationFrameBudget();
    const simulationDeadline = performance.now() + frameBudgetMs;
    const others = [...galaxyOthers.values()].map(entry => entry.background);
    const ready = others.every(background => !background.waiting);
    const era = others.length ? Math.max(Galaxy.era(sim), ...others.map(background => background.era)) : undefined;
    let simulationSteps = 0;
    while (accumulator >= Orbit.STEP && simulationSteps < frameStepLimit && ready && (simulationSteps === 0 || performance.now() < simulationDeadline) && !sim.over && !sim.paused && sim.mission?.phase !== "briefing") {
      if (surface && weatherPointer && !weatherPointer.pan && groundCursor && temperatures[weatherTool]) Biosphere.temper(surface,groundCursor,Orbit.STEP*.92*temperatures[weatherTool],weatherRadius);
      Galaxy.step(sim, era);
      for (const background of others) if (!background.threaded) background.advance(1, era);
      simulationSteps++;
      accumulator -= Orbit.STEP;
      if (impactScene) {
        if (!sim.worlds.some(p => p.id === impactScene.aId)
          || (impactScene.bId !== null && !sim.worlds.some(p => p.id === impactScene.bId))) break;
      } else {
        scanImpact();
        // A fast frame must stop as soon as a close pass or warning slows the clock.
        if (impactScene || visitorPlaybackRate() < rate * 0.9) { accumulator = 0; break; }
      }
    }
    if (simulationSteps) for (const background of others) if (background.threaded) background.advance(simulationSteps, era);
    frameSimMs = performance.now() - perfSimulationStart;
    framePendingStepCount = Math.max(0, Math.floor(accumulator / Orbit.STEP + 1e-7));
    frameWorkerBlocked = !ready && framePendingStepCount > 0;
    frameStepCapBlocked = ready && simulationSteps >= frameStepLimit && framePendingStepCount > 0;
    frameBudgetBlocked = ready && !frameStepCapBlocked && framePendingStepCount > 0 && simulationSteps > 0
      && performance.now() >= simulationDeadline;
    if (measure) {
      perfSteps = simulationSteps;
      perfSimMs = frameSimMs;
      if (!ready) perfBlocked = "Čeká se na simulační vlákno jiné soustavy.";
      else if (rate < sim.rate) perfBlocked = "Bezpečnostní zpomalení kvůli události nebo srážce.";
    }
  }
  if (impactScene) advanceImpactScene(elapsed);
  if (galaxyOpen) {
    if (now >= nextUI) {
      const perfUIStart = measure ? performance.now() : 0;
      put(ui.year, Evolution.dateLabel(Evolution.dateAt(sim)));
      updateGalaxyOverview();
      if (!ui["map-planet-picker"].hidden) syncMapPicker(false);
      nextUI = now + 120;
      if (measure) perfUiMs += performance.now() - perfUIStart;
    }
    const perfDrawStart = measure ? performance.now() : 0;
    if (!sim.paused && !reduceMotion.matches) positionGalaxyStars();
    if (measure) perfDrawMs += performance.now() - perfDrawStart;
    accountFrameWork(performance.now() - frameCpuStart, frameSimMs);
    perfFinish();
    queueGameFrame();
    return;
  }
  if (now >= nextUI || sim.events.length) {
    const perfUIStart = measure ? performance.now() : 0;
    updateUI();
    if (measure) perfUiMs += performance.now() - perfUIStart;
    nextUI = now + 120;
  }
  const perfDrawStart = measure ? performance.now() : 0;
  const p = viewedPlanet();
  if (view && p) {
    if (now >= nextGroundFrame) {
      SurfaceView.render(groundContext, view, surfaceCamera, p, reduceMotion.matches ? 0 : now / 1000, {
        pointer: groundCursor, from: weatherPointer?.start ?? windStart, tool: weatherTool, radius: weatherRadius,
        focusTile: buildingFocus?.worldId === p.id && now < buildingFocus.until ? buildingFocus.tile : null
      });
      nextGroundFrame = now + 32;
    }
  } else if (view) {
    const drift = Math.abs(Evolution.zone(sim).inner - renderedInner);
    if (orbitDirty || drift >= 0.55 || (drift > 0 && sim.mission?.phase === "finished")) redrawBackdrop();
    if (impactScene) {
      const target = impactCamera();
      if (!impactDraw || now - impactDraw.at > 65) {
        impactDraw = { view: target, backdrop: Art.staticField(target, Evolution.zone(sim), impactDraw?.backdrop), at: now };
      }
      Art.render(context, impactDraw.view, impactDraw.backdrop, sim, null,
        starterExample(full), selected,
        reduceMotion.matches ? 0 : now / 1000, null);
    } else {
      Art.render(context, view, backdrop, sim, aim, starterExample(full), selected,
        reduceMotion.matches ? 0 : now / 1000, armedProbe(), launchMode?.kind === "planet");
    }
  }
  if (measure) perfDrawMs += performance.now() - perfDrawStart;
  accountFrameWork(performance.now() - frameCpuStart, frameSimMs);
  perfFinish();
  queueGameFrame();
}

function cursor(e) {
  const rect = ui.map.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left - view.cx) / view.scale,
    y: (e.clientY - rect.top - view.cy) / view.scale
  };
}

function shotFrom(e) {
  // Camera zoom changes the launch position without changing the power of the gesture.
  const force = Orbit.IMPULSE / view.aimScale;
  let vx = (e.clientX - pointer.clientX) * force;
  let vy = (e.clientY - pointer.clientY) * force;
  const speed = Math.hypot(vx, vy);
  if (speed > Orbit.MAX_SPEED) {
    vx *= Orbit.MAX_SPEED / speed;
    vy *= Orbit.MAX_SPEED / speed;
  }
  return { x: pointer.origin.x, y: pointer.origin.y, vx, vy };
}

function moved(e) {
  return Math.hypot(e.clientX - pointer.clientX, e.clientY - pointer.clientY) >= 7;
}

ui.map.addEventListener("pointerdown", e => {
  if (pointer || sim.over || impactScene || (e.button !== 0 && e.button !== 1) || !view) return;
  e.preventDefault();
  clearAim();
  ui.map.focus({ preventScroll: true });
  const start = cursor(e);
  const source = armedProbe();
  const mode = e.button === 0 && (launchMode?.kind !== "probe" || source) ? launchMode : null;
  const snap = mode?.kind === "planet" && !sim.worlds.length && Orbit.distance(start, Evolution.starterShot(sim)) * view.scale < 13;
  pointer = { id: e.pointerId, clientX: e.clientX, clientY: e.clientY, lastX: e.clientX, lastY: e.clientY,
    mode, start, origin: source ?? (snap ? Evolution.starterShot(sim) : start), dragged: false, select: e.button === 0 };
  ui.map.setPointerCapture(e.pointerId);
  updateStatus();
});
function trackMapPointer(e) {
  if (pointer?.id !== e.pointerId || (!pointer.dragged && !moved(e))) return;
  pointer.dragged = true;
  if (pointer.mode) {
    pendingShot = shotFrom(e);
  } else {
    panOrbit(e.clientX - pointer.lastX, e.clientY - pointer.lastY);
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
    ui.map.classList.add("is-panning");
  }
}
ui.map.addEventListener("pointermove", trackMapPointer);
ui.map.addEventListener("pointerup", e => {
  if (pointer?.id !== e.pointerId) return;
  trackMapPointer(e);
  const { mode, start, select, dragged } = pointer;
  const shot = mode && moved(e) ? shotFrom(e) : null;
  clearAim();
  if (shot) {
    launch(shot, mode);
  } else if (!mode && select && !dragged) {
    const p = sim.worlds.find(world => Orbit.distance(world, start) < world.radius + 7 / view.scale);
    if (p) selected = p.id === selected ? 0 : p.id;
    updateUI();
  } else {
    updateStatus();
  }
});
function cancelPointer(e) {
  if (pointer?.id !== e.pointerId) return;
  clearAim();
  updateStatus();
}
ui.map.addEventListener("pointercancel", cancelPointer);
ui.map.addEventListener("lostpointercapture", cancelPointer);
ui.map.addEventListener("wheel", e => {
  if (!view || pointer || impactScene || e.ctrlKey || e.metaKey || !e.deltaY) return;
  e.preventDefault();
  const rect = ui.map.getBoundingClientRect();
  const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? view.h : 1);
  zoomOrbit(orbitCamera.zoom * Math.exp(-Orbit.clamp(delta, -140, 140) * 0.003),
    { x: e.clientX - rect.left, y: e.clientY - rect.top });
}, { passive: false });

function defaultKeyboardShot() {
  const source = armedProbe();
  if (source) {
    const target = sim.worlds.find(p => p.id !== source.id && p.pop === 0)
      ?? sim.worlds.find(p => p.id !== source.id);
    const angle = target ? Math.atan2(target.y - source.y, target.x - source.x) : Math.atan2(source.vy, source.vx);
    return { x: source.x, y: source.y, vx: Math.cos(angle) * 46, vy: Math.sin(angle) * 46 };
  }
  if (sim.worlds.length === 0) return Evolution.starterShot(sim);
  // A counter-rotating starter orbit limits the time the two planets spend near each other.
  const radius = sim.mission ? sim.mission.future.inner + 36 : sim.climateVersion===2 ? Evolution.starterShot(sim).x+26*(sim.worlds.length%3) : 167;
  return { x: 0, y: radius, vx: -Math.sqrt(Orbit.MU / radius), vy: 0 };
}

ui.map.addEventListener("keydown", e => {
  const key = e.key.toLowerCase();
  if (key === "escape" && (pointer || keyboard || launchMode)) {
    e.preventDefault();
    clearAim();
    launchMode = null;
    updateUI();
    return;
  }
  if (!view || pointer || sim.over || impactScene || e.ctrlKey || e.altKey || e.metaKey) return;
  const arrows = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
  const magnify = ["+", "=", "-"].includes(key);
  if (key === "home" || (!launchMode && magnify)) {
    e.preventDefault();
    zoomOrbit(key === "home" ? 1 : orbitCamera.zoom * (key === "-" ? 1 / 1.35 : 1.35));
    return;
  }
  if (!launchMode) {
    if (key in arrows) {
      e.preventDefault();
      panOrbit(-36 * arrows[key][0], -36 * arrows[key][1]);
    }
    return;
  }
  if (key !== "enter" && !(key in arrows) && !magnify && key !== "q" && key !== "e") return;
  e.preventDefault();
  if (key === "enter") {
    if (e.repeat) return;
    const shot = keyboard ?? defaultKeyboardShot();
    clearAim();
    launch(shot, launchMode);
    return;
  }
  keyboard ??= defaultKeyboardShot();
  if (key in arrows && launchMode.kind === "planet") {
    const [dx, dy] = arrows[key];
    const move = 5 * view.aimScale / view.scale;
    keyboard.x = Orbit.clamp(keyboard.x + dx * move, (14 - view.cx) / view.scale, (view.w - view.cx - 14) / view.scale);
    keyboard.y = Orbit.clamp(keyboard.y + dy * move, (14 - view.cy) / view.scale, (view.h - view.cy - 14) / view.scale);
  } else {
    let angle = Math.atan2(keyboard.vy, keyboard.vx);
    let speed = Math.hypot(keyboard.vx, keyboard.vy);
    const left = key === "q" || key === "arrowleft";
    const right = key === "e" || key === "arrowright";
    if (left || right) angle += left ? -0.12 : 0.12;
    else speed = Orbit.clamp(speed + (key === "-" || key === "arrowdown" ? -2.2 : 2.2), 2.6, Orbit.MAX_SPEED);
    keyboard.vx = Math.cos(angle) * speed;
    keyboard.vy = Math.sin(angle) * speed;
  }
  pendingShot = { ...keyboard };
  updateStatus();
});
ui.map.addEventListener("blur", () => {
  if (!keyboard) return;
  clearAim();
  updateStatus();
});

const groundMap = ui["surface-map"];
function surfacePointer(event) {
  const rect = groundMap.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

ui["surface-open"].addEventListener("click", () => {
  const p = selectedSurface();
  if (p) showSurface(p);
});
for (const button of surfaceReturnButtons) button.addEventListener("click", () => showSurface(null));
const weatherHints = {
  people: "Klikni na osadu a prohlédni její národ, místní jídlo a vztahy. Přijetí patronátu je dobrovolné.",
  wind: "Táhni přes mrak směrem, kam má plout. Delší tah zesílí poryv.",
  heat: "Podrž nad ledem, aby roztál. Nad vodou urychlíš odpar, na suchu můžeš zažehnout požár.",
  cold: "Podrž nad vodou, aby zamrzla. Ochlazením hustého mraku přivoláš déšť.",
  channel: "Táhni od vody do nížiny a vyhlub cestu pro řeku.",
  ridge: "Tažením zvedneš terén a odkloníš vodu. Na nejvyšších vrcholech může z vlhkého vzduchu vznikat sníh.",
  spring: "Kliknutím otevři pramen. Dalším kliknutím na jeho značku ho zavřeš.",
  volcano: "Kliknutím aktivuj sopku. Dalším kliknutím na kráter zastavíš výtok lávy.",
  station: "Sadu umístíš zdarma. Vlastní výroba stojí 70 E a 24 M a vyžaduje Regulaci klimatu. Stav u osady nebo na okraji dosahu funkčního teraformeru; potom zvol Ohřev či Chlazení.",
  hydro: "Vyber suchý břeh u osady vedle toku se spádem. Stavba stojí " + Biosphere.HYDRO_ENERGY + " E a " + Biosphere.HYDRO_SUPPLY + " M."
};
const temperatures = { heat: 1, cold: -1 };
const terrainAmounts = { channel: -0.30, ridge: 0.24 };
const pointTools = {
  people: (p, point) => {
    const community = Patronage.pick(sim, p, point);
    if (community) openPatronage(p, community.id);
    else put(ui["weather-tip"], "Na tomto místě není obydlená osada. Vyber dům nebo střed osady.");
  },
  spring: (p, point) => Biosphere.toggleSpring(p.biosphere, point),
  volcano: (p, point) => Biosphere.toggleVolcano(p.biosphere, point),
  station: (p, point) => buildEconomyTool(p, "station", point),
  hydro: (p, point) => buildEconomyTool(p, "hydro", point)
};

function buildEconomyTool(p, tool, point) {
  const issue = Orbit.buildSurfaceTool(sim, p, tool, point);
  if (issue) {
    put(ui["weather-tip"], issue);
    return;
  }
  if (tool === "station") { preferredStation = p.biosphere.stations.filter(station => station.tile >= 0).at(-1)?.id ?? 0; stationPickerWorld = p.id; }
  Orbit.event(sim, p.name + (tool === "station" ? " · Teraformační stanice je na místě. Vyber režim." : tool === "windplant" ? " · Větrná elektrárna je připojená." : " · Vodní turbína je připojená."), "good");
  put(ui["weather-tip"], weatherHints[tool]);
  nextGroundFrame = 0;
  updateUI();
}

function sculptTo(s, point) {
  Biosphere.sculpt(s, weatherPointer.last, point, terrainAmounts[weatherTool], weatherRadius, weatherPointer.stroke);
  weatherPointer.last = point;
}
function updateCameraControls() {
  const atFit = surfaceCamera.zoom === 1;
  ui["surface-out"].disabled = atFit;
  ui["surface-fit"].disabled = atFit;
  ui["surface-pan"].disabled = atFit;
  ui["surface-in"].disabled = surfaceCamera.zoom === SurfaceView.MAX_ZOOM;
  put(ui["surface-scale"], Math.round(surfaceCamera.zoom * 100) + " %");
}

function setSurfacePan(active) {
  clearWeatherAim();
  surfacePan = active;
  ui["surface-pan"].setAttribute("aria-pressed", String(active));
  for (const item of weatherTools) item.setAttribute("aria-pressed", String(!active && item.dataset.weather === weatherTool));
  for (const button of brushSizes) button.disabled = Boolean(pointTools[weatherTool]);
  groundMap.classList.toggle("pan-mode", active);
  put(ui["weather-tip"], active ? "Tažením nebo šipkami posuň mapu. Pak vyber nástroj."
    : weatherHints[weatherTool]);
  updateCameraControls();
}

function zoomSurface(zoom, anchor) {
  if (!view || !viewedPlanet() || weatherPointer) return;
  surfaceCamera = SurfaceView.zoomAt(view, surfaceCamera, zoom, anchor);
  windStart = null;
  groundCursor = anchor && !surfacePan ? SurfaceView.point(view, surfaceCamera, anchor) : null;
  if (surfaceCamera.zoom === 1 && surfacePan) setSurfacePan(false);
  updateCameraControls();
  nextGroundFrame = 0;
}

ui["surface-in"].addEventListener("click", () => zoomSurface(surfaceCamera.zoom * 1.35));
ui["surface-out"].addEventListener("click", () => zoomSurface(surfaceCamera.zoom / 1.35));
ui["surface-fit"].addEventListener("click", () => zoomSurface(1));
ui["surface-pan"].addEventListener("click", () => {
  setSurfacePan(!surfacePan);
  groundMap.focus({ preventScroll: true });
});
groundMap.addEventListener("wheel", e => {
  if (!view || !viewedPlanet() || e.ctrlKey || e.metaKey || !e.deltaY) return;
  e.preventDefault();
  const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? view.h : 1);
  zoomSurface(surfaceCamera.zoom * Math.exp(-Orbit.clamp(delta, -140, 140) * 0.003), surfacePointer(e));
}, { passive: false });
for (const button of weatherTools) button.addEventListener("click", () => {
  weatherTool = button.dataset.weather;
  setSurfacePan(false);
});
for (const button of brushSizes) button.addEventListener("click", () => {
  weatherRadius = Biosphere.BRUSH_RADII[button.dataset.brushSize];
  for (const item of brushSizes) item.setAttribute("aria-pressed", String(item === button));
  if (view && !surfacePan && !weatherPointer) {
    const box = SurfaceView.bounds(view, surfaceCamera);
    groundCursor ??= { x: box.centerX, y: box.centerY };
    nextGroundFrame = 0;
  }
});
groundMap.addEventListener("pointerdown", e => {
  const p = viewedPlanet();
  if (!p || !view || weatherPointer || (e.button !== 0 && e.button !== 1)) return;
  const cursor = surfacePointer(e);
  const pan = surfacePan || e.button === 1;
  const point = SurfaceView.point(view, surfaceCamera, cursor);
  if (!point) return;
  e.preventDefault();
  groundMap.focus({ preventScroll: true });
  windStart = null;
  groundCursor = pan ? null : point;
  weatherPointer = pan ? { id: e.pointerId, pan: true, cursor } : { id: e.pointerId, start: point };
  groundMap.setPointerCapture(e.pointerId);
  if (pan) groundMap.classList.add("is-panning");
  else if (pointTools[weatherTool]) pointTools[weatherTool](p, point);
  else if (terrainAmounts[weatherTool]) {
    weatherPointer.stroke = new Float32Array(Biosphere.W * Biosphere.H);
    weatherPointer.last = point;
    sculptTo(p.biosphere, point);
  } else if (temperatures[weatherTool]) {
    Biosphere.temper(p.biosphere, point, 0.10 * temperatures[weatherTool], weatherRadius);
  }
});
groundMap.addEventListener("pointermove", e => {
  if (!view || (weatherPointer && weatherPointer.id !== e.pointerId)) return;
  const cursor = surfacePointer(e);
  if (weatherPointer?.pan) {
    const previous = weatherPointer.cursor;
    surfaceCamera = SurfaceView.pan(view, surfaceCamera, cursor.x - previous.x, cursor.y - previous.y);
    weatherPointer.cursor = cursor;
    nextGroundFrame = 0;
  } else if (!surfacePan) {
    groundCursor = SurfaceView.point(view, surfaceCamera, cursor, Boolean(weatherPointer));
    const p = viewedPlanet();
    if (p && groundCursor && weatherPointer?.stroke) sculptTo(p.biosphere, groundCursor);
  }
});
groundMap.addEventListener("pointerleave", () => {
  if (!weatherPointer) groundCursor = null;
});
groundMap.addEventListener("pointerup", e => {
  if (weatherPointer?.id !== e.pointerId) return;
  const p = viewedPlanet();
  if (p && !weatherPointer.pan) {
    const point = SurfaceView.point(view, surfaceCamera, surfacePointer(e), true);
    if (weatherPointer.stroke) sculptTo(p.biosphere, point);
    else if (weatherTool === "wind") {
      const start = weatherPointer.start;
      const community = Math.hypot(point.x - start.x, point.y - start.y) < 0.6 ? Patronage.pick(sim, p, point) : null;
      if (community) openPatronage(p, community.id);
      else Biosphere.gust(p.biosphere, start, point, weatherRadius);
    }
  }
  groundMap.classList.remove("is-panning");
  weatherPointer = null;
  if (e.pointerType !== "mouse") groundCursor = null;
});
groundMap.addEventListener("auxclick", e => {
  if (e.button === 1) e.preventDefault();
});
for (const type of ["pointercancel", "lostpointercapture"]) {
  groundMap.addEventListener(type, e => {
    if (weatherPointer?.id === e.pointerId) clearWeatherAim();
  });
}
groundMap.addEventListener("keydown", e => {
  const p = viewedPlanet();
  if (!p || !view || e.ctrlKey || e.altKey || e.metaKey) return;
  const move = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
  if (["+", "=", "-", "−", "Home"].includes(e.key)) {
    e.preventDefault();
    zoomSurface(e.key === "Home" ? 1 : surfaceCamera.zoom * (e.key === "+" || e.key === "=" ? 1.35 : 1 / 1.35));
  } else if (e.key === "Escape") {
    e.preventDefault();
    if (windStart || weatherPointer) clearWeatherAim();
    else if (surfacePan) setSurfacePan(false);
    else showSurface(null);
  } else if (surfacePan) {
    if (!move || weatherPointer) return;
    e.preventDefault();
    surfaceCamera = SurfaceView.pan(view, surfaceCamera, -36 * move[0], -36 * move[1]);
    nextGroundFrame = 0;
  } else if (move || e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    if (weatherPointer) return;
    const box = SurfaceView.bounds(view, surfaceCamera);
    groundCursor ??= { x: box.centerX, y: box.centerY };
    if (move) {
      groundCursor = {
        x: Orbit.clamp(groundCursor.x + move[0], 0.5, Biosphere.W - 0.5),
        y: Orbit.clamp(groundCursor.y + move[1], 0.5, Biosphere.H - 0.5)
      };
      const x = box.x + groundCursor.x * box.unit, y = box.y + groundCursor.y * box.unit;
      surfaceCamera = SurfaceView.pan(view, surfaceCamera,
        Orbit.clamp(x, box.left + 8, box.left + box.width - 8) - x,
        Orbit.clamp(y, box.top + 8, box.top + box.height - 8) - y);
    } else if (pointTools[weatherTool]) {
      if (!e.repeat) pointTools[weatherTool](p, groundCursor);
    } else if (terrainAmounts[weatherTool]) {
      Biosphere.sculpt(p.biosphere, groundCursor, groundCursor, terrainAmounts[weatherTool], weatherRadius);
    } else if (temperatures[weatherTool]) {
      Biosphere.temper(p.biosphere, groundCursor, 0.26 * temperatures[weatherTool], weatherRadius);
    } else if (!e.repeat) {
      if (windStart) {
        Biosphere.gust(p.biosphere, windStart, groundCursor, weatherRadius);
        windStart = null;
      } else windStart = { ...groundCursor };
    }
  }
});

function setRate(rate) {
  if (![1, 4, 12].includes(rate) || sim.over || sim.mission?.phase === "briefing" || impactScene || galaxyBusy) return;
  // The rendering loop intentionally freezes while a keyboard launch aim or
  // pointer drag is in progress. Release any unfinished gesture when a new
  // speed is explicitly requested, otherwise the button seems to do nothing.
  if (pointer?.mode || keyboard) clearAim();
  sim.rate = rate;
  sim.paused = false;
  accumulator = 0;
  lastFrame = 0;
  consecutiveFrameErrors = 0;
  if (lastFrameError) {
    lastFrameError = "";
    const feedback = document.getElementById("clock-feedback");
    if (feedback) { feedback.hidden = true; feedback.textContent = ""; }
  }
  // Even if a previous frame was lost after a rare simulation/UI exception,
  // the player's explicit speed choice resumes the single animation loop.
  queueGameFrame();
  // Immediate visual acknowledgement, even with expensive civilizational UI.
  for (const button of rates) button.setAttribute("aria-pressed", String(Number(button.dataset.rate) === rate));
  updateUI();
}

for (const button of physicsButtons) button.addEventListener("click", () => {
  if (sim.physics === button.dataset.physics || sim.over) return;
  sim.physics = button.dataset.physics;
  for (const world of sim.worlds) {
    world.orbit = Orbit.elements(world);
    world.orbitAlertKey = "ok";
    Orbit.checkOrbit(sim, world);
  }
  Orbit.event(sim, sim.physics === "stable"
    ? "Stabilní gravitace: vzájemné gravitační vychylování planet je vypnuté. Kolize jsou stále možné."
    : "Volná gravitace: planety se navzájem ovlivňují a mohou změnit dráhu.", "warn");
  clearAim();
  updateUI();
});
for (const button of rates) button.addEventListener("click", () => setRate(Number(button.dataset.rate)));
ui["orbit-in"].addEventListener("click", () => zoomOrbit(orbitCamera.zoom * 1.35));
ui["orbit-out"].addEventListener("click", () => zoomOrbit(orbitCamera.zoom / 1.35));
ui["orbit-fit"].addEventListener("click", () => zoomOrbit(1));
ui.pause.addEventListener("click", () => {
  sim.paused = !sim.paused;
  updateUI();
});
ui["new-planet-name"].addEventListener("input", clearPlanetNameFeedback);
ui["planet-mode"].addEventListener("click", () => {
  if (ui["planet-mode"].disabled) return;
  if (launchMode?.kind !== "planet" && readPlanetLaunchName() === null) return;
  clearAim();
  launchMode = launchMode?.kind === "planet" ? null : { kind: "planet" };
  updateUI();
  if (launchMode) {
    ui["world-options"].open = false;
    ui.field.scrollIntoView?.({ block: "nearest" });
    ui.map.focus({ preventScroll: true });
  }
});
{
  const dialog = ui.instructions, pages = [...dialog.querySelectorAll(".guide-page[data-chapter]")];
  const contextPages = [...dialog.querySelectorAll("[data-guide-context]")], footer = dialog.querySelector(".guide-footer");
  const chapters = document.getElementById("guide-chapters"), picker = document.getElementById("guide-picker");
  const reader = document.getElementById("guide-reader"), position = document.getElementById("guide-position");
  const announcement = document.getElementById("guide-announcement");
  const previous = document.getElementById("guide-prev"), next = document.getElementById("guide-next");
  const search = document.getElementById("guide-search"), searchStatus = document.getElementById("guide-search-status");
  const plain = value => value.toLocaleLowerCase("cs").normalize("NFD").replace(/\p{M}/gu, "");
  const indexText = pages.map(page => plain(page.dataset.chapter + " " + (page.dataset.guideTerms ?? "") + " " + page.textContent));
  const chapterLabel = (page, index) => String(index + 1).padStart(2, "0") + " · " + page.dataset.chapter;
  let current = 0;
  let matches = [];
  const buttons = pages.map((page, index) => {
    const number = String(index + 1).padStart(2, "0"), title = page.dataset.chapter;
    const item = document.createElement("li"), button = document.createElement("button"), badge = document.createElement("span");
    button.type = "button";
    badge.textContent = number;
    badge.setAttribute("aria-hidden", "true");
    button.append(badge, title);
    button.addEventListener("click", () => showChapter(index));
    item.append(button);
    chapters.append(item);
    return button;
  });
  function filterChapters() {
    const query = plain(search.value).trim();
    const terms = query.split(/\s+/).filter(Boolean);
    matches = pages.map((_, index) => index).filter(index => terms.every(term => indexText[index].includes(term)));
    for (const [index, button] of buttons.entries()) button.parentElement.hidden = !matches.includes(index);
    picker.replaceChildren(...matches.map(index => new Option(chapterLabel(pages[index], index), String(index))));
    if (!matches.includes(current)) {
      const placeholder = new Option(matches.length ? "Vyber kapitolu z výsledků" : "Žádná odpovídající kapitola", "");
      placeholder.disabled = true;
      picker.prepend(placeholder);
    }
    picker.value = matches.includes(current) ? String(current) : "";
    picker.disabled = matches.length === 0;
    searchStatus.textContent = query ? "Výsledky hledání · " + matches.length : "";
  }
  function showChapter(index) {
    if (index < 0 || index >= pages.length) return;
    current = index;
    for (const page of contextPages) page.hidden = true;
    footer.hidden = false;
    pages.forEach((page, i) => {
      page.hidden = i !== current;
      if (page.hidden) buttons[i].removeAttribute("aria-current");
      else buttons[i].setAttribute("aria-current", "step");
    });
    const image = pages[current].querySelector("img");
    if (image?.dataset.src) {
      image.src = image.dataset.src;
      delete image.dataset.src;
    }
    if (!matches.includes(current)) search.value = "";
    filterChapters();
    position.value = (current + 1) + " / " + pages.length;
    announcement.textContent = "Kapitola " + (current + 1) + " z " + pages.length + " · " + pages[current].dataset.chapter;
    const focused = document.activeElement;
    previous.disabled = current === 0;
    next.disabled = current === pages.length - 1;
    if (focused === next && next.disabled) previous.focus();
    if (focused === previous && previous.disabled) next.focus();
    reader.scrollTop = 0;
    if (dialog.open && buttons[current].offsetWidth) buttons[current].scrollIntoView({block: "nearest"});
  }
  previous.addEventListener("click", () => showChapter(current - 1));
  next.addEventListener("click", () => showChapter(current + 1));
  picker.addEventListener("change", () => showChapter(Number(picker.value)));
  search.addEventListener("input", filterChapters);
  search.addEventListener("keydown", event => {
    if (event.key !== "Enter" || !matches.length) return;
    event.preventDefault();
    showChapter(matches[0]);
  });
  function jumpToChapter(id) {
    const index = pages.findIndex(page => page.getAttribute("aria-labelledby") === id);
    if (index >= 0) showChapter(index);
    else {
      const context = contextPages.find(page => page.getAttribute("aria-labelledby") === id);
      if (!context) return;
      for (const page of [...pages, ...contextPages]) page.hidden = page !== context;
      for (const button of buttons) button.removeAttribute("aria-current");
      footer.hidden = true;
      picker.selectedIndex = -1;
      announcement.textContent = document.getElementById(id).textContent;
      reader.scrollTop = 0;
    }
    const heading = document.getElementById(id);
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
  dialog.addEventListener("click", event => {
    const link = event.target.closest("[data-guide-link]");
    if (link) jumpToChapter(link.dataset.guideLink);
  });
  dialog.addEventListener("keydown", event => {
    if (event.target === picker || event.target === search || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    showChapter(current + (event.key === "ArrowRight" ? 1 : -1));
  });
  function openGuide() {
    if (dialog.open) return;
    dialog.showModal();
    showChapter(current);
    updateStatus();
  }
  ui.help.addEventListener("click", openGuide);
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-guide-open]");
    if (!button) return;
    openGuide();
    jumpToChapter(button.dataset.guideOpen);
  });
  dialog.addEventListener("close", updateStatus);
}

ui.restart.addEventListener("click", () => {
  put(ui["reset-text"], sim.mode === "scenario" ? "Mise začne znovu s Terrou a studeným Nivalem."
    : galaxyOthers.size ? "Začneš novou galaxii s prázdnou výchozí soustavou." : "Začneš znovu s prázdnou mapou.");
  ui["reset-confirm"].returnValue = "";
  ui["reset-confirm"].showModal();
  updateStatus();
});
ui["reset-confirm"].addEventListener("cancel", updateStatus);
ui["mission-start"].addEventListener("click", () => {
  if (sim.mission?.phase !== "briefing") return;
  clearAim();
  missionCheckpoint = structuredClone(sim);
  missionCheckpoint.events = [];
  accumulator = 0;
  Orbit.beginMission(sim);
  updateUI();
  priorities[0].focus({ preventScroll: true });
});
for (const button of priorities) button.addEventListener("click", () => {
  if (sim.mission?.phase !== "active") return;
  sim.mission.priority = button.dataset.priority;
  updateUI();
});
// Explicit handlers work also in embedded browsers that do not reliably honor form method="dialog".
function closeGameDialog(dialog, value) {
  if (dialog.open) dialog.close(value);
  updateStatus();
}
for (const btn of document.querySelectorAll("dialog [data-dialog-value]")) {
  btn.addEventListener("click", () => {
    const dialog = btn.closest("dialog");
    const value = btn.dataset.dialogValue;
    closeGameDialog(dialog, "handled");
    if (dialog === ui["reset-confirm"]) {
      if (value === "reset") reset();
    } else if (dialog === ui["destroy-probe"]) {
      const id = pendingProbeId;
      pendingProbeId = null;
      if (value === "destroy" && id !== null) {
        if (Orbit.destroyProbe(sim, id)) voyageKey = "";
        updateUI();
      }
    } else if (dialog === ui["mission-result"]) {
      if (value === "retry") replayMission();
      else { accumulator = 0; sim.paused = false; updateUI(); }
    } else if (dialog === ui.results) {
      if (value === "restore") restoreLocal().then(ok => {
        if (!ok) { resultsShown = false; afterEnd = 0; }
      });
      else if (missionCheckpoint) replayMission();
      else reset();
    }
  });
}
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("close", updateStatus);
}
ui.results.addEventListener("cancel", e => e.preventDefault());
ui["destroy-probe"].addEventListener("cancel", () => { pendingProbeId = null; });

function clearGalaxy() {
  for (const entry of galaxyOthers.values()) entry.background.dispose();
  galaxyOthers.clear();
  galaxyId = 0;
  galaxyName = Galaxy.HOME;
  galaxyNextId = 1;
  galaxyRemoval = null;
  galaxySlots.clear();
  galaxyViewing = false;
  galaxySelected = 0;
}

function startBackground(state) {
  const workerURL = /^https?:$/.test(location.protocol) ? "./src/galaxy-worker.js?v=m1-perf-opt5" : null;
  return Galaxy.background(state, workerURL);
}

function currentSystemView() {
  return { patronBrowser: { ...patronBrowser }, selected, surfaceId,
    orbitCamera: { ...orbitCamera }, surfaceCamera: { ...surfaceCamera } };
}

function loadSystemView(state, saved = {}, showSavedSurface = true) {
  const browser = saved.patronBrowser;
  patronBrowser = { filter: ["mine", "all", "faction"].includes(browser?.filter) ? browser.filter : state.patron ? "mine" : "all",
    faction: typeof browser?.faction === "string" ? browser.faction.slice(0, 80) : "", selected: typeof browser?.selected === "string" ? browser.selected.slice(0, 80) : "",
    target: typeof browser?.target === "string" ? browser.target.slice(0, 80) : "", batch: browser?.batch === true };
  loadRun(state);
  selected = sim.worlds.some(world => world.id === saved.selected) ? saved.selected : selected;
  const camera = saved.orbitCamera;
  if (camera && [camera.zoom, camera.x, camera.y].every(Number.isFinite)) setOrbitCamera(camera);
  else if (saved.zoom === "wide") setOrbitCamera(ORBIT_FIT);
  else if (saved.zoom === "inner") setOrbitCamera({ ...ORBIT_FIT, zoom: view.aimScale / view.fitScale });
  const surface = showSavedSurface && sim.worlds.find(world => world.id === saved.surfaceId && world.biosphere);
  if (surface) {
    showSurface(surface, false);
    const camera = saved.surfaceCamera;
    if (camera && [camera.zoom, camera.x, camera.y].every(Number.isFinite)) {
      surfaceCamera = camera;
      updateCameraControls();
    }
  }
  updateUI();
}

const galaxyMap = ui["galaxy-map"];
const galaxyMarkers = document.getElementById("galaxy-markers");
const galaxyRenameName = document.getElementById("galaxy-rename-name");
const galaxyTracks = [...galaxyMap.querySelectorAll("ellipse")].map((ellipse, index) => ({
  radiusX: Number(ellipse.getAttribute("rx")),
  radiusY: Number(ellipse.getAttribute("ry")),
  period: 300 + index * 80
}));
const galaxySlots = new Map();

function galaxySystems(withInfo = true) {
  const systems = [{ id: galaxyId, name: galaxyName }, ...galaxyOthers.values()].sort((a, b) => a.id - b.id);
  return withInfo ? systems.map(system => ({
    ...system, info: system.background ? system.background.currentInfo : Galaxy.summary(sim)
  })) : systems;
}

function galaxySummaryText(stats) {
  return "Planety " + number.format(stats.worlds) + " · Obyvatelé " + number.format(stats.people)
    + " · Civilizace " + number.format(stats.nations);
}

function positionGalaxyStars() {
  const time = reduceMotion.matches ? 0 : Galaxy.sharedTime(sim);
  for (const star of galaxyMarkers.children) {
    const id = Number(star.dataset.galaxySystem), track = galaxyTracks[galaxySlots.get(id)];
    const angle = id * 2.39996 - 0.75 - time % track.period * Orbit.TAU / track.period;
    star.style.left = (50 + Math.cos(angle) * track.radiusX) + "%";
    star.style.top = (50 + Math.sin(angle) * track.radiusY) + "%";
  }
}

function renderSystemOverview(preview) {
  const system = galaxyViewing ? preview ?? galaxySystems().find(entry => entry.id === galaxySelected) : null;
  const stats = system?.info ?? Galaxy.summary(sim);
  put(document.getElementById("system-status-name"), system?.name ?? galaxyName);
  put(ui.population, number.format(Math.floor(stats.people)));
  put(ui["transit-population"], "Na cestě " + number.format(Math.floor(stats.transit)));
  put(document.getElementById("system-status-worlds"), stats.worlds);
  put(document.getElementById("system-status-nations"), stats.nations);
  put(document.getElementById("system-status-inhabited"), stats.inhabited);
  for (const id of ["system-status-previous", "system-status-next"])
    document.getElementById(id).disabled = galaxyBusy || !galaxyOthers.size;
  document.getElementById("system-status-rename").hidden = sim.mode !== "biosphere";
  ui["orbit-monitor"].hidden = galaxyViewing;
}
function browseSystems(direction) {
  if (galaxyBusy) return;
  const systems = galaxySystems(false), id = galaxyViewing ? galaxySelected : galaxyId;
  const index = systems.findIndex(system => system.id === id);
  const next = systems[(index + direction + systems.length) % systems.length];
  if (galaxyViewing) selectGalaxySystem(next.id);
  else if (next.id !== id) chooseGalaxySystem(next.id);
}
function updateGalaxyOverview() {
  if (!galaxyViewing) return;
  const system = galaxySystems().find(system => system.id === galaxySelected);
  if (!system) return;
  put(document.getElementById("galaxy-selected-name"), system.name);
  put(document.getElementById("galaxy-selected-info"), galaxySummaryText(system.info));
  renderSystemOverview(system);
}

function renderGalaxy() {
  const systems = galaxySystems(false), focused = document.activeElement;
  const focusedId = focused?.dataset.galaxySystem;
  const currentIds = new Set(systems.map(system => system.id));
  for (const id of galaxySlots.keys()) if (!currentIds.has(id)) galaxySlots.delete(id);
  const used = new Set(galaxySlots.values());
  for (const system of systems) if (!galaxySlots.has(system.id)) {
    const slot = galaxyTracks.findIndex((_, index) => !used.has(index));
    galaxySlots.set(system.id, slot);
    used.add(slot);
  }
  const stars = systems.map(system => {
    const star = document.createElement("button"), name = document.createElement("span");
    star.type = "button"; star.className = "galaxy-marker"; star.dataset.galaxySystem = String(system.id);
    name.className = "galaxy-marker-name"; name.textContent = system.name;
    star.title = system.name; star.append(name);
    star.setAttribute("aria-current", String(system.id === galaxySelected)); star.disabled = galaxyBusy;
    return star;
  });
  galaxyMarkers.replaceChildren(...stars);
  if (focusedId !== undefined) galaxyMarkers.querySelector('[data-galaxy-system="' + focusedId + '"]')?.focus({ preventScroll: true });
  positionGalaxyStars();
  const full = systems.length >= Galaxy.LIMIT;
  ui["galaxy-create"].disabled = ui["galaxy-name"].disabled = document.getElementById("galaxy-planets").disabled = galaxyBusy || full;
  ui["galaxy-enter"].disabled = galaxyBusy;
  ui.pause.disabled = galaxyBusy || sim.over || Boolean(impactScene);
  for (const button of rates) button.disabled = ui.pause.disabled;
  ui["galaxy-limit"].hidden = !full;
  const workerHint = document.getElementById("galaxy-worker-hint");
  if (workerHint) workerHint.hidden = location.protocol !== "file:" || !galaxyOthers.size;
  galaxyRenameName.disabled = document.getElementById("galaxy-rename-submit").disabled = galaxyBusy;
  syncGalaxyRenameName();
  ui["galaxy-remove-open"].disabled = galaxyBusy || galaxySelected === 0 || galaxyRemoval !== null;
  document.getElementById("galaxy-home-protected").hidden = galaxySelected !== 0;
  const remove = systems.find(system => system.id === galaxyRemoval);
  ui["galaxy-confirm"].hidden = !remove;
  ui["galaxy-delete"].disabled = galaxyBusy;
  ui["galaxy-cancel-delete"].disabled = galaxyBusy;
  if (remove) put(ui["galaxy-confirm-text"], "Odstranit soustavu " + remove.name + " včetně všech planet a civilizací?");
  updateGalaxyOverview();
  syncMapPicker(false);
}

function selectGalaxySystem(id) {
  if (galaxyBusy || !galaxySystems(false).some(system => system.id === id)) return;
  if (galaxySelected !== id) {
    galaxySelected = id;
    galaxyRemoval = null;
    put(document.getElementById("galaxy-rename-status"), "");
  }
  renderGalaxy();
}

function openGalaxy() {
  if (sim.mode !== "biosphere" || galaxyViewing || galaxyBusy) return;
  clearAim();
  clearWeatherAim();
  launchMode = null;
  galaxyViewing = true;
  galaxyRemoval = null;
  galaxySelected = galaxyId;
  put(ui["galaxy-status"], "");
  put(document.getElementById("galaxy-rename-status"), "");
  renderGalaxy();
  updateUI();
  window.CosmoHUD?.refresh?.();
  Promise.allSettled([...galaxyOthers.values()].map(entry => entry.background.syncedInfo())).then(updateGalaxyOverview);
}

function enterGalaxySystem(system, target, keepCurrent = true) {
  if (Math.abs(Galaxy.sharedTime(sim) - Galaxy.sharedTime(target)) > 1e-5) {
    throw new Error("Soustavy mají rozdílný čas simulace.");
  }
  target.paused = sim.paused;
  target.rate = sim.rate;
  if (keepCurrent) {
    Galaxy.enable(sim);
    galaxyOthers.set(galaxyId, { id: galaxyId, name: galaxyName, view: currentSystemView(),
      background: startBackground(sim) });
  }
  galaxyOthers.delete(system.id);
  system.background?.dispose();
  galaxyId = system.id;
  galaxyName = system.name;
  loadSystemView(target, system.view ?? {}, false);
}

function closeGalaxy() {
  galaxyViewing = false;
  galaxyRemoval = null;
  setMapPicker(false);
}

async function chooseGalaxySystem(id = galaxySelected) {
  if (galaxyBusy) return;
  const system = galaxyOthers.get(id);
  const wasGalaxy = galaxyViewing;
  const feedback = wasGalaxy ? ui["galaxy-status"] : document.getElementById("system-status-feedback");
  if (system) {
    galaxyBusy = true;
    if (wasGalaxy) renderGalaxy();
    else updateUI();
    put(feedback, "Přepínám soustavu…");
    try {
      enterGalaxySystem(system, await system.background.snapshot());
    } catch (error) {
      put(feedback, "Soustavu se nepodařilo otevřít. " + error.message);
      return;
    } finally {
      galaxyBusy = false;
      if (wasGalaxy) renderGalaxy();
      else updateUI();
    }
  }
  put(feedback, "");
  closeGalaxy();
  showSurface(null, false);
  updateUI();
  window.CosmoHUD?.refresh?.();
  if (wasGalaxy) ui["map-planets-toggle"].focus({ preventScroll: true });
}

const cleanSystemName = value => typeof value === "string" ? value.normalize("NFKC").trim().slice(0, 40) : "";
function syncGalaxyRenameName() {
  const system = galaxySystems(false).find(system => system.id === galaxySelected);
  const binding = system ? system.id + "/" + system.name : "";
  if (galaxyRenameName.dataset.binding === binding) return;
  galaxyRenameName.dataset.binding = binding;
  galaxyRenameName.value = system?.name ?? "";
}

function renameSystem(id, rawName) {
  if (galaxyBusy) return "Počkej na dokončení přepnutí soustavy.";
  const systems = galaxySystems(false), system = systems.find(system => system.id === id);
  if (!system) return "Soustava už není dostupná.";
  const name = cleanSystemName(rawName);
  if (!name) return "Zadej název soustavy.";
  if (systems.some(other => other.id !== id && other.name.toLocaleLowerCase("cs-CZ") === name.toLocaleLowerCase("cs-CZ")))
    return "Tento název už používá jiná soustava.";
  if (id === galaxyId) { Galaxy.enable(sim); galaxyName = name; }
  else galaxyOthers.get(id).name = name;
  if (galaxyViewing) renderGalaxy();
  updateUI();
  return "";
}

function createGalaxySystem() {
  if (galaxyBusy || galaxyOthers.size + 1 >= Galaxy.LIMIT) return;
  const used = new Set(galaxySystems(false).map(system => system.name.toLocaleLowerCase("cs-CZ")));
  const id = galaxyNextId;
  let name = cleanSystemName(ui["galaxy-name"].value);
  if (!name) {
    let number = id + 1;
    do { name = "Soustava " + number++; } while (used.has(name.toLocaleLowerCase("cs-CZ")));
  }
  if (used.has(name.toLocaleLowerCase("cs-CZ"))) {
    put(ui["galaxy-status"], "Tento název už používá jiná soustava.");
    return;
  }
  const field = document.getElementById("galaxy-planets"), count = field.valueAsNumber;
  if (!Number.isInteger(count) || count < 0 || count > Orbit.LIMIT) { field.reportValidity(); return; }
  const target = Galaxy.createSystem(Galaxy.enable(sim), name, count);
  galaxyOthers.set(id, { id, name, background: startBackground(target) });
  galaxyNextId++;
  galaxySelected = id;
  galaxyRemoval = null;
  ui["galaxy-name"].value = "";
  field.value = "0";
  renderGalaxy();
  put(ui["galaxy-status"], "Soustava " + name + " vznikla.");
  galaxyMarkers.querySelector('[data-galaxy-system="' + id + '"]')?.focus();
}

async function removeGalaxySystem() {
  const id = galaxyRemoval;
  if (galaxyBusy || !Number.isSafeInteger(id) || id <= 0) return;
  const system = galaxySystems(false).find(entry => entry.id === id);
  if (!system) return;
  galaxyBusy = true;
  renderGalaxy();
  try {
    if (id === galaxyId) {
      const home = galaxyOthers.get(0);
      enterGalaxySystem(home, await home.background.snapshot(), false);
    } else {
      system.background.dispose();
      galaxyOthers.delete(id);
    }
    galaxyRemoval = null;
    galaxySelected = galaxyId;
    put(ui["galaxy-status"], "Soustava " + system.name + " byla odstraněna.");
  } catch (error) {
    put(ui["galaxy-status"], "Soustavu se nepodařilo odstranit. " + error.message);
  } finally {
    galaxyBusy = false;
    renderGalaxy();
    ui["galaxy-enter"].focus();
  }
}

ui["galaxy-open"].addEventListener("click", openGalaxy);
ui["galaxy-enter"].addEventListener("click", () => chooseGalaxySystem());
document.getElementById("system-status-previous").addEventListener("click", () => browseSystems(-1));
document.getElementById("system-status-next").addEventListener("click", () => browseSystems(1));
ui["galaxy-form"].addEventListener("submit", event => { event.preventDefault(); createGalaxySystem(); });
document.getElementById("galaxy-rename-form").addEventListener("submit", event => {
  event.preventDefault();
  put(document.getElementById("galaxy-rename-status"), renameSystem(galaxySelected, galaxyRenameName.value) || "Název soustavy uložen.");
});
ui["galaxy-remove-open"].addEventListener("click", () => {
  const id = galaxySelected;
  if (galaxyBusy || id <= 0 || (id !== galaxyId && !galaxyOthers.has(id))) return;
  galaxyRemoval = id;
  renderGalaxy();
  ui["galaxy-cancel-delete"].focus();
});
ui["galaxy-delete"].addEventListener("click", removeGalaxySystem);
ui["galaxy-cancel-delete"].addEventListener("click", () => {
  galaxyRemoval = null;
  renderGalaxy();
  ui["galaxy-remove-open"].focus();
});
galaxyMap.addEventListener("click", event => {
  const star = event.target.closest("[data-galaxy-system]");
  if (star && !galaxyBusy) selectGalaxySystem(Number(star.dataset.galaxySystem));
});
ui["result-galaxy"].addEventListener("click", () => {
  closeGameDialog(ui.results, "galaxy");
  openGalaxy();
});

// Keep the IndexedDB name to open existing saves on the same origin.
const SAVE_DB = "orbitseed-saves-v1";
function openSaveDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("Úložiště prohlížeče není dostupné."));
    const req = indexedDB.open(SAVE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("positions");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Nepodařilo se otevřít úložiště."));
  });
}
async function saveSlotWrite(record) {
  const db = await openSaveDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("positions", "readwrite");
      tx.objectStore("positions").put(record, "quick");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error ?? new Error("Zápis se nezdařil."));
      tx.onabort = () => reject(tx.error ?? new Error("Zápis byl přerušen."));
    });
  } finally { db.close(); }
}
async function saveSlotRead() {
  const db = await openSaveDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("positions", "readonly");
      const req = tx.objectStore("positions").get("quick");
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error ?? new Error("Čtení se nezdařilo."));
    });
  } finally { db.close(); }
}
async function saveRecord() {
  const others = [...galaxyOthers.values()], id = galaxyId, nextId = galaxyNextId;
  const record = { version: nextId > 1 || galaxyName !== Galaxy.HOME ? 15 : 13, savedAt: new Date().toISOString(), ...currentSystemView(),
    sim: structuredClone(sim), missionCheckpoint: missionCheckpoint ? structuredClone(missionCheckpoint) : null };
  if (record.version === 15) {
    const activeName = galaxyName;
    const systems = await Promise.all(others.map(async entry => {
      const state = await entry.background.snapshot();
      if (galaxyOthers.get(entry.id) !== entry || Math.abs(Galaxy.sharedTime(record.sim) - Galaxy.sharedTime(state)) > 1e-5) {
        throw new Error("Pozice se během ukládání změnila.");
      }
      return { id: entry.id, name: entry.name, view: entry.view, sim: structuredClone(state) };
    }));
    if (id !== galaxyId || others.length !== galaxyOthers.size || nextId !== galaxyNextId) {
      throw new Error("Pozice se během ukládání změnila.");
    }
    record.galaxy = { id, name: activeName, nextId, systems };
  }
  return record;
}
function validateRecord(record) {
  if (!record || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].includes(record.version) || !record.sim || !Array.isArray(record.sim.worlds)
    || !Array.isArray(record.sim.probes) || !Array.isArray(record.sim.voyages)
    || !Array.isArray(record.sim.ships) || !record.sim.stats || record.sim.worlds.length > Orbit.LIMIT)
    throw new Error("Soubor neobsahuje platnou uloženou soustavu CosmoEvolve.");
  for (const world of record.sim.worlds) {
    if (!Number.isFinite(world.x) || !Number.isFinite(world.y) || !Number.isFinite(world.vx)
      || !Number.isFinite(world.vy)) throw new Error("Neplatné údaje planety.");
    if (world.biosphere) {
      const legacy = !world.biosphere.power;
      const surface = world.biosphere = Biosphere.loadSurface(world.biosphere, world.pop);
      Warfare.restore(surface);
      FaunaEvolution.restore(surface);
      LifeChronicle.restore(world);
      if (legacy && world.pop > 0) {
        surface.power.reserve = Number.isFinite(world.credits) ? Orbit.clamp(world.credits, 0, Biosphere.POWER_LIMIT) : 0;
        const modern = Biosphere.settlementEra(surface) >= 6;
        if (modern) surface.power.age = world.tech ? 56 : 0;
        if (world.tech && (surface.era >= 6 || world.colony && surface.legacyClimate >= 0.93)) surface.power.work = Biosphere.PROBE_WORK;
      }
      delete world.credits;
    }
    // Orbital elements are derived values; recompute after JSON import (Infinity becomes null in JSON).
    world.orbit = Orbit.elements(world);
    if (!world.orbitBaseline || world.orbitBaseline.apo === null || world.orbitBaseline.peri === null)
      world.orbitBaseline = { ...world.orbit };
    world.orbitAlert ??= "ok";
  }
  record.sim.physics = record.sim.physics === "stable" ? "stable" : "free";
  Orbit.restoreVisitor(record.sim);
  Orbit.restoreEconomy(record.sim);
  Patronage.restore(record.sim);
  record.sim.history ??= [];
  for (const world of record.sim.worlds) Orbit.recoverUninhabitedWorld(record.sim, world);
  if (record.version < 4 && record.sim.history.length >= 90 && record.sim.historyTruncatedBefore === undefined)
    record.sim.historyTruncatedBefore = record.sim.history[0]?.time ?? 0;
  record.sim.stats.crewLost ??= 0;
  record.sim.stats.destroyedProbes ??= 0;
  for (const voyage of record.sim.voyages) {
    if (voyage.status !== "landed" || !voyage.target) continue;
    const world = record.sim.worlds.find(p => voyage.targetId == null ? p.name === voyage.target : p.id === voyage.targetId);
    if (world?.pop > 0) voyage.targetId = world.id;
    else {
      voyage.status = "colony-lost";
      voyage.lossReason = world ? "extinction" : record.sim.history.some(entry => entry.message === voyage.target + " opustila soustavu.") ? "escape" : "gone";
    }
  }
  if (record.version === 1 && record.surfaceCamera && Number.isFinite(record.surfaceCamera.x) && Number.isFinite(record.surfaceCamera.y)) {
    Object.assign(record.surfaceCamera, Biosphere.legacyPoint(record.surfaceCamera));
  }
  return record;
}
function readGalaxyRecord(record) {
  if (record.version < 14) return null;
  const legacy = record.version === 14, stored = record.galaxy;
  let galaxy = stored;
  if (legacy) {
    if (!stored || ![0, 1].includes(stored.slot) || !stored.other) throw new Error("Chybí druhá soustava uložené galaxie.");
    galaxy = { id: stored.slot, name: stored.slot === 0 ? Galaxy.HOME : "Aster", nextId: 2,
      systems: [{ id: 1 - stored.slot, name: stored.slot === 0 ? "Aster" : Galaxy.HOME, view: stored.view, sim: stored.other }] };
  }
  if (!galaxy || !Array.isArray(galaxy.systems) || galaxy.systems.length >= Galaxy.LIMIT || !Number.isSafeInteger(galaxy.nextId)) {
    throw new Error("Neplatný seznam soustav v uložené galaxii.");
  }
  const ids = new Set(), names = new Set();
  const entries = [{ id: galaxy.id, name: galaxy.name, sim: record.sim }, ...galaxy.systems];
  for (const entry of entries) {
    const name = cleanSystemName(entry?.name).toLocaleLowerCase("cs-CZ");
    if (!Number.isSafeInteger(entry?.id) || entry.id < 0 || entry.id >= galaxy.nextId || ids.has(entry.id)
      || !name || names.has(name)) {
      throw new Error("Neplatné označení soustavy.");
    }
    ids.add(entry.id);
    names.add(name);
    const state = entry.sim;
    if (state?.mode !== "biosphere" || !Number.isFinite(state.time) || !Number.isFinite(state.galaxyEpoch)
      || !Number.isInteger(state.galaxySeed) || state.galaxySeed < 0 || state.galaxySeed > 0xffffffff) {
      throw new Error("Neplatný stav soustavy v galaxii.");
    }
    if (state !== record.sim) validateRecord({ version: 13, sim: state });
    if (Math.abs(Galaxy.sharedTime(record.sim) - Galaxy.sharedTime(state)) > 1e-5) {
      throw new Error("Uložené soustavy mají rozdílný čas simulace.");
    }
  }
  if (!ids.has(0)) throw new Error("V uložené galaxii chybí výchozí soustava.");
  const reference = legacy ? entries.find(entry => entry.id === 0).sim : record.sim;
  for (const { sim: state } of entries) if (state !== reference) Galaxy.copyCalendar(reference, state);
  return galaxy;
}

function applyRecord(record) {
  validateRecord(record);
  const stored = readGalaxyRecord(record);
  if (record.missionCheckpoint) validateRecord({ version: record.version, sim: record.missionCheckpoint });
  finishImpactScene();
  for (const dialog of [ui["storage-dialog"], ui.results, ui["economy-dialog"], ui["buildings-dialog"], ui["building-confirm"], ui["patron-confirm"], ui["patron-dialog"], document.getElementById("patron-picker-dialog"), document.getElementById("rename-planet-dialog"), document.getElementById("rename-entity-dialog"), document.getElementById("release-confirm")].filter(Boolean)) {
    if (dialog.open) dialog.close("loaded");
  }
  clearGalaxy();
  if (stored) {
    galaxyId = stored.id;
    galaxyName = stored.name;
    galaxyNextId = stored.nextId;
    for (const entry of stored.systems) {
      Orbit.restoreSurfaceSchedule(entry.sim);
      galaxyOthers.set(entry.id, { id: entry.id, name: entry.name, view: entry.view,
        background: startBackground(entry.sim) });
    }
  }
  missionCheckpoint = record.missionCheckpoint ?? null;
  record.sim.paused = true;
  loadSystemView(record.sim, record);
}
function feedback(message, bad = false) {
  if (ui["storage-dialog"].open) put(ui["storage-message"], message);
  Orbit.event(sim, message, bad ? "bad" : "good");
  updateUI();
}

ui["economy-open"].addEventListener("click", () => {
  const choices = sim.worlds.filter(p => p.pop > 0 && p.biosphere);
  const picked = choices.find(p => p.id === selected);
  const outpost = picked?.colony && !picked.self ? picked : null;
  const from = outpost ? choices.find(p => p !== outpost && Orbit.hasSpaceflight(p)) ?? picked
    : picked ?? choices.find(Orbit.hasSpaceflight) ?? choices[0];
  const to = outpost !== from && outpost ? outpost : choices.find(p => p !== from && p.colony && !p.self);
  ui["economy-dialog"].showModal();
  economyOptions(choices, { from: from?.id, to: to?.id });
  loadRouteControls();
  economyResult("");
});
for (const id of ["economy-from", "economy-to"]) ui[id].addEventListener("change", () => {
  economyOptions(sim.worlds.filter(p => p.pop > 0 && p.biosphere));
  loadRouteControls();
  economyResult("");
});
ui["economy-backup"].addEventListener("change", updateEconomyUI);
ui["economy-reserve"].addEventListener("input", updateEconomyUI);
for (const button of researchButtons) button.addEventListener("click", () => {
  const { from } = economySelection();
  if (!from || button.disabled) return;
  const key = button.dataset.researchKey, issue = Patronage.selectResearch(sim, from, key);
  economyResult(issue || (from.biosphere.research.active ? "Zvolen společný výzkum " + Biosphere.RESEARCH[key].name + "." : "Výzkum byl pozastaven nebo dokončen."));
});
ui["economy-space"].addEventListener("click", () => {
  const { from } = economySelection(); if (!from || ui["economy-space"].disabled) return;
  economyResult(Patronage.selectSpace(sim, from) || "Stavba kosmodromu byla nastavena. Pokračuje po zavření okna.");
});
for (const button of cargoButtons) button.addEventListener("click", () => {
  if (button.disabled) return;
  const { from, to, reserve } = economySelection();
  const flight = Orbit.launchCargo(sim, from, to, button.dataset.cargo, reserve);
  economyResult(flight ? "Loď odstartovala. Odhad příletu " + decimal.format(flight.duration) + " s při 1×." : "Let teď nemůže odstartovat.");
});
ui["economy-route-save"].addEventListener("click", () => {
  const { from, to, backup, reserve } = economySelection();
  if (ui["economy-route-save"].disabled) return;
  economyResult(Orbit.setSupplyRoute(sim, from, to, backup, reserve) ? "Linka je nastavená." : "Linku teď nelze nastavit.");
});
ui["economy-route-remove"].addEventListener("click", () => {
  const { to } = economySelection();
  if (to && Orbit.removeSupplyRoute(sim, to.id)) economyResult("Linka byla zrušena. Lodě na cestě pokračují.");
});
for (const button of stationModes) button.addEventListener("click", () => {
  const p = viewedPlanet(), mode = button.dataset.stationMode;
  if (!p || button.disabled) return;
  if (Biosphere.setStationMode(p.biosphere, mode, Number(ui["station-pick"].value))) updateUI();
});

function patronSelection(all = Patronage.catalog(sim)) {
  const factions = [...new Map(all.map(item => [item.faction, { id: item.faction, name: item.factionName + " · " + Evolution.nationClimate(sim,item.community.civilization) + (item.faction.startsWith("realm:") ? " · " + item.world.name : "") }])).values()];
  if (!sim.patron && patronBrowser.filter === "mine") patronBrowser.filter = "all";
  if (!factions.some(item => item.id === patronBrowser.faction)) patronBrowser.faction = all.find(item => item.id === patronBrowser.selected)?.faction ?? factions[0]?.id ?? "";
  const watched = globalThis.CosmoCompass?.id() ?? null;
  const entries = all.filter(item => watched ? item.community.civilization === watched
    : patronBrowser.filter === "all" || patronBrowser.filter === "mine" && item.community.civilization === sim.patron?.id
    || patronBrowser.filter === "faction" && item.faction === patronBrowser.faction);
  const selected = entries.find(item => item.id === patronBrowser.selected) ?? entries[0];
  patronBrowser.selected = selected?.id ?? "";
  const world = selected?.world, community = selected?.community;
  const own = entries.filter(item => sim.patron && item.community.civilization === sim.patron.id);
  const targets = world ? all.filter(item => item.world === world && (patronBrowser.batch ? item.community.civilization !== sim.patron?.id : item.community.realm !== community.realm)) : [];
  const targetItem = targets.find(item => item.id === patronBrowser.target) ?? targets[0];
  patronBrowser.target = targetItem?.id ?? "";
  return { all, factions, entries, selected, world, community, own, targets, target: targetItem?.community, targetRef: targetItem ? { worldId: targetItem.world.id, id: targetItem.community.id } : null };
}

function updatePatronUI() {
  const all = Patronage.catalog(sim), own = all.filter(item => sim.patron && item.community.civilization === sim.patron.id);
  ui["patron-strip"].hidden = !sim.patron && !all.length;
  put(ui["patron-label"], sim.patron ? "Tvoje civilizace" : "Pozorovatel");
  put(ui["patron-civilization"], sim.patron ? Evolution.nationLabel(sim,sim.patron.id) + " · " + Evolution.nationClimate(sim,sim.patron.id) : "Můžeš přijmout patronát nad jedním národem");
  const { residents, traveling } = Patronage.populationBreakdown(sim);
  put(ui["patron-population"], sim.patron ? "Obyvatelé patronátu: " + number.format(Math.floor(residents))
    + (traveling > 0 ? " · Na cestě " + number.format(Math.floor(traveling)) : "") : "");
  put(ui["patron-overview"], sim.patron ? own.length + " osad · " + new Set(own.map(item => item.world.id)).size + " světů · Znalosti společné, sklady místní."
    : "Svět se vyvíjí samostatně. Patronát otevře pokyny vybranému národu.");
  put(ui["patron-open"], sim.patron ? "Spravovat mé osady" : "Prohlédnout kmeny");
  if (!ui["patron-dialog"].open) return;
  const data = patronSelection(all), { factions, entries, world, community: c, target, own: filteredOwn } = data;
  for (const button of document.querySelectorAll("[data-patron-filter]")) {
    button.setAttribute("aria-pressed", String(patronBrowser.filter === button.dataset.patronFilter));
    button.disabled = button.dataset.patronFilter === "mine" && !sim.patron;
  }
  ui["patron-faction-nav"].hidden = patronBrowser.filter !== "faction";
  put(ui["patron-faction-label"], factions.find(item => item.id === patronBrowser.faction)?.name ?? "Žádné civilizace");
  ui["patron-faction-prev"].disabled = ui["patron-faction-next"].disabled = factions.length < 2;
  ui["patron-previous"].disabled = ui["patron-next"].disabled = entries.length < 2;
  put(ui["patron-position"], entries.length ? (entries.indexOf(data.selected) + 1) + " / " + entries.length : "0 / 0");
  put(ui["patron-selected"], c ? c.name || "Osada " + c.id : "Žádné osady v tomto filtru");
  put(ui["patron-selected-civ"], c ? c.civilizationName + " · " + Evolution.profile(c.profile).climate + " · " + world.name : "Změň filtr nebo počkej na vznik nového osídlení.");
  put(ui["patron-filter-count"], "Vyfiltrováno " + entries.length + " osad · " + new Set(entries.map(item => item.world.id)).size + " světů · Vlastních " + filteredOwn.length);
  ui["patron-batch"].checked = patronBrowser.batch;
  ui["patron-batch"].disabled = !sim.patron;
  put(ui["patron-batch-summary"], patronBrowser.batch ? "Hromadný pokyn pro " + filteredOwn.length + " vlastních osad ve filtru. Každá platí ze svého skladu; nedostupné se přeskočí. Dary směřují zvolenému příjemci na této planetě."
    : "Pokyn dostane právě zobrazená osada. Zaškrtnutím lze ovládat více vlastních osad najednou.");
  const controlled = Boolean(sim.patron && c?.civilization === sim.patron.id);
  ui["patron-renaming"].hidden = !controlled;
  ui["patron-choose"].hidden = Boolean(sim.patron) || !c;
  ui["patron-find"].disabled = !c;
  put(ui["patron-target-label"], target ? Patronage.name(target) + " · " + Evolution.profile(target.profile).climate : "Žádný jiný národ na této planetě");
  ui["patron-target-prev"].disabled = ui["patron-target-next"].disabled = data.targets.length < 2;
  if (!c) {
    for (const button of document.querySelectorAll("[data-patron-action]")) button.disabled = true;
    for (const id of ["patron-description", "patron-food", "patron-food-flow", "patron-faith", "patron-faith-next", "patron-guards", "patron-relation"]) put(ui[id], "");
    ui["patron-faith"].parentElement.hidden = false;
    put(ui["patron-task"], "V tomto filtru nejsou obydlené osady."); return;
  }
  if (controlled) {
    for (const [id, value, binding] of [["patron-settlement-name", c.name || "Osada " + c.id, data.selected.id], ["patron-civilization-name", sim.patron.name, String(sim.patron.id)]]) {
      if (ui[id].dataset.binding !== binding) { ui[id].value = value; ui[id].dataset.binding = binding; }
    }
  }
  put(ui["patron-description"], Patronage.name(c) + " · " + Evolution.profile(c.profile).climate + " · " + number.format(Math.floor(c.people)) + " obyvatel · " + Patronage.NATURES[c.nature] + " povaha. "
    + (controlled ? "Tuto osadu vedeš." : sim.patron ? "Tato osada patří jiné společnosti. Můžeš ji pozorovat." : "Zatím ji vede vlastní vůle obyvatel."));
  put(ui["patron-food"], Math.floor(c.food) + " / " + Patronage.capacity(c) + " J");
  ui["patron-food-meter"].value = c.food / Patronage.capacity(c) * 100; ui["patron-food-meter"].dataset.tone = c.starved ? "bad" : "";
  put(ui["patron-food-flow"], "Sběr +" + decimal.format(c.harvest ?? 0) + " · Spotřeba −" + decimal.format((c.consumption ?? 0) + (c.mineFoodRate ?? 0)) + " J/s při 1×. Návraty lovců jsou navíc.");
  put(ui["patron-faith"], c.faith + " / 10");
  put(ui["patron-faith-next"], Patronage.info(c) + (c.faith < 10 ? " Znalosti budou platit ve všech osadách této civilizace." : " Energetika a věda jsou odemčené. Odběr při nové akci Věda: " + decimal.format(Evolution.scienceOrderDraw(sim, c.civilization)) + " E/s."));
  ui["patron-faith"].parentElement.hidden = c.faith >= 10;
  put(ui["patron-guards"], c.guards + " jednotek · udržitelná kapacita " + Patronage.guardCapacity(sim, world, c));
  const job = c.job;
  put(ui["patron-task"], job ? Patronage.ACTIONS[job.kind].name + " · " + (job.blocked ? "Čeká na bezpečnou cestu nebo vhodné podmínky."
    : ["guard", "faith"].includes(job.kind) ? Math.floor(job.work / 10 * 100) + " % · Pokračuje po zavření okna."
    : job.kind === "gift" ? (job.delivered ? "Dary byly předány. Poslové se vracejí domů." : job.leg === "sea" ? "Člun veze dary." : "Skupina nese dary sousedům.")
    : job.returning ? "Skupina se vrací s nákladem." : "Skupina hledá potravu.") : "Osada je připravena na další pokyn.");
  put(ui["patron-relation"], target ? Patronage.NATURES[target.nature] + " povaha · Důvěra " + Patronage.relation(world.biosphere, c, target) + " / 60 pro mírové připojení."
    : "Na tomto světě zatím není jiná společnost, které lze poslat dary.");
  for (const button of document.querySelectorAll("[data-patron-action]")) {
    const action = button.dataset.patronAction;
    if (action === "gift") {
      button.disabled = !controlled || !target || target.civilization === c.civilization;
      put(button.querySelector(".action-price"), "Výpravy si osada naplánuje.");
      put(button.querySelector("small"), c.diplomaticGoal ? "Diplomatický cíl je nastavený." : "Vyber osadu a potvrď diplomatický cíl.");
      continue;
    }
    if (patronBrowser.batch) {
      const result = Patronage.batchOrder(sim, filteredOwn, action, data.targetRef, true);
      button.disabled = !result.started;
      put(button.querySelector(".action-price"), result.started + " osad · " + result.food + " J celkem");
      put(button.querySelector("small"), result.started ? "Každá osada platí místně. Přeskočí se " + result.skipped + "." : Object.keys(result.reasons)[0] || "Ve filtru nejsou vlastní osady.");
      button.title = Object.entries(result.reasons).map(([reason, n]) => n + "× " + reason).join("\n");
    } else {
      const issue = controlled ? Patronage.block(sim, world, c, action, target) : "Pokyn je dostupný pouze tvé civilizaci.";
      button.disabled = Boolean(issue); button.title = issue || Patronage.ACTIONS[action].note;
      put(button.querySelector(".action-price"), Patronage.cost(c, action) + " J");
      put(button.querySelector("small"), issue || "Připraveno. Zaplatí tato osada při zadání.");
    }
  }
}

function openPatronage(world, id) {
  clearWeatherAim(); clearAim(); launchMode = null;
  const all = Patronage.catalog(sim), explicit = all.find(item => item.world === world && item.community.id === id);
  if (explicit) {
    const fits = patronBrowser.filter === "all" || patronBrowser.filter === "mine" && explicit.community.civilization === sim.patron?.id
      || patronBrowser.filter === "faction" && explicit.faction === patronBrowser.faction;
    if (!fits) patronBrowser.filter = sim.patron?.id === explicit.community.civilization ? "mine" : "all";
    patronBrowser.selected = explicit.id;
  } else if (sim.patron) patronBrowser.filter = "mine";
  put(ui["patron-feedback"], ""); ui["patron-dialog"].showModal(); updateUI();
}
function browsePatron(kind, direction) {
  const data = patronSelection();
  const list = kind === "faction" ? data.factions : kind === "target" ? data.targets : data.entries;
  const field = kind === "faction" ? "faction" : kind === "target" ? "target" : "selected";
  if (list.length < 2) return;
  const index = Math.max(0, list.findIndex(item => item.id === patronBrowser[field]));
  patronBrowser[field] = list[(index + direction + list.length) % list.length].id;
  if (kind === "faction") patronBrowser.selected = "";
  put(ui["patron-feedback"], ""); updatePatronUI();
}
ui["patron-open"].addEventListener("click", () => openPatronage());
for (const [id, kind, direction] of [["patron-previous", "selected", -1], ["patron-next", "selected", 1], ["patron-faction-prev", "faction", -1], ["patron-faction-next", "faction", 1], ["patron-target-prev", "target", -1], ["patron-target-next", "target", 1]])
  ui[id].addEventListener("click", () => browsePatron(kind, direction));
ui["patron-browse"].addEventListener("keydown", e => { if (["ArrowLeft", "ArrowRight"].includes(e.key)) { e.preventDefault(); browsePatron("selected", e.key === "ArrowLeft" ? -1 : 1); } });
for (const button of document.querySelectorAll("[data-patron-filter]")) button.addEventListener("click", () => { patronBrowser.filter = button.dataset.patronFilter; patronBrowser.selected = ""; put(ui["patron-feedback"], ""); updatePatronUI(); });
ui["patron-batch"].addEventListener("change", () => { patronBrowser.batch = ui["patron-batch"].checked; updatePatronUI(); });
for (const button of document.querySelectorAll("[data-patron-action]")) button.addEventListener("click", () => {
  const data = patronSelection(), { world, community, target } = data;
  if (!world || !community || button.disabled) return;
  if (button.dataset.patronAction === "gift") {
    put(ui["patron-feedback"], Patronage.setDiplomaticGoal(sim, world, community.id, target?.id) || "Diplomatický cíl nastaven.");
    updateUI();
    return;
  }
  if (patronBrowser.batch) {
    const result = Patronage.batchOrder(sim, data.own, button.dataset.patronAction, data.targetRef);
    put(ui["patron-feedback"], "Pokyn přijalo " + result.started + " osad. Vydáno " + result.food + " J z místních skladů. Přeskočeno " + result.skipped + ". "
      + Object.entries(result.reasons).map(([reason, n]) => n + "× " + reason).join(" "));
  } else {
    const issue = Patronage.order(sim, world, community.id, button.dataset.patronAction, target?.id);
    put(ui["patron-feedback"], issue || "Pokyn přijat. Zavři okno a nech běžet čas; výpravu uvidíš na mapě.");
  }
  updateUI();
});
ui["patron-rename-settlement"].addEventListener("click", () => {
  const { world, community } = patronSelection(); if (!community) return;
  const issue = Patronage.renameSettlement(sim, world, community.id, ui["patron-settlement-name"].value);
  put(ui["patron-feedback"], issue || "Název osady je uložený."); if (!issue) ui["patron-settlement-name"].value = community.name; updateUI();
});
ui["patron-rename-civilization"].addEventListener("click", () => {
  const issue = Patronage.renameCivilization(sim, ui["patron-civilization-name"].value);
  put(ui["patron-feedback"], issue || "Název civilizace je uložený."); if (!issue) ui["patron-civilization-name"].value = sim.patron.name; updateUI();
});
ui["patron-find"].addEventListener("click", () => {
  const { world, community } = patronSelection(); if (!world || !community) return;
  ui["patron-dialog"].close("find"); showBuilding(world, { tile: community.home });
});

function beginPatronConfirmation(world, community) {
  if (sim.over || sim.patron || !world || !community?.active || !(community.people > 0)) return;
  pendingPatron = { worldId: world.id, communityId: community.id };
  ui["patron-name"].value = sim.nations[community.civilization]?.name ?? community.civilizationName;
  put(ui["patron-confirm-message"], "Obyvatelé planety " + world.name + " se k tobě obracejí ve víře. Osud naší civilizace je ve tvých rukou.");
  put(ui["patron-save-feedback"], ""); ui["patron-confirm"].showModal();
}
ui["patron-choose"].addEventListener("click", () => {
  const { world, community } = patronSelection();
  beginPatronConfirmation(world, community);
});
async function acceptPatron(saveFirst) {
  if (adoptingPatron || !pendingPatron || sim.patron) return;
  const claim = pendingPatron, chosenName = ui["patron-name"].value;
  const world = sim.worlds.find(p => p.id === claim.worldId);
  if (!world) return;
  adoptingPatron = true;
  ui["patron-adopt"].disabled = ui["patron-save-adopt"].disabled = true;
  try {
    if (saveFirst) { put(ui["patron-save-feedback"], "Ukládám pozici před přijetím patronátu…"); await saveSlotWrite(await saveRecord()); }
    if (!ui["patron-confirm"].open || pendingPatron !== claim || !sim.worlds.includes(world)) return;
    const issue = Patronage.adopt(sim, world, claim.communityId, chosenName);
    if (issue) { put(ui["patron-save-feedback"], issue); return; }
    // After taking patronage the game must not stay blocked by an unfinished
    // launch gesture that was active before the patronage dialogs opened.
    if (pointer?.mode || keyboard) clearAim();
    // Saving before adoption yields to another turn; retain the explicit player action.
    if (saveFirst) (sim.playerChronicle ??= []).push({ time: sim.time, date: Evolution.dateAt(sim), civilization: sim.patron.id, civilizationName: sim.patron.name, message: 'Přijat patronát · ' + sim.patron.name + ' · ' + world.name });
    patronBrowser.filter = "mine"; patronBrowser.selected = world.id + ":" + claim.communityId;
    ui["patron-confirm"].close("accepted");
    if (ui["patron-dialog"].open) ui["patron-dialog"].close("accepted");
    // The planet-first selector is another modal in the same patronage flow.
    // A lingering modal blocks ALL simulation ticks even though the rate
    // buttons are visible; clear only the dialogs belonging to adoption.
    const picker = document.getElementById("patron-picker-dialog");
    if (picker?.open) picker.close("accepted");
    lastFrame = 0;
    accumulator = 0;
    queueGameFrame();
    const community = Patronage.sync(sim, world).find(c => c.id === claim.communityId);
    if (community) showBuilding(world, { tile: community.home });
    else updateUI();
  } catch (error) { put(ui["patron-save-feedback"], "Uložení se nezdařilo: " + error.message + ". Můžeš se vrátit a exportovat zálohu přes Uložení, nebo přijmout bez uložení."); }
  finally { adoptingPatron = false; ui["patron-adopt"].disabled = ui["patron-save-adopt"].disabled = false; }
}
ui["patron-adopt"].addEventListener("click", () => acceptPatron(false));
ui["patron-save-adopt"].addEventListener("click", () => acceptPatron(true));
ui["patron-confirm"].addEventListener("close", () => { pendingPatron = null; });

function journalText(scope, quiet) {
  const lines = ["CosmoEvolve — palubní deník", "Rok soustavy: " + number.format(yearAt(sim.time)),
    "Populace na planetách: " + number.format(Orbit.residentPopulation(sim)),
    "Civilizace pod patronátem: " + (sim.patron?.name ?? "pozorovatel"),
    "Rozsah: " + (Journal.labels[scope] ?? "Všechny události") + (quiet ? " · bez rutinních hlášení" : ""), ""];
  if (sim.historyTruncatedBefore !== undefined) lines.push("Starší události před rokem " + yearAt(sim.historyTruncatedBefore) + " už nejsou v této pozici uchovány.", "");
  const entries = (sim.history ?? []).filter(item => Journal.matches(item, scope, quiet));
  for (const item of entries) lines.push("Datum " + Evolution.dateLabel(item.date ?? Evolution.dateAt(sim, item.time)) + " | " + item.message);
  if (!entries.length) lines.push("Pro tento výběr zatím nejsou žádné události.");
  return lines.join("\n");
}
const journalExport = ui["journal-export-dialog"];
ui["export-log"].addEventListener("click", () => {
  ui["journal-export-filter"].value = "current";
  journalExport.returnValue = "";
  journalExport.showModal();
  updateStatus();
});
journalExport.querySelector("form").addEventListener("submit", event => {
  event.preventDefault();
  closeGameDialog(journalExport, event.submitter?.value ?? "cancel");
});
journalExport.addEventListener("close", () => {
  if (journalExport.returnValue !== "download") return;
  const selectedScope = ui["journal-export-filter"].value, current = selectedScope === "current";
  const blob = new Blob(["\uFEFF" + journalText(current ? journalScope() : selectedScope, current && ui["log-quiet"].checked)], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "CosmoEvolve-denik-" + yearAt(sim.time) + ".txt";
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 1500);
});

function buildingPlanet() {
  return sim.worlds.find(world => world.id === Number(ui["buildings-world"].value) && world.biosphere);
}

function showBuilding(world, building) {
  if (ui["buildings-dialog"].open) ui["buildings-dialog"].close("find");
  showSurface(world);
  const point = Biosphere.position(building.tile);
  surfaceCamera = SurfaceView.pan(view, { zoom: Math.max(2.4, surfaceCamera.zoom), x: point.x, y: point.y }, 0, 0);
  buildingFocus = { worldId: world.id, tile: building.tile, until: performance.now() + 7000 };
  if (building.station) { preferredStation = building.station.id; stationPickerWorld = world.id; }
  updateCameraControls(); nextGroundFrame = 0; updateUI();
}

function updateBuildingPreview(world) {
  const all = Biosphere.buildings(world.biosphere);
  const equipment = all.filter(item => typeof item.kind === "number" && item.kind >= 5 && item.health > 0);
  const limited = equipment.filter(item => item.status.tone).length;
  const priority = item => item.health <= 0 ? 4 : item.status.tone === "bad" ? 3 : item.status.tone === "warn" ? 2 : item.station?.mode === "off" ? 1 : 0;
  const visible = equipment.sort((a, b) => priority(b) - priority(a) || a.tile - b.tile).slice(0, 5);
  put(ui["buildings-preview-title"], "Budovy · " + world.name);
  put(ui["buildings-preview-summary"], limited ? "Omezení: " + limited : "Zařízení: " + equipment.length);
  ui["buildings-preview-summary"].dataset.tone = limited ? "warn" : "";
  put(ui["buildings-open"], "Všechny budovy a správa (" + all.length + ")");
  ui["buildings-open"].dataset.tone = limited ? "bad" : "";
  const homes = all.filter(item => item.group === "homes").length;
  const kits = world.biosphere.stations.filter(station => station.tile < 0).length;
  put(ui["buildings-preview-note"], (equipment.length ? "Kliknutím najdeš zařízení na mapě." : "Zatím žádná technická zařízení.")
    + (equipment.length > visible.length ? " Zobrazeno " + visible.length + " z " + equipment.length + "." : "")
    + (homes ? " Obydlí a pole: " + homes + "." : "") + (kits ? " Sady k umístění: " + kits + "." : ""));
  const keep = new Set(visible.map(item => world.id + ":" + item.id));
  for (const [key, row] of buildingPreviews) if (!keep.has(key)) { row.node.remove(); buildingPreviews.delete(key); }
  const nodes = [];
  for (const item of visible) {
    const key = world.id + ":" + item.id;
    let row = buildingPreviews.get(key);
    if (!row) {
      const node = document.createElement("button"); node.type = "button"; node.className = "building-preview";
      node.dataset.buildingId = item.id;
      const name = document.createElement("strong"), status = document.createElement("span"), details = document.createElement("small");
      status.className = "building-preview-state"; node.append(name, status, details);
      node.addEventListener("click", () => {
        const current = sim.worlds.find(p => p.id === world.id);
        const building = current && Biosphere.buildings(current.biosphere).find(entry => entry.id === item.id);
        if (building) showBuilding(current, building);
      });
      row = { node, name, status, details }; buildingPreviews.set(key, row);
    }
    put(row.name, item.name); put(row.status, item.status.label);
    put(row.details, "Kondice " + item.health + " %" + (item.station ? " · " + decimal.format(item.station.draw) + " / " + decimal.format(item.station.load) + " E/s"
      : item.plant ? " · Výroba " + decimal.format(item.plant.output) + " E/s" : ""));
    row.node.dataset.tone = item.status.tone;
    row.node.title = item.name + " · " + item.status.detail + " Kliknutím najdeš na mapě.";
    nodes.push(row.node);
  }
  const list = ui["buildings-preview"];
  if (nodes.some((node, index) => list.children[index] !== node) || nodes.length !== list.children.length) {
    const focused = document.activeElement;
    list.replaceChildren(...nodes);
    if (nodes.includes(focused)) focused.focus({ preventScroll: true });
  }
}

// One filter determines visible rows, batch preview and mutation scope.
function buildingItems(world, all = world ? Biosphere.buildings(world.biosphere) : []) {
  if (!world) return [];
  const f = ui['buildings-filter'].value, owner = document.getElementById('buildings-owner')?.value ?? 'all', town = document.getElementById('buildings-town')?.value ?? 'all', kind = document.getElementById('buildings-kind')?.value ?? 'all';
  const watched=globalThis.CosmoCompass?.id() ?? null;
  return all.filter(b => (!watched || Evolution.buildingOwner(b) === watched)
    && (owner === 'all' || watched || Evolution.buildingOwner(b) === (owner === 'mine' ? sim.patron?.id : Number(owner)))
    && (town === 'all' || b.town === world.biosphere.towns[Number(town)]) && (kind === 'all' || String(b.kind) === kind)
    && (f === 'all' || f === 'equipment' && typeof b.kind === 'number' && b.kind >= 5 && b.health > 0 || f === 'homes' && b.group === 'homes' || f === 'ruins' && b.health <= 0 || f === 'damaged' && (b.status.tone || b.health < 99 || b.station?.mode === 'off' || b.plant?.output < .02)));
}

function updateBuildingsUI() {
  const choices = sim.worlds.filter(world => world.biosphere);
  ui["buildings-strip"].hidden = !choices.length;
  const selectedWorld = viewedPlanet() ?? selectedSurface();
  // OPT2: MATRIOŠKA permanently hides the old standalone building preview.
  // Keep the actual building manager fully live, but do not scan all surface
  // buildings and rebuild an invisible preview every 120 milliseconds.
  if (selectedWorld && !ui["world-navigation"].classList.contains("top-management")) updateBuildingPreview(selectedWorld);
  if (!ui["buildings-dialog"].open) return;
  setWorldOptions(ui["buildings-world"], choices);
  const world = buildingPlanet(), list = ui["buildings-list"];
  if (!world) { list.replaceChildren(); put(ui["buildings-summary"], "Vyber planetu s povrchem."); return; }
  const s = world.biosphere, all = Biosphere.buildings(s), filter = ui["buildings-filter"].value;
  const items = buildingItems(world, all);
  const settings = sim.interface ??= {};
  const size = PAGE_SIZES.includes(settings.buildingPageSize) ? settings.buildingPageSize : 20;
  const pageSize = document.getElementById("buildings-page-size");
  if (pageSize) pageSize.value = String(size);
  const pages = Math.max(1, Math.ceil(items.length / size));
  settings.buildingPage = Math.max(0, Math.min(pages - 1, settings.buildingPage || 0));
  const visibleItems = items.slice(settings.buildingPage * size, (settings.buildingPage + 1) * size);
  const pageLabel = document.getElementById('buildings-page');
  if (pageLabel) {
    put(pageLabel, 'Strana ' + (settings.buildingPage + 1) + ' / ' + pages + ' · ' + items.length + ' staveb ve filtru');
    document.getElementById('buildings-prev').disabled = settings.buildingPage === 0;
    document.getElementById('buildings-next').disabled = settings.buildingPage === pages - 1;
  }

  const kits = s.stations.filter(station => station.tile < 0).length;
  put(ui["buildings-summary"], world.name + " · " + all.length + " staveb · Teraformery " + Biosphere.placedStations(s).length
    + " / " + Biosphere.MAX_STATIONS + " · Sady " + kits + " · Energie " + Math.floor(s.power.reserve) + " E · Materiál " + Math.floor(world.supply)
    + " · Na stránce " + visibleItems.length + " z " + items.length);
  const signature = world.id + ":" + settings.buildingPage + ":" + size + ":" + filter + ":" + ["buildings-owner","buildings-town","buildings-kind"].map(id=>document.getElementById(id)?.value).join("/") + ":" + Math.floor(s.power.reserve) + ":" + Math.floor(world.supply) + ":" + world.pop
    + ":" + items.map(item => [item.id, Evolution.buildingAccess(sim, world, item, "repair"), Evolution.buildingAccess(sim, world, item, "demolish"), Evolution.buildingOwner(item), Evolution.nationLabel(sim,Evolution.buildingOwner(item)), item.health, item.status.label, item.status.detail, item.station?.mode,
      item.station?.draw.toFixed(1), item.station?.load.toFixed(1), item.plant?.output.toFixed(1)].join("/")).join("|");
  if (list.dataset.signature === signature) return;
  const focused = document.activeElement;
  const focusId = focused?.closest?.("[data-building-id]")?.dataset.buildingId;
  const focusAction = focused?.dataset.buildingAction;
  const rows = [];
  for (const item of visibleItems) {
    const row = document.createElement("article"); row.className = "building-row";
    row.dataset.buildingId = item.id; row.dataset.tone = item.status.tone;
    const heading = document.createElement("div"); heading.className = "building-heading";
    const name = document.createElement("strong"); name.textContent = item.name;
    const status = document.createElement("span"); status.className = "building-state"; status.textContent = item.status.label;
    heading.append(name, status); row.append(heading);
    const meta = document.createElement("p"); meta.className = "building-meta";
    const coordinates = "Pole " + (item.tile % Biosphere.W + 1) + ", " + (Math.floor(item.tile / Biosphere.W) + 1);
    const power = item.station ? " · Odběr " + decimal.format(item.station.draw) + " / " + decimal.format(item.station.load) + " E/s"
      : item.plant ? " · Výroba " + decimal.format(item.plant.output) + " E/s" : "";
    meta.textContent = "Kondice " + item.health + " % · " + coordinates + power
      + (item.town ? " · " + Evolution.nationLabel(sim,Evolution.buildingOwner(item)) : ""); row.append(meta);
    const meter = document.createElement("progress"); meter.max = 100; meter.value = item.health; meter.setAttribute("aria-label", "Kondice " + item.name); row.append(meter);
    const detail = document.createElement("p"); detail.className = "building-detail";
    detail.textContent = item.status.detail + (item.cause && item.health < 100 && !item.status.detail.includes(item.cause) ? " Poslední poškození: " + item.cause + "." : ""); row.append(detail);
    const actions = document.createElement("div"); actions.className = "building-actions";
    const action = (label, key, callback) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "btn";
      button.textContent = label; button.dataset.buildingAction = key; button.addEventListener("click", callback); actions.append(button); return button;
    };
    action("Najít na mapě", "find", () => showBuilding(world, item));
    if (item.station && item.health > 0 && !item.station.destroyed && !item.abandoned) action('Ovládání', 'operate', () => GameInterface.openEquipment(world,item));
    const successor = item.ancient ? Evolution.ruinSuccessor(sim, world, item) : null;
    const quote = Biosphere.repairQuote(s, item, world.supply, world.pop || s.robotBases?.length || 0, successor);
    const repair = action((item.abandoned && item.health > 0 ? "Převzít a zprovoznit" : item.ancient ? "Převzít a obnovit" : item.health <= 0 ? "Obnovit" : "Opravit") + (quote.energy ? " · " + quote.energy + " E / " + quote.supplies + " M" : ""), "repair", () => {
      const issue = Orbit.manageBuilding(sim, world, item.id, "repair");
      put(ui["buildings-feedback"], issue || item.name + ": oprava dokončena.");
      ui["buildings-feedback"].dataset.tone = issue ? "bad" : ""; updateUI();
    });
    const repairIssue = Evolution.buildingAccess(sim, world, item, "repair") || quote.error;
    repair.disabled = Boolean(repairIssue); repair.title = repairIssue || "Odečte místní energii a materiál; rezerva pro osadu zůstane zachovaná.";
    const demolish = action(item.health <= 0 ? "Odstranit trosky" : "Zbourat", "demolish", () => {
      pendingDemolition = { worldId: world.id, id: item.id };
      put(ui["building-confirm-title"], item.health <= 0 ? "Odstranit trosky?" : "Zbourat stavbu?");
      put(ui["building-confirm-text"], world.name + " · " + item.name + "." + (item.station ? " Ztratíš místní ohřev nebo chlazení." : item.plant ? " Elektrárna přestane vyrábět energii." : ""));
      ui["building-confirm"].showModal();
    });
    const demolishIssue = Evolution.buildingAccess(sim, world, item, "demolish");
    demolish.classList.add("danger"); demolish.disabled = sim.over || Boolean(demolishIssue);
    if (demolishIssue) demolish.title = demolishIssue;
    row.append(actions); rows.push(row);
  }
  if (!rows.length) { const empty = document.createElement("p"); empty.className = "economy-hint"; empty.textContent = "V tomto filtru zatím nejsou žádné stavby."; rows.push(empty); }
  list.replaceChildren(...rows); list.dataset.signature = signature;
  if (focusId && focusAction) {
    const row = [...list.querySelectorAll("[data-building-id]")].find(row => row.dataset.buildingId === focusId);
    [...row?.querySelectorAll("[data-building-action]") ?? []].find(button => button.dataset.buildingAction === focusAction)?.focus({ preventScroll: true });
  }
}

ui["buildings-open"].addEventListener("click", () => {
  setWorldOptions(ui["buildings-world"], sim.worlds.filter(world => world.biosphere), (viewedPlanet() ?? selectedSurface())?.id);
  put(ui["buildings-feedback"], ""); ui["buildings-list"].dataset.signature = "";
  ui["buildings-dialog"].showModal(); updateUI();
});
for (const id of ["buildings-world", "buildings-filter"]) ui[id].addEventListener("change", () => { put(ui["buildings-feedback"], ""); updateBuildingsUI(); });
ui["building-demolish"].addEventListener("click", () => {
  const target = pendingDemolition;
  if (!target) return;
  const world = sim.worlds.find(world => world.id === target.worldId);
  const issue = Orbit.manageBuilding(sim, world, target.id, "demolish");
  ui["building-confirm"].close("removed");
  put(ui["buildings-feedback"], issue || "Stavba byla odstraněna."); updateUI();
});
ui["building-confirm"].addEventListener("close", () => { pendingDemolition = null; });
ui["station-pick"].addEventListener("change", updateUI);
ui["world-previous"].addEventListener("click", () => browseWorld(-1));
ui["world-next"].addEventListener("click", () => browseWorld(1));
ui["map-planet-previous"].addEventListener("click", () => browseMapContext(-1));
ui["map-planet-next"].addEventListener("click", () => browseMapContext(1));
ui["map-context-list"].addEventListener("click", event => {
  const button = event.target.closest("[data-map-choice]");
  if (!button || galaxyBusy) return;
  const id = Number(button.dataset.mapChoice);
  if (mapNavigationKind === "galaxy") {
    selectGalaxySystem(id);
    setMapPicker(false, true);
  } else if (mapNavigationKind === "orbit") {
    const world = sim.worlds.find(world => world.id === id);
    if (world) { selected = world.id; setMapPicker(false, true); updateUI(); }
  } else if (mapNavigationKind === "surface") {
    GameInterface.selectMapCivilization(id);
    setMapPicker(false, true);
  }
});
ui["map-planets-toggle"].addEventListener("click", () => setMapPicker(ui["map-planet-picker"].hidden || mapPickerContent === "civilizations", true));
document.getElementById("map-civilizations-toggle").addEventListener("click", () =>
  setMapPicker(ui["map-planet-picker"].hidden || mapPickerContent !== "civilizations", true, "civilizations"));
document.getElementById("map-civilization-previous").addEventListener("click", () => GameInterface.browseMapCivilization(-1));
document.getElementById("map-civilization-next").addEventListener("click", () => GameInterface.browseMapCivilization(1));
ui["map-planets-close"].addEventListener("click", () => setMapPicker(false, true));
ui["world-list"].addEventListener("keydown", e => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
  e.preventDefault(); e.stopPropagation();
  if (!ui["map-planet-picker"].hidden && sim.worlds.length) {
    const worlds = orderedWorlds(), current = worlds.findIndex(world => cards.get(world.id)?.row.contains(e.target));
    const count = worlds.length;
    const next = e.key === "Home" ? 0 : e.key === "End" ? count - 1
      : (Math.max(0, current) + (e.key === "ArrowLeft" ? -1 : 1) + count) % count;
    cards.get(worlds[next].id)?.node.focus();
    return;
  }
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") browseWorld(e.key === "ArrowLeft" ? -1 : 1, true);
  else selectWorld(e.key === "Home" ? orderedWorlds()[0] : orderedWorlds().at(-1), true);
});

async function restoreLocal() {
  try {
    const record = await saveSlotRead();
    if (!record) { feedback("V tomto prohlížeči zatím není uložená pozice.", true); return false; }
    applyRecord(record);
    feedback("Soustava byla obnovena. Čas je pozastaven.");
    return true;
  } catch (err) {
    feedback("Obnovení se nezdařilo: " + (err.message ?? err), true);
    return false;
  }
}
ui["storage-open"].addEventListener("click", () => {
  put(ui["storage-message"], "Uložená pozice obsahuje celou rozehranou galaxii.");
  ui["storage-dialog"].showModal();
  updateStatus();
});
ui["storage-dialog"].addEventListener("close", updateStatus);
ui["save-local"].addEventListener("click", async () => {
  try {
    await saveSlotWrite(await saveRecord());
    feedback("Pozice byla uložena do tohoto prohlížeče.");
  } catch (err) { feedback("Lokální uložení selhalo. Použij Exportovat soubor: " + (err.message ?? err), true); }
});
ui["load-local"].addEventListener("click", () => restoreLocal());
function typedReplacer(key, value) {
  if (key === "neighbors" && Array.isArray(value)) return undefined;
  if (key === "climateSupport") return undefined;
  if (ArrayBuffer.isView(value)) return { __type: value.constructor.name, data: Array.from(value) };
  return value;
}
function typedReviver(key, value) {
  if (!value || !value.__type || !Array.isArray(value.data)) return value;
  const types = { Float32Array, Uint8Array, Uint16Array, Int16Array, Float64Array, Int32Array, Uint32Array };
  const Type = types[value.__type];
  if (!Type) throw new Error("Neznámý typ dat v uložené mapě.");
  return new Type(value.data);
}
ui["export-save"].addEventListener("click", async () => {
  try {
    const blob = new Blob([JSON.stringify(await saveRecord(), typedReplacer)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "CosmoEvolve-zaloha-" + yearAt(sim.time) + ".json";
    document.body.append(link);
    link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1500);
    feedback("Záloha byla připravena ke stažení (" + Math.round(blob.size / 1024) + " kB).");
  } catch (err) { feedback("Export selhal: " + (err.message ?? err), true); }
});
ui["import-save"].addEventListener("click", () => ui["save-file"].click());
ui["save-file"].addEventListener("change", async () => {
  const file = ui["save-file"].files[0];
  if (!file) return;
  try {
    if (file.size > 256 * 1024 * 1024) throw new Error("Soubor je příliš velký.");
    const record = JSON.parse(await file.text(), typedReviver);
    applyRecord(record);
    feedback("Soustava byla načtena ze souboru. Čas je pozastaven.");
  } catch (err) { feedback("Import selhal: " + (err.message ?? err), true); }
  finally { ui["save-file"].value = ""; }
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !modalOpen() && !ui["map-planet-picker"].hidden) {
    e.preventDefault();
    setMapPicker(false, true);
    return;
  }
  if (modalOpen() || sim.over || galaxyBusy || e.repeat || e.metaKey || e.ctrlKey || e.altKey
    || e.target.closest?.("input, select, textarea")) return;
  if (e.key.toLowerCase() === "p") ui.pause.click();
  if (["1", "2", "3"].includes(e.key)) setRate([1, 4, 12][Number(e.key) - 1]);
});
document.addEventListener("visibilitychange", () => {
  lastFrame = 0;
  accumulator = 0;
  if (document.hidden) {
    clearAim();
    launchMode = null;
    clearWeatherAim();
  }
});

drawWordmark();
for (const id of ["year", "population"]) ui[id].setAttribute("aria-live", "off");
resize();
new ResizeObserver(resize).observe(ui.field);
updateUI();
queueGameFrame();
