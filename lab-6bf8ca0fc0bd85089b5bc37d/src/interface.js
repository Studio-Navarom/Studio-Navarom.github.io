"use strict";
// Surface command deck. Simulation rules and prices stay in Evolution / Space.
const GameInterface = (() => {
  const E = Evolution, B = Biosphere, P = Patronage, $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmt = value => number.format(Math.floor(value ?? 0));
  const climateCode = c => {
    const type = c?.profile ?? sim.nations?.[c?.civilization]?.profile ?? "temperate";
    return E.PROFILES[type] ? type : "temperate";
  };
  const climateBadge = c => '<span class="climate-badge" data-climate="' + climateCode(c) + '" title="' + esc(E.profile(climateCode(c)).hint + ' Nároky obyvatel této osady; změna správy je nemění.') + '">' + esc(E.profile(climateCode(c)).climate) + '</span>';
  const habitatHTML = (world, c) => { const status = E.environment(world.biosphere, c); return '<span class="habitat-state" data-tone="' + status.tone + '"><strong>' + status.label + '</strong> · ' + esc(status.reason) + '</span>'; };

  const state = () => sim.interface ??= { tab: null, scope: "planet", equipment: "", allBuildings: false };
  const iconPaths = { food: '<path d="M5 2v5M3 3v3c0 2 4 2 4 0V3M5 8v6M11 2c-3 2-3 6 0 6v6M11 2v6"/>', energy: '<path d="M9 1 3 9h5l-1 6 6-9H8z"/>', stock: '<path d="m2 5 6-3 6 3v7l-6 3-6-3zM2 5l6 3 6-3M8 8v7"/>', faith: '<path d="m8 1 2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>', science: '<path d="M6 1h4M7 1v5l-4 6c-1 2 1 3 2 3h6c1 0 3-1 2-3L9 6V1M5 10h6"/>', knowledge: '<circle cx="7" cy="7" r="5"/><path d="m11 11 4 4M4 7h6M7 4v6"/>' };
  const icon = key => '<svg class="resource-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">' + iconPaths[key] + '</svg>';
  const mount = (parent, html, position = "beforeend") => { parent.insertAdjacentHTML(position, html); };
  function btn(label, action, extra = "") { return '<button class="btn" type="button" data-deck-action="' + action + '" ' + extra + '>' + label + '</button>'; }
  function progress(value, label = "Dokončení", inline = false) {
    const tag = inline ? "span" : "div";
    const percent = Math.round(value);
    return '<' + tag + ' class="visible-progress"><progress max="100" value="' + percent
      + '" aria-label="' + esc(label) + '"></progress><strong>' + percent + ' %</strong></' + tag + '>';
  }
  function task(c, world = sim.worlds.find(p => p.biosphere?.communities?.includes(c))) {
    const s = world.biosphere;
    const town = s.towns[c.town];
    if (s.battle?.sides.includes(c.town + 1))
      return {value: 0, title: "Probíhá boj", phase: "Výsledek určí střet jednotek na mapě."};
    const landing = s.boats.find(boat => boat.kind === "landing" && boat.from === c.town);
    if (landing) return {value: 0, title: "Námořní výprava", phase: landing.returning ? "Jednotky se vracejí." : "Jednotky míří k cílové osadě."};
    const refuge = s.expeditions.find(trip => trip.fleeing && trip.from === c.town + 1);
    if (refuge) return {value: 0, title: "Výprava hledá útočiště", phase: refuge.refuge || "Osadníci jsou na cestě."};
    const hazard = E.centerHazard(s, c) || E.orderHazard(s, c);
    if (!c.job) {
      if (hazard) return {value: 0, title: "Omezené pokyny", phase: hazard + (town.hazardSince !== undefined ? ". Osada hledá bezpečné místo k přesunu." : ".")};
      return {value: 0, title: "Bez probíhající akce", phase: "Osada pokračuje v běžném životě."};
    }
    const job = c.job;
    const status=E.jobProgress(s,c);
    const source = job.playerOrdered === true ? "Pokyn hráče" : job.playerOrdered === false ? "Rozhodnutí osady" : "";
    return {value:status.percent,title:status.label,phase:[source, status.detail].filter(Boolean).join(" · "), isJob:true};
  }
  const settlementActionLabels = { gather: "Obživa", materials: "Připravit materiál", guard: "Výcvik jednotek", faith: "Obřad",
    energy: "Rozvíjet energetiku", mine: "Těžba", science: "Věda · +3 VB" };
  function settlementActions(world, community) {
    const actions = ["gather", "materials", "guard", "faith"];
    if (E.civEra(sim, world, community.civilization) >= 5) actions.push("energy", "mine", "science");
    return actions.filter(action => action !== "faith" || E.science(sim, community.civilization).faith < 10);
  }
  function actionBenefit(world,c,action){
    const modern=E.civEra(sim,world,c.civilization)>=5 && E.science(sim,c.civilization).faith>=10;
    const hints={gather:'Lov nebo sběr přiveze místní jídlo až po návratu. Množství závisí na dostupné potravě a volném skladu; výprava se může vrátit bez úlovku.',guard:'Vyškolí až 2 jednotky. Kapacita závisí na obyvatelích a dlouhodobé obživě.',faith:'Přidá 1 bod společné víry celé civilizaci, nejvýše do 10.',mine:'Otevře 1 důl. Napájený důl přidává až 0,55 M/s a při práci spotřebuje až 0,15 J/s ze své osady. Při nedostatku jídla nebo plném skladu práci omezí.',science:'Každá pracující osada odebírá '+decimal.format(E.scienceOrderDraw(sim,c.civilization))+' E/s po dobu až 20 s skutečné práce. Dokončení přidá 3 VB a trvale +0,15 E/s odběru vědeckého zázemí na planetě; nedostatek proudu práci pozastaví.',gift:modern?'Po doručení +15 důvěry a dočasný obchodní bonus +0,1 M/s při 1× oběma stranám. Při důvěře 60 může dojít k připojení.':'Doručí dar jídla jiné osadě. Přidá '+(c.faith>=10?18:12)+' důvěry; při 60 se osada může mírově připojit.'};
    return hints[action]??P.ACTIONS[action]?.note??'';
  }
  // Robotické základny jsou skutečné předmostí civilizace, nikoli osady s obyvateli.
  // Do seznamu správy přidáváme jejich UI záznamy bez vytváření fiktivních obyvatel či komunit.
  function colonyAt(world, community) {
    if (!world?.biosphere || !community) return null;
    const s=world.biosphere, origin=B.position(community.home);
    const distance=tile=>{const p=B.position(tile),dx=Math.abs(origin.x-p.x);return Math.hypot(Math.min(dx,B.W-dx),origin.y-p.y);};
    return (s.robotBases??[]).filter(base=>base.civilization===community.civilization)
      .sort((a,b)=>distance(a.tile)-distance(b.tile)).find(base=>distance(base.tile)<=12)??null;
  }
  const baseLabel = base => base.colonyCore ? "Kolonie" : "Robotická základna";
  function baseState(world, base, status = Space.baseGuardStatus(sim, world, base)) {
    if (Space.basePreparationActive(sim, world, base)) return sim.ships.some(ship => ship.missionType === "colony"
      && ship.destination === world.id && ship.civilization === base.civilization && ship.people > 0)
      ? "Kolonisté na cestě · příprava chráněna" : "Robotická příprava · čeká na kolonisty";
    if (base.occupation) return "Hrozí převzetí";
    if (status.nearby.length) return "Zázemí místní osady";
    if (base.everSettled || base.colonyCore) return "Kolonie bez osadníků";
    return "Robotická základna bez zdrojové civilizace";
  }
  function robotBasesInScope(planets = state().scope === "all" ? sim.worlds : sim.worlds.filter(w => w.id === selected)) {
    return planets.flatMap(world => (world.biosphere?.robotBases ?? []).map(base => ({
      id: colonyBaseRef(world, base), world, base,
      faction: "civil:" + base.civilization,
      factionName: E.nationLabel(sim, base.civilization)
    })).filter(item=>!(world.biosphere.communities??[]).some(c=>c.active && c.civilization===item.base.civilization && colonyAt(world,c)===item.base)));
  }
  function colonyBaseRef(world,base) {
    return world.id + ':base:' + base.tile;
  }
  function robotEquipment(item) {
    const s = item.world.biosphere, origin = B.position(item.base.tile);
    const range = tile => {
      const other = B.position(tile), dx = Math.abs(other.x - origin.x);
      return Math.hypot(Math.min(dx, B.W - dx), other.y - origin.y);
    };
    const local = B.buildings(s).filter(b => E.buildingOwner(b) === item.base.civilization && range(b.tile) <= 12);
    const stations = local.filter(b => b.station).sort((a,b) => range(a.tile) - range(b.tile));
    return { stations, station: stations.find(b => b.health > 0 && !b.station.destroyed) ?? stations[0],
      sources: local.filter(b => b.plant && b.health > 0),
      wind: local.filter(b => b.plant?.kind === 'wind' && b.health > 0).length,
      hydro: local.filter(b => b.plant?.kind === 'hydro' && b.health > 0).length };
  }
  function selectedCity() {
    const allReal = P.catalog(sim), civic = mapNavigationKind === "civic";
    const scope = globalThis.CosmoCompass?.id() ? state().scope : civic ? "planet" : state().scope;
    if (civic && !globalThis.CosmoCompass?.id()) syncSettlementFilter();
    const real = scope === "all" ? allReal : allReal.filter(m => m.world.id === selected);
    const watched=globalThis.CosmoCompass?.id() ?? null;
    const baseWorlds = civic && !watched ? sim.worlds.filter(w => w.id === selected)
      : scope === "all" ? sim.worlds : sim.worlds.filter(w => w.id === selected);
    const all = [...real, ...robotBasesInScope(baseWorlds)];
    if (!watched && !sim.patron && patronBrowser.filter === "mine") patronBrowser.filter = "all";
    const factions = [...new Map(all.map(item => [item.faction, {
      id: item.faction,
      name: item.factionName + " · " + E.nationClimate(sim, item.base?.civilization ?? item.community?.civilization)
        + (item.faction.startsWith("realm:") ? " · " + item.world.name : "")
    }])).values()];
    if (!civic && !factions.some(f => f.id === patronBrowser.faction))
      patronBrowser.faction = all.find(item => item.id === state().citySelection)?.faction ?? factions[0]?.id ?? "";
    const entries = all.filter(item => watched ? (item.base?.civilization ?? item.community?.civilization) === watched
      : patronBrowser.filter === "all"
      || patronBrowser.filter === "mine" && (item.base?.civilization ?? item.community?.civilization) === sim.patron?.id
      || patronBrowser.filter === "faction" && item.faction === patronBrowser.faction);
    const chosen = entries.find(item => item.id === state().citySelection)
      ?? entries.find(item => item.id === patronBrowser.selected) ?? entries[0];
    state().citySelection = chosen?.id ?? "";
    if (!chosen?.community) return { all, factions, entries, selected: chosen,
      world: chosen?.world, community: null, own: [], target: null, targetRef: null };
    patronBrowser.selected = chosen.id;
    const regular = patronSelection(real);
    return { ...regular, all, factions, entries, selected: chosen,
      world: chosen.world, community: chosen.community };
  }
  function focusSettlementOnMap(world, tile, town = 0) {
    const point = B.position(tile);
    surfaceCamera = SurfaceView.pan(view, { zoom: Math.max(2.4, surfaceCamera.zoom), ...point }, 0, 0);
    buildingFocus = { worldId: world.id, tile, until: performance.now() + 7000 };
    if (town !== null) world.biosphere.selectedTown = town;
    nextGroundFrame = 0; updateCameraControls();
  }
  function focusCity(item, open = false) {
    if (!item) return;
    // Only an explicit settlement choice changes the observed civilization.
    const owner=item.base?.civilization ?? item.community?.civilization;
    const watched=globalThis.CosmoCompass?.id() ?? null;
    if (owner && watched && owner !== watched) globalThis.CosmoCompass.set(owner, false);
    state().citySelection = item.id;
    if (!item.base) patronBrowser.selected = item.id;
    if (open) showSurface(item.world, false);
    if (surfaceId !== item.world.id) { surfaceId = selected = item.world.id; surfaceCamera = SurfaceView.FIT; }
    focusSettlementOnMap(item.world, item.base?.tile ?? item.community.home,
      item.base ? 0 : item.community.town + 1);
  }
  function browseCity(direction) {
    const mapOpen = !ui["map-planet-picker"].hidden;
    const data = selectedCity(); if (!data.entries.length) return;
    const n = data.entries.indexOf(data.selected), item = data.entries[(n + direction + data.entries.length) % data.entries.length];
    if (state().cityExpanded) state().cityExpanded = item.id;
    state().citySelection = item.id;
    state().citiesPage = Math.floor(data.entries.indexOf(item) / (state().citiesPageSize || 10));
    focusCity(item, true); updateUI();
    if (mapOpen) setMapPicker(true);
  }
  function openCities(world, id) {
    if (mapNavigationKind === "civic") world ??= viewedPlanet();
    clearAim(); clearWeatherAim(); launchMode = null; state().tab = "cities";
    const explicit = all.find(m => m.world === world && m.community.id === id);
    if (explicit && globalThis.CosmoCompass?.id() && explicit.community.civilization !== globalThis.CosmoCompass.id())
      globalThis.CosmoCompass.set(explicit.community.civilization, false); // explicit click is a deliberate change, never an automatic one
    if (explicit) { state().cityExpanded = state().citySelection = explicit.id; (state().civicOverview ??= {})[world.id] = explicit.community.civilization; patronBrowser.selected = explicit.id; if (explicit.community.civilization !== sim.patron?.id) patronBrowser.filter = "all"; }
    else if (sim.patron) patronBrowser.filter = "mine";
    const watched=globalThis.CosmoCompass?.id() ?? null;
    const outpost = !explicit && world?.biosphere?.robotBases?.map(base => ({
      id: colonyBaseRef(world, base), world, base
    })).find(item => item.base.civilization === (watched ?? sim.patron?.id));
    const local = world ? all.filter(m => m.world === world) : all;
    const eligible = m => watched ? m.community.civilization === watched
      : !sim.patron || m.community.civilization === sim.patron.id;
    // Never auto-select a different nation merely because the watched one is absent.
    const choice = explicit ?? outpost ?? local.find(m => m.world.id === selected && eligible(m))
      ?? local.find(eligible) ?? (watched ? undefined : local[0]);
    if (choice) {
      state().citySelection = choice.id;
      (state().civicOverview ??= {})[choice.world.id] = choice.community?.civilization ?? choice.base?.civilization;
      focusCity(choice, true);
      const entries = selectedCity().entries;
      const size = state().citiesPageSize || 10;
      state().citiesPage = Math.max(0, Math.floor(entries.findIndex(item => item.id === choice.id) / size));
    }
    updateUI();
    document.querySelector('[data-hud-mode="civic"]')?.click();
    if (mapNavigationKind === "civic") setMapPicker(true, true);
    else $("command-deck").scrollIntoView?.({ block: "nearest" });
  }
  const legacyShowBuilding = showBuilding;
  showBuilding = (world, b) => { state().tab = null; legacyShowBuilding(world, b); };
  function openEquipment(world, b) {
    state().equipmentFilter = b.station?.civilization === sim.patron?.id ? 'mine' : 'all';
    state().equipmentScope = 'planet'; state().equipment = world.id + '|' + b.id;
    focusEquipment({world,building:b,ref:state().equipment}); updateUI();
  }
  const detail = openPatronage;
  openPatronage = openCities;
  mount(ui["economy-strip"], '<button class="btn" type="button" id="quick-technologies">Technologie a teraformery ↗</button>');
  $("quick-technologies").addEventListener("click", () => {
    const world = selectedSurface(); if (!world) return; state().tab = "technology"; showSurface(world, false); renderDock();
    $("technology-deck").scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  });
  const oldBrowse = browsePatron;
  browsePatron = (kind, direction) => { oldBrowse(kind, direction); if (kind !== "target") focusCity(patronSelection().selected); updateUI(); };
  const oldModal = modalOpen;
  modalOpen = () => oldModal() || $("release-confirm").open || $('patron-picker-dialog')?.open || $('rename-planet-dialog')?.open || $('rename-entity-dialog')?.open;

  mount(ui["world-navigation"], '<nav class="deck-tabs" aria-label="Hlavní správa">' + btn("Planety", "tab:worlds", 'aria-controls="world-list"') + btn("Spravovat osady", "tab:cities", 'aria-controls="command-deck"') + btn("Technologie", "tab:technology", 'aria-controls="technology-deck"') + btn("Budovy", "tab:buildings", 'aria-controls="buildings-dialog"') + btn('Výzkum a logistika<small id="research-summary"></small>', "tab:economy", 'aria-controls="economy-dialog"') + '</nav>', "afterbegin");
  mount(ui["world-navigation"], '<section id="command-deck" hidden><div class="deck-filter"><div class="segmented" aria-label="Filtr měst">' + btn("Moje", "filter:mine") + btn("Vše", "filter:all") + btn("Civilizace", "filter:faction") + '</div><label class="compact-check"><input id="city-all-worlds" type="checkbox"> Všechny planety</label><button class="btn" type="button" id="city-detail">Otevřít detail ↗</button></div><div id="city-faction" class="deck-stepper" hidden>' + btn("‹", "faction:-1", 'aria-label="Předchozí civilizace"') + '<strong id="city-faction-name"></strong>' + btn("›", "faction:1", 'aria-label="Další civilizace"') + '</div><div class="deck-stepper">' + btn("‹", "city:-1", 'aria-label="Předchozí město"') + '<strong id="city-count"></strong>' + btn("›", "city:1", 'aria-label="Další město"') + '</div><div class="city-cards" id="city-cards"></div><article class="city-command" id="city-command"></article><p class="deck-feedback" id="deck-feedback" role="status"></p></section><section id="technology-deck" hidden><div class="deck-filter"><div class="segmented" aria-label="Filtr zařízení">' + btn('Moje','techfilter:mine') + btn('Vše','techfilter:all') + btn('Civilizace','techfilter:faction') + '</div><label class="compact-check"><input id="technology-all-worlds" type="checkbox"> Všechny planety</label>' + btn("Všechny budovy", "buildings") + '</div><div id="technology-faction" class="deck-stepper" hidden>' + btn('‹','techfaction:-1','aria-label="Předchozí civilizace"') + '<strong id="technology-faction-name"></strong>' + btn('›','techfaction:1','aria-label="Další civilizace"') + '</div><div class="deck-stepper">' + btn('‹','techbrowse:-1','aria-label="Předchozí zařízení"') + '<strong id="technology-count"></strong>' + btn('›','techbrowse:1','aria-label="Další zařízení"') + '</div><div class="city-cards" id="technology-cards"></div><article class="city-command" id="technology-command"></article><p id="technology-feedback" role="status"></p></section>');
  mount($("technology-deck"), '<h3 class="equipment-title">Technologie · ovládání prostředí</h3><p class="equipment-intro">Tady přepínáš režimy teraformerů. Elektrárny, doly, továrny a údržba všech staveb jsou v Budovách. Nové znalosti odemykáš ve Výzkumu a logistice.</p>', 'afterbegin');
  ui["station-controls"].classList.add("quick-station"); $("technology-deck").append(ui["station-controls"]);
  mount(ui["station-controls"], '<div class="quick-device-title" id="quick-station-name"></div>', "afterbegin");
  mount(ui["surface-tools"], '<button class="btn" type="button" id="windplant-tool" data-weather="windplant">' + icon("energy") + ' Větrník · 18 M</button>', "afterbegin");
  ui['surface-tools'].querySelector('.weather-tools').append($('windplant-tool'));
  mount(ui['hydro-tool'], '<details id="specialized-equipment"><summary>Další zařízení</summary></details>', 'afterend'); $('specialized-equipment').append(ui['hydro-tool']);
  weatherHints.windplant = "Po společné víře 10/10 stojí větrná elektrárna 18 místních M. Stav u vlastní kolonie nebo robotické základny. Výkon závisí na větru.";
  weatherHints.station = "Teraformer stojí 70 místních E + 24 M, ponechá rezervu 20 E. Nejprve zajisti větrné elektrárny. Ohřev a chlazení působí na všechny obyvatele v dosahu.";
  pointTools.windplant = (world, p) => buildEconomyTool(world, "windplant", p);
  $("windplant-tool").addEventListener("click", () => { weatherTool = "windplant"; setSurfacePan(false); put(ui["weather-tip"], weatherHints.windplant); updateUI(); });
  mount(ui["patron-strip"], '<button class="btn quiet" type="button" id="patron-release">Vzdát se patronátu</button>');
  mount(document.body, '<dialog id="release-confirm"><h2>Ukončit patronát?</h2><p>Osady, sklady, znalosti i výpravy zůstanou této civilizaci. Bude pokračovat samostatně. Ty můžeš pozorovat svět, později se vrátit nebo přijmout jiný národ.</p><div class="dialog-actions"><button class="btn" type="button" id="release-cancel">Zůstat</button><button class="btn danger" type="button" id="release-now">Vzdát se patronátu</button></div></dialog>');
  $("patron-release").addEventListener("click", () => $("release-confirm").showModal());
  $("release-cancel").addEventListener("click", () => $("release-confirm").close());
  $("release-now").addEventListener("click", () => { E.release(sim); $("release-confirm").close(); patronBrowser.filter = "all"; updateUI(); });
  $("city-all-worlds").addEventListener("change", e => { state().scope = e.target.checked ? "all" : "planet"; patronBrowser.selected = ""; updateUI(); });
  mount($("command-deck"), '<div class="city-civic-controls" id="city-civic-controls" hidden><label>Civilizace <select id="city-nation"></select></label></div>', "afterbegin");
  $("city-nation").addEventListener("change", () => {
    selectCivilization(Number($("city-nation").value.split(":")[1]));
  });
  $("technology-all-worlds").addEventListener("change", e => { state().equipmentScope = e.target.checked ? "all" : "planet"; state().technologyPage = 0; state().equipment = ""; focusEquipment(equipmentData().selected); updateUI(); });
  $("city-detail").addEventListener("click", () => {
    const d = selectedCity();
    if (d.selected?.base) { openBaseTechnology(d.selected); return; }
    if (d.community) { focusCity(d.selected, true); detail(d.world, d.community.id); }
  });
  $("command-deck").addEventListener("keydown", e => { if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.target.matches("input,select,button")) { e.preventDefault(); e.stopPropagation(); browseCity(e.key === "ArrowLeft" ? -1 : 1); } });
  // Browsing the dock must not also change planets through the parent listener.
  $("command-deck").addEventListener("keydown", e => e.stopPropagation());
  $("technology-deck").tabIndex = 0;
  $("technology-deck").addEventListener("keydown", e => { e.stopPropagation(); if (["ArrowLeft","ArrowRight"].includes(e.key) && !e.target.matches("input,select,button")) { e.preventDefault(); browseEquipment(e.key === "ArrowLeft" ? -1 : 1); } });
  ui["patron-renaming"].open = true;
  mount(ui["patron-task"], '<span></span>');
  mount(ui["patron-task"], '<div id="detail-progress"></div>', "afterend");
  mount(ui["patron-description"], '<div id="detail-habitat" role="status"></div><div id="detail-wallet" class="local-wallet"></div>', "afterend");
  for (const key of ['materials','energy','mine','science']) {
    mount(ui['patron-dialog'].querySelector('.patron-orders'), '<button class="btn" type="button" data-patron-action="' + key + '"><strong>' + (key === 'energy' ? 'Rozvíjet energetiku' : P.ACTIONS[key].name) + '</strong><span>' + P.ACTIONS[key].note + '</span><b class="action-price"></b><small></small></button>');
    const button = ui['patron-dialog'].querySelector('[data-patron-action="' + key + '"]');
    button.addEventListener('click', () => {
      const d = patronSelection(); if (!d.community) return;
      const r = patronBrowser.batch ? P.batchOrder(sim, d.own, key, d.targetRef) : null;
      put(ui['patron-feedback'], r ? r.started + ' osad · ' + E.priceLabel(r) + ' · Přeskočeno ' + r.skipped : P.order(sim, d.world, d.community.id, key) || 'Pokyn přijat. Pokračuje při běhu času.'); updateUI();
    });
  }


  function act(action) {
    const data = selectedCity(); if (!data.community) return;
    let message;
    if (patronBrowser.batch) {
      const r = P.batchOrder(sim, data.own, action, data.targetRef);
      message = r.started + " osad přijalo pokyn · " + E.priceLabel(r) + " · Přeskočeno " + r.skipped + ". " + Object.keys(r.reasons).join(" ");
    } else message = P.order(sim, data.world, data.community.id, action, data.target?.id) || "Pokyn přijat. Výprava pokračuje při běhu času.";
    put($("deck-feedback"), message); updateUI();
  }
  let armyFeedback;
  function foreignTarget(world, source) {
    const choice = state().foreignTarget;
    if (choice?.world !== world.id || choice.source !== source.id) return null;
    return world.biosphere.communities.find(target => target.id === choice.id
      && target.active && target.civilization !== source.civilization) ?? null;
  }
  function foreignControls(world, c) {
    const s = world.biosphere;
    const targets = s.communities.filter(target => target.active && target.civilization !== c.civilization);
    const chosen = foreignTarget(world, c);
    const goal = targets.find(target => target.id === c.diplomaticGoal?.id && target.civilization === c.diplomaticGoal?.civilization);
    const restriction = P.armyBlock(sim, world, c, chosen);
    const feedback = armyFeedback?.state === sim && armyFeedback.world === world.id
      && armyFeedback.source === c.id && armyFeedback.target === chosen?.id ? armyFeedback.message : "";
    return '<div class="building-batch"><h4>Vztahy a armáda</h4><label class="economy-field" for="city-foreign-target">Cílová osada'
      + '<select id="city-foreign-target"><option value="">Vyber osadu na této planetě</option>'
      + targets.map(target => '<option value="' + target.id + '"' + (chosen === target ? ' selected' : '') + '>'
        + esc(P.name(target)) + '</option>').join("") + '</select></label>'
      + '<p class="economy-hint">' + esc(chosen ? "Důvěra k vybrané osadě " + P.relation(s, c, chosen)
        : targets.length ? "Bez výběru běží přirozené vztahy a konflikty." : "Na planetě není dostupná cizí osada.") + '</p>'
      + '<div class="city-heading-actions">' + btn("Zlepšovat vztahy", "diplomacy:set", chosen ? "" : "disabled")
      + btn("Vyslat jednotky", "army:send", restriction ? 'disabled aria-describedby="city-army-status"' : 'aria-describedby="city-army-status"')
      + (goal ? btn("Vrátit automatický výběr", "diplomacy:clear") : "") + '</div>'
      + '<p class="economy-hint" id="city-army-status" role="status">' + esc(feedback || restriction || "Jednotky zaútočí na vybranou osadu.") + '</p>'
      + '<p class="economy-hint">' + esc(goal ? "Diplomatický cíl · " + P.name(goal) : "Diplomacie vybírá vhodné sousedy sama.") + '</p></div>';
  }
  function handleDeck(e) {
    const action = e.target.closest("[data-deck-action]")?.dataset.deckAction; if (!action) return;
    const [kind, value] = action.split(":");
    if (kind === "tab" && value === "worlds") {
      // Independent in-place panel. Keep the map's own planet picker unchanged.
      state().tab = state().tab === "worlds" ? null : "worlds";
      updateUI();
      return;
    }
    if (kind === "tab" && value === "cities") {
      // M1 fix01: always open the local Hlavní správa disclosure. The map
      // picker has its own synchronized view and never steals this element.
      state().tab = state().tab === "cities" ? null : "cities";
      updateUI();
      return;
    }
    if (kind === "tab") {
      const opening = state().tab !== value;
      state().tab = opening ? value : null;
      if (opening && value === "technology" && selectedSurface()) showSurface(selectedSurface(), false);
      updateUI();
    }
    if (kind === "filter") { state().citiesPage = 0; state().cityExpanded = ""; state().citySelection = ""; patronBrowser.filter = value; patronBrowser.selected = ""; const d = selectedCity(); focusCity(d.selected, true); updateUI(); }
    if (kind === "faction") { state().citiesPage = 0; state().cityExpanded = ""; const d = selectedCity(), n = d.factions.findIndex(f => f.id === patronBrowser.faction); patronBrowser.faction = d.factions[(n + Number(value) + d.factions.length) % d.factions.length]?.id ?? ""; state().citySelection = ""; patronBrowser.selected = ""; focusCity(selectedCity().selected, true); updateUI(); }
    if (kind === "city") browseCity(Number(value));
    if (kind === "cityrename") {
      renameSettlementItem(selectedCity().entries.find(item => item.id === action.slice(kind.length + 1)));
      return;
    }
    if (kind === "cityexpand" || kind === "cityfind") {
      const ref = action.slice(kind.length + 1);
      const item = selectedCity().entries.find(entry => entry.id === ref);
      if (!item) return;
      state().citySelection = ref;
      if (!item.base) patronBrowser.selected = ref;
      if (kind === "cityexpand") {
        state().cityExpanded = state().cityExpanded === ref ? "" : ref;
        // Expanding details does not change the camera or scroll position.
      }
      else {
        if (state().cityExpanded !== ref) state().cityExpanded = "";
        focusCity(item, true);
      }
      updateUI();
      if (kind === "cityfind") ui["surface-map"].scrollIntoView?.({block: "center"});
    }
    if (kind === "basetech") {
      const item = selectedCity().entries.find(entry => entry.id === action.slice(kind.length + 1));
      if (item?.base) openBaseTechnology(item);
    }
    if (['colonytech','baseexpand','baseguard','basewithdraw'].includes(kind)) {
      const ref = action.slice(kind.length + 1);
      const item = selectedCity().entries.find(entry=>entry.id===ref);
      const world = item?.world, base = item?.base ?? (item?.community && colonyAt(world,item.community));
      if (!base) return;
      if (kind === 'colonytech') openBaseTechnology({world,base,id:colonyBaseRef(world,base)});
      else {
        const issue = kind === 'baseexpand' ? Space.expandBase(sim,world,base)
          : Space.baseGuard(sim,world,base,kind === 'basewithdraw');
        put($('deck-feedback'),issue || (kind === 'baseexpand' ? 'Infrastruktura kolonie rozšířena.' : 'Rozmístění jednotek aktualizováno.'));
        updateUI();
      }
    }
    if (kind === "basebuildings") {
      const item = selectedCity().entries.find(entry => entry.id === action.slice(kind.length + 1));
      if (item?.base) openBaseBuildings(item);
    }
    if (kind === "action") act(value);
    if (kind === "diplomacy" || kind === "army") {
      const { world, community } = selectedCity();
      if (!community) return;
      const target = foreignTarget(world, community)?.id;
      const issue = kind === "army" ? P.orderArmy(sim, world, community.id, target)
        : P.setDiplomaticGoal(sim, world, community.id, value === "clear" ? null : target);
      const done = kind === "army" ? "Armáda vyrazila." : value === "clear"
        ? "Diplomatický cíl opět vybírá osada." : "Cíl je nastavený. Osada sama naplánuje výměnu.";
      if (kind === "army") {
        armyFeedback = { state: sim, world: world.id, source: community.id, target, message: issue || done };
        put($("deck-feedback"), "");
      } else put($("deck-feedback"), issue || done);
      updateUI();
    }
    if (kind === "target") { browsePatron("target", Number(value)); renderDock(); }
    if (kind === "rename") { const d = selectedCity(); if (d.community) { detail(d.world, d.community.id); ui["patron-renaming"].open = true; ui["patron-settlement-name"].focus(); } }
    if (kind === "adopt") { const d = selectedCity(); if (d.community) { detail(d.world, d.community.id); ui["patron-choose"].click(); } }
    if (kind === "buildings") ui["buildings-open"].click();
    if (kind === 'citybuildings') {const d=selectedCity();if(d.community){selected=d.world.id;state().tab='buildings';state().buildingWorldContext=d.world.id;setWorldOptions(ui['buildings-world'],sim.worlds.filter(w=>w.biosphere),d.world.id);updateUI();$('buildings-owner').value=String(d.community.civilization);$('buildings-town').value=String(d.community.town);ui['buildings-filter'].value='all';$('buildings-kind').value='all';state().buildingPage=0;updateUI();}}

    if (kind === "equipment") { const d = equipmentData(); focusEquipment(d.entries.find(x => x.ref === action.slice(10))); updateUI(); }
    if (kind === "techbrowse") browseEquipment(Number(value));
    if (kind === "techfilter") { state().technologyPage = 0; state().equipmentFilter = value; state().equipment = ""; const d = equipmentData(); focusEquipment(d.selected); updateUI(); }
    if (kind === "techfaction") { const d = equipmentData(), n = d.factions.findIndex(x => x.id === state().equipmentFaction); state().equipmentFaction = d.factions[(n + Number(value) + d.factions.length) % d.factions.length]?.id; state().equipment = ""; focusEquipment(equipmentData().selected); updateUI(); }
    if (kind === "techfind") { focusEquipment(equipmentData().selected); updateUI(); }
    if (kind === 'techmaintenance') {
      const item=equipmentData().selected;if(!item)return;
      state().tab='buildings';state().buildingWorldContext=item.world.id;
      setWorldOptions(ui['buildings-world'],sim.worlds.filter(w=>w.biosphere),item.world.id);updateUI();
      $('buildings-owner').value=String(item.owner);$('buildings-town').value='all';
      ui['buildings-filter'].value='all';$('buildings-kind').value=String(B.STATION_TILE);state().buildingPage=0;updateUI();
    }
    if (kind === "station") browseEquipment(Number(value));
  }
  ui["world-navigation"].addEventListener("click", handleDeck);
  $("command-deck").addEventListener("click", event => {
    if (!ui["world-navigation"].contains($("command-deck"))) handleDeck(event);
  });
  $("command-deck").addEventListener("change", e => {
    if (e.target.id === "city-batch") patronBrowser.batch = e.target.checked;
    else if (e.target.id === "city-foreign-target") {
      armyFeedback = undefined;
      const { world, community } = selectedCity();
      if (!community) return;
      state().foreignTarget = { world: world.id, source: community.id, id: Number(e.target.value) };
    } else return;
    renderDock();
  });
  function sCityDevelopment(world,c) {
    const s=world.biosphere,t=s.towns[c.town],plots=s.plots.filter(i=>s.plotTown[i]===c.town+1&&s.urban[i]>=1&&s.urban[i]<=5&&s.damage[i]<.62).length;
    return plots+' funkčních polí · '+(B.townEra(s,t)>=6?'Moderní město':B.townEra(s,t)>=5?'Město':'Osada')+(E.cityDevelopment(world,c.civilization).ready?' · Civilizace má zázemí pro kolonizaci':' · Zázemí pro kolonizaci se rozvíjí');
  }
  function navalStatus(world, c) {
    const s = world.biosphere, boat = s.boats.find(b => b.kind === "landing" && (b.from === c.town || b.to === c.town));
    if (!boat) return "";
    const name = index => s.towns[index]?.settlementName || "Osada " + (index + 1);
    const phase = boat.fighting ? "Boj po vylodění" : boat.blocked ? "Loď čeká na průjezd"
      : boat.returning ? "Návrat posádky" : "Výsadek na cestě";
    const route = boat.returning ? name(boat.to) + " → " + name(boat.from) : name(boat.from) + " → " + name(boat.to);
    return phase + " · " + route + " · Posádka " + boat.guards;
  }
  function defenseHTML(world, c) {
    const upkeep = P.guardUpkeep(sim, c), capacity = P.guardCapacity(sim, world, c);
    const naval = navalStatus(world, c);
    return '<div class="settlement-units"><span>Jednotky osady</span><strong>' + fmt(c.guards)
      + '</strong><small>Udržitelná kapacita ' + fmt(capacity) + ' · ' + decimal.format(upkeep) + ' J/s při 1×</small>'
      + (naval ? '<small>' + esc(naval) + '</small>' : '') + '</div>';
  }
  const supplyRateFormat = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2, signDisplay: "exceptZero" });
  const supplyRateText = g => 'Běžná bilance ' + supplyRateFormat.format(g?.baseSupplyRate ?? 0)
    + ' · Těžba ' + supplyRateFormat.format(g?.mineRate ?? 0) + ' M/s';
  function walletHTML(world, c) {
    const own = c?.civilization === sim.patron?.id, g = E.grid(sim, world, c?.civilization), total = E.wallet(sim, c?.civilization);
    return '<div><span>' + icon("food") + ' Místní jídlo</span><strong>' + fmt(c?.food) + ' J</strong></div><div><span>' + icon("energy") + ' Energie na ' + esc(world.name) + '</span><strong>' + fmt(g?.reserve) + ' E</strong><small>' + decimal.format(g?.output ?? 0) + ' výroba / ' + decimal.format(g?.demand ?? 0) + ' odběr E/s</small></div><div><span>' + icon("stock") + ' Materiál na ' + esc(world.name) + '</span><strong>' + fmt(g?.supplies) + ' M</strong><small>' + supplyRateText(g) + '</small></div><div><span>' + icon("science") + ' Celá civilizace</span><strong>' + fmt(total.energy) + ' E · ' + fmt(total.supplies) + ' M</strong><small>' + fmt(total.points) + ' VB' + (total.faith < 10 ? ' · Víra ' + fmt(total.faith) + '/10' : '') + (!own ? ' · Cizí sklady' : '') + '</small></div>';
  }
  function replaceSafe(el, html) {
    if (el.dataset.html === html) return;
    const template = document.createElement("template");
    template.innerHTML = html;
    reconcileContent(el, template.content);
    el.dataset.html = html;
  }
  function reconcileContent(parent, desired) {
    const identity = node => node.nodeType === 1
      ? node.tagName + "/" + (node.id || node.dataset.cityRef || node.dataset.deckAction || node.dataset.equipmentRef || node.dataset.warningRow || "")
      : String(node.nodeType);
    const preserved = parent.id === "city-cards" ? $("city-command") : null;
    let cursor = parent.firstChild;
    for (const incoming of [...desired.childNodes]) {
      if (preserved && cursor === preserved) cursor = cursor.nextSibling;
      const key = identity(incoming);
      let match = cursor;
      while (match && (match === preserved || identity(match) !== key)) match = match.nextSibling;
      if (!match) {
        parent.insertBefore(incoming.cloneNode(true), cursor);
        continue;
      }
      if (match !== cursor) parent.insertBefore(match, cursor);
      if (match.nodeType !== 1) {
        if (match.nodeValue !== incoming.nodeValue) match.nodeValue = incoming.nodeValue;
      } else {
        for (const attribute of [...match.attributes]) {
          if (!incoming.hasAttribute(attribute.name) && !(match.tagName === "DETAILS" && attribute.name === "open"))
            match.removeAttribute(attribute.name);
        }
        for (const attribute of incoming.attributes) {
          if (match.getAttribute(attribute.name) !== attribute.value) match.setAttribute(attribute.name, attribute.value);
        }
        reconcileContent(match, incoming);
        if (match.tagName === "INPUT" && ["checkbox", "radio"].includes(match.type)) match.checked = incoming.checked;
        else if (["INPUT", "TEXTAREA", "SELECT"].includes(match.tagName) && match !== document.activeElement
          && match.value !== incoming.value) match.value = incoming.value;
      }
      cursor = match.nextSibling;
    }
    while (cursor) {
      const next = cursor.nextSibling;
      if (cursor !== preserved) cursor.remove();
      cursor = next;
    }
  }
  // M1 fix01 — independent, synchronized view of the existing city management.
  // There is ONE command handler and ONE state; copying the UI does not copy the
  // simulation, ownership or event listeners. The original always stays in Hlavní správa.
  const mapCityMirror = document.createElement("section");
  mapCityMirror.id = "map-command-deck";
  mapCityMirror.className = "map-city-mirror";
  mapCityMirror.setAttribute("aria-label", "Spravovat osady – horní roletka");
  mapCityMirror.hidden = true;
  $("map-management-content").append(mapCityMirror);
  let mapCityMirrorHTML = "", mapCityMirrorAt = 0;
  function renderMapCityMirror(force = false) {
    const active = !ui["map-planet-picker"].hidden && mapPickerContent === "civic"
      && mapNavigationKind === "civic" && state().tab === "cities";
    mapCityMirror.hidden = !active;
    if (!active) return;
    const source = $("command-deck");
    const now = performance.now();
    if (!force && now - mapCityMirrorAt < 180) return;
    mapCityMirrorAt = now;
    const markup = source.innerHTML;
    if (markup === mapCityMirrorHTML) return;
    mapCityMirrorHTML = markup;
    const copy = source.cloneNode(true);
    copy.removeAttribute("id");
    for (const node of copy.querySelectorAll("[id]")) {
      node.dataset.mirrorOriginId = node.id;
      node.id = "map-mirror-" + node.id;
    }
    // The upper picker has a civilization selector, the lower panel retains
    // the ordinary filters and can always be used independently.
    const controls = copy.querySelector("#map-mirror-city-civic-controls");
    if (controls) controls.hidden = false;
    const filters = copy.querySelector(".deck-filter");
    if (filters) filters.hidden = true;
    const scroll = mapCityMirror.scrollTop;
    mapCityMirror.replaceChildren(...copy.childNodes);
    mapCityMirror.scrollTop = scroll;
  }
  mapCityMirror.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    // Reuse the same validated action, including patronage permissions.
    const origin = button.dataset.mirrorOriginId;
    if (origin && $(origin)) $(origin).click();
    else if (button.dataset.deckAction) handleDeck({target:button});
    renderMapCityMirror(true);
  });
  mapCityMirror.addEventListener("change", event => {
    const input = event.target.closest("input,select,textarea");
    const original = input?.dataset.mirrorOriginId && $(input.dataset.mirrorOriginId);
    if (!original) return;
    if (input.type === "checkbox" || input.type === "radio") original.checked = input.checked;
    else original.value = input.value;
    original.dispatchEvent(new Event("change", {bubbles:true}));
    renderMapCityMirror(true);
  });
  mapCityMirror.addEventListener("keydown", event => event.stopPropagation());

  function renderDock() {
    const mode = state().tab, p = selectedSurface();
    if(mode === 'buildings' && p && state().buildingWorldContext !== p.id){
      setWorldOptions(ui['buildings-world'],sim.worlds.filter(w=>w.biosphere),p.id);state().buildingWorldContext=p.id;state().buildingPage=0;
      const town=$('buildings-town');if(town)town.value='all';
    }
    ui["buildings-dialog"].hidden = mode !== "buildings"; ui["buildings-dialog"].toggleAttribute("open", mode === "buildings");
    const deck = $("command-deck"), inlineCities = mapNavigationKind === "civic";
    // The live action panel permanently belongs to Hlavní správa.
    // The map owns only a lightweight synchronized presentation.
    deck.hidden = mode !== "cities";
    $("city-civic-controls").hidden = !inlineCities;
    deck.querySelector(".deck-filter").hidden = inlineCities;
    $("technology-deck").hidden = mode !== "technology";
    const onSurface = Boolean(viewedPlanet());
    const worldList = ui["world-list"], wasHidden = worldList.hidden;
    const showWorldList = mode === "worlds";
    worldList.hidden = !showWorldList;
    if (showWorldList && wasHidden) {
      updateCards();
      revealWorldCard();
    }
    ui["world-navigation"].setAttribute("aria-label", onSurface ? "Hlavní správa" : "Planety a hlavní správa");
    ui["world-navigation"].querySelector(".world-navigation-head").hidden = true;
    for (const tab of document.querySelectorAll('[data-deck-action^="tab:"]')) {
      if (tab.dataset.deckAction === "tab:worlds") tab.hidden = false;
      const active = !tab.hidden && (tab.dataset.deckAction === "tab:worlds" ? showWorldList
        : tab.dataset.deckAction === "tab:cities" ? !deck.hidden : tab.dataset.deckAction === "tab:" + mode);
      tab.setAttribute("aria-pressed", String(active)); tab.setAttribute("aria-expanded", String(active));
    }
    $("patron-release").hidden = !sim.patron;
    if (!deck.hidden) {
      const cityContext = state().scope === "all" ? "all" : selected;
      if (state().cityWorldContext !== cityContext) {
        state().citiesPage = 0;
        state().cityWorldContext = cityContext;
      }
      const d = selectedCity(), c = d.community; $("city-all-worlds").checked = state().scope === "all";
      if (inlineCities) renderCityNation(d);
      for (const button of document.querySelectorAll('[data-deck-action^="filter:"]')) { button.setAttribute("aria-pressed", String(button.dataset.deckAction === "filter:" + patronBrowser.filter)); button.disabled = button.dataset.deckAction === "filter:mine" && !sim.patron; }
      $("city-faction").hidden = inlineCities || patronBrowser.filter !== "faction";
      put($("city-faction-name"), d.factions.find(f => f.id === patronBrowser.faction)?.name ?? "Žádná civilizace");
      put($("city-count"), d.entries.length ? (d.entries.indexOf(d.selected) + 1) + " / " + d.entries.length + " · " + (state().scope === "all" ? "Všechny světy" : p?.name ?? "Vyber planetu") : "Žádné osady ani robotické základny v tomto filtru");
      $("city-detail").disabled = !d.selected;
      put($("city-detail"), d.selected?.base ? 'Technologie základny ↗' : 'Otevřít detail ↗');
      const list = $("city-cards");
      const panel = $("city-command");
      const page = listPage("cities", d.entries.length, "osad");
      const visible = d.entries.slice(page.start, page.end);
      const expanded = visible.find(item => item === d.selected && item.id === state().cityExpanded);
      const rows = visible.map(m => {
        if (m.base) {
          const g = E.grid(sim, m.world, m.base.civilization), equipment = robotEquipment(m);
          const station = equipment.station, ready = station?.health > 0 && !station.station.destroyed;
          const status = ready ? station.status.label : station ? 'Teraformer mimo provoz' : 'Bez teraformeru';
          const power = g ? decimal.format(g.output) + ' výroba / ' + decimal.format(g.demand) + ' odběr E/s' : 'Síť nezjištěna';
          const open = m === expanded, name = baseLabel(m.base);
          const danger = Space.baseGuardStatus(sim,m.world,m.base);
          return '<article class="city-card city-row robot-base-row" data-city-ref="' + esc(m.id) + '" data-selected="' + (m === d.selected) + '">'
            + '<span class="city-row-name"><strong>' + name + '</strong><span class="city-civilization">' + esc(E.nationLabel(sim,m.base.civilization)) + '</span><span class="robot-base-type">Bez obyvatel · automatický provoz · obrana ' + danger.guards + '</span></span>'
            + '<span class="city-row-population"><small class="city-location">' + esc(m.world.name) + '</small><strong>' + esc(baseState(m.world, m.base, danger)) + '</strong><span class="city-stock">' + fmt(g?.reserve) + ' E · ' + fmt(g?.supplies) + ' M</span><span class="ownership-label">' + (m.base.civilization === sim.patron?.id ? 'Tvoje základna' : 'Cizí základna') + '</span></span>'
            + '<span class="city-row-environment"><span class="habitat-state" data-tone="' + (g?.output < g?.demand ? 'warn' : '') + '"><strong>Místní síť</strong> · ' + esc(power) + '</span></span>'
            + '<span class="city-row-task"><b>' + esc(status) + '</b><small class="task-phase">' + equipment.wind + ' větrných · ' + equipment.hydro + ' vodních zdrojů · ' + equipment.stations.length + ' teraformerů</small></span>'
            + '<div class="city-row-actions">' + btn('Technologie ↗', 'basetech:' + esc(m.id))
            + btn('Najít na mapě', 'cityfind:' + esc(m.id))
            + btn(open ? 'Sbalit ▴' : 'Podrobnosti ▾', 'cityexpand:' + esc(m.id), 'aria-expanded="' + open + '" aria-controls="city-command"') + '</div></article>';
        }
        const c = m.community, t = task(c, m.world), colony = colonyAt(m.world,c);
        const g = m.world.biosphere.power.grids?.[c.civilization];
        const isOpen = m === expanded;
        const mission=navalStatus(m.world,c),naval=mission?'<small class="task-phase">'+esc(mission)+'</small>':'';
        return '<article class="city-card city-row" data-city-ref="'+esc(m.id)+'" data-selected="'+(m===d.selected)+'"><span class="city-row-name"><strong>'+esc(c.name||'Osada '+c.id)+'</strong><span class="city-civilization">'+esc(c.civilizationName)+'</span>'+(colony?'<span class="robot-base-type">Obydlená kolonie · automatická základna</span>':'')+climateBadge(c)+'</span><span class="city-row-population"><small class="city-location">'+esc(m.world.name)+'</small><strong>'+fmt(c.people)+' obyvatel</strong><span class="city-stock">'+fmt(c.food)+' J · '+fmt(g?.reserve)+' E · '+fmt(g?.supplies)+' M</span><span class="ownership-label">'+(c.civilization===sim.patron?.id?'Tvoje osada':'Cizí osada')+'</span></span><span class="city-row-environment">'+habitatHTML(m.world,c)+'</span><span class="city-row-task"><b>'+esc(t.title)+'</b>'+(c.job?progress(t.value):'')+'<small class="task-phase">'+esc(t.phase)+'</small>'+naval+'</span><div class="city-row-actions">'
          + btn('Najít na mapě', 'cityfind:' + esc(m.id))
          + (c.civilization === sim.patron?.id ? btn('✎', 'cityrename:' + esc(m.id), 'aria-label="Přejmenovat osadu"') : '')
          + (colony ? btn('Technologie ↗','colonytech:' + esc(m.id)) : '')
          + btn(isOpen ? 'Sbalit ▴' : 'Podrobnosti ▾', 'cityexpand:' + esc(m.id), 'aria-expanded="' + isOpen + '" aria-controls="city-command"')
          + '</div></article>';
      }).join("");
      if (list.dataset.html !== rows) {
        replaceSafe(list, rows);
      }
      panel.hidden = !expanded;
      if (expanded?.base) {
        const item = expanded, owner = item.base.civilization, g = E.grid(sim, item.world, owner);
        const equipment = robotEquipment(item), station = equipment.station;
        const threat = Space.baseGuardStatus(sim,item.world,item.base);
        const powered = g && g.output >= g.demand;
        const status = station ? station.status.label + ' · kondice ' + station.health + ' %' : 'Teraformer není dostupný';
        const rows = '<div class="local-wallet">'
          + '<div><span>' + icon('energy') + ' Místní energie</span><strong>' + fmt(g?.reserve) + ' E</strong><small>' + decimal.format(g?.output ?? 0) + ' výroba / ' + decimal.format(g?.demand ?? 0) + ' odběr E/s</small></div>'
          + '<div><span>' + icon('stock') + ' Místní materiál</span><strong>' + fmt(g?.supplies) + ' M</strong><small>' + supplyRateText(g) + '</small></div>'
          + '<div><span>Technické vybavení</span><strong>' + equipment.wind + ' větrných · ' + equipment.hydro + ' vodních · ' + equipment.stations.length + ' teraformerů</strong><small>' + esc(status) + '</small></div>'
          + '</div>';
        replaceSafe(panel, '<div class="city-command-heading"><div><h3>' + baseLabel(item.base) + ' · ' + esc(item.world.name) + '</h3><span>' + esc(E.nationLabel(sim,owner)) + ' · ' + esc(baseState(item.world, item.base, threat)) + ' · ' + esc(E.profile(item.base.profile).climate) + '</span></div>'
          + '<div class="city-heading-actions">' + btn('Technologie základny ↗','basetech:' + esc(item.id))
          + btn('Budovy a údržba ↗','basebuildings:' + esc(item.id)) + btn('Najít na mapě','cityfind:' + esc(item.id)) + '</div></div>'
          + '<p class="base-explanation">Robotické předmostí může připravovat planetu ještě před příletem obyvatel. Její elektrárny a teraformery pracují podle skutečných zdrojů a stavu sítě. Rozvoj určí staveniště a výchozí režim automaticky; režim můžeš ručně změnit v Technologiích.</p>'
          + '<p class="base-explanation">Obrana: ' + threat.guards + ' obránců.'
          + (Space.basePreparationActive(sim,item.world,item.base)
            ? ' <strong>Robotická příprava je chráněna před převzetím až do úspěšného přistání prvních kolonistů.</strong>'
            : threat.foreigners.length && !threat.guards ? ' <strong>Pozor: blízký cizí kmen může nechráněnou základnu převzít.</strong>' : '') + '</p>'
          + (owner === sim.patron?.id ? '<div class="city-heading-actions">' + btn('Rozšířit infrastrukturu automaticky','baseexpand:' + esc(item.id)) + btn('Přidělit jednotku','baseguard:' + esc(item.id)) + (item.base.guards ? btn('Stáhnout jednotku','basewithdraw:' + esc(item.id)) : '') + '</div>' : '')
          + '<p class="equipment-condition" data-tone="' + (powered ? '' : 'warn') + '">' + (powered ? 'Výroba pokrývá aktuální odběr.' : 'Pozor: odběr převyšuje místní výrobu.') + '</p>' + rows);
        const row = [...list.children].find(node => node.dataset.cityRef === item.id);
        if (row?.nextElementSibling !== panel) row?.after(panel);
      } else if (expanded) {
        const row = [...list.children].find(node => node.dataset.cityRef === expanded.id);
        const own = c.civilization === sim.patron?.id, t = task(c, d.world);
        const colony = colonyAt(d.world,c);
        const actions = settlementActions(d.world, c);
        const cards = own ? actions.map(action => {
          const r = patronBrowser.batch && P.batchOrder(sim, d.own, action, d.targetRef, true);
          const energy = !r && action === 'energy' ? E.actionQuote(sim, d.world, c, action) : null;
          const cost = energy ? energy.cost : E.actionCosts(sim, d.world, c, action);
          const issue = r ? !r.started ? Object.keys(r.reasons)[0] : "" : energy ? energy.issue : P.block(sim, d.world, c, action, d.target);
          const costLabel = action === 'science' ? '12 M + ' + decimal.format(E.scienceOrderDraw(sim,c.civilization)) + ' E/s; pak +0,15 E/s trvale' : cost ? E.priceLabel(cost) : '—';
          return '<button class="btn quick-action" type="button" data-deck-action="action:' + action + '"' + (issue ? ' disabled' : '') + ' title="' + esc(issue || P.ACTIONS[action].note) + '"><strong>' + settlementActionLabels[action] + '</strong><span class="action-benefit">'+esc(actionBenefit(d.world,c,action))+'</span><b>' + esc(r ? r.started ? r.started + ' osad · ' + E.priceLabel(r) : 'Žádná dostupná osada · Nic se neodečte' : costLabel) + '</b><small>' + esc(issue || (r ? 'Přeskočeno ' + r.skipped : 'Zaplatí místní sklad')) + '</small></button>';
        }).join("") : '';
        replaceSafe($("city-command"), '<div class="city-command-heading"><div><h3>' + esc(c.name || "Osada " + c.id) + '</h3><span>' + esc(c.civilizationName + ' · ' + E.profile(climateCode(c)).climate) + '</span></div>' + (own ? '<div class="city-heading-actions">'+btn('Budovy města','citybuildings')+(colony ? btn('Technologie kolonie ↗','colonytech:' + esc(expanded.id))+btn('Rozšířit infrastrukturu','baseexpand:' + esc(expanded.id))+btn('Přidělit jednotku','baseguard:' + esc(expanded.id)) : '')+btn('Přejmenovat ✎', 'rename')+'</div>' : !sim.patron ? btn('Přijmout patronát', 'adopt') : '<span>Cizí civilizace</span>') + '</div>' + habitatHTML(d.world, c) + '<p class="city-development">Rozvoj: ' + sCityDevelopment(d.world,c) + '</p>'+'<div class="local-wallet">' + defenseHTML(d.world, c) + walletHTML(d.world, c) + '</div><div class="task-banner"><strong>' + esc(t.title) + '</strong>' + (c.job ? progress(t.value) : '') + '<span>' + esc(t.phase) + '</span></div>' + (own ? foreignControls(d.world,c) + '<label class="compact-check batch-choice"><input type="checkbox" id="city-batch"' + (patronBrowser.batch ? ' checked' : '') + '> Stejný pokyn všem vlastním osadám ve filtru (' + d.own.length + ')</label><div class="quick-actions">' + cards + '</div>' : ''));
        const foreignSelect = $("city-foreign-target");
        if (own && foreignSelect && foreignSelect !== document.activeElement)
          foreignSelect.value = foreignTarget(d.world, c)?.id ?? "";
        if (row.nextElementSibling !== panel) row.after(panel);
      }
    }
    if (mode === "technology") renderTechnology(p);
    if (mode === "buildings") updateBuildingsUI();
    ui["economy-dialog"].hidden=mode!=="economy";ui["economy-dialog"].toggleAttribute("open",mode==="economy");if(mode==="economy")updateEconomyUI();
  }
  function equipmentData() {
    const settings = state();
    settings.equipmentFilter ??= sim.patron ? "mine" : "all";
    if (!sim.patron && settings.equipmentFilter === "mine") settings.equipmentFilter = "all";
    const planets = settings.equipmentScope === "all" ? sim.worlds : sim.worlds.filter(w => w.id === selected);
    const all = planets.filter(w => w.biosphere).flatMap(world => B.buildings(world.biosphere)
      .filter(b => b.station && b.health > 0 && !b.station.destroyed)
      .map(building => ({ world, building, owner: E.buildingOwner(building), ref: world.id + "|" + building.id })));
    const factions = [...new Set(all.map(x => x.owner))].map(id => ({ id, name: id ? E.nationLabel(sim,id) : 'Bez vlastníka' }));
    if (!factions.some(x => x.id === settings.equipmentFaction)) settings.equipmentFaction = factions[0]?.id;
    const watched=globalThis.CosmoCompass?.id() ?? null;
    const entries = all.filter(x => watched ? x.owner === watched
      : settings.equipmentFilter === 'mine' ? x.owner === sim.patron?.id : settings.equipmentFilter === 'faction' ? x.owner === settings.equipmentFaction : true);
    const chosen = entries.find(x => x.ref === settings.equipment) ?? entries.find(x => x.building.station && x.owner === sim.patron?.id) ?? entries[0];
    if (chosen) settings.equipment = chosen.ref;
    return { entries, factions, selected: chosen };
  }
  function focusEquipment(item) {
    if (!item) return;
    state().equipment = item.ref; state().tab = 'technology';
    legacyShowBuilding(item.world, item.building);
    const index = equipmentData().entries.findIndex(entry => entry.ref === item.ref);
    state().technologyPage = Math.max(0, Math.floor(index / (state().technologyPageSize || 10)));
    $("technology-cards").querySelector('[data-equipment-ref="' + item.ref + '"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
  function browseEquipment(direction) {
    const d = equipmentData(); if (!d.entries.length) return;
    focusEquipment(d.entries[(d.entries.indexOf(d.selected) + direction + d.entries.length) % d.entries.length]); updateUI();
  }
  function renderTechnology(p) {
    const d = equipmentData(), item = d.selected, b = item?.building, own = item?.owner === sim.patron?.id;
    $("technology-all-worlds").checked = state().equipmentScope === 'all';
    for (const button of document.querySelectorAll('[data-deck-action^="techfilter:"]')) { button.setAttribute('aria-pressed', String(button.dataset.deckAction === 'techfilter:' + state().equipmentFilter)); button.disabled = button.dataset.deckAction === 'techfilter:mine' && !sim.patron; }
    $("technology-faction").hidden = state().equipmentFilter !== 'faction';
    put($("technology-faction-name"), d.factions.find(f => f.id === state().equipmentFaction)?.name ?? 'Žádná civilizace');
    put($("technology-count"), item ? (d.entries.indexOf(item) + 1) + ' / ' + d.entries.length + ' · ' + item.world.name + ' · ' + b.name : 'Žádná zařízení v tomto filtru · ' + (p?.name ?? 'Vyber planetu'));
    for (const button of document.querySelectorAll('[data-deck-action^="techbrowse:"]')) button.disabled = d.entries.length < 2;
    const page = listPage("technology", d.entries.length, "zařízení");
    replaceSafe($("technology-cards"), d.entries.length ? d.entries.slice(page.start, page.end).map(x => '<button class="equipment-row" type="button" data-deck-action="equipment:' + esc(x.ref) + '" data-equipment-ref="' + esc(x.ref) + '" aria-pressed="' + (x.ref === item?.ref) + '"><span><strong>' + esc(x.building.name) + '</strong><small>' + esc(x.world.name + ' · ' + E.nationLabel(sim,x.owner)) + '</small></span><span><b>' + esc(x.building.status.label) + '</b><small>' + esc(B.STATION_MODES[x.building.station.mode] ?? 'Vypnuto') + ' · ' + decimal.format(x.building.station.draw) + ' / ' + decimal.format(x.building.station.load) + ' E/s</small></span><span class="equipment-open">' + (x.owner === sim.patron?.id ? 'Ovládat' : 'Prohlédnout') + '</span></button>').join('') : '<p>Žádné použitelné teraformery v tomto filtru. Po Regulaci klimatu můžeš u vlastní osady vybrat Teraformer a umístit ho na mapu. Poškozené stavby najdeš v Budovách.</p>');
    const inPage = item && d.entries.slice(page.start, page.end).includes(item);
    ui["station-controls"].hidden = !inPage || !own || !b?.station || item.world.id !== selectedSurface()?.id;
    if (!inPage) { replaceSafe($("technology-command"), ''); return; }
    const g = E.grid(sim, item.world, item.owner);
    replaceSafe($("technology-command"), '<div class="city-command-heading"><div><h3>' + esc(b.name) + '</h3><span>' + esc(item.world.name + ' · ' + E.nationLabel(sim,item.owner)) + '</span></div><div class="city-heading-actions">' + btn('Najít na mapě','techfind') + btn('Údržba v Budovách','techmaintenance') + '</div></div><p class="equipment-condition">' + esc(b.status.label) + ' · Kondice ' + b.health + ' %</p><p>' + esc(b.status.detail) + '</p><p class="equipment-purpose">Ohřev a chlazení mění teplotu; vysoušení a zvlhčení přesouvají vodu v dosahu. Účinek působí na všechny obyvatele oblasti. Výchozí režim volí kolonie, ale můžeš ho změnit ručně.</p>' + (!own ? '<p>Cizí zařízení můžeš pozorovat; ovládá jej jeho civilizace.</p>' : ''));
    if (own && b.station) {
      const pick = b.station; preferredStation = pick.id; stationPickerWorld = item.world.id;
      ui["station-pick"].replaceChildren(...item.world.biosphere.stations.filter(s => s.tile >= 0 && s.civilization === sim.patron.id).map(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = 'Teraformer ' + s.id; return o; }));
      ui["station-pick"].value = String(pick.id);
      put($("quick-station-name"), pick.id + ' · ' + item.world.name + ' · ' + b.status.label);
      put(ui["station-status"], decimal.format(pick.draw) + ' / ' + decimal.format(pick.load) + ' E/s · Baterie ' + fmt(pick.battery) + ' E · Místní sklad ' + fmt(g?.reserve) + ' E / ' + fmt(g?.supplies) + ' M');
      for (const button of stationModes) { button.disabled = pick.destroyed || item.world.biosphere.damage[pick.tile] >= .78; button.setAttribute('aria-pressed',String(button.dataset.stationMode === pick.mode)); }
    }
  }
  function openBaseTechnology(item) {
    if (!item?.base) return;
    // Výběr nejbližšího skutečného teraformeru (nikoli první náhodné stanice planety).
    const device = robotEquipment(item).station;
    state().citySelection = item.id;
    state().equipmentScope = 'planet';
    state().equipmentFilter = item.base.civilization === sim.patron?.id ? 'mine' : 'all';
    state().equipment = device?.health > 0 && !device.station.destroyed ? item.world.id + '|' + device.id : '';
    state().technologyPage = 0;
    state().tab = 'technology';
    showSurface(item.world, false);
    if (device?.health > 0 && !device.station.destroyed) {
      focusEquipment({world: item.world, building: device, owner: item.base.civilization,
        ref: item.world.id + '|' + device.id});
    }
    updateUI();
    $('technology-deck').scrollIntoView?.({block: 'nearest', behavior:'smooth'});
  }
  function openBaseBuildings(item) {
    if (!item?.base) return;
    state().citySelection = item.id;
    selected = item.world.id;
    state().tab = 'buildings';
    state().buildingWorldContext = item.world.id;
    setWorldOptions(ui['buildings-world'], sim.worlds.filter(w => w.biosphere), item.world.id);
    updateUI();
    $('buildings-owner').value = String(item.base.civilization);
    $('buildings-town').value = 'all';
    ui['buildings-filter'].value = 'all';
    $('buildings-kind').value = 'all';
    state().buildingPage = 0;
    updateUI();
  }
  // World creation choices are explicit; their biological clocks do not rewind the system calendar.
  const explanations = {
    evolution: { natural: 'Vývoj sleduje kalendář soustavy. V civilizační éře mladé světy dozrávají pomalu.', accelerated: 'Urychlení umožní sledovat vznik života i na později založené planetě. Nejvíce pomáhá raným etapám, u kmenů a měst postupně slábne. Kalendář se nevrací zpět.' },
    profile: { warm: E.PROFILES.warm.hint, temperate: E.PROFILES.temperate.hint, cold: E.PROFILES.cold.hint, random: 'Teplotní nároky původního života se při vypuštění vyberou náhodně. Sleduj vznikající ekosystém; přepínač pomocné zóny tento výběr nemění.' },
    age: { young: 'Při vhodných podmínkách vzniknou mikroby a postupně další život.', old: 'Začíná etapou zvěře. Podmínky na povrchu teprve rozhodnou, kde se rozvine vegetace a živočichové. Hotová města ani soběstačnost nejsou zaručené.', tribal: 'Planeta má dosaženou kmenovou éru. Osídlení vzniká podle vhodných míst a dostupné potravy; víru musí civilizace získat.', cities: 'Planeta začíná městskou érou. Osady potřebují vhodné prostředí, zdroje a další rozvoj. Technologie se zdarma neodemknou.', modern: 'Planeta má dosaženou moderní éru. Výzkum, kosmodrom i výpravy stále vyžadují znalosti, práci a prostředky.' }
  };
  const worldChoices = Object.keys(explanations).map(key => {
    const select = $("new-" + key), hint = document.createElement("small");
    hint.id = select.id + "-hint";
    hint.className = "choice-hint";
    select.setAttribute("aria-describedby", hint.id);
    select.after(hint);
    select.addEventListener("change", () => {
      E.init(sim);
      sim.worldOptions[key] = select.value;
      updateUI();
    });
    return { key, select, hint };
  });
  function renderWorldChoices() {
    const choices = worldChoices.map(({ key, select, hint }) => {
      const value = sim.worldOptions[key];
      if (select.value !== value) select.value = value;
      put(hint, explanations[key][value]);
      return select.selectedOptions[0]?.textContent ?? "";
    });
    put($("world-options-selection"), choices.join(" / "));
  }
  for (const button of document.querySelectorAll("[data-guide-profile]")) button.addEventListener("click", () => {
    sim.guideProfile = button.dataset.guideProfile;
    orbitDirty = true; updateUI();
  });
  mount(ui["orbit-tools"], '<button class="btn primary" type="button" id="missions-open"><span>Věda a výpravy ↗</span><small id="missions-access"></small></button>', "afterbegin");
  $("missions-open").addEventListener("click", () => { ui["economy-open"].click(); });
  const econPanels = ui["economy-dialog"].querySelectorAll('.economy-columns > .economy-panel');
  for (const button of researchButtons) button.hidden = true;
  const orders = ui["economy-space"].parentElement;
  mount(orders, '<div id="science-wallet" class="science-wallet"></div><button type="button" class="btn" id="science-order">Zadat městu vědu</button><div id="technology-tree"></div>', "afterbegin");
  // A stable existing button becomes part of the ordered technology list after rendering.
  // Moving it (rather than cloning/re-creating it) retains its original click listener.
  ui['economy-space'].classList.add('research-card');
  mount(ui['economy-space'], '<span class="research-toggle" id="space-toggle">Zahájit</span>');
  econPanels[0].querySelector('.economy-hint').textContent = 'Víra 10/10 jednorázově odemkne vědu a energetiku. Každá pracující osada ve Vědě odebírá 1 E/s, po Robotice 0,8 E/s; po 20 s skutečné práce přidá 3 VB a trvale zvýší odběr vědeckého zázemí o 0,15 E/s na své planetě. Při nedostatku energie se rozpracovaná věda pozastaví. Samostatný výzkum technologií zachovává vlastní cenu a průběžnou spotřebu z přebytku výroby.';
  ui["economy-space"].querySelector('.order-note').textContent = 'Místní stavba družice a kosmodromu. Potřebuje dokončený Vesmírný program a Kosmickou techniku. Odemyká průzkumné lety; kolonizace potřebuje další výzkum.';
  econPanels[1].querySelector('.economy-hint').textContent = 'Vyber zdroj a cílový svět. Dostupnou výpravu spustíš kliknutím na kartu; není nutné mířit na mapě. Robotická příprava založí kolonii, která automaticky vybere místa pro dva obnovitelné zdroje a teraformer. Rozvoj a obranu najdeš v Osadách.';
  for (const button of cargoButtons) button.hidden = true;
  mount(econPanels[1].querySelector('.economy-orders'), '<section id="colony-planning" class="building-batch"><h3>Osídlení cílového světa</h3><p id="colony-survey-summary"></p><ul id="colony-survey"></ul><label id="colony-crew-field">Kdo poletí <select id="colony-crew"></select></label><p id="colony-ready"></p><label id="colony-risk-field" class="compact-check"><input id="colony-risk" type="checkbox"> Přijímám riziko, že kolonie nepřežije oběh.</label></section><div id="mission-orders"></div><details class="advanced-flight"><summary>Pokročilé: ruční míření kolonizační lodě</summary><p>Volitelné. Běžná kolonizace odstartuje automaticky kliknutím na kartu Kolonizační loď výše.</p><button type="button" class="btn" id="colony-aim">Zamířit kolonizační loď ručně</button></details><label class="shipment-amount">Náklad zásob M<input type="number" id="shipment-amount" min="1" max="60" value="35" step="1"></label><button type="button" class="btn mission-button" id="shipment-send"><strong>Vyslat materiál</strong><b></b><small></small></button><button type="button" class="btn" id="trade-route">Pravidelná obchodní trasa</button>');
  ui["economy-reserve"].max = "99";
  mount(ui["economy-delivery-status"], '<div id="flight-summary" class="flight-summary"></div>', "afterend");
  mount(ui["economy-route-status"], '<p id="trade-route-status" class="economy-hint"></p>', "afterend");
  mount(ui["economy-from"].closest('label'), '<label id="colony-observer-field" hidden>Pozorovaná civilizace <select id="colony-observer"></select></label>', 'beforebegin');
  $('colony-observer').addEventListener('change', () => updateUI());
  mount(ui["economy-to"].closest("label"), '<label id="mission-partner-field" hidden>Civilizace pro obchod nebo výsadek <select id="mission-partner"></select></label>', "afterend");
  $("mission-partner").addEventListener("change", () => updateEconomyUI());
  function observedCivilizations() {
    return [...new Set(sim.worlds.flatMap(p => (p.biosphere?.communities ?? [])
      .filter(c => c.active && c.civilization).map(c => c.civilization)))];
  }
  function flightPlanningIssue() {
    if (sim.mode !== 'biosphere') return 'Plánování výprav je dostupné v režimu Biosféra.';
    if (sim.patron || observedCivilizations().length) return '';
    const hasRecords = sim.probes.length || sim.voyages.length || sim.expeditions.length;
    const reason = 'V soustavě zatím není civilizace, ze které by bylo možné plánovat výpravu.';
    return (hasRecords ? '' : 'Zatím tu nejsou žádné údaje o výpravách. ') + reason
      + ' Pro start sondy potřebuje civilizace dokončený kosmodrom.';
  }
  function flightsOpen() {
    return state().tab === 'economy' && state().economyTab === 'flights';
  }
  economyOptions = (_, preferred = {}) => {
    const observer = $('colony-observer'), observing = !sim.patron && state().economyTab === 'flights';
    $('colony-observer-field').hidden = !observing;
    if (observing) {
      const ids = observedCivilizations();
      selectChoices(observer, ids.length ? ids.map(id => [id, E.nationLabel(sim,id)]) : [[0,"Zatím žádná civilizace"]]);
    }
    const id = sim.patron?.id ?? (observing ? Number(observer.value) : 0);
    const choices = sim.worlds.filter(p => E.owns(sim, p, id));
    setWorldOptions(ui["economy-from"], choices, preferred.from ?? ui["economy-from"].value);
    const from = economySelection().from;
    setWorldOptions(ui["economy-to"], sim.worlds.filter(p => p.biosphere && p !== from), preferred.to ?? ui["economy-to"].value);
    setWorldOptions(ui["economy-backup"], [{ id: 0, name: 'Bez zálohy' }, ...choices.filter(p => p !== from && p.id !== Number(ui["economy-to"].value))]);
  };
  function openFlights(from, to) {
    state().tab = 'economy';
    state().economyTab = 'flights';
    economyOptions(null, {from:from?.id, to:to?.id});
    updateUI();
  }
  const flightPlan = () => ({profile:$('colony-crew').value, acceptRisk:$('colony-risk').checked, partner: Number($("mission-partner").value) || undefined});
  let crewContext, riskContext;
  $('colony-crew').addEventListener('change', () => updateUI());
  $('colony-risk').addEventListener('change', () => updateUI());
  $('colony-aim').addEventListener('click', () => {
    const {from, to} = economySelection(), plan = flightPlan();
    const issue = Space.colonyLaunchIssue(sim, from, to, sim.patron?.id, plan);
    if (issue) { economyResult(issue); updateUI(); return; }
    state().tab = null;
    showSurface(null, false);
    selected = from.id;
    launchMode = {kind:"probe", worldId:from.id, plan:{...plan, targetId:to.id}};
    ui.map.focus({preventScroll:true});
    ui.map.scrollIntoView?.({block:"center"});
    updateUI();
  });

  function renderColonyPlan(from, to, id, pool, observing) {
    const select = $('colony-crew'), context = [id, from?.id, to?.id].join('/');
    const profiles = Space.crewProfiles(from, id);
    const old = crewContext?.sim === sim && crewContext.context === context ? select.value : "";
    crewContext = {sim, context};
    const options = profiles.length === 1 ? [] : ['<option value="">Vyber skupinu</option>'];
    for (const profile of profiles) options.push('<option value="' + profile + '">' + E.profile(profile).name + '</option>');
    replaceSafe(select, options.join(''));
    select.value = profiles.length === 1 ? profiles[0] : profiles.includes(old) ? old : "";
    select.disabled = profiles.length <= 1;
    $('colony-crew-field').hidden = !profiles.length;
    const riskKey = context + '/' + select.value;
    if (riskContext?.sim !== sim || riskContext.key !== riskKey) $('colony-risk').checked = false;
    riskContext = {sim, key:riskKey};
    const discovered = Boolean(to && pool?.discoveries?.[to.id]);
    const eccentric = discovered && Number.isFinite(to.orbit.apo) && to.orbit.apo > to.orbit.peri * 1.35;
    put($('colony-survey-summary'), !to ? 'Vyber cílový svět.' : !discovered
      ? to.name + ' · Hodnocení odemkne návrat sondy se vzorkem z tohoto světa.'
      : to.name + (eccentric ? ' · Výstředná dráha.' : '') + ' · Odhad pro celý oběh podle místních podmínek a napájení.');
    const reports = discovered ? Object.keys(E.PROFILES).map(profile => [profile, Space.assessment(sim, to, id, profile)]) : [];
    replaceSafe($('colony-survey'), reports.map(([profile, report]) => '<li data-profile="' + profile + '" data-tone="'
      + (report.level === "ready" ? "good" : "warn") + '"><strong>' + E.profile(profile).name + '</strong> · '
      + (report.level === "ready" ? "Vhodné k osídlení" : report.level === "risk" ? "Rizikové osídlení" : "Přistání není možné")
      + '<small>' + esc(report.issue) + '</small></li>').join(''));
    const selectedReport = reports.find(([profile]) => profile === select.value)?.[1];
    const block = Space.block(sim, from, to, 'colony', id, flightPlan());
    const showRisk = !block && selectedReport?.level === "risk";
    $('colony-risk-field').hidden = !showRisk || observing;
    if (!showRisk) $('colony-risk').checked = false;
    const supplyIssue = observing && Space.outpostSupplyIssue(sim, to, id);
    const issue = supplyIssue || block || (showRisk && !$('colony-risk').checked ? observing ? "Civilizace čeká na vhodné podmínky." : "Potvrď rizikové osídlení." : "");
    put($('colony-ready'), (observing ? "Pozorování · " : "") + (issue || 'Výprava je připravena ke startu.'));
    $('colony-aim').disabled = Boolean(issue);
    return issue;
  }
  $("science-order").addEventListener("click", () => {
    const { from } = economySelection(), c = from?.biosphere.communities.find(c => c.active && c.civilization === sim.patron?.id && !E.actionBlock(sim, from, c, 'science'));
    economyResult(c ? E.order(sim, from, c, 'science') || 'Město pracuje na 3 VB. Postup sleduj ve správě osad; čas musí běžet.' : 'Žádné vlastní město teď nemůže připravovat vědu.');
  });
  $("technology-tree").addEventListener("click", e => { const key = e.target.closest('[data-technology]')?.dataset.technology, { from } = economySelection(); if (key && from) economyResult(E.research(sim, from, key) || 'Společný výzkum nastaven. Pokračuje při běhu času.'); });
  $("mission-orders").addEventListener("click", e => {
    const type = e.target.closest('[data-mission]')?.dataset.mission, { from, to } = economySelection();
    if (!type) return;
    const r = Space.start(sim, from, to, type, sim.patron?.id, flightPlan());
    if (!r && type === 'colony') $('colony-risk').checked = false;
    economyResult(r || 'Výprava odstartovala · ' + E.duration(sim, Orbit.flightTime(from, to)) + '.'); updateUI();
  });
  $("shipment-amount").addEventListener("input", () => updateEconomyUI());
  $("shipment-send").addEventListener("click", () => {
    const { from, to, reserve } = economySelection(), r = Space.supply(sim, from, to, $("shipment-amount").valueAsNumber, reserve);
    economyResult(r || 'Zásobovací loď odstartovala.'); updateUI();
  });
  for (const id of ['economy-route-save', 'economy-route-remove']) ui[id].addEventListener('click', e => {
    e.stopImmediatePropagation(); const { from, to, backup, reserve } = economySelection();
    if (id.endsWith('save')) economyResult(Space.route(sim, from, to, backup, $("shipment-amount").valueAsNumber, reserve) || 'Zásobovací linka nastavena.');
    else { sim.supplyRoutes = sim.supplyRoutes.filter(r => !(r.to === to?.id && r.civilization === sim.patron?.id)); economyResult('Vlastní linka zrušena. Lodě na cestě pokračují.'); }
  }, true);
  $("trade-route").addEventListener('click', () => {
    const { from, to } = economySelection(); if (!from || !to || !sim.patron) return;
    const options = flightPlan();
    const r = sim.tradeRoutes.find(r => r.from === from.id && r.to === to.id && r.civilization === sim.patron.id);
    if (r) sim.tradeRoutes = sim.tradeRoutes.filter(item => item !== r);
    else { const issue = Space.block(sim, from, to, 'trade', sim.patron.id, options); if (issue) { economyResult(issue); return; } sim.tradeRoutes.push({ from: from.id, to: to.id, civilization: sim.patron.id, partner: options.partner, next: sim.time }); }
    economyResult(r ? 'Obchodní trasa zrušena.' : 'Obchodní trasa nastavena. Každý let platí skutečnou cenu ze zdroje.');
  });
  updateEconomyUI = () => {
    E.init(sim); Space.init(sim); const choices = sim.worlds.filter(p => E.owns(sim, p));
    ui['economy-strip'].hidden = sim.mode !== 'biosphere' || !sim.worlds.length;
    put(ui['economy-goal'], sim.patron ? 'Společné technologie · místní sklady a energetické sítě' : 'Přijmi patronát pro vlastní výzkum a lety');
    if (!ui['economy-dialog'].open) return;
    economyOptions(); const { from, to, backup, reserve } = economySelection(), id = sim.patron?.id, pool = id && E.science(sim, id), g = from && E.grid(sim, from), amount = $('shipment-amount').valueAsNumber;
    const partners = [...new Set((to?.biosphere?.communities ?? []).filter(c => c.active && c.people > 0 && c.civilization !== id).map(c => c.civilization))];
    $("mission-partner-field").hidden = !id || !partners.length || state().economyTab === "research";
    selectChoices($("mission-partner"), partners.length ? partners.map(partner => [partner, E.nationLabel(sim, partner)]) : [["", "Bez cizí civilizace"]]);
    put(ui['economy-energy'], g ? fmt(g.reserve) + ' E' : '—');
    put($('economy-energy-detail'), g ? 'Výroba ' + decimal.format(g.output) + ' · Odběr ' + decimal.format(g.demand) + ' E/s · Akce věda ' + decimal.format(g.scienceDraw ?? 0) + '/' + decimal.format(g.scienceDemand ?? 0) + ' E/s' : 'Vyber zdroj.');
    put(ui['economy-stock'], g ? fmt(g.supplies) + ' M' : '—');
    put(ui['economy-science'], pool ? fmt(pool.points) + ' VB' : '—');
    const load = id ? sim.worlds.reduce((total, w) => total + (E.owns(sim, w, id) ? (E.grid(sim, w, id)?.scienceBaseLoad ?? 0) : 0), 0) : 0;
    const exactDraw = value => Number(value).toFixed(2).replace('.', ',');
    put($('economy-science-detail'), 'Trvalý odběr zázemí ' + exactDraw(load) + ' E/s celkem' + (g ? ' · zde ' + exactDraw(g.scienceBaseLoad ?? 0) + ' E/s' : ''));
    const total = E.wallet(sim); put($('science-wallet'), fmt(total.points) + ' VB · Poznání ' + fmt(total.knowledge) + ' různých světů · Celá civilizace ' + fmt(total.energy) + ' E / ' + fmt(total.supplies) + ' M');
    const active = pool?.science.active;
    put(ui['economy-research-status'], !sim.patron ? 'Vlastní projekty potřebují patronát.' : pool.faith < 10 ? 'Věda je uzamčena: společná víra ' + pool.faith + '/10.' : active ? 'Společný projekt: ' + E.TECH[active].name + ' · ' + decimal.format(g?.programDraw ?? 0) + ' E/s na zdroji.' : pool.science.manualPause ? 'Výzkum je ručně pozastavený. Výběrem technologie ho znovu spustíš.' : 'Technologii můžeš vybrat ručně. Civilizace si také sama vybírá, až splní podmínky.');
    const available = from?.biosphere.communities.some(c => c.active && c.civilization === id && !E.actionBlock(sim, from, c, 'science'));
    $('science-order').disabled = !available;
    put($('science-order'), 'Zadat městu vědu · 12 M + ' + decimal.format(E.scienceOrderDraw(sim,id)) + ' E/s → 3 VB · pak +0,15 E/s trvale');
    replaceSafe($('technology-tree'), Object.entries(E.TECH).map(([key, spec]) => {
      const issue = from ? E.researchBlock(sim, from, key) : 'Vyber vlastní zdroj.', value = pool ? pool.science.progress[key] / spec.work * 100 : 0, funded = pool?.science.funded[key];
      return '<button type="button" class="btn research-card" data-technology="' + key + '" aria-pressed="' + (active === key) + '"' + (issue && active !== key ? ' disabled' : '') + '><strong>' + spec.name + '</strong><span>' + spec.note + '</span><b>' + (funded ? 'Zahájení zaplaceno' : spec.vb + ' VB + ' + spec.energy + ' E + ' + spec.supplies + ' M') + '</b>' + progress(value, spec.name) + '<small>' + esc(active === key ? 'Zvolený výzkum · kliknutím pozastavíš. Další práce spotřebuje až ' + decimal.format((spec.work - pool.science.progress[key]) * 3.2) + ' E.' : issue || 'Připraveno. Zahájíš kliknutím.') + '</small><span class="research-toggle">'+(active===key?'Pozastavit':value>=100?'Hotovo':issue?'Uzamčeno':'Zahájit')+'</span></button>';
    }).join(''));
    // The space program is a locally financed project, between Kosmická technika and Robotika.
    // It is not a new tech prerequisite and does not spend research points.
    const robotCard = $('technology-tree').querySelector('[data-technology="robotics"]');
    $('technology-tree').insertBefore(ui['economy-space'], robotCard);
    const spaceIssue = from ? E.spaceBlock(sim, from) : 'Vyber vlastní zdroj.';
    ui['economy-space'].disabled = Boolean(spaceIssue && !g?.program.active); ui['economy-space'].setAttribute('aria-pressed', String(g?.program.active ?? false));
    put(ui['economy-space'].querySelector('.order-price'), g?.program.funded ? 'Zahájení zaplaceno · další práce z místní energie' : '60 E + 25 M · další práce až 179,2 E');
    put(ui['economy-space'].querySelector('small'), (g ? Math.floor(g.work / B.PROBE_WORK * 100) : 0) + ' % · ' + (g?.program.active ? 'Místní stavba pokračuje při běhu času.' : E.builtPort(sim, from) ? E.portStatus(sim, from) : spaceIssue || 'Kliknutím zahájíš místní program.'));
    put($('space-toggle'), g?.program.active ? 'Pozastavit' : g && g.work >= B.PROBE_WORK ? 'Hotovo' : spaceIssue ? 'Uzamčeno' : 'Zahájit');
    let bar = $('space-progress'); if (!bar) { mount(ui['economy-space'], '<div id="space-progress"></div>'); bar = $('space-progress'); } bar.innerHTML = progress(g ? g.work / B.PROBE_WORK * 100 : 0);
    const flightTab = state().economyTab === 'flights';
    const observed = flightTab && !id ? Number($('colony-observer').value) || undefined : undefined;
    const flightPool = observed ? E.science(sim, observed) : pool;
    const colonyIssue = flightTab ? renderColonyPlan(from, to, id ?? observed, flightPool, Boolean(observed)) : "";
    if (observed) $('colony-aim').disabled = true;
    replaceSafe($('mission-orders'), Object.entries(Space.MISSIONS).map(([type, spec]) => { const issue = type === 'colony' && flightTab ? colonyIssue : Space.block(sim, from, to, type, id, flightPlan()); return '<button type="button" class="btn mission-button" data-mission="' + type + '"' + (issue || !id ? ' disabled' : '') + '><strong>' + spec.name + '</strong><b>' + spec.energy + ' E + ' + spec.supplies + ' M</b><small>' + esc(issue || 'Kliknutím ihned odstartuje') + '</small></button>'; }).join(''));
    const recipient = to && (E.owns(sim, to) ? id : Space.targetOwner(sim, to)), tg = to && E.grid(sim, to, recipient);
    const inbound = to ? sim.ships.filter(s => s.destination === to.id && s.civilization === id && s.missionType === 'supply') : [], eta = from && to ? Orbit.flightTime(from, to) : 0;
    put(ui['economy-delivery-status'], to ? to.name + ' · ' + (tg ? fmt(tg.supplies) + ' místních M' : 'Bez vlastní základny') + (recipient && recipient !== id ? ' · Cizí civilizace' : '') : 'Vyber cílový svět.');
    const projected = tg ? tg.supplies + inbound.reduce((n, s) => n + s.cargo, 0) + Math.min(0, tg.supplyRate) * eta : 0;
    put($('flight-summary'), !eta ? 'Vyber zdroj a cíl.' : 'Let přibližně ' + E.duration(sim, eta) + ' (' + decimal.format(eta) + ' s při 1×) · Na cestě ' + fmt(inbound.reduce((n, s) => n + s.cargo, 0)) + ' M · Odhad před příletem ' + fmt(Math.max(0, projected)) + ' M. Rezerva zůstává ve zdroji.');
    const supplyIssue = Space.supplyBlock(sim, from, to, amount, reserve);
    $('shipment-send').disabled = Boolean(supplyIssue); put($('shipment-send').querySelector('b'), '28 E + ' + (Number.isFinite(amount) ? amount : '—') + ' M'); put($('shipment-send').querySelector('small'), supplyIssue || 'Po startu zbude ' + fmt(g.supplies - amount) + ' místních M.');
    const routeIssue = !id || !from || !to ? 'Vyber dva vlastní světy.' : !E.knows(sim, id, 'navigation') ? 'Nejprve dokonči Vesmírný program.' : !E.owns(sim, to) ? 'Zásobovací linka patří mezi vlastní světy.' : !Number.isInteger(amount) || amount < 1 || amount > 60 || !Number.isInteger(reserve) || reserve < 0 || amount + reserve > 100 ? 'Náklad 1–60 M a rezerva musí dohromady vejít do 100 M.' : '';
    ui['economy-route-save'].disabled = Boolean(routeIssue);
    ui['economy-route-remove'].disabled = !sim.supplyRoutes.some(r => r.to === to?.id && r.civilization === id);
    put(ui['economy-route-status'], routeIssue || 'Linka posílá ' + amount + ' M podle odhadované spotřeby a nákladu na cestě. Na zdroji ponechá ' + reserve + ' M a 35 E.');
    const trade = sim.tradeRoutes.find(r => r.from === from?.id && r.to === to?.id && r.civilization === id);
    const tradeIssue = Space.block(sim, from, to, 'trade', id, flightPlan());
    $('trade-route').disabled = !trade && Boolean(tradeIssue); put($('trade-route'), trade ? 'Zrušit pravidelný obchod' : 'Nastavit pravidelný obchod · 15 E + 10 M / let');
    put($('trade-route-status'), trade ? 'Pravidelný obchod je aktivní. Nový let až po návratu předchozí výpravy.' : 'Obchod vyžaduje nezápornou reputaci; výpravy zvyšují důvěru i dočasnou produkci materiálu.');
    replaceSafe(ui['economy-routes'], [...sim.supplyRoutes.filter(r => r.civilization === id).map(r => '<li>' + esc(sim.worlds.find(p => p.id === r.from)?.name ?? 'Ztracený svět') + ' → ' + esc(sim.worlds.find(p => p.id === r.to)?.name ?? 'Ztracený svět') + ' · ' + r.amount + ' M · Rezerva ' + r.reserve + (r.backup ? ' · Záloha ' + esc(sim.worlds.find(p => p.id === r.backup)?.name ?? '') : '') + '</li>')].join(''));
  };
  // Aggregate maintenance is scoped to the current planet and filter, with one shared local budget.
  mount(ui['buildings-summary'], '<section class="building-batch" id="building-batch"><label class="compact-check"><input id="building-all" type="checkbox"> Pro všechny vlastní budovy v tomto filtru · všechny stránky</label><p id="building-batch-price"></p><div class="building-actions"><button type="button" class="btn" id="building-repair-all">Obnovit / opravit všechny dostupné</button><button type="button" class="btn danger" id="building-clear-all">Odstranit všechny trosky</button></div><small id="building-batch-skipped"></small></section>', 'afterend');
  mount(ui['buildings-filter'], '<option value="ruins">Pouze trosky</option>');
  function filteredBuildings(world) {
    return buildingItems(world);
  }
  function updateBatch() {
    if (!ui['buildings-dialog'].open) return;
    const world = buildingPlanet(), items = filteredBuildings(world), ids = items.map(b => b.id), checked = $('building-all').checked;
    const repair = E.manageBuildings(sim, world, ids, 'repair', true), clear = E.manageBuildings(sim, world, ids, 'clear', true);
    put($('building-batch-price'), 'Obnovit / opravit ' + repair.count + ' staveb · Celkem ' + repair.energy + ' E + ' + repair.supplies + ' M. Odstranit ' + clear.count + ' trosek · Zdarma.');
    $('building-repair-all').disabled = !checked || !repair.count; $('building-clear-all').disabled = !checked || !clear.count;
    put($('building-batch-skipped'), 'Obnova přeskočí ' + repair.skipped + ': ' + Object.entries(repair.reasons).map(([s, n]) => n + '× ' + s).join(' '));
  }
  $('building-all').addEventListener('change', updateBatch);
  for (const [id, action] of [['building-repair-all', 'repair'], ['building-clear-all', 'clear']]) $(id).addEventListener('click', () => {
    const world = buildingPlanet(), ids = filteredBuildings(world).map(b => b.id), r = E.manageBuildings(sim, world, ids, action);
    put(ui['buildings-feedback'], (action === 'repair' ? 'Obnoveno / opraveno ' : 'Odstraněno trosek ') + r.count + ' · Cena ' + r.energy + ' E + ' + r.supplies + ' M · Přeskočeno ' + r.skipped + '. ' + Object.entries(r.reasons).map(([s, n]) => n + '× ' + s).join(' '));
    ui['buildings-list'].dataset.signature = ''; updateUI();
  });
  const oldBuildings = updateBuildingsUI;
  updateBuildingsUI = () => {
    oldBuildings(); if (!ui['buildings-dialog'].open) return;
    updateBatch();
  };
  // Optional guide tracks real actions; it never creates resources or punishes skipping.
  const goal = ui['goal-title'].closest('.goal') ?? ui['goal-title'].parentElement;
  goal.id = 'optional-guide';
  mount(goal, '<div class="guide-actions"><button class="btn" id="guide-action" type="button" hidden></button><button class="btn quiet" id="guide-toggle" type="button">Skrýt průvodce</button></div><div id="guide-body"></div>');
  const guideActions = {
    world: ["Otevřít tvorbu planet", () => {
      window.CosmoHUD?.showCreation?.();
      if (viewedPlanet()) showSurface(null, false);
      ui["planet-mode"].scrollIntoView?.({ block: "nearest" });
      ui["planet-mode"].focus({ preventScroll: true });
    }],
    surface: ["Otevřít planetu", () => {
      const world = selectedSurface();
      if (world) {
        showSurface(world);
        document.querySelector('[data-hud-mode="surface"]')?.click();
        ui["surface-map"].scrollIntoView?.({ block: "nearest" });
      }
    }],
    patron: ["Vybrat patronát", () => openPatronPicker()],
    settlements: ["Zobrazit osady", () => {
      const members = P.members(sim);
      const item = members.find(m => m.world === viewedPlanet() && !m.community.job)
        ?? members.find(m => !m.community.job) ?? members[0];
      openCities(item?.world, item?.community.id);
    }],
    research: ["Otevřít výzkum", () => {
      if (galaxyViewing) document.querySelector('[data-hud-mode="civic"]')?.click();
      $("research-shortcut").click();
    }],
    flights: ["Otevřít výpravy", () => {
      if (galaxyViewing) document.querySelector('[data-hud-mode="civic"]')?.click();
      setMapPicker(false);
      const from = sim.worlds.find(world => E.spaceflight(sim, world));
      openFlights(from);
      if (!window.CosmoHUD?.showManagement?.()) ui["economy-dialog"].scrollIntoView?.({ block: "nearest" });
      document.querySelector('[data-economy-tab="flights"]').focus({ preventScroll: true });
    }]
  };
  $("guide-action").addEventListener("click", event => guideActions[event.currentTarget.dataset.action]?.[1]());
  $('guide-toggle').addEventListener('click', () => { E.init(sim); sim.tutorial.hidden = !sim.tutorial.hidden; renderGuide(); });
  function renderGuide() {
    E.init(sim); const p = selectedSurface(), own = P.members(sim), wallet = E.wallet(sim), pool = sim.patron && E.science(sim, sim.patron.id);
    const goals = [
      ['world', 'Svět na oběžné dráze', 'V Soustavě klikni na Vypustit planetu a vypusť ji tahem po mapě. Pomocná zóna ukazuje doporučené pásmo.', sim.worlds.length > 0],
      ['surface', 'Pozoruj život', 'Otevři záložku Planeta a přečti Stav planety. Vítr přesouvá vláhu, teplo a chlad mění podmínky pro život.', surfaceId > 0],
      ['patron', 'Dobrovolný patronát', 'Vyber civilizaci, kterou chceš vést. Osady se i pod patronátem starají o svůj běžný život samy.', Boolean(sim.patron)],
      ['food', 'Vlastní pokyn', 'Zadej osadě Obživu nebo Obřad. U její výpravy se zobrazí Pokyn hráče a průběh práce.', own.some(({community: {job}}) => job?.playerOrdered && ["gather", "faith"].includes(job.kind))],
      ['faith', 'Společná řeč', 'Obřady jednotlivých osad přispívají do společné víry 10/10.', wallet.faith >= 10],
      ['wind', 'Nejprve energie', 'Po víře 10/10 zadej městu Rozvíjet energetiku. V Osadách u kolonie zvol Rozšířit infrastrukturu a hra vybere bezpečné místo a typ zdroje.', own.some(m => m.world.biosphere.power.plants.some(p => p.civilization === sim.patron?.id))],
      ['science', 'Rozvíjej vědu', 'Za 12 M a 1 E/s při práci získáš 3 VB, potom trvalý odběr +0,15 E/s. Odemkni Vesmírný program.', Boolean(pool?.science.funded.navigation)],
      ['space', 'Cesta ke hvězdám', 'Po Vesmírném programu odemkni Kosmickou techniku a zaplať místní kosmodrom.', sim.worlds.some(p => sim.patron && E.spaceflight(sim, p))],
      ['samples', 'Poznej různé světy', 'Vyšli průzkumnou sondu a počkej na návrat vzorků. Stejný svět dává poznání jen jednou.', wallet.knowledge >= 1],
      ['robots', 'Připrav nový domov', 'Robotika a Regulace klimatu umožní vyslat robotickou výpravu a připravit nový svět.', sim.worlds.some(p => p.biosphere.robotBases?.some(b => b.civilization === sim.patron?.id))],
      ['colonies', 'Druhý domov', 'Dokonči výzkum Kolonizace a přivez vzorek z cílové planety. Ve Výzkumu a logistice otevři Výpravy a zkontroluj podmínky pro posádku.', new Set(own.map(m => m.world.id)).size >= 2]
    ];
    for (const [key, , , yes] of goals) if (yes) sim.tutorial.completed[key] = true;
    const next = goals.find(([key]) => !sim.tutorial.completed[key]);
    const robotTechReady = E.knows(sim, sim.patron?.id, "robotics") && E.knows(sim, sim.patron?.id, "climate");
    const action = { world:"world", surface:"surface", patron:"patron", food:"settlements",
      faith:"settlements", wind:"settlements", science:"research", space:"research",
      samples:"flights", robots:robotTechReady ? "flights" : "research", colonies:"flights" }[next?.[0]];
    const shortcut = $("guide-action");
    shortcut.hidden = sim.tutorial.hidden || !action;
    if (action) {
      shortcut.dataset.action = action;
      put(shortcut, guideActions[action][0]);
    }
    put(ui['goal-label'], 'Dobrovolný průvodce'); put(ui['goal-title'], next?.[1] ?? 'Soustava má vlastní příběh'); put(ui['goal-detail'], next?.[2] ?? 'Rozvíjej další světy, obchoduj nebo jen pozoruj. Deník si můžeš exportovat.');
    ui['goal-detail'].hidden = sim.tutorial.hidden; $('guide-body').hidden = sim.tutorial.hidden;
    replaceSafe($('guide-body'), '<details><summary>Postup průvodcem · ' + goals.filter(([key]) => sim.tutorial.completed[key]).length + '/' + goals.length + '</summary><ol>' + goals.map(([key, name]) => '<li' + (sim.tutorial.completed[key] ? ' class="done"' : '') + '>' + (sim.tutorial.completed[key] ? '✓ ' : '') + name + '</li>').join('') + '</ol><small>Bez odměn za suroviny, časového limitu a postihu. Každý krok můžeš přeskočit.</small></details>');
    put($('guide-toggle'), sim.tutorial.hidden ? 'Zobrazit průvodce' : 'Skrýt průvodce');
    if (p) {
      const text = p.biosphere.evolutionMode === 'accelerated' ? 'Urychlený přírodní vývoj · ' : 'Přirozený vývoj · ';
      const known = pool?.climateKnown[p.id] || E.owns(sim, p) || !sim.patron;
      const s = p.biosphere;
      const status = p.pop > 0 ? '' : s.evolutionAdvancing == null ? ' · Čeká na první měření'
        : s.era === 4 || s.era === 3 && B.tribalProgress(s) >= 1 && s.tribalClimateReady === false ? ' · Kmeny čekají na obyvatelné místo'
        : s.evolutionAdvancing ? ' · Evoluce pokračuje' : ' · Vývoj čeká na vhodné prostředí';
      put($('evolution-caption'), text + B.eras[s.era] + status + (known ? ' · Původní život: ' + E.profile(p.biosphere.bioProfile).climate : ' · Nároky původního života zatím neznámé'));
      $('evolution-caption').hidden = !surfaceId;
    } else $('evolution-caption').hidden = true;
  }
  mount(ui['surface-readout'], '<span id="evolution-caption"></span>');
  // Six readable resource types, followed by a distinct local balance for construction.
  const values = ui['resource-hud'].querySelector('.resource-values');
  for (const [id, key] of [['resource-food','food'],['resource-energy','energy'],['resource-stock','stock'],['resource-faith','faith']]) ui[id].previousElementSibling.insertAdjacentHTML('afterbegin', icon(key));
  mount(values, '<div><span>' + icon('science') + ' Výzkumné body</span><output id="resource-science"></output></div><div><span>' + icon('knowledge') + ' Poznané světy</span><output id="resource-knowledge"></output></div>');
  function renderCivicResources(id) {
    const wallet = E.wallet(sim, id);
    put(ui["resource-food"], fmt(wallet.food) + " J");
    put(ui["resource-energy"], fmt(wallet.energy) + " E");
    put(ui["resource-stock"], fmt(wallet.supplies) + " M");
    put(ui["resource-faith"], fmt(wallet.faith) + "/10");
    put($("resource-science"), fmt(wallet.points) + " VB");
    put($("resource-knowledge"), fmt(wallet.knowledge));
  }
  mount(ui['voyage-list'], '<ul id="expeditions-list" class="voyage-list"></ul>', 'afterend');
  mount(document.body, '<aside id="game-notices" aria-label="Důležité události" role="log" aria-live="polite" aria-relevant="additions"></aside>');
  let noticeState = sim, noticeId = 0, notices = [], noticeQueue = [];
  const recentNotices = new Map();
  function renderNotices(events) {
    const now = performance.now();
    if (noticeState !== sim) { noticeState = sim; notices = []; noticeQueue = []; recentNotices.clear(); events = []; }
    for (const e of events) {
      if (!["patron-ended","settlement-migration","settlement-owner"].includes(e.kind) && !/Přesun obyvatel|Změna správy|Patronát skončil|dokončuje|dokončen|přistál|Přistál|Vzorky ze světa|výprava přivezla|Výprava přivezla|Poslední osídlení zaniklo|Slunce|požár|Láva zasáhla|Jídlo dochází|Dva světy jsou soběstačné|Tři světy jsou soběstačné/i.test(e.message)) continue;
      const planet = sim.worlds.find(w => e.message.startsWith(w.name + ' · ')), ownName = sim.patron?.name;
      if (e.kind!=='patron-ended' && planet && planet.id !== selected && e.civilization!==sim.patron?.id && e.previousOwner!==sim.patron?.id && !(ownName && e.message.includes(ownName))) continue;
      const key = e.message.replace(/[0-9]+(?:[.,][0-9]+)?/g,'#');
      if (recentNotices.has(key) && now - recentNotices.get(key) < 20000) continue;
      recentNotices.set(key, now);
      if (recentNotices.size > 128) recentNotices.delete(recentNotices.keys().next().value);
      noticeQueue.push({id:++noticeId,message:e.message,tone:e.tone});
      if (noticeQueue.length > 4) noticeQueue.shift();
    }
    notices = notices.filter(n => n.until > now);
    while (notices.length < 2 && noticeQueue.length) notices.push({...noticeQueue.shift(),until:now+6500});
    replaceSafe($('game-notices'), notices.map(n => '<article class="game-notice" data-tone="' + esc(n.tone) + '"><button class="notice-close" type="button" aria-label="Zavřít upozornění" data-notice="' + n.id + '">×</button><strong>' + esc(n.message) + '</strong><small>Podrobnosti zůstávají v deníku.</small></article>').join(''));
  }
  $('game-notices').addEventListener('click',e=>{const button=e.target.closest('[data-notice]');if(button){notices=notices.filter(n=>n.id!==Number(button.dataset.notice));renderNotices([]);}});
  const originalUI = updateUI;
  updateUI = () => {
    for (const world of sim.worlds) if (world.biosphere) E.focus(sim, world);
    const pendingNotices = sim.events.slice();
    originalUI(); E.init(sim); Space.init(sim); renderNotices(pendingNotices);
    put(ui.year, E.dateLabel(E.dateAt(sim))); ui.year.title = 'Společný kalendář · rok a měsíc. Tempo podle nejvyšší dosažené éry.';
    $('missions-open').disabled = !sim.patron; $('missions-open').title = sim.patron ? 'Výzkum a přehled výprav. První průzkumné lety vyžadují Vesmírný program, Kosmickou techniku a dokončený kosmodrom.' : 'V dlaždici Planety a hlavní správa zvol Vybrat patronát.'; renderWorldChoices();
    put($('missions-access'), !sim.patron ? 'Nejprve přijmi patronát civilizace' : sim.worlds.some(w => E.spaceflight(sim,w)) ? 'Lety odemčené · vyber zdroj a cíl' : E.science(sim,sim.patron.id).faith < 10 ? 'Věda: víra ' + fmt(E.science(sim,sim.patron.id).faith) + '/10 · Lety: kosmodrom' : 'Lety: Navigace → Kosmická technika → kosmodrom');
    for (const button of document.querySelectorAll('[data-guide-profile]')) button.setAttribute('aria-pressed', String(button.dataset.guideProfile === sim.guideProfile));
    put($('legend-zone-caption'), 'Doporučená dráha · ' + E.profile(sim.guideProfile).climate + (sim.climateVersion===2 ? '' : ' · původní soustava')); 
    const p = viewedPlanet();
    const windTool = $('windplant-tool');
    const outpost = E.energyOutpost(p, sim.patron?.id);
    // Keep legacy DOM nodes for compatibility but no longer offer manual point-placement.
    windTool.hidden = true;
    const windLock = sim.patron ? E.energyBlock(sim, sim.patron.id) : "";
    windTool.disabled = Boolean(windLock);
    windTool.title = windLock || weatherHints.windplant;

    if (p) {
      const known = sim.patron && E.knows(sim, sim.patron.id, 'climate');
      ui['hydro-tool'].hidden = !outpost || !known;
      ui['hydro-tool'].disabled = Boolean(windLock);
      ui['hydro-tool'].title = windLock || weatherHints.hydro;
      $('specialized-equipment').hidden = ui['hydro-tool'].hidden;
      ui['hydro-tool'].classList.add('specialized-tool');
      ui['hydro-tool'].hidden = true;
      $('specialized-equipment').hidden = true;
    }
    if (['hydro','windplant'].includes(weatherTool)) { weatherTool='wind'; clearWeatherAim(); }
    if (weatherTool === 'windplant' && (windTool.hidden || windTool.disabled)
      || weatherTool === 'hydro' && (!p || ui['hydro-tool'].hidden || ui['hydro-tool'].disabled)) {
      weatherTool = 'wind'; setSurfacePan(surfacePan);
    }
    windTool.setAttribute('aria-pressed', String(!surfacePan && weatherTool === 'windplant'));
    renderDock(); renderGuide();
    if (ui['patron-dialog'].open) {
      const d = patronSelection(), c = d.community;
      if (c) {
        replaceSafe($("detail-wallet"), defenseHTML(d.world, c) + walletHTML(d.world, c)); replaceSafe($('detail-habitat'), habitatHTML(d.world, c)); const t = task(c);
        put(ui['patron-task'], t.title + ' · ' + t.phase); $('detail-progress').innerHTML = c.job ? progress(t.value) : '';
        for (const button of ui['patron-dialog'].querySelectorAll('[data-patron-action]')) {
          const action = button.dataset.patronAction;
          if (action === 'gift') continue;
          button.hidden = action === 'faith' && E.science(sim, c.civilization).faith >= 10;
          const r = patronBrowser.batch && P.batchOrder(sim, d.own, action, d.targetRef, true);
          const cost = action === 'energy' ? r ? null : E.actionQuote(sim, d.world, c, action).cost : E.actionCosts(sim, d.world, c, action);
          put(button.querySelector('.action-price'), r ? r.started ? r.started + ' osad · ' + E.priceLabel(r) : 'Žádná dostupná osada · Nic se neodečte' : action === 'science' ? '12 M + ' + decimal.format(E.scienceOrderDraw(sim,c.civilization)) + ' E/s; pak +0,15 E/s trvale' : cost ? E.priceLabel(cost) : '—');
          let benefit=button.querySelector('.action-benefit')??button.querySelector(':scope > span');if(!benefit){benefit=document.createElement('span');button.querySelector('strong').after(benefit);}benefit.className='action-benefit';put(benefit,actionBenefit(d.world,c,button.dataset.patronAction));
        }
      }
    }
    if (sim.expeditions.length) {
      ui.voyages.hidden = false;
      const labels = { out: "Na cestě", return: "Návrat", returned: "Dokončena", landed: "Dokončena", lost: "Ztracena", battle: "Výsadek bojuje" };
      replaceSafe($('expeditions-list'), sim.expeditions.slice(-8).reverse().map(r => {
        const ship = sim.ships.find(s => s.recordId === r.id), value = ship ? Math.min(100, ship.elapsed / ship.duration * 100) : 100;
        return '<li class="voyage" data-status="' + esc(r.status) + '"><b>' + esc(Space.MISSIONS[r.type]?.name ?? (r.type === 'supply' ? 'Zásobovací loď' : 'Výprava')) + ' · ' + esc(E.nationLabel(sim,r.civilization)) + '</b><span>' + esc(labels[r.status] ?? r.status) + ' · ' + esc(r.originName + ' → ' + r.targetName) + '</span>' + (ship ? progress(value, 'Průběh letu') + '<small>Zbývá asi ' + E.duration(sim, ship.duration - ship.elapsed) + '</small>' : '') + '<small>' + esc(r.note) + '</small></li>';
      }).join(''));
      put(ui['voyage-count'], sim.ships.filter(s => s.missionType).length + ' VÝPRAV NA CESTĚ');
    } else $('expeditions-list').replaceChildren();
  };
  // Map overlay stays lightweight; the base renderer handles weather and individual actors.
  function drawLocalOwnership(ctx, box, s) {
    const tiles = new Map();
    const claimedBy = tile => s.towns[s.claims[tile] - 1]?.civilization;
    for (const {tile, owner} of B.surfaceInstallations(s)) {
      if (!s.plotTown[tile] || claimedBy(tile) !== owner) tiles.set(tile, owner);
    }
    // A freshly landed settlement gets a marker even before the next claims refresh.
    for (const town of s.towns) {
      if (town.civilization && !town.abandoned && s.urban[town.home] === 4 && s.damage[town.home] < 0.78
        && claimedBy(town.home) !== town.civilization && B.canBuild(s, town.home, town)) tiles.set(town.home, town.civilization);
    }
    const size = Math.max(3, box.unit);
    for (const [tile, owner] of tiles) {
      const p = B.position(tile), x = box.x + p.x * box.unit - size / 2, y = box.y + p.y * box.unit - size / 2;
      ctx.strokeStyle = "#06131d"; ctx.lineWidth = 3.4; ctx.strokeRect(x, y, size, size);
      ctx.strokeStyle = sim.nations[owner]?.color ?? "#9aaec2"; ctx.lineWidth = 1.8; ctx.strokeRect(x, y, size, size);
    }
  }
  const baseRender = SurfaceView.render;
  SurfaceView.render = (ctx, v, camera, world, now, options) => {
    baseRender(ctx, v, camera, world, now, options);
    const s = world.biosphere, [worldId, communityId] = patronBrowser.selected.split(':').map(Number), c = worldId === world.id && s.communities?.find(c => c.id === communityId && c.active);
    const box = SurfaceView.bounds(v, camera);
    ctx.save(); ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0); ctx.beginPath(); ctx.rect(box.left, box.top, box.width, box.height); ctx.clip();
    drawLocalOwnership(ctx, box, s);
    if (c && state().tab === 'cities') {
      const p = B.position(c.home), x = box.x + p.x * box.unit, y = box.y + p.y * box.unit;
      ctx.strokeStyle = '#f5fbff'; ctx.lineWidth = 3; ctx.setLineDash([4,3]); ctx.strokeRect(x - box.unit, y - box.unit, box.unit * 2, box.unit * 2); ctx.setLineDash([]);
      const name = c.name || 'Osada ' + c.id;
      const ownership = sim.patron ? (c.civilization === sim.patron.id ? ' · Tvoje' : ' · Cizí') : '';
      const text = name + ownership;
      ctx.font = 'bold 13px monospace';
      const labelWidth = Math.min(box.width, ctx.measureText(text).width + 16);
      const labelX = Math.max(box.left, Math.min(x - 8, box.left + box.width - labelWidth));
      ctx.fillStyle = '#08121fe8';
      ctx.fillRect(labelX, y - 30, labelWidth, 23);
      ctx.fillStyle = '#e6ffb5';
      ctx.fillText(text, labelX + 8, y - 14, labelWidth - 16);
    }
    for (const conflict of s.spaceConflicts ?? []) if (!conflict.finished) { const c = s.communities.find(c => c.id === conflict.targetId); if (c) { const p = B.position(c.home), x = box.x + p.x * box.unit, y = box.y + p.y * box.unit; ctx.strokeStyle = '#ffb07b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, box.unit * (2 + Math.sin(now * 9) * .4), 0, Math.PI * 2); ctx.stroke(); } }
    ctx.restore();
  };
  // Patron controls follow the civilization's resource tiles.
  mount(ui["resource-hud"], '<div id="civilization-actions" class="civilization-actions"></div><details class="population-help"><summary>Jak roste populace?</summary><p>Populace přirozeně roste s dostatkem jídla, vhodným prostředím a fungujícím zázemím. Hlad, katastrofy a konflikty ji snižují. Zástavba se rozrůstá podle skutečných lidí; nové domy samy obyvatele nevytvářejí. Připojení osady převádí existující obyvatele.</p></details><details id="patron-options"><summary>Možnosti patronátu</summary></details>');
  $("patron-options").append($("patron-release"));
  $("missions-open").hidden = $("quick-technologies").hidden = true;
  // Observer can still choose a civilisation, even when there is no resource HUD.
  mount(ui['world-navigation'], '<button class="btn" id="observer-cities" type="button">Vybrat civilizaci / patronát</button>','afterbegin');
  $('observer-cities').textContent = 'Vybrat patronát';
  $('observer-cities').addEventListener('click',()=>openPatronPicker());
  // A planet-first patron selector: the player sees the inhabitants of THIS planet,
  // then reuses the game's existing name/confirmation flow (no unconfirmed adoption).
  mount(document.body, `<dialog id="patron-picker-dialog" class="compact-game-dialog" aria-labelledby="patron-picker-title">
    <div class="dialog-head"><div><h2 id="patron-picker-title">Vybrat patronát</h2><p id="patron-picker-context" class="economy-hint"></p></div><button class="btn" type="button" data-close-picker="patron-picker-dialog" aria-label="Zavřít">✕</button></div>
    <div id="patron-picker-list" class="patron-picker-list"></div>
    <p class="economy-hint">Patronát začne až po tvém výslovném potvrzení. Civilizaci později změníš pouze vzdáním se současného patronátu.</p>
    <div class="dialog-actions"><button class="btn" type="button" data-close-picker="patron-picker-dialog">Zpět do hry</button></div>
  </dialog><dialog id="rename-planet-dialog" class="compact-game-dialog" aria-labelledby="rename-planet-title">
    <div class="dialog-head"><div><h2 id="rename-planet-title">Přejmenovat planetu</h2><p class="economy-hint" id="rename-planet-caption"></p></div><button class="btn" type="button" data-close-picker="rename-planet-dialog" aria-label="Zavřít">✕</button></div>
    <form id="rename-planet-form"><label class="economy-field" for="rename-planet-input">Nový název planety<input id="rename-planet-input" maxlength="40" required autocomplete="off"></label><p class="economy-hint">Změna se projeví v soustavě, na povrchu, v osadách i výpravách. Oběžná dráha a stav planety zůstávají stejné.</p><p class="economy-hint" id="rename-planet-feedback" role="status"></p><div class="dialog-actions"><button class="btn primary" type="submit">Uložit název</button><button class="btn" type="button" data-close-picker="rename-planet-dialog">Zrušit</button></div></form>
  </dialog>`);
  for (const button of document.querySelectorAll('[data-close-picker]')) button.addEventListener('click', () => $(button.dataset.closePicker).close());
  function patronPlanet() { return sim.worlds.find(w => w.id === selected) ?? viewedPlanet() ?? selectedSurface() ?? null; }
  function openPatronPicker() {
    if (sim.patron) { openCities(); return; }
    const planet = patronPlanet(), list = $('patron-picker-list');
    put($('patron-picker-context'), planet ? 'Planeta ' + planet.name + ' · dostupné civilizace a osady' : 'Nejprve vytvoř nebo vyber planetu.');
    const groups = new Map();
    for (const item of P.catalog(sim)) {
      if (item.world.id !== planet?.id || !item.community.active || item.community.people <= 0) continue;
      const id = item.community.civilization;
      if (!groups.has(id)) groups.set(id, { id, name: E.nationLabel(sim, id), profile: E.nationClimate(sim, id), people: 0, towns: [], first: item });
      const group = groups.get(id); group.people += item.community.people; group.towns.push(item.community.name || 'Osada ' + item.community.id);
    }
    const entries = [...groups.values()];
    replaceSafe(list, entries.length ? entries.map(g => '<article class="patron-pick-card"><div><strong>' + esc(g.name) + '</strong><small>' + esc(g.profile) + ' · ' + fmt(g.people) + ' obyvatel · ' + g.towns.length + ' ' + (g.towns.length === 1 ? 'osada' : g.towns.length < 5 ? 'osady' : 'osad') + '</small><small>' + esc(g.towns.slice(0, 4).join(', ')) + (g.towns.length > 4 ? '…' : '') + '</small></div><button class="btn primary" type="button" data-pick-patron="' + esc(g.first.id) + '">Vybrat civilizaci</button></article>').join('')
      : '<p class="patron-picker-empty">Na planetě ' + esc(planet?.name ?? '—') + ' zatím není žádná obydlená osada, jejíž civilizaci by šlo převzít. Vyber jinou planetu nebo nech běžet vývoj.</p>');
    if (!$('patron-picker-dialog').open) $('patron-picker-dialog').showModal();
  }
  $('patron-picker-list').addEventListener('click', e => {
    const id = e.target.closest('[data-pick-patron]')?.dataset.pickPatron; if (!id || sim.patron) return;
    const item = P.catalog(sim).find(c => c.id === id && c.world.id === patronPlanet()?.id && c.community.active && c.community.people > 0);
    if (!item) { openPatronPicker(); return; }
    $('patron-picker-dialog').close();
    // The original native dialog prepares the existing first-contact confirmation.
    detail(item.world, item.community.id);
    if (!ui['patron-choose'].disabled) ui['patron-choose'].click();
  });
  mount(document.body, `<dialog id="rename-entity-dialog" class="compact-game-dialog" aria-labelledby="rename-entity-title">
    <h2 id="rename-entity-title"></h2>
    <form id="rename-entity-form">
      <label class="economy-field">Nový název <input id="rename-entity-input" required autocomplete="off"></label>
      <p id="rename-entity-feedback" class="economy-hint" role="status"></p>
      <div class="dialog-actions">
        <button class="btn primary" type="submit">Uložit název</button>
        <button class="btn" id="rename-entity-cancel" type="button">Zrušit</button>
      </div>
    </form>
  </dialog>`);
  let saveEntityName;
  function openEntityRename(title, name, limit, save) {
    const dialog = $("rename-entity-dialog"), input = $("rename-entity-input");
    if (dialog.open) return;
    saveEntityName = save;
    input.value = name;
    input.maxLength = limit;
    put($("rename-entity-title"), title);
    put($("rename-entity-feedback"), "");
    dialog.showModal();
    input.focus();
    input.select();
  }
  $("rename-entity-form").addEventListener("submit", event => {
    event.preventDefault();
    if (!saveEntityName) return;
    const issue = saveEntityName($("rename-entity-input").value);
    put($("rename-entity-feedback"), issue);
    if (!issue) {
      $("rename-entity-dialog").close();
      updateUI();
    }
  });
  $("rename-entity-cancel").addEventListener("click", () => $("rename-entity-dialog").close());
  $("rename-entity-dialog").addEventListener("close", () => { saveEntityName = null; });
  $("system-status-rename").addEventListener("click", () => {
    const id = galaxyViewing ? galaxySelected : galaxyId;
    const system = galaxySystems(false).find(item => item.id === id);
    if (system) openEntityRename("Přejmenovat soustavu", system.name, 40, name => renameSystem(id, name));
  });
  let renamingPlanetId = null;
  function openRenamePlanet(worldId) {
    const planet = sim.worlds.find(p => p.id === worldId); if (!planet) return;
    renamingPlanetId = planet.id;
    put($('rename-planet-caption'), 'Aktuální název: ' + planet.name);
    $('rename-planet-input').value = planet.name; put($('rename-planet-feedback'), '');
    $('rename-planet-dialog').showModal();$('rename-planet-input').focus();$('rename-planet-input').select();
  }
  $('rename-planet-form').addEventListener('submit', e => {
    e.preventDefault();
    const planet = sim.worlds.find(p => p.id === renamingPlanetId), name = Orbit.cleanPlanetName($('rename-planet-input').value);
    if (!planet) { put($('rename-planet-feedback'), 'Planeta už není dostupná.'); return; }
    if (!name) { put($('rename-planet-feedback'), 'Zadej název planety.'); return; }
    if (Orbit.planetNameTaken(sim, name, planet.id)) { put($('rename-planet-feedback'), 'Jiná planeta už používá stejný název.'); return; }
    const old = planet.name;
    planet.name = name;
    // Existing spacecraft use persistent planet IDs when available. Keep legacy label-based
    // records and pending flight descriptions consistent after a rename.
    for (const voyage of sim.voyages ?? []) if (voyage.targetId === planet.id || voyage.targetId == null && voyage.target === old) { voyage.targetId = planet.id; voyage.target = name; }
    for (const expedition of sim.expeditions ?? []) {
      if (expedition.target === planet.id) expedition.targetName = name;
      if (expedition.origin === planet.id) expedition.originName = name;
    }
    for (const nation of Object.values(sim.nations ?? {})) if (nation.homeWorld === planet.id) nation.homeWorldName = name;
    if (old !== name) Orbit.event(sim, 'Planeta ' + old + ' byla přejmenována na ' + name + '.', 'good');
    $('rename-planet-dialog').close(); updateUI();
  });
  ui['world-navigation'].querySelector('.world-navigation-controls').insertAdjacentHTML('beforeend', '<button type="button" class="btn world-rename-control" id="rename-selected-planet" title="Přejmenovat vybranou planetu">✎ Přejmenovat</button>');
  $('rename-selected-planet').addEventListener('click', () => openRenamePlanet(selected));
  ui['world-list'].addEventListener('click', e => {
    const button = e.target.closest('[data-world-rename]'); if (!button) return;
    e.stopPropagation(); openRenamePlanet(Number(button.dataset.worldRename));
  });
  // Rename option next to the active planet title; useful even when the Planety tab is closed.
  ui['field-name'].insertAdjacentHTML('afterend', '<button type="button" class="btn surface-planet-rename" id="rename-surface-planet" hidden title="Přejmenovat planetu">✎</button>');
  $('rename-surface-planet').addEventListener('click', () => openRenamePlanet(viewedPlanet()?.id));
  mount(ui['field'], `<section id="planet-overview" aria-labelledby="planet-status-name" hidden>
    <div class="planet-status-heading">
      <h3 id="planet-status-name" class="planet-status-name"></h3><button class="btn name-pencil" id="planet-status-rename" type="button" aria-label="Přejmenovat planetu">✎</button>
      <div class="planet-status-arrows" role="group" aria-label="Přepínání planet">
        <button class="btn world-arrow" id="planet-status-previous" type="button" aria-label="Předchozí planeta">‹</button>
        <button class="btn world-arrow" id="planet-status-next" type="button" aria-label="Další planeta">›</button>
      </div>
    </div>
    <div class="numbers planet-status-stats">
      <div class="stat"><span class="smallcaps">Průměrná teplota</span><output id="planet-status-temperature" aria-label="Průměrná teplota"></output></div>
      <div class="stat"><span class="smallcaps">Doba oběhu</span><output id="planet-status-period" aria-label="Doba oběhu"></output><small class="transit" id="planet-status-orbit"></small></div>
      <div class="stat"><span class="smallcaps">Obyvatelé</span><output id="planet-status-people" aria-label="Obyvatelé planety"></output><small class="transit" id="planet-status-settlements"></small></div>
      <div class="stat"><span class="smallcaps" title="Průměrná hustota rostlinstva na souši; zaplavené, zaledněné a holé skalnaté plochy se nezapočítávají">Vegetace souše</span><output id="planet-status-land-green" aria-label="Průměrná vegetace souše"></output><small class="transit" id="planet-status-era"></small></div>
    </div>
    <p id="planet-status-fauna" class="planet-status-line"></p>
    <p id="planet-status-band" class="planet-status-line"></p>
    <div id="planet-status-tribal" hidden>
      <label for="planet-status-tribal-progress">Vývoj ke kmenům <output id="planet-status-tribal-percent"></output></label>
      <progress id="planet-status-tribal-progress" max="100"></progress>
      <p id="planet-status-tribal-note" class="planet-status-line"></p>
    </div>
    <div class="planet-status-actions">
      <button class="btn primary" id="planet-status-back" type="button">← Zpět do soustavy</button>
      <button class="btn" id="planet-status-list" type="button" aria-controls="map-planet-picker">Seznam planet</button>
    </div>
    <details id="planet-climate-details"><summary>Počasí a místní síť</summary></details>
  </section>`,'beforebegin');
  $('planet-status-rename').addEventListener('click', () => openRenamePlanet(viewedPlanet()?.id));
  const climateDetails = $('planet-climate-details');
  climateDetails.append(ui['surface-panel']);
  climateDetails.addEventListener('toggle',()=>{state().planetOverviewOpen=climateDetails.open;});
  $('planet-status-list').addEventListener('click', () => {
    showSurface(null, false);
    ui.field.scrollIntoView?.({block:'nearest'});
    setMapPicker(true, true);
  });
  for (const [id, direction] of [['planet-status-previous', -1], ['planet-status-next', 1]]) {
    $(id).addEventListener('click', () => browseWorld(direction));
  }
  $('planet-status-back').addEventListener('click',()=>{
    showSurface(null);
    ui.map.scrollIntoView?.({block:'center'});
  });

  const warningBar = $("planet-warning-bar");
  const warningList = $("planet-warning-list");
  let warningWorld, warningPatron, warningMode;
  let warningLocations = new Map();
  warningList.addEventListener("click", event => {
    const stance = event.target.closest("[data-war-stance]");
    if (stance) {
      const location = warningLocations.get(stance.dataset.warKey);
      if (location && sim.worlds.includes(location.world)) {
        Warfare.stance(sim, location.world, location.enemy, stance.dataset.warStance);
        updateUI();
      }
      return;
    }
    const button = event.target.closest("[data-warning-location]");
    const location = warningLocations.get(button?.dataset.warningLocation);
    if (!location || !sim.worlds.includes(location.world)) return;
    clearWeatherAim();
    setMapPicker(false);
    warningBar.open = false;
    if (viewedPlanet() !== location.world) showSurface(location.world, false);
    focusSettlementOnMap(location.world, location.tile, null);
    ui["surface-map"].scrollIntoView?.({ block: "nearest" });
    ui["surface-map"].focus({ preventScroll: true });
  });
  function missileWarnings(world, id) {
    const s = world.biosphere, w = s.warfare;
    if (!w) return [];
    const relevant = item => !id || item.id === id || item.enemy === id;
    const active = new Map();
    for (const shot of w.flights.filter(relevant)) {
      const salvo = active.get(shot.salvo) ?? [];
      salvo.push(shot);
      active.set(shot.salvo, salvo);
    }
    return [
      ...[...active].map(([salvo, shots]) => ({ key: "salvo-" + world.id + "-" + salvo,
        world, tile: shots[0].to, label: world.name + " · " + (shots[0].type === "nuclear" ? "Jaderná raketa ve vzduchu" : "Raketa ve vzduchu")
          + (shots.length > 1 ? " · " + shots.length + " hlavice" : "") })),
      ...w.impacts.filter(hit => relevant(hit) && (hit.type === "nuclear" ? B.contaminated(s, hit.tile) : s.time - hit.time < 12))
        .map(hit => ({ key: "missile-hit-" + world.id + "-" + hit.salvo + "-" + hit.tile,
          guide: hit.type === "nuclear" ? "guide-title-contamination" : "",
          world, tile: hit.tile, label: world.name + " · " + (hit.type === "nuclear" ? "Kontaminovaná oblast po jaderném zásahu" : "Nedávný raketový dopad") }))
    ];
  }
  function civicWarnings(patron) {
    if (!patron) return [];
    const conflicts = [], targets = [];
    for (const world of sim.worlds) {
      const s = world.biosphere;
      if (!s) continue;
      conflicts.push(...missileWarnings(world, patron.id));
      for (const tension of Warfare.tensions(sim, world, patron.id)) {
        const mode = tension.mode === "calm" ? " · Snaha o zmírnění" : tension.mode === "hard" ? " · Tvrdší postoj" : "";
        conflicts.push({ ...tension, key: "tension-" + world.id + "-" + tension.enemy, world,
          label: world.name + " · Roste napětí s civilizací " + E.nationLabel(sim, tension.enemy) + mode });
      }
      for (const c of s.communities ?? []) {
        if (!c.active || c.civilization !== patron.id) continue;
        const label = (c.name || "Osada " + c.id) + " na " + world.name;
        const position = { world, tile: c.home };
        const town = c.town + 1;
        const battle = s.battle;
        if (battle?.sides.includes(town)) conflicts.push({ ...position, key: "battle-" + world.id + "-" + c.id,
          label: label + " · " + (battle.orderedAttacker === town ? "Útok probíhá" : "Probíhá boj") });
        else if (s.boats?.some(boat => boat.kind === "landing" && !boat.returning && boat.to === c.town
          && boat.civilization !== patron.id)) conflicts.push({ ...position, key: "landing-" + world.id + "-" + c.id,
          label: label + " · Blíží se nepřátelský výsadek" });
        if (s.spaceConflicts?.some(conflict => !conflict.finished && conflict.targetId === c.id
          && conflict.civilization !== patron.id)) conflicts.push({ ...position, key: "orbital-landing-" + world.id + "-" + c.id,
          label: label + " · Probíhá nepřátelský výsadek z oběžné dráhy" });
        const status = E.environment(s, c);
        if (status.tone === "warn") targets.push({ ...position, key: "town-" + world.id + "-" + c.id,
          label: label + " · " + status.reason });
        if (status.reason !== "Dochází potrava" && Number.isFinite(c.food)
          && c.food < Math.max(1, (c.consumption ?? 0.65) * 8)) targets.push({
          ...position, key: "hunger-" + world.id + "-" + c.id, label: label + " · Dochází potrava"
        });
      }
    }
    const recentSince = Math.max(patron.started ?? 0, sim.time - 180);
    const history = sim.history ?? [];
    const relevant = ["settlement-owner", "settlement-abandoned", "settlement-loss", "settlement-migration", "settlement-founded"];
    let count = 0;
    for (let index = history.length - 1; index >= 0 && count < 8; index--) {
      const entry = history[index];
      if (entry.time < recentSince) break;
      if (!relevant.includes(entry.kind) || entry.civilization !== patron.id && entry.previousOwner !== patron.id) continue;
      const world = sim.worlds.find(world => world.id === entry.worldId);
      const community = world?.biosphere?.communities?.find(c => c.id === (entry.communityId ?? entry.toCommunity));
      const name = entry.settlement ?? community?.name ?? "Osada " + entry.communityId;
      const key = "history-" + entry.time + "-" + entry.kind + "-" + index;
      const place = name + (world ? " · " + world.name : "");
      let label = entry.message;
      if (entry.kind === "settlement-owner") label = (entry.civilization === patron.id ? "Převzato: " : "Ztraceno: ") + place;
      if (entry.founded || entry.kind === "settlement-founded") label = "Nová osada: " + place;
      targets.push({ key,
        world, tile: entry.tile ?? community?.home, label });
      if (entry.abandoned && entry.origin) targets.push({ key: key + "-origin", world,
        tile: entry.originTile, label: "Opuštěno: " + entry.origin + (world ? " · " + world.name : "") });
      count++;
    }
    return [...conflicts, ...targets];
  }
  function renderWarnings(world, groups) {
    const civic = mapNavigationKind === "civic";
    const patron = civic ? sim.patron : null;
    if (warningWorld !== world || warningMode !== civic || warningPatron !== patron?.id) {
      warningBar.open = false;
      warningWorld = world;
      warningMode = civic;
      warningPatron = patron?.id;
    }
    put($("planet-warning-title"), civic ? "Upozornění patronátu" : "Upozornění planety");
    const targets = civic ? civicWarnings(patron) : [];
    if (!civic) {
      targets.push(...missileWarnings(world));
      if (world.orbitAlert === "warn" || world.orbitAlert === "bad") targets.push({
        key: "orbit", label: world.orbitLabel
      });
      const s = world.biosphere;
      if (s.lastImpact && s.time - s.lastImpact.time < 5) targets.push({
        key: "impact", world, tile: s.lastImpact.tile, label: "Čerstvý dopad tělesa"
      });
      if (s.storm) targets.push({ key: "storm", label: "Bouřka · Riziko blesků" });
      for (const volcano of s.volcanoes) targets.push({
        key: "volcano-" + volcano.tile, world, tile: volcano.tile, label: "Aktivní sopka"
      });
      for (const group of groups) {
        if (group.climate) targets.push({ key: "climate-" + group.label, world, tile: group.climateTile,
          label: "Nevhodné podmínky pro část zvěře (" + group.label + ")" });
        if (group.food) targets.push({ key: "food-" + group.label, world, tile: group.foodTile,
          label: "Nedostatek potravy pro část zvěře (" + group.label + ")" });
      }
    }
    const empty = civic && !patron ? "Zatím bez patronátu" : "Bez aktuálních upozornění";
    warningBar.dataset.warn = String(targets.length > 0);
    put($("planet-warning-preview"), targets.map(({ label }) => label).join(" · ") || empty);
    warningLocations = new Map(targets.filter(({ world, tile }) => world && Number.isInteger(tile))
      .map(target => [target.key, target]));
    replaceSafe(warningList, targets.map(({ key, label, enemy, mode, guide }) => {
      const content = warningLocations.has(key)
        ? `<button type="button" class="btn warning-location" data-warning-location="${esc(key)}" title="Najít na mapě">${esc(label)} <span aria-hidden="true">↗</span></button>`
        : esc(label);
      const actions = enemy ? `<div class="planet-status-actions">
        <button class="btn" type="button" data-war-key="${esc(key)}" data-war-stance="calm" aria-pressed="${mode === "calm"}">Zmírnit konflikt</button>
        <button class="btn" type="button" data-war-key="${esc(key)}" data-war-stance="hard" aria-pressed="${mode === "hard"}">Přitvrdit</button>
      </div>` : guide ? `<div class="planet-status-actions">
        <button class="btn" type="button" data-guide-open="${esc(guide)}">Co znamená kontaminace?</button>
      </div>` : "";
      return `<li data-warning-row="${esc(key)}">${content}${actions}</li>`;
    }).join("") || "<li>" + empty + "</li>");
  }
  function renderPlanetStatus(world) {
    warningBar.hidden = !world || galaxyViewing;
    const s = world?.biosphere;
    $('planet-overview').hidden = !s;
    if (!s) return;
    if (climateDetails.open !== Boolean(state().planetOverviewOpen)) climateDetails.open = Boolean(state().planetOverviewOpen);
    const metrics = worldMetrics(world), [orbit] = describeWorld(world);
    const settlements = worldPresence(world).reduce((sum, group) => sum + group.settlements, 0);
    const groups = FaunaEvolution.habitatSummary(s);
    const { inner, outer } = E.zone(sim, 'temperate');
    const distance = Math.hypot(world.x, world.y);
    const band = distance < inner ? 'Horké pásmo' : distance > outer ? 'Chladné pásmo' : 'Mírné pásmo';
    renderWarnings(world, groups);
    put($('planet-status-name'), world.name);
    $('planet-status-previous').disabled = $('planet-status-next').disabled = sim.worlds.length < 2;
    put($('planet-status-temperature'), metrics.temperature);
    put($('planet-status-period'), metrics.period);
    put($('planet-status-orbit'), orbit + (metrics.bound ? ' · při 1×' : ''));
    put($('planet-status-people'), metrics.people);
    put($('planet-status-settlements'), worldSettlementLabel(settlements, 0));
    put($('planet-status-land-green'), metrics.landGreen);
    put($('planet-status-era'), stageName(world));
    put($('planet-status-fauna'), 'Skupiny zvěře · ' + groups.map(group => group.label + ' ' + group.count).join(' · '));
    put($('planet-status-band'), 'Poloha na dráze · ' + band);

    const tribal = $('planet-status-tribal');
    tribal.hidden = s.era !== 3;
    if (!tribal.hidden) {
      const percent = Math.floor(B.tribalProgress(s) * 100);
      const paused = B.faunaReadiness(s) <= 0;
      const waiting = s.tribalClimateReady === false;
      const note = percent === 100 && waiting ? 'Čeká na vhodné podmínky pro osídlení.'
        : paused ? 'Vývoj se pozastavil. Stáda potřebují potravu a vhodné prostředí.'
        : waiting ? 'Stáda se vyvíjejí. Vznik kmenů čeká na vhodné podmínky pro osídlení.'
        : 'Stáda se vyvíjejí ve vhodném prostředí.';
      $('planet-status-tribal-progress').value = percent;
      put($('planet-status-tribal-percent'), percent + ' %');
      put($('planet-status-tribal-note'), note);
    }
  }
  mount($('planet-overview'), `<section id="civic-overview" aria-label="Stav civilizace" hidden>
    <div id="civic-local-status">
    <div class="planet-status-heading">
      <h3 id="civic-status-name" class="planet-status-name"></h3><button class="btn name-pencil" id="civic-status-rename" type="button" aria-label="Přejmenovat civilizaci">✎</button>
      <div id="civic-status-arrows" class="planet-status-arrows" role="group" aria-label="Přepínání civilizací na planetě">
        <button class="btn world-arrow" id="civic-status-previous" type="button" aria-label="Předchozí civilizace">‹</button>
        <button class="btn world-arrow" id="civic-status-next" type="button" aria-label="Další civilizace">›</button>
      </div>
    </div>
    <p id="civic-status-location" class="planet-status-line"></p>
    <div id="civic-status-stats" class="numbers planet-status-stats">
      <div class="stat"><span class="smallcaps">Obyvatelé</span><output id="civic-status-people" aria-label="Obyvatelé civilizace"></output><small class="transit" id="civic-status-travel"></small></div>
      <div class="stat"><span class="smallcaps">Sídla</span><output id="civic-status-settlements" aria-label="Sídla civilizace"></output></div>
      <div class="stat"><span class="smallcaps">Jednotky</span><output id="civic-status-guards" aria-label="Jednotky civilizace"></output></div>
      <div class="stat"><span class="smallcaps">Základny</span><output id="civic-status-bases" aria-label="Robotické základny civilizace"></output></div>
    </div>
    <p id="civic-status-situation" class="planet-status-line"></p>
    <div class="planet-status-actions">
      <button class="btn primary" id="civic-status-adopt" type="button" aria-haspopup="dialog" hidden>Přijmout patronát</button>
      <button class="btn primary" id="civic-status-detail" type="button" aria-controls="map-planet-picker">Podrobnosti</button>
      <button class="btn primary" id="civic-status-find" type="button">Najít na mapě</button>
      <button class="btn primary" id="civic-status-list" type="button" aria-controls="map-planet-picker">Seznam osad</button>
    </div>
    </div>
  </section>`, 'afterend');
  for (const card of [...values.children]) {
    card.classList.add("stat", "civic-resource");
    card.firstElementChild.classList.add("smallcaps");
    $("civic-status-stats").append(card);
  }
  values.remove();
  const localCivilizations = world => worldPresence(world).filter(group => group.id).sort((a,b)=>a.id-b.id);
  function currentCivilization(world, choices) {
    const watched=globalThis.CosmoCompass?.id() ?? null;
    // Never silently substitute a foreign civilization on another world.
    if (watched) return choices.find(group=>group.id===watched);
    const id = state().civicOverview?.[world.id];
    return choices.find(group => group.id === id) ?? choices.find(group => group.id === sim.patron?.id) ?? choices[0];
  }
  function mapCivilizations(world) {
    const choices = world?.biosphere ? localCivilizations(world) : [];
    return { current: world && currentCivilization(world, choices)?.id, entries: choices.map(group => ({
      id: group.id, name: E.nationLabel(sim, group.id),
      detail: "Obyvatelé " + fmt(group.people) + " · Sídla " + fmt(group.settlements)
    })) };
  }
  function mapSettlements() {
    const world = viewedPlanet();
    if (!world?.biosphere) return { entries: [] };
    const group = currentCivilization(world, localCivilizations(world));
    if (!group) return { entries: [] };
    const faction = "civil:" + group.id;
    const settlements = (world.biosphere.communities ?? []).filter(c => c.active && c.civilization === group.id)
      .map(community => ({ id: world.id + ":" + community.id, world, community, faction }));
    const entries = [...settlements, ...robotBasesInScope([world]).filter(item => item.faction === faction)]
      .map(item => {
        const shortName = item.base ? baseLabel(item.base)
          : item.community.name || "Osada " + item.community.id;
        return { ...item, shortName, name: shortName + " · " + world.name };
      });
    return { current: (entries.find(item => item.id === state().citySelection) ?? entries[0])?.id, entries };
  }
  function syncSettlementFilter() {
    const world = viewedPlanet();
    const group = world && currentCivilization(world, localCivilizations(world));
    state().scope = "planet";
    patronBrowser.filter = "faction";
    patronBrowser.faction = group ? "civil:" + group.id : "";
  }
  function prepareMapSettlements() {
    state().tab = "cities";
    syncSettlementFilter();
  }
  function browseMapSettlement(direction) {
    const { current, entries } = mapSettlements();
    if (!entries.length) return;
    const index = entries.findIndex(item => item.id === current);
    const next = index < 0 ? entries[direction < 0 ? entries.length - 1 : 0]
      : entries[(index + direction + entries.length) % entries.length];
    selectMapSettlement(next);
  }
  function selectMapSettlement(item) {
    if (!item) return;
    prepareMapSettlements();
    if (state().cityExpanded !== item.id) state().cityExpanded = "";
    focusCity(item, false);
    const list = selectedCity().entries;
    const index = list.findIndex(entry => entry.id === item.id);
    state().citiesPage = Math.max(0, Math.floor(index / (state().citiesPageSize || 10)));
    updateUI();
  }
  function activateMapSettlements() {
    prepareMapSettlements();
    const { current, entries } = mapSettlements();
    const item = entries.find(entry => entry.id === current) ?? entries[0];
    if (item) selectMapSettlement(item);
    else updateUI();
  }
  mount($('civic-overview'), `<section id="settlement-overview" aria-label="Stav osady" hidden>
    <div class="planet-status-heading">
      <h3 class="planet-status-name" id="settlement-status-name"></h3><button class="btn name-pencil" id="settlement-status-rename" type="button" aria-label="Přejmenovat osadu" hidden>✎</button>
      <div class="planet-status-arrows" role="group" aria-label="Přepínání osad">
        <button class="btn world-arrow" id="settlement-status-previous" type="button" aria-label="Předchozí osada">‹</button>
        <button class="btn world-arrow" id="settlement-status-next" type="button" aria-label="Další osada">›</button>
      </div>
    </div>
    <p class="planet-status-line" id="settlement-status-context"></p>
    <div class="numbers planet-status-stats" id="settlement-status-stats"></div>
    <div class="planet-status-line" id="settlement-status-task"></div>
    <div class="planet-status-actions">
      <button class="btn primary" id="settlement-status-detail" type="button" aria-controls="map-planet-picker">Podrobnosti</button>
      <button class="btn primary" id="settlement-status-find" type="button">Najít na mapě</button>
      <button class="btn primary" id="settlement-status-list" type="button" aria-controls="map-planet-picker">Seznam osad</button>
    </div>
    <label class="compact-check batch-choice" id="settlement-status-batch-label"><input type="checkbox" id="settlement-status-batch"> Stejný pokyn ve všech dostupných vlastních osadách v soustavě</label>
    <div class="planet-status-actions" id="settlement-status-quick" aria-label="Rychlé pokyny"></div>
    <p class="planet-status-line" id="settlement-status-feedback" role="status"></p>
  </section>`, 'afterend');
  for (const [id, direction] of [['settlement-status-previous', -1], ['settlement-status-next', 1]]) {
    $(id).addEventListener("click", () => browseMapSettlement(direction));
  }
  $("settlement-status-list").addEventListener("click", () => {
    ui.field.scrollIntoView?.({block:"nearest"});
    setMapPicker(true, true);
  });
  $("settlement-status-detail").addEventListener("click", () => {
    const item = settlementSelection();
    if (!item) return;
    state().cityExpanded = item.id;
    selectMapSettlement(item);
    setMapPicker(true);
    updateUI();
    const detail = $("city-command");
    detail.scrollIntoView?.({ block: "nearest" });
    detail.tabIndex = -1;
    detail.focus({ preventScroll: true });
  });
  $("settlement-status-find").addEventListener("click", () => {
    const item = settlementSelection();
    if (!item) return;
    setMapPicker(false);
    selectMapSettlement(item);
    ui["surface-map"].scrollIntoView?.({ block: "nearest" });
    ui["surface-map"].focus({ preventScroll: true });
  });
  function renameSettlementItem(item) {
    if (!item?.community || item.community.civilization !== sim.patron?.id) return;
    openEntityRename("Přejmenovat osadu", item.shortName ?? item.community.name, 48,
      name => P.renameSettlement(sim, item.world, item.community.id, name));
  }
  $("settlement-status-rename").addEventListener("click", () => renameSettlementItem(settlementSelection()));
  let settlementFeedback, batchState, batchPatron;
  $("settlement-status-batch").addEventListener("change", () => updateUI());
  $("settlement-status-quick").addEventListener("click", event => {
    const action = event.target.closest("[data-settlement-action]")?.dataset.settlementAction;
    const item = settlementSelection();
    if (!action || !Object.hasOwn(settlementActionLabels, action)
      || !item?.community || item.community.civilization !== sim.patron?.id) return;
    let message;
    if ($("settlement-status-batch").checked) {
      const result = P.batchOrder(sim, P.members(sim), action);
      message = "Pokyn přijalo " + result.started + " osad · Přeskočeno " + result.skipped
        + (result.started ? " · " + E.priceLabel(result) : "")
        + (result.skipped ? ". " + Object.keys(result.reasons).join(". ") : "");
    } else {
      if (!settlementActions(item.world, item.community).includes(action)) return;
      message = P.order(sim, item.world, item.community.id, action);
    }
    settlementFeedback = { state: sim, id: item.id, text: message || "Pokyn přijat." };
    updateUI();
  });
  function settlementSelection() {
    const { current, entries } = mapSettlements();
    return entries.find(entry => entry.id === current);
  }
  function renderSettlementStatus() {
    const panel = $("settlement-overview");
    panel.hidden = mapNavigationKind !== "civic";
    if (panel.hidden) return;
    const { current, entries } = mapSettlements();
    const item = entries.find(entry => entry.id === current);
    $("settlement-status-previous").disabled = $("settlement-status-next").disabled = entries.length < (item ? 2 : 1);
    put($("settlement-status-name"), item?.shortName ?? "Bez osady");
    put($("settlement-status-context"), item ? item.world.name + " · " + E.nationLabel(sim, item.base?.civilization ?? item.community.civilization) : "");
    const stats = $("settlement-status-stats");
    stats.hidden = !item;
    $("settlement-status-detail").disabled = $("settlement-status-find").disabled = !item;
    const quick = $("settlement-status-quick");
    const own = Boolean(item && (item.base?.civilization ?? item.community?.civilization) === sim.patron?.id);
    panel.dataset.ownership = own ? "own" : "other";
    quick.hidden = $("settlement-status-batch-label").hidden = $("settlement-status-rename").hidden = !own || !item?.community;
    if (batchState !== sim || batchPatron !== sim.patron?.id) {
      $("settlement-status-batch").checked = false;
      batchState = sim;
      batchPatron = sim.patron?.id;
    }
    put($("settlement-status-feedback"), settlementFeedback?.state === sim && settlementFeedback.id === item?.id
      ? settlementFeedback.text : "");
    if (!item) {
      replaceSafe($("settlement-status-task"), "Ve vybrané civilizaci nejsou dostupné osady.");
      return;
    }
    const { world, community, base } = item;
    const grid = world.biosphere.power.grids?.[base?.civilization ?? community.civilization];
    const card = (label, value, note = "") => '<div class="stat"><span class="smallcaps">' + esc(label)
      + '</span><output>' + esc(value) + '</output>' + (note ? '<small class="transit">' + esc(note) + '</small>' : '') + '</div>';
    replaceSafe(stats, card("Obyvatelé a jednotky", fmt(community?.people), fmt(base?.guards ?? community?.guards) + " jednotek")
      + (community ? card("Jídlo osady", fmt(community.food) + " J") : "")
      + card("Energie civilizace", fmt(grid?.reserve) + " E", "Na planetě " + world.name)
      + card("Materiál civilizace", fmt(grid?.supplies) + " M", "Na planetě " + world.name));
    const work = community && task(community, world);
    replaceSafe($("settlement-status-task"), work
      ? "<strong>" + esc(work.title) + "</strong>"
        + (work.isJob ? progress(work.value, "Průběh pokynu") : "")
        + "<small>" + esc(work.phase) + "</small>"
      : esc(baseState(world, base)));
    const batch = !quick.hidden && $("settlement-status-batch").checked ? P.members(sim) : null;
    const actions = batch ? [...new Set(batch.flatMap(item => settlementActions(item.world, item.community)))]
      : !quick.hidden ? settlementActions(world, community) : [];
    if (!quick.hidden) replaceSafe(quick, actions.map(action => {
      const quote = batch && P.batchOrder(sim, batch, action, undefined, true);
      const issue = quote ? (quote.started ? "" : Object.keys(quote.reasons)[0] || "Žádná dostupná osada.")
        : P.block(sim, world, community, action);
      return '<button type="button" class="btn" data-settlement-action="' + action + '"'
        + (issue ? ' disabled' : '') + ' title="' + esc(issue || (quote
          ? "Dostupné osady: " + quote.started + " z " + batch.length + " · " + E.priceLabel(quote)
          : P.ACTIONS[action].note)) + '">'
        + esc(settlementActionLabels[action]) + '</button>';
    }).join(""));
  }
  function civicSeat(world, civilization) {
    const s = world.biosphere;
    return (s.communities ?? []).filter(c => {
      const town = s.towns[c.town];
      return c.active && c.civilization === civilization && c.people > 0
        && town && !town.abandoned && s.damage[town.home] < 0.78;
    }).sort((a,b) => b.people - a.people || a.id - b.id)[0];
  }
  function patronAction(world, id) {
    if (sim.over || !id) return "";
    if (sim.patron?.id === id) return "Vzdát se patronátu";
    return !sim.patron && civicSeat(world, id) ? "Přijmout patronát" : "";
  }
  function toggleCivilizationPatron(world, id) {
    if (!patronAction(world, id)) return;
    if (sim.patron?.id === id) $("release-confirm").showModal();
    else beginPatronConfirmation(world, civicSeat(world, id));
  }
  function renameCivilization(id) {
    const nation = sim.nations?.[id];
    if (nation) openEntityRename("Přejmenovat civilizaci", nation.name, 40, name => P.renameCivilization(sim, name, id));
  }
  function selectedCivilizationId(world) {
    return world && currentCivilization(world, localCivilizations(world))?.id;
  }
  $("civic-status-adopt").addEventListener("click", () => {
    const world = viewedPlanet();
    if (world) toggleCivilizationPatron(world, selectedCivilizationId(world));
  });
  $("civic-status-rename").addEventListener("click", () => renameCivilization(selectedCivilizationId(viewedPlanet())));
  let expandedCivilization;
  function renderCivilizationPicker() {
    const world = viewedPlanet();
    if (!world) return;
    const s = world.biosphere, groups = localCivilizations(world), current = currentCivilization(world, groups);
    const cards = groups.map(group => {
      const { id } = group;
      const name = E.nationLabel(sim, id), own = id === sim.patron?.id;
      const opened = expandedCivilization?.world === world && expandedCivilization.id === id;
      const people = (s.communities ?? []).filter(c => c.active && c.civilization === id);
      const bases = (s.robotBases ?? []).filter(base => base.civilization === id);
      const guards = [...people, ...bases].reduce((sum, item) => sum + (item.guards ?? 0), 0);
      const button = (action, label, extra = "") => '<button type="button" class="btn" data-civilization-action="' + action
        + '" data-nation="' + id + '" ' + extra + '>' + esc(label) + '</button>';
      const patron = patronAction(world, id);
      const grid = s.power.grids?.[id];
      return '<article class="civilization-picker-card" data-ownership="' + (own ? "own" : "other") + '">'
        + '<div class="civilization-picker-heading">'
        + button("select", name, 'aria-current="' + String(group === current) + '"')
        + button("rename", "✎", 'aria-label="Přejmenovat civilizaci"') + '</div>'
        + '<small>' + esc("Obyvatelé " + fmt(group.people) + " · Sídla " + fmt(group.settlements)
          + " · Jednotky " + fmt(guards) + " · Základny " + fmt(bases.length)) + '</small>'
        + bases.map(base => '<p class="planet-status-line">' + baseLabel(base) + ' · ' + esc(baseState(world, base)) + '</p>').join('')
        + '<div class="planet-status-actions">'
        + button("details", opened ? "Sbalit podrobnosti" : "Podrobnosti", 'aria-expanded="' + String(opened) + '"')
        + button("find", "Najít na mapě") + (patron ? button("patron", patron) : "") + '</div>'
        + (opened ? '<p class="planet-status-line">' + esc(E.nationClimate(sim, id) + (grid
          ? " · Místní energie " + fmt(grid.reserve) + " E · Materiál " + fmt(grid.supplies) + " M" : "")) + '</p>' : '')
        + '</article>';
    });
    replaceSafe(ui["map-context-list"], cards.join("") || "<p>Na této planetě zatím nejsou žádné civilizace.</p>");
  }
  ui["map-context-list"].addEventListener("click", event => {
    const button = event.target.closest("[data-civilization-action]");
    const world = viewedPlanet();
    if (!button || !world) return;
    const id = Number(button.dataset.nation);
    switch (button.dataset.civilizationAction) {
      case "details":
        expandedCivilization = expandedCivilization?.world === world && expandedCivilization.id === id ? null : { world, id };
        renderCivilizationPicker();
        break;
      case "rename": renameCivilization(id); break;
      case "patron": toggleCivilizationPatron(world, id); break;
      case "find":
      case "select":
        setMapPicker(false, true);
        selectCivilization(id);
        ui["surface-map"].scrollIntoView?.({ block: "nearest" });
        break;
    }
  });
  function civilizationTotals() {
    const totals = new Map();
    const entry = id => {
      if (!totals.has(id)) totals.set(id, { id, settlements: 0, guards: 0, bases: 0 });
      return totals.get(id);
    };
    for (const { biosphere } of sim.worlds) {
      for (const c of biosphere?.communities ?? []) {
        if (!c.active || !c.civilization || c.people <= 0) continue;
        const total = entry(c.civilization);
        total.settlements++;
        total.guards += c.guards ?? 0;
      }
      for (const base of biosphere?.robotBases ?? []) {
        if (!base.civilization) continue;
        const total = entry(base.civilization);
        total.bases++;
        total.guards += base.guards ?? 0;
      }
    }
    return [...totals.values()].sort((a, b) => a.id - b.id);
  }
  function focusCivilization(world, id) {
    const s = world.biosphere, seat = civicSeat(world, id);
    const tile = seat?.home ?? s.robotBases?.find(base => base.civilization === id)?.tile
      ?? B.surfaceInstallations(s).find(asset => asset.owner === id)?.tile;
    if (Number.isInteger(tile) && tile >= 0 && tile < B.W * B.H)
      focusSettlementOnMap(world, tile, seat ? seat.town + 1 : 0);
  }
  function selectCivilization(id) {
    const world = viewedPlanet();
    if (!world || !localCivilizations(world).some(group => group.id === id)) return;
    (state().civicOverview ??= {})[world.id] = id;
    if (globalThis.CosmoCompass) globalThis.CosmoCompass.set(id, false);
    state().citySelection = state().cityExpanded = patronBrowser.selected = "";
    if (mapNavigationKind === "civic") {
      const seat = civicSeat(world, id);
      if (seat) state().citySelection = world.id + ":" + seat.id;
      activateMapSettlements();
    }
    focusCivilization(world, id);
    updateUI();
  }
  function browseCivilizationPanel(direction) {
    const world = viewedPlanet();
    if (!world) return;
    const choices = localCivilizations(world);
    if (choices.length < 2) return;
    const index = choices.indexOf(currentCivilization(world, choices));
    selectCivilization(choices[(index < 0 ? (direction < 0 ? choices.length - 1 : 0)
      : (index + direction + choices.length) % choices.length)].id);
  }
  function renderCivicStatus(world) {
    const s = world?.biosphere;
    const civic = mapNavigationKind === "civic";
    const resources = ui["resource-hud"];
    resources.hidden = true;
    $("civic-overview").hidden = !s || galaxyViewing;
    $("civic-local-status").hidden = !s;
    if (!s) return;
    const choices = localCivilizations(world);
    const group = currentCivilization(world, choices);
    const total = civic && group ? civilizationTotals().find(entry => entry.id === group.id) : null;
    const own = Boolean(group && group.id === sim.patron?.id);
    $("civic-overview").dataset.ownership = own ? "own" : "other";
    for (const card of $("civic-status-stats").querySelectorAll(".civic-resource")) card.hidden = !civic;
    resources.hidden = !civic || !own;
    const patron = patronAction(world, group?.id);
    $("civic-status-adopt").hidden = !patron || civic && own;
    $("civic-status-rename").hidden = !group;
    if (patron) put($("civic-status-adopt"), patron);
    $("civic-status-stats").hidden = !group;
    $("civic-status-arrows").hidden = !group;
    $("civic-status-detail").hidden = $("civic-status-find").hidden = !group;
    $("civic-status-list").hidden = !group || !(group.settlements || s.robotBases?.some(base => base.civilization === group.id));
    $("civic-status-previous").disabled = $("civic-status-next").disabled = choices.length < 2;
    put($("civic-status-name"), group ? E.nationLabel(sim, group.id) : "Bez civilizace");
    put($("civic-status-location"), world.name
      + (group ? " · " + (choices.indexOf(group) + 1) + " / " + choices.length : ""));
    const situation = $("civic-status-situation");
    if (!group) {
      situation.dataset.tone = "";
      const watched=globalThis.CosmoCompass?.id() ?? null;
      put(situation, watched ? "Sledovaná civilizace " + E.nationLabel(sim,watched) + " zde nepůsobí. Volba se nezměnila; vrať se k přehledu KOMPAS nebo zvol jiný národ."
        : "Na této planetě zatím nejsou sídla ani aktivní zařízení civilizací.");
      put($("civic-status-name"),watched ? E.nationLabel(sim,watched) : "Bez civilizace");
      return;
    }
    (state().civicOverview ??= {})[world.id] = group.id;
    const communities = (s.communities ?? []).filter(c => c.active && c.civilization === group.id);
    const bases = (s.robotBases ?? []).filter(base => base.civilization === group.id);
    const towns = new Set(communities.map(c => c.town + 1));
    const orbitalFight = s.spaceConflicts?.some(conflict => !conflict.finished
      && (conflict.civilization === group.id || communities.some(c => c.id === conflict.targetId)));
    const fighting = orbitalFight || s.battle?.sides.some(side => towns.has(side));
    const tension = s.border?.tension >= 7 && (towns.has(s.border.a) || towns.has(s.border.b));
    const hardship = communities.map(c => E.environment(s, c)).find(status => status.tone === "warn");
    const { residents, traveling } = civic ? P.populationBreakdown(sim, group.id) : { residents: group.people, traveling: 0 };
    put($("civic-status-people"), fmt(residents));
    put($("civic-status-travel"), traveling > 0 ? "Na cestě " + fmt(traveling) : "");
    put($("civic-status-settlements"), fmt(total?.settlements ?? group.settlements));
    put($("civic-status-guards"), fmt(total ? total.guards
      : communities.reduce((n, c) => n + (c.guards ?? 0), 0) + bases.reduce((n, base) => n + (base.guards ?? 0), 0)));
    put($("civic-status-bases"), fmt(total?.bases ?? bases.length));
    if (civic) renderCivicResources(group.id);
    situation.dataset.tone = fighting || tension || hardship ? "warn" : "";
    const localStatus = orbitalFight ? "Probíhá vojenský výsadek." : fighting ? "Probíhá boj na hranici."
      : tension ? "Roste napětí na hranici." : hardship ? hardship.reason
      : communities.length ? "Osídlení je v klidu." : bases.length ? "Na planetě působí technika civilizace." : "Bez osady nebo základny.";
    put(situation, (civic ? world.name + " · " : "") + localStatus);
  }
  for (const [id, direction] of [["civic-status-previous", -1], ["civic-status-next", 1]])
    $(id).addEventListener("click", () => browseCivilizationPanel(direction));
  $("civic-status-detail").addEventListener("click", () => {
    const world = viewedPlanet(), id = selectedCivilizationId(world);
    if (!id) return;
    expandedCivilization = { world, id };
    setMapPicker(true, true, mapNavigationKind === "civic" ? "civilizations" : "surface");
    updateUI();
    ui["map-context-list"].querySelector('[data-civilization-action="details"][data-nation="' + id + '"]')
      ?.scrollIntoView?.({ block: "nearest" });
  });
  $("civic-status-find").addEventListener("click", () => {
    const world = viewedPlanet(), id = selectedCivilizationId(world);
    if (!id) return;
    clearWeatherAim();
    setMapPicker(false);
    focusCivilization(world, id);
    ui["surface-map"].scrollIntoView?.({ block: "nearest" });
    ui["surface-map"].focus({ preventScroll: true });
  });
  $("civic-status-list").addEventListener("click", () => {
    const world = viewedPlanet(), id = selectedCivilizationId(world);
    if (!id) return;
    if (mapNavigationKind !== "civic") {
      document.querySelector('[data-hud-mode="civic"]')?.click();
      selectCivilization(id);
    }
    setMapPicker(true, true);
    ui.field.scrollIntoView?.({ block: "nearest" });
  });
  function compassCivicAction(action, id) {
    // Observation is NEVER equivalent to patronage. Existing authorization
    // checks remain inside the original civic / patronage action handlers.
    id = Number(id);
    if (!id || !sim.worlds?.length) return;
    const world = sim.worlds.find(w => w.biosphere && localCivilizations(w).some(g=>g.id===id));
    if (action === "rename") { renameCivilization(id); return; }
    if (action === "adopt") {
      if (world && patronAction(world,id)) toggleCivilizationPatron(world,id);
      return;
    }
    if (action === "list") {
      state().tab = "cities";
      state().scope = "all";
      patronBrowser.filter = "faction";
      patronBrowser.faction = "civil:" + id;
      state().citySelection = state().cityExpanded = "";
      setMapPicker(false);
      updateUI();
      return;
    }
    if (!world) return;
    if (action === "find" || action === "detail") {
      showSurface(world, false);
      (state().civicOverview ??= {})[world.id] = id;
      if (action === "find") {
        setMapPicker(false);
        focusCivilization(world,id);
      } else {
        expandedCivilization = {world,id};
        setMapPicker(true,true,"civilizations");
      }
      updateUI();
    }
  }
  $('planet-overview').after($('life-notice'), $('life-chronicle'));
  const lifePanel = $('life-chronicle'), lifeFilter = $('life-filter'), lifeNotice = $('life-notice');
  const lifePageSize = 8;
  let lifeWorld, lifeShown = lifePageSize, lifeSeen = 0, lifeNoticeUntil = 0, lifeRenderKey = '';
  const lifeDate = time => E.dateLabel(E.dateAt(sim, time));
  const lifeClimate = item => LifeChronicle.phases[item.phase] + ' · Led ' + item.ice + ' % · Vegetace ' + item.vegetation
    + ' % · Srážky na ' + item.rain + ' % povrchu';
  function renderLifeChronicle() {
    const world = viewedPlanet(), record = world?.lifeChronicle;
    lifePanel.hidden = !world?.biosphere;
    if (lifeWorld !== world) {
      lifeWorld = world;
      lifeSeen = record?.totalEvents ?? 0;
      lifeNoticeUntil = 0;
      lifeShown = lifePageSize;
      lifeRenderKey = '';
    }
    const now = performance.now();
    if (record && record.totalEvents > lifeSeen) {
      const update = record.events.slice().reverse().find(e => e.id > lifeSeen &&
        ['appearance', 'return', 'absence', 'collapse', 'refuge', 'rebirth', 'era', 'branch', 'extinction', 'faunaStage'].includes(e.kind));
      lifeSeen = record.totalEvents;
      if (update && !record.settled && lifeNoticeUntil <= now) {
        put(lifeNotice, LifeChronicle.label(update));
        lifeNoticeUntil = now + 6000;
      }
    }
    lifeNotice.hidden = lifePanel.hidden || Boolean(record?.settled) || lifeNoticeUntil <= now;
    if (lifeNotice.hidden) put(lifeNotice, '');
    if (lifePanel.hidden) return;
    put($('life-title'), record?.settled ? 'Život a kronika · statistika' : 'Život a kronika');
    if (!lifePanel.open) return;
    const filter = lifeFilter.value, current = record?.current;
    const key = [record?.totalEvents, record?.lastReading, filter, lifeShown].join('/');
    if (lifeRenderKey === key) return;
    lifeRenderKey = key;
    put($('life-description'), world.name + (record?.settled ? ' · Pasivní statistika po vzniku osídlení.' : ' · Pozorování života a podmínek na povrchu.'));
    put($('life-climate'), current ? lifeClimate(current.climate) + ' · Voda ' + current.climate.water + ' %' : 'První měření vznikne, až poběží čas.');
    const s = world.biosphere;
    const evolution = FaunaEvolution.overview(s);
    replaceSafe($('life-stages'), evolution.stages.map(item =>
      '<li>' + (item.reached ? '<strong>' + esc(item.label) + '</strong> · zaznamenáno' : esc(item.label) + ' · zatím bez záznamu') + '</li>').join(''));
    const groups = evolution.groups.map(({label, count, generation, shift}) =>
      '<li><strong>' + esc(label) + '</strong> · ' + count + (count === 1 ? ' skupina' : count <= 4 ? ' skupiny' : ' skupin')
      + (generation ? ' · až ' + generation + '. generace' : '')
      + (Math.abs(shift) >= 0.03 ? ' · ' + esc(FaunaEvolution.adaptation(shift)) : '') + '</li>');
    if (current?.microbes > 0) groups.unshift('<li><strong>Mikrobiální kolonie</strong> · pokrytí ' + current.microbes + ' % sledovaných polí</li>');
    replaceSafe($('life-species'), groups.join('') || '<li>V posledním měření nejsou údaje o aktivních populacích.</li>');
    const exposure = Object.entries(record?.species ?? {}).filter(([, item]) => Object.keys(item.exposure).length);
    replaceSafe($('life-exposure'), exposure.length ? exposure.map(([key, item]) => {
      const phases = Object.entries(item.exposure), total = phases.reduce((sum, [, v]) => sum + v.groupSeconds, 0);
      return '<li><strong>' + esc(B.FAUNA[key].name) + '</strong><ul>' + phases.map(([phase, value]) =>
        '<li>' + esc(LifeChronicle.phases[phase]) + ' · ' + Math.round(value.groupSeconds / total * 100)
        + ' % času · místní vlhkost ' + Math.round(value.moisture / value.groupSeconds * 100) + ' %</li>').join('') + '</ul></li>';
    }).join('') : '<li>Na první pozorování se čeká.</li>');
    const readings = record?.readings.slice(-12).reverse() ?? [];
    replaceSafe($('life-readings'), readings.length ? readings.map(item =>
      '<li><time>' + esc(lifeDate(item.time)) + '</time> ' + esc(lifeClimate(item)) + '</li>').join('') : '<li>Zatím bez měření.</li>');
    const events = (record?.events ?? []).filter(event => filter === 'all' || (filter === 'evolution' ? LifeChronicle.isEvolution(event) : LifeChronicle.isClimate(event) === (filter === 'climate'))).reverse();
    replaceSafe($('life-events'), events.length ? events.slice(0, lifeShown).map(event =>
      '<li><time>' + esc(lifeDate(event.time)) + '</time> ' + esc(LifeChronicle.label(event)) + '</li>').join('')
      : '<li>Pro tento výběr zatím nejsou záznamy.</li>');
    $('life-more').hidden = events.length <= lifeShown;
  }
  lifePanel.addEventListener('toggle', renderLifeChronicle);
  lifeFilter.addEventListener('change', () => { lifeShown = lifePageSize; renderLifeChronicle(); });
  $('life-more').addEventListener('click', () => { lifeShown += lifePageSize; renderLifeChronicle(); });
  // Move the complete maintenance UI into the Buildings tab. Only confirmations remain modal.
  const buildingPanel=ui['buildings-dialog'];buildingPanel.classList.add('inline-buildings');ui['world-navigation'].append(buildingPanel);
  buildingPanel.querySelector('[data-dialog-value="close"]').remove();
  buildingPanel.querySelector('.economy-hint').textContent='Místní stavby, jejich vlastníci a údržba. Simulace pokračuje; při práci můžeš použít pauzu.';
  buildingPanel.showModal=()=>{state().tab='buildings';buildingPanel.hidden=false;buildingPanel.setAttribute('open','');};
  buildingPanel.append(ui['buildings-open']);ui['buildings-open'].hidden=true;ui['buildings-strip'].hidden=true;
  mount(ui['buildings-filter'].closest('.economy-fields'), '<label>Civilizace <select id="buildings-owner"><option value="all">Všechny civilizace</option><option value="mine">Moje civilizace</option></select></label><label>Město <select id="buildings-town"><option value="all">Všechna města</option></select></label><label>Typ <select id="buildings-kind"><option value="all">Všechny typy</option></select></label>');
  function addPager(id, key, before) {
    mount(before, '<div class="building-pagination"><button class="btn" id="' + id + '-prev" type="button">‹ Předchozí</button>'
      + '<span id="' + id + '-page"></span><label>Záznamů na stránku <select id="' + id + '-page-size">'
      + PAGE_SIZES.map(size => '<option>' + size + '</option>').join('') + '</select></label>'
      + '<button class="btn" id="' + id + '-next" type="button">Další ›</button></div>', 'beforebegin');
    for (const [suffix, delta] of [["prev", -1], ["next", 1]]) $(id + "-" + suffix).addEventListener("click", () => {
      state()[key + "Page"] = (state()[key + "Page"] ?? 0) + delta;
      if (id === "cities") state().cityExpanded = "";
      updateUI();
    });
    $(id + "-page-size").addEventListener("change", event => {
      state()[key + "PageSize"] = Number(event.target.value);
      state()[key + "Page"] = 0;
      if (id === "cities") state().cityExpanded = "";
      updateUI();
    });
  }
  function listPage(id, count, label) {
    const size = PAGE_SIZES.includes(state()[id + "PageSize"]) ? state()[id + "PageSize"] : 10;
    const pages = Math.max(1, Math.ceil(count / size));
    const page = state()[id + "Page"] = Math.max(0, Math.min(pages - 1, state()[id + "Page"] || 0));
    $(id + "-page-size").value = String(size);
    $(id + "-prev").disabled = page === 0;
    $(id + "-next").disabled = page === pages - 1;
    put($(id + "-page"), "Strana " + (page + 1) + " / " + pages + " · " + count + " " + label);
    return {start: page * size, end: (page + 1) * size};
  }
  addPager("buildings", "building", ui["buildings-list"]);
  addPager("cities", "cities", $("city-cards"));
  addPager("technology", "technology", $("technology-cards"));
  for(const id of ['buildings-world','buildings-filter','buildings-owner','buildings-town','buildings-kind'])$(id).addEventListener('change',()=>{state().buildingPage=0;ui['buildings-list'].dataset.signature='';updateUI();});
  ui['buildings-world'].addEventListener('change',()=>{$('buildings-town').value='all';const world=buildingPlanet();if(world){selected=world.id;state().buildingWorldContext=world.id;if(surfaceId)showSurface(world,false);}updateUI();});
  function selectChoices(select,rows){const old=select.value,html=rows.map(([v,label])=>'<option value="'+esc(v)+'">'+esc(label)+'</option>').join('');if(select.dataset.choices!==html){select.innerHTML=html;select.dataset.choices=html;select.value=rows.some(r=>String(r[0])===old)?old:rows[0][0];}}
  function buildingFilters(){
    const world=buildingPlanet();if(!world)return;
    const all=B.buildings(world.biosphere);
    selectChoices($('buildings-owner'),[['all','Všechny civilizace'],...(sim.patron?[['mine','Moje civilizace']]:[]),...[...new Set(all.map(b=>E.buildingOwner(b)))].filter(Boolean).map(id=>[id,E.nationLabel(sim,id)])]);
    selectChoices($('buildings-town'),[['all','Všechna města'],...world.biosphere.towns.map((t,i)=>[i,world.biosphere.communities?.find(c=>c.town===i)?.name||'Osada '+(i+1)])]);
    const labels={2:'Pole',3:'Obydlí',4:'Městské domy',5:'Továrny',6:'Větrné elektrárny',7:'Solární elektrárny',8:'Tepelné elektrárny',9:'Vodní elektrárny',10:'Teraformery',port:'Přístavy',monument:'Monumenty'};
    selectChoices($('buildings-kind'),[['all','Všechny typy'],...[...new Set(all.map(b=>b.kind))].map(k=>[String(k),labels[k]??'Typ '+k])]);
  }
  const scopedBuildings=updateBuildingsUI;
  updateBuildingsUI=()=>{if(buildingPanel.open){setWorldOptions(ui['buildings-world'],sim.worlds.filter(w=>w.biosphere));buildingFilters();}scopedBuildings();ui['buildings-strip'].hidden=true;};
  // Player chronicle records events emitted synchronously by a deliberate UI action.
  // It never copies autonomous/system history and never backfills earlier saves.
  mount($('civilization-actions'), '<button class="btn" type="button" id="player-chronicle-open">Kronika mých činů</button>');
  mount(document.body, '<dialog id="player-chronicle"><div class="dialog-head"><h2>Kronika mých činů</h2><button class="btn" id="player-chronicle-close" type="button">Zavřít</button></div><p>Důležité potvrzené činy od zavedení kroniky. Zůstává zachovaná při změně patronátu; běžné události světa najdeš v kronice soustavy.</p><ol id="player-chronicle-list"></ol></dialog>');
  $('player-chronicle-open').addEventListener('click',()=>{$('player-chronicle').showModal();renderPlayerChronicle();});
  mount($('observer-cities'), '<button class="btn" id="observer-chronicle" type="button">Kronika mých činů</button>','afterend');
  $('observer-chronicle').addEventListener('click',()=>{$('player-chronicle').showModal();renderPlayerChronicle();});
  $('player-chronicle-close').addEventListener('click',()=>$('player-chronicle').close());
  mount($('log-title'), ' <button class="btn" type="button" id="system-chronicle-open">Rozbalit</button>', 'afterend');
  mount(document.body, '<dialog id="system-chronicle"><div class="dialog-head"><h2>Deník hry</h2>'
    + '<button class="btn" id="system-chronicle-close" type="button">Zavřít</button></div>'
    + '<div class="chronicle-filters"><label>Události <select id="chronicle-filter"><option value="all">Všechny události</option><option value="orbit">Soustava</option><option value="surface">Povrch a klima</option><option value="civic">Civilizace</option>'
    + '<option value="loss">Konec posledního patronátu</option></select></label>'
    + '<label>Hledat <input type="search" id="chronicle-search" placeholder="Planeta, osada, příčina"></label>'
    + '<label><input id="chronicle-quiet" type="checkbox"> Omezit rutinní hlášení</label></div>'
    + '<p id="chronicle-note"></p><ol id="system-chronicle-list"></ol></dialog>');
  addPager("chronicle", "chronicle", $("system-chronicle-list"));
  function openSystemChronicle(filter) {
    state().chroniclePage = 0;
    $('chronicle-filter').value = filter;
    $('chronicle-search').value = "";
    $('chronicle-quiet').checked = filter !== 'loss' && ui['log-quiet'].checked;
    $('system-chronicle').showModal();
    renderSystemChronicle();
  }
  $('system-chronicle-open').addEventListener('click', () => openSystemChronicle(journalScope()));
  $('system-chronicle-close').addEventListener('click', () => $('system-chronicle').close());
  for (const [id, event] of [['chronicle-filter', 'change'], ['chronicle-search', 'input'], ['chronicle-quiet', 'change']]) $(id).addEventListener(event, () => {
    state().chroniclePage = 0;
    renderSystemChronicle();
  });
  function renderSystemChronicle() {
    if (!$('system-chronicle').open) return;
    const loss = sim.patronLoss;
    const scope = $('chronicle-filter').value, filtered = scope === 'loss';
    const query = $('chronicle-search').value.trim().toLocaleLowerCase('cs');
    const events = (sim.history ?? []).filter(entry =>
      (filtered ? loss && entry.time <= loss.time && (entry.civilization === loss.civilization
        || entry.previousOwner === loss.civilization || entry.civilizations?.includes(loss.civilization))
        : Journal.matches(entry, scope, $('chronicle-quiet').checked))
      && entry.message.toLocaleLowerCase('cs').includes(query)).reverse();
    const page = listPage("chronicle", events.length, "událostí");
    put($('chronicle-note'), filtered && loss ? loss.message : sim.historyTruncatedBefore !== undefined ? 'Nejstarší události už tato pozice neuchovává.' : '');
    replaceSafe($('system-chronicle-list'), events.length ? events.slice(page.start, page.end).map(entry =>
      '<li><time>' + esc(E.dateLabel(entry.date ?? E.dateAt(sim, entry.time))) + '</time> <span>' + esc(entry.message) + '</span></li>').join('')
      : '<li>Žádné zaznamenané události pro tento výběr.</li>');
  }
  const priorModal=modalOpen;modalOpen=()=>priorModal()||$('player-chronicle').open||$('system-chronicle').open;
  function renderPlayerChronicle(){
    if(!$('player-chronicle').open)return;
    const entries=sim.playerChronicle??[];
    replaceSafe($('player-chronicle-list'),entries.length?entries.slice().reverse().map(e=>'<li><time>'+esc(E.dateLabel(e.date))+'</time><strong>'+esc(e.civilizationName||'Pozorovatel')+'</strong><span>'+esc(e.message)+'</span></li>').join(''):'<li>Zatím žádný zaznamenaný čin. Kronika zpětně nedoplňuje minulost.</li>');
  }
  for(const type of ['click','pointerdown','pointerup','keydown']) {
    document.addEventListener(type,()=>{const context={state:sim,civilization:sim.patron?.id??0,civilizationName:sim.patron?.name??'Pozorovatel'};globalThis.playerActionContext=context;queueMicrotask(()=>{if(globalThis.playerActionContext===context)globalThis.playerActionContext=null;});},true);
    window.addEventListener(type,()=>{globalThis.playerActionContext=null;});
  }
  function recordPower(surface,label,point){
    const context=globalThis.playerActionContext;if(context?.state!==sim)return;
    const world=sim.worlds.find(w=>w.biosphere===surface);if(!world)return;
    if(weatherPointer?.chronicleRecorded)return;
    if(weatherPointer)weatherPointer.chronicleRecorded=true;
    (sim.playerChronicle??=[]).push({time:sim.time,date:E.dateAt(sim),civilization:context.civilization,civilizationName:context.civilizationName,message:world.name+' · '+label+(point?' · Pole '+(Math.floor(point.x)+1)+', '+(Math.floor(point.y)+1):'')});
  }
  for(const [key,label] of [['temper','Zásah teplotou'],['sculpt','Úprava terénu'],['gust','Poryv větru'],['toggleSpring','Přepnutí pramene'],['toggleVolcano','Přepnutí sopky']]){
    const apply=B[key];B[key]=function(surface,...args){const result=apply.call(this,surface,...args);recordPower(surface,key==='temper'?(args[1]>0?'Ohřev':'Ochlazení'):label,args[0]);return result;};
  }
  const changeStation=B.setStationMode;
  B.setStationMode=(surface,mode,id)=>{const before=surface.stations.find(s=>s.id===id)?.mode,result=changeStation(surface,mode,id),after=surface.stations.find(s=>s.id===id)?.mode;if(after&&before!==after)recordPower(surface,'Teraformer '+id+' · '+(B.STATION_MODES[after]??after));return result;};
  mount(ui['resource-hud'],'<section id="patron-loss-alert" role="alert" hidden><strong>Patronát skončil</strong><p id="patron-loss-message"></p><button class="btn" id="patron-loss-chronicle" type="button">Zobrazit v kronice soustavy</button><button class="btn" id="patron-loss-dismiss" type="button">Rozumím</button><button class="btn" id="patron-loss-choose" type="button">Prohlédnout jiné civilizace</button></section>','beforebegin');
  $('patron-loss-chronicle').addEventListener('click', () => openSystemChronicle('loss'));
  $('patron-loss-dismiss').addEventListener('click',()=>{if(sim.patronLoss)sim.patronLoss.acknowledged=true;updateUI();});
  $('patron-loss-choose').addEventListener('click',()=>openCities());
  mount(ui['surface-readout'],'<div id="border-legend" aria-label="Legenda hranic"></div>','afterend');
  function renderOwnership(){
    const loss=sim.patronLoss;if(loss&&sim.patron)loss.acknowledged=true;
    $('patron-loss-alert').hidden=!loss||loss.acknowledged||Boolean(sim.patron);put($('patron-loss-message'),loss?.message??'');
    const world=viewedPlanet();$('border-legend').hidden=!world;if(!world)return;
    const groups = worldPresence(world);
    const labels = groups.map(({id, settlements, installations}) => {
      const color = sim.nations[id]?.color ?? '#9aaec2';
      return '<span><i style="background:' + esc(color) + '"></i>' + esc(E.nationLabel(sim,id))
        + (settlements ? '' : installations.has('Robotická základna') ? ' · ROBOTICKÁ ZÁKLADNA' : ' · TECHNIKA') + (id === sim.patron?.id ? ' · TVOJE' : '') + '</span>';
    });
    if (groups.some(group => group.settlements)) labels.push('<span><i class="selected-border"></i>Bílá přerušovaná = vybraná osada</span>');
    $('border-legend').hidden = !labels.length;
    replaceSafe($('border-legend'), labels.join(''));
  }
  // One disclosure row above the map, no duplicate bottom navigation.
  ui['world-navigation'].classList.add('top-management');
  $('planet-overview').before(ui['world-navigation']);
  ui['patron-open'].hidden=true;ui['economy-open'].hidden=true;
  const economicPanel=ui['economy-dialog'];economicPanel.classList.add('inline-economy');economicPanel.setAttribute('role','region');ui['world-navigation'].append(economicPanel);
  for(const button of economicPanel.querySelectorAll('[data-dialog-value="close"]'))button.remove();
  economicPanel.querySelector('.dialog-actions')?.remove();
  economicPanel.querySelector('.dialog-head .economy-hint').textContent='Společný výzkum civilizace, místní sklady a provoz. Rozbalení nezastavuje čas; pauzu ovládáš ručně.';
  economicPanel.showModal=()=>{state().tab='economy';economicPanel.hidden=false;economicPanel.setAttribute('open','');};
  economicPanel.close=()=>{state().tab=null;economicPanel.removeAttribute('open');economicPanel.hidden=true;updateUI();};
  mount(economicPanel,'<nav class="economy-tabs" aria-label="Výzkum a logistika"><button class="btn" type="button" data-economy-tab="research">Výzkum</button><button class="btn" type="button" data-economy-tab="flights">Výpravy</button><button class="btn" type="button" data-economy-tab="supply">Zásobování</button><button class="btn quiet" type="button" id="economy-close">Zavřít přehled</button></nav>','afterbegin');
  $('economy-close').addEventListener('click',()=>economicPanel.close());
  econPanels[0].id='research-panel';econPanels[1].id='flights-panel';
  const researchShortcut = $("research-shortcut");
  researchShortcut.addEventListener("click", event => {
    event.preventDefault();
    if (!sim.patron) return;
    setMapPicker(false);
    state().tab = "economy";
    state().economyTab = "research";
    updateUI();
    if (!window.CosmoHUD?.showManagement?.()) economicPanel.scrollIntoView?.({ block: "nearest" });
    economicPanel.querySelector('[data-economy-tab="research"]').focus({ preventScroll: true });
  });
  mount(economicPanel.querySelector('.economy-columns'),'<section class="economy-panel" id="supply-panel"><h3>Zásobování a obchodní linky</h3><p>Cena i rezerva se odečítají pouze ze zvoleného místního zdroje. Výzkum platí celé civilizaci.</p></section>');
  for(const node of [economicPanel.querySelector('.shipment-amount'),$('shipment-send'),$('trade-route'),$('trade-route-status'),economicPanel.querySelector('.economy-link')].filter(Boolean))$('supply-panel').append(node);
  function renderEconomyTabs(){
    const tab=state().economyTab??'research';
    for(const button of economicPanel.querySelectorAll('[data-economy-tab]'))button.setAttribute('aria-pressed',String(button.dataset.economyTab===tab));
    for(const [id,key] of [['research-panel','research'],['flights-panel','flights'],['supply-panel','supply']])$(id).hidden=key!==tab;
    ui['economy-to'].closest('label').hidden=tab==='research';
  }
  economicPanel.querySelector('.economy-tabs').addEventListener('click',e=>{const tab=e.target.closest('[data-economy-tab]')?.dataset.economyTab;if(tab){state().economyTab=tab;updateUI();}});
  const research=E.research;
  E.research = (universe, world, key, id = universe.patron?.id, autonomous = false) => {
    const issue = research(universe, world, key, id, autonomous);
    if (!issue && universe === sim && id && id === sim.patron?.id) (state().lastResearch ??= {})[id] = key;
    return issue;
  };
  function renderResearchSummary(){
    const id = sim.patron?.id, pool = id && E.science(sim, id), active = pool?.science.active;
    researchShortcut.hidden = !id;
    researchShortcut.setAttribute("aria-expanded", String(Boolean(id) && state().tab === "economy"
      && (state().economyTab ?? "research") === "research"));
    if (active) (state().lastResearch ??= {})[id] = active;
    const key = active || state().lastResearch?.[id], spec = E.TECH[key];
    const value = spec && pool ? Math.floor(B.clampValue((pool.science.progress[key] ?? 0) / spec.work * 100, 0, 100)) : 0;
    const source = pool?.science.activeSource;
    const paused = pool?.science.manualPause;
    let status = !id ? "Bez patronátu"
      : paused ? "Ručně pozastaveno"
      : pool.faith < 10 ? "Automaticky · čeká na víru " + pool.faith + "/10"
      : Object.keys(E.TECH).every(tech => E.knows(sim, id, tech)) ? "Všechny technologie dokončeny"
      : "Automaticky · civilizace vybírá podle dostupných zdrojů";
    if (active) {
      const grids = sim.worlds.filter(w => E.owns(sim, w, id) && E.civEra(sim, w, id) >= 5).map(w => E.grid(sim, w, id));
      const reserves = grids.filter(g => g.reserve >= 20);
      const stocked = reserves.filter(g => g.supplies >= 2);
      const running = stocked.some(g => g.output - g.demand + (g.programDraw ?? 0) > 0.001);
      const origin = source === "player" ? "Pokyn hráče" : source === "automatic" ? "Automaticky" : "";
      const phase = sim.paused ? "Čas pozastaven" : pool.faith < 10 ? "Čeká na víru 10/10"
        : !grids.length ? "Čeká na město" : !reserves.length ? "Čeká na místní rezervu 20 E"
        : !stocked.length ? "Čeká na místní materiál 2 M" : running ? "Probíhá" : "Čeká na přebytek energie";
      status = [origin, phase].filter(Boolean).join(" · ");
    }
    const technology = spec && (active || paused || value === 100) ? (active || value < 100 ? spec.name : "Dokončeno: " + spec.name) : "";
    const label = [technology, status].filter(Boolean).join(" · ");
    put($("research-summary"), "Výzkum · " + label + (technology ? " · " + value + " %" : ""));
    $("research-summary").title = "Společný výzkum civilizace. Kosmodrom je samostatný místní projekt.";
    const global = $("global-research-progress");
    global.hidden = !id;
    if (!global.hidden) {
      replaceSafe(global, "<span>Výzkum · " + esc(label) + "</span>" + (technology ? progress(value, "Výzkum " + spec.name, true) : ""));
    }
    const button=document.querySelector('[data-deck-action="tab:economy"]');button.disabled=!id&&sim.mode!=='biosphere';
    if(state().tab==='economy')renderEconomyTabs();
  }
  mount($("map-management-content"), `<section class="system-command-bar world-options" id="system-command-bar" aria-label="Správa soustavy" hidden>
    <nav aria-label="Akce civilizace v soustavě">
      <button class="btn" type="button" data-system-panel="projects" aria-expanded="false">Planetární projekty</button>
      <button class="btn" type="button" data-system-panel="diplomacy" aria-expanded="false">Diplomacie a obchod</button>
      <button class="btn" type="button" data-system-panel="army" aria-expanded="false">Armáda</button>
      <button class="btn" type="button" data-system-panel="colonies" aria-expanded="false">Kolonizace</button>
    </nav>
    <div id="system-command-body" class="system-command-body" hidden>
      <p id="system-stage" class="system-command-wide economy-hint"></p>
      <div id="system-project-progress" class="world-project-progress system-command-wide" hidden></div>
      <label>Zdrojový svět <select id="system-source"></select></label>
      <label id="system-world-target-field">Cílový svět pro let <select id="system-world-target"></select></label>
      <label id="system-town-source-field">Výchozí osada <select id="system-town-source"></select></label>
      <label id="system-town-target-field">Cílová osada <select id="system-town-target"></select></label>
      <label id="system-project-field">Planetární projekt <select id="system-project"></select></label>
      <label id="system-reserve-field">Rezerva při automatickém vývozu M <input id="system-reserve" type="number" min="0" max="65" step="1"></label>
      <label id="system-ban-field"><span><input id="system-ban" type="checkbox"> Vyloučit cíl z automatické kolonizace</span></label>
      <div class="city-heading-actions system-command-wide">
        <button class="btn primary" type="button" id="system-local-action"></button>
        <button class="btn" type="button" id="system-flights">Meziplanetární výpravy</button>
      </div>
      <output id="system-action-feedback" class="system-command-wide" role="status"></output>
    </div>
  </section>`, "afterbegin");
  const commandBar = $("system-command-bar");
  const commandWorld = id => sim.worlds.find(world => world.id === Number($(id).value));
  const commandTown = id => Number($(id).value);
  function planetProgress(world, id) {
    if (!world) return "";
    const activities = [];
    const grid = E.owns(sim, world, id) ? E.grid(sim, world, id) : null;
    if (grid?.program?.funded) {
      const value = B.clampValue(grid.work / B.PROBE_WORK * 100, 0, 100);
      const pool = E.science(sim, id);
      const wait = sim.paused ? "čas pozastaven" : grid.program.manualPause ? "ručně pozastaveno"
        : !grid.program.active ? "stavba stojí" : pool.faith < 10 ? "čeká na víru 10/10"
        : pool.science.active ? "čeká na dokončení výzkumu"
        : grid.reserve < 20 ? "čeká na rezervu 20 E" : grid.supplies < 2 ? "čeká na 2 M"
        : grid.output - grid.demand + (grid.programDraw ?? 0) <= 0.001 ? "čeká na přebytek energie" : "";
      const title = value >= 100 ? E.portStatus(sim, world, id) : ["Stavba kosmodromu", wait].filter(Boolean).join(" · ");
      activities.push([title, value]);
    }
    if (grid?.project && grid.project !== "auto") {
      const community = world.biosphere.communities.find(c => c.active && c.civilization === id && ["energy", "mine"].includes(c.job?.kind));
      if (community) {
        const job = E.jobProgress(world.biosphere, community);
        activities.push([(community.name || "Osada " + community.id) + " · " + job.label, job.percent]);
      }
    }
    const inbound = sim.ships.find(ship => ship.civilization === id && ship.destination === world.id
      && ship.duration > 0 && (ship.missionType === "supply" || ship.missionType === "colony" || ship.missionType === "base"));
    if (inbound) {
      const name = Space.MISSIONS[inbound.missionType]?.name ?? "Dovoz materiálu";
      activities.push([name + " · na cestě", B.clampValue(inbound.elapsed / inbound.duration * 100, 0, 100)]);
    }
    const project = grid?.project ?? "auto";
    const status = project !== "auto"
      ? "Pokyn hráče · " + (activities.length ? Space.PROJECTS[project] : Space.projectStatus(sim, world, id)) : "";
    return (status ? '<small>' + esc(status) + '</small>' : '') + activities.map(([label, value]) =>
      '<div class="planet-activity"><span>' + esc(label) + '</span>' + progress(value, label) + '</div>').join("");
  }
  function renderSystemCommands() {
    const id = sim.patron?.id, mode = state().systemPanel;
    const showPlanets = mapNavigationKind === "orbit" && !ui["map-planet-picker"].hidden;
    commandBar.hidden = !showPlanets || !id;
    if (!showPlanets) return;
    const progressByWorld = new Map();
    for (const world of sim.worlds) {
      const content = id ? planetProgress(world, id) : "";
      progressByWorld.set(world.id, content);
      const panel = cards.get(world.id)?.row.querySelector(".world-project-progress");
      if (panel) {
        panel.hidden = !content;
        if (content) replaceSafe(panel, content);
      }
    }
    if (commandBar.hidden) return;
    $("system-command-body").hidden = !mode;
    for (const button of commandBar.querySelectorAll("[data-system-panel]")) {
      button.setAttribute("aria-expanded", String(button.dataset.systemPanel === mode));
    }
    if (!mode) return;
    const worlds = orderedWorlds().filter(world => Space.people(world, id) > 0);
    const source = $("system-source");
    selectChoices(source, worlds.length ? worlds.map(world => [world.id, world.name]) : [["", "Žádný obydlený svět"]]);
    const world = commandWorld("system-source");
    const rows = orderedWorlds().filter(candidate => candidate !== world).map(candidate => [candidate.id, candidate.name]);
    selectChoices($("system-world-target"), [["", "Vyber planetu"], ...rows]);
    const target = commandWorld("system-world-target");
    const local = mode === "diplomacy" || mode === "army", projects = mode === "projects", colonies = mode === "colonies";
    $("system-world-target-field").hidden = projects;
    $("system-town-source-field").hidden = $("system-town-target-field").hidden = !local;
    $("system-project-field").hidden = $("system-reserve-field").hidden = !projects;
    $("system-ban-field").hidden = !colonies;
    $("system-ban").disabled = !target;
    $("system-ban").checked = Boolean(sim.nations[id].noSettlement?.includes(target?.id));
    const towns = world?.biosphere.communities ?? [], town = c => c.name || "Osada " + c.id;
    if (local) {
      selectChoices($("system-town-source"), [["", "Vyber vlastní osadu"], ...towns.filter(c => c.active && c.civilization === id).map(c => [c.id, town(c)])]);
      selectChoices($("system-town-target"), [["", "Vyber cizí osadu na zdrojovém světě"], ...towns.filter(c => c.active && c.civilization !== id).map(c => [c.id, P.name(c)])]);
    }
    const stage = Space.planetStage(sim, id), grid = world && E.grid(sim, world, id);
    if (projects && $("system-project").dataset.world !== String(world?.id ?? "")) {
      selectChoices($("system-project"), Object.entries(Space.PROJECTS));
      $("system-project").dataset.world = String(world?.id ?? "");
      $("system-project").value = grid?.project ?? "auto";
      $("system-reserve").value = grid?.exportReserve ?? 25;
    }
    const projectMode = !grid?.project || grid.project === "auto" ? "Automatický rozvoj" : "Pokyn hráče";
    const message = !world ? "Vyber obydlenou planetu." : projects && stage === "local" ? "Projekty otevře obydlená kolonie a vlastní kosmodrom."
      : (stage === "recovery" ? "Obnova po ztrátě kosmodromu · " : "") + (projects ? projectMode + " · " : "") + Space.projectStatus(sim, world, id);
    const sourceTown = commandTown("system-town-source"), targetTown = commandTown("system-town-target");
    const armyIssue = mode === "army" && sourceTown && targetTown
      ? P.armyBlock(sim, world, towns.find(c => c.id === sourceTown), towns.find(c => c.id === targetTown)) : "";
    put($("system-stage"), [message, sim.nations[id].expansion ? "Připravuje se kolonizační výprava." : "", armyIssue].filter(Boolean).join(" · "));
    const projectProgress = $("system-project-progress");
    const content = projects && progressByWorld.get(world?.id);
    projectProgress.hidden = !content;
    if (content) replaceSafe(projectProgress, content);
    const localAction = $("system-local-action");
    localAction.hidden = !projects && !local;
    localAction.disabled = projects ? !world || stage === "local" : !sourceTown || !targetTown || Boolean(armyIssue);
    put(localAction, projects ? "Nastavit projekt" : mode === "army" ? "Vyslat jednotky" : "Zlepšovat vztahy");
    $("system-flights").hidden = projects;
    $("system-flights").disabled = !world;
    put($("system-flights"), colonies ? "Otevřít plán kolonizace" : "Meziplanetární výpravy");
  }
  commandBar.addEventListener("click", event => {
    const mode = event.target.closest("[data-system-panel]")?.dataset.systemPanel;
    if (!mode) return;
    state().systemPanel = state().systemPanel === mode ? null : mode;
    delete $("system-project").dataset.world;
    put($("system-action-feedback"), ""); renderSystemCommands();
  });
  commandBar.addEventListener("change", event => {
    if (event.target.id === "system-ban") {
      const target = commandWorld("system-world-target"), nation = sim.nations[sim.patron?.id];
      if (target && nation) {
        const bans = new Set(nation.noSettlement);
        if (event.target.checked) bans.add(target.id); else bans.delete(target.id);
        nation.noSettlement = [...bans];
      }
    }
    renderSystemCommands();
  });
  $("system-local-action").addEventListener("click", () => {
    const world = commandWorld("system-source"), mode = state().systemPanel;
    if (!world) return;
    const source = commandTown("system-town-source"), target = commandTown("system-town-target");
    const issue = mode === "projects" ? Space.setProject(sim, world, $("system-project").value, $("system-reserve").valueAsNumber)
      : mode === "army" ? P.orderArmy(sim, world, source, target) : P.setDiplomaticGoal(sim, world, source, target);
    put($("system-action-feedback"), issue || "Pokyn uložen."); updateUI();
  });
  $("system-flights").addEventListener("click", () => {
    setMapPicker(false);
    openFlights(commandWorld("system-source"), commandWorld("system-world-target"));
    $("economy-dialog").scrollIntoView?.({ block: "start" });
  });
  function renderCityNation(data) {
    const choice = $("city-nation");
    const patron = sim.patron?.id;
    const patronKey = patron ? "civil:" + patron : "";
    selectChoices(choice, data.factions.length ? data.factions.map(faction => [
      faction.id, faction.name + (faction.id === patronKey ? " · tvůj patronát" : "")
    ]) : [["", "Bez civilizace"]]);
    const faction = patronBrowser.filter === "faction" ? patronBrowser.faction : "";
    if (choice.value !== faction) choice.value = faction;
  }
  $("civic-overview").append(ui["resource-hud"]);
  ui.field.before(warningBar);
  const organizedUI=updateUI;
  updateUI=()=>{
    // A single synchronous rendering pass may request worldPresence several times
    // (planet cards, local civilization, borders). One read-only snapshot per
    // pass avoids repeated scans without delaying any game-state update.
    const previousPresenceSnapshot = uiPresenceSnapshot;
    uiPresenceSnapshot = new Map();
    try {
    return P.withHudCatalogue(() => {
    const detailed = typeof PerformanceHUD !== "undefined" && PerformanceHUD.active;
    const baseStart = detailed ? performance.now() : 0;
    organizedUI();
    if (detailed) PerformanceHUD.mark("hudBase", performance.now() - baseStart);
    const managementStart = detailed ? performance.now() : 0;
    renderSystemCommands();
    renderResearchSummary();
    $('observer-cities').hidden=Boolean(sim.patron);$('observer-chronicle').hidden=Boolean(sim.patron);ui['buildings-strip'].hidden=true;
    $('rename-selected-planet').disabled=!sim.worlds.some(w=>w.id===selected);$('rename-surface-planet').hidden=!viewedPlanet();
    const world = viewedPlanet();
    renderPlanetStatus(world);
    renderCivicStatus(world);
    renderSettlementStatus();
    if (mapNavigationKind === "civic") syncMapPicker(true);
    renderMapCityMirror();
    ui["patron-open"].hidden=true;ui["economy-open"].hidden=true;
    ui['patron-strip'].hidden = ui['economy-strip'].hidden = true;
    renderPlayerChronicle();renderSystemChronicle();renderOwnership();renderLifeChronicle();
    if (detailed) PerformanceHUD.mark("hudManagement", performance.now() - managementStart);
    });
    } finally {
      uiPresenceSnapshot = previousPresenceSnapshot;
    }
  };
  updateUI();
  return { compassCivicAction, openEquipment, openCities, openFlights, flightsOpen, flightPlanningIssue, managementOpen:()=>Boolean(state().tab && (state().tab !== "worlds" || !viewedPlanet())), focusCity, selectedCity, renderDock, filteredBuildings, task, equipmentData, browseEquipment,
    mapCivilizations, mapSettlements, prepareMapSettlements, activateMapSettlements, browseMapSettlement,
    manageMapWorld: world => {
      selected = world.id;
      state().systemPanel ??= "projects";
      renderSystemCommands();
      $("system-source").value = String(world.id);
      delete $("system-project").dataset.world;
      updateUI();
      commandBar.scrollIntoView?.({ block: "nearest" });
    },
    browseMapCivilization: browseCivilizationPanel,
    selectMapCivilization: selectCivilization, renderCivilizationPicker
  };
})();
