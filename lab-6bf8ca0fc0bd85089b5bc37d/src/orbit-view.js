"use strict";

const Art = (() => {
  const { TAU, MU, SUN, INNER, OUTER, EXIT, GUIDE, IMPULSE, ENCOUNTER_PULL, mutualPull, clamp } = Orbit;
  const MINT = "#85f0d2";
  const LIME = "#b9ec89";
  const AMBER = "#ffc080";
  const RED = "#ff8f98";
  const ROCKS = [
    ["#152945", "#3e5578", "#7487a8", "#abc0db"],
    ["#2a244b", "#51467b", "#8b75b5", "#c1acd9"],
    ["#253d37", "#425f55", "#789e87", "#afc4a1"],
    ["#542738", "#844452", "#b26b62", "#f9ac86"],
    ["#3a2b36", "#665069", "#a28a9c", "#ddbcc0"],
    ["#343541", "#5f657b", "#9695ae", "#c7c9de"]
  ];
  const WATER = ["#183352", "#275682", "#4a91b2", "#87cbd3"];
  const LAND = ["#254341", "#35755b", "#70a96e", "#b7d88a"];
  const MICROBE = ["#22413e", "#3e675f", "#6faaa1", "#a9d7ad"];
  const SUN_COLORS = ["#813c47", "#b45246", "#db714a", "#ff9f55", "#ffd07c", "#ffed9b", "#fff6c6"];

  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  function random(seed) {
    return () => {
      let bits = seed += 0x6D2B79F5;
      bits = Math.imul(bits ^ bits >>> 15, bits | 1);
      bits ^= bits + Math.imul(bits ^ bits >>> 7, bits | 61);
      return ((bits ^ bits >>> 14) >>> 0) / 4294967296;
    };
  }

  function hash(x, y, seed) {
    let bits = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653);
    bits = Math.imul(bits ^ bits >>> 13, 1274126177);
    return ((bits ^ bits >>> 16) >>> 0) / 4294967296;
  }

  function noise(x, y, seed) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy, seed) * (1 - sx) + hash(ix + 1, iy, seed) * sx;
    const b = hash(ix, iy + 1, seed) * (1 - sx) + hash(ix + 1, iy + 1, seed) * sx;
    return a * (1 - sy) + b * sy;
  }

  function surface(width, height = width) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function raster(width, height, pixel) {
    const canvas = surface(width, height);
    const ctx = canvas.getContext("2d");
    const data = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = pixel(x, y);
        if (!c) continue;
        const i = (y * width + x) * 4;
        data.data.set(c, i);
        data.data[i + 3] = c[3] ?? 255;
      }
    }
    ctx.putImageData(data, 0, 0);
    return canvas;
  }

  function skyArt() {
    const width = 448;
    const height = 292;
    const canvas = raster(width, height, (x, y) => {
      const u = x / width;
      const v = y / height;
      const cloud = noise(x / 68, y / 42, 106) * 0.62 + noise(x / 21, y / 18, 107) * 0.38;
      const curve = v - (0.83 - u * 0.55 + Math.sin(u * 6) * 0.055);
      const dust = Math.max(0, 1 - Math.abs(curve) * 4.2) * Math.pow(cloud, 1.45);
      const haze = (1 - u * 0.58) * (1 - v * 0.35) * cloud;
      return [6 + dust * 18 + haze * 9, 11 + dust * 13 + haze * 13, 23 + dust * 28 + haze * 21];
    });
    const ctx = canvas.getContext("2d");
    const rng = random(4837);
    const stars = ["#2b405f", "#3f5273", "#496680", "#42516d", "#685f82", "#7791a8"];
    for (let i = 0; i < 455; i++) {
      ctx.fillStyle = stars[Math.floor(rng() * stars.length)];
      ctx.globalAlpha = 0.25 + rng() * 0.6;
      ctx.fillRect(Math.floor(rng() * width), Math.floor(rng() * height), 1, 1);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 31; i++) {
      const x = 7 + Math.floor(rng() * (width - 14));
      const y = 7 + Math.floor(rng() * (height - 14));
      ctx.fillStyle = i % 4 === 0 ? "#5d536e" : "#365571";
      ctx.fillRect(x - 2, y, 5, 1);
      ctx.fillRect(x, y - 2, 1, 5);
      ctx.fillStyle = i % 4 === 0 ? "#ccb99c" : "#98b8c7";
      ctx.fillRect(x, y, 1, 1);
    }
    return canvas;
  }

  function sunArt() {
    const colors = SUN_COLORS.map(rgb);
    return raster(64, 64, (x, y) => {
      const dx = (x - 31.5) / 26.5;
      const dy = (y - 31.5) / 26.5;
      const r = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const edge = 1 + 0.022 * Math.cos(13 * angle) + 0.027 * Math.sin(6 * angle);
      if (r > edge) {
        if (r < edge + 0.09 && hash(x, y, 48) > 0.78) return [239, 107, 65, 150];
        return null;
      }
      const twist = Math.sin(angle + r * 4.1) * 2.8;
      const heat = noise(x / 8.2 + twist, y / 5.2 - twist, 47) * 0.60
        + noise(x / 3.2, y / 3.5, 51) * 0.25 + hash(x, y, 55) * 0.15;
      const value = 0.51 + heat * 0.74 - r * r * 0.42 - (dx + dy) * 0.054;
      return colors[clamp(Math.floor(value * colors.length), 0, colors.length - 1)];
    });
  }

  const sky = skyArt();
  const sun = sunArt();
  const planetCache = new Map();

  function planetColor(p) {
    if (p.stage >= 2) return "#7fd4a3";
    if (p.stage === 1) return "#72bdaa";
    if (p.pop > 0) return "#f6bd85";
    return ROCKS[p.kind % ROCKS.length][2];
  }

  function planetArt(p, ghost = false) {
    const bearing = Math.atan2(-p.y, -p.x);
    const lighting = Math.round(bearing / (TAU / 12));
    const inhabited = p.pop > 0;
    const urban = p.biosphere ? p.biosphere.plots.filter(i=>[3,4].includes(p.biosphere.urban[i])&&p.biosphere.damage[i]<.62).length : 0;
    const settlementLevel = inhabited ? Math.min(5,Math.floor(urban/40)) : 0;
    const key = [p.kind, p.stage, inhabited, settlementLevel, lighting, ghost].join("/");
    if (planetCache.has(key)) return planetCache.get(key);
    if (planetCache.size > 260) planetCache.clear();
    const radius = 10.4;
    const colors = (ghost ? ["#16405a", "#306787", "#61b2cd", "#b6edf0"] : ROCKS[p.kind % ROCKS.length]).map(rgb);
    const ground = LAND.map(rgb);
    const ocean = WATER.map(rgb);
    const germs = MICROBE.map(rgb);
    const seed = 2523 + p.kind * 103;
    const sunX = Math.cos(lighting * TAU / 12);
    const sunY = Math.sin(lighting * TAU / 12);
    const sprite = raster(24, 24, (x, y) => {
      const dx = (x - 11.5) / radius;
      const dy = (y - 11.5) / radius;
      const r = Math.hypot(dx, dy);
      if (r > 1.08) return null;
      const light = dx * sunX + dy * sunY;
      const texture = noise(x / 4.1, y / 4.5, seed) * 0.74 + noise(x / 1.7, y / 2.1, seed + 1) * 0.26;
      const land = texture + Math.sin((x + y * 0.33) * 0.47) * 0.045 > 0.51;
      if (r > 0.99) {
        if (p.stage >= 1 || ghost) return light > 0.02 ? [114, 211, 200, 209] : [63, 108, 150, 160];
        return light > 0.34 ? colors[2] : colors[0];
      }
      const palette = p.stage >= 2 ? land ? ground : ocean : p.stage === 1 && land ? germs : colors;
      const brightness = 1.16 + light * 1.16 + texture * 1.85 - r * 0.62;
      const grade = clamp(Math.floor(brightness), 0, palette.length - 1);
      if (inhabited && light < 0.15 && (land || p.stage < 2) && hash(x, y, seed + 22) > 0.98 - settlementLevel*.055) return [249, 201, 111];
      if (p.stage >= 2 && noise(x / 4.9 + y / 6, y / 2, seed + 61) > 0.74 && light > -0.32) {
        return mix(palette[grade], [186, 217, 218], 0.41);
      }
      return palette[grade];
    });
    planetCache.set(key, sprite);
    return sprite;
  }

  function circle(ctx, x, y, radius, color, width = 1, dash = []) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function text(ctx, value, x, y, color, size = 9, align = "left") {
    ctx.font = "650 " + size + "px ui-monospace, monospace";
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  }

  function staticField(view, zone, previous) {
    const { w, h, dpr, scale, cx, cy } = view;
    const { inner, outer } = zone;
    const unit = 1 / scale;
    const width = Math.round(w * dpr);
    const height = Math.round(h * dpr);
    const canvas = previous?.width === width && previous.height === height ? previous : surface(width, height);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sky, 0, 0, w, h);
    ctx.strokeStyle = "#8fadd00c";
    ctx.lineWidth = 1;
    const grid = 32;
    ctx.beginPath();
    for (let x = cx % grid; x < w; x += grid) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, h);
    }
    for (let y = cy % grid; y < h; y += grid) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(w, Math.round(y) + 0.5);
    }
    ctx.stroke();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const warm = ctx.createRadialGradient(0, 0, SUN, 0, 0, inner);
    warm.addColorStop(0, "#ec744626");
    warm.addColorStop(0.55, "#ee795e0b");
    warm.addColorStop(1, "#ce725206");
    ctx.fillStyle = warm;
    ctx.beginPath();
    ctx.arc(0, 0, inner, 0, TAU);
    ctx.fill();

    const temperate = ctx.createRadialGradient(0, 0, inner, 0, 0, outer);
    temperate.addColorStop(0, "#80c77725");
    temperate.addColorStop(0.45, "#75b98929");
    temperate.addColorStop(1, "#90c77839");
    ctx.fillStyle = temperate;
    ctx.beginPath();
    ctx.arc(0, 0, outer, 0, TAU);
    ctx.moveTo(inner, 0);
    ctx.arc(0, 0, inner, 0, TAU);
    ctx.fill("evenodd");

    circle(ctx, 0, 0, 62, "#b6665a44", 0.7, [3, 7]);
    circle(ctx, 0, 0, 82, "#b17a6340", 0.65, [1, 5]);
    circle(ctx, 0, 0, inner + 18, "#a9e3a73d", 0.6, [1, 6]);
    circle(ctx, 0, 0, inner + 50, "#a9e3a73d", 0.6, [1, 6]);
    circle(ctx, 0, 0, inner, "#a5d88c94", 0.95, [3, 4]);
    circle(ctx, 0, 0, outer, "#a5d88c9e", 1, [3, 4]);
    circle(ctx, 0, 0, 216, "#94aacf48", 0.8, [2, 6]);
    circle(ctx, 0, 0, 252, "#94aacf32", 0.8, [2, 8]);
    circle(ctx, 0, 0, 293, "#94aacf1f", 0.8, [1, 8]);
    for (const radius of [365, 460, 570, 695]) {
      circle(ctx, 0, 0, radius, "#8eacd744", 0.8 * unit, [2 * unit, 6 * unit]);
    }
    circle(ctx, 0, 0, EXIT, "#9bbbd78a", unit, [5 * unit, 5 * unit]);

    ctx.strokeStyle = "#b6ed9178";
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const angle = i * TAU / 24;
      const length = i % 6 === 0 ? 6 : 3;
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      ctx.moveTo(x * (outer + 2), y * (outer + 2));
      ctx.lineTo(x * (outer + length + 2), y * (outer + length + 2));
    }
    ctx.stroke();

    const glow = 69 + (inner - INNER) * 0.34;
    const aura = ctx.createRadialGradient(0, 0, SUN * 0.6, 0, 0, glow);
    aura.addColorStop(0, "#ff8d5583");
    aura.addColorStop(0.30, "#ff844745");
    aura.addColorStop(0.59, "#ff724519");
    aura.addColorStop(1, "#ff6b4900");
    ctx.fillStyle = aura;
    ctx.fillRect(-glow, -glow, glow * 2, glow * 2);
    ctx.drawImage(sun, -34, -34, 68, 68);

    if (view.zoom !== "wide") {
      ctx.beginPath();
      ctx.moveTo(-19, 25);
      ctx.lineTo(-37, 47);
      ctx.lineTo(-66, 47);
      ctx.strokeStyle = "#efab767d";
      ctx.lineWidth = 0.8 * unit;
      ctx.stroke();
      text(ctx, "SLUNCE", -70, 47, "#e5b09a", Math.max(8.7, 8 * unit), "right");
    }

    if (w > 660 && view.zoom !== "wide") {
      const markX = -119 * outer / OUTER;
      const markY = -137 * outer / OUTER;
      ctx.beginPath();
      ctx.moveTo(markX, markY);
      ctx.lineTo(markX - 25, markY - 19);
      ctx.lineTo(markX - 80, markY - 19);
      ctx.strokeStyle = "#a3d4859c";
      ctx.stroke();
      text(ctx, "OBYVATELNÁ ZÓNA", markX - 84, markY - 19, "#a9cf92", Math.max(8.6, 9 * unit), "right");
    }
    if (view.zoom === "wide") {
      const edgeLabel = w > 660 ? EXIT - 10 * unit : -EXIT + 11 * unit;
      text(ctx, "OKRAJ SOUSTAVY", 0, edgeLabel, "#a1b8d0", 9 * unit, "center");
    }
    return canvas;
  }

  function sunSparks(ctx, tick) {
    const rng = random(401);
    for (let i = 0; i < 19; i++) {
      const base = rng() * TAU;
      const phase = (tick * (0.14 + rng() * 0.26) + rng()) % 1;
      const a = base + phase * 0.32;
      const r = 28 + 11 * phase;
      ctx.globalAlpha = (1 - phase) * 0.76;
      ctx.fillStyle = i % 3 === 0 ? "#fff09e" : "#f29860";
      ctx.fillRect(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r), i % 4 === 0 ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function arrow(ctx, from, to, color, unit, dashed) {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const head = 6 * unit;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.15 * unit;
    ctx.setLineDash(dashed ? [4 * unit, 4 * unit] : []);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(to.x - head * Math.cos(angle - 0.52), to.y - head * Math.sin(angle - 0.52));
    ctx.lineTo(to.x, to.y);
    ctx.lineTo(to.x - head * Math.cos(angle + 0.52), to.y - head * Math.sin(angle + 0.52));
    ctx.stroke();
  }

  function ghost(ctx, shot, view, time, isGuide, source) {
    const guide = { ...shot, kind: 0, stage: 0, pop: 0 };
    const color = isGuide ? "#8be5e7" : "#d5f6f1";
    const unit = 1 / view.scale;
    const drag = view.aimScale * unit / IMPULSE;
    const tip = { x: shot.x + shot.vx * drag, y: shot.y + shot.vy * drag };
    const pulse = 0.5 + Math.sin(time * 3) * 0.21;
    const r = Math.max(source?.radius ?? 10, 5.5 * unit);
    const pad = 3 * unit;
    if (!source) ctx.drawImage(planetArt(guide, true), shot.x - r, shot.y - r, r * 2, r * 2);
    ctx.globalAlpha = isGuide ? pulse + 0.25 : 0.83;
    circle(ctx, shot.x, shot.y, r + pad, color, 0.8 * unit, [2 * unit, 3 * unit]);
    ctx.globalAlpha = 1;
    const speed = Math.hypot(shot.vx, shot.vy);
    if (speed * drag > r + pad + 2 * unit) {
      const start = (r + pad) / speed;
      arrow(ctx, { x: shot.x + shot.vx * start, y: shot.y + shot.vy * start }, tip, color, unit, isGuide);
    }
    if (isGuide) text(ctx, "TÁHNI", shot.x + r + 7 * unit, shot.y + 1, "#b5e4e9", Math.max(9, 8 * unit));
  }

  function track(ctx, points, color, width = 1) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function prediction(ctx, model, unit, isGuide, full) {
    if (!model) return;
    const risky = model.hit || model.encounter || (full && model.type !== "green");
    let color = model.hit && model.hit !== "escape" ? RED : risky ? AMBER : full ? LIME : MINT;
    if (model.probe) color = model.sun ? RED : model.target ? LIME : model.deep ? AMBER : MINT;
    ctx.globalAlpha = isGuide ? 0.46 : 0.91;
    ctx.setLineDash([2 * unit, (isGuide ? 5 : 4) * unit]);
    track(ctx, model.points, color, (isGuide ? 0.85 : 1.25) * unit);
    ctx.setLineDash([]);
    if (model.target) {
      const p = model.points.at(-1);
      circle(ctx, p.x, p.y, 5 * unit, color, 1.4 * unit);
    }
    if (model.hit && !isGuide) {
      const p = model.points.at(-1);
      const mark = 4 * unit;
      ctx.beginPath();
      ctx.moveTo(p.x - mark, p.y - mark);
      ctx.lineTo(p.x + mark, p.y + mark);
      ctx.moveTo(p.x + mark, p.y - mark);
      ctx.lineTo(p.x - mark, p.y + mark);
      ctx.strokeStyle = color;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function ellipse(ctx, p, unit) {
    const { peri, apo } = p.orbit;
    if (!Number.isFinite(apo) || apo > EXIT || peri < 2) return;
    const radius = Math.hypot(p.x, p.y);
    const h = p.x * p.vy - p.y * p.vx;
    const eX = p.vy * h / MU - p.x / radius;
    const eY = -p.vx * h / MU - p.y / radius;
    const major = (peri + apo) / 2;
    ctx.beginPath();
    ctx.ellipse(-eX * major, -eY * major, major, Math.sqrt(peri * apo), Math.atan2(eY, eX), 0, TAU);
    ctx.strokeStyle = planetColor(p) + "58";
    ctx.lineWidth = 0.8 * unit;
    ctx.setLineDash([3 * unit, 6 * unit]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function planet(ctx, p, selected, label, time, unit) {
    const color = planetColor(p);
    const r = Math.max(p.radius * 1.18, 4.6 * unit);
    track(ctx, p.trail, color + (selected ? "60" : "43"), (selected ? 1.25 : 0.95) * unit);
    ctx.drawImage(planetArt(p), Math.round(p.x - r), Math.round(p.y - r), r * 2, r * 2);
    if (selected) circle(ctx, p.x, p.y, r + 3 * unit, color + "d0", 0.75 * unit, [3 * unit, 4 * unit]);
    if (p.tech) {
      const count = p.self && p.stage >= 4 ? 2 : 1;
      const reach = r + 6 * unit;
      circle(ctx, p.x, p.y, reach, color + "43", 0.6 * unit, [unit, 2 * unit]);
      for (let i = 0; i < count; i++) {
        const angle = time * (1.65 - i * 0.32) + i * 2.8 + p.id;
        const x = Math.round(p.x + Math.cos(angle) * reach);
        const y = Math.round(p.y + Math.sin(angle) * reach);
        ctx.fillStyle = "#70a6d6";
        ctx.fillRect(x - 2.5 * unit, y, 6 * unit, 1.25 * unit);
        ctx.fillStyle = "#c5f0e8";
        ctx.fillRect(x - 0.5 * unit, y - 1.5 * unit, 1.7 * unit, 3.5 * unit);
      }
    }
    if (label) {
      const x = p.x;
      const y = p.y + r + (p.tech ? 15 : 10) * unit;
      const size = Math.max(selected ? 10 : 9, (selected ? 11 : 10) * unit);
      ctx.font = "650 " + size + "px ui-monospace, monospace";
      const width = ctx.measureText(p.name).width;
      ctx.fillStyle = "#0a1422de";
      ctx.fillRect(x - width * 0.5 - 3 * unit, y - size * 0.55, width + 6 * unit, size * 1.15);
      text(ctx, p.name, x, y, selected ? "#e5f8ee" : "#aec3d3", size, "center");
    }
  }

  function offscreen(ctx, p, view, color = planetColor(p)) {
    const halfWidth = view.w / 2, halfHeight = view.h / 2;
    const x = p.x * view.scale + view.cx - halfWidth;
    const y = p.y * view.scale + view.cy - halfHeight;
    if (Math.abs(x) <= halfWidth - 7 && Math.abs(y) <= halfHeight - 7) return;
    const shrink = Math.min((halfWidth - 21) / Math.max(1, Math.abs(x)), (halfHeight - 24) / Math.max(1, Math.abs(y)));
    const mx = (halfWidth + x * shrink - view.cx) / view.scale;
    const my = (halfHeight + y * shrink - view.cy) / view.scale;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(Math.atan2(y, x));
    ctx.scale(1 / view.scale, 1 / view.scale);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.fill();
    ctx.restore();
  }

  function ship(ctx, s, tick, unit) {
    let color = s.people ? "#9bfad7" : "#ffd39a";
    if (s.kind === "evac") color = "#dac1fa";
    if (s.kind === "probe") color = s.status === "drift" ? AMBER : MINT;
    for (let i = 0; i < s.trail.length; i++) {
      const q = s.trail[i];
      ctx.globalAlpha = i / s.trail.length * 0.56;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(q.x), Math.round(q.y), 1.25 * unit, 1.25 * unit);
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.kind === "probe" ? Math.atan2(s.vy, s.vx) : s.heading);
    ctx.scale(unit, unit);
    ctx.fillStyle = tick % 0.21 > 0.11 ? "#ffb974" : "#f19c74";
    ctx.fillRect(-6, -0.8, 3, 1.6);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(1, -2.2);
    ctx.lineTo(-3, -2.2);
    ctx.lineTo(-3, 2.2);
    ctx.lineTo(1, 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3b6e89";
    ctx.fillRect(0, -0.8, 1.8, 1.6);
    ctx.restore();
  }

  function visitorArt(ctx, body, view, unit) {
    const color = body.comet ? "#9de7ff" : body.tier === 2 ? "#ff927c" : "#ffd096";
    const trail = [...body.trail, body];
    const start = body.comet ? 0 : Math.max(0, trail.length - 29);
    for (let i = start + 1; i < trail.length; i++) {
      ctx.globalAlpha = 0.57 * ((i - start) / (trail.length - start)) ** 1.4;
      track(ctx, [trail[i - 1], trail[i]], color, (body.comet ? 2.1 : 1.55) * unit);
    }
    ctx.globalAlpha = 1;
    const x = body.x, y = body.y;
    const r = Math.max(body.radius, (3.4 + body.tier * 1.25) * unit);
    if (body.comet) {
      const distance = Math.max(1, Math.hypot(x, y));
      const length = Math.min(45 * unit, 55);
      const tail = { x: x + x / distance * length, y: y + y / distance * length };
      track(ctx, [tail, body], "#79c9ff3a", 6 * unit);
      track(ctx, [tail, body], "#c1eeff6c", 2 * unit);
    }
    ctx.fillStyle = body.comet ? "#287598" : "#775052";
    ctx.fillRect(x - r, y - r * 0.60, r * 2, r * 1.20);
    ctx.fillRect(x - r * 0.61, y - r, r * 1.30, r * 2);
    ctx.fillStyle = color;
    ctx.fillRect(x - r * 0.64, y - r * 0.59, r * 1.19, r * 1.21);
    ctx.fillStyle = body.comet ? "#f0fcff" : "#fff1cc";
    ctx.fillRect(x - r * 0.49, y - r * 0.57, r * 0.60, r * 0.50);
    const align = x * view.scale + view.cx > view.w - 128 ? "right" : "left";
    const labelX = x + (align === "right" ? -1 : 1) * (r + 6 * unit);
    text(ctx, Orbit.visitorLabel(body), labelX, y - r - 4 * unit, color, 10 * unit, align);
    if (body.warning) offscreen(ctx, body, view, color);
  }

  function blast(ctx, effect) {
    const rng = random(effect.seed);
    const t = effect.age;
    const strength = effect.strength ?? (effect.collision ? 1.25 : 0.8);
    if (t < 0.82) {
      ctx.globalAlpha = (1 - t / 0.82) * 0.82;
      circle(ctx, effect.x, effect.y, (4 + t * 48) * strength, "#ffc484", 1.35);
      circle(ctx, effect.x, effect.y, (3 + t * 38) * strength, "#ff987f", 0.9, [4, 3]);
    }
    for (let i = 0; i < 31; i++) {
      const angle = rng() * TAU;
      const speed = (8 + rng() * 31) * strength;
      const life = 0.5 + rng() * 1.7;
      const size = 1 + Math.floor(rng() * 3);
      if (t >= life) continue;
      ctx.globalAlpha = 1 - t / life;
      ctx.fillStyle = ["#ffe1a3", "#e9a76c", "#ff866f", "#8baad0"][i % 4];
      ctx.fillRect(Math.round(effect.x + Math.cos(angle) * speed * t), Math.round(effect.y + Math.sin(angle) * speed * t), size, size);
    }
    ctx.globalAlpha = 1;
  }

  function flybys(ctx, worlds, unit) {
    ctx.setLineDash([3 * unit, 3 * unit]);
    for (let i = 0; i < worlds.length; i++) {
      for (let j = i + 1; j < worlds.length; j++) {
        const a = worlds[i];
        const b = worlds[j];
        const pull = mutualPull(a, b);
        if (pull < ENCOUNTER_PULL) continue;
        ctx.globalAlpha = clamp(pull * 2.6, 0.28, 0.84);
        track(ctx, [a, b], AMBER, 1.2 * unit);
      }
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  function render(ctx, view, backdrop, state, aim, guidePath, selected, time, source, planetArmed = false) {
    const unit = 1 / view.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(backdrop, 0, 0);
    ctx.setTransform(view.scale * view.dpr, 0, 0, view.scale * view.dpr, view.cx * view.dpr, view.cy * view.dpr);
    ctx.imageSmoothingEnabled = false;
    sunSparks(ctx, time);
    if (state.mission && state.mission.phase !== "finished") {
      const { inner, outer } = state.mission.future;
      const dash = [5 * unit, 6 * unit];
      circle(ctx, 0, 0, inner, "#ffc784aa", 1.15 * unit, dash);
      circle(ctx, 0, 0, outer, "#ffc784c8", 1.15 * unit, dash);
    }
    if (!aim && !source) {
      const p = state.worlds.find(world => world.id === selected);
      if (p) ellipse(ctx, p, unit);
    }
    if (state.physics !== "stable") flybys(ctx, state.worlds, unit);
    for (const p of state.worlds) {
      if (source) {
        const color = p === source ? "#85f0d2dd" : "#85f0d285";
        circle(ctx, p.x, p.y, Orbit.landingRadius(p), color, unit, [3 * unit, 3 * unit]);
      }
      planet(ctx, p, p.id === selected, p.id === selected || state.worlds.length <= 3, state.time, unit);
      if (state.visitor?.warning?.worldId === p.id) {
        circle(ctx, p.x, p.y, Math.max(p.radius, 4.6 * unit) + 8 * unit, "#ff9a9e", 1.15 * unit, [4 * unit, 3 * unit]);
      }
      offscreen(ctx, p, view);
    }
    for (const s of state.ships) ship(ctx, s, state.time, Math.max(0.8, unit));
    for (const p of state.probes) {
      const color = p.status === "drift" ? AMBER : MINT;
      ship(ctx, p, state.time, Math.max(0.8, unit));
      circle(ctx, p.x, p.y, 7 * unit, color, 0.7 * unit, [2 * unit, 3 * unit]);
      offscreen(ctx, p, view, color);
    }
    if (state.visitor) visitorArt(ctx, state.visitor, view, unit);
    for (const effect of state.effects) blast(ctx, effect);
    const full = state.mode === "training";
    if (aim) {
      prediction(ctx, aim.forecast, unit, false, full);
      ghost(ctx, aim.shot, view, time, false, source);
    } else if (planetArmed && !state.worlds.length && !state.everCivilization) {
      prediction(ctx, guidePath, unit, true, full);
      ghost(ctx, typeof Evolution!=="undefined" ? Evolution.starterShot(state) : GUIDE, view, time, true);
    }
  }

  return { staticField, render, planetColor };
})();
