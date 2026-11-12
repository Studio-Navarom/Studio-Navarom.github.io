/* CosmoEvolve HUD Editor v3 — view-only layout; never modifies simulation or saves. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'cosmoevolve.hud.v1';
  const MODES = {
    galaxy: { label: 'Galaxie', subtitle: 'Mapa galaxie a správa soustav' },
    orbit: { label: 'Soustava', subtitle: 'Gravitace, tvorba planet a meziplanetární lety' },
    surface: { label: 'Planeta', subtitle: 'Božské síly, klima, krajina a život' },
    civic: { label: 'Civilizace', subtitle: 'Osady, zdroje, technologie a výpravy' }
  };
  // Extraction order matters: children first, shared parent last. This preserves all game listeners.
  const DEFINITIONS = [
    {id:'galaxy-tools', label:'Správa soustav', modes:['galaxy'], elements:['#galaxy-tools'], zone:'left'},
    {id:'settlement-status', label:'Stav osady', modes:['civic'], elements:['#settlement-overview'], zone:'right'},
    {id:'guide', label:'Dobrovolný průvodce', modes:['galaxy','orbit','surface','civic'], elements:['#optional-guide'], zone:'right'},
    {id:'civic-status', label:'Stav civilizace', modes:['surface','civic'], elements:['#civic-overview'], zone:'right', hint:'Otevři povrch planety a prohlédni si místní civilizace.'},
    {id:'terrain', label:'Úprava krajiny', modes:['surface','civic'], elements:['[data-weather="channel"]','[data-weather="ridge"]'], zone:'left', hint:'Koryto a val mění krajinu přímo na mapě.'},
    {id:'gravity', label:'Gravitace a pásma', modes:['orbit'], elements:['.orbit-display-controls'], zone:'left', hint:'Zvol gravitaci a orientační obyvatelné pásmo.'},
    {id:'flights', label:'Vesmírný provoz', modes:['orbit','civic'], elements:['#voyages'], zone:'right', tab:'flights', hint:'Zatím žádné aktivní výpravy. Sondy a lodě vysíláš přes Výzkum a logistiku.'},
    {id:'climate', label:'Stav planety', modes:['surface'], elements:['#planet-overview'], zone:'right', hint:'Otevři povrch planety a uvidíš její aktuální stav.'},
    {id:'life', label:'Život a evoluce', modes:['surface'], elements:['#life-chronicle'], zone:'right', hint:'Kronika života se objeví s vývojem biosféry.'},
    {id:'forces', label:'Božské síly', modes:['surface','civic'], elements:['.weather-tools','.brush-size'], zone:'left', hint:'Ovládej vítr, teplotu, prameny a sopky. Dosah zásahu nastavíš zde.'},
    {id:'creation', label:'Tvorba planet a hody', modes:['orbit'], elements:['#launch-preparation'], zone:'left', hint:'Založ planetu a vypusť ji tahem po mapě.'},
    {id:'planets', label:'Planety a hlavní správa', modes:['orbit','surface','civic'], elements:['#world-navigation'], zone:'center', tab:'management', hint:'Rozbal správu osad, technologií, budov nebo výzkumu.'},
    {id:'status', label:'Stav soustavy', modes:['galaxy','orbit'], elements:['#system-overview','#orbit-monitor'], zone:'right', hint:'Živý přehled populace a soustavy.'},
    {id:'chronicle', label:'Deník hry', modes:['orbit','surface','civic'], elements:['.log-section'], zone:'right', hint:'Události, ztráty a důležité změny ve světě.'},
    {id:'map', label:'Mapa', modes:['galaxy','orbit','surface','civic'], elements:['.layout > section.panel'], zone:'center', essential:true}
  ];
  const IDS = new Set(DEFINITIONS.map(d=>d.id));
  const ZONES = ['left','center','right','bottom'];
  const COLUMNS=24, ROW=20, GAP=8, NARROW=700, MAX_Y=1500;
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const integer=(value,min,max,fallback=0)=>Number.isFinite(value)?clamp(Math.round(value),min,max):fallback;
  const PROFILES=Object.keys(MODES).flatMap(mode=>[mode,mode+'-narrow']);
  const presets = {
    balanced: {name:'Vyvážené', center:['map','planets'], left:['galaxy-tools','creation','gravity','forces','terrain'], right:['climate','settlement-status','civic-status','status','guide','flights','life','chronicle'], bottom:[]},
    creator: {name:'Tvůrce', center:['map','planets'], left:['galaxy-tools','gravity','creation','forces','terrain'], right:['climate','settlement-status','civic-status','status','guide','life','chronicle'], bottom:['flights']},
    strategy: {name:'Strategie', center:['map','planets'], left:['galaxy-tools','creation','gravity','forces','terrain','flights'], right:['climate','settlement-status','civic-status','status','guide','life','chronicle'], bottom:[]}
  };
  const presetModules=name=>Object.fromEntries(ZONES.flatMap(zone=>presets[name][zone]
    .map((id,order)=>[id,{zone,order,visible:true,width:0,height:0}])));
  const defaultState=()=>({version:4,enabled:true,locked:true,mode:'orbit',preset:'balanced',
    modules:presetModules('balanced'),positions:{}});
  const validVersion=input=>[1,2,3,4].includes(input?.version);
  const normalize = input => {
    const v=defaultState();
    if (!validVersion(input)) return v;
    v.enabled=input.enabled!==false;
    v.locked=input.locked!==false;
    v.mode=input.mode !== 'galaxy' && Object.hasOwn(MODES,input.mode)?input.mode:'orbit';
    v.preset=Object.hasOwn(presets,input.preset)?input.preset:'balanced';
    v.modules=presetModules(v.preset);
    if (input.modules && typeof input.modules==='object') for (const id of IDS) {
      const item=input.modules[id]; if (!item || typeof item!=='object') continue;
      // Older layouts parked the management panel below *every* sidebar panel.
      // Migrate that default to the map column; preserve explicitly moved tiles.
      const legacyManagement = id==='planets' && input.version<=3 && item.zone==='bottom'
        && !Object.values(input.positions??{}).some(pos=>pos?.planets);
      if (ZONES.includes(item.zone) && !legacyManagement) v.modules[id].zone=item.zone;
      if (!legacyManagement && Number.isFinite(item.order) && (input.version >= 3 || item.zone !== 'right')) v.modules[id].order=Math.max(0,Math.min(999,Math.floor(item.order)));
      if (typeof item.visible==='boolean' && id!=='map') v.modules[id].visible=item.visible;
      if (Number.isFinite(item.width)) v.modules[id].width=Math.max(0,Math.min(1500,Math.floor(item.width)));
      if (Number.isFinite(item.height)) v.modules[id].height=Math.max(0,Math.min(1200,Math.floor(item.height)));
    }
    for (const profile of PROFILES) {
      const source=input.positions?.[profile];
      if (!source || typeof source!=='object') continue;
      v.positions[profile]={};
      for (const id of IDS) {
        const tile=source[id];
        if (!tile || !Number.isFinite(tile.x) || !Number.isFinite(tile.y)) continue;
        v.positions[profile][id]={
          x:integer(tile.x,0,COLUMNS-1),y:integer(tile.y,0,MAX_Y),w:integer(tile.w,0,COLUMNS),
          h:integer(tile.h,0,70),priority:integer(tile.priority,0,1000000)
        };
      }
    }
    return v;
  };
  const load = () => { try {return normalize(JSON.parse(localStorage.getItem(KEY)));}catch{return defaultState();} };
  let settings=load(), editorOpen=false, gesture=null, active=false, noteTimer=null;
  const save = () => {try {localStorage.setItem(KEY,JSON.stringify(settings));}catch{/* private mode / quota */}};
  const add = (tag, attrs={}, text='') => {
    const el=document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) {if (k==='className') el.className=v; else el.setAttribute(k,v);}
    if (text) el.textContent=text;
    return el;
  };
  const mast=$('storage-open')?.parentElement, layout=document.querySelector('.layout'), mapPanel=layout?.querySelector(':scope > section.panel'), side=layout?.querySelector(':scope > aside.panel');
  if (!mast || !layout || !mapPanel || !side || typeof Orbit === 'undefined') return;

  const launchBtn=add('button',{className:'btn hud-editor-launch',type:'button',id:'hud-editor-launch','aria-expanded':'false'},'▦ Upravit HUD');
  mast.insertBefore(launchBtn,mast.firstChild);
  const toolbar=add('section',{id:'hud-toolbar','aria-label':'Herní režimy a vlastní rozložení',className:'hud-toolbar'});
  toolbar.innerHTML='<div class="hud-view-tabs" role="group" aria-label="Herní režim"></div><div class="hud-toolbar-actions"><span id="hud-mode-caption"></span><button type="button" class="btn" id="hud-lock">🔒 Zamčeno</button><button type="button" class="btn" id="hud-show-editor">Upravit rozložení</button></div>';
  const viewTabs=toolbar.querySelector('.hud-view-tabs');
  const galaxyOpen=$('galaxy-open'), galaxyAnchor=document.createComment('hud:galaxy');
  galaxyOpen.before(galaxyAnchor);
  galaxyOpen.textContent='Galaxie';
  viewTabs.append(galaxyOpen);
  for (const [id,data] of Object.entries(MODES).filter(([id])=>id!=='galaxy')) viewTabs.append(add('button',{type:'button',className:'btn hud-mode-button','data-hud-mode':id},data.label));
  document.querySelector('.hero')?.after(toolbar);
  const notice=add('p',{id:'hud-message',className:'hud-message',role:'status'});toolbar.after(notice);notice.hidden=true;
  const alert = msg=>{notice.textContent=msg;notice.hidden=false;clearTimeout(noteTimer);noteTimer=setTimeout(()=>notice.hidden=true,4700);};

  const editor=add('section',{id:'hud-editor',className:'hud-editor',hidden:'','aria-label':'Editor herního HUD'});
  editor.innerHTML=`<div class="hud-editor-heading"><div><strong>Editor rozhraní</strong><p>Táhni dlaždici za ⠿ do volného místa nebo k okraji sousední dlaždice. Při přichycení se překážející dlaždice posunou níž. Velikost upravíš za pravý dolní roh. Stránka se při tažení u horního nebo dolního okraje posouvá sama.</p></div><button type="button" class="btn" id="hud-editor-close">Hotovo</button></div>
  <div class="hud-editor-controls"><label>Předvolba <select id="hud-preset"><option value="balanced">Vyvážené</option><option value="creator">Tvůrce</option><option value="strategy">Strategie</option></select></label>
  <button class="btn" type="button" id="hud-reset">Obnovit rozložení</button><button class="btn" type="button" id="hud-export">Exportovat JSON</button><button class="btn" type="button" id="hud-import">Importovat JSON</button><input id="hud-import-file" type="file" accept=".json,application/json" hidden><button class="btn" type="button" id="hud-classic">Původní zobrazení</button><button class="btn" type="button" data-guide-open="guide-title-hud">Návod k HUDu</button></div>
  <div class="hud-editor-tip">Pozice se ukládají pro každý herní pohled zvlášť. Na úzké obrazovce jsou dlaždice pod sebou. Soubor JSON obsahuje rozložení HUD.</div>
  <div class="hud-module-config" id="hud-module-config" aria-label="Viditelnost jednotlivých modulů"></div>`;
  notice.after(editor);

  const grid=add('section',{className:'hud-grid','aria-label':'Mřížka herního rozhraní'});
  const preview=add('div',{className:'hud-grid-preview',hidden:'','aria-hidden':'true'});
  grid.append(preview);
  layout.after(grid);
  const modules=new Map(), extracted=[];

  for (const def of DEFINITIONS) {
    const card=add('section',{className:def.essential?'hud-module hud-map-card':'hud-module','data-hud-id':def.id,'aria-label':def.label});
    const header=add('div',{className:'hud-module-header'});
    const handle=add('button',{type:'button',className:'hud-module-handle',title:'Přesunout tahem nebo šipkami',
      'aria-label':'Přesunout dlaždici '+def.label},'⠿');
    const title=add('strong',{className:'hud-module-name'},def.label);
    const tools=add('div',{className:'hud-module-buttons'});
    const open=def.tab?add('button',{type:'button',className:'hud-card-open',title:'Otevřít tuto část hry'},'Otevřít'):null;
    if (open) {open.addEventListener('click',()=>openTab(def.tab));tools.append(open);}
    const smaller=add('button',{type:'button',className:'hud-card-size',title:'Zmenšit výšku','aria-label':'Zmenšit výšku'},'−');
    const bigger=add('button',{type:'button',className:'hud-card-size',title:'Zvětšit výšku','aria-label':'Zvětšit výšku'},'+');
    const hide=add('button',{type:'button',className:'hud-card-hide',title:'Skrýt panel','aria-label':'Skrýt panel'},'×');
    tools.append(smaller,bigger);
    if (!def.essential) tools.append(hide);
    header.append(handle,title,tools);
    const content=add('div',{className:'hud-module-content'});
    const hint=def.hint?add('p',{className:'hud-module-hint'},def.hint):null;
    const feedback=def.id==='flights'?add('p',{id:'hud-flights-feedback',className:'hud-module-hint hud-flight-feedback',role:'status',hidden:''}):null;
    if (feedback) open.setAttribute('aria-controls',feedback.id);
    const grip=add('button',{type:'button',className:'hud-resize-grip',title:'Změnit šířku a výšku tahem nebo šipkami',
      'aria-label':'Změnit šířku a výšku dlaždice '+def.label},'◢');
    card.append(header,content);
    if (hint) card.append(hint);
    if (feedback) card.append(feedback);
    card.append(grip);
    const roots=[];
    for (const selector of def.elements) {
      const node=document.querySelector(selector);
      if (!node) continue;
      const anchor=document.createComment('hud:'+def.id);
      node.parentNode.insertBefore(anchor,node);
      content.append(node);
      extracted.push({node,anchor});roots.push(node);
    }
    if (!roots.length) {card.remove();continue;}
    modules.set(def.id,{...def,card,title,content,hint,feedback,roots});
    smaller.addEventListener('click',()=>adjustTile(def.id,0,-4,true));
    bigger.addEventListener('click',()=>adjustTile(def.id,0,4,true));
    hide.addEventListener('click',()=>{
      if (def.id === 'creation') revealCreation = false;
      settings.modules[def.id].visible=false;persist();
    });
    handle.addEventListener('pointerdown',e=>startGesture(e,def.id,'move'));
    grip.addEventListener('pointerdown',e=>startGesture(e,def.id,'resize'));
    for (const [control,resize] of [[handle,false],[grip,true]]) control.addEventListener('keydown',e=>{
      const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if (!direction || settings.locked || !editorOpen) return;
      e.preventDefault();
      adjustTile(def.id,...direction,resize);
    });
    if (!def.essential) {
      const cfg=add('label',{className:'hud-module-toggle'});
      const checkbox=add('input',{type:'checkbox','data-hud-visible':def.id});
      checkbox.addEventListener('change',()=>{
        if (def.id === 'creation') revealCreation = false;
        settings.modules[def.id].visible=checkbox.checked;persist();
      });
      cfg.append(checkbox,add('span',{},def.label));$('hud-module-config').append(cfg);
    }
    grid.insertBefore(card,preview);
  }
  let placements=new Map(), geometry=null, layoutFrame=0, scrollFrame=0;
  const rowsFor=height=>Math.ceil((height+GAP)/ROW);
  const overlaps=(a,b)=>a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;
  const bottomOf=tiles=>Math.max(0,...Array.from(tiles,tile=>tile.y+tile.h));
  const pixelWidth=(tile,g)=>tile.w*g.unit-GAP;
  const pixelHeight=tile=>tile.h*ROW-GAP;
  const minimumWidth=(id,g)=>Math.min(g.columns,Math.ceil(((id==='map'?320:165)+GAP)/g.unit));
  const sizeWidth=(id,w,g)=>clamp(w,minimumWidth(id,g),g.columns);
  const minimumHeight=id=>rowsFor(id==='map'?360:120);

  function placeTile(tile,occupied) {
    const placed={...tile};
    let collisions=occupied.filter(other=>overlaps(placed,other));
    while (collisions.length) {
      placed.y=bottomOf(collisions);
      collisions=occupied.filter(other=>overlaps(placed,other));
    }
    return placed;
  }

  function queueLayout() {
    if (active && !layoutFrame) layoutFrame=requestAnimationFrame(()=>{
      layoutFrame=0;
      renderGrid();
    });
  }

  function renderGrid() {
    if (!active || !grid.clientWidth) return;
    const narrow=grid.clientWidth<NARROW;
    const columns=narrow?1:COLUMNS;
    const g={columns,unit:(grid.clientWidth+GAP)/columns,profile:(galaxyViewing?'galaxy':settings.mode)+(narrow?'-narrow':'')};
    if (gesture && (gesture.profile!==g.profile || geometry.unit!==g.unit)) endGesture(null,false);
    geometry=g;
    grid.style.setProperty('--hud-grid-step',g.unit+'px');
    const positions=settings.positions[g.profile]??{};
    const visible=[...modules.values()].filter(m=>!m.card.hidden);
    const lanes=narrow?['center','left','right','bottom']:ZONES;
    const groups=Object.fromEntries(lanes.map(zone=>[zone,visible.filter(m=>settings.modules[m.id].zone===zone)
      .sort((a,b)=>settings.modules[a.id].order-settings.modules[b.id].order)]));
    const laneWidth=(zone,pixels)=>groups[zone].length?Math.min(COLUMNS/4,Math.round((pixels+GAP)/g.unit)):0;
    const left=narrow?0:laneWidth('left',230),right=narrow?0:laneWidth('right',295);
    const spans={left:[0,left],center:[left,columns-left-right],right:[columns-right,right],bottom:[0,columns]};
    const measured=new Map();
    for (const m of visible) {
      const data=settings.modules[m.id], saved=positions[m.id];
      const [laneX,laneW]=spans[data.zone];
      const legacyWidth=data.width?Math.round((data.width+GAP)/g.unit):0;
      const w=narrow?1:sizeWidth(m.id,saved?.w || legacyWidth || laneW,g);
      const x=narrow?0:clamp(saved?.x??laneX,0,columns-w);
      const legacyHeight=data.height?rowsFor(data.height+(m.essential?115:0)):0;
      const requestedHeight=saved?.h??legacyHeight;
      const fixedHeight=requestedHeight?clamp(requestedHeight,minimumHeight(m.id),70):0;
      m.card.style.width=pixelWidth({w},g)+'px';
      m.card.style.height=fixedHeight?pixelHeight({h:fixedHeight})+'px':'';
      m.card.classList.toggle('hud-sized',Boolean(fixedHeight));
      measured.set(m.id,{x,w,fixedHeight});
    }
    for (const m of visible) {
      const tile=measured.get(m.id);
      tile.h=tile.fixedHeight||rowsFor(m.card.getBoundingClientRect().height);
    }
    const next=new Map(),occupied=[];
    const place=(id,tile)=>{
      const placed=placeTile(tile,occupied);
      next.set(id,placed);
      occupied.push(placed);
    };
    // Give the last edited tile its requested spot, then flow any blocked tiles downward.
    for (const [id,saved] of Object.entries(positions).sort((a,b)=>b[1].priority-a[1].priority)) {
      if (measured.has(id)) place(id,{...measured.get(id),y:saved.y});
    }
    let flowBottom=0;
    for (const zone of lanes) {
      let y=narrow?flowBottom:zone==='bottom'?bottomOf(occupied):0;
      for (const m of groups[zone]) {
        if (!next.has(m.id)) place(m.id,{...measured.get(m.id),y});
        y=Math.max(y,next.get(m.id).y+next.get(m.id).h);
      }
      flowBottom=Math.max(flowBottom,y);
    }
    placements=next;
    for (const [id,tile] of placements) {
      const {style}=modules.get(id).card;
      style.left=tile.x*g.unit+'px';
      style.top=tile.y*ROW+'px';
    }
    grid.style.height=bottomOf(occupied)*ROW+(editorOpen?160:0)+'px';
  }

  const tileObserver=new ResizeObserver(queueLayout);
  let gridWidth=0;
  new ResizeObserver(()=>{
    if (gridWidth===grid.clientWidth) return;
    gridWidth=grid.clientWidth;
    queueLayout();
  }).observe(grid);
  for (const m of modules.values()) tileObserver.observe(m.card);

  function commitTile(id,tile) {
    const saved=settings.positions[geometry.profile]??={};
    const priority=Math.max(0,...Object.values(saved).map(entry=>entry.priority))+1;
    saved[id]={x:tile.x,y:tile.y,w:tile.w,h:tile.fixedHeight,priority};
    persist();
    renderGrid();
  }

  function adjustTile(id,dx,dy,resize) {
    const current=placements.get(id),g=geometry;
    if (!current || !editorOpen || settings.locked || gesture) return;
    const tile={...current};
    if (resize) {
      tile.w=g.columns===1?1:clamp(tile.w+dx,minimumWidth(id,g),g.columns-tile.x);
      if (dy || tile.w!==current.w) tile.h=tile.fixedHeight=clamp(tile.h+dy,minimumHeight(id),70);
    } else {
      tile.x=clamp(tile.x+dx,0,g.columns-tile.w);
      tile.y=clamp(tile.y+dy,0,MAX_Y);
    }
    if (tile.x!==current.x || tile.y!==current.y || tile.w!==current.w || tile.h!==current.h) commitTile(id,tile);
  }

  function startGesture(e,id,kind) {
    const tile=placements.get(id);
    if (!tile || settings.locked || !editorOpen || !active || gesture || e.button!==0 || !e.isPrimary) return;
    e.preventDefault();
    const capture=e.currentTarget, rect=modules.get(id).card.getBoundingClientRect();
    gesture={id,kind,tile,capture,pointer:e.pointerId,profile:geometry.profile,startX:e.clientX,startY:e.clientY,
      x:e.clientX,y:e.clientY,offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top,
      startTop:grid.getBoundingClientRect().top,started:false,candidate:null};
    capture.setPointerCapture(e.pointerId);
  }

  function snapTarget(x,y,tile,neighbors,g) {
    let nearest=null;
    for (const other of neighbors) {
      const left=other.x*g.unit,right=left+pixelWidth(other,g);
      const top=other.y*ROW,bottom=top+pixelHeight(other);
      if (x<left-20 || x>right+20 || y<top-20 || y>bottom+20) continue;
      const edges=[
        {distance:Math.abs(x-left),x:other.x-tile.w,y:tile.y},
        {distance:Math.abs(x-right),x:other.x+other.w,y:tile.y},
        {distance:Math.abs(y-top),x:tile.x,y:Math.max(0,other.y-tile.h)},
        {distance:Math.abs(y-bottom),x:tile.x,y:other.y+other.h}
      ];
      for (const [index,edge] of edges.entries()) {
        if (edge.distance>20 || edge.x<0 || edge.x+tile.w>g.columns || nearest && edge.distance>=nearest.distance) continue;
        if (index<2) edge.y=clamp(edge.y,Math.max(0,other.y-tile.h+1),other.y+other.h-1);
        else edge.x=clamp(edge.x,Math.max(0,other.x-tile.w+1),Math.min(g.columns-tile.w,other.x+other.w-1));
        nearest=edge;
      }
    }
    return nearest;
  }

  function updatePreview() {
    const {id,kind,tile,x,y}=gesture,g=geometry,rect=grid.getBoundingClientRect();
    const candidate={...tile};
    const neighbors=[...placements].filter(([other])=>other!==id).map(([,rect])=>rect);
    let valid=true,snapped=false;
    if (kind==='move') {
      const localX=x-rect.left,localY=y-rect.top;
      candidate.x=clamp(Math.round((localX-gesture.offsetX)/g.unit),0,g.columns-tile.w);
      candidate.y=clamp(Math.round((localY-gesture.offsetY)/ROW),0,MAX_Y);
      const edge=snapTarget(localX,localY,candidate,neighbors,g);
      if (edge) {
        candidate.x=edge.x;
        candidate.y=clamp(edge.y,0,MAX_Y);
        snapped=true;
      }
      valid=localX>=-12 && localX<=rect.width+12 && localY>=-12 && localY<=rect.height+12
        && (snapped || !neighbors.some(other=>overlaps(candidate,other)));
    } else {
      const dx=Math.round((x-gesture.startX)/g.unit);
      const dy=Math.round((y-gesture.startY+gesture.startTop-rect.top)/ROW);
      candidate.w=g.columns===1?1:clamp(tile.w+dx,minimumWidth(id,g),g.columns-tile.x);
      if (dy || candidate.w!==tile.w) candidate.h=candidate.fixedHeight=clamp(tile.h+dy,minimumHeight(id),70);
    }
    gesture.candidate=valid?candidate:null;
    preview.hidden=false;
    preview.classList.toggle('hud-invalid',!valid);
    preview.classList.toggle('hud-snapped',snapped);
    preview.style.left=candidate.x*g.unit+'px';
    preview.style.top=candidate.y*ROW+'px';
    preview.style.width=pixelWidth(candidate,g)+'px';
    preview.style.height=pixelHeight(candidate)+'px';
  }

  function scrollWhileDragging() {
    scrollFrame=0;
    if (!gesture?.started || gesture.kind!=='move') return;
    const edge=Math.min(100,window.innerHeight/5),y=gesture.y;
    const distance=y<edge ? Math.max(-edge,y-edge) : Math.max(0,Math.min(edge,y-(window.innerHeight-edge)));
    if (distance) window.scrollBy({top:Math.sign(distance)*Math.ceil(Math.abs(distance)/5),behavior:'instant'});
    updatePreview();
    scrollFrame=requestAnimationFrame(scrollWhileDragging);
  }

  function updateGesture(e) {
    if (gesture?.pointer!==e.pointerId) return;
    gesture.x=e.clientX;
    gesture.y=e.clientY;
    if (!gesture.started && Math.hypot(e.clientX-gesture.startX,e.clientY-gesture.startY)<5) return;
    gesture.started=true;
    modules.get(gesture.id).card.classList.add('hud-dragging');
    updatePreview();
    if (gesture.kind==='move' && !scrollFrame) scrollFrame=requestAnimationFrame(scrollWhileDragging);
  }

  function endGesture(e,commit) {
    if (!gesture || e && e.pointerId!==gesture.pointer) return;
    if (commit && gesture.started) updateGesture(e);
    const {id,tile,candidate,capture,pointer}=gesture;
    gesture=null;
    cancelAnimationFrame(scrollFrame);
    scrollFrame=0;
    if (capture.hasPointerCapture(pointer)) capture.releasePointerCapture(pointer);
    modules.get(id).card.classList.remove('hud-dragging');
    preview.hidden=true;
    if (commit && candidate && ['x','y','w','h'].some(key=>candidate[key]!==tile[key])) commitTile(id,candidate);
  }
  window.addEventListener('pointermove',updateGesture);
  window.addEventListener('pointerup',e=>endGesture(e,true));
  window.addEventListener('pointercancel',e=>endGesture(e,false));
  window.addEventListener('lostpointercapture',e=>endGesture(e,false));
  window.addEventListener('blur',()=>endGesture(null,false));
  window.addEventListener('keydown',e=>{if (e.key==='Escape') endGesture(null,false);});
  let revealManagement=false, revealCreation=false;
  function showCivicList() {
    if (!active) return false;
    GameInterface.openCities(viewedPlanet());
    return true;
  }
  function openTab(tab){
    if(tab==='management'){
      revealManagement=true;
      // The main-management disclosure stays in its own HUD card, not above the map.
      openTab('worlds');
      refresh();
      renderGrid();
      return;
    }
    if(tab==='flights'){
      const feedback=modules.get('flights').feedback;
      const issue=GameInterface.flightPlanningIssue();
      feedback.hidden=!issue;
      if (issue) {
        modules.get('flights').hint.hidden=true;
        feedback.textContent=issue;
        return;
      }
      revealManagement=true;
      GameInterface.openFlights();
      refresh();
      scrollToManagement('nearest');
      return;
    }
    const btn=document.querySelector('[data-deck-action="tab:'+tab+'"]');
    if(btn && btn.getAttribute('aria-pressed')!=='true')btn.click();
  }
  function scrollToManagement(block) {
    requestAnimationFrame(()=>{
      renderGrid();
      modules.get('planets')?.card.scrollIntoView({behavior:'smooth',block});
    });
  }
  function showManagement() {
    if (!active) return false;
    revealManagement = true;
    refresh();
    scrollToManagement('nearest');
    return true;
  }
  function showCreation() {
    if (!active) return;
    changeMode('orbit');
    revealCreation = true;
    refresh();
    renderGrid();
  }
  function actualSurface(){return !$('surface-map').hidden;}
  function changeMode(mode){
    if (!MODES[mode] || galaxyBusy) return;
    if (galaxyViewing) {
      closeGalaxy();
      updateUI();
    }
    setMapPicker(false);
    if(mode==='orbit'){
      if(actualSurface())$('surface-back').click();
    }else if(!actualSurface()) {
      const open=$('surface-open');
      if(open.hidden || open.disabled){alert('Nejprve vytvoř a vyber planetu. Potom můžeš otevřít její povrch.');return;}
      open.click();
    }
    settings.mode=mode;
    apply();save();
    if (mode === 'civic') GameInterface.activateMapSettlements();
    else updateUI();
  }
  function setPreset(name){
    if(!Object.hasOwn(presets,name))return;
    endGesture(null,false);
    settings.preset=name;
    settings.modules=presetModules(name);
    settings.positions={};
    persist();
  }
  function restoreClassic(){
    if(!active)return;
    galaxyAnchor.after(galaxyOpen);
    for(const {node,anchor} of [...extracted].reverse()){
      if(anchor.parentNode) {anchor.parentNode.insertBefore(node,anchor);anchor.remove();}
    }
    endGesture(null,false);
    active=false;document.body.classList.remove('hud-custom-layout');
    setJournalMode(null);
    setMapNavigationMode('surface');
  }
  function enableCustom(){
    if(active)return;
    viewTabs.prepend(galaxyOpen);
    // Once restored to classic, placeholders were removed. Recreate them before moving back.
    for(const m of modules.values())for(const node of m.roots){
      const found=extracted.find(x=>x.node===node);
      if(found&&!found.anchor.parentNode)node.parentNode.insertBefore(found.anchor,node);
      m.content.append(node);
    }
    active=true;document.body.classList.add('hud-custom-layout');
  }
  function refresh(){
    if(!active)return;
    if(!galaxyViewing && !actualSurface())settings.mode='orbit';
    const mode=galaxyViewing?'galaxy':settings.mode;
    if (mode !== 'orbit') revealCreation=false;
    setJournalMode(mode==='galaxy'?'orbit':mode);
    setMapNavigationMode(mode);
    const management=modules.get('planets');
    const label=mode==='orbit'?'Planety a hlavní správa':'Hlavní správa';
    const civicLabel = mode === 'surface' ? 'Civilizace na planetě' : 'Stav civilizace';
    modules.get('civic-status').title.textContent = civicLabel;
    modules.get('civic-status').card.setAttribute('aria-label',civicLabel);
    if (management.title.textContent!==label) {
      management.title.textContent=label;
      management.card.setAttribute('aria-label',label);
    }
    if (!GameInterface.managementOpen()) revealManagement=false;
    const showManagement=mode!=='galaxy';
    for(const m of modules.values()){
      const data=settings.modules[m.id],show=m.id==='planets' && showManagement
        || m.modes.includes(mode) && (editorOpen || data.visible || m.id==='creation' && revealCreation);
      m.card.hidden=!show;
      if (m.feedback && !m.feedback.hidden) {
        const issue=GameInterface.flightPlanningIssue();
        m.feedback.hidden=!issue;
        if (issue && m.feedback.textContent!==issue) m.feedback.textContent=issue;
      }
      if (m.hint) m.hint.hidden=Boolean(m.feedback && !m.feedback.hidden)
        || m.roots.some(node=>!node.hidden && getComputedStyle(node).display!=='none');
    }
    queueLayout();
    $('hud-mode-caption').textContent=MODES[mode].subtitle;
    for (const btn of toolbar.querySelectorAll('[data-hud-mode]'))btn.setAttribute('aria-pressed',String(btn.dataset.hudMode===mode));
  }
  function syncSettings(){
    document.body.classList.toggle('hud-editing',editorOpen&&active);
    $('hud-lock').textContent=settings.locked?'🔒 Zamčeno':'🔓 Odemčeno';
    $('hud-lock').setAttribute('aria-pressed',String(!settings.locked));
    $('hud-show-editor').textContent=editorOpen?'Zavřít editor':'Upravit rozložení';
    launchBtn.setAttribute('aria-expanded',String(editorOpen));
    editor.hidden=!editorOpen;
    $('hud-preset').value=settings.preset;
    for(const chk of document.querySelectorAll('[data-hud-visible]'))chk.checked=settings.modules[chk.dataset.hudVisible].visible;
    if (!editorOpen || settings.locked) endGesture(null,false);
  }
  active=true; // Nodes were extracted during setup; classic mode must be able to restore them.
  document.body.classList.add('hud-custom-layout');
  function apply(){
    if(settings.enabled)enableCustom();else restoreClassic();
    if(!active){toolbar.hidden=true;editor.hidden=true;editorOpen=false;}
    else toolbar.hidden=false;
    syncSettings();refresh();
  }
  function persist(){save();syncSettings();refresh();}
  function toggleEditor(){
    if(!settings.enabled){settings.enabled=true;enableCustom();}
    editorOpen=!editorOpen;
    if(editorOpen)settings.locked=false;else settings.locked=true;
    persist();apply();
  }
  function exportSettings(){
    const json=JSON.stringify(normalize(settings),null,2),blob=new Blob([json],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=add('a',{href:url,download:'CosmoEvolve-HUD.json'});
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    alert('Rozložení HUD bylo exportováno. Soubor mi můžeš poslat k vytvoření výchozího rozhraní.');
  }
  function importSettings(file){
    if(!file)return;
    if(file.size>200000){alert('Soubor rozložení je příliš velký.');return;}
    file.text().then(source=>{
      const parsed=JSON.parse(source);
      if(!validVersion(parsed)||!parsed.modules||typeof parsed.modules!=='object')throw Error('Neplatný soubor rozložení.');
      settings=normalize(parsed);settings.enabled=true;settings.locked=true;editorOpen=false;
      endGesture(null,false);apply();save();alert('Rozložení HUD bylo načteno a zamčeno.');
    }).catch(e=>alert('Nepodařilo se načíst HUD: '+e.message));
  }
  toolbar.querySelectorAll('[data-hud-mode]').forEach(b=>b.addEventListener('click',()=>changeMode(b.dataset.hudMode)));
  $('hud-lock').addEventListener('click',()=>{settings.locked=!settings.locked;editorOpen=!settings.locked;persist();apply();});
  $('hud-show-editor').addEventListener('click',toggleEditor);
  launchBtn.addEventListener('click',()=>{if(!settings.enabled){settings.enabled=true;apply();}toggleEditor();});
  $('hud-editor-close').addEventListener('click',()=>{editorOpen=false;settings.locked=true;persist();apply();});
  $('hud-preset').addEventListener('change',e=>setPreset(e.target.value));
  $('hud-reset').addEventListener('click',()=>{settings=defaultState();settings.locked=false;editorOpen=true;endGesture(null,false);persist();apply();});
  $('hud-export').addEventListener('click',exportSettings);
  $('hud-import').addEventListener('click',()=>$('hud-import-file').click());
  $('hud-import-file').addEventListener('change',e=>{importSettings(e.target.files[0]);e.target.value='';});
  $('hud-classic').addEventListener('click',()=>{editorOpen=false;settings.enabled=false;settings.locked=true;save();apply();alert('Původní rozložení je zpět. Editor můžeš znovu zapnout nahoře.');});
  // Stay in the appropriate mode when a game action changes orbit/surface outside HUD tabs.
  const originalSurface=showSurface;
  showSurface=function(world,...args){
    const result=originalSurface.call(this,world,...args);
    if(!world&&settings.mode!=='orbit')settings.mode='orbit';
    else if(world&&settings.mode==='orbit')settings.mode='surface';
    refresh();save();return result;
  };
  const baseUpdate=updateUI;
  let lastRefresh=0;
  updateUI=function(...args){
    const out=baseUpdate.apply(this,args),now=performance.now();
    if(now-lastRefresh>380 || settings.mode!=='orbit' && !actualSurface()){
      refresh();lastRefresh=now;
    }
    return out;
  };
  apply();
  // Existing save games are unaffected: HUD only uses its own storage key.
  window.CosmoHUD={exportSettings,importSettings,showCivicList,showManagement,showCreation,refresh,reset:()=>setPreset('balanced'),getSettings:()=>JSON.parse(JSON.stringify(settings))};
})();
