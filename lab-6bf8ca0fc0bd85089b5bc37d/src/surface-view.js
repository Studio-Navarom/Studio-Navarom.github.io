const SurfaceView = (() => {
  const { W, H, WIND_REACH, TERRAIN_RADIUS, cloudRadius, hash, position } = Biosphere;
  const CELL = 6, WIDTH = W * CELL, HEIGHT = H * CELL;
  const FIT = Object.freeze({ zoom: 1, x: W / 2, y: H / 2 });
  const MAX_ZOOM = 5;
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const paper = document.createElement("canvas");
  paper.width = WIDTH;
  paper.height = HEIGHT;
  const pixels = paper.getContext("2d", { alpha: false });

  function bounds(view, camera) {
    const left = 12, top = 41;
    const width = view.w - 24, height = view.h - 68;
    const cx = left + width / 2, cy = top + height / 2;
    const unit = Math.min(width / W, height / H) * camera.zoom;
    const halfX = Math.min(W / 2, width / unit / 2);
    const halfY = Math.min(H / 2, height / unit / 2);
    const centerX = clamp(camera.x, halfX, W - halfX);
    const centerY = clamp(camera.y, halfY, H - halfY);
    return { left, top, width, height, cx, cy, unit, centerX, centerY,
      x: cx - centerX * unit, y: cy - centerY * unit };
  }

  function pan(view, camera, dx, dy) {
    const box = bounds(view, camera);
    const moved = { zoom: camera.zoom, x: box.centerX - dx / box.unit, y: box.centerY - dy / box.unit };
    const next = bounds(view, moved);
    return { zoom: moved.zoom, x: next.centerX, y: next.centerY };
  }

  function zoomAt(view, camera, magnification, anchor) {
    const zoom = clamp(magnification, 1, MAX_ZOOM);
    if (zoom === 1) return FIT;
    const box = bounds(view, camera);
    const target = anchor && point(view, camera, anchor);
    const unit = box.unit * zoom / camera.zoom;
    return pan(view, {
      zoom,
      x: target ? target.x + (box.cx - anchor.x) / unit : box.centerX,
      y: target ? target.y + (box.cy - anchor.y) / unit : box.centerY
    }, 0, 0);
  }

  function terrain(s, frame) {
    const { height, water, ice, plants, flow, downstream, wet } = s;
    const stream = 0.021;
    for (let i = 0; i < height.length; i++) {
      const x = i % W * CELL, y = Math.floor(i / W) * CELL;
      const rock = height[i];
      const grain = hash(x, y, s.seed);
      const wetSurface = water[i] > 0.17;
      // Grey exposed bedrock starts above the normal plant-bearing slopes.
      // It stays visible wherever the local snow and ice have melted.
      const highRock = !wetSurface && rock > 0.95;
      const desert = s.temperature[i] >= 0.40 && wet[i] < 0.34 && plants[i] < 0.42 && ice[i] < 0.24;
      if (wetSurface) {
        pixels.fillStyle = water[i] > 3.2 ? "#19324e" : water[i] > 1.4 ? "#1f415d"
          : water[i] > 0.52 ? "#28566d" : water[i] > 0.31 ? "#397d94" : "#488b9e";
      } else if (highRock) {
        // Layered grey stone like an exposed high-altitude mountain face.
        pixels.fillStyle = rock > 1.29 ? (grain > 0.49 ? "#59636e" : "#67717b")
          : rock > 1.13 ? (grain > 0.49 ? "#717a83" : "#828992")
          : (grain > 0.49 ? "#898b89" : "#969794");
      } else if (plants[i] > 0.55) {
        pixels.fillStyle = rock > 0.59 ? "#527962" : "#3e6e54";
      } else if (plants[i] > 0.23 && !desert) {
        pixels.fillStyle = rock > 0.58 ? "#6d8662" : "#5a7850";
      } else if (s.basalt[i] > 4) {
        pixels.fillStyle = s.basalt[i] > 64 ? "#3b353b" : "#55464b";
      } else if (s.crater[i] > 25) {
        pixels.fillStyle = s.crater[i] > 140 ? "#634b4a" : "#80625a";
      } else {
        pixels.fillStyle = rock > 0.74 ? "#aa937b" : rock > 0.61 ? "#88715b" : wet[i] > 0.27 ? "#73634f"
          : rock < 0.43 ? "#ad906e" : "#9a7856";
      }
      pixels.fillRect(x, y, CELL, CELL);
      if (desert && plants[i] > 0.16 && grain > 0.70) {
        pixels.fillStyle = "#7e8052"; pixels.fillRect(x+2,y+2,1,3); pixels.fillRect(x+1,y+3,3,1);
      }
      if (!wetSurface && ice[i] < 0.14 && rock < 0.54) {
        pixels.fillStyle = "#d4ba83";
        if (water[s.west[i]] > 0.50) pixels.fillRect(x, y, 1, CELL);
        if (water[s.east[i]] > 0.50) pixels.fillRect(x + CELL - 1, y, 1, CELL);
        if (water[s.north[i]] > 0.50) pixels.fillRect(x, y, CELL, 1);
        if (water[s.south[i]] > 0.50) pixels.fillRect(x, y + CELL - 1, CELL, 1);
      }
      if (wetSurface && grain > 0.69) {
        pixels.fillStyle = water[i] < 0.55 ? "#9acfd47c" : "#60949d50";
        pixels.fillRect(x + (frame + i) % 4, y + i % 5, 2, 1);
      } else if (!wetSurface) {
        if (rock - height[s.south[i]] > 0.10) {
          pixels.fillStyle = "#4e40376e";
          pixels.fillRect(x, y + 4, CELL, 2);
        }
        if (rock > 0.58 && grain > 0.24) {
          const peak = grain > 0.64 ? 1 : 0;
          pixels.fillStyle = highRock ? "#c6cbd071" : "#d5b99555";
          pixels.fillRect(x + 2 + peak, y + 1, 2, 1);
          pixels.fillRect(x + 1 + peak, y + 2, 2, 1);
          pixels.fillStyle = highRock ? "#303b4888" : "#2a27314d";
          pixels.fillRect(x + 3 + peak, y + 2, 2, 1);
        } else if (grain < 0.46) {
          pixels.fillStyle = "#e7bb8640";
          pixels.fillRect(x + i % 5, y + (i * 3) % 5, 1, 1);
        }
        if (plants[i] > 0.58 && grain < 0.76) {
          pixels.fillStyle = "#244b46";
          pixels.fillRect(x + 2, y + 3, 3, 2);
          pixels.fillStyle = "#88a86d";
          pixels.fillRect(x + 2, y + 2, 2, 2);
        }
        if (flow[i] > stream || water[i] > 0.11) {
          const next = downstream[i];
          pixels.fillStyle = "#5298aa";
          pixels.fillRect(x + 2, y + 2, 2, 2);
          if (next === s.west[i] || (downstream[s.west[i]] === i && flow[s.west[i]] > stream)) pixels.fillRect(x, y + 2, 3, 2);
          if (next === s.east[i] || (downstream[s.east[i]] === i && flow[s.east[i]] > stream)) pixels.fillRect(x + 3, y + 2, 3, 2);
          if (next === s.north[i] || (downstream[s.north[i]] === i && flow[s.north[i]] > stream)) pixels.fillRect(x + 2, y, 2, 3);
          if (next === s.south[i] || (downstream[s.south[i]] === i && flow[s.south[i]] > stream)) pixels.fillRect(x + 2, y + 3, 2, 3);
        }
      }
      if (ice[i] > (highRock ? 0.045 : 0.14)) {
        if (highRock) {
          // Snow returns patch by patch with accumulated frozen rain rather
          // than instantly painting the entire summit white at the first flake.
          const cover = clamp((ice[i] - 0.035) / 0.67, 0, 1);
          const snowSeed = hash(i % W, Math.floor(i / W), s.seed + 204);
          if (cover > 0.82) {
            pixels.fillStyle = rock > Biosphere.SUMMIT_START ? "#e4edf0" : "#dce6e9";
            pixels.fillRect(x, y, CELL, CELL);
          } else {
            pixels.fillStyle = "#dfe9ec";
            if (cover > 0.10 && snowSeed < cover + 0.15) pixels.fillRect(x + 1, y + 1, 3, 2);
            if (cover > 0.22 && hash(i, 7, s.seed) < cover + 0.06) pixels.fillRect(x + 3, y + 3, 3, 2);
            if (cover > 0.48 && hash(i, 11, s.seed) < cover + 0.15) pixels.fillRect(x, y + 4, 3, 2);
            if (cover > 0.65) pixels.fillRect(x, y, 2, 3);
          }
        } else {
          pixels.fillStyle = ice[i] > 1.4 ? "#bfd9da" : ice[i] > 0.65 ? "#9cc3ce" : "#8eb4c6c0";
          pixels.fillRect(x, y, CELL, CELL);
          pixels.fillStyle = grain > 0.42 ? "#e7efe89c" : "#517f95a0";
          pixels.fillRect(x + 1, y + 1, 3, 1);
          if (s.bioProfile === "cold" && plants[i] > 0.22) {
            pixels.fillStyle = plants[i] > 0.55 ? "#537e78" : "#79a79b";
            pixels.fillRect(x + 2, y + 3, 2, 1);
            if (plants[i] > 0.55) pixels.fillRect(x + 1, y + 4, 2, 1);
          }
        }
      }
      if (s.era === 1 && water[i] > 0.15 && water[i] < 1.6 && grain > 0.78 && s.temperature[i] > 0.16) {
        pixels.fillStyle = "#99e49b99";
        pixels.fillRect(x + (i + frame) % 5, y + (i * 3) % 5, 1, 1);
      }
    }
  }

  function cloudBody(cloud, x, y, r, frame, freezing, lightGround) {
    const width = r * 2, height = Math.max(3, Math.round(r * 0.46));
    const left = x - r, drift = Math.floor((cloud.shape - 0.5) * r * 0.8);
    const opacity = Math.min(0.57, 0.10 + Math.sqrt(cloud.water) * 0.17) * Math.min(1, cloud.water / 1.4);
    if (cloud.rain > 0.02) {
      const depth = Math.max(3, Math.round(r * 0.78));
      const seed = Math.round(cloud.shape * 4096);
      const drops = Math.min(32, Math.ceil(cloud.rain * 26));
      pixels.globalAlpha = 0.88;
      pixels.fillStyle = freezing ? "#def8ed" : "#89d9ec";
      for (let i = 0; i < drops; i++) {
        const column = Math.round((hash(i, 5, seed) - 0.5) * r * 1.65);
        const fall = (Math.floor(hash(i, 13, seed) * depth) + frame * (freezing ? 1 : 3)) % depth;
        pixels.fillRect(x + column, y + height - 1 + fall, 1, freezing ? 1 : 2);
      }
    }
    pixels.globalAlpha = Math.min(0.65, opacity * (lightGround ? 1.8 : 0.45));
    pixels.fillStyle = "#16364c";
    pixels.fillRect(left + 3, y + height, width - 2, 3);
    pixels.globalAlpha = Math.min(0.8, opacity * (lightGround ? 1.4 : 1));
    pixels.fillStyle = lightGround ? (cloud.storm ? "#40536e" : "#6b8399") : cloud.storm ? "#53647b" : cloud.rain > 0 ? "#9fbbc9" : "#d0e4eb";
    pixels.fillRect(left + 2, y - 1, width - 4, 3);
    pixels.fillRect(left, y + 2, width, Math.max(1, height - 2));
    pixels.fillRect(x - Math.floor(r * 0.59) + drift, y - height, Math.floor(r * 1.18), height - 1);
    pixels.globalAlpha = opacity * 0.65;
    pixels.fillStyle = cloud.storm ? "#a2b4c6" : "#f1f7ee";
    pixels.fillRect(x - Math.floor(r * 0.42) + drift, y - height, Math.floor(r * 0.82), 2);
    pixels.fillRect(left + 3, y - 1, Math.floor(r * 0.56), 1);
    pixels.globalAlpha = 1;
  }

  function movingPixel(actor, blend) {
    const fromX = actor.previousX ?? actor.x, fromY = actor.previousY ?? actor.y;
    const wrapDelta = (actor.x - fromX + W * 1.5) % W - W / 2;
    const x = Math.round(((fromX + wrapDelta * blend + W) % W) * CELL);
    const y = Math.round((fromY + (actor.y - fromY) * blend) * CELL);
    return { x, y };
  }

  function weather(s, frame, blend) {
    for (const cloud of s.clouds) {
      const { x, y } = movingPixel(cloud, blend);
      const r = Math.max(3, Math.round(cloudRadius(cloud.water) * CELL));
      const freezing = s.temperature[Math.floor(cloud.y) * W + Math.floor(cloud.x)] < Biosphere.FREEZE_AT;
      const lightGround = s.ice[Math.floor(cloud.y) * W + Math.floor(cloud.x)] > 0.16;
      cloudBody(cloud, x, y, r, frame, freezing, lightGround);
      if (x < r) cloudBody(cloud, x + WIDTH, y, r, frame, freezing, lightGround);
      if (x > WIDTH - r) cloudBody(cloud, x - WIDTH, y, r, frame, freezing, lightGround);
    }
    for (let i = 0; i < s.heat.length; i++) {
      const x = i % W * CELL, y = Math.floor(i / W) * CELL;
      if (s.rain[i] > 0.002 && i % 7 === frame % 7) {
        pixels.fillStyle = "#96d4ffb0"; pixels.fillRect(x + frame % 4, y + i % 3, 1, 3);
      }
      if (Math.abs(s.heat[i]) > 0.1) {
        pixels.fillStyle = s.heat[i] > 0 ? "#ffc18432" : "#88dfff36";
        pixels.fillRect(x, y, CELL, CELL);
        if (s.heat[i] > 0.22 && s.water[i] > 0.24 && i % 4 === 0) {
          pixels.fillStyle = "#f0e0c67a";
          pixels.fillRect(x + (i + frame) % 5, y + 5 - frame % 5, 1, 2);
        }
      }
      if (s.fire[i] > 0) {
        const flicker = (i + frame) % 3;
        pixels.fillStyle = "#6c302a";
        pixels.fillRect(x, y + 1, 6, 5);
        pixels.fillStyle = "#f68150";
        pixels.fillRect(x + 1, y + 2 - flicker, 4, 4 + flicker);
        pixels.fillStyle = "#ffe49a";
        pixels.fillRect(x + 2, y + 3, 2, 2);
        pixels.fillStyle = "#403c45a8";
        pixels.fillRect(x + 3, y - flicker - 3, 3, 3);
      }
      if (i % 13 === 0 && Math.abs(s.windX[i]) + Math.abs(s.windY[i]) > 0.26) {
        const dx = Math.round(s.windX[i] * 6), dy = Math.round(s.windY[i] * 6);
        const sweep = (frame % 4) / 4;
        pixels.fillStyle = "#d0fff3a0";
        pixels.fillRect(x + Math.round(dx * sweep), y + Math.round(dy * sweep), 2, 1);
        pixels.fillRect(x + dx, y + dy, 1, 1);
      }
      if (s.smog[i] > 0.08) {
        pixels.fillStyle = "#938580";
        pixels.globalAlpha = s.smog[i] * 0.44;
        pixels.fillRect(x, y, CELL, CELL);
        pixels.fillStyle = "#d0c1b4";
        pixels.fillRect(x + (i + frame) % 4, y + (i * 7) % 4, 2, 1);
        pixels.globalAlpha = 1;
      }
    }
  }

  function animal(actor, color, blend, offsetX = 0, offsetY = 0) {
    const point = movingPixel(actor, blend);
    const x = point.x + offsetX, y = point.y + offsetY;
    const spec = Biosphere.FAUNA[actor.species], body = spec?.color ?? color;
    const rect = (dx, dy, w, h, ink) => { pixels.fillStyle = ink; pixels.fillRect(x + dx, y + dy, w, h); };
    rect(-3, 1, 7, 2, "#172d385c");
    if (actor.species === "penguin") {
      rect(-2,-4,4,6,"#263744"); rect(-1,-2,2,4,"#f2f1df"); rect(1,-3,2,1,"#efa662");
      rect(-3,-1,1,2,"#263744"); rect(2,-1,1,2,"#263744"); rect(-2,2,2,1,"#e8ad61"); rect(1,2,2,1,"#e8ad61");
    } else if (actor.species === "camel") {
      rect(-4,-1,7,3,body); rect(-3,-3,2,2,body); rect(0,-3,2,2,body); rect(3,-4,2,5,body); rect(4,-4,3,2,body);
      rect(-3,2,1,3,"#a27b50"); rect(2,2,1,3,"#a27b50"); rect(6,-4,1,1,"#352f35");
    } else if (actor.species === "polarBear") {
      rect(-4,-2,8,4,"#526a78"); rect(-4,-2,7,3,body); rect(2,-3,4,3,body); rect(2,-4,1,1,body); rect(4,-4,1,1,body);
      rect(5,-2,1,1,"#344652"); rect(-3,1,2,2,body); rect(2,1,2,2,body);
    } else if (actor.species === "desertFox") {
      rect(-5,-1,3,2,"#f3e4bb"); rect(-3,-1,5,2,body); rect(1,-2,3,2,body); rect(1,-5,1,3,body); rect(3,-5,1,3,body);
      rect(-2,1,1,2,"#a68159"); rect(1,1,1,2,"#a68159"); rect(4,-1,1,1,"#4b4140");
    } else if (actor.species === "tapir") {
      rect(-3,-2,6,4,body); rect(2,-1,3,2,"#685e60"); rect(4,0,1,2,"#685e60"); rect(-2,2,1,1,"#494955"); rect(2,2,1,1,"#494955");
      rect(-2,-1,2,2,"#cabdb0");
    } else if (actor.species === "deer") {
      rect(-3,-1,5,2,body); rect(2,-3,2,3,body); rect(3,-3,2,1,body); rect(-2,1,1,3,"#705c50"); rect(1,1,1,3,"#705c50");
      rect(2,-5,1,2,"#ead7ae"); rect(1,-5,3,1,"#ead7ae");
    } else {
      const dark = actor.species === "panther";
      rect(-3,-1,6,3,dark ? "#768a86" : "#394b54"); rect(-3,-2,6,3,body); rect(2,-3,3,3,body);
      rect(2,-4,1,1,body); rect(4,-4,1,1,body); rect(-5,-2,2,1,body); rect(-2,1,1,2,body); rect(2,1,1,2,body);
      rect(4,-2,1,1,dark ? "#dbe99b" : "#222f3b");
    }
    if (actor.genes?.branch && !offsetX && !offsetY) {
      const cool = actor.genes.shares[0] + actor.genes.shares[1] > actor.genes.shares[3] + actor.genes.shares[4];
      rect(-3, -2, 2, 2, cool ? "#b5e7fb" : "#f9bb84");
    }
    if (actor.migrating && !offsetX && !offsetY) { rect(-1,-7,2,1,"#ffd18e"); rect(1,-6,1,1,"#ffd18e"); }
  }

  const clothes = { hunter: "#ff9f69", water: "#73def0", field: "#d9e98b", town: "#83edbb", gather: "#e8cc8d", migrant: "#e9abdf" };
  const carried = { water: "#6aafdf", field: "#d9c581", gather: "#d9c581" };

  function person(actor, role, stride, blend, cargo, uniform = clothes[role], offset = 0) {
    const point = movingPixel(actor, blend);
    const x = point.x + offset, y = point.y;
    const left = (stride + Math.floor(actor.x)) % 2;
    pixels.fillStyle = "#22313b";
    pixels.fillRect(x - 2, y - 3, 4, 5);
    pixels.fillRect(x - 1, y - 5, 2, 2);
    pixels.fillStyle = "#ffe6bf";
    pixels.fillRect(x - 1, y - 4, 2, 2);
    pixels.fillStyle = uniform;
    pixels.fillRect(x - 1, y - 2, 2, 2);
    pixels.fillStyle = "#becfd3";
    pixels.fillRect(x - 1, y + left, 1, 1);
    pixels.fillRect(x, y + 1 - left, 1, 1);
    if (cargo) {
      pixels.fillStyle = cargo;
      pixels.fillRect(x + 1, y - 2, 2, 2);
    }
  }

  function borders(s) {
    const owner = i => s.towns[s.claims[i] - 1]?.civilization ?? s.towns[s.claims[i] - 1]?.realm;
    for (let i = 0; i < s.claims.length; i++) {
      const own = owner(i), town = s.towns[s.claims[i] - 1]; if (!own || !Biosphere.canBuild(s, i, town)) continue;
      const x = i % W * CELL, y = Math.floor(i / W) * CELL;
      const selected = s.selectedTown && s.claims[i] === s.selectedTown;
      const color = town.civilizationColor ?? Biosphere.REALMS[town.realm].color;
      if (selected) { pixels.fillStyle = color + "18"; pixels.fillRect(x,y,CELL,CELL); }
      const edges = [[s.west[i],x,y,2,CELL],[s.east[i],x+4,y,2,CELL],[s.north[i],x,y,CELL,2],[s.south[i],x,y+4,CELL,2]];
      for (const [near,ex,ey,ew,eh] of edges) if (owner(near) !== own || selected && s.claims[near] !== s.claims[i]) {
        pixels.fillStyle = "#06131ddd"; pixels.fillRect(ex-1,ey-1,ew+2,eh+2);
        pixels.fillStyle = color; pixels.fillRect(ex,ey,ew,eh);
        // Selection is a separate dashed white edge; ownership keeps its colour.
        if (selected && i % 2 === 0) { pixels.fillStyle = '#f5fbff'; if (ew === 2) pixels.fillRect(ex + (ex === x ? 2 : -1),ey,1,eh); else pixels.fillRect(ex,ey + (ey === y ? 2 : -1),ew,1); }
      }
    }
  }

  function factory(s, town, x, y, frame, i) {
    pixels.fillStyle = "#3b4852";
    pixels.fillRect(x, y + 2, 6, 4);
    pixels.fillStyle = "#ae6655";
    pixels.fillRect(x + 1, y + 1, 5, 2);
    pixels.fillStyle = "#e0b49c";
    pixels.fillRect(x + 4, y - 2, 2, 4);
    pixels.fillStyle = "#ffc994";
    pixels.fillRect(x + 1, y + 4, 1, 1);
    pixels.fillRect(x + 3, y + 4, 1, 1);
    if (town && Biosphere.workingFactory(s, town)) {
      const rise = (frame + i) % 7;
      pixels.fillStyle = "#bcc0b180";
      pixels.fillRect(x + 4 + (rise >> 1), y - 3 - rise, 2, 2);
    }
  }

  function powerSite(kind, x, y, plant, frame) {
    if (kind === 6) {
      const phase = plant?.output > 0 ? Math.floor(frame * (0.55 + plant.output * 0.08)) % 4 : 0;
      pixels.fillStyle = "#293f47";
      pixels.fillRect(x + 1, y + 4, 5, 2);
      pixels.fillStyle = "#a5d4d7";
      pixels.fillRect(x + 3, y, 1, 6);
      pixels.fillStyle = "#e5f6ed";
      for (let spoke = 0; spoke < 3; spoke++) {
        const a = phase * Math.PI / 6 + spoke * Math.PI * 2 / 3;
        for (let n = 1; n <= 3; n++) pixels.fillRect(x + 3 + Math.round(Math.cos(a) * n), y + Math.round(Math.sin(a) * n), 1, 1);
      }
      pixels.fillRect(x + 3, y, 1, 1);
    } else if (kind === 7) {
      pixels.fillStyle = "#1b3448";
      pixels.fillRect(x, y + 1, 6, 4);
      pixels.fillStyle = plant?.output > 2 ? "#6cbfe6" : "#527994";
      pixels.fillRect(x + 1, y + 2, 2, 2);
      pixels.fillRect(x + 4, y + 2, 1, 2);
      pixels.fillStyle = "#a8cdd8";
      pixels.fillRect(x + 1, y + 5, 4, 1);
    } else if (kind === 12) {
      pixels.fillStyle = "#354351";
      pixels.fillRect(x, y + 4, 6, 2);
      pixels.fillStyle = "#b8c7cf";
      pixels.fillRect(x + 1, y + 1, 4, 4);
      pixels.fillRect(x + 2, y, 2, 1);
      pixels.fillStyle = plant?.output > 0 ? "#b8ec8e" : "#7a8792";
      pixels.fillRect(x + 2, y + 3, 2, 1);
    } else if (kind === 9) {
      pixels.fillStyle = "#234755";
      pixels.fillRect(x, y + 1, 6, 5);
      pixels.fillStyle = "#7eb0aa";
      pixels.fillRect(x + 1, y + 1, 4, 1);
      pixels.fillStyle = plant?.output > 0.15 ? "#8aedf0" : "#536e78";
      pixels.fillRect(x + 1 + frame % 3, y + 3, 2, 2);
    } else {
      pixels.fillStyle = "#653e3b";
      pixels.fillRect(x, y + 1, 6, 5);
      pixels.fillStyle = "#cf8e72";
      pixels.fillRect(x + 1, y - 2, 1, 5);
      pixels.fillRect(x + 4, y - 3, 2, 6);
      if (plant?.output > 0.15) {
        pixels.fillStyle = "#ffc782";
        pixels.fillRect(x + 1, y + 4, 4, 1);
        pixels.fillStyle = "#bab2a0a0";
        const rise = frame % 7;
        pixels.fillRect(x + 4 + Math.floor(rise / 2), y - 4 - rise, 2 + (rise >> 1), 2);
      }
    }
  }

  function roads(s) {
    for (const link of s.links) {
      const paving = Biosphere.townEra(s, s.towns[link.a]) >= 5 && Biosphere.townEra(s, s.towns[link.b]) >= 5;
      const width = paving ? 2 : 1;
      for (let i = 1; i <= Math.min(link.road.length - 1, Math.ceil(link.work)); i++) {
        const a = link.road[i - 1], b = link.road[i];
        if (s.water[a] > 0.27 || s.water[b] > 0.27 || s.lava[a] > 0.07 || s.lava[b] > 0.07) continue;
        const from = Biosphere.position(a), to = Biosphere.position(b);
        const dx = Math.sign((to.x - from.x + W * 1.5) % W - W / 2), dy = Math.sign(to.y - from.y);
        const run = Math.ceil(CELL * clamp(link.work - i + 1, 0, 1));
        const x = from.x * CELL + Math.min(0, dx * run), y = from.y * CELL + Math.min(0, dy * run);
        pixels.fillStyle = paving ? "#384b52" : "#d2a97a";
        pixels.fillRect(x - (dx === 0 ? 1 : 0), y - (dy === 0 ? 1 : 0), dx ? run + 1 : width, dy ? run + 1 : width);
        if (x < 0 || x + run >= WIDTH) {
          pixels.fillRect(x + (x < 0 ? WIDTH : -WIDTH), y - (dy === 0 ? 1 : 0), dx ? run + 1 : width, dy ? run + 1 : width);
        }
      }
    }
    if (s.airLink) {
      for (const town of [s.towns[s.airLink.a], s.towns[s.airLink.b]]) {
        if (!town || town.abandoned || s.water[town.home] > 0.27) continue;
        const p = Biosphere.position(town.home), x = Math.round(p.x * CELL), y = Math.round(p.y * CELL) + 5;
        pixels.fillStyle = "#253e4a";
        pixels.fillRect(x - 5, y, 10, 3);
        pixels.fillStyle = "#c2d4c9";
        for (const offset of [-4, -1, 2]) pixels.fillRect(x + offset, y + 1, 2, 1);
      }
    }
  }

  function traffic(s, blend) {
    for (const link of s.links) {
      if (!link.open) continue;
      const along = link.previous + (link.travel - link.previous) * blend;
      const leg = Math.min(link.road.length - 2, Math.floor(along));
      const from = Biosphere.position(link.road[leg]), to = Biosphere.position(link.road[leg + 1]);
      const { x, y } = movingPixel({ ...to, previousX: from.x, previousY: from.y }, along - leg);
      if (!link.motor) {
        person({ x: x / CELL, y: y / CELL }, "field", Math.floor(s.time * 8), 1, "#d9c581");
        continue;
      }
      const forward = link.travel >= link.previous ? 1 : -1;
      pixels.save();
      pixels.translate(x, y);
      pixels.rotate(Math.atan2(to.y - from.y, (to.x - from.x + W * 1.5) % W - W / 2) + (forward < 0 ? Math.PI : 0));
      pixels.fillStyle = "#162c38";
      pixels.fillRect(-4, -2, 8, 5);
      pixels.fillStyle = "#e9af65";
      pixels.fillRect(-4, -2, 5, 3);
      pixels.fillStyle = "#97dedc";
      pixels.fillRect(2, -1, 2, 2);
      pixels.restore();
    }
    const flight = s.airLink;
    if (!flight || flight.at === null) return;
    const a = s.towns[flight.reverse ? flight.b : flight.a], b = s.towns[flight.reverse ? flight.a : flight.b];
    const from = Biosphere.position(a.home), to = Biosphere.position(b.home);
    const t = clamp((s.time + blend * Biosphere.STEP - flight.at) / flight.duration, 0, 1);
    const { x, y } = movingPixel({ ...to, previousX: from.x, previousY: from.y }, t);
    const altitude = Math.round(Math.sin(t * Math.PI) * 9);
    pixels.fillStyle = "#182a3a70";
    pixels.fillRect(x - 4, y + 3, 9, 2);
    pixels.save();
    pixels.translate(x, y - altitude);
    pixels.rotate(Math.atan2(to.y - from.y, (to.x - from.x + W * 1.5) % W - W / 2));
    pixels.fillStyle = "#315a72";
    pixels.fillRect(-6, -2, 13, 4);
    pixels.fillStyle = "#e5f2dc";
    pixels.fillRect(-5, -1, 11, 2);
    pixels.fillRect(-1, -4, 3, 8);
    pixels.fillRect(-4, -3, 1, 6);
    pixels.restore();
  }

  function harbors(s, frame) {
    for (const port of s.ports) {
      const town = s.towns[port.town];
      const ruin = port.town === -1;
      if (!ruin && (!town || town.abandoned)) continue;
      const land = position(port.land), sea = position(port.water);
      const x = Math.round(land.x * CELL), y = Math.round(land.y * CELL);
      const heading = Math.atan2(sea.y - land.y, (sea.x - land.x + W * 1.5) % W - W / 2);
      const offsets = x < 14 ? [0, WIDTH] : x > WIDTH - 14 ? [0, -WIDTH] : [0];
      for (const offset of offsets) {
        pixels.save(); pixels.translate(x + offset, y); pixels.rotate(heading);
        pixels.fillStyle = "#263a40"; pixels.fillRect(-2, -3, 11, 6);
        pixels.fillStyle = ruin ? "#67605b" : "#9d7953"; pixels.fillRect(-2, -2, ruin ? 6 : 10, 4);
        pixels.fillStyle = ruin ? "#8a8071" : "#dbc38a";
        for (let i = -1; i < 8; i += 3) pixels.fillRect(i, -2, 1, ruin ? 2 : 4);
        pixels.fillStyle = "#54473d"; pixels.fillRect(6, -4, 2, 2); pixels.fillRect(6, 2, 2, 2);
        pixels.restore();
        if (ruin) continue;
        pixels.fillStyle = "#39434b"; pixels.fillRect(x + offset - 3, y - 7, 1, 6);
        pixels.fillStyle = (town.civilizationColor ?? Biosphere.REALMS[town.realm].color);
        pixels.fillRect(x + offset - 2, y - 7, 3 + frame % 2, 2);
      }
    }
  }

  function boats(s, frame, blend) {
    for (const boat of s.boats) {
      const { x, y } = movingPixel(boat, blend);
      const realm = boat.kind === "landing" ? boat.color ?? Biosphere.REALMS[boat.realm].color : Biosphere.REALMS[boat.realm].color;
      const offsets = x < 18 ? [0, WIDTH] : x > WIDTH - 18 ? [0, -WIDTH] : [0];
      for (const offset of offsets) {
        pixels.save(); pixels.translate(x + offset, y); pixels.rotate(boat.heading);
        if (!boat.blocked) {
          pixels.fillStyle = "#a8e6df85";
          const wake = (frame + boat.id) % 4;
          pixels.fillRect(-12 - wake, -2, 3, 1); pixels.fillRect(-12 - wake, 2, 3, 1);
          if (boat.era >= 6) pixels.fillRect(-17 - wake, 0, 3, 1);
        }
        if (boat.era < 5) {
          pixels.fillStyle = "#3d3837"; pixels.fillRect(-6, -4, 12, 8);
          pixels.fillStyle = "#ac8954"; pixels.fillRect(-5, -3, 10, 6);
          pixels.fillStyle = "#e0bd79";
          for (const row of [-3, 0, 3]) pixels.fillRect(-5, row, 10, 1);
          pixels.fillStyle = "#69553e"; pixels.fillRect(-4, -1, 8, 1);
          pixels.fillStyle = realm; pixels.fillRect(-2, -2, 2, 2); pixels.fillRect(1, 1, 2, 2);
          pixels.fillStyle = "#ffdfb2"; pixels.fillRect(-2, -3, 2, 1); pixels.fillRect(1, 0, 2, 1);
          pixels.fillStyle = "#bcb389";
          pixels.fillRect(boat.id % 2 ? 1 : -2, -6, 1, 3);
          pixels.fillRect(boat.id % 2 ? -2 : 1, 3, 1, 3);
        } else {
          pixels.fillStyle = "#1a303c"; pixels.fillRect(-8, -4, 14, 8); pixels.fillRect(6, -2, 3, 4);
          pixels.fillStyle = boat.era >= 6 ? "#a6c4c7" : "#a87548";
          pixels.fillRect(-7, -3, 13, 6); pixels.fillRect(6, -1, 2, 2);
          pixels.fillStyle = realm; pixels.fillRect(-7, -3, 3, 6);
          if (boat.era >= 6) {
            pixels.fillStyle = "#eef0da"; pixels.fillRect(0, -3, 5, 6);
            pixels.fillStyle = "#45798d"; pixels.fillRect(3, -2, 2, 4);
            pixels.fillStyle = "#dca866"; pixels.fillRect(-4, -2, 3, 3);
            pixels.fillStyle = "#344b57"; pixels.fillRect(0, -2, 1, 4);
          } else {
            pixels.fillStyle = "#5b4b42"; pixels.fillRect(-1, -7, 1, 14);
            pixels.fillStyle = "#f1e7bb"; pixels.fillRect(0, -6, 2, 12); pixels.fillRect(2, -4, 3, 8); pixels.fillRect(5, -2, 2, 4);
            pixels.fillStyle = realm; pixels.fillRect(0, -8, 3, 2);
          }
          if (boat.kind === "settle") {
            pixels.fillStyle = "#e6b37b"; pixels.fillRect(-5, 0, 2, 2);
            pixels.fillStyle = "#e9d29a"; pixels.fillRect(-5, -2, 2, 1);
          }
        }
        if (boat.kind === "landing") {
          pixels.fillStyle = "#291b29"; pixels.fillRect(-3, -12, 8, 5);
          pixels.fillStyle = realm; pixels.fillRect(-2, -11, 6, 3);
          pixels.fillStyle = "#ffd7b1"; pixels.fillRect(0, -11, 2, 3);
        }
        if (boat.blocked) {
          pixels.fillStyle = "#ffc581"; pixels.fillRect(-1, -10, 2, 3); pixels.fillRect(-1, -6, 2, 1);
        }
        pixels.restore();
      }
    }
  }

  function city(s, frame) {
    const { plots, urban: kind } = s;
    const plants = new Map(s.power.plants.map(plant => [plant.tile, plant]));
    for (const i of plots) {
      const x = i % W * CELL, y = Math.floor(i / W) * CELL;
      const damage = s.damage[i];
      const town = s.towns[s.plotTown[i] - 1], era = Biosphere.townEra(s, town);
      if (damage >= 0.78) {
        pixels.fillStyle = "#554b4d";
        pixels.fillRect(x + 1, y + 2, 4, 4);
        pixels.fillStyle = "#ad9887";
        pixels.fillRect(x + 1, y + 3, 2, 1);
        pixels.fillRect(x + 4, y + 4, 1, 1);
      } else if (kind[i] === 1) {
        pixels.fillStyle = "#344957";
        pixels.fillRect(x + 2, y + 2, 2, 2);
        if (kind[s.west[i]]) pixels.fillRect(x, y + 2, 3, 2);
        if (kind[s.east[i]]) pixels.fillRect(x + 3, y + 2, 3, 2);
        if (kind[s.north[i]]) pixels.fillRect(x + 2, y, 2, 3);
        if (kind[s.south[i]]) pixels.fillRect(x + 2, y + 3, 2, 3);
        if (era >= 6 && (frame + i) % 19 < 4) {
          pixels.fillStyle = "#f2d794";
          pixels.fillRect(x + 2, y + 2, 1, 1);
        }
      } else if (kind[i] === 2) {
        const frozen = s.temperature[i] < 0.19;
        pixels.fillStyle = frozen ? "#5b6d73" : s.wet[i] > 0.26 ? "#485b46" : "#6d5a42";
        pixels.fillRect(x, y, CELL, CELL);
        pixels.fillStyle = frozen ? "#b9d6d6" : s.wet[i] > 0.26 ? "#a7b875" : "#ba9458";
        for (const row of [1, 3, 5]) pixels.fillRect(x + 1, y + row, 4, 1);
      } else if (kind[i] === 5) {
        factory(s, town, x, y, frame, i);
      } else if (kind[i] === Biosphere.STATION_TILE) {
        const station = s.stations.find(station => station.tile === i);
        const active = station && !station.destroyed && station.fraction > 0.1;
        pixels.fillStyle = "#304051";
        pixels.fillRect(x, y + 2, 6, 4);
        pixels.fillStyle = "#9eb5c5";
        pixels.fillRect(x + 1, y + 1, 4, 2);
        pixels.fillRect(x + 3, y - 2, 1, 3);
        pixels.fillStyle = active ? ({ heat: "#ffc28a", cool: "#86efd1", dry: "#edcb7c", wet: "#81bfff" }[station.mode] ?? "#86efd1") : "#7f8997";
        pixels.fillRect(x + 1 + (active ? frame % 3 : 0), y + 4, 2, 1);
      } else if (kind[i] === 11) {
        pixels.fillStyle = "#564a42"; pixels.fillRect(x,y+1,6,5);
        pixels.fillStyle = "#1b2730"; pixels.fillRect(x+1,y+2,4,3);
        pixels.fillStyle = "#ceaa6e"; pixels.fillRect(x,y,1,6); pixels.fillRect(x+5,y,1,6); pixels.fillRect(x,y,6,1);
        if (frame % 4 < 2) { pixels.fillStyle = "#a1dfda"; pixels.fillRect(x+2,y+3,2,1); }
      } else if (kind[i] >= 6) {
        powerSite(kind[i], x, y, plants.get(i), frame);
      } else {
        const landmark = kind[i] === 4;
        const tower = era >= 6 && (landmark || hash(i, 4, s.seed) > (town?.count >= 100 ? .22 : .46));
        pixels.fillStyle = era >= 5 ? "#61747a" : "#7e674f";
        pixels.fillRect(x, y, CELL, CELL);
        pixels.fillStyle = "#263745";
        pixels.fillRect(x + 2, y + 2, 4, 4);
        pixels.fillStyle = damage > 0.26 ? "#a18c7b" : tower ? "#a8c9c9" : landmark ? "#f4ca8d" : "#d8b690";
        pixels.fillRect(x + 1, y + (tower ? 0 : 1), tower ? 3 : 4, tower ? 5 : 3);
        pixels.fillStyle = damage > 0.26 || era >= 6 && s.power.strain > 0.48 ? "#4f4144" : "#fff0b6";
        pixels.fillRect(x + 2, y + 2, 1, 1);
        if (tower) {
          pixels.fillRect(x + 2, y + 4, 1, 1);
          if(town?.count>=80) {pixels.fillStyle="#6d909f";pixels.fillRect(x+4,y,2,5);pixels.fillStyle="#ffe7a6";pixels.fillRect(x+4,y+1,1,1);pixels.fillRect(x+4,y+3,1,1);}
        }
      }
      if (s.water[i] > 0.35) {
        pixels.fillStyle = s.water[i] > 0.80 ? "#317b9ccc" : "#449ab293";
        pixels.fillRect(x, y, CELL, CELL);
        pixels.fillStyle = "#ace5e39c";
        pixels.fillRect(x + (frame + i) % 4, y + 3, 2, 1);
      }
      if (kind[i] === 4 && town && !town.abandoned && damage < 0.78 && s.water[i] < 0.48) {
        pixels.fillStyle = "#313943";
        pixels.fillRect(x + 4, y - 2, 1, 5);
        pixels.fillStyle = (town.civilizationColor ?? Biosphere.REALMS[town.realm].color);
        pixels.fillRect(x + 5, y - 2, 3, 2);
        if (town.cold > 0.22) {
          pixels.fillStyle = (frame + i) % 4 ? "#ffc077" : "#ffe7aa";
          pixels.fillRect(x + 1, y + 3, 2, 2);
        }
      }
    }
  }

  function monuments(s) {
    for (const monument of s.monuments) {
      const x = monument.tile % W * CELL, y = Math.floor(monument.tile / W) * CELL;
      const progress = monument.work / Biosphere.MONUMENT_TIME;
      const flooded = s.water[monument.tile] > 0.52;
      pixels.fillStyle = flooded ? "#39677a" : "#5f5e66";
      pixels.fillRect(x - 1, y + 3, 8, 3);
      pixels.fillStyle = flooded ? "#79a2a9" : "#b8aea2";
      pixels.fillRect(x, y + 3, 6, 1);
      if (progress < 0.28) continue;
      const height = Math.floor(progress * 7);
      pixels.fillRect(x + 1, y + 3 - height, 4, height);
      pixels.fillStyle = "#6f696e";
      pixels.fillRect(x + 4, y + 3 - height, 1, height);
      if (monument.builtAt !== null) {
        pixels.fillStyle = "#eadcc4";
        pixels.fillRect(x + 2, y - 5, 2, 2);
        pixels.fillStyle = monument.town ? Biosphere.REALMS[monument.realm].color : "#7c776f";
        pixels.fillRect(x + 2, y, 2, 1);
      }
    }
  }

  function life(s, inhabited, blend) {
    if (s.era === 1 && s.microbes) for (let i = 0; i < s.microbes.length; i++) {
      const density = s.microbes[i];
      if (density < 0.1 || (s.bioProfile === "cold" ? s.water[i] + s.ice[i] < 0.32 : s.bioProfile === "warm" ? s.ice[i] >= 0.24 : s.water[i] < 0.32)) continue;
      const x = i % W * CELL, y = Math.floor(i / W) * CELL;
      pixels.fillStyle = s.bioProfile === "warm" ? density > 0.5 ? "#efcf85" : "#ad8d60" : density > 0.5 ? "#7ee5b6" : "#4b9f9d";
      pixels.fillRect(x + (i % 3) + 1, y + (i % 4) + 1, 1, 1);
      if (density > 0.35) pixels.fillRect(x + 4, y + 2, 1, 1);
      if (density > 0.7) pixels.fillRect(x + 2, y + 4, 1, 1);
    }
    for (const group of s.faunaEvolution?.schools ?? []) {
      if (group.size <= 0.03) continue;
      const x = group.tile % W * CELL + 1, y = Math.floor(group.tile / W) * CELL + 3;
      pixels.fillStyle = group.coastal ? "#8ccda0" : "#7ed6e8";
      pixels.fillRect(x + 1, y - 1, 3, 2);
      pixels.fillRect(x, y, 1, 2);
      if (group.size > 0.22) pixels.fillRect(x + 3, y + 2, 2, 1);
    }
    for (const herd of s.herds) {
      if (herd.size < 0.04) continue;
      animal(herd, "#ead498", blend);
      if (herd.size > 0.4) animal(herd, "#c9ab77", blend, -4, 3);
      if (herd.size > 0.65) animal(herd, "#d7bb8d", blend, 5, -3);
    }
    for (const pack of s.packs) if ((pack.energy ?? 1) > 0.03) animal(pack, "#de9075", blend);
    if (!inhabited) return;
    const stride = Math.floor((s.time + blend * Biosphere.STEP) * 8);
    for (const town of s.towns) {
      for (const walker of town.walkers ?? []) {
        if (!walker.errand) continue;
        const { task } = walker.errand;
        person(walker, task, stride, blend, walker.collected && carried[task]);
      }
    }
    for (const tribe of s.tribes) {
      if (tribe.goal) person(tribe, "migrant", stride, blend);
      if (tribe.hunter) {
        const hunter = tribe.hunter;
        person(hunter, "hunter", stride, blend, hunter.cargo > 0 ? "#f8d687" : "#ae7951");
      }
    }
    for (const trip of s.expeditions) {
      const color = Biosphere.REALMS[trip.realm].color;
      person(trip, "migrant", stride, blend, "#bba389", color, -5);
      person(trip, "migrant", stride + 1, blend, "#d9b888", color);
    }
    for (const c of s.communities ?? []) {
      if (!c.active) continue;
      const color = Biosphere.REALMS[c.realm].color;
      for (const guard of c.patrols ?? []) person(guard, "migrant", stride, blend, "#a8bac2", color);
      const job = c.job;
      if (!job) continue;
      if (job.kind === "gift" && job.leg === "sea") {
        const { x, y } = movingPixel(job, blend);
        pixels.fillStyle = "#9e774c"; pixels.fillRect(x - 4, y, 9, 3); pixels.fillRect(x - 2, y + 3, 5, 1);
        pixels.fillStyle = color; pixels.fillRect(x, y - 5, 1, 5); pixels.fillRect(x + 1, y - 5, 3, 3);
        if (!job.delivered) { pixels.fillStyle = "#f5d68b"; pixels.fillRect(x - 2, y - 2, 2, 2); }
      } else {
        const carrying = job.kind === "gift" && !job.delivered || job.cargo > 0 ? "#f5d68b" : job.kind === "guard" ? "#a8bac2" : job.kind === "faith" ? "#e8ddff" : "#ae7951";
        person(job, job.kind === "gather" && job.prey >= 0 ? "hunter" : "gather", stride, blend, carrying, color, -3);
        person(job, "gather", stride + 1, blend, null, color, 3);
      }
    }
  }

  function combat(s, blend) {
    const battle = s.battle;
    if (!battle) return;
    const time = s.time + blend * Biosphere.STEP, stride = Math.floor(time * 8);
    const units = battle.units.filter(unit => unit.hp > 0).sort((a, b) => Number(a.tank) - Number(b.tank));
    for (const unit of units) {
      const color = Biosphere.REALMS[unit.realm].color;
      if (!unit.tank) {
        person(unit, "migrant", stride, blend, "#99765f", color, (unit.id % 3 - 1) * 2);
        continue;
      }
      const { x, y } = movingPixel(unit, blend);
      const left = unit.direction < 0;
      pixels.fillStyle = "#26353d";
      pixels.fillRect(x - 5, y - 2, 10, 5);
      pixels.fillStyle = color;
      pixels.fillRect(x - 4, y - 1, 8, 2);
      pixels.fillStyle = "#bdccbb";
      pixels.fillRect(x - 1, y - 3, 3, 2);
      pixels.fillRect(left ? x - 7 : x + 1, y - 3, 7, 1);
      pixels.fillStyle = "#6e7c7a";
      pixels.fillRect(x - 3 + stride % 2, y + 2, 5, 1);
    }
    for (const shot of battle.shots) {
      const t = clamp((time - shot.at) / shot.duration, 0, 1);
      const point = movingPixel({ ...shot.to, previousX: shot.from.x, previousY: shot.from.y }, t);
      const y = point.y - Math.round(Math.sin(t * Math.PI) * (shot.shell ? 2 : 7));
      pixels.fillStyle = shot.shell ? "#ffcc82" : "#f2dfbd";
      pixels.fillRect(point.x, y - 3, shot.shell ? 3 : 2, 2);
    }
    const spark = battle.spark;
    if (spark && time - spark.at < 0.38) {
      const { x, y } = movingPixel(spark, 1);
      pixels.fillStyle = spark.shell ? "#ffc891" : "#e8cdac";
      pixels.fillRect(x - 1, y - 4, 3, 1);
      pixels.fillRect(x, y - 5, 1, 3);
    }
  }

  function lightning(s) {
    if (!s.lightning || s.time - s.lightning.time > 0.53) return;
    const point = position(s.lightning.tile);
    const x = Math.floor(point.x * CELL), y = Math.floor(point.y * CELL);
    pixels.fillStyle = "#ffedb13d";
    pixels.fillRect(x - 6, y - 9, 14, 12);
    pixels.fillStyle = "#fff6bf";
    pixels.fillRect(x + 3, y - 12, 2, 5);
    pixels.fillRect(x, y - 8, 5, 2);
    pixels.fillRect(x, y - 6, 2, 6);
  }

  function springs(s, frame) {
    for (const i of s.springs) {
      const x = i % W * CELL, y = Math.floor(i / W) * CELL;
      const frozen = s.temperature[i] < Biosphere.FREEZE_AT;
      pixels.fillStyle = "#284750";
      pixels.fillRect(x + 1, y + 3, 4, 2);
      pixels.fillStyle = frozen ? "#c1e4ee" : "#7cefe6";
      pixels.fillRect(x + 2, y + 3, 2, 1);
      const rise = frozen ? 1 : (frame + i) % 3;
      pixels.fillRect(x + 3, y + 2 - rise, 1, 1);
    }
  }

  function volcanoes(s, frame, blend) {
    if (s.lavaArea) {
      for (let i = 0; i < s.lava.length; i++) {
        const depth = s.lava[i];
        if (depth <= 0.012) continue;
        const x = i % W * CELL, y = Math.floor(i / W) * CELL;
        pixels.fillStyle = depth > 0.25 ? "#8e3534" : "#704042";
        pixels.fillRect(x, y, CELL, CELL);
        pixels.fillStyle = depth > 0.25 ? "#ef713d" : "#c75638";
        pixels.fillRect(x + 1, y + 1, 4, 4);
        if (depth > 0.09) {
          pixels.fillStyle = "#ffb462";
          pixels.fillRect(x + 1 + (frame + i) % 3, y + 2 + i % 2, 2, 1);
        }
      }
    }
    for (const vent of s.volcanoes) {
      const x = vent.tile % W * CELL, y = Math.floor(vent.tile / W) * CELL;
      pixels.fillStyle = "#3f3338";
      pixels.fillRect(x, y + 3, 6, 3);
      pixels.fillRect(x + 1, y + 1, 4, 3);
      pixels.fillStyle = "#ffad5c";
      pixels.fillRect(x + 2, y + 1, 2, 2);
    }
    for (const ember of s.embers) {
      const origin = position(ember.from), target = position(ember.target);
      const t = clamp((s.time + blend * Biosphere.STEP - ember.at) / ember.duration, 0, 1);
      const { x, y } = movingPixel({ ...target, previousX: origin.x, previousY: origin.y }, t);
      const rise = Math.round(Math.sin(t * Math.PI) * 12);
      pixels.fillStyle = "#be513b";
      pixels.fillRect(x - 1, y - rise + 1, 3, 2);
      pixels.fillStyle = "#ffe1a2";
      pixels.fillRect(x, y - rise, 2, 2);
    }
  }

  function cursor(ctx, frame, from, to, tool, radius) {
    if (!to) return;
    const factor = frame.unit;
    if (tool === "spring" || tool === "volcano" || tool === "station" || tool === "hydro") {
      const x = frame.x + Math.floor(to.x) * factor, y = frame.y + Math.floor(to.y) * factor;
      const color = tool === "volcano" ? "#ffad5c" : "#7cefe6";
      if (tool === "station") {
        ctx.fillStyle = color + "12";
        ctx.beginPath();
        ctx.arc(x + factor / 2, y + factor / 2, Biosphere.STATION_REACH * factor, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = color + "38";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.fillRect(x, y, factor, factor);
      ctx.strokeRect(x, y, factor, factor);
      return;
    }
    const x = frame.x + to.x * factor, y = frame.y + to.y * factor;
    const color = tool === "heat" ? "#ffd091" : tool === "cold" || tool === "channel" ? "#a0eaff" : tool === "ridge" ? "#f3bd8b" : "#c6ffeb";
    if (tool === "channel" || tool === "ridge") radius *= TERRAIN_RADIUS;
    const length = from ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    if (tool !== "wind" || length < 0.65) {
      ctx.fillStyle = color + "18";
      ctx.beginPath();
      ctx.arc(x, y, radius * factor, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      return;
    }
    const sx = frame.x + from.x * factor, sy = frame.y + from.y * factor;
    const reach = Math.min(1, WIND_REACH / length);
    const ex = sx + (x - sx) * reach, ey = sy + (y - sy) * reach;
    const angle = Math.atan2(ey - sy, ex - sx);
    ctx.strokeStyle = color + "24";
    ctx.lineWidth = 2 * radius * factor;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.moveTo(ex - 9 * Math.cos(angle - 0.54), ey - 9 * Math.sin(angle - 0.54));
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex - 9 * Math.cos(angle + 0.54), ey - 9 * Math.sin(angle + 0.54));
    ctx.stroke();
  }

  function nuclearCloud(x, y, age) {
    const scale = clamp(age / 2.8, 0, 1), fade = clamp((9 - age) / 4, 0, 1);
    const crownY = y - (0.65 + scale * 3.25 + age * 0.10) * CELL;
    const width = (0.9 + scale * 2.5 + age * 0.08) * CELL;
    const height = (0.6 + scale * 0.6) * CELL;
    const stem = (0.22 + scale * 0.32) * CELL;
    pixels.globalAlpha = 0.88 * fade;
    pixels.fillStyle = "#5e444d";
    pixels.fillRect(Math.round(x - stem), Math.round(crownY), Math.ceil(stem * 2), Math.ceil(y - crownY));
    pixels.fillStyle = "#926966";
    pixels.fillRect(Math.round(x - stem * 0.2), Math.round(crownY), Math.ceil(stem), Math.ceil((y - crownY) * 0.86));
    for (let row = -2; row <= 2; row++) {
      const span = width * (1 - Math.abs(row) * 0.17), band = height / 2.5;
      pixels.fillStyle = row < 0 ? (age < 2.1 ? "#ffcc8b" : "#a5847c")
        : row === 0 ? "#bd8f7c" : "#705459";
      pixels.fillRect(Math.round(x - span), Math.round(crownY + row * band), Math.ceil(span * 2), Math.ceil(band + 0.5));
    }
    pixels.fillStyle = "#7f6165";
    pixels.fillRect(Math.round(x - width * 0.64), Math.round(y - CELL * 0.35), Math.ceil(width * 1.28), Math.ceil(CELL * 0.48));
  }

  function contaminationOverlay(s) {
    pixels.save();
    for (const index in s.contamination) {
      const tile = Number(index), remaining = s.contamination[index] - s.time;
      if (remaining <= 0) continue;
      const p = position(tile), x = (p.x - 0.5) * CELL, y = (p.y - 0.5) * CELL;
      pixels.globalAlpha = 0.24 + clamp(remaining / 100, 0, 1) * 0.33;
      pixels.fillStyle = "#ad64bd";
      pixels.fillRect(x, y, CELL, CELL);
      pixels.globalAlpha = 0.68;
      pixels.fillStyle = "#dba6da";
      if (!Biosphere.contaminated(s, s.west[tile])) pixels.fillRect(x, y, 1, CELL);
      if (!Biosphere.contaminated(s, s.east[tile])) pixels.fillRect(x + CELL - 1, y, 1, CELL);
      if (!Biosphere.contaminated(s, s.north[tile])) pixels.fillRect(x, y, CELL, 1);
      if (!Biosphere.contaminated(s, s.south[tile])) pixels.fillRect(x, y + CELL - 1, CELL, 1);
    }
    pixels.restore();
  }

  function missiles(s, blend) {
    const w = s.warfare;
    if (!w) return;
    const time = s.time + blend * Biosphere.STEP;
    pixels.save();
    for (const shot of w.flights) {
      const a = position(shot.from), b = position(shot.to);
      const dx = ((b.x - a.x + W * 1.5) % W) - W / 2;
      const progress = clamp((time - shot.start) / (shot.end - shot.start), 0, 1);
      const at = t => [(a.x + dx * t) * CELL, (a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 3) * CELL];
      const [x, y] = at(progress), [tailX, tailY] = at(Math.max(0, progress - 0.13));
      pixels.strokeStyle = shot.type === "nuclear" ? "#ffeabc" : "#ffc382";
      pixels.fillStyle = "#fff7de";
      for (const offset of [-W * CELL, 0, W * CELL]) {
        pixels.globalAlpha = 0.75;
        pixels.beginPath(); pixels.moveTo(tailX + offset, tailY); pixels.lineTo(x + offset, y); pixels.stroke();
        pixels.globalAlpha = 1; pixels.fillRect(x + offset - 1, y - 1, 3, 3);
      }
    }
    for (const hit of w.impacts) {
      const age = time - hit.time;
      const point = position(hit.tile), nuclear = hit.type === "nuclear";
      if (age < 0 || age >= (nuclear ? 9 : 4)) continue;
      const x = point.x * CELL, y = point.y * CELL;
      pixels.strokeStyle = nuclear ? "#ffe9a9" : "#f8a86f";
      pixels.fillStyle = nuclear ? "#fff2c7" : "#ffb36f";
      for (const offset of [-W * CELL, 0, W * CELL]) {
        const waveTime = nuclear ? 3 : 4;
        if (age < waveTime) {
          const wave = age / waveTime;
          pixels.lineWidth = nuclear ? 2 : 1;
          pixels.globalAlpha = (nuclear ? 0.92 : 0.7) * (1 - wave);
          pixels.beginPath(); pixels.arc(x + offset, y, (0.2 + hit.radius * wave) * CELL, 0, 2 * Math.PI); pixels.stroke();
        }
        if (nuclear && age >= 0.24) nuclearCloud(x + offset, y, age);
        if (age < 0.6) {
          const flash = (nuclear ? 3.6 : 1) * CELL;
          pixels.fillStyle = nuclear ? "#fff2c7" : "#ffb36f";
          pixels.globalAlpha = 0.78 * (1 - age / 0.6);
          pixels.fillRect(x + offset - flash / 2, y - flash / 2, flash, flash);
        }
      }
    }
    pixels.restore();
  }

  function render(ctx, view, camera, world, now, { pointer, from, tool, radius, focusTile }) {
    const s = world.biosphere;
    const frame = Math.floor(now * 8);
    const blend = clamp(world.weatherClock / Biosphere.STEP, 0, 1);
    terrain(s, frame);
    if (s.contamination) contaminationOverlay(s);
    borders(s);
    roads(s);
    city(s, frame);
    harbors(s, frame);
    monuments(s);
    weather(s, frame, blend);
    springs(s, frame);
    volcanoes(s, frame, blend);
    life(s, world.pop > 0, blend);
    traffic(s, blend);
    boats(s, frame, blend);
    combat(s, blend);
    missiles(s, blend);
    lightning(s);
    const impact = s.lastImpact;
    if (impact && s.time - impact.time < 3.4) {
      const age = s.time - impact.time + blend * Biosphere.STEP;
      const x = (impact.tile % W + 0.5) * CELL, y = (Math.floor(impact.tile / W) + 0.5) * CELL;
      pixels.strokeStyle = "#ffc085";
      pixels.lineWidth = 2;
      pixels.globalAlpha = 0.85 * clamp(1 - age / 3.4, 0, 1);
      for (const offset of [-W * CELL, 0, W * CELL]) {
        pixels.beginPath();
        pixels.arc(x + offset, y, (1 + impact.radius * 1.4 * age / 3.4) * CELL, 0, Math.PI * 2);
        pixels.stroke();
      }
      pixels.globalAlpha = 1;
    }
    const { w, h, dpr } = view;
    const box = bounds(view, camera);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#080e1a";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.left - 1, box.top - 1, box.width + 2, box.height + 2);
    ctx.clip();
    ctx.strokeStyle = "#304556";
    ctx.lineWidth = 1;
    ctx.strokeRect(box.x - 1, box.y - 1, W * box.unit + 2, H * box.unit + 2);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(paper, box.x, box.y, W * box.unit, H * box.unit);
    ctx.beginPath();
    ctx.rect(box.x, box.y, W * box.unit, H * box.unit);
    ctx.clip();
    if (Number.isInteger(focusTile)) {
      const point = position(focusTile), x = box.x + point.x * box.unit, y = box.y + point.y * box.unit;
      const station = s.stations.find(station => station.tile === focusTile);
      ctx.strokeStyle = station?.mode === "heat" ? "#ffc28a" : "#9bffe0";
      ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      if (station && !station.destroyed) { ctx.beginPath(); ctx.arc(x, y, Biosphere.STATION_REACH * box.unit, 0, Math.PI * 2); ctx.stroke(); }
      ctx.setLineDash([]); ctx.strokeRect(x - box.unit, y - box.unit, box.unit * 2, box.unit * 2);
    }
    cursor(ctx, box, from, pointer, tool, radius);
    ctx.restore();
  }

  function point(view, camera, { x, y }, contain = false) {
    const box = bounds(view, camera);
    const sx = clamp(x, box.left, box.left + box.width), sy = clamp(y, box.top, box.top + box.height);
    if (!contain && (sx !== x || sy !== y)) return null;
    const px = (sx - box.x) / box.unit, py = (sy - box.y) / box.unit;
    if (!contain && (px < 0 || px >= W || py < 0 || py >= H)) return null;
    return { x: clamp(px, 0, W - 0.001), y: clamp(py, 0, H - 0.001) };
  }

  return { FIT, MAX_ZOOM, bounds, zoomAt, pan, render, point };
})();
