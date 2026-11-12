"use strict";
// MATRIOSKA M1 — KOMPAS. Read-only observation across existing game panels.
// Saved in sim.interface so observing a civilization never changes sim.patron.
const CosmoCompass = (() => {
  const $ = id => document.getElementById(id);
  const observed = () => {
    const value = sim?.interface?.observedCivilization;
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  };
  const local = (world, id = observed()) => Boolean(world?.biosphere && id && (
    (world.biosphere.communities || []).some(c => c.active && c.people > 0 && c.civilization === id)
    || (world.biosphere.robotBases || []).some(b => b.civilization === id)
    || Biosphere.surfaceInstallations(world.biosphere).some(b => b.owner === id)
  ));
  // Only living/active actors are offered; an already watched extinct civilization
  // remains selectable so the UI does not silently jump to somebody else.
  function nations() {
    const ids = new Set();
    for (const world of sim.worlds) {
      for (const c of world.biosphere?.communities ?? []) if (c.active && c.people > 0 && c.civilization > 0) ids.add(c.civilization);
      for (const b of world.biosphere?.robotBases ?? []) if (b.civilization > 0) ids.add(b.civilization);
      for (const b of world.biosphere ? Biosphere.surfaceInstallations(world.biosphere) : []) if (b.owner > 0) ids.add(b.owner);
    }
    for (const ship of sim.ships ?? []) if (ship.civilization > 0) ids.add(ship.civilization);
    for (const probe of sim.probes ?? []) if (probe.civilization > 0) ids.add(probe.civilization);
    if (sim.patron?.id) ids.add(sim.patron.id);
    if (observed()) ids.add(observed());
    return [...ids].sort((a,b) => a-b);
  }
  function totals(id) {
    let residents=0, settlements=0, robotBases=0, guards=0, worlds=0;
    for (const world of sim.worlds) {
      let present=false;
      for (const c of world.biosphere?.communities ?? []) if (c.active && c.people>0 && c.civilization===id) {
        residents += c.people; settlements++;guards+=c.guards??0;present=true;
      }
      for (const b of world.biosphere?.robotBases ?? []) if (b.civilization===id) {robotBases++;guards+=b.guards??0;present=true;}
      if (!present && world.biosphere && Biosphere.surfaceInstallations(world.biosphere).some(b=>b.owner===id)) present=true;
      if (present) worlds++;
    }
    const flights=(sim.ships??[]).filter(ship=>ship.civilization===id).length;
    return {residents,settlements,robotBases,guards,worlds,flights};
  }
  function set(value, redraw = true) {
    const id = Number(value);
    const next=Number.isSafeInteger(id)&&id>0?id:null;
    const before=observed(), settings=sim.interface ??= {};
    if (before===next) {if(redraw)updateUI();return;}
    // Keep the user's existing local view/filter when starting to watch a nation.
    if (!before && next) settings.compassPrevious={
      filter:patronBrowser.filter,faction:patronBrowser.faction,scope:settings.scope,
      equipmentFilter:settings.equipmentFilter,equipmentFaction:settings.equipmentFaction,
      equipmentScope:settings.equipmentScope,buildingOwner:$('buildings-owner')?.value ?? 'all'
    };
    settings.observedCivilization=next;
    // Observation does not assign a patron and does not move the camera or planet.
    // Existing local filters are aligned to prevent stale foreign selections.
    if (next) {
      patronBrowser.filter='faction'; patronBrowser.faction='civil:'+next; patronBrowser.selected='';
      sim.interface.scope='all';
      sim.interface.equipmentFilter='faction'; sim.interface.equipmentFaction=next;
      sim.interface.equipmentScope='all';
      sim.interface.citySelection=''; sim.interface.cityExpanded=''; sim.interface.equipment='';
      sim.interface.citiesPage=0; sim.interface.technologyPage=0; sim.interface.buildingPage=0;
      if ($('buildings-owner')) $('buildings-owner').value=String(next);
      if ($('buildings-list')) $('buildings-list').dataset.signature='';
    } else {
      const previous=settings.compassPrevious;
      patronBrowser.filter=['mine','all','faction'].includes(previous?.filter)?previous.filter:sim.patron?'mine':'all';
      patronBrowser.faction=typeof previous?.faction==='string'?previous.faction:'';patronBrowser.selected='';
      settings.scope=previous?.scope==='all'?'all':'planet';
      settings.equipmentFilter=['mine','all','faction'].includes(previous?.equipmentFilter)?previous.equipmentFilter:sim.patron?'mine':'all';
      settings.equipmentFaction=previous?.equipmentFaction;
      settings.equipmentScope=previous?.equipmentScope==='all'?'all':'planet';
      if ($('buildings-owner')) $('buildings-owner').value=previous?.buildingOwner??'all';
      if ($('buildings-list')) $('buildings-list').dataset.signature='';
      delete settings.compassPrevious;
    }
    if (redraw) updateUI();
  }
  let lastMarkup='', lastPaint=0, lastSim=null, lastId=null, lastPlanet=null, lastPatron=null;
  function paint(force=false) {
    const chooser=$('compass-nation');if (!chooser) return;
    const id=observed(), planet=typeof viewedPlanet==='function'?viewedPlanet():null;
    const now=performance.now();
    // Do not enumerate all worlds on every simulation tick at 4×/12×.
    if(!force && sim===lastSim && id===lastId && planet===lastPlanet && sim.patron?.id===lastPatron && now-lastPaint<650)return;
    lastPaint=now;lastSim=sim;lastId=id;lastPlanet=planet;lastPatron=sim.patron?.id;
    const ids=nations(), keys=['0',...ids.map(String)];
    const labels=['Všechny civilizace',...ids.map(x=>Evolution.nationLabel(sim,x)+(sim.patron?.id===x?' · pod patronátem':''))];
    const fingerprint=keys.join(',')+'|'+labels.join('|');
    if (chooser.dataset.options!==fingerprint) {
      const options=keys.map((key,i)=>new Option(labels[i],key));
      chooser.replaceChildren(...options); chooser.dataset.options=fingerprint;
    }
    chooser.value=String(id??0);
    const list=[null,...ids], index=list.indexOf(id);
    for (const key of ['compass-prev','compass-next']) $(key).disabled=list.length<2;
    const patron=sim.patron?.id;
    $('compass-patron').textContent=patron?'Patronát: '+Evolution.nationLabel(sim,patron):'Patronát: žádný';
    const name=id?Evolution.nationLabel(sim,id):'Všechny civilizace';
    $('compass-context').textContent='Sleduješ: '+name+' · '+(planet?'Planeta: '+planet.name:'Pohled: soustava / galaxie');
    const owner=id && patron===id?'TUTO CIVILIZACI OVLÁDÁŠ':id?'POUZE POZORUJEŠ':patron?'SLEDUJEŠ VŠECHNY · OVLÁDÁŠ JEN PATRONÁT':'POUZE POZOROVÁNÍ';
    $('compass-authority').textContent=owner;
    const detail=$('compass-detail'), warning=$('compass-not-here'), locate=$('compass-find');
    if (id) {
      const t=totals(id);
      const text=Evolution.nationLabel(sim,id)+' · '+t.worlds+' planet · '+t.settlements+' sídel · '+t.robotBases+' základen · '+Math.floor(t.residents).toLocaleString('cs-CZ')+' obyvatel · '+t.flights+' lodí na cestě';
      if (detail.textContent!==text) detail.textContent=text;
    } else detail.textContent=ids.length+' aktivních / sledovaných civilizací v soustavě · Bez společného filtru; místní filtry panelů zůstávají';
    // Civic dashboard duplicates only presentation and delegates existing actions
    // to GameInterface. It never changes ownership or creates a separate economy.
    const card=$('compass-civic-card');
    card.hidden=!id;
    if(id){
      const t=totals(id), wallet=Evolution.wallet(sim,id);
      const travel=Patronage.populationBreakdown?.(sim,id)?.traveling??0;
      const fmt = n => Math.floor(n??0).toLocaleString('cs-CZ');
      $('compass-civic-name').textContent=Evolution.nationLabel(sim,id);
      $('compass-civic-people').textContent=fmt(t.residents)+(travel?' · na cestě '+fmt(travel):'');
      $('compass-civic-settlements').textContent=fmt(t.settlements);
      $('compass-civic-guards').textContent=fmt(t.guards);
      $('compass-civic-bases').textContent=fmt(t.robotBases);
      $('compass-civic-wallet').textContent='Zásoby civilizace (součet místních skladů): '+fmt(wallet.food)+' J · '+fmt(wallet.energy)+' E · '+fmt(wallet.supplies)+' M · '+fmt(wallet.points)+' VB';
      const own=sim.patron?.id===id;
      $('compass-civic-permission').textContent=own?'Pod patronátem · dostupné vlastní pokyny':'Pouze pozorování · bez oprávnění řídit cizí osady';
      const canAdopt=!sim.patron && sim.worlds.some(w=>w.biosphere?.communities?.some(c=>c.active&&c.people>0&&c.civilization===id));
      $('compass-civic-adopt').hidden=!canAdopt;
      $('compass-civic-find').disabled=!sim.worlds.some(w=>local(w,id));
      $('compass-civic-detail').disabled=!sim.worlds.some(w=>local(w,id));
      $('compass-civic-list').disabled=!t.settlements&&!t.robotBases;
    }
    warning.hidden=!(id && planet && !local(planet,id));
    if (!warning.hidden) warning.textContent='Sledovaná civilizace '+name+' na planetě '+planet.name+' nepůsobí. Výběr jsme nezměnili.';
    locate.hidden=!(id && sim.worlds.some(w=>local(w,id)));
    if (lastMarkup!==fingerprint+':'+id) lastMarkup=fingerprint+':'+id;
  }
  function browse(direction) {
    const entries=[null,...nations()];
    if(entries.length<2)return;
    const i=entries.indexOf(observed());
    set(entries[(i+direction+entries.length)%entries.length]);
  }
  function locate() {
    const id=observed(), world=sim.worlds.find(w=>local(w,id));
    if(!world)return;
    // Explicit navigation only: clicking a planet never changes observed civilization.
    showSurface(world,false);
    updateUI();
  }
  function install() {
    const management=$('world-navigation');if(!management)return;
    const section=document.createElement('section'); section.className='compass';section.id='compass';
    section.setAttribute('aria-label','KOMPAS – společná sledovaná civilizace');
    section.innerHTML=`<div class="compass-heading"><strong>M1 · KOMPAS</strong><span id="compass-authority">POZOROVÁNÍ</span></div>
      <label class="compass-label" for="compass-nation">Sledovaná civilizace · společný filtr</label>
      <div class="compass-picker"><button class="btn world-arrow" id="compass-prev" aria-label="Předchozí civilizace" type="button">‹</button>
      <select id="compass-nation" aria-label="Sledovaná civilizace"><option value="0">Všechny civilizace</option></select>
      <button class="btn world-arrow" id="compass-next" aria-label="Další civilizace" type="button">›</button></div>
      <p id="compass-detail" class="compass-detail"></p>
      <div class="compass-context"><span id="compass-context"></span><span id="compass-patron"></span></div>
      <p id="compass-not-here" class="compass-warning" hidden></p>
      <button class="btn compass-find" id="compass-find" type="button" hidden>Najít planetu sledované civilizace</button>
      <section class="compass-civic-card" id="compass-civic-card" aria-label="Stav sledované civilizace" hidden>
        <div class="compass-civic-title"><strong>Stav civilizace · <span id="compass-civic-name"></span></strong><span id="compass-civic-permission"></span></div>
        <div class="numbers compass-civic-stats">
          <div class="stat"><span class="smallcaps">Obyvatelé</span><output id="compass-civic-people"></output></div>
          <div class="stat"><span class="smallcaps">Sídla</span><output id="compass-civic-settlements"></output></div>
          <div class="stat"><span class="smallcaps">Jednotky</span><output id="compass-civic-guards"></output></div>
          <div class="stat"><span class="smallcaps">Základny</span><output id="compass-civic-bases"></output></div>
        </div>
        <p class="compass-civic-wallet" id="compass-civic-wallet"></p>
        <div class="planet-status-actions compass-civic-actions">
          <button class="btn primary" id="compass-civic-detail" type="button" data-compass-civic-action="detail">Podrobnosti</button>
          <button class="btn primary" id="compass-civic-find" type="button" data-compass-civic-action="find">Najít na mapě</button>
          <button class="btn primary" id="compass-civic-list" type="button" data-compass-civic-action="list">Seznam osad</button>
          <button class="btn" id="compass-civic-rename" type="button" data-compass-civic-action="rename">Přejmenovat ✎</button>
          <button class="btn" id="compass-civic-adopt" type="button" data-compass-civic-action="adopt" hidden>Přijmout patronát</button>
        </div>
      </section>`;
    const tabs=management.querySelector('.deck-tabs');
    management.insertBefore(section,tabs??management.firstChild);
    $('compass-prev').addEventListener('click',()=>browse(-1));
    $('compass-next').addEventListener('click',()=>browse(1));
    $('compass-nation').addEventListener('change',e=>set(e.target.value));
    $('compass-find').addEventListener('click',locate);
    $('compass-civic-card').addEventListener('click',event=>{
      const action=event.target.closest('[data-compass-civic-action]')?.dataset.compassCivicAction;
      if(action && observed()) GameInterface?.compassCivicAction?.(action,observed());
    });
    const previous=updateUI;
    updateUI=function(...args){const result=previous.apply(this,args);paint();return result;};
    paint(true);
  }
  install();
  return {id:observed,set,local,nations,totals,paint};
})();
globalThis.CosmoCompass = CosmoCompass;
