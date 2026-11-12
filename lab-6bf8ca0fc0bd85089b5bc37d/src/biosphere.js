const Biosphere = (() => {
  const W = 96, H = 56, SIZE = W * H, STEP = 0.25;
  const OLD_W = 72, OLD_H = 42;
  const POWER_LIMIT = 240, CITY_RESERVE = 35, PROBE_ENERGY = 145, PROBE_CARGO = 48;
  const PROBE_MIN_RESERVE = PROBE_ENERGY + CITY_RESERVE;
  const PROGRAM_ENERGY = 3.2;
  const SATELLITE_WORK = 28, PROBE_WORK = 56;
  const ENERGY_STAGES = ["", "I · Místní síť", "II · Planetární síť", "III · Meziplanetární síť"];
  const POWER_TILES = { wind: 6, solar: 7, thermal: 8, hydro: 9, nuclear: 12 };
  const POWER_NAMES = { wind: "větrnou elektrárnu", solar: "solární elektrárnu", thermal: "tepelnou elektrárnu" };
  const RESEARCH = {
    climate: { name: "Regulace klimatu", work: 23 },
    navigation: { name: "Navigace", work: 19 }
  };
  const STATION_TILE = 10, STATION_REACH = 16, STATION_BATTERY = 36;
  const MAX_STATIONS = 12, STATION_ENERGY = 70, STATION_SUPPLY = 24, STATION_THERMAL_DRAW = 3.2;
  const VISITOR_IMPACT_RADIUS = { asteroid: 7, comet: 9, large: 10 };
  const DAMAGE_CAUSES = ["", "zaplavení", "požár", "láva", "mráz", "sucho", "dopad tělesa", "opuštění osady", "tání nosného ledu", "dlouhé podmáčení", "jaderný zásah", "raketový zásah", "přehřátí"];
  const contaminated = (s, i) => (s.contamination?.[i] ?? 0) > s.time;
  const FAUNA = {
    penguin: { name: "Tučňáci", biome: "ice", profile: "cold", food: "marine", color: "#243646", temperatures: [-0.30, -0.02, 0.12, 0.28] },
    polarBear: { name: "Lední medvědi", biome: "ice", profile: "cold", predator: true, color: "#e9ece2", temperatures: [-0.38, -0.04, 0.16, 0.34] },
    camel: { name: "Velbloudi", biome: "desert", profile: "warm", color: "#d4af73", temperatures: [0.32, 0.55, 0.95, 1.25] },
    desertFox: { name: "Pouštní lišky", biome: "desert", profile: "warm", predator: true, color: "#e3bd83", temperatures: [0.28, 0.50, 0.92, 1.20] },
    deer: { name: "Jeleni", biome: "grass", profile: "temperate", color: "#c7a172", temperatures: [0.10, 0.30, 0.70, 0.97] },
    wolf: { name: "Vlci", biome: "grass", profile: "temperate", predator: true, color: "#a8b3b5", temperatures: [0.06, 0.26, 0.70, 1.00] },
    tapir: { name: "Tapíři", biome: "jungle", profile: "warm", color: "#9b8b87", temperatures: [0.35, 0.60, 0.87, 1.13] },
    panther: { name: "Panteři", biome: "jungle", profile: "warm", predator: true, color: "#343841", temperatures: [0.32, 0.58, 0.90, 1.16] }
  };
  const BIOME_FAUNA = { ice: ["penguin", "polarBear"], desert: ["camel", "desertFox"], grass: ["deer", "wolf"], jungle: ["tapir", "panther"] };
  const HYDRO_ENERGY = 16, HYDRO_SUPPLY = 12;
  const STATION_MODES = { heat: "Ohřát", cool: "Ochladit", dry: "Vysušit", wet: "Zvlhčit", off: "Vypnuto" };
  const BRUSH_RADII = Object.freeze({ small: 2.6, medium: 4.8, large: 8 });
  const WIND_REACH = 25;
  const SEA_LEVEL = 0.45, DEPTH_UNIT = 0.045, TERRAIN_RADIUS = 0.54;
  const marineWaters = new WeakMap();
  const FREEZE_AT = 0.09, SPRING_FLOW = 0.64;
  const SUMMIT_START = 1.15, MAX_TERRAIN_HEIGHT = 1.45;
  const ATMOSPHERE_LIMIT = 0.34;
  const LAVA_FLOW = 0.86, VOLCANO_REACH = 6.8, MOLTEN = 0.07;
  const NATURAL_CLOUDS = 10, CLOUD_LIMIT = 17;
  const CLOUD_FADE = 6, CLOUD_RENEWAL = 1.5;
  const REALMS = [null, { name: "Říční lid", color: "#71d8c5" },
    { name: "Lid údolí", color: "#efa37d" }, { name: "Koloniální svaz", color: "#c1a4ee" },
    { name: "Pobřežní lid", color: "#77b9f2" }, { name: "Lid výšin", color: "#e2c36a" },
    { name: "Lesní lid", color: "#a5cf72" }, { name: "Lid plání", color: "#e694bc" }];
  // Space already allocates local realm numbers up to 63; keep fallback names
  // and renderer colours valid without making these additional native founders.
  for(let i=REALMS.length;i<64;i++)REALMS.push({name:'Svaz '+i,color:['#8db5c9','#b7a6cd','#c7ad86','#85bdb0'][i%4]});
  const NATIVE_REALMS = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  const MAX_TOWNS = 22, MONUMENT_TIME = 32;
  const MAX_BOATS = 8;
  const LANDFORMS = ["Souostroví", "Dva kontinenty", "Rozlámaný svět", "Oceánský svět"];
  const eras = ["Holá skála", "Mikroby", "První zeleň", "Zvěř", "Kmeny", "Města", "Moderní civilizace"];
  const milestonesText = ["", "Ve vodě se objevily první mikroby.", "Na souši roste první zeleň.",
    "Krajinou se pohybují první stáda.", "Začíná éra prvních kmenů.", "Osady vyrostly v města.", "Vznikla moderní civilizace."];
  const refugeText = ["", "Mikrobi přežili klimatickou krizi v místních útočištích.",
    "Část ekosystému přežila klimatickou krizi v místních útočištích.",
    "Stáda přežila klimatickou krizi v místních útočištích."];
  const rebirthText = "Po vymření znovu vznikl mikrobiální život.";
  const milestones = [0, 6, 17, 31, 74, 134, 212];
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const wrap = x => (x % W + W) % W;
  const tile = (x, y) => wrap(x) + clamp(y, 0, H - 1) * W;
  const at = (x, y) => tile(Math.floor(x), Math.floor(y));
  const dx = (a, b) => wrap(b - a + W / 2) - W / 2;
  const distance = (a, b) => Math.hypot(dx(a.x, b.x), b.y - a.y);
  const position = i => ({ x: i % W + 0.5, y: Math.floor(i / W) + 0.5 });
  const layer = () => new Float32Array(SIZE);
  const cloudRadius = water => Math.min(3.3, 0.75 + Math.sqrt(water) * 0.66);

  function hash(x, y, seed) {
    let bits = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653);
    bits = Math.imul(bits ^ bits >>> 13, 1274126177);
    return ((bits ^ bits >>> 16) >>> 0) / 4294967296;
  }

  function terrainNoise(x, y, seed, columns) {
    const u = x * columns / W, v = y * columns / W;
    const a = Math.floor(u), b = Math.floor(v);
    const sx = (u - a) ** 2 * (3 - 2 * (u - a));
    const sy = (v - b) ** 2 * (3 - 2 * (v - b));
    const top = hash(a, b, seed) * (1 - sx) + hash((a + 1) % columns, b, seed) * sx;
    const bottom = hash(a, b + 1, seed) * (1 - sx) + hash((a + 1) % columns, b + 1, seed) * sx;
    return top * (1 - sy) + bottom * sy;
  }

  function makeRelief(seed) {
    const kind = Math.floor(hash(4, 19, seed) * LANDFORMS.length);
    const random = n => hash(n, 83, seed);
    const blobs = [], primary = [10, 2, 4, 1][kind];
    const offset = random(1) * W;
    for (let n = 0; n < primary; n++) {
      const island = kind === 0;
      let center = null, clearance = -Infinity;
      if (island) for (let attempt = 0; attempt < 48; attempt++) {
        const candidate = { x: random(240 + n * 73 + attempt) * W,
          y: H * (0.18 + random(1210 + n * 73 + attempt) * 0.64) };
        const gap = Math.min(Infinity, ...blobs.map(blob => Math.hypot(dx(blob.x, candidate.x), (blob.y - candidate.y) * 1.2)));
        if (gap > clearance) { center = candidate; clearance = gap; }
        if (gap >= 15.5) break;
      }
      blobs.push({
        x: island ? center.x : wrap(offset + (n + random(n + 2) * 0.7) * W / primary),
        y: island ? center.y : H * (0.22 + random(n + 21) * 0.56),
        rx: island ? 4.5 + random(n + 42) * 2.5 : 14 + random(n + 42) * 9,
        ry: island ? 3.5 + random(n + 62) * 2 : 9 + random(n + 62) * 7
      });
    }
    if (kind !== 0) for (let n = 0; n < (kind === 3 ? 10 : 6); n++) {
      blobs.push({ x: random(n + 91) * W, y: H * (0.18 + random(n + 112) * 0.64),
        rx: 3 + random(n + 132) * 5, ry: 2.5 + random(n + 151) * 4 });
    }
    const density = layer(), samples = [];
    for (let i = 0; i < SIZE; i++) {
      const x = i % W + 0.5, y = Math.floor(i / W) + 0.5;
      const bendX = (terrainNoise(x, y, seed + 31, 5) - 0.5) * 9;
      const bendY = (terrainNoise(x, y, seed + 49, 6) - 0.5) * 5;
      let mass = -3;
      for (const blob of blobs) {
        mass = Math.max(mass, 1 - Math.hypot(dx(blob.x, x + bendX) / blob.rx, (y + bendY - blob.y) / blob.ry));
      }
      density[i] = mass + (terrainNoise(x, y, seed + 8, 19) - 0.5) * 0.40
        + (terrainNoise(x, y, seed + 23, 39) - 0.5) * 0.12;
      if (y > H * 0.12 && y < H * 0.88) samples.push(density[i]);
    }
    samples.sort((a, b) => a - b);
    const seaShare = [0.66, 0.47, 0.51, 0.67][kind] + (random(180) - 0.5) * 0.08;
    const shore = samples[Math.floor(samples.length * seaShare)];
    const heights = layer();
    for (let i = 0; i < SIZE; i++) {
      const x = i % W, y = Math.floor(i / W), land = density[i] - shore;
      const ridges = Math.max(0, 0.5 - Math.abs(terrainNoise(x, y, seed + 57, 11) - 0.5) * 2);
      heights[i] = clamp(0.421 + land * (land > 0 ? 0.33 : 0.24)
        + Math.max(0, land - 0.10) * ridges * 0.48, 0.12, 0.96);
    }
    return { heights, kind: LANDFORMS[kind] };
  }

  function create(seed) {
    const relief = makeRelief(seed);
    const s = {
      seed, nativeFoundersVersion: 3, nativeFounderCount: 0, landform: relief.kind, time: 0, progress: 0, era: 0, legacyClimate: 0, orbitalStress: 0, supported: false, habitat: 0,
      air: layer(), nextAir: layer(), soil: layer(), water: layer(), ice: layer(),
      springs: [],
      volcanoes: [], embers: [], lava: layer(), basalt: new Uint8Array(SIZE), lavaArea: 0, lavaPlots: 0,
      crater: new Uint8Array(SIZE), impactDust: 0, lastImpact: null, smog: layer(),
      height: layer(), rain: layer(), flow: layer(), plants: layer(), fire: layer(), burnScar: layer(),
      heat: layer(), temperature: layer(), windX: layer(), windY: layer(), shade: layer(),
      wet: layer(), level: layer(), nextWater: layer(), ignition: new Uint8Array(SIZE),
      polar: new Uint8Array(SIZE), downstream: new Uint16Array(SIZE), openWater: 0, iceCover: 0,
      ocean: new Uint8Array(SIZE), east: new Uint16Array(SIZE), west: new Uint16Array(SIZE),
      north: new Uint16Array(SIZE), south: new Uint16Array(SIZE), coast: -1, land: 0,
      queue: new Uint16Array(SIZE), previous: new Int16Array(SIZE), region: new Uint16Array(SIZE),
      regionRevision: 0, regionAt: 0, groundChanged: false,
      noBuild: new Uint8Array(SIZE), damageCause: new Uint8Array(SIZE), damageNotice: new Uint8Array(SIZE),
      climateSupport: new Uint8Array(SIZE),
      herds: [], packs: [], tribes: [], colony: -1, nextChoice: 0, nextStrike: 0,
      urban: new Uint8Array(SIZE), damage: layer(), plots: [], towns: [], buildAt: 0,
      plotTown: new Uint8Array(SIZE), claims: new Uint8Array(SIZE), societyAt: 0,
      expeditions: [], monuments: [], border: null, battle: null, battleAt: 0, dominant: 0, warCasualties: 0,
      colonizedAt: null, power: emptyPower(), research: emptyResearch(), stations: [], nextStationId: 1, shelter: 0, townShelter: 0, climateCoverage: 0,
      links: [], airLink: null, trade: 0,
      ports: [], boats: [], seaLinks: [], nextSeaId: 1, seaAt: 0,
      floodPlots: 0, burnedPlots: 0, coldPlots: 0, ruins: 0, dryStress: 0, frostStress: 0, disasterRate: 0, urbanAlert: "",
      clouds: [], cloudCheckAt: 0, naturalCloudAt: 5,
      storm: false, lightning: null, fires: 0, moisture: 0, rainfall: 0, green: 0, lakes: 0,
      relation: "", stress: 0
    };
    s.neighbors = [s.east, s.west, s.north, s.south];
    for (let i = 0; i < SIZE; i++) {
      const x = i % W, y = Math.floor(i / W);
      const latitude = (y + 0.5 - H / 2) / (H / 2);
      const rock = relief.heights[i];
      const polar = Math.abs(latitude) + (terrainNoise(x, y, seed + 27, 10) - 0.5) * 0.105 > 0.83;
      const depth = Math.max(0, (SEA_LEVEL - rock) / DEPTH_UNIT);
      s.height[i] = rock;
      s.polar[i] = polar;
      s.shade[i] = latitude ** 2 * 0.55;
      s.temperature[i] = polar ? 0.035 : 0.52 - s.shade[i] - Math.max(0, rock - 0.46) * 0.32;
      s.air[i] = 0.14 + (depth > 0.65 ? 0.28 : 0.12) * (0.65 + terrainNoise(x, y, seed + 19, 8));
      s.soil[i] = depth > 0.60 ? 0 : 0.10 + 0.30 * terrainNoise(x, y, seed + 3, 6);
      s.ice[i] = polar ? Math.max(depth, 0.78 + terrainNoise(x, y, seed + 4, 13) * 0.90) : 0;
      s.water[i] = polar ? 0 : Math.max(depth, 0.02);
      s.ocean[i] = s.water[i] + s.ice[i] > 0.62;
      s.east[i] = tile(x + 1, y);
      s.west[i] = tile(x - 1, y);
      s.north[i] = tile(x, y - 1);
      s.south[i] = tile(x, y + 1);
      s.downstream[i] = i;
    }
    for (let i = 0; i < SIZE; i++) {
      if (!s.ocean[i] && s.neighbors.some(list => s.ocean[list[i]])) s.soil[i] += 0.14;
    }
    classifyGround(s);
    rebuildRegions(s);
    return s;
  }

  function classifyGround(s) {
    if (typeof Evolution !== "undefined") Evolution.invalidateGround(s);
    let land = 0, open = 0, frozen = 0, shorelineChanged = false;
    for (let i = 0; i < SIZE; i++) {
      const deep = s.water[i] + s.ice[i] > (s.ocean[i] ? 0.48 : 0.66);
      if (deep !== Boolean(s.ocean[i])) shorelineChanged = true;
      s.ocean[i] = deep;
      if (!deep) land++;
      if (s.water[i] > 0.17) open++;
      if (s.ice[i] > 0.16) frozen++;
    }
    if (shorelineChanged) {
      s.groundChanged = true;
      marineWaters.delete(s);
    }
    s.land = land;
    s.openWater = open;
    s.iceCover = frozen;
  }

  function initializeClimate(s, base) {
    for(let i=0;i<SIZE;i++) {
      const temp = localAmbient(s, i, base);
      s.temperature[i]=temp;
      if(temp<FREEZE_AT) {s.ice[i]+=s.water[i];s.water[i]=0;}
      else {s.water[i]+=s.ice[i];s.ice[i]=0;}
    }
    classifyGround(s);rebuildRegions(s);
  }
  function rebuildRegions(s) {
    s.region.fill(0);
    s.regionRevision++;
    s.regionAt = s.time + 1;
    s.groundChanged = false;
    s.coast = -1;
    let region = 0;
    const sizes = [0], shores = [];
    for (let i = 0; i < SIZE; i++) {
      if (s.ocean[i]) continue;
      if (!s.polar[i] && s.water[i] < 0.27 && s.neighbors.some(list => s.water[list[i]] > 0.48)) {
        shores.push(i);
      }
      if (s.region[i]) continue;
      s.region[i] = ++region;
      s.queue[0] = i;
      let end = 1;
      for (let j = 0; j < end; j++) {
        const current = s.queue[j];
        for (const list of s.neighbors) {
          const next = list[current];
          if (s.ocean[next] || s.region[next]) continue;
          s.region[next] = region;
          s.queue[end++] = next;
        }
      }
      sizes[region] = end;
    }
    let bestShore = Infinity;
    for (const i of shores) {
      const score = s.height[i] + Math.max(0, 28 - sizes[s.region[i]]) * 0.04;
      if (score < bestShore) { bestShore = score; s.coast = i; }
    }
    if (s.coast < 0) s.coast = s.ocean.findIndex((deep, i) => !deep && !s.polar[i]);
  }

  function gust(s, start, end, radius = BRUSH_RADII.medium) {
    const x = end.x - start.x, y = end.y - start.y;
    const length = Math.hypot(x, y);
    if (length < 0.65) return;
    const reach = Math.min(length, WIND_REACH), strength = clamp(length * 0.12, 0.24, 0.92);
    const ux = x / length, uy = y / length;
    for (let i = 0; i < SIZE; i++) {
      const vx = i % W + 0.5 - start.x, vy = Math.floor(i / W) + 0.5 - start.y;
      const projection = clamp(vx * ux + vy * uy, 0, reach);
      const range = Math.hypot(vx - projection * ux, vy - projection * uy);
      if (range >= radius) continue;
      const power = strength * (1 - range / (radius + 1));
      s.windX[i] = clamp(s.windX[i] * 0.48 + ux * power, -0.92, 0.92);
      s.windY[i] = clamp(s.windY[i] * 0.48 + uy * power, -0.92, 0.92);
    }
  }

  function temper(s, point, amount, radius = BRUSH_RADII.medium) {
    for (let y = Math.max(0, Math.floor(point.y - radius)); y < Math.min(H, point.y + radius); y++) {
      for (let x = Math.floor(point.x - radius); x < point.x + radius; x++) {
        const influence = 1 - Math.hypot(x + 0.5 - point.x, y + 0.5 - point.y) / radius;
        if (influence <= 0) continue;
        const i = tile(x, y);
        const impulse = amount * influence;
        s.heat[i] = clamp(s.heat[i] + impulse, -0.78, 0.78);
        // Godly heat is allowed to thaw even the highest glaciers. Transfer the
        // thawed mass to liquid water, so it can run downhill instead of simply
        // hiding the ice in the renderer. Cooling never removes ice directly.
        if (impulse > 0 && s.ice[i] > 0) {
          const melt = Math.min(s.ice[i], impulse * 0.72);
          s.ice[i] -= melt;
          s.water[i] += melt;
        }
      }
    }
  }

  function sculpt(s, start, end, amount, brush, stroke) {
    const radius = brush * TERRAIN_RADIUS;
    const dx = end.x - start.x, dy = end.y - start.y;
    const length2 = dx * dx + dy * dy;
    for (let y = Math.max(0, Math.floor(Math.min(start.y, end.y) - radius)); y < Math.min(H, Math.max(start.y, end.y) + radius); y++) {
      for (let x = Math.floor(Math.min(start.x, end.x) - radius); x < Math.max(start.x, end.x) + radius; x++) {
        const ox = x + 0.5 - start.x, oy = y + 0.5 - start.y;
        const t = length2 ? clamp((ox * dx + oy * dy) / length2, 0, 1) : 0;
        const influence = 1 - Math.hypot(ox - dx * t, oy - dy * t) / radius;
        const i = tile(x, y);
        const previous = stroke?.[i] ?? 0;
        if (influence <= previous) continue;
        s.height[i] = clamp(s.height[i] + amount * (influence - previous), 0.015, MAX_TERRAIN_HEIGHT);
        if (stroke) stroke[i] = influence;
      }
    }
  }

  function toggleSpring(s, point) {
    const i = at(point.x, point.y);
    const existing = s.springs.indexOf(i);
    if (existing >= 0) s.springs.splice(existing, 1);
    else s.springs.push(i);
  }

  function toggleVolcano(s, point) {
    const i = at(point.x, point.y);
    const existing = s.volcanoes.findIndex(vent => vent.tile === i);
    if (existing >= 0) s.volcanoes.splice(existing, 1);
    else s.volcanoes.push({ tile: i, burstAt: s.time });
  }

  function meteorImpact(s, point, large, comet = false) {
    const center = at(point.x, point.y);
    const cx = center % W, cy = Math.floor(center / W);
    const craterRadius = large ? 8 : 4;
    const oldRadius = comet ? 7 : craterRadius;
    const radius = large ? VISITOR_IMPACT_RADIUS.large : comet ? VISITOR_IMPACT_RADIUS.comet : VISITOR_IMPACT_RADIUS.asteroid;
    const depth = large ? 0.32 : 0.23;
    const ignitionSites = [];
    for (let y = -radius; y <= radius; y++) {
      if (cy + y < 0 || cy + y >= H) continue;
      for (let x = -radius; x <= radius; x++) {
        const distance = Math.hypot(x, y), range = distance / radius;
        if (range > 1) continue;
        const i = tile(cx + x, cy + y);
        const shock = Math.max(1 - (distance / oldRadius) ** 2, 0.04 + 0.19 * (1 - range ** 2));
        const craterRange = distance / craterRadius;
        const rim = Math.max(0, 1 - Math.abs(craterRange - 0.81) / 0.19);
        const burned = !s.ocean[i] && s.wet[i] < 0.52 && fuel(s, i) > 0.18;
        s.height[i] = clamp(s.height[i] - depth * Math.max(0, 1 - (craterRange / 0.73) ** 2) + rim * 0.075, 0.015, MAX_TERRAIN_HEIGHT);
        s.crater[i] = Math.max(s.crater[i], Math.round(220 * Math.max(1 - craterRange ** 2, rim * 0.78)));
        const vapor = Math.min(s.water[i], shock * (large ? 0.80 : 0.40));
        s.water[i] -= vapor;
        s.air[i] += vapor;
        s.heat[i] = Math.min(0.78, s.heat[i] + shock * 0.82);
        s.plants[i] *= 1 - shock * 0.95;
        if (s.urban[i]) { s.damage[i] = clamp(s.damage[i] + shock * (large ? 1.7 : comet ? 1.45 : 1.15), 0, 1); s.damageCause[i] = 6; }
        if (comet && burned && shock > 0.06 && s.water[i] < 0.14 && craterRange > 0.75 && fuel(s, i) > 0.14) {
          ignitionSites.push({i, x, y, score: hash(i, Math.floor(s.time * 4), s.seed)});
        } else if (!comet && burned && range > 0.35 && hash(i, Math.floor(s.time * 4), s.seed) < 0.55 * shock) {
          s.fire[i] = Math.max(s.fire[i], 0.82);
        }
      }
    }
    const ignited = [];
    for (const site of ignitionSites.sort((a, b) => b.score - a.score)) {
      if (ignited.some(other => Math.hypot(site.x - other.x, site.y - other.y) < 2.5)) continue;
      s.fire[site.i] = Math.max(s.fire[site.i], 0.82);
      ignited.push(site);
      if (ignited.length >= 5) break;
    }
    s.lastImpact = { tile: center, radius, time: s.time };
    if (large) s.impactDust = Math.max(s.impactDust, 0.30);
    s.nextChoice = s.time;
    return ignited.length;
  }

  function moveAir(s) {
    const { air, nextAir, east, west, north, south, windX, windY } = s;
    nextAir.fill(0);
    for (let i = 0; i < SIZE; i++) {
      const humidity = air[i], e = east[i], w = west[i], n = north[i], down = south[i];
      const x = windX[i] * 0.28 + 0.033, y = windY[i] * 0.28;
      const scale = 0.89 / Math.max(0.89, Math.abs(x) + Math.abs(y));
      const u = Math.abs(x) * scale, v = Math.abs(y) * scale;
      const spread = humidity * 0.018;
      nextAir[x >= 0 ? e : w] += humidity * u;
      nextAir[y >= 0 ? down : n] += humidity * v;
      nextAir[i] += humidity * (1 - u - v) - 4 * spread;
      nextAir[e] += spread;
      nextAir[w] += spread;
      nextAir[n] += spread;
      nextAir[down] += spread;
      windX[i] *= 0.948;
      windY[i] *= 0.948;
    }
    s.air = nextAir;
    s.nextAir = air;
  }

  function formCloud(s) {
    if (s.time < s.cloudCheckAt) return;
    s.cloudCheckAt = s.time + 0.75;
    const natural = s.time >= s.naturalCloudAt && s.clouds.length < NATURAL_CLOUDS;
    let best = -1, score = 0, heated = false;
    for (let i = 0; i < SIZE; i++) {
      const overWater = s.water[i] > 0.24;
      const lift = overWater && s.heat[i] > 0.15 && s.temperature[i] > 0.13;
      if (!natural && !lift) continue;
      const humid = (s.air[i] * 2 + s.air[s.east[i]] + s.air[s.west[i]] + s.air[s.north[i]] + s.air[s.south[i]]) / 6;
      const threshold = lift ? 0.52 - s.heat[i] * 0.22 : overWater ? 0.65 : 0.74;
      if (humid < threshold) continue;
      const rank = humid - threshold + (lift ? 0.28 : hash(i, Math.floor(s.time / 4), s.seed) * 0.10);
      if (rank <= score) continue;
      const p = position(i);
      if (s.clouds.some(cloud => s.time < cloud.fadeAt && distance(p, cloud) < (lift ? 3.2 : 6.5))) continue;
      best = i;
      score = rank;
      heated = lift;
    }
    if (best < 0) return;
    const p = position(best);
    const source = [];
    let available = 0;
    for (let y = -2; y <= 2; y++) {
      if (p.y + y < 0 || p.y + y >= H) continue;
      for (let x = -2; x <= 2; x++) {
        if (x * x + y * y > 6) continue;
        const i = at(p.x + x, p.y + y);
        const vapor = Math.max(0, s.air[i] - 0.26);
        source.push([i, vapor]);
        available += vapor;
      }
    }
    const water = Math.min(4.7, available * 0.62);
    if (water < 1.25) return;
    if (s.clouds.length >= CLOUD_LIMIT) {
      const oldest = s.clouds[0];
      oldest.fadeAt = Math.min(oldest.fadeAt, s.time);
      oldest.clearAt = Math.min(oldest.clearAt, s.time + CLOUD_RENEWAL);
      return;
    }
    for (const [i, vapor] of source) s.air[i] -= water * vapor / available;
    const shape = hash(best, Math.floor(s.time / STEP), s.seed);
    const fadeAt = s.time + 17 + shape * 10 + (heated ? 3 : 0);
    s.clouds.push({ ...p, previousX: p.x, previousY: p.y, water, vx: 0.052, vy: 0, wetTime: 0, rain: 0, storm: false,
      shape, fadeAt, clearAt: fadeAt + CLOUD_FADE });
    if (!heated) s.naturalCloudAt = s.time + 4.75;
  }

  function breeze(field, x, y) {
    const i = Math.floor(x - 0.5), j = Math.floor(y - 0.5);
    const u = x - 0.5 - i, v = y - 0.5 - j;
    const north = field[tile(i, j)] * (1 - u) + field[tile(i + 1, j)] * u;
    const south = field[tile(i, j + 1)] * (1 - u) + field[tile(i + 1, j + 1)] * u;
    return north * (1 - v) + south * v;
  }

  function rainFrom(s, cloud) {
    const radius = 0.8 + cloudRadius(cloud.water) * 0.58;
    const tiles = [];
    let total = 0;
    for (let y = Math.max(0, Math.floor(cloud.y - radius)); y < Math.min(H, cloud.y + radius); y++) {
      for (let x = Math.floor(cloud.x - radius); x < cloud.x + radius; x++) {
        const weight = 1 - Math.hypot(x + 0.5 - cloud.x, y + 0.5 - cloud.y) / radius;
        if (weight <= 0) continue;
        tiles.push([tile(x, y), weight]);
        total += weight;
      }
    }
    for (const [i, weight] of tiles) s.rain[i] += cloud.rain * weight / total;
  }

  function updateCloudRain(s) {
    s.rain.fill(0);
    for (const cloud of s.clouds) if (Number.isFinite(cloud.rain) && cloud.rain > 0) rainFrom(s, cloud);
    s.rainfall = s.rain.reduce((cells, fall) => cells + Number(fall > 0.008), 0);
  }

  function cloudWeather(s) {
    let stormTile = -1, heaviest = 0;
    for (let k = s.clouds.length - 1; k >= 0; k--) {
      const cloud = s.clouds[k];
      cloud.previousX = cloud.x;
      cloud.previousY = cloud.y;
      cloud.vx = cloud.vx * 0.56 + (0.052 + breeze(s.windX, cloud.x, cloud.y) * 0.98) * 0.44;
      cloud.vy = cloud.vy * 0.56 + breeze(s.windY, cloud.x, cloud.y) * 0.43;
      cloud.x = wrap(cloud.x + cloud.vx);
      cloud.y = clamp(cloud.y + cloud.vy, 0.5, H - 0.5);
      const center = at(cloud.x, cloud.y);
      const temp = s.temperature[center];
      const saturation = 0.59 + clamp(temp, -0.2, 1.15) * 0.19;
      const fading = s.time >= cloud.fadeAt;
      let humidity = 0, uptake = 0, cells = 0;
      for (let y = -1; y <= 1; y++) {
        if (cloud.y + y < 0 || cloud.y + y >= H) continue;
        for (let x = -1; x <= 1; x++) {
          const i = at(cloud.x + x, cloud.y + y);
          const vapor = s.air[i];
          const condensed = fading ? 0 : Math.max(0, vapor - saturation) * 0.23;
          humidity += vapor;
          cells++;
          s.air[i] -= condensed;
          uptake += condensed;
        }
      }
      cloud.water += uptake;
      const dry = Math.max(0, saturation - humidity / cells);
      const mixing = fading ? cloud.water / Math.max(STEP, cloud.clearAt - s.time + STEP) : 0;
      const loss = Math.min(cloud.water, STEP * (0.012 + dry * 1.66 + mixing));
      cloud.water -= loss;
      s.air[center] += loss * 0.4;
      for (const list of s.neighbors) s.air[list[center]] += loss * 0.15;
      if (cloud.water < 0.19) {
        s.air[center] += cloud.water;
        s.clouds.splice(k, 1);
        continue;
      }
      const rainPoint = 6.35 - clamp((0.46 - temp) * 3.6, -0.9, 1.8);
      cloud.wetTime = cloud.water > rainPoint ? cloud.wetTime + STEP : Math.max(0, cloud.wetTime - STEP * 2);
      cloud.rain = cloud.wetTime >= 1.25
        ? Math.min(cloud.water, STEP * Math.max(0, cloud.water - rainPoint + 0.5) * 1.28) : 0;
      cloud.storm = cloud.wetTime >= 1.75 && cloud.water > rainPoint + 1.35;
      if (cloud.storm && cloud.water > heaviest) {
        heaviest = cloud.water;
        stormTile = center;
      }
      cloud.water -= cloud.rain;
    }
    formCloud(s);
    updateCloudRain(s);
    return stormTile;
  }

  function routeWater(s) {
    const { height, water, ice, level, nextWater, flow, downstream, neighbors } = s;
    nextWater.fill(0);
    for (let i = 0; i < SIZE; i++) level[i] = height[i] + (water[i] + ice[i]) * DEPTH_UNIT;
    for (let i = 0; i < SIZE; i++) {
      flow[i] = 0;
      downstream[i] = i;
      if (water[i] < 0.007) continue;
      let gradient = 0, steepest = 0;
      for (const list of neighbors) {
        const j = list[i];
        const drop = level[i] - level[j] - 0.0008;
        if (drop <= 0) continue;
        gradient += drop;
        if (drop > steepest) {
          downstream[i] = j;
          steepest = drop;
        }
      }
      if (gradient === 0) continue;
      const rate = Math.min(3.8, water[i] * 0.52 / gradient);
      flow[i] = gradient * rate;
      nextWater[i] -= flow[i];
      for (const list of neighbors) {
        const j = list[i];
        const drop = level[i] - level[j] - 0.0008;
        if (drop > 0) nextWater[j] += drop * rate;
      }
    }
    for (let i = 0; i < SIZE; i++) water[i] += nextWater[i];
  }

  function throwEmbers(s, vent) {
    const origin = position(vent.tile), tick = Math.round(s.time / STEP);
    const spin = hash(vent.tile, tick, s.seed) * Math.PI * 2;
    for (let i = 0; i < 5; i++) {
      const angle = spin + (i + 0.5 * hash(tick, vent.tile + i, s.seed)) * Math.PI * 0.4;
      const range = 2 + 4.3 * hash(vent.tile + i, tick + 17, s.seed);
      const target = at(origin.x + Math.cos(angle) * range, origin.y + Math.sin(angle) * range);
      s.embers.push({ from: vent.tile, target, at: s.time, duration: 0.58 + range * 0.17 });
    }
    vent.burstAt = s.time + 3.8 + hash(tick, vent.tile, s.seed) * 2.6;
  }

  function volcanicHeat(s, base) {
    const { lava, height, water, ice, basalt, temperature, nextWater } = s;
    // The temperature and transfer buffers are reused before the weather and water steps.
    temperature.fill(0);
    if (!s.volcanoes.length && !s.lavaArea) return;
    for (const vent of s.volcanoes) {
      if (lava[vent.tile] < MOLTEN) s.groundChanged = true;
      lava[vent.tile] += LAVA_FLOW * STEP;
      if (s.time >= vent.burstAt) throwEmbers(s, vent);
      const origin = position(vent.tile);
      for (let y = -6; y <= 6; y++) {
        if (origin.y + y < 0 || origin.y + y >= H) continue;
        for (let x = -6; x <= 6; x++) {
          const reach = 1 - Math.hypot(x, y) / VOLCANO_REACH;
          if (reach > 0) temperature[at(origin.x + x, origin.y + y)] += reach * 1.08;
        }
      }
    }
    nextWater.fill(0);
    for (let i = 0; i < SIZE; i++) {
      if (lava[i] <= 0.007) continue;
      const level = height[i] + lava[i] * 0.032;
      let target = -1, low = level - 0.002;
      for (const list of s.neighbors) {
        const j = list[i], other = height[j] + lava[j] * 0.032;
        if (other < low) { target = j; low = other; }
      }
      if (target < 0) continue;
      const moved = Math.min(lava[i] * 0.27, (level - low) * 2.1);
      nextWater[i] -= moved;
      nextWater[target] += moved;
    }
    const cold = Math.max(0, 0.32 - base) * 0.08;
    s.lavaArea = 0;
    for (let i = 0; i < SIZE; i++) {
      const amount = lava[i] + nextWater[i];
      if (amount <= 0) continue;
      const wasMolten = lava[i] >= MOLTEN;
      const cooling = STEP * (0.070 + cold + Math.min(1.2, water[i]) * 0.42 + Math.min(1.2, ice[i]) * 0.14);
      lava[i] = amount > cooling + 0.007 ? amount - cooling : 0;
      if (wasMolten !== (lava[i] >= MOLTEN)) s.groundChanged = true;
      const rock = amount - lava[i];
      basalt[i] = Math.min(255, basalt[i] + Math.round(rock * 52));
      height[i] = Math.min(MAX_TERRAIN_HEIGHT, height[i] + rock * 0.016);
      temperature[i] += Math.min(0.58, amount * 0.86);
      if (lava[i] > 0) s.lavaArea++;
    }
  }

  function weather(s, base, report, adjustments) {
    volcanicHeat(s, base);
    moveAir(s);
    const { air, water, ice, soil, ocean, heat, temperature, wet, rain } = s;
    const hasThermalAdjustment = adjustments.some(item => item.bias && item.station.fraction > 0);
    for (let i = 0; i < SIZE; i++) {
      const ambient = localAmbient(s, i, base);
      s.smog[i] *= 0.974;
      const geothermal = Math.min(1.25, temperature[i]);
      // Raised walls have a strong lapse-rate cooling term. A divine heat
      // impulse can overcome that extra chill; otherwise even repeated use of
      // Ohřát could never thaw the high summit. Passive climate is unchanged.
      const highAltitudeChill = Math.max(0, s.height[i] - SUMMIT_START) * 4;
      const divineHeat = heat[i] > 0 ? heat[i] + Math.min(highAltitudeChill, heat[i] * 3.5) : heat[i];
      const localTemp = ambient + divineHeat + geothermal;
      const correction = hasThermalAdjustment ? climateAt(adjustments, position(i), localTemp) : 0;
      const temp = temperature[i] = localTemp + correction;
      const protectedTemp = correction ? actorTemperature(s, i, s.towns[s.plotTown[i] - 1] ?? s.bioProfile) : temp;
      s.climateSupport[i] = Number(Math.abs(correction) > 0.035 && protectedTemp >= 0.15 && protectedTemp <= 0.83);
      heat[i] *= 0.983;
      const evaporation = Math.max(0, temp - 0.04);
      const capacity = 0.88 + clamp(temp, -0.2, 1.15) * 0.25;
      const gap = clamp((capacity - air[i]) / capacity, 0, 1);
      const heating = Math.max(0, heat[i] + geothermal + correction);
      const vapor = evaporation * gap * (0.46 + heating * 2.1);
      const fromWater = Math.min(water[i], STEP * vapor * (ocean[i] ? 0.017 + heating * 0.13 : 0.080));
      const fromSoil = Math.min(soil[i], STEP * vapor * 0.023);
      water[i] -= fromWater;
      soil[i] -= fromSoil;
      air[i] += fromWater + fromSoil;
    }
    const stormTile = cloudWeather(s);
    waterClimate(s, adjustments);
    for (const i of s.springs) {
      const reservoir = temperature[i] < FREEZE_AT ? ice : water;
      reservoir[i] += SPRING_FLOW * STEP;
    }
    for (let i = 0; i < SIZE; i++) {
      const temp = temperature[i], fall = rain[i];
      if (temp < FREEZE_AT) {
        // A recent divine heating pulse keeps newly thawed water liquid long
        // enough to drain from the slope. Without it, the next cold simulation
        // tick would instantly turn the melted snow back into ice.
        const freeze = heat[i] > 0.025 ? 0 : Math.min(water[i], STEP * (FREEZE_AT - temp) * (ocean[i] ? 0.48 : 0.92));
        water[i] -= freeze;
        ice[i] += freeze + fall;
        // No unconditional summit frost: exposed rocky peaks regain their
        // snowy cover progressively from actual precipitation (fall above).
      } else {
        const melt = Math.min(ice[i], STEP * (temp - FREEZE_AT) * 0.74);
        ice[i] -= melt;
        water[i] += melt + fall;
      }
      if (!ocean[i]) {
        const soak = Math.min(water[i], STEP * Math.max(0, 0.68 - soil[i]) * 0.46);
        soil[i] += soak;
        water[i] -= soak;
        if (temp > 0.11 && soil[i] < 0.34) {
          let source = i;
          for (const list of s.neighbors) if (water[list[i]] > water[source]) source = list[i];
          if (source !== i && water[source] > 0.16) {
            const seep = Math.min(water[source] * 0.024, STEP * (0.34 - soil[i]) * 0.36);
            water[source] -= seep;
            soil[i] += seep;
          }
        }
      }
    }
    routeWater(s);
    classifyGround(s);
    if (s.groundChanged && s.time >= s.regionAt) rebuildRegions(s);
    let wetLand = 0, lakes = 0, sheltered = 0, habitableLand = 0;
    for (let i = 0; i < SIZE; i++) {
      wet[i] = clamp(soil[i] * 0.85 + water[i] * 1.45, 0, 1);
      if (typeof Evolution !== "undefined" ? !Evolution.ground(s, i, s.bioProfile) : ocean[i]) continue;
      habitableLand++;
      if (s.climateSupport[i]) sheltered++;
      if (water[i] > 0.23) lakes++;
      const lifeTemp = typeof Evolution !== "undefined" ? Evolution.lifeTemperature(s, i) : temperature[i];
      const watered = s.bioProfile === "warm" || soil[i] > 0.25 || s.bioProfile === "cold" && ice[i] > 0.2;
      if (watered && lifeTemp >= 0.11 && lifeTemp <= 0.87 && s.lava[i] < MOLTEN) wetLand++;
    }
    if (stormTile >= 0 && !s.storm) report("Nad krajinou se tvoří bouřka.", "warn");
    if (stormTile >= 0 && s.time >= s.nextStrike) {
      if (!s.storm) s.nextStrike = s.time + 0.75;
      else strike(s, stormTile, report);
    }
    s.storm = stormTile >= 0;
    s.habitat = clamp(wetLand / (SIZE * 0.115), 0, 1);
    s.habitableLand = habitableLand;
    s.moisture = wetLand / Math.max(1, habitableLand);
    s.climateCoverage = sheltered / Math.max(1, habitableLand);
    s.lakes = lakes;
  }

  function strike(s, cloud, report) {
    const p = position(cloud);
    let best = cloud, risk = 0;
    // Lightning can reach a dry edge before the rain gets there.
    for (let y = -5; y <= 5; y++) {
      for (let x = -5; x <= 5; x++) {
        if (x * x + y * y > 25) continue;
        const i = at(p.x + x, p.y + y);
        const score = fuel(s, i) * (1 - s.wet[i]) * (1 - clamp(s.rain[i] * 6, 0, 1));
        if (score <= risk || s.fire[i] > 0.1) continue;
        risk = score;
        best = i;
      }
    }
    s.lightning = { tile: best, time: s.time };
    s.nextStrike = s.time + 5 + hash(best, Math.floor(s.time), s.seed) * 3;
    if (risk > 0.115) {
      s.fire[best] = 0.84;
      report(s.urban[best] >= 3 ? "Blesk udeřil do zástavby." : "Blesk zapálil suchý porost.", "bad");
    }
  }

  function fuel(s, i) {
    const buildings = s.urban[i] >= 3 ? 0.43 : s.urban[i] === 2 ? 0.17 : 0;
    return s.plants[i] + buildings * (1 - s.damage[i]);
  }

  function landEmbers(s, report) {
    if (!s.embers.length) return;
    let ignited = -1;
    s.embers = s.embers.filter(ember => {
      if (s.time < ember.at + ember.duration) return true;
      const i = ember.target;
      if (!s.ocean[i] && s.water[i] < 0.14 && s.wet[i] < 0.56 && s.fire[i] < 0.1 && s.burnScar[i] < 0.28 && fuel(s, i) > 0.14) {
        s.fire[i] = 0.85;
        ignited = i;
      }
      return false;
    });
    if (ignited >= 0) report(s.urban[ignited] >= 3 ? "Žhavý výmet zapálil zástavbu." : "Žhavý výmet zapálil porost.", "bad");
  }

  function vegetation(s, grow, report) {
    landEmbers(s, report);
    const { plants, fire, burnScar, rain, water, wet, ignition, ocean, temperature } = s;
    ignition.fill(0);
    let green = 0, fires = 0, heatedFire = false;
    const tick = Math.round(s.time / STEP);
    for (let i = 0; i < SIZE; i++) {
      burnScar[i] = Math.max(0, burnScar[i] - 0.003);
      const crop = s.urban[i] === 2 ? s.towns[s.plotTown[i] - 1] : null;
      const floraProfile = crop?.profile ?? s.bioProfile;
      const frostFlora = floraProfile === "cold" && typeof Evolution !== "undefined" && Evolution.ground(s, i, "cold");
      if (ocean[i] && !frostFlora) {
        plants[i] *= 0.95;
        fire[i] = 0;
        continue;
      }
      const physicalTemp = temperature[i];
      const temp = typeof Evolution !== "undefined" ? Evolution.temperature(s, i, floraProfile) : physicalTemp;
      const suitable = temp > 0.10 && temp < 0.93;
      const availableMoisture = typeof Evolution !== "undefined" ? Evolution.moisture(s, i, floraProfile) : wet[i];
      const moistureNeed = floraProfile === "warm" ? 0.04 : 0.11;
      const affinity = typeof Evolution !== "undefined" ? Evolution.wetTolerance(s, i, floraProfile) : 1;
      const productivity = floraProfile === "warm" ? 0.28 + 0.08 * clamp(wet[i] / 0.25, 0, 1) : clamp((availableMoisture - moistureNeed) * 1.9, 0, 1);
      const refuge = !grow && suitable && s.era >= 2 && s.era < 4 && plants[i] > 0.22
        && availableMoisture > 0.35 && buildable(s, i, floraProfile);
      const growth = grow || crop && !crop.abandoned ? 1 : refuge ? 0.55 : 0;
      // Scorched ground regenerates gradually. Active flames cannot replenish their own fuel.
      const target = suitable && fire[i] < 0.08 ? growth * productivity * affinity
        * (1 - s.smog[i] * 0.72) * (1 - 0.95 * burnScar[i]) : 0;
      plants[i] += (target - plants[i]) * (target > plants[i] ? 0.040 : 0.020);
      if (contaminated(s, i)) plants[i] = 0;
      if (s.lava[i] >= MOLTEN) plants[i] *= 0.72;
      if (!fire[i] && burnScar[i] < 0.28 && physicalTemp > 1.05 && s.heat[i] > 0.42 && wet[i] < 0.25 && fuel(s, i) > 0.18
        && hash(i, tick, s.seed) < 0.19) {
        fire[i] = 0.70;
        heatedFire = true;
      }
      if (fire[i] > 0) {
        burnScar[i] = Math.max(burnScar[i], 0.88);
        // Burnt buildings and vegetation cannot sustain an eternal fire loop.
        const remainingFuel = fuel(s, i) * (1 - 0.52 * burnScar[i]);
        fire[i] = clamp(fire[i] + (remainingFuel * 0.10 - 0.076 - wet[i] * 0.094 - rain[i] * 2.9 - water[i] * 0.25), 0, 1);
        plants[i] = Math.max(0, plants[i] - 0.068 * fire[i]);
        if (fire[i] < 0.045) fire[i] = 0;
      }
      if (plants[i] > 0.22) green++;
      if (fire[i] === 0) continue;
      fires++;
      for (const [j, wind] of [[s.east[i], s.windX[i] + 0.11], [s.west[i], -s.windX[i]],
        [s.south[i], s.windY[i]], [s.north[i], -s.windY[i]]]) {
        if (ocean[j] || fire[j] > 0 || burnScar[j] > 0.28 || water[j] > 0.22 || rain[j] > 0.085) continue;
        const burnable = fuel(s, j);
        if (burnable < 0.13) continue;
        const chance = fire[i] * burnable * (1 - wet[j]) * (0.23 + 0.40 * Math.max(0, wind));
        if (hash(j, tick, s.seed) < chance) ignition[j] = 1;
      }
    }
    for (let i = 0; i < SIZE; i++) {
      if (!ignition[i]) continue;
      fire[i] = 0.55;
      fires++;
    }
    if (heatedFire && !s.fires) report("V přehřáté krajině vznikl požár.", "bad");
    if (!fires && s.fires) report("Požár dohořel nebo jej uhasila voda.", "good");
    s.green = green;
    s.fires = fires;
  }

  function findSite(s, origin, score) {
    let best = -1, value = -Infinity;
    const start = origin ? at(origin.x, origin.y) : -1;
    const map = typeof Evolution !== "undefined" ? Evolution.regions(s, origin ?? s.bioProfile) : s.region;
    const region = origin ? map[start] || s.neighbors.map(list => map[list[start]]).find(Boolean) : 0;
    if (origin && !region) return -1;
    // Wildlife searches its reachable surroundings; towns can still survey the whole map.
    const radius = origin?.species ? 18 : 0, span = radius * 2 + 1, samples = radius ? span * span : SIZE;
    for (let n = 0; n < samples; n++) {
      const x = radius ? Math.floor(origin.x) + n % span - radius : n % W;
      const y = radius ? Math.floor(origin.y) + Math.floor(n / span) - radius : Math.floor(n / W);
      if (y < 0 || y >= H) continue;
      const i = tile(x, y);
      if (typeof Evolution !== "undefined" ? !Evolution.ground(s, i, origin ?? s.bioProfile) : s.ocean[i] || s.ice[i] > 0.24 || s.fire[i] > 0.08 || s.water[i] > 0.38 || s.lava[i] >= MOLTEN) continue;
      if (region && map[i] !== region) continue;
      const p = position(i);
      const rating = score(i, p) - (origin ? distance(origin, p) * 0.013 : 0);
      if (rating <= value) continue;
      best = i;
      value = rating;
    }
    return best;
  }

  function path(s, start, goal, safeRoute, actor = start) {
    if (start < 0 || start >= SIZE || goal < 0 || goal >= SIZE) return [];
    const { queue, previous } = s;
    previous.fill(-1);
    previous[start] = start;
    queue[0] = start;
    let end = 1;
    for (let j = 0; j < end && previous[goal] === -1; j++) {
      const i = queue[j];
      for (const list of s.neighbors) {
        const next = list[i];
        if (previous[next] !== -1 || (typeof Evolution !== "undefined" ? !Evolution.ground(s, next, actor) || safeRoute && Evolution.comfort(s, next, actor) < 0.08 : s.ocean[next] || s.lava[next] >= MOLTEN || safeRoute && !buildable(s, next))) continue;
        previous[next] = i;
        queue[end++] = next;
      }
    }
    const route = [];
    if (previous[goal] !== -1) {
      for (let i = goal; i !== start; i = previous[i]) route.push(i);
    }
    return route;
  }

  function travel(s, actor, target, speed, safeRoute = false) {
    actor.previousX = actor.x;
    actor.previousY = actor.y;
    const from = at(actor.x, actor.y), to = at(target.x, target.y);
    const walker = actor.profile ? actor : from;
    const map = typeof Evolution !== "undefined" ? Evolution.regions(s, walker) : s.region;
    if ((typeof Evolution !== "undefined" ? !Evolution.ground(s, to, walker) : s.ocean[to] || s.lava[to] >= MOLTEN) || (map[from] && map[to] && map[from] !== map[to])) return false;
    const next = actor.route?.at(-1);
    const blocked = next !== undefined && (typeof Evolution !== "undefined" ? !Evolution.ground(s, next, walker) || safeRoute && Evolution.comfort(s, next, walker) < 0.08 : s.ocean[next] || s.lava[next] >= MOLTEN || safeRoute && !buildable(s, next));
    if (actor.destination !== to || actor.regionRevision !== s.regionRevision || blocked || from !== to && !actor.route?.length) {
      actor.destination = to;
      actor.regionRevision = s.regionRevision;
      actor.route = path(s, from, to, safeRoute, walker);
    }
    if (from !== to && !actor.route.length) return false;
    const hop = actor.route.length ? position(actor.route.at(-1)) : target;
    const x = dx(actor.x, hop.x), y = hop.y - actor.y;
    const length = Math.hypot(x, y);
    if (length <= speed) {
      actor.x = hop.x;
      actor.y = hop.y;
      if (actor.route.length) {
        actor.route.pop();
        return false;
      }
      return true;
    }
    actor.x = wrap(actor.x + x / length * speed);
    actor.y += y / length * speed;
    return false;
  }

  function nearest(s, actor, list, test) {
    let result, best = Infinity;
    const map = typeof Evolution !== "undefined" ? Evolution.regions(s, actor) : s.region;
    const region = map[at(actor.x, actor.y)];
    for (const entry of list) {
      if (!region || map[at(entry.x, entry.y)] !== region || !test(entry)) continue;
      const range = distance(actor, entry);
      if (range >= best) continue;
      best = range;
      result = entry;
    }
    return result;
  }

  function resources(s, i, actor = s.bioProfile) {
    return typeof Evolution !== "undefined" ? Evolution.forage(s, i, actor) : s.wet[i] * 0.61 + s.plants[i] * 0.49;
  }

  function biomeAt(s, i) {
    if (s.ice[i] > 0.3 && s.temperature[i] < 0.28 && buildable(s, i, { profile: "cold" })) return "ice";
    if (s.ocean[i] || s.water[i] > 0.27 || s.ice[i] > 0.24) return "water";
    if (s.temperature[i] >= 0.60 && s.wet[i] > 0.58 && s.plants[i] > 0.32) return "jungle";
    if (s.temperature[i] >= 0.40 && s.wet[i] < 0.34 && s.plants[i] < 0.42) return "desert";
    return "grass";
  }

  function baseAnimalComfort(s, i, animal, shift = 0) {
    const spec = FAUNA[animal.species];
    if (!spec) return typeof Evolution !== "undefined" ? Evolution.comfort(s, i, animal) : 1;
    const [low, mild, high, limit] = spec.temperatures, temperature = s.temperature[i] - shift;
    const cold = spec.profile === "cold", warm = spec.profile === "warm";
    return (cold ? 1 : clamp((temperature - low) / (mild - low), 0, 1)) * (warm ? 1 : clamp((limit - temperature) / (limit - high), 0, 1));
  }

  function animalComfort(s, i, animal) {
    return typeof FaunaEvolution === "undefined" ? baseAnimalComfort(s, i, animal)
      : FaunaEvolution.comfort(s, animal, i, baseAnimalComfort);
  }

  function animalHabitat(s, i, animal) {
    const spec = FAUNA[animal.species];
    if (!spec || contaminated(s, i) || !buildable(s, i, animal)) return 0;
    let habitat = 1;
    if (spec.biome === "ice") habitat = s.ice[i] > 0.3 ? 1 : 0.25;
    if (spec.biome === "desert") habitat = clamp((0.78 - s.wet[i]) / 0.50, 0.08, 1) * (1 - clamp(s.plants[i] - 0.4, 0, 0.6) * 0.7);
    if (spec.biome === "grass") habitat = clamp((s.plants[i] + 0.18) / 0.55, 0.08, 1) * (biomeAt(s, i) === "jungle" ? 0.6 : 1);
    if (spec.biome === "jungle") habitat = clamp((s.wet[i] - 0.12) / 0.48, 0.03, 1) * clamp((s.plants[i] - 0.04) / 0.48, 0.03, 1);
    return habitat * animalComfort(s, i, animal);
  }

  function animalFood(s, i, animal) {
    if (contaminated(s, i)) return 0;
    const spec = FAUNA[animal.species];
    if (spec?.food === "marine") {
      let food = s.marineFood?.[i] ?? 0;
      for (const list of s.neighbors) food = Math.max(food, s.marineFood?.[list[i]] ?? 0);
      return food;
    }
    if (spec?.biome === "desert") return clamp(s.plants[i] * 2.2 + Math.min(0.2, s.wet[i]) * 0.3, 0, 1);
    return clamp(s.plants[i] * 0.95 + s.wet[i] * 0.15, 0, 1);
  }

  function faunaReadiness(s) {
    let best = 0;
    for (const herd of s.herds) {
      if (herd.size <= 0.08) continue;
      const i = at(herd.x, herd.y);
      const support = animalHabitat(s, i, herd) * animalFood(s, i, herd);
      best = Math.max(best, support);
      if (best >= 0.25) return 1;
    }
    return clamp((best - 0.10) / 0.15, 0, 1);
  }

  function tribalProgress(s) {
    return clamp((s.progress - milestones[3]) / (milestones[4] - milestones[3]), 0, 1);
  }

  function distanceFromSea(s) {
    const limit = 6, distance = new Uint8Array(SIZE).fill(limit), queue = s.queue;
    let end = 0;
    for (let i = 0; i < SIZE; i++) if (s.ocean[i]) {
      distance[i] = 0;
      queue[end++] = i;
    }
    for (let j = 0; j < end; j++) {
      const i = queue[j], nextDistance = distance[i] + 1;
      if (nextDistance >= limit) continue;
      for (const side of s.neighbors) {
        const next = side[i];
        if (distance[next] <= nextDistance) continue;
        distance[next] = nextDistance;
        queue[end++] = next;
      }
    }
    return distance;
  }

  function diversifyWildlife(s) {
    s.marineFood ??= layer();
    for (const [list, predator] of [[s.herds, false], [s.packs, true]]) for (const animal of list) {
      if (!FAUNA[animal.species] || Boolean(FAUNA[animal.species].predator) !== predator) {
        const biome = biomeAt(s, at(animal.x, animal.y));
        animal.species = (BIOME_FAUNA[biome] ?? BIOME_FAUNA.grass)[Number(predator)];
      }
      animal.profile = FAUNA[animal.species].profile;
    }
    if (s.era < (typeof FaunaEvolution === "undefined" ? 3 : 2)) return;
    // Aquatic food is an ecosystem stock, not a spendable player resource.
    for (let i = 0; i < SIZE; i++) {
      const wet = s.water[i] + s.ice[i] > 0.32, temperature = s.temperature[i];
      const suitable = wet && (s.ice[i] > 0.3 || temperature > -0.22) && (s.bioProfile === "warm" || temperature < 0.97) && s.lava[i] < MOLTEN;
      const target = suitable ? clamp(0.24 + (s.microbes?.[i] ?? 0) * 0.55 + (s.ice[i] > 0.3 ? 0.22 : 0.10), 0, 1) : 0;
      s.marineFood[i] += (target - s.marineFood[i]) * (target > s.marineFood[i] ? 0.04 : 0.09);
    }
    if (s.era < 3 || s.time < (s.faunaSeedAt ?? 0)) return;
    s.faunaSeedAt = s.time + 8; s.faunaIntroduced ??= {};
    if (s.era === 3 && !s.herds.some(herd => herd.size > 0.03)) s.faunaIntroduced = {};
    const missing = Object.entries(BIOME_FAUNA).filter(([biome]) => !s.faunaIntroduced[biome]);
    if (!missing.length) return;
    const inland = distanceFromSea(s);
    const searches = Object.fromEntries(missing.map(([biome, [herbivore]]) => [biome, {
      specimen: { species: herbivore, profile: FAUNA[herbivore].profile }, candidates: []
    }]));
    for (let i = 0; i < SIZE; i++) {
      const biome = biomeAt(s, i), search = searches[biome];
      if (!search || animalHabitat(s, i, search.specimen) < 0.42) continue;
      const food = animalFood(s, i, search.specimen);
      if (food < 0.16) continue;
      const inlandBonus = biome === "ice" ? 0 : inland[i] * 0.075;
      search.candidates.push({ i, score: food + hash(i, 571, s.seed) * 0.35 + inlandBonus });
    }
    for (const [biome, [herbivore, predator]] of missing) {
      const { specimen, candidates } = searches[biome];
      candidates.sort((a, b) => b.score - a.score);
      const own = s.herds.filter(a => a.species === herbivore && a.size > 0.04);
      let born = 0;
      for (const { i } of candidates) {
        if (own.length >= 6 || born >= 3) break;
        if (own.some(a => distance(a, position(i)) < 4)) continue;
        const animal = { ...position(i), ...specimen, size: 0.55, goal: position(i) }, vacant = s.herds.findIndex(a => a.size < 0.03);
        if (vacant >= 0) s.herds[vacant] = animal; else if (s.herds.length < 28) s.herds.push(animal); else break;
        own.push(animal); born++;
      }
      const predators = s.packs.filter(a => a.species === predator && (a.energy ?? 1) > 0.03);
      if (own.length >= 2 && predators.length < Math.min(2, Math.floor(own.length / 3))) {
        const prey = own[predators.length * 2], animal = { x: prey.x, y: prey.y, species: predator, profile: FAUNA[predator].profile, energy: 0.65 };
        const vacant = s.packs.findIndex(a => a.energy <= 0.03);
        if (vacant >= 0) s.packs[vacant] = animal; else if (s.packs.length < 10) s.packs.push(animal);
      }
      if (own.length >= 6) s.faunaIntroduced[biome] = true;
    }
  }

  function faunaSummary(s) {
    const groups = {};
    for (const animal of [...s.herds.filter(a => a.size > 0.04), ...s.packs.filter(a => (a.energy ?? 1) > 0.03)]) {
      const name = typeof FaunaEvolution === "undefined" ? FAUNA[animal.species]?.name ?? "Zvěř" : FaunaEvolution.name(s, animal);
      groups[name] = (groups[name] ?? 0) + 1;
    }
    const moving = [...s.herds.filter(a => a.size > 0.04), ...s.packs.filter(a => (a.energy ?? 1) > 0.03)].filter(a => a.migrating).length;
    return Object.entries(groups).map(([name, count]) => name + " (" + count + ")").join(" · ")
      + (moving ? " · Vhodnější prostředí hledá " + moving + " skupin." : "");
  }

  function choose(s, report) {
    const grazers = s.herds.filter(herd => herd.size > 0.04 && FAUNA[herd.species]?.food !== "marine");
    const inland = grazers.length ? distanceFromSea(s) : null;
    for (const herd of s.herds) {
      if (herd.size <= 0.03) continue;
      const marine = FAUNA[herd.species]?.food === "marine";
      const nearbyGrazing = marine ? [] : grazers.filter(other => other !== herd)
        .map(other => other.goal ?? other).filter(goal => distance(herd, goal) < 34);
      herd.migrating = animalHabitat(s, at(herd.x, herd.y), herd) < 0.48;
      const i = findSite(s, herd, (j, p) => {
        let risk = 0;
        for (const pack of s.packs) if ((pack.energy ?? 1) > 0.03) risk = Math.max(risk, Math.max(0, 5 - distance(p, pack)) * 0.10);
        const food = animalFood(s, j, herd), habitat = animalHabitat(s, j, herd);
        let gapSquared = 64;
        for (const goal of nearbyGrazing) {
          const y = goal.y - p.y;
          if (Math.abs(y) >= 8) continue;
          const x = dx(p.x, goal.x);
          gapSquared = Math.min(gapSquared, x * x + y * y);
        }
        const crowding = (8 - Math.sqrt(gapSquared)) * 0.055;
        // Only give inland grazing a preference where the herd can actually feed.
        const inlandBonus = !marine && food * habitat >= 0.12 ? (inland?.[j] ?? 0) * 0.075 : 0;
        return food + habitat * 1.9 + inlandBonus - crowding - s.fire[j] * 4 - risk;
      });
      if (i >= 0) herd.goal = position(i);
    }
    for (const tribe of s.tribes) {
      const i = at(tribe.x, tribe.y);
      if (tribe.goal) {
        const goal = at(tribe.goal.x, tribe.goal.y);
        if (!buildable(s, goal, tribe)) tribe.goal = null;
      }
      const flooded = (typeof Evolution !== "undefined" ? Evolution.floodDepth(s, i, tribe) : s.water[i]) > 0.38;
      const molten = s.lava[i] >= MOLTEN;
      if (tribe.goal || (!flooded && !molten && s.fire[i] < 0.1 && resources(s, i) > 0.26)) continue;
      const next = findSite(s, tribe, resources.bind(null, s));
      if (next >= 0 && next !== i && (molten || flooded || s.fire[i] > 0.1 || resources(s, next) >= resources(s, i) + 0.14)) {
        tribe.goal = position(next);
        report(tribe.name + (molten ? " ustupuje před lávou." : flooded ? " ustupuje před vodou."
          : s.fire[i] > 0.1 ? " opouští osadu kvůli ohni." : " hledá vodu a potravu."), "warn");
      }
    }
  }

  function microbialHabitat(s, i) {
    const dryLife = s.bioProfile === "warm" && !s.ocean[i] && s.ice[i] < 0.24 && s.lava[i] < MOLTEN;
    if (!dryLife && s.water[i] + s.ice[i] < 0.32) return 0;
    const temp = typeof Evolution !== "undefined" ? Evolution.lifeTemperature(s, i) : s.temperature[i];
    if (s.fire[i] >= 0.09 || s.lava[i] >= MOLTEN
      || s.temperature[i] < -0.65 || s.temperature[i] > 1.20) return 1;
    const usable = dryLife || (s.bioProfile === "cold" ? s.water[i] + s.ice[i] > 0.32 : s.water[i] > 0.32 && s.ice[i] < 0.18);
    return usable && temp > 0.17 && temp < 0.85 ? 2 : 1;
  }

  function microbialLife(s) {
    s.microbes ??= new Float32Array(SIZE);
    if (s.era < 1) return;
    s.microbialSites = 0;
    let covered = 0, water = 0;
    for (let i = 0; i < SIZE; i++) {
      const habitat = microbialHabitat(s, i);
      if (!habitat) { s.microbes[i] *= 0.97; continue; }
      water++;
      if (habitat === 2) {
        s.microbialSites++;
        const neighboring = Math.max(s.microbes[s.east[i]], s.microbes[s.west[i]], s.microbes[s.north[i]], s.microbes[s.south[i]]);
        const seed = hash(i, 431, s.seed) > 0.995 ? 0.08 : 0;
        const aquatic = s.water[i] + s.ice[i] >= 0.32;
        const capacity = s.era < 3 ? 1 : aquatic ? 0.55 : 0.20;
        const density = s.microbes[i];
        const growth = (0.025 * density + 0.045 * neighboring + seed) * (1 - density / capacity);
        s.microbes[i] = clamp(density + STEP * (density > capacity ? -0.18 * (density - capacity) : growth), 0, 1);
      } else s.microbes[i] *= 1 - STEP * (s.ice[i] > 0.18 ? 0.03 : 0.13);
      if (s.microbes[i] > 0.12) covered++;
    }
    s.microbeCoverage = water ? covered / water : 0;
  }

  function recoverMicrobes(s, report) {
    // A fresh chance each second with usable habitat, including during short seasonal thaws.
    if (Math.round(s.time / STEP) % Math.round(1 / STEP)) return;
    const time = Math.floor(s.time);
    let sites = 0, best = -1, rank = -1;
    for (let i = 0; i < SIZE; i++) {
      if (s.fire[i] >= 0.09 || s.lava[i] >= MOLTEN || microbialHabitat(s, i) !== 2) continue;
      sites++;
      const candidate = hash(i, time, s.seed + 351);
      if (candidate > rank) { best = i; rank = candidate; }
    }
    s.microbialSites = sites;
    const chance = Math.min(0.70, 0.05 + 0.015 * Math.sqrt(sites));
    if (best < 0 || hash(time, 9271, s.seed) >= chance) return;
    s.era = 1;
    s.progress = milestones[1];
    s.lifeRecovery = "recovered";
    s.stress = 0;
    s.microbes[best] = 0.20;
    microbialLife(s);
    report(rebirthText, "good");
  }

  function refugeEra(s) {
    if (s.era >= 3 && s.herds.some(herd => {
      if (herd.size <= 0.10) return false;
      const i = at(herd.x, herd.y);
      return animalHabitat(s, i, herd) * animalFood(s, i, herd) >= 0.14;
    })) return 3;
    if (s.era >= 2 && typeof FaunaEvolution !== "undefined" && FaunaEvolution.hasAquaticRefuge(s)) return 2;
    let microbes = false;
    for (let i = 0; i < SIZE; i++) {
      if (s.lava[i] >= MOLTEN || s.fire[i] >= 0.09) continue;
      if (s.era >= 2 && s.plants[i] > 0.22) {
        const temp = actorTemperature(s, i, s.bioProfile);
        const moisture = typeof Evolution !== "undefined" ? Evolution.moisture(s, i, s.bioProfile) : s.wet[i];
        if (moisture > 0.35 && temp > 0.10 && temp < 0.93 && buildable(s, i, s.bioProfile)) return 2;
      }
      if (!microbes && s.microbes[i] > 0.12 && microbialHabitat(s, i) === 2) microbes = true;
    }
    return microbes ? 1 : 0;
  }

  function beginLifeRecovery(s) {
    s.lifeRecovery = "waiting";
    s.lifeRefuge = 0;
    s.microbes?.fill(0);
    s.microbeCoverage = 0;
    s.microbialSites = 0;
  }

  function biosphereCrisis(s, population, report) {
    if (!s.stress) s.lifeRefuge = 0;
    if (s.era < 1 || (s.era >= 4 && (population > 0 || s.tribes.length > 0)) || s.era > 4 || s.stress <= 14) return;
    const survivingEra = refugeEra(s);
    if (survivingEra && s.lifeRefuge !== survivingEra) report(refugeText[survivingEra], "good");
    s.lifeRefuge = survivingEra;
    if (survivingEra === s.era) return;
    s.era = survivingEra;
    s.progress = milestones[survivingEra];
    s.herds = [];
    s.packs = [];
    s.faunaIntroduced = {};
    s.faunaSeedAt = s.time;
    if (survivingEra < 2) {
      s.plants.fill(0);
      s.green = 0;
      s.marineFood?.fill(0);
    }
    if (!survivingEra) {
      beginLifeRecovery(s);
      report("Po dlouhém suchu nebo mrazu původní život zanikl.", "warn");
    }
  }

  function founderRoom(s, start, profile, minimum) {
    const center = position(start);
    const seen = new Set([start]);
    const queue = [start];
    for (let cursor = 0; cursor < queue.length && queue.length < minimum; cursor++) {
      for (const neighbors of s.neighbors) {
        const next = neighbors[queue[cursor]];
        if (seen.has(next)) continue;
        seen.add(next);
        const pos = position(next);
        if (Math.abs(dx(center.x, pos.x)) > 2 || Math.abs(center.y - pos.y) > 2
          || !buildable(s, next, profile) || actorTemperature(s, next, profile) < .23
          || actorTemperature(s, next, profile) > .89) continue;
        queue.push(next);
      }
    }
    return queue.length;
  }

  function wildlife(s, report, state, world) {
    let climate;
    const foundingClimate = i => {
      climate ??= state && world?.orbit && typeof Evolution !== "undefined"
        ? settlementClimate(s, s.bioProfile, seasonalTemperatures(s, Evolution.seasonalHeats(state, world))) : () => 0;
      return climate(i);
    };
    diversifyWildlife(s);
    for (const tribe of s.tribes) tribe.profile ??= s.bioProfile ?? "temperate";
    if (!s.tribes.length && s.era >= 4 && s.nativeFoundersVersion >= 2 && !s.towns.length && s.colony<0 && !s.nativeFoundersInitialized && s.time >= (s.nativeFoundersTryAt??0)) {
      s.nativeFoundersTryAt=s.time+10;
      const expanded = s.nativeFoundersVersion >= 3;
      const regions = landRegions(s, s.bioProfile), sites = [];
      for (let i = 0; i < SIZE; i++) {
        if (s.urban[i] || s.damage[i] >= 0.78 || !buildable(s, i, s.bioProfile)
          || actorTemperature(s, i) < .23 || actorTemperature(s, i) > .89) continue;
        const safety = settlementSafety(s, i, s.bioProfile) + foundingClimate(i);
        if (!Number.isFinite(safety)) continue;
        const food = resources(s, i);
        if (food < .08) continue;
        const p = position(i);
        let room = 0;
        if (expanded) room = founderRoom(s, i, s.bioProfile, 10);
        else {
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            if (p.y + dy < 0 || p.y + dy >= H) continue;
            const next = at(p.x + dx, p.y + dy);
            if (regions[next] === regions[i] && buildable(s, next, s.bioProfile)) room++;
          }
        }
        if (room < (expanded ? 6 : 10)) continue;
        sites.push({i, p, region: regions[i], score: food + safety + Math.min(room, 22) * .021
          + Math.min(waterAccess(s, i, s.bioProfile, marineWater(s)), .45) * .45});
      }
      const regionalMinimum = expanded ? new Set(sites.map(site => site.region)).size : 1;
      const desired = Math.min(expanded ? 12 : 6, Math.max(regionalMinimum, Math.ceil(sites.length / (expanded ? 220 : 350))));
      const chosen = [], used = new Set();
      for (let n = 0; n < desired; n++) {
        let best = null, rating = -Infinity;
        for (const site of sites) {
          if (expanded && n < regionalMinimum && used.has(site.region)) continue;
          let gap = 30;
          for (const founder of chosen) if (!expanded || founder.region === site.region) gap = Math.min(gap, distance(founder.p, site.p));
          if (gap < 12) continue;
          const value = site.score + gap * .03 + (used.has(site.region) ? 0 : .9);
          if (value > rating) { best = site; rating = value; }
        }
        if (!best) break;
        chosen.push(best);
        used.add(best.region);
      }
      for(let n=0;n<chosen.length;n++){const {i,p}=chosen[n],realm=NATIVE_REALMS[n];s.tribes.push({...p,home:i,realm,name:expanded ? "Kmen " + (n + 1) : REALMS[realm].name,food:.58,hunter:null,goal:null,huntAt:s.time});}
      if(chosen.length){s.nativeFounderCount=chosen.length;s.nativeFoundersInitialized=true;report('Na planetě vzniká '+chosen.length+' původních kmenů podle dostupného obyvatelného prostoru.','good');}
    }
    if (!s.tribes.length && s.era >= 4 && !(s.nativeFoundersVersion >= 2)) {
      const room = (i, p) => {
        if (!buildable(s, i, s.bioProfile) || actorTemperature(s, i) < 0.23 || actorTemperature(s, i) > 0.89) return -Infinity;
        const safety = settlementSafety(s, i, s.bioProfile) + foundingClimate(i);
        if (!Number.isFinite(safety)) return -Infinity;
        let ground = 0;
        for (let y = -2; y <= 2; y++) {
          if (p.y + y < 0 || p.y + y >= H) continue;
          for (let x = -2; x <= 2; x++) {
            const near = at(p.x + x, p.y + y);
            if (sameGround(s, near, i, s.bioProfile) && buildable(s, near, s.bioProfile)) ground++;
          }
        }
        if (ground < 10) return -Infinity;
        return resources(s, i) + safety + Math.min(ground, 22) * 0.021
          + Math.min(waterAccess(s, i, s.bioProfile, marineWater(s)), 0.45) * 0.45;
      };
      const fertile = findSite(s, null, room);
      const first = fertile >= 0 ? fertile : findSite(s, null, i => resources(s, i) + settlementSafety(s, i, s.bioProfile) + foundingClimate(i));
      if (first >= 0) {
        const origin = position(first);
        const second = findSite(s, null, (i, p) => {
          const gap = distance(origin, p);
          if (gap < 10) return -Infinity;
          return room(i, p) + (sameGround(s, i, first, s.bioProfile) ? 0.27 : 0) - Math.abs(gap - 19) * 0.016;
        });
        for (const [name, i] of [["Kmen Řeky", first], ["Kmen Údolí", second]]) {
          if (i >= 0 && (i !== first || !s.tribes.length)) {
            s.tribes.push({ ...position(i), home: i, name, food: 0.58, hunter: null, goal: null, huntAt: s.time });
          }
        }
      }
    }
    if (s.time >= s.nextChoice && s.herds.length) {
      s.nextChoice = s.time + 1.5;
      choose(s, report);
    }
    for (const herd of s.herds) {
      if (herd.size <= 0.03) continue;
      travel(s, herd, herd.goal, { penguin: 0.27, camel: 0.30, deer: 0.36, tapir: 0.29 }[herd.species] ?? 0.33);
      const i = at(herd.x, herd.y);
      const comfort = animalComfort(s, i, herd), habitat = animalHabitat(s, i, herd);
      const capacity = animalFood(s, i, herd) * habitat;
      herd.migrating = habitat < 0.48;
      herd.size = clamp(herd.size + (capacity - herd.size) * 0.015 - (1 - comfort) * 0.008 - s.fire[i] * 0.038, 0, 1);
      if (FAUNA[herd.species]?.food === "marine") s.marineFood[i] = Math.max(0, s.marineFood[i] - herd.size * 0.002);
      else s.plants[i] = Math.max(0, s.plants[i] - herd.size * (herd.species === "camel" ? 0.0015 : 0.005));
    }
    for (const pack of s.packs) {
      pack.energy ??= 0.7;
      if (pack.energy <= 0.02) continue;
      const here = at(pack.x, pack.y);
      pack.migrating = animalHabitat(s, here, pack) < 0.40;
      if (animalComfort(s, here, pack) < 0.28 || animalHabitat(s, here, pack) < 0.18 || s.fire[here] > 0.08) {
        if (s.time >= (pack.refugeAt ?? 0)) {
          pack.refugeAt = s.time + 1.5;
          pack.refuge = findSite(s, pack, i => animalHabitat(s, i, pack) * 2 + (s.herds.some(h => h.size > 0.1 && distance(position(i), h) < 7) ? 0.4 : 0));
        }
        if (pack.refuge >= 0) travel(s, pack, position(pack.refuge), 0.34);
        pack.energy = Math.max(0, pack.energy - 0.004); continue;
      }
      const prey = nearest(s, pack, s.herds, herd => herd.size > 0.15 && animalHabitat(s, at(herd.x, herd.y), pack) > 0.22);
      if (prey) {
        if (travel(s, pack, prey, { polarBear: 0.24, desertFox: 0.31, wolf: 0.32, panther: 0.34 }[pack.species] ?? 0.27)) { prey.size = Math.max(0, prey.size - 0.014); pack.energy = Math.min(1, pack.energy + 0.012); }
        else pack.energy = Math.max(0, pack.energy - 0.0008);
      } else {
        pack.energy = Math.max(0, pack.energy - 0.003);
        pack.previousX = pack.x;
        pack.previousY = pack.y;
      }
    }
    if (typeof FaunaEvolution !== "undefined") FaunaEvolution.step(s, baseAnimalComfort);
    if (s.time >= (s.wildlifeBirthAt ?? 0) && s.herds.length && s.era >= 3) {
      s.wildlifeBirthAt = s.time + 24;
      const parent = s.herds.find(herd => herd.size > 0.68 && animalHabitat(s, at(herd.x, herd.y), herd) > 0.55 && s.herds.filter(h => h.species === herd.species && h.size > 0.03).length < 8);
      const vacant = s.herds.findIndex(herd => herd.size < 0.03);
      if (parent && (s.herds.length < 28 || vacant >= 0)) {
        const site = findSite(s, parent, (i, p) => animalFood(s, i, parent) + animalHabitat(s, i, parent) - Math.abs(distance(parent, p) - 5) * 0.03);
        if (site >= 0) {
          const child = { ...position(site), species: parent.species, profile: parent.profile, size: 0.35, goal: position(site) };
          if (typeof FaunaEvolution !== "undefined") FaunaEvolution.inherit(parent, child);
          if (vacant >= 0) s.herds[vacant] = child; else s.herds.push(child);
        }
      }
    }
    for (const tribe of s.tribes) {
      if (tribe.goal && travel(s, tribe, tribe.goal, 0.28)) {
        if (s.damage[tribe.home] > 0.68 || floodDepth(s, tribe.home, tribe) > 0.6 || s.lava[tribe.home] >= MOLTEN) tribe.home = at(tribe.x, tribe.y);
        tribe.goal = null;
      }
      const i = at(tribe.x, tribe.y);
      tribe.food = clamp(tribe.food + (resources(s, i) - 0.40) * 0.042 - s.fire[i] * 0.095
        - Math.max(0, floodDepth(s, i, tribe) - 0.35) * 0.06 - chill(s, i) * 0.035, 0, 1);
      if (!tribe.hunter && actorTemperature(s, i, tribe) >= 0.20 && tribe.food < (s.era === 4 ? 0.95 : 0.78) && s.time >= tribe.huntAt) {
        const prey = nearest(s, tribe, s.herds, herd => herd.size >= 0.24 && distance(tribe, herd) < 19);
        if (prey) {
          tribe.hunter = { x: tribe.x, y: tribe.y, profile: tribe.profile ?? s.bioProfile, prey: s.herds.indexOf(prey), returning: false, cargo: 0 };
          tribe.huntAt = s.time + 8;
          report(tribe.name + " vysílá lovce za stádem.");
        }
      }
      const hunter = tribe.hunter;
      if (!hunter) continue;
      if (actorTemperature(s, at(hunter.x, hunter.y), tribe) < 0.16 || actorTemperature(s, i, tribe) < 0.16) hunter.returning = true;
      if (hunter.returning) {
        if (travel(s, hunter, tribe, 0.49)) {
          tribe.food = Math.min(1, tribe.food + hunter.cargo);
          if (typeof Patronage !== "undefined") Patronage.creditHunt(s, tribe.home, hunter.cargo);
          tribe.hunter = null;
        }
      } else {
        const prey = s.herds[hunter.prey];
        if (travel(s, hunter, prey, 0.53)) {
          hunter.cargo = Math.min(prey.size * 0.52, 0.29);
          prey.size -= hunter.cargo;
          hunter.returning = true;
        }
      }
    }
    const relations = new Set();
    for (const [index, a] of s.tribes.entries()) for (const b of s.tribes.slice(index + 1)) {
      if (a.goal || b.goal || distance(a, b) >= 6.2 || !sameGround(s, at(a.x, a.y), at(b.x, b.y), a)) continue;
      const shortage = Math.min(waterAccess(s, at(a.x, a.y), a), waterAccess(s, at(b.x, b.y), b)) < 0.43;
      const relation = shortage ? "Soupeření o vodu" : "Sdílejí vodu";
      relations.add(relation);
      if (shortage) {
        a.food = Math.max(0, a.food - 0.008);
        b.food = Math.max(0, b.food - 0.008);
      } else {
        const shared = (b.food - a.food) * 0.025;
        a.food += shared;
        b.food -= shared;
      }
    }
    const relation = [...relations].sort().join(" · ");
    if (relation && relation !== s.relation) report(relation + ".", relations.has("Soupeření o vodu") ? "warn" : "good");
    s.relation = relation;
  }

  function infrastructureDistance(a, b) {
    return distance(position(a), position(b));
  }

  function infrastructureTown(s, town, civilization = town?.civilization) {
    return Boolean(town && civilization && town.civilization === civilization && !town.abandoned
      && s.damage[town.home] < 0.78 && s.communities?.some(c => c.active && c.people > 0 && c.id === town.communityId));
  }

  function reconcileInfrastructure(s) {
    if (!s.power.grids) return;
    const towns = s.towns.filter(town => infrastructureTown(s, town));
    const nearTown = (owner, i) => towns.find(town => town.civilization === owner && infrastructureDistance(town.home, i) <= 12);
    // A direct landing records a colony core. Only a real robot outpost operates without residents.
    const bases = s.robotBases.filter(base => Number.isInteger(base.tile) && base.tile >= 0 && base.tile < SIZE
      && s.damage[base.tile] < 0.78 && (!base.colonyCore || nearTown(base.civilization, base.tile)));
    if (bases.length !== s.robotBases.length) s.robotBases = bases;
    const nearBase = (owner, i) => bases.some(base => base.civilization === owner
      && infrastructureDistance(base.tile, i) <= 12);
    const supportTown = (owner, i, index) => {
      const town = s.towns[index - 1];
      return infrastructureTown(s, town, owner) ? town : nearTown(owner, i);
    };
    const stationCandidates = s.stations.filter(station => station.tile >= 0 && station.civilization && !station.abandoned);
    const ruins = asset => Boolean(s.ancientRuins?.[asset.tile] && !s.plotTown[asset.tile]);
    const stations = stationCandidates.filter(station => !ruins(station));
    const supported = new Set();
    for (const station of stations) {
      const town = supportTown(station.civilization, station.tile, s.plotTown[station.tile]);
      s.plotTown[station.tile] = town ? s.towns.indexOf(town) + 1 : 0;
      if (town || nearBase(station.civilization, station.tile)) supported.add(station);
    }
    // A working relay can extend existing coverage but cannot keep an isolated chain alive.
    for (const station of supported) {
      if (station.mode === "off" || stationFault(s, station)) continue;
      for (const candidate of stations) {
        if (candidate.civilization === station.civilization && infrastructureDistance(station.tile, candidate.tile) <= 13)
          supported.add(candidate);
      }
    }
    const abandon = asset => {
      asset.abandoned = true;
      asset.civilization = 0;
      s.plotTown[asset.tile] = 0;
    };
    for (const station of stationCandidates) {
      if (supported.has(station)) continue;
      abandon(station);
      Object.assign(station, { mode: "off", pending: false, draw: 0, load: 0, fraction: 0, battery: 0 });
    }
    for (const asset of [...s.power.plants, ...s.mines]) {
      if (!asset.civilization || asset.abandoned) continue;
      const town = ruins(asset) ? null : supportTown(asset.civilization, asset.tile, asset.town);
      if (town) {
        asset.town = s.towns.indexOf(town) + 1;
        s.plotTown[asset.tile] = asset.town;
      } else if (!ruins(asset) && nearBase(asset.civilization, asset.tile) && asset.kind !== "nuclear" && asset.kind) {
        asset.town = s.plotTown[asset.tile] = 0;
        asset.robot = true;
      } else {
        abandon(asset);
        asset.town = 0;
        if ("output" in asset) asset.output = 0;
      }
    }
    const owners = new Set([...towns, ...bases].map(item => item.civilization));
    for (const [id, grid] of Object.entries(s.power.grids)) {
      if (owners.has(Number(id))) continue;
      grid.output = grid.demand = grid.stationDraw = grid.supplyRate = 0;
      if (grid.program) { grid.program.draw = 0; grid.program.online = false; }
    }
  }

  function loseSettlement(s) {
    reconcileInfrastructure(s);
    const baseOwners = new Set(s.robotBases.map(base => base.civilization));
    const automated = new Set([
      ...s.robotBases.filter(base => s.urban[base.tile] >= STATION_TILE).map(base => base.tile),
      ...s.stations.filter(station => !s.plotTown[station.tile] && baseOwners.has(station.civilization)).map(station => station.tile),
      ...s.power.plants.filter(plant => plant.robot && baseOwners.has(plant.civilization)).map(plant => plant.tile)
    ]);
    const abandon = i => {
      if (s.damage[i] < 0.78) s.damageCause[i] = 7;
      s.damage[i] = 1;
      s.damageNotice[i] = 3;
    };
    s.ancientRuins ??= new Uint8Array(SIZE);
    const alreadyAbandoned = new Set([...s.power.plants, ...s.stations, ...s.mines].filter(asset => asset.abandoned).map(asset => asset.tile));
    for (const i of s.plots) if (!automated.has(i) && !alreadyAbandoned.has(i)) {
      abandon(i);
      if (s.urban[i] >= 2) s.ancientRuins[i] = 1;
    }
    for (const plant of s.power.plants) {
      plant.town = 0;
      if (!automated.has(plant.tile)) plant.output = 0;
    }
    for (const mine of s.mines) mine.town = 0;
    for (const station of s.stations) if (station.tile >= 0 && !automated.has(station.tile) && !station.abandoned)
      Object.assign(station, { destroyed: true, mode: "off", draw: 0, load: 0, fraction: 0, battery: 0 });
    s.stations = s.stations.filter(station => station.tile >= 0 || baseOwners.has(station.civilization));
    for (const port of s.ports) { abandon(port.land); port.town = -1; port.open = false; }
    s.monuments = s.monuments.filter(monument => monument.builtAt !== null);
    for (const monument of s.monuments) { abandon(monument.tile); monument.town = 0; }
    for (const id of Object.keys(s.power.grids ?? {})) if (!baseOwners.has(Number(id))) delete s.power.grids[id];
    s.plotTown.fill(0); s.claims.fill(0);
    s.towns = []; s.communities = []; s.tribes = [];
    s.realmCivilizations = {}; s.cultures = {}; s.diplomacy = {};
    s.populationVersion = 0; s.populationTotal = 0;
    s.nativeFoundersVersion = 3; s.nativeFounderCount = 0;
    s.nativeFoundersInitialized = false; s.nativeFoundersTryAt = s.time; s.nativeRestart = true;
    s.evolutionAdvancing = null;
    s.colony = -1; s.colonizedAt = null; s.colonialSeedPending = false;
    s.expeditions = []; s.boats = []; s.seaLinks = []; s.links = [];
    s.airLink = s.battle = s.border = null;
    s.dominant = s.trade = s.shelter = s.townShelter = 0;
    s.relation = s.urbanAlert = "";
    s.buildAt = s.societyAt = s.seaAt = s.time;
    s.research = emptyResearch(); delete s.researchPolicy; delete s.colonialCivilization;
    delete s.recentPopulationLoss;
    const survivingHerds = s.herds.some(herd => herd.size > 0.03);
    const survivingSchools = s.faunaEvolution?.schools.some(group => group.size > 0.03);
    s.era = survivingHerds ? 3 : survivingSchools || s.plants.some(plant => plant > 0.12) ? 2
      : s.microbes?.some(density => density > 0.10) ? 1 : 0;
    s.progress = milestones[s.era];
    s.stress = 0;
    if (s.era === 0) beginLifeRecovery(s);
  }

  function settlementEra(s) {
    const colonyAge = s.colonizedAt === null ? 0 : s.time - s.colonizedAt;
    const imported = s.colony < 0 ? 0 : colonyAge >= 42 || s.legacyClimate >= 0.83 ? 6 : colonyAge >= 14 ? 5 : 4;
    return Math.max(s.era, imported);
  }

  function townEra(s, town) {
    const era = typeof Evolution !== "undefined" ? Evolution.settlementEra(s, town) : Math.max(s.era, town?.importedEra ?? 0);
    if (!town) return era;
    const age = s.time - town.founded;
    if (era >= 6 && age >= 80 && town.count >= 10) return 6;
    if (era >= 5 && age >= 30 && town.count >= 5) return 5;
    return 4;
  }

  function chill(s, i) {
    const shelter = s.colony >= 0 ? 0.56 : 1;
    const temperature = typeof Evolution !== "undefined" ? Evolution.temperature(s, i, s.towns[s.plotTown[i] - 1]) : s.temperature[i];
    return clamp((0.23 - temperature) / 0.31, 0, 1) * shelter;
  }

  function plotActor(s, i) {
    return s.towns[s.plotTown[i] - 1] ?? s.stations.find(station => station.tile === i)
      ?? s.power.plants.find(plant => plant.tile === i) ?? { profile: s.bioProfile };
  }

  const actorTemperature = (s, i, actor = s.bioProfile) => typeof Evolution !== "undefined" ? Evolution.temperature(s, i, actor) : s.temperature[i];
  const landRegions = (s, actor = s.bioProfile) => typeof Evolution !== "undefined" ? Evolution.regions(s, actor) : s.region;
  const sameGround = (s, a, b, actor = a) => { const map = landRegions(s, actor); return Boolean(map[a] && map[a] === map[b]); };
  const floodDepth = (s, i, actor = plotActor(s, i)) => typeof Evolution !== "undefined" ? Evolution.floodDepth(s, i, actor) : s.water[i];

  function buildable(s, i, actor = plotActor(s, i)) {
    if (typeof Evolution !== "undefined") return Evolution.ground(s, i, actor);
    return s.region[i] && !s.ocean[i] && s.water[i] < 0.27 && s.ice[i] < 0.24 && s.fire[i] < 0.09 && s.lava[i] < MOLTEN;
  }

  function chooseErrand(s, home, era, preferred) {
    const origin = position(home);
    const range = era >= 6 ? 12 : era >= 5 ? 8 : 6;
    let best = null, rating = -Infinity;
    for (let y = -range; y <= range; y++) {
      for (let x = -range; x <= range; x++) {
        const gap = Math.hypot(x, y);
        if (gap < 2.5 || gap > range || origin.y + y < 0 || origin.y + y >= H) continue;
        const i = at(origin.x + x, origin.y + y);
        if (!buildable(s, i, home) || (typeof Evolution !== "undefined" ? Evolution.temperature(s, i, home) : s.temperature[i]) < 0.17 || !sameGround(s, i, home, home) || s.damage[i] >= 0.60) continue;
        const shore = s.neighbors.some(list => s.water[list[i]] > 0.32);
        const task = s.urban[i] === 2 ? "field" : shore ? "water" : era >= 5 && s.urban[i] ? "town" : "gather";
        if (task === "gather" && s.plants[i] < 0.18) continue;
        const score = (task === preferred ? 1 : 0) + (task !== "gather" ? 0.55 : 0)
          + hash(i, Math.floor(s.time * 4), s.seed) * 0.8 - gap * 0.055;
        if (score <= rating) continue;
        rating = score;
        best = { tile: i, task };
      }
    }
    return best;
  }

  function dailyLife(s) {
    for (const town of s.towns) {
      const { home } = town;
      if (town.abandoned || !town.count || !buildable(s, home) || s.damage[home] >= 0.78) {
        town.walkers = [];
        continue;
      }
      const era = townEra(s, town);
      town.walkers ??= [];
      const count = era >= 6 ? Math.min(8, 2 + Math.floor(town.count / 45)) : era >= 5 && town.count >= 12 ? 2 : 1;
      const center = position(home);
      while (town.walkers.length < count) {
        town.walkers.push({ ...center, leaveAt: s.time + 0.75 + town.walkers.length * 2.5 });
      }
      for (const [slot, walker] of town.walkers.entries()) {
        walker.profile = town.profile;
        if (!walker.errand) {
          if (s.time < walker.leaveAt || (typeof Evolution !== "undefined" ? Evolution.temperature(s, home, town) : s.temperature[home]) < 0.21) continue;
          walker.errand = chooseErrand(s, home, era, ["water", "field", "town"][slot]);
          walker.departed = s.time;
          walker.returning = false;
          walker.collected = false;
          walker.leaveAt = s.time + 3;
          if (!walker.errand) continue;
        }
        const cold = (typeof Evolution !== "undefined" ? Evolution.temperature(s, home, town) : s.temperature[home]) < 0.21 || (typeof Evolution !== "undefined" ? Evolution.temperature(s, at(walker.x, walker.y), town) : s.temperature[at(walker.x, walker.y)]) < 0.16
          || (typeof Evolution !== "undefined" ? Evolution.temperature(s, walker.errand.tile, town) : s.temperature[walker.errand.tile]) < 0.16;
        if (cold || !buildable(s, walker.errand.tile, town) || s.time > walker.departed + 20) walker.returning = true;
        const target = walker.returning ? center : position(walker.errand.tile);
        const arrived = travel(s, walker, target, 0.26 + slot * 0.025, true);
        if (walker.returning && (arrived || s.time > walker.departed + 36)) {
          Object.assign(walker, center, { errand: null, leaveAt: s.time + 2.5 + hash(home, Math.floor(s.time), slot) * 4,
            destination: -1, route: [] });
        } else if (arrived) {
          walker.returning = true;
          walker.collected = true;
        }
      }
    }
  }

  function addTown(s, home, realm, weight = 1) {
    if (home < 0 || contaminated(s, home)) return null;
    const existing = s.towns.find(town => town.home === home);
    if (existing) {
      if (existing.abandoned) Object.assign(existing, { realm, abandoned: false, cold: 0 });
      return existing;
    }
    if (s.towns.length >= MAX_TOWNS) return null;
    const town = { home, realm, profile: s.bioProfile ?? "temperate", weight, count: 0, founded: s.time, nextJourney: s.time + 12, cold: 0, factory: -1 };
    s.towns.push(town);
    return town;
  }

  function expandTowns(s, population, restoring = false) {
    const era = settlementEra(s);
    addTown(s, s.colony, 3);
    s.tribes.forEach((tribe, index) => {
      if (s.towns.some(town => town.home === tribe.home && activeTown(town))
        || Number.isFinite(settlementSafety(s, tribe.home, tribe))) addTown(s, tribe.home, tribe.realm ?? index + 1);
    });
    const active = s.towns.filter(t => !t.abandoned && t.cold < 0.55 && buildable(s, t.home));
    const weight = active.reduce((sum, t) => sum + t.weight, 0);

    for (const town of active) {
      const { home } = town;
      const community = s.communities?.find(c=>c.id===town.communityId);
      const residents = Math.max(0,community?.people ?? (s.populationVersion ? 0 : population*town.weight/Math.max(.001,weight)));
      const scale = Math.sqrt(residents/1000);
      const quota = era>=6 ? Math.min(640,Math.max(8,Math.round(8+scale*14))) : era>=5 ? Math.min(240,Math.max(5,Math.round(5+scale*8))) : Math.min(28,Math.max(3,Math.round(2+scale*3)));
      if (town.count >= quota) continue;
      const range = Math.ceil(Math.sqrt(quota / Math.PI) * 1.45) + 2;
      const cx = home % W, cy = Math.floor(home / W), candidates = [];
      for (let y = Math.max(0, cy - range); y <= Math.min(H - 1, cy + range); y++) {
        for (let x = cx - range; x <= cx + range; x++) {
          const i = tile(x, y), dx = x - cx, dy = y - cy;
          if (s.urban[i] || s.noBuild[i] || contaminated(s, i) || worksiteReserved(s, i) || !buildable(s, i, town) || !sameGround(s, i, home, town) || typeof Evolution !== "undefined" && Evolution.comfort(s,i,town)<.22 || s.monuments.some(m => m.tile === i)) continue;
          const claim = s.towns[s.claims[i] - 1];
          if (claim && claim.realm !== town.realm) continue;
          const rank = Math.hypot(dx, dy) + hash(i, home, s.seed) * 0.55 + Math.max(0, s.height[i] - 0.60) * 5;
          candidates.push({ i, dx, dy, rank });
        }
      }
      candidates.sort((a, b) => a.rank - b.rank);
      const stage = townEra(s, town), id = s.towns.indexOf(town) + 1;
      const batch = restoring ? quota : town.count < 3 ? 3 : era >= 6 ? 6 : era >= 5 ? 3 : 1;
      for (const { i, dx, dy } of candidates.slice(0, Math.min(batch, quota - town.count))) {
        s.urban[i] = i === home ? 4 : stage >= 5 && (dx % 4 === 0 || dy % 4 === 0) ? 1
          : town.count > quota * 0.63 && s.height[i] < 0.59 ? 2 : 3;
        s.plotTown[i] = id;
        s.plots.push(i);
        town.count++;
      }
    }
  }

  function marineWater(s) {
    const cached = marineWaters.get(s);
    if (cached) return cached;
    const marine = new Uint8Array(SIZE), visited = new Uint8Array(SIZE), queue = new Uint16Array(SIZE);
    for (let i = 0; i < SIZE; i++) {
      if (!s.ocean[i] || visited[i]) continue;
      visited[i] = 1;
      queue[0] = i;
      let end = 1;
      for (let head = 0; head < end; head++) for (const neighbors of s.neighbors) {
        const next = neighbors[queue[head]];
        if (!s.ocean[next] || visited[next]) continue;
        visited[next] = 1;
        queue[end++] = next;
      }
      // The surface has no salinity layer. Large connected basins are treated as seas for settlement scoring.
      if (end >= 80) for (let j = 0; j < end; j++) marine[queue[j]] = 1;
    }
    marineWaters.set(s, marine);
    return marine;
  }

  function settlementSafety(s, i, actor) {
    if (contaminated(s, i)) return -Infinity;
    const cold = typeof Evolution !== "undefined" && Evolution.actorProfile(s, actor) === "cold";
    // Cold-adapted settlers can use stable sea ice but favor solid land for new centers.
    const landPreference = cold && !s.ocean[i] ? 1.5 : 0;
    if (cold && Evolution.stableIce(s, i)) return 0.16 + landPreference;
    const height = s.height[i];
    let waterLevel = height - 0.018;
    for (const neighbors of s.neighbors) {
      const nearby = neighbors[i];
      if (nearby === i || s.water[nearby] < 0.18) continue;
      waterLevel = Math.max(waterLevel, s.height[nearby] + (s.water[nearby] + s.ice[nearby]) * DEPTH_UNIT);
    }
    const margin = height - waterLevel;
    if (margin <= -0.27 * DEPTH_UNIT) return -Infinity;
    return clamp(margin / 0.018, -1, 1) * 0.22 + landPreference;
  }

  function waterAccess(s, i, actor = plotActor(s, i), marine = null) {
    const cold = typeof Evolution !== "undefined" ? Evolution.actorProfile(s, actor) === "cold" : s.bioProfile === "cold";
    const fresh = tile => marine?.[tile] ? Math.min(0.12, s.water[tile]) : s.water[tile];
    let access = Math.max(s.soil[i], fresh(i), cold ? s.ice[i] * 0.6 : 0);
    for (const list of s.neighbors) {
      const j = list[i];
      access = Math.max(access, s.soil[j] * 0.9, fresh(j) * 0.65, cold ? s.ice[j] * 0.5 : 0);
      for (const other of s.neighbors) {
        const k = other[j];
        access = Math.max(access, s.soil[k] * 0.68, fresh(k) * 0.44);
      }
    }
    return access;
  }

  function activeTown(town) {
    return Boolean(town && town.count > 0 && !town.abandoned);
  }

  function realmName(s, realm) {
    return s.towns.find(town => town.realm === realm && activeTown(town))?.civilizationName
      ?? (s.nativeFoundersVersion >= 3 ? s.tribes.find(tribe => tribe.realm === realm)?.name : null)
      ?? REALMS[realm].name;
  }

  function refreshClaims(s, report) {
    s.claims.fill(0);
    const influence = Array(REALMS.length).fill(0);
    for (const [index, town] of s.towns.entries()) {
      if (!activeTown(town)) continue;
      const home = position(town.home), radius = Math.min(12, 5 + Math.floor(Math.sqrt(town.count)));
      const map = landRegions(s, town), region = map[town.home];
      influence[town.realm] += 4 + town.count + (workingFactory(s, town) ? 6 : 0);
      for (let y = -radius; y <= radius; y++) {
        if (home.y + y < 0 || home.y + y >= H) continue;
        for (let x = -radius; x <= radius; x++) {
          const gap = Math.hypot(x, y);
          if (gap > radius) continue;
          const i = at(home.x + x, home.y + y);
          if (!region || map[i] !== region || !buildable(s, i, town)) continue;
          const old = s.towns[s.claims[i] - 1];
          if (!old || gap < distance(position(i), position(old.home))) s.claims[i] = index + 1;
        }
      }
    }
    for (const i of s.plots) {
      const id = s.plotTown[i], town = s.towns[id - 1];
      if (town && activeTown(town) && buildable(s, i, town)) s.claims[i] = id;
    }
    const total = influence.reduce((sum, n) => sum + n, 0);
    const strongest = influence.indexOf(Math.max(...influence));
    const leader = s.towns.filter(activeTown).length >= 2 && influence[strongest] >= total * 0.62 ? strongest : 0;
    if (leader && leader !== s.dominant) report(realmName(s, leader) + " získává převahu na planetě.", "good");
    s.dominant = leader;
  }

  function settlementClimate(s, actor, samples) {
    const profile = Evolution.actorProfile(s, actor);
    return i => {
      if (profile === "cold" && s.ocean[i] && s.height[i] < 0.45 && samples[0][i] > FREEZE_AT) return -Infinity;
      let worst = 1;
      for (const phase of samples) worst = Math.min(worst, Evolution.comfort(s, i, profile, phase[i]));
      return 0.8 * worst;
    };
  }

  function settlementClimateBonus(s, town, forecast) {
    const samples = forecast();
    if (!samples) return () => 0;
    const profile = Evolution.actorProfile(s, town);
    const target = Evolution.climateTarget(profile);
    const average = i => (samples[0][i] + samples[1][i] + samples[2][i]) / 3;
    if (profile === "temperate" && ![-1, 0, 1].includes(town.settlementPreference)) {
      const origin = average(town.home) - target;
      town.settlementPreference = Math.abs(origin) < 0.08 ? 0 : Math.sign(origin);
    }
    const direction = profile === "cold" ? -1 : profile === "warm" ? 1 : town.settlementPreference;
    const resilience = settlementClimate(s, profile, samples);
    return i => {
      const rating = resilience(i);
      if (!direction || rating < 0.32) return rating;
      // A small bonus for otherwise comparable sites. All existing checks still run first.
      return rating + 0.035 * clamp(0.5 + direction * (average(i) - target) / 0.35, 0, 1);
    };
  }

  function chooseSettlement(s, town, fleeing, forecast) {
    const climateBonus = settlementClimateBonus(s, town, forecast);
    const samples = fleeing && typeof Evolution !== "undefined" && !Evolution.centerHazard(s, town) ? forecast() : null;
    const resilience = samples ? settlementClimate(s, town, samples) : null;
    const originResilience = resilience?.(town.home);
    const origin = position(town.home), centers = s.towns.filter(activeTown).map(t => position(t.home));
    const map = landRegions(s, town), marine = marineWater(s);
    const regions = map[town.home] ? [map[town.home]] : s.neighbors.map(list => map[list[town.home]]).filter(Boolean);
    let best = -1, rating = -Infinity;
    for (let i = 0; i < SIZE; i++) {
      const temperature = typeof Evolution !== "undefined" ? Evolution.temperature(s, i, town) : s.temperature[i];
      if (!regions.includes(map[i]) || s.urban[i] || contaminated(s, i) || s.noBuild[i] || !buildable(s, i, town) || temperature < 0.24
        || temperature > 0.81 || s.height[i] > 0.68 || s.monuments.some(m => m.tile === i)) continue;
      const p = position(i), gap = distance(origin, p);
      if (gap < (fleeing ? 5 : 12) || gap > (fleeing ? 28 : 34) || centers.some(c => distance(c, p) < 7.5)
        || s.expeditions.some(trip => distance(position(trip.site), p) < 7.5)) continue;
      const claim = s.towns[s.claims[i] - 1];
      if (claim && (claim.civilization && town.civilization ? claim.civilization !== town.civilization : claim.realm !== town.realm)) continue;
      const safety = settlementSafety(s, i, town);
      if (!Number.isFinite(safety) || resilience && resilience(i) <= originResilience + 0.055) continue;
      const water = waterAccess(s, i, town, marine);
      if (water < 0.11 && s.plants[i] < 0.20) continue;
      const range = fleeing ? gap * 0.035 : Math.abs(gap - 23) * 0.019;
      const ownRefuge = fleeing && claim && (claim.civilization && town.civilization ? claim.civilization === town.civilization : claim.realm === town.realm);
      const score = (ownRefuge ? 4 : 0) + safety + Math.min(0.56, water) * 1.4 + resources(s, i, town) * 0.9 - range + hash(i, town.home, s.seed) * 0.16 + climateBonus(i);
      if (score <= rating) continue;
      if (fleeing && !path(s, town.home, i, true, town).length) continue;
      rating = score;
      best = i;
    }
    return best;
  }

  function settlementLimit(population,s) {
    const founders=s?.nativeFoundersVersion >= 2?Math.max(2,s.nativeFounderCount??s.tribes.length):2;
    return Math.min(MAX_TOWNS, founders + 2 * Math.floor(Math.log2(1 + population / 17000)));
  }

  function settlersOnWay(s) {
    return s.expeditions.filter(trip => !trip.aid).length + s.boats.filter(boat => boat.kind === "settle").length;
  }

  function refugeHazard(s, town) {
    if (typeof Evolution === "undefined") return "";
    const hazard = Evolution.centerHazard(s, town);
    if (hazard) return hazard;
    const temperature = Evolution.temperature(s, town.home, town);
    return temperature > 0.91 ? "Přehřáté centrum osady"
      : town.cold > 0.35 && (town.housingCondition ?? 1) < 0.75 ? "Mráz oslabuje ochranu obydlí" : "";
  }

  function needsFood(c) {
    return c?.active && c.food < c.consumption * 14 && c.harvest < c.consumption;
  }

  function friendlySettlements(s, a, b) {
    return a.civilization === b.civilization
      || (s.diplomacy?.[[a.realm, b.realm].sort((x, y) => x - y).join(":")] ?? 0) >= 35;
  }

  function canHost(s, source, host) {
    return host?.active && host.people > 0 && host.harvest > host.consumption
      && host.food > host.consumption * 30 && friendlySettlements(s, source, host)
      && !s.battle?.sides.some(side => side === source.town + 1 || side === host.town + 1)
      && !refugeHazard(s, s.towns[host.town]);
  }

  function sendFoodAppeal(s, report) {
    const residents = (s.communities ?? []).filter(c => c.active);
    for (const source of residents) {
      const town = s.towns[source.town];
      if (s.time - town.aidDeliveredAt > 120) delete town.aidDeliveredAt;
      if (!needsFood(source)) { delete town.foodNeedSince; continue; }
      town.foodNeedSince ??= s.time;
      if (s.time - town.foodNeedSince < 12 || s.time < (town.nextAidAt ?? 0)
        || s.expeditions.some(trip => trip.realm === town.realm)) continue;
      const origin = position(town.home);
      const hosts = residents.filter(host => host !== source && canHost(s, source, host))
        .map(host => ({ host, gap: distance(origin, position(host.home)) }))
        .filter(item => item.gap <= 18).sort((a, b) => a.gap - b.gap);
      const resettle = town.aidDeliveredAt !== undefined && s.time - town.aidDeliveredAt >= 12;
      const match = hosts.find(({ host }) => (!resettle || host.profile === source.profile)
        && path(s, source.home, host.home, true, source).length);
      town.nextAidAt = s.time + 26;
      if (!match) continue;
      s.expeditions.push({ ...origin, from: source.town + 1, site: match.host.home, realm: source.realm,
        profile: source.profile, civilization: source.civilization, hostId: match.host.id, began: s.time, aid: resettle ? "resettle" : "request" });
      report(settlementLabel(town) + (resettle ? " hledá zázemí u spřátelené osady." : " posílá sousedům žádost o jídlo."));
      return;
    }
  }

  function sendExpedition(s, population, report, forecast) {
    const active = s.towns.filter(activeTown);
    const holdings = Array(REALMS.length).fill(0);
    for (const town of active) holdings[town.realm]++;
    const limit = settlementLimit(population,s);
    if (s.expeditions.length >= 2) return;
    for (const town of active) {
      if (refugeHazard(s, town)) town.hazardSince ??= s.time;
      else delete town.hazardSince;
    }
    const needsRefuge = town => s.time - (town.hazardSince ?? s.time) >= (typeof Evolution !== "undefined" && Evolution.centerHazard(s, town) ? 5 : 12);
    const candidates = active.filter(t => (needsRefuge(t) ? s.time >= (t.nextRefugeAt ?? 0) : t.count >= 3 && s.time >= t.nextJourney)
      && !s.expeditions.some(trip => trip.realm === t.realm))
      .sort((a, b) => Number(needsRefuge(b)) - Number(needsRefuge(a)) || Number(s.lava[b.home] >= MOLTEN) - Number(s.lava[a.home] >= MOLTEN)
        || b.cold - a.cold || holdings[a.realm] - holdings[b.realm] || a.nextJourney - b.nextJourney);
    for (const town of candidates) {
      const volcanic = s.lava[town.home] >= MOLTEN;
      const refuge = needsRefuge(town) ? refugeHazard(s, town) : "";
      const fleeing = Boolean(refuge) || volcanic || town.cold > 0.56;
      if (s.towns.length >= MAX_TOWNS) break;
      if (!fleeing && (active.length + settlersOnWay(s) >= limit || town.cold > 0.28 || !buildable(s, town.home))) continue;
      const site = chooseSettlement(s, town, fleeing, forecast);
      if (refuge) town.nextRefugeAt = s.time + (site < 0 ? 8 : 26);
      else town.nextJourney = s.time + (site < 0 ? 8 : 26);
      if (site < 0) continue;
      s.expeditions.push({ ...position(town.home), from: s.towns.indexOf(town) + 1, site, realm: town.realm, profile: town.profile, fleeing, volcanic, refuge, began: s.time,
        civilization: s.communities?.find(c => c.id === town.communityId)?.civilization ?? null, people: Math.max(12, Math.min(200, Math.floor(population * 0.012))) });
      report((town.civilizationName ?? realmName(s, town.realm)) + (refuge ? " hledá útočiště. " + refuge + "." : volcanic ? " hledá útočiště před lávou."
        : fleeing ? " hledá místo s vhodnějším podnebím." : " vysílá osadníky do krajiny."));
      return;
    }
    sendFoodAppeal(s, report);
  }

  function settleResidents(s, town, origin, people, all = false) {
    town.residentOrigin = { id: origin?.communityId, people, all };
    // Make the landing a real settlement before the next population sync. In
    // particular, refugees must arrive before their old centre is abandoned.
    if (!s.urban[town.home]) reservePlot(s, town.home, s.towns.indexOf(town) + 1, 4);
    town.count = Math.max(1, town.count);
  }
  function moveExpeditions(s, report) {
    s.expeditions = s.expeditions.filter(trip => {
      const origin = s.towns[trip.from - 1];
      if (trip.aid) return moveFoodAppeal(s, trip, origin, report);
      trip.profile ??= origin?.profile;
      if (trip.refuge && (!origin || !activeTown(origin) || !refugeHazard(s, origin))) return false;
      if (!origin || s.time - trip.began > 76 || !buildable(s, trip.site, origin) || (typeof Evolution !== "undefined" ? Evolution.temperature(s, trip.site, origin) : s.temperature[trip.site]) < 0.19) return false;
      if (!travel(s, trip, position(trip.site), 0.36, true)) return true;
      if (!Number.isFinite(settlementSafety(s, trip.site, origin))
        || s.towns.some(t => t.home === trip.site && activeTown(t))) return false;
      const town = addTown(s, trip.site, trip.realm, trip.fleeing ? origin.weight : 0.60);
      if (!town) return false;
      town.settlementPreference = origin.settlementPreference;
      if (trip.civilization) { town.civilization = trip.civilization; town.profile = origin.profile; town.importedEra = origin.importedEra; }
      const danger = trip.refuge ? Boolean(refugeHazard(s, origin)) : trip.volcanic ? s.lava[origin.home] >= MOLTEN || s.damage[origin.home] > 0.62 : origin.cold > 0.36;
      settleResidents(s, town, origin, trip.people, trip.fleeing && origin.realm === trip.realm && danger);
      s.buildAt = s.societyAt = s.time;
      if (trip.fleeing && origin.realm === trip.realm && danger) {
        origin.abandoned = true;
        origin.walkers = [];
        for (const i of s.plots) if (s.plotTown[i] === trip.from && s.urban[i] < 5) {
          s.damage[i] = Math.max(0.82, s.damage[i]); s.damageCause[i] = 7;
        }
        for (const tribe of s.tribes) {
          if (tribe.home !== origin.home) continue;
          tribe.home = trip.site;
          tribe.goal = position(trip.site);
        }
        if (s.colony === origin.home) s.colony = trip.site;
      }
      report((town.civilizationName ?? origin.civilizationName ?? realmName(s, trip.realm)) + " zakládá osadu " + (town.name ?? s.towns.indexOf(town)+1) + (trip.fleeing ? " jako útočiště. Přesun obyvatel je zaznamenán v kronice." : ". Osadníci přicházejí z osady " + (s.towns.indexOf(origin)+1) + "."), "good");
      return false;
    });
  }

  function moveFoodAppeal(s, trip, origin, report) {
    const source = s.communities?.find(c => c.id === origin?.communityId);
    if (!source?.active || source.civilization !== trip.civilization || s.time - trip.began > 76) return false;
    if (trip.aid === "return") {
      if (!travel(s, trip, position(source.home), 0.36, true)) return true;
      const received = Math.min(trip.cargo, Math.max(0, Patronage.capacity(source) - source.food));
      source.food += received;
      if (received > 0) {
        origin.aidDeliveredAt = s.time;
        report(settlementLabel(origin) + " dostala od sousedů " + Math.floor(received) + " jídla.", "good");
      }
      return false;
    }
    const host = s.communities.find(c => c.id === trip.hostId);
    if (!needsFood(source) || !canHost(s, source, host)) return false;
    if (!travel(s, trip, position(host.home), 0.36, true)) return true;
    if (trip.aid === "resettle") {
      if (host.profile !== source.profile) return false;
      const share = Math.min(0.1, (host.harvest - host.consumption) / Math.max(0.01, host.consumption));
      const people = Math.floor(Math.min(source.people * 0.10, host.people * share));
      if (people > 0) {
        source.people -= people;
        host.people += people;
        report("Přesun obyvatel · " + people + " lidí z " + settlementLabel(origin) + " přijala " + settlementLabel(s.towns[host.town]) + ".", "good");
      }
      return false;
    }
    trip.cargo = Math.min(Math.max(0, host.food - host.consumption * 30), source.consumption * 18);
    host.food -= trip.cargo;
    trip.aid = "return";
    trip.site = source.home;
    trip.began = s.time;
    return trip.cargo > 0;
  }

  function seaOpen(s, i) {
    return i >= 0 && i < SIZE && s.water[i] >= 0.50 && s.ice[i] < 0.18 && s.lava[i] < MOLTEN;
  }

  function coastalPort(s, townIndex, allowDryFallback = false, preferred = null) {
    const town = s.towns[townIndex];
    const old = s.ports.find(port => port.town === townIndex);
    if (!old && s.time < (town?.harborRebuildAt ?? 0)) return null;
    if (!activeTown(town) || town.count < 3 || s.time - town.founded < 12) return old ? { ...old, open: false } : null;
    if (!townConnected(s, town)) return old ? { ...old, open: false } : null;
    const open = port => buildable(s, port.land, town) && s.damage[port.land] < 0.62 && seaOpen(s, port.water);
    if (preferred && open(preferred) && (preferred.land === town.home || path(s, town.home, preferred.land, true, town).length)) return preferred;
    if (old) {
      const operational = open(old);
      // A directed expedition can use nearby shore when the old harbor has dried out.
      if (operational || !allowDryFallback || s.water[old.water] >= 0.50) return { ...old, open: operational };
    }
    const start = town.home, seen = new Uint8Array(SIZE);
    s.queue[0] = start; seen[start] = 1;
    let end = 1, best = null, rating = Infinity;
    for (let j = 0; j < end; j++) {
      const land = s.queue[j], gap = distance(position(start), position(land));
      for (const list of s.neighbors) {
        const next = list[land];
        if (seaOpen(s, next) && !s.noBuild[land] && s.urban[land] < 5 && s.damage[land] < (allowDryFallback ? 0.62 : 0.78)
          && !s.ports.some(port => port.land === land && port.town === -1) && !s.monuments.some(m => m.tile === land)) {
          const score = gap + Math.max(0, s.height[land] - 0.54) * 7 - Math.min(s.water[next], 2) * 0.12;
          if (score < rating) { rating = score; best = { town: townIndex, land, water: next, open: true }; }
        }
        if (seen[next] || gap > 7 || !buildable(s, next, town)) continue;
        seen[next] = 1;
        s.queue[end++] = next;
      }
    }
    return best;
  }

  function seaPath(s, start, goal, limit = 140) {
    if (!seaOpen(s, start) || !seaOpen(s, goal)) return null;
    const { queue, previous } = s;
    previous.fill(-1); previous[start] = start; queue[0] = start;
    let end = 1;
    for (let j = 0; j < end && previous[goal] < 0; j++) {
      const i = queue[j];
      for (const list of s.neighbors) {
        const next = list[i];
        if (previous[next] >= 0 || !seaOpen(s, next)) continue;
        previous[next] = i; queue[end++] = next;
      }
    }
    if (previous[goal] < 0) return null;
    const route = [];
    for (let i = goal; i !== start; i = previous[i]) route.push(i);
    route.push(start);
    return route.length <= limit ? route.reverse() : null;
  }

  function landingScore(s, site, source) {
    if (contaminated(s, site) || !buildable(s, site, source) || s.urban[site] || actorTemperature(s, site, source) < 0.23 || actorTemperature(s, site, source) > 0.82
      || s.height[site] > 0.68 || s.monuments.some(m => m.tile === site)) return -Infinity;
    const safety = settlementSafety(s, site, source);
    if (!Number.isFinite(safety)) return -Infinity;
    const p = position(site), gap = distance(position(source.home), p);
    if (gap < 10 || s.towns.some(t => activeTown(t) && distance(position(t.home), p) < 8)
      || s.expeditions.some(trip => distance(position(trip.site), p) < 8)
      || s.boats.some(boat => boat.kind === "settle" && distance(position(boat.site), p) < 8)) return -Infinity;
    const owner = s.towns[s.claims[site] - 1];
    if (owner && owner.realm !== source.realm) return -Infinity;
    let room = 0;
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
      if (p.y + y < 0 || p.y + y >= H) continue;
      const i = at(p.x + x, p.y + y);
      if (buildable(s, i, source) && sameGround(s, i, site, source)) room++;
    }
    if (room < 10) return -Infinity;
    const freshCoast = !s.towns.some(t => activeTown(t) && sameGround(s, t.home, site, source));
    return (freshCoast ? 1.2 : 0) + safety + Math.min(0.6, waterAccess(s, site, source, marineWater(s))) + resources(s, site, source) * 0.65
      + room * 0.018 - gap * 0.008 + hash(site, source.home, s.seed) * 0.12;
  }

  function findLanding(s, port, range, forecast) {
    const start = port.water, source = s.towns[port.town], { queue, previous } = s;
    const climateBonus = settlementClimateBonus(s, source, forecast);
    const depth = new Uint16Array(SIZE), tested = new Uint8Array(SIZE);
    previous.fill(-1); previous[start] = start; queue[0] = start;
    let end = 1, best = null, rating = -Infinity;
    for (let j = 0; j < end; j++) {
      const i = queue[j];
      for (const list of s.neighbors) {
        const next = list[i];
        if (buildable(s, next, source) && !tested[next]) {
          tested[next] = 1;
          const base = landingScore(s, next, source) - depth[i] * 0.006;
          const score = Number.isFinite(base) ? base + climateBonus(next) : base;
          if (score > rating) { rating = score; best = { site: next, goal: i }; }
        }
        if (depth[i] >= range || previous[next] >= 0 || !seaOpen(s, next)) continue;
        previous[next] = i; depth[next] = depth[i] + 1; queue[end++] = next;
      }
    }
    if (!best) return null;
    const route = [];
    for (let i = best.goal; i !== start; i = previous[i]) route.push(i);
    route.push(start);
    return { site: best.site, route: route.reverse() };
  }

  function sail(s, from, to, route, site = -1, landing = null) {
    const town = s.towns[from];
    const boat = { id: s.nextSeaId++, kind: landing ? "landing" : site >= 0 ? "settle" : "ferry", from, to, site,
      realm: town.realm, era: townEra(s, town), goal: route.at(-1), route: route.slice(1).reverse(),
      civilization: s.communities?.find(c => c.id === town.communityId)?.civilization ?? null, people: Math.max(12, Math.min(200, town.count * 6)),
      ...position(route[0]), heading: 0, stuck: 0, retryAt: 0, began: s.time, blocked: false, ...landing };
    boat.previousX = boat.x; boat.previousY = boat.y;
    s.boats.push(boat);
  }

  function hostileCoast(s, from, to) {
    return activeTown(from) && activeTown(to) && from.civilization > 0 && to.civilization > 0
      && from.civilization !== to.civilization
      && (s.diplomacy?.[[from.realm, to.realm].sort((a, b) => a - b).join(":")] ?? 0) < 0;
  }

  function landingAccess(s, port, source, target) {
    return port?.open && buildable(s, port.land, source)
      && (port.land === target.home || path(s, port.land, target.home, true, source).length > 0);
  }

  function deployLanding(s, from, to, route, crew, report, directed = false) {
    const source = s.towns[from.town], target = s.towns[to.town];
    const guards = Math.min(4, crew.guards - 1);
    crew.guards -= guards;
    source.guardCount = crew.guards;
    source.nextLanding = s.time + 90;
    sail(s, from.town, to.town, route, -1, { guards, targetCivilization: target.civilization, people: 0,
      color: source.civilizationColor, ...(directed ? { launchPort: from, landingPort: to } : {}) });
    s.navalRecruit = -1;
    report("Námořní výsadek · " + settlementLabel(source) + " → " + settlementLabel(target) + " · Vyplouvá " + guards + " jednotek.", "warn");
  }

  function armyReadiness(s, crew, opponent) {
    const source = s.towns[crew.town], target = s.towns[opponent.town];
    if (!activeTown(source) || !activeTown(target)) return "Jedna z osad už není obydlená.";
    if (s.battle || s.boats.some(boat => boat.kind === "landing")) return "Nejprve musí skončit současné boje nebo výsadek.";
    if (s.time < s.battleAt) return "Pauza po návratu z výpravy · zbývá " + Math.ceil(s.battleAt - s.time) + " s při 1×.";
    if (crew.guards < 4) return "Jednotky připravené k výpravě: " + crew.guards + " ze 4. Použij Výcvik jednotek.";
    const food = Math.max(12, (crew.consumption ?? 0) * 12);
    if (crew.food < food) return "Jídlo pro výpravu: " + Math.floor(crew.food) + " z " + Math.ceil(food) + " J. Použij Obživu.";
    if (!buildable(s, source.home, source) || !buildable(s, target.home, target)) return "Podmínky u jedné z osad nedovolují výpravu.";
    return "";
  }

  function directArmy(s, crew, opponent, report) {
    const issue = armyReadiness(s, crew, opponent);
    if (issue) return issue;
    const source = s.towns[crew.town], target = s.towns[opponent.town];
    const reach = Math.ceil(11 + Math.min(7, Math.sqrt(source.count)) + Math.min(7, Math.sqrt(target.count)));
    const withinReach = distance(position(source.home), position(target.home)) <= reach;
    if (withinReach && path(s, source.home, target.home, true, source).length) {
      startBattle(s, crew.town + 1, opponent.town + 1, report, null, -1, true);
      s.border = null;
      return "";
    }
    const landIssue = withinReach ? "Do cíle nevede bezpečná pěší cesta."
      : "Cíl je mimo dosah pozemní výpravy (" + reach + " polí).";
    const from = coastalPort(s, crew.town, true), to = coastalPort(s, opponent.town, true);
    if (!from?.open) return landIssue + " Výchozí osada nemá otevřený přístav ani dostupné místo k vyplutí.";
    if (!to?.open) return landIssue + " Cílová osada nemá otevřený přístav ani dostupné místo k vylodění.";
    if (!landingAccess(s, to, source, target)) return landIssue + " M místa vylodění nevede bezpečná cesta do cílové osady.";
    const limit = townEra(s, source) >= 5 ? 90 : 40;
    const route = seaPath(s, from.water, to.water, limit);
    if (!route)
      return landIssue + " Splavná cesta je přerušená nebo přesahuje dosah lodi.";
    if (s.time < (source.nextLanding ?? 0)) return "Přístav se připravuje na další výsadek.";
    deployLanding(s, from, to, route, crew, report, true);
    return "";
  }

  function launchLanding(s, ports, report) {
    s.navalRecruit = -1;
    if (s.battle || s.time < s.battleAt || s.boats.some(boat => boat.kind === "landing")) return;
    for (const from of ports) {
      const source = s.towns[from.town], crew = s.communities?.find(c => c.active && c.id === source.communityId);
      if (!crew || crew.nature === "broker" || crew.food < Math.max(12, (crew.consumption ?? 0) * 12)
        || s.time < (source.nextLanding ?? 0)) continue;
      const limit = townEra(s, source) >= 5 ? 90 : 40, origin = position(from.water);
      const targets = ports.map(port => ({ port, gap: distance(origin, position(port.water)) }))
        .filter(({ port, gap }) => gap < limit && hostileCoast(s, source, s.towns[port.town])
          && !sameGround(s, source.home, s.towns[port.town].home, source))
        .sort((a, b) => a.gap - b.gap);
      for (const { port: to } of targets) {
        const target = s.towns[to.town];
        const route = seaPath(s, from.water, to.water, limit);
        if (!route || !landingAccess(s, to, source, target)) continue;
        if (crew.guards < 4) {
          if (s.navalRecruit < 0) s.navalRecruit = from.town;
          break;
        }
        deployLanding(s, from, to, route, crew, report);
        return;
      }
    }
  }

  function settlementLabel(town) {
    return (town.civilizationName ?? REALMS[town.realm].name) + " · " + (town.settlementName ?? "pobřežní osada");
  }

  function refreshMaritime(s, population, report, forecast) {
    if (settlementEra(s) < 4 || s.time < s.seaAt) return;
    s.seaAt = s.time + 3;
    s.ports = [...s.ports.filter(port => port.town === -1), ...s.towns.map((town, i) => coastalPort(s, i)).filter(Boolean)];
    const portAt = index => s.ports.find(port => port.town === index && port.open);
    s.seaLinks = s.seaLinks.filter(link => activeTown(s.towns[link.a]) && activeTown(s.towns[link.b]));
    const open = s.ports.filter(port => port.open);
    for (const from of open) {
      if (s.seaLinks.some(link => link.a === from.town || link.b === from.town) || s.seaLinks.length >= 14) continue;
      const close = open.filter(to => to.town !== from.town && tradeAllowed(s, from.town, to.town)
        && (s.region[to.land] !== s.region[from.land] || distance(position(from.land), position(to.land)) > 13))
        .sort((a, b) => distance(position(from.water), position(a.water)) - distance(position(from.water), position(b.water)));
      for (const to of close) {
        const route = seaPath(s, from.water, to.water, settlementEra(s) >= 5 ? 140 : 40);
        if (!route || route.length < 3) continue;
        s.seaLinks.push({ a: from.town, b: to.town, next: s.time + 2, reverse: false });
        report("Pobřežní osady otevírají lodní spojení.", "good");
        break;
      }
    }
    if (s.boats.length >= MAX_BOATS) { s.navalRecruit = -1; return; }
    launchLanding(s, open, report);
    if (s.boats.length >= MAX_BOATS) return;
    const active = s.towns.filter(activeTown).length;
    if (active + settlersOnWay(s) < settlementLimit(population,s) && s.towns.length < MAX_TOWNS
      && s.boats.filter(boat => boat.kind === "settle").length < 2) {
      for (const port of open) {
        const town = s.towns[port.town];
        if (s.time < (town.nextSail ?? 0) || town.cold > 0.28) continue;
        const target = findLanding(s, port, settlementEra(s) >= 5 ? 100 : 32, forecast);
        town.nextSail = s.time + (target ? 32 : 9);
        if (!target) continue;
        sail(s, port.town, -1, target.route, target.site);
        report((town.civilizationName ?? realmName(s, town.realm)) + " vyplouvá hledat nové pobřeží.", "good");
        break;
      }
    }
    for (const link of s.seaLinks) {
      if (s.boats.length >= MAX_BOATS || s.time < link.next || !tradeAllowed(s, link.a, link.b)
        || s.boats.some(boat => boat.kind === "ferry" && ((boat.from === link.a && boat.to === link.b) || (boat.from === link.b && boat.to === link.a)))) continue;
      const from = portAt(link.reverse ? link.b : link.a), to = portAt(link.reverse ? link.a : link.b);
      if (!from || !to) continue;
      const route = seaPath(s, from.water, to.water);
      link.next = s.time + 6;
      if (!route || route.length < 2) continue;
      if (townEra(s, s.towns[from.town]) >= 6) {
        const power = s.power.grids?.[s.towns[from.town].civilization] ?? s.power;
        if (power.reserve < CITY_RESERVE + 1) continue;
        power.reserve -= 1;
      }
      sail(s, from.town, to.town, route);
      link.reverse = !link.reverse;
    }
  }

  function moveLanding(s, boat, here, next, report) {
    if (boat.fighting && s.battle?.landing === boat.id) return true;
    const source = s.towns[boat.from], target = s.towns[boat.to];
    if (!activeTown(source) || source.civilization !== boat.civilization) {
      report("Námořní výsadek ztratil vlastní domovský přístav. Posádka se nevrátila.", "warn");
      return false;
    }
    if (!boat.returning && (!hostileCoast(s, source, target) || target.civilization !== boat.targetCivilization)) {
      boat.returning = true;
      report("Námořní výsadek se obrací domů. Poměry v cílové osadě se změnily.", "warn");
    }
    const diverted = boat.returning && !boat.homebound;
    if (!diverted && seaOpen(s, here) && next !== undefined && seaOpen(s, next)) return null;
    const plannedPort = boat.returning ? boat.launchPort : boat.landingPort;
    const port = coastalPort(s, boat.returning ? boat.from : boat.to, Boolean(plannedPort), plannedPort);
    if (port?.open && here === port.water && (boat.returning || landingAccess(s, port, source, target))) {
      boat.blocked = false;
      if (boat.returning) {
        const crew = s.communities.find(c => c.active && c.id === source.communityId);
        if (crew) source.guardCount = crew.guards += boat.guards;
        report("Námořní výsadek · " + settlementLabel(source) + " · Návrat posádky (" + boat.guards + ").", "good");
        return false;
      }
      if (s.battle) return true;
      boat.fighting = true;
      startBattle(s, boat.from + 1, boat.to + 1, report, boat, port.land);
      return true;
    }
    if (s.time >= boat.retryAt) {
      boat.retryAt = s.time + 2;
      const route = (boat.returning ? port?.open : landingAccess(s, port, source, target))
        && seaPath(s, here, port.water);
      if (route?.length > 1) {
        if (boat.returning) boat.homebound = true;
        if (plannedPort) {
          if (boat.returning) boat.launchPort = port;
          else boat.landingPort = port;
        }
        boat.goal = port.water; boat.route = route.slice(1).reverse();
        return null;
      }
    }
    if (!boat.blocked) report("Námořní výsadek zastavila neprůjezdná voda nebo uzavřený přístav.", "warn");
    boat.blocked = true;
    boat.stuck += STEP;
    if (boat.stuck < 24) return true;
    if (!boat.returning) {
      boat.returning = true; boat.stuck = 0; boat.retryAt = 0;
      report("Námořní výsadek ruší vylodění a hledá cestu zpět.", "warn");
      return true;
    }
    report("Námořní výsadek se nedostal do přístavu. Posádka se nevrátila.", "bad");
    return false;
  }

  function moveBoats(s, report) {
    s.boats = s.boats.filter(boat => {
      boat.previousX = boat.x; boat.previousY = boat.y;
      const here = at(boat.x, boat.y), next = boat.route.at(-1);
      if (boat.kind === "landing") {
        const result = moveLanding(s, boat, here, next, report);
        if (result !== null) return result;
      } else if (!seaOpen(s, here) || next !== undefined && !seaOpen(s, next)) {
        // A retreating shoreline can reveal a safe landing before the old harbor.
        const source = s.towns[boat.from];
        const shore = s.neighbors.map(list => list[here]).find(i => buildable(s, i, source)
          && actorTemperature(s, i, source) >= 0.20 && actorTemperature(s, i, source) <= 0.84
          && (boat.kind !== "settle" || (distance(position(i), position(boat.site)) < 5
            && Number.isFinite(settlementSafety(s, i, source))
            && !s.towns.some(t => activeTown(t) && distance(position(t.home), position(i)) < 7.5))));
        if (shore !== undefined && boat.kind === "settle") {
          const town = addTown(s, shore, boat.realm, 0.65);
          if (town) {
            town.settlementPreference = source?.settlementPreference;
            if (boat.civilization) { town.civilization = boat.civilization; town.profile = source?.profile; town.importedEra = source?.importedEra; settleResidents(s, town, source, boat.people ?? 100); }
            s.buildAt = s.societyAt = s.seaAt = s.time;
            report(realmName(s, boat.realm) + " přistál a zakládá osadu na novém pobřeží.", "good");
            return false;
          }
        }
        const target = s.towns[boat.to];
        if (shore !== undefined && boat.kind !== "settle" && activeTown(target)
          && sameGround(s, shore, target.home, source) && distance(position(shore), position(target.home)) < 8) {
          if (boat.kind === "ferry") s.trade = Math.min(1, s.trade + 0.12);
          return false;
        }
        boat.blocked = true;
        if (seaOpen(s, here) && s.time >= boat.retryAt) {
          const port = s.ports.find(p => p.town === (boat.kind === "settle" ? -1 : boat.to) && p.open);
          const goal = port?.water ?? s.neighbors.map(list => list[boat.site]).find(i => seaOpen(s, i));
          const route = goal === undefined ? null : seaPath(s, here, goal);
          boat.retryAt = s.time + 2;
          if (route) { boat.goal = goal; boat.route = route.slice(1).reverse(); boat.blocked = false; }
        }
        if (boat.blocked) {
          if (!boat.stuck) report("Loď zastavila mělčina, led nebo přerušená vodní cesta.", "warn");
          boat.stuck += STEP;
          return true;
        }
      }
      boat.blocked = false; boat.stuck = 0;
      if (boat.route.length) {
        const hop = position(boat.route.at(-1));
        const x = dx(boat.x, hop.x), y = hop.y - boat.y, gap = Math.hypot(x, y);
        const speed = boat.era >= 6 ? 0.57 : boat.era >= 5 ? 0.39 : 0.24;
        boat.heading = Math.atan2(y, x);
        if (gap <= speed) { boat.x = hop.x; boat.y = hop.y; boat.route.pop(); }
        else { boat.x = wrap(boat.x + x / gap * speed); boat.y += y / gap * speed; }
        return true;
      }
      if (boat.kind === "settle") {
        const source = s.towns[boat.from], site = boat.site;
        const other = s.towns.some(t => activeTown(t) && distance(position(t.home), position(site)) < 7.5);
        if (!other && buildable(s, site, source) && Number.isFinite(settlementSafety(s, site, source))
          && actorTemperature(s, site, source) >= 0.20 && actorTemperature(s, site, source) <= 0.84
          && s.neighbors.some(list => list[site] === here)) {
          const town = addTown(s, site, boat.realm, 0.65);
          if (town) {
            town.settlementPreference = source?.settlementPreference;
            if (boat.civilization) { town.civilization = boat.civilization; town.profile = source?.profile; town.importedEra = source?.importedEra; settleResidents(s, town, source, boat.people ?? 100); }
            s.buildAt = s.societyAt = s.seaAt = s.time;
            report(realmName(s, boat.realm) + " přistál a zakládá osadu na novém pobřeží.", "good");
          }
        } else if (source && activeTown(source)) {
          const port = s.ports.find(p => p.town === boat.from && p.open);
          const route = port && seaPath(s, here, port.water);
          if (route) {
            Object.assign(boat, { kind: "return", to: boat.from, site: -1, goal: port.water, route: route.slice(1).reverse() });
            report("Osadníci se vracejí: pobřeží už není bezpečné.", "warn");
            return true;
          }
        }
      } else if (boat.kind === "ferry" && townConnected(s, s.towns[boat.from]) && townConnected(s, s.towns[boat.to])
        && tradeAllowed(s, boat.from, boat.to) && waterAccess(s, s.towns[boat.from].home) >= 0.24) {
        s.trade = Math.min(1, s.trade + 0.18);
      }
      return false;
    });
  }

  function workingFactory(s, town) {
    const i = town.factory;
    const grid = s.power.grids?.[town.civilization] ?? s.power;
    const temp = typeof Evolution !== "undefined" ? Evolution.temperature(s, i, town) : s.temperature[i];
    return activeTown(town) && grid.strain < 0.62 && i >= 0 && !contaminated(s, i) && s.damage[i] < 0.60 && temp > 0.18 && buildable(s, i, town);
  }

  function emptyResearch() {
    return { active: null, progress: { climate: 0, navigation: 0 } };
  }

  function knows(s, key) {
    return Object.hasOwn(RESEARCH, key) && (!s.researchPolicy || s.researchPolicy.faith >= 10 && s.researchPolicy.funded[key]) && s.research.progress[key] >= RESEARCH[key].work;
  }

  function researchBlock(s, population, key) {
    if (!Object.hasOwn(RESEARCH, key)) return "Neznámý projekt.";
    if (s.researchPolicy?.faith < 10) return "Výzkum čeká na společnou víru 10 / 10.";
    if (s.researchPolicy && !s.researchPolicy.funded[key]) return "Nejprve zaplať zahájení tohoto výzkumu.";
    if (knows(s, key)) return "Technologie je dostupná.";
    if (population <= 0 || settlementEra(s) < 6) return "Potřebuješ moderní civilizaci.";
    if (!s.towns.some(town => workingFactory(s, town))) return "Potřebuješ funkční továrnu.";
    return "";
  }

  function receivePlans(s, plans) {
    for (const key of plans) {
      if (!Object.hasOwn(RESEARCH, key)) continue;
      s.research.progress[key] = RESEARCH[key].work;
      if (s.research.active === key) s.research.active = null;
    }
  }

  function stationKit() {
    return { tile: -1, mode: "off", battery: STATION_BATTERY, fraction: 0, draw: 0, load: 0, destroyed: false, pending: false };
  }

  function receiveStation(s) {
    const station = { ...stationKit(), id: s.nextStationId++ };
    s.stations.push(station);
    return station;
  }

  function placedStations(s) {
    return s.stations.filter(station => station.tile >= 0 && !station.destroyed && s.damage[station.tile] < 0.78);
  }

  function stationSite(s, point) {
    const i = at(point.x, point.y);
    if (s.urban[i] || worksiteReserved(s, i) || i === s.colony || s.monuments.some(m => m.tile === i) || !buildable(s, i))
      return { error: "Vyber volnou suchou plochu mimo lávu a led." };
    let town = 0, gap = STATION_REACH * 0.6;
    for (const [index, candidate] of s.towns.entries()) {
      if (!activeTown(candidate) || s.region[candidate.home] !== s.region[i]) continue;
      const d = distance(position(i), position(candidate.home));
      if (d < gap) { town = index + 1; gap = d; }
    }
    const nearColony = s.colony >= 0 && s.region[s.colony] === s.region[i]
      && distance(position(i), position(s.colony)) < STATION_REACH * 0.6;
    const relay = placedStations(s).find(station => station.mode !== "off" && !stationFault(s, station)
      && (station.fraction > 0.3 || station.load < 0.03 && s.power.reserve >= CITY_RESERVE)
      && s.region[station.tile] === s.region[i] && distance(position(i), position(station.tile)) < STATION_REACH * 0.84);
    if (!town && !nearColony && !relay) return { error: "Stav u osady nebo u okraje dosahu funkčního teraformeru na stejné souši." };
    if (!town && relay) town = s.plotTown[relay.tile];
    return { i, town };
  }

  function worksiteReserved(s, i, except = null) {
    return (s.communities ?? []).some(c => c.job !== except && c.job?.economic && ["energy", "mine", "hydro"].includes(c.job.kind) && c.job.phase !== "return" && c.job.target === i);
  }
  function reservePlot(s, i, town, type) {
    s.urban[i] = type; s.plotTown[i] = town; s.damage[i] = 0;
    s.damageCause[i] = s.damageNotice[i] = s.noBuild[i] = 0;
    if (!s.plots.includes(i)) s.plots.push(i);
  }

  function stationBuildBlock(s, supply, population) {
    if (placedStations(s).length >= MAX_STATIONS) return "Na planetě může pracovat nejvýše " + MAX_STATIONS + " teraformerů.";
    if (s.stations.some(station => station.tile < 0)) return "";
    if (!knows(s, "climate")) return "Doprav sadu nebo plán Regulace klimatu.";
    if (population <= 0 || settlementEra(s) < 6 || !s.towns.some(t => workingFactory(s, t)))
      return "Místní výroba potřebuje moderní civilizaci a funkční továrnu. Jinak doprav sadu lodí.";
    if (s.power.reserve < STATION_ENERGY + CITY_RESERVE) return "Místní stavba potřebuje 70 E a rezervu 35 E.";
    if (supply < STATION_SUPPLY) return "Místní stavba potřebuje 24 M.";
    return "";
  }

  function buildStation(s, point, supply, population) {
    const issue = stationBuildBlock(s, supply, population);
    if (issue) return { error: issue };
    const site = stationSite(s, point);
    if (site.error) return { error: site.error };
    let station = s.stations.find(station => station.tile < 0);
    const local = !station;
    if (local) { station = receiveStation(s); s.power.reserve -= STATION_ENERGY; }
    reservePlot(s, site.i, site.town, STATION_TILE);
    station.tile = site.i;
    return { error: "", supplies: local ? STATION_SUPPLY : 0, station };
  }

  function installStation(s, point) {
    return buildStation(s, point, 0, 0).error;
  }

  function setStationMode(s, mode, id) {
    const station = s.stations.find(station => station.id === id)
      ?? (id === undefined ? placedStations(s)[0] : null);
    if (!station || station.tile < 0 || station.destroyed || !Object.hasOwn(STATION_MODES, mode)) return false;
    if (s.power.grids && station.civilization !== s.power.controller) return false;
    station.mode = mode;
    station.fraction = station.draw = station.load = 0;
    station.pending = true;
    return true;
  }

  function installHydro(s, point, supply) {
    if (!knows(s, "climate")) return "Pro turbínu potřebuješ plán regulace klimatu.";
    const floor = settlementEra(s) >= 6 ? CITY_RESERVE : 8;
    if (s.power.reserve < floor + HYDRO_ENERGY || supply < HYDRO_SUPPLY)
      return "Turbína potřebuje " + HYDRO_ENERGY + " E, " + HYDRO_SUPPLY + " M a rezervu pro osadu.";
    if (s.power.plants.length >= 24) return "Síť už dosáhla limitu elektráren.";
    const site = stationSite(s, point);
    if (site.error) return site.error;
    if (!site.town || s.power.grids && s.towns[site.town - 1]?.civilization !== s.power.controller) return "Turbínu stav u vlastní rozvinuté osady.";
    if (hydroPotential(s, site.i) < 1) return "Na sousedním poli potřebuješ tekoucí vodu se spádem.";
    commissionPlant(s, "hydro", site.i, site.town, s.power.viewOwner);
    s.power.reserve -= HYDRO_ENERGY;
    return "";
  }

  function commissionPlant(s, kind, i, town, civilization, profile) {
    reservePlot(s, i, town, POWER_TILES[kind]);
    s.power.plants.push({ kind, tile: i, town, civilization, profile, output: 0 });
  }

  function stationFault(s, station) {
    const i = station.tile;
    if (station.abandoned) return "Opuštěná technika";
    if (i < 0) return "Sada čeká na umístění";
    if (station.destroyed || s.damage[i] >= 0.78) return "Trosky";
    if (s.lava[i] >= MOLTEN) return "Zasaženo lávou";
    if (s.fire[i] >= 0.12) return "Požár";
    if (typeof Evolution !== "undefined" && Evolution.iceFailure(s, i, station)) return "Tající / nestabilní led";
    if (floodDepth(s, i, station) >= 0.85) return "Zaplaveno";
    if (s.damage[i] >= 0.62) return "Poškozeno – potřebuje opravu";
    return "";
  }

  function thermalAdjustment(s, station) {
    const bias = station.mode === "heat" ? 0.48 : station.mode === "cool" ? -0.48 : 0;
    const target = bias && typeof Evolution !== "undefined" ? Evolution.climateTarget(Evolution.actorProfile(s, station)) : 0.47;
    return { station, point: position(station.tile), bias, target, load: bias ? STATION_THERMAL_DRAW : 2.8 };
  }

  function stationRequests(s) {
    return s.stations.flatMap(station => {
      station.moistureMoved = 0;
      station.moistureChecked = false;
      if (stationFault(s, station) || station.mode === "off") { station.draw = station.load = station.fraction = 0; return []; }
      return [thermalAdjustment(s, station)];
    });
  }

  function waterClimate(s, adjustments) {
    const hydro = adjustments.filter(item => ["dry", "wet"].includes(item.station.mode) && item.station.fraction > 0);
    if (!hydro.length) return;
    for (const item of hydro) {
      item.station.moistureChecked = true;
      const i = item.station.tile, speed = Math.hypot(s.windX[i], s.windY[i]), reach = STATION_REACH + 3;
      let x = item.point.x + (speed > 0.04 ? s.windX[i] / speed : 1) * reach;
      let y = item.point.y + (speed > 0.04 ? s.windY[i] / speed : 0) * reach;
      if (y < 0 || y >= H) { x = item.point.x + reach; y = item.point.y; }
      item.outlet = at(x, y); item.source = -1;
      if (item.station.mode === "wet") {
        let available = 0;
        for (let dy = -STATION_REACH - 6; dy <= STATION_REACH + 6; dy++) {
          if (item.point.y + dy < 0 || item.point.y + dy >= H) continue;
          for (let dx = -STATION_REACH - 6; dx <= STATION_REACH + 6; dx++) {
            const j = at(item.point.x + dx, item.point.y + dy);
            if (s.water[j] > available && s.ice[j] < 0.18) { item.source = j; available = s.water[j]; }
          }
        }
      }
    }
    for (let i = 0; i < SIZE; i++) {
      let drying = null, wetting = null, dryStrength = 0, wetStrength = 0;
      const point = position(i);
      for (const item of hydro) {
        const x = dx(point.x, item.point.x), y = point.y - item.point.y;
        const strength = item.station.fraction * Math.max(0, 1 - (x * x + y * y) / STATION_REACH ** 2);
        if (item.station.mode === "dry" && strength > dryStrength) { dryStrength = strength; drying = item; }
        if (item.station.mode === "wet" && strength > wetStrength) { wetStrength = strength; wetting = item; }
      }
      if (drying) {
        const limit = 0.012 * dryStrength, surface = Math.min(s.water[i], limit), soil = Math.min(s.soil[i], Math.max(0, limit - surface));
        s.water[i] -= surface; s.soil[i] -= soil;
        s.air[drying.outlet] += surface + soil; drying.station.moistureMoved += surface + soil;
      }
      if (wetting) {
        const limit = 0.0075 * wetStrength, vapor = Math.min(s.air[i], limit);
        s.air[i] -= vapor;
        const source = wetting.source, pumped = source >= 0 && source !== i ? Math.min(s.water[source], limit - vapor) : 0;
        if (pumped) s.water[source] -= pumped;
        // cloudWeather has already deducted ordinary rainfall. This extra rain is deducted here.
        s.rain[i] += vapor + pumped; wetting.station.moistureMoved += vapor + pumped;
      }
    }
  }

  function climateAt(adjustments, point, localTemp) {
    let warm = 0, cool = 0;
    for (const item of adjustments) {
      if (!item.bias || item.station.fraction <= 0) continue;
      const x = dx(item.point.x, point.x), y = item.point.y - point.y;
      const delta = item.bias * item.station.fraction * Math.max(0,
        1 - (x * x + y * y) / STATION_REACH ** 2);
      const gap = item.target - localTemp;
      if (delta > 0) warm = Math.max(warm, Math.min(delta, gap));
      if (delta < 0) cool = Math.min(cool, Math.max(delta, gap));
    }
    return warm + cool;
  }

  const orbitalBase = (s, heat) => heat + clamp(0.53 - heat, -ATMOSPHERE_LIMIT, ATMOSPHERE_LIMIT) * s.legacyClimate;
  const localAmbient = (s, i, base) => base - s.shade[i] - Math.max(0, s.height[i] - 0.46) * 0.32
    - Math.max(0, s.height[i] - SUMMIT_START) * 4;

  function seasonalTemperatures(s, heats) {
    const thermal = s.stations.filter(station => station.fraction > 0 && !stationFault(s, station)
      && (station.mode === "heat" || station.mode === "cool")).map(station => thermalAdjustment(s, station));
    return heats.map(heat => {
      const base = orbitalBase(s, heat);
      return Float32Array.from(s.height, (_, i) => {
        const ambient = localAmbient(s, i, base);
        return thermal.length ? ambient + climateAt(thermal, position(i), ambient) : ambient;
      });
    });
  }

  function researchWait(s, population, supply, key) {
    const issue = researchBlock(s, population, key);
    if (issue) return issue;
    if (supply < 16) return "Výzkum čeká: je potřeba alespoň 16 M.";
    if (s.power.reserve < CITY_RESERVE) return "Výzkum čeká na rezervu alespoň 35 E.";
    const renewable = s.power.plants.filter(p => p.kind !== "thermal").reduce((sum, p) => sum + p.output, 0);
    const cities = Math.max(0, s.power.demand - s.power.programDraw - s.power.stationDraw);
    if (renewable - cities - s.power.stationDraw < 0.02) return "Chybí přebytek výroby po spotřebě měst a teraformerů. Plná baterie sama výzkum nenapájí.";
    return "Po zavření okna pokračuje výzkum z přebytku výroby.";
  }

  const buildingNames = { 2: "Pole", 3: "Obydlí", 4: "Centrum osady", 5: "Továrna", 6: "Větrná elektrárna", 7: "Solární elektrárna", 8: "Tepelná elektrárna", 9: "Vodní turbína", 10: "Teraformer", 11: "Těžební důl", 12: "Jaderná elektrárna" };

  function surfaceInstallations(s) {
    const assets = [];
    for (const base of s.robotBases ?? []) {
      if (base.civilization && Number.isInteger(base.tile) && base.tile >= 0 && base.tile < SIZE)
        assets.push({ tile: base.tile, owner: base.civilization, name: base.colonyCore ? "Kolonie" : "Robotická základna" });
    }
    for (const plant of s.power.plants) {
      const kind = POWER_TILES[plant.kind];
      if (plant.civilization && kind && s.urban[plant.tile] === kind && s.damage[plant.tile] < 0.78)
        assets.push({ tile: plant.tile, owner: plant.civilization, name: buildingNames[kind] });
    }
    for (const station of s.stations) {
      if (station.civilization && !station.destroyed && s.urban[station.tile] === STATION_TILE && s.damage[station.tile] < 0.78)
        assets.push({ tile: station.tile, owner: station.civilization, name: buildingNames[STATION_TILE] });
    }
    return assets;
  }

  function buildingName(s, i) {
    const station = s.stations.find(station => station.tile === i);
    return (buildingNames[s.urban[i]] ?? (s.ports.some(p => p.land === i) ? "Přístav" : "Monument"))
      + (station ? " " + station.id : " [" + (i % W + 1) + ", " + (Math.floor(i / W) + 1) + "]");
  }

  function reportCondition(s, i, report) {
    if (s.urban[i] < 5 && !s.ports.some(port => port.land === i) && !s.monuments.some(m => m.tile === i)) return;
    const phase = s.damage[i] >= 0.78 ? 3 : s.damage[i] >= 0.62 ? 2 : s.damage[i] >= 0.35 ? 1 : 0;
    if (phase > s.damageNotice[i]) {
      const why = DAMAGE_CAUSES[s.damageCause[i]] || "poškození";
      const message = phase === 3 ? " – zničeno. Příčina: " : phase === 2 ? " – odstaveno, potřebuje opravu. Příčina: " : " – varování před poškozením. Příčina: ";
      report(buildingName(s, i) + message + why + ".", phase >= 2 ? "bad" : "warn");
    }
    s.damageNotice[i] = phase;
  }

  function buildingStatus(s, building) {
    const i = building.tile, damage = s.damage[i], cause = DAMAGE_CAUSES[s.damageCause[i]] || "příčina ze starší pozice není zaznamenaná";
    if (damage >= 0.78 || building.station?.destroyed) return { label: "Trosky", detail: "Poslední příčina: " + cause + ".", tone: "bad" };
    const station = building.station;
    const actor = plotActor(s, i), flood = floodDepth(s, i, actor) >= (station ? 0.85 : 0.34);
    if (s.lava[i] >= MOLTEN) return { label: "Láva", detail: "Nejdřív odveď lávu nebo počkej na vychladnutí.", tone: "bad" };
    if (s.fire[i] >= 0.12) return { label: "Požár", detail: "Uhas oheň, potom lze stavbu opravit.", tone: "bad" };
    if (typeof Evolution !== "undefined" && Evolution.iceFailure(s, i, actor)) return { label: "Tající / nestabilní led", detail: "Nosný led zeslábl. Obnov pevný led nebo přesuň osídlení na souš.", tone: "bad" };
    if (flood) return { label: "Zaplaveno", detail: "Odveď vodu korytem nebo uprav okolí. Energie samotná zaplavení nevyřeší.", tone: "bad" };
    if (damage >= 0.62) return { label: "Potřebuje opravu", detail: "Poškození: " + cause + ".", tone: "bad" };
    if (station) {
      if (station.mode === "off") return { label: "Vypnuto", detail: "Zvol Ohřev nebo Chlazení. Dosah 16 polí; překrytí stejných režimů se nesčítá.", tone: "" };
      if (station.pending) return { label: "Čeká na běh času", detail: "Napájení a účinek se přepočítají po zavření okna a spuštění simulace.", tone: "" };
      if (station.load > 0.02 && station.draw < station.load - 0.02) return { label: "Chybí napájení", detail: "Posil místní energetickou síť. Stanice sdílejí výkon své civilizace poměrně.", tone: "warn" };
      if (station.mode === "wet" && station.moistureChecked && station.draw > 0.02 && !(station.moistureMoved > 0)) return { label: "Chybí dostupná voda", detail: "Přiveď mraky větrem, nebo vodu pramenem či korytem. Stanice vodu přesouvá, nevytváří ji.", tone: "warn" };
      return { label: STATION_MODES[station.mode], detail: station.mode === "dry" ? "Odvádí vodu a vláhu do atmosféry po větru. Led zůstává zachovaný. Provoz 2,8 E/s."
        : station.mode === "wet" ? "Vytváří místní déšť z dostupné vlhkosti a vody v okolí. Provoz 2,8 E/s."
        : "Upravuje teplotu podle místních podmínek v dosahu. Příkon 3,2 E/s.", tone: damage >= 0.35 ? "warn" : "" };
    }
    if (building.port) {
      if (!seaOpen(s, building.port.water)) return { label: "Neprůjezdná voda", detail: s.ice[building.port.water] >= 0.18 ? "Přístup k přístavu zamrzl." : "Chybí dostatečně hluboká vodní cesta.", tone: "warn" };
      if (!townConnected(s, s.towns[building.port.town])) return { label: "Osada není v provozu", detail: "Přístav potřebuje obydlenou a přístupnou osadu.", tone: "warn" };
    }
    if (building.plant) {
      const plant = building.plant;
      if (!plant.robot && !activeTown(s.towns[plant.town - 1])) return { label: "Osada opuštěna", detail: "Elektrárna čeká na obnovu osídlení.", tone: "warn" };
      if (plant.kind === "hydro" && plant.output < 0.05) return { label: "Bez výroby", detail: s.neighbors.some(list => s.ice[list[i]] > 0.18)
        ? "Tok v okolí turbíny zamrzl." : "Chybí tekoucí voda se spádem. Turbíny u stejného spádu sdílejí výkon.", tone: "warn" };
      if (plant.kind === "nuclear" && plant.output < 0.05 && (s.power.grids?.[plant.civilization]?.supplies ?? 0) < 5) return { label: "Chybí materiál", detail: "Jaderná elektrárna potřebuje v místním skladu alespoň 5 M.", tone: "warn" };
      if (plant.kind === "thermal" && plant.output < 0.05) return { label: "Záloha čeká", detail: "Spouští se při nedostatku energie a spotřebovává materiál. Při plné rezervě může stát.", tone: "" };
      if (s.ice[i] >= 0.18 && plant.kind !== "wind") return { label: "Omezeno ledem", detail: "Rozpusť led, aby se obnovil výkon.", tone: "warn" };
    }
    if (building.kind === 5 && (typeof Evolution !== "undefined" ? Evolution.comfort(s, i, building.town) < 0.12 : s.temperature[i] <= 0.18 || s.ice[i] >= 0.24)) return { label: "Nevhodná teplota", detail: "Továrna potřebuje podnebí své civilizace a přístupné místo.", tone: "warn" };
    if (building.kind === 5 && floodDepth(s, i, actor) >= 0.27) return { label: "Podmáčený provoz", detail: "Továrna potřebuje suché pracoviště. Odveď vodu.", tone: "warn" };
    if (building.kind === 5 && (s.power.grids?.[building.town?.civilization] ?? s.power).strain >= 0.62) return { label: "Výpadek sítě", detail: "Továrna čeká na zotavení energetické sítě.", tone: "warn" };
    if (building.town && !activeTown(building.town)) return { label: "Opuštěná osada", detail: "Opravou obydlí lze osadu obnovit, pokud na planetě ještě žijí lidé.", tone: "warn" };
    if (damage >= 0.35) return { label: "Poškozeno", detail: "Poslední příčina: " + cause + ". Doporučená oprava.", tone: "warn" };
    return { label: "V provozu", detail: building.kind === 9 ? "Více turbín u stejného spádu sdílí jeho výkon, nejvýše 8 E/s." : "", tone: "" };
  }

  function buildings(s) {
    const items = [], stations = new Map(s.stations.filter(station => station.tile >= 0).map(station => [station.tile, station]));
    const plants = new Map(s.power.plants.map(plant => [plant.tile, plant]));
    const mines = new Map(s.mines?.map(mine => [mine.tile, mine]));
    for (const i of new Set(s.plots)) {
      if (s.urban[i] < 2) continue;
      const station = stations.get(i), plant = plants.get(i), town = s.towns[s.plotTown[i] - 1];
      const abandoned = Boolean((station ?? plant ?? mines.get(i))?.abandoned);
      items.push({ id: station ? "station:" + station.id : "plot:" + i, tile: i, kind: s.urban[i], station, plant, town, abandoned,
        name: buildingName(s, i), group: s.urban[i] >= 5 ? "equipment" : "homes" });
    }
    for (const port of s.ports) items.push({ id: port.town === -1 ? "ruin-port:" + port.land : "port:" + port.town,
      tile: port.land, kind: "port", port, town: s.towns[port.town], name: port.town === -1 ? "Pozůstatky přístavu" : "Přístav osady " + (port.town + 1), group: "equipment" });
    for (const monument of s.monuments) items.push({ id: "monument:" + monument.tile, tile: monument.tile, kind: "monument", monument,
      town: s.towns[monument.town - 1], name: monument.town ? "Monument osady " + monument.town : "Pozůstatky monumentu", group: "equipment" });
    for (const item of items) {
      item.status = buildingStatus(s, item);
      item.health = s.damage[item.tile] >= 0.78 || item.station?.destroyed ? 0 : Math.max(1, Math.round((1 - s.damage[item.tile] / 0.78) * 100));
      item.cause = DAMAGE_CAUSES[s.damageCause[item.tile]] || "";
      item.ancient = item.port ? item.port.town === -1 : item.monument ? item.monument.town === 0
        : Boolean(s.ancientRuins?.[item.tile] && !item.town);
      if (item.abandoned && item.health > 0) item.status = { label: "Opuštěná technika", detail: "Bez obsluhy. Převzít ji může osada, na jejímž území stojí.", tone: "warn" };
      item.ancient ||= item.abandoned;
      if (item.ancient && (!item.abandoned || !item.health)) {
        item.health = 0;
        item.status = { label: "Trosky", detail: "Pozůstatek dřívějšího osídlení.", tone: "bad" };
      }
    }
    return items.sort((a, b) => Number(b.kind === STATION_TILE) - Number(a.kind === STATION_TILE) || Number(b.status.tone === "bad") - Number(a.status.tone === "bad") || a.tile - b.tile);
  }

  function repairQuote(s, id, supply, population, successor = null) {
    const building = typeof id === "object" ? id : buildings(s).find(item => item.id === id);
    if (!building) return { error: "Stavba už na planetě není." };
    const i = building.tile, damage = Math.max(s.damage[i], building.abandoned ? 0.01 : building.ancient ? 0.78 : 0);
    if (population <= 0) return { error: "Oprava potřebuje obydlený svět." };
    if (contaminated(s, i)) return { error: "Obnova musí počkat, až ustoupí kontaminace." };
    if (damage < 0.01) return { error: "Stavba opravu nepotřebuje." };
    const actor = successor ?? plotActor(s, i);
    if (typeof Evolution !== "undefined" && Evolution.iceFailure(s, i, actor)) return { error: "Nejdřív obnov pevný nosný led nebo zvol jiné místo." };
    if (s.lava[i] >= MOLTEN || s.fire[i] >= 0.08 || floodDepth(s, i, actor) >= (building.station ? 0.85 : 0.34))
      return { error: "Nejdřív odstraň zaplavení, oheň nebo lávu." };
    if (s.burnScar[i] > 0.50 || s.neighbors.some(neighbor => s.fire[neighbor[i]] > 0.13))
      return { error: "Stavbu lze opravit až po dohoření okolí a vychladnutí požářiště." };
    if (building.station && (building.station.destroyed || damage >= 0.78) && placedStations(s).filter(station => !s.power.grids || station.civilization === (successor?.civilization ?? building.station.civilization)).length >= MAX_STATIONS) return { error: "Uvolni místo v limitu teraformerů." };
    const costs = building.station ? [36, 14] : building.plant || building.kind === 5 ? [22, 10]
      : building.port ? [12, 8] : building.monument ? [18, 10] : [6, 4];
    const ratio = clamp(damage / 0.78, 0.25, 1);
    const energy = Math.ceil(costs[0] * ratio), supplies = Math.ceil(costs[1] * ratio);
    const floor = settlementEra(s) >= 6 ? CITY_RESERVE : 8;
    if (s.power.reserve < energy + floor) return { error: "Oprava potřebuje " + energy + " E a rezervu " + floor + " E.", energy, supplies };
    if (supply < supplies) return { error: "Oprava potřebuje " + supplies + " M.", energy, supplies };
    return { error: "", energy, supplies, building };
  }

  function repairBuilding(s, id, supply, population, successor = null) {
    const quote = repairQuote(s, id, supply, population, successor);
    if (quote.error) return quote;
    const b = quote.building, ruined = s.damage[b.tile] >= 0.78;
    s.power.reserve -= quote.energy;
    s.damage[b.tile] = 0; s.damageNotice[b.tile] = s.damageCause[b.tile] = 0;
    if (b.station) { b.station.destroyed = false; b.station.pending = true; b.station.draw = b.station.load = b.station.fraction = 0; if (ruined) b.station.mode = "off"; }
    if (b.town && b.kind !== "port" && b.kind !== "monument" && b.kind < 5) b.town.abandoned = false;
    if (successor) {
      const index = s.towns.indexOf(successor), owner = { civilization: successor.civilization, profile: successor.profile };
      if (b.port) b.port.town = index;
      else if (b.monument) Object.assign(b.monument, { town: index + 1, civilization: owner.civilization, realm: successor.realm });
      else {
        s.plotTown[b.tile] = index + 1;
        if (s.ancientRuins) s.ancientRuins[b.tile] = 0;
        if (b.kind >= 2 && b.kind <= 5) successor.count++;
        if (b.kind === 5) successor.factory = b.tile;
        if (b.plant) Object.assign(b.plant, owner, { town: index + 1, abandoned: false, robot: false });
        if (b.station) Object.assign(b.station, owner, { abandoned: false });
        const mine = s.mines.find(m => m.tile === b.tile);
        if (mine) Object.assign(mine, { town: index + 1, civilization: owner.civilization, abandoned: false });
      }
    }
    return quote;
  }

  function demolishBuilding(s, id) {
    const b = buildings(s).find(item => item.id === id);
    if (!b) return { error: "Stavba už na planetě není." };
    s.noBuild[b.tile] = 1;
    if (b.port) { s.ports = s.ports.filter(port => port !== b.port); if (b.town) b.town.harborRebuildAt = s.time + 45; }
    else if (b.monument) s.monuments = s.monuments.filter(m => m !== b.monument);
    else {
      if (b.station) s.stations = s.stations.filter(station => station !== b.station);
      if (b.plant) s.power.plants = s.power.plants.filter(plant => plant !== b.plant);
      s.mines = (s.mines ?? []).filter(mine => mine.tile !== b.tile);
      if (b.kind === 5 && b.town) { b.town.factory = -1; b.town.factoryRebuildAt = s.time + 60; }
      if (b.town && b.kind >= 2 && b.kind <= 5) b.town.count = Math.max(0, b.town.count - 1);
      s.urban[b.tile] = s.plotTown[b.tile] = 0;
      if (s.ancientRuins) s.ancientRuins[b.tile] = 0;
      s.damage[b.tile] = 0; s.damageCause[b.tile] = s.damageNotice[b.tile] = 0;
      s.plots = s.plots.filter(i => i !== b.tile);
    }
    return { error: "", building: b };
  }

  function emptyPower() {
    return { reserve: 0, output: 0, demand: 0, strain: 0, age: 0, work: 0, deficient: 0,
      programDraw: 0, stationDraw: 0, stationGenerator: 0, fuelUse: 0, nextBuild: 0, pollution: 0, linked: false, plants: [] };
  }

  function energyStage(s, satellite) {
    return !satellite || s.power.work < PROBE_WORK ? 1 : s.power.linked ? 3 : 2;
  }

  function powerPotential(s, i, kind, irradiance) {
    if (kind === "wind") {
      const exposure = 0.27 + clamp((s.height[i] - 0.48) * 0.65, 0, 0.25);
      const breeze = (Math.sin(s.time * 0.16 + i * 0.003) + 1) * 0.055;
      const gust = Math.hypot(s.windX[i], s.windY[i]);
      return 13 * clamp(exposure + breeze + gust * 0.92 + (s.storm ? 0.08 : 0), 0, 1)
        * clamp(1 - s.ice[i] * 0.7, 0.25, 1);
    }
    if (kind === "thermal" || kind === "nuclear") return 13;
    if (kind === "hydro") return hydroPotential(s, i);
    const site = position(i);
    let shade = 0;
    for (const cloud of s.clouds) {
      const cover = 1 - distance(site, cloud) / (cloudRadius(cloud.water) + 0.5);
      shade = Math.max(shade, cover * Math.min(0.86, cloud.water * 0.23));
    }
    const clear = (1 - shade) * (1 - s.impactDust * 2.5) * (1 - s.smog[i] * 0.42);
    return 8.6 * irradiance * clear * (1 - s.shade[i] * 2) * clamp(1 - s.ice[i] * 2.4, 0.05, 1);
  }

  function hydroPotential(s, i) {
    return hydroDrop(s, i).potential;
  }

  function hydroDrop(s, i) {
    let potential = 0, source = -1;
    for (const list of s.neighbors) {
      const j = list[i];
      const head = Math.max(0, s.level[j] - s.level[s.downstream[j]]);
      const value = s.flow[j] * head;
      if (value > potential) { potential = value; source = j; }
    }
    return { key: source < 0 ? -1 : source * SIZE + s.downstream[source], potential: Math.min(8, potential * 650) };
  }

  function workingPlant(s, plant) {
    const i = plant.tile;
    return activeTown(s.towns[plant.town - 1]) && s.urban[i] === POWER_TILES[plant.kind] && s.damage[i] < 0.62
      && s.water[i] < 0.34 && s.fire[i] < 0.12 && s.lava[i] < MOLTEN;
  }

  function buildPowerPlant(s, kinds, irradiance, working, report) {
    const count = kind => working.filter(plant => plant.kind === kind).length;
    const choices = kinds.map(kind => ({ kind, repeated: count(kind) * 0.62 }));
    let best = null, rating = -Infinity;
    for (const [index, town] of s.towns.entries()) {
      if (!activeTown(town) || town.count < 4 || (typeof Evolution !== "undefined" ? Evolution.temperature(s, town.home, town) : s.temperature[town.home]) < 0.14 || !buildable(s, town.home)) continue;
      const origin = position(town.home);
      for (let y = -8; y <= 8; y++) {
        if (origin.y + y < 0 || origin.y + y >= H) continue;
        for (let x = -8; x <= 8; x++) {
          const gap = Math.hypot(x, y), i = at(origin.x + x, origin.y + y);
          if (gap < 2.8 || gap > 8 || s.urban[i] || s.noBuild[i] || worksiteReserved(s, i) || !buildable(s, i, town) || !sameGround(s, i, town.home, town)
            || s.monuments.some(m => m.tile === i) || (s.claims[i] && s.claims[i] !== index + 1)) continue;
          if (working.some(plant => distance(position(i), position(plant.tile)) < 2.3)) continue;
          for (const { kind, repeated } of choices) {
            const output = powerPotential(s, i, kind, irradiance);
            const score = output / 13 - repeated - gap * 0.019 + hash(i, s.seed, index) * 0.028;
            if (score <= rating) continue;
            rating = score;
            best = { tile: i, town: index + 1, kind, output: 0 };
          }
        }
      }
    }
    if (!best) return false;
    s.power.plants.push(best);
    reservePlot(s, best.tile, best.town, POWER_TILES[best.kind]);
    report(realmName(s, s.towns[best.town - 1].realm) + " staví " + POWER_NAMES[best.kind] + ".", best.kind === "thermal" ? "warn" : "good");
    return true;
  }

  function plantSmoke(s, plant, share) {
    const origin = position(plant.tile);
    const x = origin.x + 2.1 + s.windX[plant.tile] * 4, y = origin.y + s.windY[plant.tile] * 3;
    for (let dy = -5; dy <= 5; dy++) {
      if (y + dy < 0 || y + dy >= H) continue;
      for (let dx = -6; dx <= 6; dx++) {
        const density = Math.max(0, 1 - Math.hypot(dx / 6, dy / 5));
        const i = at(x + dx, y + dy);
        s.smog[i] = Math.min(1, s.smog[i] + share * density * 0.056);
      }
    }
  }

  function updatePower(s, population, supply, irradiance, requests, report) {
    const modern = settlementEra(s) >= 6;
    const grid = s.power;
    const towns = s.towns.filter(t => activeTown(t) && s.damage[t.home] < 0.78);
    if ((!modern || !towns.length) && !placedStations(s).length) {
      grid.output = grid.demand = grid.programDraw = grid.stationDraw = grid.stationGenerator = grid.fuelUse = 0;
      return;
    }
    grid.age += STEP;
    const heating = towns.reduce((sum, town) => {
      const temp = typeof Evolution !== "undefined" ? Evolution.temperature(s, town.home, town) : s.temperature[town.home];
      return sum + clamp((0.37 - temp) / 0.28, 0, 1) + clamp((temp - 0.82) / 0.33, 0, 0.65);
    }, 0) / Math.max(1, towns.length);
    const industry = towns.filter(town => town.factory >= 0 && s.damage[town.factory] < 0.60).length;
    const civilDemand = modern ? 3.2 + towns.length * 0.48 + 2.25 * Math.sqrt(population / 1400000)
      + industry * 0.52 + heating * 5.6 + (grid.linked ? 0.9 : 0) : 1.2 + towns.length * 0.26 + heating * 1.45;
    const working = grid.plants.filter(plant => workingPlant(s, plant));
    const hydro = new Map(), drops = new Map();
    for (const plant of working) if (plant.kind === "hydro") {
      const drop = hydroDrop(s, plant.tile);
      drops.set(plant, drop);
      hydro.set(drop.key, (hydro.get(drop.key) ?? 0) + 1);
    }
    let renewable = 0, thermal = 0;
    for (const plant of grid.plants) {
      plant.output = working.includes(plant) ? powerPotential(s, plant.tile, plant.kind, irradiance) : 0;
      if (drops.has(plant)) plant.output /= hydro.get(drops.get(plant).key);
      if (plant.kind === "thermal") thermal += plant.output;
      else renewable += plant.output;
    }
    const emergencyCharge = clamp((CITY_RESERVE - grid.reserve) * 0.12, 0, 1.8);
    const thermalLimit = clamp((supply - 6) / 22, 0, 1);
    const share = thermal && grid.reserve < CITY_RESERVE + 14
      ? clamp((civilDemand + emergencyCharge - renewable) / thermal, 0, thermalLimit) : 0;
    for (const plant of working) {
      if (plant.kind !== "thermal") continue;
      plant.output *= share;
      if (share > 0.02) plantSmoke(s, plant, share);
    }
    const load = requests.reduce((sum, request) => sum + request.load, 0);
    const generated = renewable + thermal * share;
    // A delivered station can burn imported supplies while the colony builds its own grid.
    grid.stationGenerator = load > 0 ? Math.min(7.4 * clamp((supply - 4) / 10, 0, 1), Math.max(0, civilDemand + load - generated)) : 0;
    grid.output = generated + grid.stationGenerator;
    const floor = modern ? CITY_RESERVE : 8;
    const usable = Math.max(0, grid.output - civilDemand + Math.max(0, grid.reserve - floor) / STEP);
    grid.stationDraw = Math.min(load, usable);
    for (const station of s.stations) {
      station.pending = false;
      const request = requests.find(item => item.station === station);
      station.load = request?.load ?? 0;
      const paid = load > 0 ? grid.stationDraw * station.load / load : 0;
      const batteryDraw = Math.min(Math.max(0, station.load - paid), station.battery / STEP);
      station.battery -= batteryDraw * STEP;
      station.draw = paid + batteryDraw;
      station.fraction = station.load > 0 ? station.draw / station.load : 0;
    }
    const spare = Math.max(0, renewable - civilDemand - grid.stationDraw);
    const key = s.research.active;
    const ready = modern && supply >= 16 && grid.reserve >= CITY_RESERVE;
    const budget = ready ? STEP * Math.min(s.supported ? 1.2 : 0.68, spare * 0.72 / PROGRAM_ENERGY) : 0;
    let study = 0;
    if (key) {
      if (!researchBlock(s, population, key)) {
        study = Math.min(budget, RESEARCH[key].work - s.research.progress[key]);
        s.research.progress[key] += study;
        if (knows(s, key)) {
          s.research.active = null;
          report("Dokončen výzkum " + RESEARCH[key].name.toLowerCase() + ".", "good");
        }
      }
    } else if (!s.researchPolicy || s.researchPolicy.faith >= 10 && s.researchPolicy.spaceFunded && s.researchPolicy.spaceActive) {
      study = Math.min(PROBE_WORK - grid.work, budget);
      grid.work = Math.min(PROBE_WORK, grid.work + study);
    }
    grid.programDraw = study * PROGRAM_ENERGY / STEP;
    grid.demand = civilDemand + grid.programDraw + grid.stationDraw;
    grid.fuelUse = thermal * share * 0.14 + grid.stationGenerator * 0.13;
    const balance = grid.output - grid.demand;
    grid.reserve = clamp(grid.reserve + balance * STEP, 0, POWER_LIMIT);
    const short = grid.reserve < 0.1 && balance < -0.4 && grid.age > 10;
    grid.strain += ((short ? clamp(-balance / Math.max(1, grid.demand), 0, 1) : 0) - grid.strain) * 0.11;
    grid.deficient = clamp(grid.deficient + (grid.reserve < CITY_RESERVE && grid.output < civilDemand - 0.45 ? STEP : -STEP * 1.6), 0, 24);
    let fields = 0, smog = 0;
    for (const i of s.plots) {
      if (s.urban[i] !== 2 || !activeTown(s.towns[s.plotTown[i] - 1])) continue;
      fields++;
      smog += s.smog[i];
    }
    grid.pollution = fields ? smog / fields : towns.reduce((sum, town) => sum + s.smog[town.home], 0) / towns.length;
    const shortage = working.length >= 2 && grid.deficient >= 11 && thermal < civilDemand;
    const projectMargin = key && !researchBlock(s, population, key) ? 2.5 : 0;
    const needsPlants = working.length < 2 || shortage
      || grid.reserve < CITY_RESERVE + 18 && renewable < civilDemand * 0.90 + load
      || projectMargin > 0 && renewable < civilDemand + load + projectMargin;
    if (!needsPlants || working.length >= 8 || grid.plants.length >= 24 || grid.age < 6 || supply < 16 || s.time < grid.nextBuild) return;
    const kinds = shortage ? ["thermal"] : ["wind", "solar"];
    grid.nextBuild = s.time + (buildPowerPlant(s, kinds, irradiance, working, report) ? 19 : 7);
  }

  function townConnected(s, town) {
    return activeTown(town) && town.count >= 3 && s.damage[town.home] < 0.72 && buildable(s, town.home);
  }

  function tradeAllowed(s, a, b) {
    const from = s.towns[a], to = s.towns[b];
    return from.realm === to.realm || (!s.battle?.sides.includes(a + 1) && !s.battle?.sides.includes(b + 1)
      && Math.min(waterAccess(s, from.home), waterAccess(s, to.home)) >= 0.24);
  }

  function refreshLinks(s, report) {
    s.links = s.links.filter(link => activeTown(s.towns[link.a]) && activeTown(s.towns[link.b]));
    const sites = s.towns.map((town, index) => ({ town, index, p: position(town.home) })).filter(({ town }) => townConnected(s, town));
    const linked = new Set(s.links.flatMap(link => [link.a, link.b]));
    const route = (a, b) => {
      const start = s.towns[a].home;
      const steps = path(s, start, s.towns[b].home, true, s.towns[a]);
      return steps.length && steps.length <= 64 ? [start, ...steps.reverse()] : null;
    };
    for (const link of s.links) {
      if (!link.blocked || !townConnected(s, s.towns[link.a]) || !townConnected(s, s.towns[link.b])) continue;
      const road = route(link.a, link.b);
      if (!road) continue;
      Object.assign(link, { road, work: Math.min(link.work, road.length * 0.35), travel: 0, previous: 0, direction: 1, blocked: false });
      report("Města vytyčila objížďku kolem poškozené cesty.", "good");
    }
    for (const site of sites) {
      if (linked.has(site.index) || s.links.length >= 14) continue;
      const close = sites.filter(other => other !== site && sameGround(s, other.town.home, site.town.home, site.town)
        && distance(site.p, other.p) <= 34 && tradeAllowed(s, site.index, other.index))
        .sort((a, b) => distance(site.p, a.p) - distance(site.p, b.p));
      for (const other of close) {
        const road = route(site.index, other.index);
        if (!road) continue;
        s.links.push({ a: site.index, b: other.index, road, work: 1, travel: 0, previous: 0, direction: 1, blocked: false, open: false });
        linked.add(site.index);
        linked.add(other.index);
        report("Mezi dvěma osadami vzniká cesta.", "good");
        break;
      }
    }
    if (s.airLink && activeTown(s.towns[s.airLink.a]) && activeTown(s.towns[s.airLink.b])) return;
    s.airLink = null;
    if (!s.power.grids && (s.power.age < 42 || s.power.reserve < 16)) return;
    const cities = sites.filter(({ town }) => townEra(s, town) >= 6);
    for (const [i, from] of cities.entries()) {
      const grid = s.power.grids?.[from.town.civilization] ?? s.power; if (grid.age < 42 || grid.reserve < 16) continue;
      const to = cities.slice(i + 1).find(site => distance(from.p, site.p) >= 13 && tradeAllowed(s, from.index, site.index));
      if (!to) continue;
      s.airLink = { a: from.index, b: to.index, reverse: false, at: null, next: s.time + 3, duration: 0 };
      report("Dvě města otevírají leteckou linku.", "good");
      break;
    }
  }

  function moveTraffic(s) {
    s.trade = Math.max(0, s.trade - STEP * 0.030);
    for (const link of s.links) {
      const a = s.towns[link.a], b = s.towns[link.b];
      const end = link.road.length - 1;
      link.blocked = !townConnected(s, a) || !townConnected(s, b) || link.road.some(i => !buildable(s, i, a) || !buildable(s, i, b));
      const trading = !link.blocked && tradeAllowed(s, link.a, link.b);
      if (trading) link.work = Math.min(end, link.work + STEP * (settlementEra(s) >= 5 ? 1.2 : 0.8));
      link.open = trading && link.work >= end;
      link.motor = townEra(s, a) >= 6 && townEra(s, b) >= 6 && (s.power.grids?.[a.civilization] ?? s.power).strain < 0.6 && (s.power.grids?.[b.civilization] ?? s.power).strain < 0.6;
      link.previous = link.travel;
      if (!link.open) continue;
      link.travel = clamp(link.travel + link.direction * STEP * (link.motor ? 2.65 : 0.9), 0, end);
      if (link.travel === 0 || link.travel === end) {
        const origin = link.direction > 0 ? a : b;
        if (waterAccess(s, origin.home) >= 0.28) s.trade = Math.min(1, s.trade + (link.motor ? 0.35 : 0.20));
        link.direction *= -1;
      }
    }
    const flight = s.airLink;
    if (!flight) return;
    const a = s.towns[flight.a], b = s.towns[flight.b];
    const sourcePower = s.power.grids?.[(flight.reverse ? b : a).civilization] ?? s.power;
    if (flight.at !== null) {
      if (s.time < flight.at + flight.duration) return;
      if (townConnected(s, a) && townConnected(s, b)) s.trade = Math.min(1, s.trade + 0.32);
      flight.at = null;
      flight.next = s.time + 8;
      flight.reverse = !flight.reverse;
    } else if (s.time >= flight.next && sourcePower.reserve >= CITY_RESERVE + 4 && sourcePower.output >= sourcePower.demand && !s.storm && townConnected(s, a) && townConnected(s, b)
      && tradeAllowed(s, flight.a, flight.b)) {
      sourcePower.reserve -= 4;
      flight.at = s.time;
      flight.duration = 3.4 + distance(position(a.home), position(b.home)) / 6;
    }
  }

  function civicProjects(s, report) {
    for (const [index, town] of s.towns.entries()) {
      const power = s.power.grids?.[town.civilization] ?? s.power;
      if (!activeTown(town) || town.cold > 0.30 || !buildable(s, town.home)) continue;
      const era = townEra(s, town), id = index + 1;
      if (era >= 6 && power.age >= 8 && power.reserve >= CITY_RESERVE + 10 && town.factory < 0 && town.count >= 12
        && (!s.power.grids || power.supplies >= 8) && s.time >= (town.factoryRebuildAt ?? 0)) {
        const sites = s.plots.filter(i => s.plotTown[i] === id && s.urban[i] < 4 && !s.noBuild[i] && s.damage[i] < 0.22 && buildable(s, i));
        const tile = sites.find(i => s.urban[i] === 1) ?? sites[0];
        if (tile !== undefined) {
          power.reserve -= 10; if (s.power.grids) power.supplies -= 8;
          town.factory = tile;
          s.urban[tile] = 5;
          report((town.civilizationName ?? realmName(s, town.realm)) + " otevírá továrnu" + (s.power.grids ? " · 10 E + 8 M." : "."), "good");
        }
      }
      if (era < 5 || town.count < 8 || s.time - town.founded < 48 || s.monuments.some(m => m.town === id)) continue;
      const origin = position(town.home);
      let best = -1, rating = -Infinity;
      for (let y = -5; y <= 5; y++) {
        if (origin.y + y < 0 || origin.y + y >= H) continue;
        for (let x = -5; x <= 5; x++) {
          const gap = Math.hypot(x, y), i = at(origin.x + x, origin.y + y);
          if (gap < 2 || gap > 5 || s.urban[i] || s.noBuild[i] || worksiteReserved(s, i) || !buildable(s, i) || s.claims[i] !== id || s.monuments.some(m => m.tile === i)) continue;
          const score = hash(i, town.home, s.seed) + s.height[i] * 0.7 - gap * 0.09;
          if (score <= rating) continue;
          best = i;
          rating = score;
        }
      }
      if (best < 0) continue;
      s.monuments.push({ tile: best, town: id, realm: town.realm, work: 0, builtAt: null });
      report((town.civilizationName ?? realmName(s, town.realm)) + " pokládá základy monumentu.");
    }
  }

  function buildMonuments(s, report) {
    for (const monument of s.monuments) {
      const town = s.towns[monument.town - 1];
      if (monument.builtAt !== null || !town || !activeTown(town) || town.cold > 0.30
        || !buildable(s, monument.tile) || s.battle?.sides.includes(monument.town)) continue;
      monument.work += STEP;
      if (monument.work < MONUMENT_TIME) continue;
      monument.builtAt = s.time;
      report(realmName(s, monument.realm) + " dokončil kamenný monument.", "good");
    }
  }

  function startBattle(s, a, b, report, landing = null, shore = -1, directed = false) {
    if (!landing && !directed && !path(s, s.towns[a - 1].home, s.towns[b - 1].home, true).length) return;
    const units = [];
    for (const side of [a, b]) {
      const town = s.towns[side - 1], assault = landing && side === a;
      const home = position(assault ? shore : town.home);
      const count = assault ? landing.guards : (town.count >= 19 ? 3 : 2) + Math.min(6, Math.floor((town.guardCount ?? 0) / 2));
      for (let i = 0; i < count; i++) {
        const tank = !assault && i === 0 && workingFactory(s, town);
        const x = assault ? home.x + (i % 2 ? 0.22 : -0.22) : home.x + i * 0.22;
        units.push({ id: units.length, side, realm: town.realm, profile: town.profile ?? s.bioProfile, x: wrap(x), y: home.y + (i - 1) * (assault ? 0.15 : 0.18),
          hp: (tank ? 1.65 : 1) + (town.guardBonus ?? 0), tank, fireAt: s.time + 1 + i * 0.28 });
      }
    }
    s.battle = { sides: [a, b], units, shots: [], began: s.time, ...(directed ? { orderedAttacker: a } : {}) };
    if (landing) {
      s.battle.landing = landing.id;
      report("Námořní výsadek · Vylodění a boj · " + settlementLabel(s.towns[b - 1]) + ".", "warn");
      return;
    }
    const name = id => realmName(s, s.towns[id - 1].realm);
    report(directed ? "Pozemní výprava · " + settlementLabel(s.towns[a - 1]) + " → " + settlementLabel(s.towns[b - 1]) + "."
      : "Střet na hranici · " + name(a) + " a " + name(b) + ".", "warn");
  }

  function borderTension(s, report) {
    if (s.battle || s.time < s.battleAt) return;
    let candidate = null, priority = -Infinity;
    for (let i = 0; i < s.towns.length; i++) {
      const a = s.towns[i];
      if (!activeTown(a) || a.cold > 0.50 || !buildable(s, a.home)) continue;
      for (let j = i + 1; j < s.towns.length; j++) {
        const b = s.towns[j];
        if (!activeTown(b) || b.realm === a.realm || b.cold > 0.50 || !buildable(s, b.home, b) || !sameGround(s, b.home, a.home, a)) continue;
        const gap = distance(position(a.home), position(b.home));
        const friendship = s.diplomacy?.[[a.realm, b.realm].sort((x, y) => x - y).join(":")] ?? 0;
        if (friendship >= 60) continue;
        const reach = 11 + Math.min(7, Math.sqrt(a.count)) + Math.min(7, Math.sqrt(b.count));
        if (gap > reach) continue;
        const thirst = Math.max(0, 0.36 - Math.min(waterAccess(s, a.home), waterAccess(s, b.home)));
        const pressure = ((reach - gap) * 0.36 + thirst * 8) * (1 - friendship / 100);
        const same = s.border?.a === i + 1 && s.border?.b === j + 1;
        if (pressure < 0.65 || pressure + (same ? 0.4 : 0) <= priority) continue;
        priority = pressure + (same ? 0.4 : 0);
        candidate = { a: i + 1, b: j + 1, tension: (same ? s.border.tension : 0) + Math.min(4, pressure) };
      }
    }
    s.border = candidate;
    if (candidate?.tension >= 18) {
      startBattle(s, candidate.a, candidate.b, report);
      s.border = null;
      s.battleAt = s.time + 18;
    }
  }

  function finishLanding(s, battle, survivors, sides, report) {
    const boat = s.boats.find(boat => boat.id === battle.landing);
    if (!boat) return;
    const source = s.towns[boat.from], target = s.towns[boat.to];
    boat.guards = survivors.filter(unit => unit.side === boat.from + 1).length;
    if (sides.length === 1 && sides[0] === boat.from + 1 && hostileCoast(s, source, target)
      && source.civilization === boat.civilization && target.civilization === boat.targetCivilization) {
      report("Námořní výsadek · Převzetí správy · " + (target.settlementName ?? (boat.to + 1))
        + " · " + realmName(s, target.realm) + " → " + realmName(s, source.realm) + ".", "warn");
      target.realm = source.realm;
      target.civilization = null;
    } else {
      report("Námořní výsadek skončil bez převzetí osady.", "warn");
    }
    if (boat.guards > 0) {
      boat.fighting = false; boat.returning = true; boat.retryAt = 0;
    } else {
      s.boats = s.boats.filter(other => other !== boat);
      report("Námořní výsadek přišel o celou posádku.", "bad");
    }
  }

  function fight(s, report, state, world) {
    const battle = s.battle;
    if (!battle) return;
    if (battle.conflictKey && state && world) Warfare.tickBattle(s, battle);
    battle.shots = battle.shots.filter(shot => {
      if (s.time < shot.at + shot.duration) return true;
      const target = battle.units[shot.target];
      if (target.hp > 0 && distance(target, shot.to) < (shot.shell ? 1.45 : 0.95)) {
        target.hp -= shot.shell ? 0.64 : 0.33;
        battle.spark = { ...shot.to, at: s.time, shell: shot.shell };
        if (target.hp <= 0) s.warCasualties += target.tank ? 45 : settlementEra(s) >= 5 ? 18 : 6;
      }
      return false;
    });
    const survivors = battle.units.filter(unit => unit.hp > 0);
    const sides = battle.sides.filter(side => survivors.some(unit => unit.side === side));
    if ((sides.length < 2 && !battle.shots.length) || s.time - battle.began > 55) {
      if (battle.landing) finishLanding(s, battle, survivors, sides, report);
      else if (sides.length === 1) {
        const winner = s.towns[sides[0] - 1], defeated = s.towns[battle.sides.find(side => side !== sides[0]) - 1];
        if (activeTown(winner) && activeTown(defeated)) {
          const peaceful = battle.orderedAttacker !== sides[0]
            && s.communities?.find(c => c.id === winner.communityId)?.nature === "broker";
          if (peaceful) report(realmName(s, winner.realm) + " odrazil útok. Smíšená společnost cizí osady vojensky nepřebírá.", "good");
          else {
            defeated.realm = winner.realm;
            defeated.civilization = null;
            report(realmName(s, winner.realm) + " převzal správu sousední osady.", "warn");
          }
        }
      } else report("Střet skončil bez změny hranic.");
      s.battle = null;
      s.battleAt = s.time + 54;
      s.societyAt = s.time;
      return;
    }
    for (const unit of survivors) {
      unit.previousX = unit.x;
      unit.previousY = unit.y;
      let target, gap = Infinity;
      for (const enemy of survivors) {
        if (enemy.side === unit.side) continue;
        const range = distance(unit, enemy);
        if (range >= gap) continue;
        target = enemy;
        gap = range;
      }
      if (!target) continue;
      unit.direction = dx(unit.x, target.x) < 0 ? -1 : 1;
      if (gap > (unit.tank ? 4.6 : 2.8)) {
        travel(s, unit, target, unit.tank ? 0.38 : 0.33, true);
      } else if (s.time >= unit.fireAt) {
        if (state && world && battle.contactAt === undefined) Warfare.contact(state, world, battle);
        battle.shots.push({ from: { x: unit.x, y: unit.y }, to: { x: target.x, y: target.y }, target: target.id,
          at: s.time, duration: 0.36 + gap / (unit.tank ? 11 : 6), shell: unit.tank });
        unit.fireAt = s.time + (unit.tank ? 2.4 : 1.5 + unit.id * 0.13);
      }
    }
  }

  function societies(s, population, report, state, world) {
    moveExpeditions(s, report);
    moveBoats(s, report);
    moveTraffic(s);
    fight(s, report, state, world);
    buildMonuments(s, report);
    if (s.time < s.societyAt) return;
    s.societyAt = s.time + 2.5;
    refreshClaims(s, report);
    civicProjects(s, report);
    refreshLinks(s, report);
    let samples;
    const forecast = () => state && world?.orbit && typeof Evolution !== "undefined"
      ? (samples ??= seasonalTemperatures(s, Evolution.seasonalHeats(state, world))) : null;
    refreshMaritime(s, population, report, forecast);
    sendExpedition(s, population, report, forecast);
    borderTension(s, report);
  }

  function settlements(s, population, report) {
    if (population > 0 && s.time >= s.buildAt) {
      expandTowns(s, population);
      s.buildAt = s.time + 1.5;
    }
    const housing = new Map();
    for (const town of s.towns) town.cold += (chill(s, town.home) - town.cold) * 0.058;
    let flooded = 0, burned = 0, coldHomes = 0, molten = 0, ruins = 0, homes = 0, dry = 0, frost = 0, losses = 0;
    for (const i of s.plots) {
      if (s.towns[s.plotTown[i] - 1]?.abandoned) {
        if (s.urban[i] >= 3 && s.damage[i] >= 0.78) ruins++;
        continue;
      }
      const technical = s.urban[i] >= 5 || s.ports.some(port => port.land === i);
      const actor = plotActor(s, i), residential = s.urban[i] === 3 || s.urban[i] === 4;
      const water = floodDepth(s, i, actor);
      const warm = typeof Evolution !== "undefined" && Evolution.actorProfile(s, actor) === "warm";
      const failure = typeof Evolution !== "undefined" && Evolution.iceFailure(s, i, actor);
      const flood = clamp((water - (s.urban[i] === STATION_TILE ? 0.85 : warm && !technical ? 0.20 : 0.35)) / 0.65, 0, 1);
      const fire = s.fire[i];
      const lava = clamp(s.lava[i] / 0.45, 0, 1);
      const need = typeof Evolution !== "undefined" ? Evolution.waterNeed(s, actor) : 0.21;
      const drought = need > 0 ? clamp((need - waterAccess(s, i, actor)) / need, 0, 1) : 0;
      const cold = chill(s, i);
      const hot = clamp((actorTemperature(s, i, actor) - 0.82) / 0.24, 0, 1);
      if (population > 0 || s.robotBases?.length) {
        const freeze = technical ? 0 : Math.max(0, cold - 0.35) * (s.urban[i] === 2 ? 0.24 : 0.045);
        const dry = technical ? 0 : Math.max(0, drought - 0.76) * (s.urban[i] === 2 ? 0.22 : 0.085);
        const damp = !technical && warm ? (1 - Evolution.wetTolerance(s, i, actor)) * (s.urban[i] === 2 ? 0.08 : 0.035) : 0;
        const heat = residential ? Math.max(0, hot - 0.30) * 0.043 : 0;
        const causes = [flood * (technical ? 0.16 : 0.30), fire * 0.54, lava * 0.78, freeze, dry, 0, 0, failure ? 0.24 : 0, damp, 0, 0, heat];
        const strain = causes.reduce((sum, amount) => sum + amount, 0);
        const nearbyFire = s.neighbors.some(neighbor => s.fire[neighbor[i]] > 0.13);
        let repair = technical || flood > 0 || failure || damp > 0 || fire > 0.08 || nearbyFire
          || s.burnScar[i] > 0.50 || lava > 0 || drought > 0.58 || cold > 0.30 || hot > 0.30 ? 0 : 0.022;
        if (residential && repair > 0 && s.damage[i] > 0) {
          const grid = s.power.grids?.[actor.civilization];
          if (grid) {
            const repairable = Math.min(s.damage[i], repair * STEP);
            const funded = Math.min(repairable * 1.5, grid.supplies);
            grid.supplies -= funded;
            repair = repair * 0.25 + 0.75 * funded / (1.5 * STEP);
          }
        }
        if (strain > 0 && s.damage[i] < 0.78) s.damageCause[i] = failure ? 8 : causes.indexOf(Math.max(...causes)) + 1;
        s.damage[i] = clamp(s.damage[i] + (strain - repair) * STEP, 0, 1);
        reportCondition(s, i, report);
      }
      if (!residential) continue;
      if (s.plotTown[i]) {
        const row = housing.get(actor) ?? { total: 0, count: 0 };
        row.total += 1 - s.damage[i];
        row.count++;
        housing.set(actor, row);
      }
      homes++;
      if (flood > 0.04) flooded++;
      if (fire > 0.12) burned++;
      if (s.lava[i] >= MOLTEN) molten++;
      if (cold > 0.35) coldHomes++;
      if (s.damage[i] >= 0.78) ruins++;
      dry += drought;
      frost += cold;
      losses += flood * 0.24 + (failure ? 0.10 : 0) + fire * 0.32 + lava * 0.40;
    }
    if (population > 0) for (const i of new Set([...s.ports.map(port => port.land), ...s.monuments.map(m => m.tile)])) {
      if (s.urban[i]) continue;
      const harm = [clamp((floodDepth(s, i) - 0.50) / 0.65, 0, 1) * 0.16, s.fire[i] * 0.54, clamp(s.lava[i] / 0.45, 0, 1) * 0.78, 0, 0, 0, 0,
        typeof Evolution !== "undefined" && Evolution.iceFailure(s, i, plotActor(s, i)) ? 0.24 : 0];
      const worst = Math.max(...harm);
      if (worst > 0 && s.damage[i] < 0.78) s.damageCause[i] = harm[7] ? 8 : harm.indexOf(worst) + 1;
      s.damage[i] = clamp(s.damage[i] + harm.reduce((sum, n) => sum + n, 0) * STEP, 0, 1);
      reportCondition(s, i, report);
    }
    for (const town of s.towns) {
      const row = housing.get(town);
      const center = 1 - s.damage[town.home];
      town.housingCondition = row ? (center + row.total / row.count) * 0.5 : center;
    }
    s.floodPlots = flooded;
    s.burnedPlots = burned;
    s.lavaPlots = molten;
    s.coldPlots = coldHomes;
    s.ruins = ruins;
    const exposed = population > 0 && homes > 0;
    const targetDry = exposed ? (dry / homes) * (s.colony >= 0 ? 0.74 : 1) : 0;
    s.dryStress += (targetDry - s.dryStress) * 0.085;
    s.frostStress += ((exposed ? frost / homes : 0) - s.frostStress) * 0.065;
    s.disasterRate = exposed ? losses / homes + Math.max(0, s.dryStress - 0.72) * 0.11 + Math.max(0, s.frostStress - 0.28) * 0.09 : 0;
    const alert = !exposed ? "" : molten ? "lava" : flooded ? "flood" : burned ? "fire" : coldHomes ? "cold" : s.dryStress > 0.6 ? "dry" : "";
    if (alert !== s.urbanAlert && alert) {
      report(alert === "lava" ? "Láva zasáhla zástavbu." : alert === "flood" ? "Voda zaplavila zástavbu." : alert === "fire" ? "Oheň se rozšířil do zástavby."
        : alert === "cold" ? "Kvůli mrazu zůstávají lidé v úkrytech." : "Dlouhé sucho ohrožuje osídlení.", "bad");
    }
    s.urbanAlert = alert;
  }

  function step(s, { heat, inZone, colony, supply, population = 0, irradiance = 1, state = null, world = null,
    orbitalExposure = Math.max(0, Math.abs(heat - 0.53) - 0.29) }, report) {
    const detailed = typeof PerformanceHUD !== "undefined" && PerformanceHUD.active;
    let phaseAt = detailed ? performance.now() : 0;
    s.time += STEP;
    s.warCasualties = 0;
    if (colony && (s.colony < 0 || s.ocean[s.colony] && s.damage[s.colony] >= 0.78)) s.colony = s.coast;
    if (colony && s.colonizedAt === null) s.colonizedAt = s.time;
    for (const station of s.stations) {
      if (station.tile >= 0 && s.damage[station.tile] >= 0.78) station.destroyed = true;
    }
    const engineering = s.legacyClimate;
    const base = orbitalBase(s, heat) - s.impactDust;
    s.impactDust = Math.max(0, s.impactDust - STEP * 0.009);
    s.orbitalStress = clamp((orbitalExposure - ATMOSPHERE_LIMIT * engineering) / 0.48, 0, 1);
    const speciesBase = typeof Evolution !== "undefined" ? Evolution.climateIndex(base, s.bioProfile) : base;
    const season = inZone || speciesBase >= 0.24 && speciesBase <= 0.82 || (engineering >= 0.58 && speciesBase >= 0.22 && speciesBase <= 0.84);
    reconcileInfrastructure(s);
    const requests = population > 0 || s.robotBases?.length ? stationRequests(s) : [];
    const surfaceReport = (message, tone) => report(message, tone, "surface");
    const civicReport = (message, tone) => report(message, tone, "civic");
    weather(s, base, surfaceReport, requests);
    microbialLife(s);
    if (detailed) { PerformanceHUD.mark("bioWeather", performance.now() - phaseAt); phaseAt = performance.now(); }
    const home = s.colony;
    const protectedSite = i => i >= 0 && s.climateSupport[i] === 1;
    s.shelter = colony && protectedSite(home) ? clamp(waterAccess(s, home) * 3.6, 0, 1) : 0;
    const towns = s.towns.filter(activeTown);
    s.townShelter = towns.length ? towns.reduce((sum, town) => sum + (protectedSite(town.home)
      ? clamp(waterAccess(s, town.home) * 3.6, 0, 1) : 0), 0) / towns.length : 0;
    const food = s.tribes.length ? s.tribes.reduce((sum, t) => sum + t.food, 0) / s.tribes.length : 0.7;
    const temperate = season || s.shelter >= 0.28;
    s.supported = temperate && s.habitat >= 0.19 && (food > 0.10 || engineering >= 0.83);
    const wildlifePhase = s.era === 3;
    const nativeConditions = temperate && s.habitat > 0.13;
    const wildlifePace = wildlifePhase ? 0.22 * faunaReadiness(s) : 1;
    if (wildlifePhase) s.tribalClimateReady = nativeConditions;
    // Evolved herds can mature in local refuges outside the native settlement climate.
    const canDevelop = wildlifePhase ? wildlifePace > 0 : nativeConditions;
    s.evolutionAdvancing = canDevelop && (s.era < 1 || s.era >= 3 || s.microbialSites > 0);
    if (s.era === 0 && s.lifeRecovery === "waiting") {
      recoverMicrobes(s, surfaceReport);
      s.evolutionAdvancing = s.microbialSites > 0 || s.era > 0;
    }
    else if (s.evolutionAdvancing && (s.era < 4 || population > 0)) {
      const acceleration = s.evolutionMode === "accelerated" ? s.era < 3 ? 5 : wildlifePhase ? 1.5 : s.era === 4 ? 2 : 1.25 : 1;
      // The historical calendar dates events. Each planet advances from its own simulation steps.
      const pace = (s.era >= 4 ? 0.46 : wildlifePhase ? 0.82 : 1)
        * (s.era >= 3 ? 0.45 : 0.55) * acceleration * wildlifePace;
      const limit = nativeConditions ? milestones.at(-1) : milestones[4];
      s.progress = Math.min(limit, s.progress + STEP * pace * (0.50 + s.habitat * 0.75) * (0.69 + food * 0.52));
      if (nativeConditions && s.era + 1 < eras.length && s.progress >= milestones[s.era + 1]) {
        s.era++;
        (s.era >= 4 ? civicReport : surfaceReport)(milestonesText[s.era], "good");
      }
    } else if (!temperate && s.era < 3) {
      s.progress = Math.max(milestones[s.era], s.progress - STEP * 0.17);
    }
    s.stress = temperate || s.habitat >= 0.08 ? 0 : s.stress + STEP;
    if (detailed) { PerformanceHUD.mark("bioConditions", performance.now() - phaseAt); phaseAt = performance.now(); }
    vegetation(s, s.era >= 2 && (temperate || base > 0.16 && base < 0.92) || engineering >= 0.36 || s.shelter >= 0.28, surfaceReport);
    biosphereCrisis(s, population, surfaceReport);
    if (detailed) { PerformanceHUD.mark("bioVegetation", performance.now() - phaseAt); phaseAt = performance.now(); }
    wildlife(s, civicReport, state, world);
    if (detailed) { PerformanceHUD.mark("bioWildlife", performance.now() - phaseAt); phaseAt = performance.now(); }
    settlements(s, population, surfaceReport);
    if (detailed) { PerformanceHUD.mark("bioSettlementGrowth", performance.now() - phaseAt); phaseAt = performance.now(); }
    if (population > 0 || s.robotBases?.length) {
      if (state && world && typeof Evolution !== "undefined") Evolution.powerStep(state, world, population, irradiance, requests, civicReport);
      else updatePower(s, population, supply, irradiance, requests, civicReport);
    }
    if (detailed) { PerformanceHUD.mark("bioEnergy", performance.now() - phaseAt); phaseAt = performance.now(); }
    if (population > 0) {
      dailyLife(s);
      societies(s, population, civicReport, state, world);
    }
    if (detailed) PerformanceHUD.mark("bioSocieties", performance.now() - phaseAt);
  }

  const legacyPoint = ({ x, y }) => ({ x: x * W / OLD_W, y: y * H / OLD_H });

  function restoreMaritime(s) {
    const tileOK = i => Number.isInteger(i) && i >= 0 && i < SIZE;
    const townOK = i => Number.isInteger(i) && i >= 0 && i < s.towns.length;
    const dockOK = (p, town) => p?.town === town && tileOK(p.land) && tileOK(p.water)
      && s.neighbors.some(list => list[p.land] === p.water);
    s.landform = LANDFORMS.includes(s.landform) ? s.landform : "Původní povrch";
    s.ports = Array.isArray(s.ports) ? s.ports.filter(p => (townOK(p?.town) || p?.town === -1) && tileOK(p.land) && tileOK(p.water)
      && s.neighbors.some(list => list[p.land] === p.water)).map(p => ({ ...p, open: false })) : [];
    s.boats = Array.isArray(s.boats) ? [...new Map(s.boats.filter(b => b && Number.isInteger(b.id) && b.id > 0
      && townOK(b.from) && ["settle", "ferry", "return", "landing"].includes(b.kind)
      && (b.kind === "settle" ? tileOK(b.site) : townOK(b.to))
      && (b.kind !== "landing" || Number.isInteger(b.guards) && b.guards >= 1 && b.guards <= 4
        && Number.isInteger(b.civilization) && b.civilization > 0 && Number.isInteger(b.targetCivilization) && b.targetCivilization > 0)
      && Number.isFinite(b.x) && b.x >= 0 && b.x < W && Number.isFinite(b.y) && b.y >= 0 && b.y < H
      && tileOK(b.goal) && Array.isArray(b.route) && b.route.length <= SIZE && b.route.every(tileOK))
      .map(b => [b.id, { ...b, realm: Number.isInteger(b.realm) && REALMS[b.realm] ? b.realm : s.towns[b.from].realm,
        launchPort: dockOK(b.launchPort, b.from) ? { ...b.launchPort, open: true } : undefined,
        landingPort: dockOK(b.landingPort, b.to) ? { ...b.landingPort, open: true } : undefined,
        era: clamp(Math.floor(b.era || 4), 4, 6),
        previousX: b.x, previousY: b.y, heading: Number.isFinite(b.heading) ? b.heading : 0,
        stuck: Number.isFinite(b.stuck) ? Math.max(0, b.stuck) : 0, retryAt: 0, blocked: false }])).values()].slice(0, MAX_BOATS) : [];
    s.seaLinks = Array.isArray(s.seaLinks) ? s.seaLinks.filter(p => townOK(p?.a) && townOK(p.b) && p.a !== p.b)
      .slice(0, 14).map(p => ({ ...p, next: s.time + 2, reverse: p.reverse === true })) : [];
    s.nextSeaId = Math.max(1, ...s.boats.map(b => b.id + 1));
    s.seaAt = s.time;
    s.navalRecruit = -1;
    for (const town of s.towns) if (!Number.isFinite(town.nextSail)) town.nextSail = s.time + 3;
  }

  function loadSurface(saved, population) {
    saved.nativeFoundersVersion = [2, 3].includes(saved.nativeFoundersVersion) ? saved.nativeFoundersVersion : 1;
    if(saved.tribes?.length||saved.towns?.length)saved.nativeFoundersInitialized=true;
    const fields = ["height", "water", "ice", "air", "soil", "plants", "fire", "heat", "temperature", "windX", "windY", "wet"];
    const length = saved.water?.length;
    const legacy = length === OLD_W * OLD_H;
    const complete = keys => keys.every(key => ArrayBuffer.isView(saved[key]) && saved[key].length === length);
    if ((!legacy && length !== SIZE) || !complete(fields)) throw new Error("Neúplná mapa biosféry.");
    if (!legacy) {
      if (!complete(["east", "west", "north", "south", "polar", "level", "downstream", "urban", "damage"])) {
        throw new Error("V mapě chybí data terénu nebo zástavby.");
      }
      saved.neighbors = [saved.east, saved.west, saved.north, saved.south];
      for(let i=0;i<SIZE;i++) saved.shade[i]=(((Math.floor(i/W)+.5-H/2)/(H/2))**2)*.55;
      if (!(saved.ancientRuins instanceof Uint8Array) || saved.ancientRuins.length !== SIZE) delete saved.ancientRuins;
      if (!ArrayBuffer.isView(saved.marineFood) || saved.marineFood.length !== SIZE) saved.marineFood = layer();
      if (!ArrayBuffer.isView(saved.burnScar) || saved.burnScar.length !== SIZE) saved.burnScar = layer();
      const validTile = i => Number.isInteger(i) && i >= 0 && i < SIZE;
      saved.plots = [...new Set(saved.plots.filter(validTile))];
      saved.climateSupport = new Uint8Array(SIZE);
      
      const research = saved.research;
      saved.research = emptyResearch();
      for (const [key, spec] of Object.entries(RESEARCH)) {
        const progress = research?.progress?.[key];
        if (Number.isFinite(progress)) saved.research.progress[key] = clamp(progress, 0, spec.work);
      }
      if (Object.hasOwn(RESEARCH, research?.active) && !knows(saved, research.active))
        saved.research.active = research.active;
      for (const field of ["noBuild", "damageCause", "damageNotice"]) {
        if (!(saved[field] instanceof Uint8Array) || saved[field].length !== SIZE) saved[field] = new Uint8Array(SIZE);
      }
      saved.legacyClimate = Math.max(Number.isFinite(saved.legacyClimate) ? clamp(saved.legacyClimate, 0, 1) : 0,
        Number.isFinite(saved.terraformed) ? clamp(saved.terraformed, 0, 1) : 0);
      const stations = [...(Array.isArray(saved.stations) ? saved.stations : []), ...(saved.station ? [saved.station] : [])];
      const nextStationId = Number.isInteger(saved.nextStationId) && saved.nextStationId > 0 ? saved.nextStationId : 1;
      saved.stations = []; saved.nextStationId = nextStationId;
      for (const old of stations) {
        if (old?.tile !== -1 && (!validTile(old?.tile) || saved.urban[old.tile] !== STATION_TILE)) continue;
        if (old.tile >= 0 && saved.stations.some(station => station.tile === old.tile)) continue;
        const station = { ...stationKit(), id: Number.isInteger(old.id) && old.id > 0 ? old.id : saved.nextStationId++ };
        if (saved.stations.some(item => item.id === station.id)) station.id = Math.max(saved.nextStationId, ...saved.stations.map(item => item.id + 1));
        if (Number.isInteger(old.civilization) && old.civilization > 0) station.civilization = old.civilization;
        if (["cold", "warm", "temperate"].includes(old.profile)) station.profile = old.profile;
        if (Number.isFinite(old.targetTemperature)) station.targetTemperature = clamp(old.targetTemperature, -0.5, 1.5);
        station.tile = old.tile; station.destroyed = old.tile >= 0 && saved.damage[old.tile] >= 0.78;
        station.mode = old.mode === "atmosphere" ? (saved.temperature[old.tile] > 0.60 ? "cool" : "heat")
          : Object.hasOwn(STATION_MODES, old.mode) ? old.mode : "off";
        station.pending = old.pending === true || old.mode === "atmosphere";
        if (Number.isFinite(old.battery)) station.battery = clamp(old.battery, 0, STATION_BATTERY);
        if (!station.destroyed && Number.isFinite(old.load) && Number.isFinite(old.draw)) {
          station.load = clamp(old.load, 0, 20); station.draw = clamp(old.draw, 0, station.load);
          station.fraction = station.load > 0 ? station.draw / station.load : 0;
        }
        saved.stations.push(station);
        saved.nextStationId = Math.max(saved.nextStationId, station.id + 1);
      }
      for (const i of saved.plots) if (saved.urban[i] === STATION_TILE && !saved.stations.some(station => station.tile === i)) {
        saved.stations.push({ ...stationKit(), id: saved.nextStationId++, tile: i, destroyed: saved.damage[i] >= 0.78 });
      }
      delete saved.station; delete saved.terraformed;
      saved.shelter = Number.isFinite(saved.shelter) ? clamp(saved.shelter, 0, 1) : 0;
      saved.townShelter = Number.isFinite(saved.townShelter) ? clamp(saved.townShelter, 0, 1) : 0;
      saved.climateCoverage = Number.isFinite(saved.climateCoverage) ? clamp(saved.climateCoverage, 0, 1) : 0;
      saved.springs = Array.isArray(saved.springs)
        ? [...new Set(saved.springs.filter(validTile))] : [];
      saved.volcanoes = Array.isArray(saved.volcanoes) ? [...new Map(saved.volcanoes
        .filter(vent => validTile(vent?.tile) && Number.isFinite(vent.burstAt)).map(vent => [vent.tile, vent])).values()] : [];
      saved.embers = Array.isArray(saved.embers) ? saved.embers.filter(ember => validTile(ember?.from) && validTile(ember.target)
        && Number.isFinite(ember.at) && Number.isFinite(ember.duration) && ember.duration > 0) : [];
      if (!(saved.lava instanceof Float32Array) || saved.lava.length !== SIZE) saved.lava = layer();
      if (!(saved.basalt instanceof Uint8Array) || saved.basalt.length !== SIZE) saved.basalt = new Uint8Array(SIZE);
      if (!(saved.crater instanceof Uint8Array) || saved.crater.length !== SIZE) saved.crater = new Uint8Array(SIZE);
      if (!(saved.smog instanceof Float32Array) || saved.smog.length !== SIZE) saved.smog = layer();
      saved.impactDust = Number.isFinite(saved.impactDust) ? clamp(saved.impactDust, 0, 0.30) : 0;
      const impact = saved.lastImpact;
      if (!validTile(impact?.tile) || ![4, 7, 8, ...Object.values(VISITOR_IMPACT_RADIUS)].includes(impact.radius)
        || !Number.isFinite(impact.time)) saved.lastImpact = null;
      saved.lavaArea = saved.lava.reduce((count, amount) => count + Number(amount > 0), 0);
      saved.lavaPlots ??= 0;
      delete saved.rechargeClock;
      delete saved.rechargeRain;
      saved.rain = layer();
      updateCloudRain(saved);
      saved.orbitalStress ??= 0;
      const upgrade = !complete(["plotTown", "claims"]);
      if (upgrade) {
        saved.plotTown = new Uint8Array(SIZE);
        saved.claims = new Uint8Array(SIZE);
      }
      saved.expeditions ??= [];
      saved.monuments ??= [];
      saved.border ??= null;
      saved.battle ??= null;
      saved.battleAt ??= 0;
      saved.societyAt ??= saved.time;
      saved.dominant ??= 0;
      saved.warCasualties ??= 0;
      saved.coldPlots ??= 0;
      saved.frostStress ??= 0;
      saved.colonizedAt = Number.isFinite(saved.colonizedAt) ? saved.colonizedAt
        : saved.colony >= 0 ? saved.time - saved.legacyClimate * 60 : null;
      const defaults = emptyPower(), power = saved.power;
      saved.power = { ...defaults };
      for (const key of Object.keys(defaults)) {
        if (Number.isFinite(power?.[key])) saved.power[key] = Math.max(0, power[key]);
      }
      saved.power.reserve = Math.min(saved.power.reserve, POWER_LIMIT);
      saved.power.work = Math.min(saved.power.work, PROBE_WORK);
      saved.power.strain = Math.min(saved.power.strain, 1);
      saved.power.linked = power?.linked === true;
      saved.power.plants = Array.isArray(power?.plants) ? [...new Map(power.plants.filter(p => validTile(p?.tile)
        && Object.hasOwn(POWER_TILES, p.kind) && saved.urban[p.tile] === POWER_TILES[p.kind] && (saved.towns[p.town - 1] || p.robot))
        .map(p => [p.tile, { ...p, output: Number.isFinite(p.output) ? Math.max(0, p.output) : 0 }])).values()] : [];
      if (power?.grids && typeof power.grids === "object") {
        saved.power.grids = power.grids; saved.power.economiesVersion = power.economiesVersion; saved.power.viewOwner = power.viewOwner;
        for (const grid of Object.values(saved.power.grids)) {
          for (const key of ["reserve", "supplies", "work", "output", "demand", "age", "strain"]) grid[key] = Number.isFinite(grid[key]) ? Math.max(0, grid[key]) : 0;
          grid.reserve = Math.min(POWER_LIMIT, grid.reserve); grid.supplies = Math.min(100, grid.supplies); grid.work = Math.min(PROBE_WORK, grid.work);
          grid.program ??= { funded: false, active: false };
        }
      }
      const validPair = p => p && Number.isInteger(p.a) && Number.isInteger(p.b) && p.a !== p.b && saved.towns[p.a] && saved.towns[p.b];
      saved.links = Array.isArray(saved.links) ? saved.links.filter(p => validPair(p) && Array.isArray(p.road)
        && p.road.length >= 2 && p.road.every(validTile) && [p.work, p.travel, p.previous].every(Number.isFinite)
        && (p.direction === 1 || p.direction === -1)).map(p => {
        const end = p.road.length - 1;
        return { ...p, work: clamp(p.work, 0, end), travel: clamp(p.travel, 0, end), previous: clamp(p.previous, 0, end) };
      }) : [];
      const air = saved.airLink;
      if (!validPair(air) || !Number.isFinite(air.next) || (air.at !== null && (!Number.isFinite(air.at) || !(air.duration > 0)))) saved.airLink = null;
      saved.trade = Number.isFinite(saved.trade) ? clamp(saved.trade, 0, 1) : 0;
      if (upgrade) {
        const seeds = saved.tribes.map((tribe, index) => ({ home: tribe.home, realm: tribe.realm ?? index + 1 }));
        if (saved.colony >= 0) seeds.push({ home: saved.colony, realm: 3 });
        const closest = (i, sites) => {
          const p = position(i);
          let best = -1, gap = Infinity;
          for (const [index, site] of sites.entries()) {
            const d = distance(p, position(site.home));
            if (d < gap) { best = index; gap = d; }
          }
          return best;
        };
        for (const town of saved.towns) Object.assign(town, {
          realm: seeds[closest(town.home, seeds)]?.realm ?? 1, founded: Math.max(0, saved.time - 110),
          nextJourney: saved.time + 6, cold: 0, factory: -1, abandoned: population <= 0
        });
        for (const i of saved.plots) saved.plotTown[i] = closest(i, saved.towns) + 1;
        refreshClaims(saved, () => {});
      }
      restoreMaritime(saved);
      return saved;
    }

    const s = create(saved.seed);
    s.nativeFoundersVersion=1;s.nativeFoundersInitialized=Boolean(saved.tribes?.length||saved.towns?.length);
    s.landform = "Původní povrch";
    for (const key of ["time", "progress", "era", "terraformed", "supported", "habitat", "nextChoice", "nextStrike",
      "cloudCheckAt", "naturalCloudAt", "storm", "fires", "moisture", "green", "relation", "stress"]) s[key] = saved[key];
    s.legacyClimate = Number.isFinite(saved.legacyClimate ?? saved.terraformed) ? clamp(saved.legacyClimate ?? saved.terraformed, 0, 1) : 0;
    delete s.terraformed;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = tile(x, y);
        const j = Math.floor(x * OLD_W / W) + Math.floor(y * OLD_H / H) * OLD_W;
        for (const field of fields) s[field][i] = saved[field][j];
        if (ArrayBuffer.isView(saved.burnScar)) s.burnScar[i] = saved.burnScar[j] || 0;
        if (saved.ocean[j]) {
          const scale = Math.max(0, SEA_LEVEL - s.height[i]) / DEPTH_UNIT / (5 + Math.max(0, 0.43 - s.height[i]) * 4);
          s.water[i] *= scale;
          s.ice[i] *= scale;
        }
        if (s.polar[i]) {
          s.ice[i] = Math.max(0.85, s.ice[i] + s.water[i]);
          s.water[i] = 0;
        }
      }
    }
    classifyGround(s);
    rebuildRegions(s);
    const index = i => i < 0 ? -1 : at((i % OLD_W + 0.5) * W / OLD_W, (Math.floor(i / OLD_W) + 0.5) * H / OLD_H);
    const nearbyLand = i => buildable(s, i) ? i
      : findSite(s, null, (j, p) => buildable(s, j) ? -distance(position(i), p) : -Infinity);
    const actor = a => {
      let here = legacyPoint(a);
      const i = at(here.x, here.y);
      if (s.ocean[i]) {
        const land = nearbyLand(i);
        if (land >= 0) here = position(land);
      }
      const goal = a.goal && legacyPoint(a.goal);
      return { ...a, ...here, destination: -1, route: [], goal: goal && (s.ocean[at(goal.x, goal.y)] ? here : goal) };
    };
    s.herds = saved.herds.map(actor);
    s.packs = saved.packs.map(actor);
    s.tribes = saved.tribes.map(t => ({ ...actor(t), home: nearbyLand(index(t.home)), hunter: t.hunter && actor(t.hunter) }));
    s.clouds = saved.clouds.map(c => ({ ...c, ...legacyPoint(c), previousX: c.previousX * W / OLD_W, previousY: c.previousY * H / OLD_H }));
    updateCloudRain(s);
    s.lightning = saved.lightning && { ...saved.lightning, tile: index(saved.lightning.tile) };
    s.colony = saved.colony >= 0 ? nearbyLand(index(saved.colony)) : -1;
    s.colonizedAt = s.colony >= 0 ? s.time - s.legacyClimate * 60 : null;
    if (population > 0) expandTowns(s, population, true);
    return s;
  }

  return { contaminated, settlementSafety, damageCause: (s, tile) => DAMAGE_CAUSES[s.damageCause[tile]] || "", W, H, STEP, POWER_LIMIT, CITY_RESERVE, PROBE_ENERGY, PROBE_MIN_RESERVE, PROBE_CARGO, SATELLITE_WORK, PROBE_WORK,
    ENERGY_STAGES, energyStage, BRUSH_RADII, WIND_REACH, TERRAIN_RADIUS, FREEZE_AT, SUMMIT_START,
    RESEARCH, knows, researchBlock, receivePlans, STATION_TILE, STATION_REACH, STATION_MODES, STATION_BATTERY,
    stationKit, receiveStation, placedStations, buildStation, stationBuildBlock, installStation, setStationMode, stationFault, installHydro, commissionPlant, hydroPotential, hydroDrop, HYDRO_SUPPLY, HYDRO_ENERGY,
    MAX_STATIONS, STATION_ENERGY, STATION_SUPPLY, STATION_THERMAL_DRAW, researchWait, buildings, surfaceInstallations, repairQuote, repairBuilding, demolishBuilding, DAMAGE_CAUSES,
    eras, refugeText, rebirthText, beginLifeRecovery, faunaReadiness, tribalProgress, FAUNA, biomeAt, animalComfort, animalHabitat, animalFood, faunaSummary, create, step, gust, temper, sculpt, toggleSpring, toggleVolcano, meteorImpact, loseSettlement, settlementEra, townEra, workingFactory,
    REALMS, MONUMENT_TIME, LANDFORMS, MAX_BOATS, seaOpen, seaPath, loadSurface, legacyPoint, cloudRadius, hash, position,
    powerPotential, initializeClimate, reservePlot, worksiteReserved, reconcileInfrastructure, infrastructureTown, stationRequests, waterClimate, seasonalTemperatures,
    clampValue: clamp, walk: travel, walkPath: path, canBuild: buildable, armyReadiness, directArmy };
})();
