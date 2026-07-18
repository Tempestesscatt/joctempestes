/**
 * mapaicon.js - Visor ICON-EU amb streamlines + popup + selector d'altura de vent
 */
(function () {
  "use strict";

  const DATA_BASE = "icon_eu_storm_json";
  const BORDERS_BASE = "dades";
  const DEFAULT_RUN = "00";
  const TILE_SIZE = 256;

  const BORDER_GEOJSON_FILES = [
    "espanya_provincies.geojson",
    "catalunya_comarques.geojson",
    "catalunya_france.geojson",
    "girona_comarques.geojson",
    "lleida_comarques.geojson",
    "tarragona_comarques.geojson",
    "corse_regioni.geojson",
    "italia_regioni.geojson",
  ];

  const VARIABLES = {
    vmax_10m: { label: "Ratxes de vent (10m)", unit: "m/s", domain: [0, 35], palette: ["#2b6cb0","#4fb0c6","#f6e05e","#ed8936","#c53030"], isWind: true, decimals: 1 },
    u_10m: { label: "Vent zonal u (10m)", unit: "m/s", domain: [-20, 20], palette: ["#2b6cb0","#4fb0c6","#f6e05e","#ed8936","#c53030"], isWind: true, decimals: 1 },
    v_10m: { label: "Vent meridional v (10m)", unit: "m/s", domain: [-20, 20], palette: ["#2b6cb0","#4fb0c6","#f6e05e","#ed8936","#c53030"], isWind: true, decimals: 1 },
    cape_ml: { label: "CAPE (energia convectiva)", unit: "J/kg", domain: [0, 3000], palette: ["#2d3748","#2b6cb0","#38a169","#ecc94b","#c53030"], decimals: 0 },
    cin_ml: { label: "CIN (inhibicio convectiva)", unit: "J/kg", domain: [-300, 0], palette: ["#c53030","#ed8936","#ecc94b","#a0aec0","#2d3748"], decimals: 0 },
    lpi_con_max: { label: "Potencial de llamps", unit: "J/kg", domain: [0, 50], palette: ["#2d3748","#553c9a","#b83280","#ed8936","#f6e05e"], decimals: 1 },
    tot_prec: { label: "Precipitacio acumulada", unit: "mm", domain: [0, 50], palette: ["#f7fafc","#90cdf4","#4299e1","#2b6cb0","#1a365d"], decimals: 1 },
    rain_con: { label: "Pluja convectiva", unit: "mm", domain: [0, 30], palette: ["#f7fafc","#9ae6b4","#38a169","#2f855a","#1c4532"], decimals: 1 },
    t_2m: { label: "Temperatura (2m)", unit: "°C", domain: [-5, 40], palette: ["#2b6cb0","#4fb0c6","#f6e05e","#ed8936","#c53030"], kelvinToCelsius: true, decimals: 1 },
    td_2m: { label: "Punt de rosada (2m)", unit: "°C", domain: [-10, 25], palette: ["#2b6cb0","#4fb0c6","#9ae6b4","#38a169","#1c4532"], kelvinToCelsius: true, decimals: 1 },
    pmsl: { label: "Pressio a nivell del mar", unit: "hPa", domain: [990, 1030], palette: ["#c53030","#ed8936","#f6e05e","#4fb0c6","#2b6cb0"], paToHpa: true, decimals: 1 },
    clct: { label: "Nuvolositat total", unit: "%", domain: [0, 100], palette: ["#f7fafc","#cbd5e0","#a0aec0","#718096","#2d3748"], decimals: 0 },
    hzerocl: { label: "Alcada nivell 0°C", unit: "m", domain: [0, 4500], palette: ["#1a365d","#2b6cb0","#4fb0c6","#ecc94b","#c53030"], decimals: 0 },
  };

  const WIND_VARS = ["vmax_10m", "u_10m", "v_10m"];

  // Mapeig d'altures de vent
  const WIND_LEVELS = {
    "10m": { u: "u_10m", v: "v_10m", label: "10m" },
    "925hPa": { u: "u", v: "v", level: 925, label: "925hPa" },
    "850hPa": { u: "u", v: "v", level: 850, label: "850hPa" },
    "700hPa": { u: "u", v: "v", level: 700, label: "700hPa" },
    "500hPa": { u: "u", v: "v", level: 500, label: "500hPa" },
    "300hPa": { u: "u", v: "v", level: 300, label: "300hPa" },
    "200hPa": { u: "u", v: "v", level: 200, label: "200hPa" },
  };

  const FALLBACK_STEPS = Array.from({ length: 79 }, (_, i) => ({ step: i, valid_time_utc: null }));

  const wCfg = { streamlineColor: "black", streamlineOpacity: 0.8, streamlineWidth: 1.2 };
  window.ventEnabled = true;
  window.ventMode = "streamlines";
  window.windLevel = "10m";

  const state = {
    run: DEFAULT_RUN, steps: FALLBACK_STEPS, stepIndex: 0, variable: "vmax_10m",
    cache: new Map(), layer: null, windLayer: null, loading: false,
    currentPoints: null, currentMeta: null, currentJson: null, windData: null,
  };

  let map;
  let popup = null;

  // -------------------------------------------------------------------
  // Color utils
  // -------------------------------------------------------------------
  function interpolateColor(palette, t) {
    t = Math.max(0, Math.min(1, t));
    const n = palette.length - 1, seg = t * n, i = Math.min(Math.floor(seg), n - 1);
    return lerpRgb(palette[i], palette[i + 1], seg - i);
  }
  function lerpRgb(hexA, hexB, t) {
    const a = hexToRgbArr(hexA), b = hexToRgbArr(hexB);
    return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
  }
  const _rgbCache = new Map();
  function hexToRgbArr(hex) {
    if (_rgbCache.has(hex)) return _rgbCache.get(hex);
    const c = hex.replace("#",""), bi = parseInt(c,16);
    const a = [(bi>>16)&255, (bi>>8)&255, bi&255];
    _rgbCache.set(hex, a); return a;
  }

  function formatStepLabel(s) { return `+${String(s).padStart(3,"0")}h`; }
  function formatLocalDateTime(step, vtu) {
    if (!vtu) return formatStepLabel(step);
    const d = new Date(vtu);
    if (isNaN(d.getTime())) return formatStepLabel(step);
    const dl = d.toLocaleDateString(undefined, {weekday:"short",day:"2-digit",month:"short"});
    const tl = d.toLocaleTimeString(undefined, {hour:"2-digit",minute:"2-digit"});
    return `${dl} · ${tl} (+${String(step).padStart(3,"0")}h)`;
  }
  function stepFileUrl(run, step) { return `${DATA_BASE}/${run}/step_${String(step).padStart(3,"0")}.json`; }

  async function loadStep(run, step) {
    const key = `${run}:${step}`;
    if (state.cache.has(key)) return state.cache.get(key);
    const r = await fetch(stepFileUrl(run, step));
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    state.cache.set(key, j);
    return j;
  }

  // -------------------------------------------------------------------
  // Grid utils
  // -------------------------------------------------------------------
  function buildGridIndex(lat, lon) {
    const ls = [...new Set(lat)].sort((a,b)=>a-b);
    const os = [...new Set(lon)].sort((a,b)=>a-b);
    const li = new Map(ls.map((v,i)=>[v,i]));
    const oi = new Map(os.map((v,i)=>[v,i]));
    const nr = ls.length, nc = os.length;
    return { latSet: ls, lonSet: os, latIndex: li, lonIndex: oi, nRows: nr, nCols: nc, grid: new Float32Array(nr*nc).fill(NaN) };
  }
  function fillGrid(gi, lat, lon, val) {
    const { latIndex:li, lonIndex:oi, nCols:nc, grid } = gi;
    for (let i=0;i<lat.length;i++) {
      const v=val[i]; if (v===null||v===undefined) continue;
      const r=li.get(lat[i]), c=oi.get(lon[i]);
      if (r!==undefined&&c!==undefined) grid[r*nc+c]=v;
    }
  }
  function sampleGrid(gi, latQ, lonQ) {
    const { latSet:ls, lonSet:os, nRows:nr, nCols:nc, grid } = gi;
    if (latQ<ls[0]||latQ>ls[nr-1]||lonQ<os[0]||lonQ>os[nc-1]) return null;
    let r0=bisectLower(ls,latQ), c0=bisectLower(os,lonQ);
    let r1=Math.min(r0+1,nr-1), c1=Math.min(c0+1,nc-1);
    const ty = ls[r1]>ls[r0] ? (latQ-ls[r0])/(ls[r1]-ls[r0]) : 0;
    const tx = os[c1]>os[c0] ? (lonQ-os[c0])/(os[c1]-os[c0]) : 0;
    const v00=grid[r0*nc+c0], v01=grid[r0*nc+c1], v10=grid[r1*nc+c0], v11=grid[r1*nc+c1];
    const vals=[v00,v01,v10,v11], valid=vals.filter(v=>!Number.isNaN(v));
    if (valid.length===0) return null;
    if (valid.length<4) return valid.reduce((a,b)=>a+b,0)/valid.length;
    const top = v00+(v01-v00)*tx;
    const bottom = v10+(v11-v10)*tx;
    return top + (bottom-top)*ty;
  }
  function bisectLower(a, x) { let l=0,h=a.length-1; while(l<h){const m=(l+h+1)>>1; if(a[m]<=x)l=m;else h=m-1;} return l; }

  // -------------------------------------------------------------------
  // Wind data - amb suport per múltiples nivells
  // -------------------------------------------------------------------
  function extractWindData(json) {
    const wl = WIND_LEVELS[window.windLevel] || WIND_LEVELS["10m"];

    // Si es superficie (10m)
    if (wl.u === "u_10m") {
      return extractWindData10m(json);
    }

    // Multinivell: buscar per pressió
    const uArr = json.variables?.["u"];
    const vArr = json.variables?.["v"];

    if (!uArr || !vArr || !Array.isArray(uArr) || !Array.isArray(vArr)) {
      console.warn("No hi ha dades multinivell (u/v). Fent servir 10m.");
      return extractWindData10m(json);
    }

    // Buscar el nivell més proper a la pressió desitjada
    const targetLevel = wl.level;
    let bestU = null, bestV = null;
    let bestDiff = Infinity;

    for (let i = 0; i < uArr.length; i++) {
      const diff = Math.abs(uArr[i].level - targetLevel);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestU = uArr[i];
        bestV = vArr.find(x => x.level === uArr[i].level);
      }
    }

    if (!bestU || !bestV) {
      console.warn(`Nivell ${targetLevel}hPa no trobat. Nivells disponibles: ${uArr.map(x => x.level).join(', ')}`);
      return extractWindData10m(json);
    }

    console.log(`Vent: nivell ${bestU.level}hPa (buscat ${targetLevel}hPa, diff=${bestDiff.toFixed(1)})`);

    if (!bestU.lat || !bestU.lon || !bestU.value || !bestV.lat || !bestV.lon || !bestV.value) {
      return null;
    }

    const ugi = buildGridIndex(bestU.lat, bestU.lon);
    const vgi = buildGridIndex(bestV.lat, bestV.lon);
    fillGrid(ugi, bestU.lat, bestU.lon, bestU.value);
    fillGrid(vgi, bestV.lat, bestV.lon, bestV.value);

    return {
      uGridInfo: ugi,
      vGridInfo: vgi,
      latSet: ugi.latSet,
      lonSet: ugi.lonSet,
      nRows: ugi.nRows,
      nCols: ugi.nCols,
      level: `${bestU.level}hPa`
    };
  }

  function extractWindData10m(json) {
    let uEntry = json.variables?.["u_10m"];
    let vEntry = json.variables?.["v_10m"];
    if (Array.isArray(uEntry)) uEntry = uEntry[0];
    if (Array.isArray(vEntry)) vEntry = vEntry[0];
    if (!uEntry || !vEntry || !uEntry.lat || !uEntry.lon || !uEntry.value || !vEntry.lat || !vEntry.lon || !vEntry.value) {
      return null;
    }

    const ugi = buildGridIndex(uEntry.lat, uEntry.lon);
    const vgi = buildGridIndex(vEntry.lat, vEntry.lon);
    fillGrid(ugi, uEntry.lat, uEntry.lon, uEntry.value);
    fillGrid(vgi, vEntry.lat, vEntry.lon, vEntry.value);

    console.log("Vent: nivell 10m (superficie)");
    return {
      uGridInfo: ugi,
      vGridInfo: vgi,
      latSet: ugi.latSet,
      lonSet: ugi.lonSet,
      nRows: ugi.nRows,
      nCols: ugi.nCols,
      level: "10m"
    };
  }

  function sampleWind(wd, lat, lon) {
    if (!wd) return null;
    const u = sampleGrid(wd.uGridInfo, lat, lon);
    const v = sampleGrid(wd.vGridInfo, lat, lon);
    return (u !== null && v !== null) ? { u, v } : null;
  }

  // ===================================================================
  // STREAMLINES
  // ===================================================================
  function _getWindUV(px, py, windData, mapInst, originPoint) {
    if (px < 0 || py < 0) return null;
    const lp = L.point(originPoint.x + px, originPoint.y + py);
    const ll = mapInst.layerPointToLatLng(lp);
    const latQ = ll.lat;
    const lonQ = L.Util.wrapNum(ll.lng, [-180, 180]);
    if (!windData) return null;
    const { latSet, lonSet } = windData;
    if (latQ < latSet[0] || latQ > latSet[latSet.length - 1] ||
        lonQ < lonSet[0] || lonQ > lonSet[lonSet.length - 1]) {
      return null;
    }
    return sampleWind(windData, latQ, lonQ);
  }

  function _drawStreamlines(ctx, windData, mapInst, originPoint, canvasW, canvasH) {
    if (!windData) return;
    const W = canvasW, H = canvasH;
    const STEP = 18, DT = 1.8, MAX_STEPS = 70, CELL = 5;
    const mW = Math.floor(W / CELL) + 1, mH = Math.floor(H / CELL) + 1;
    const mask = new Uint8Array(mW * mH);
    const strokeColor = wCfg.streamlineColor === "white"
      ? `rgba(255, 255, 255, ${wCfg.streamlineOpacity})`
      : `rgba(0, 0, 0, ${wCfg.streamlineOpacity})`;

    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = wCfg.streamlineWidth; ctx.strokeStyle = strokeColor;
    ctx.shadowBlur = 0;

    for (let y = 0; y < H; y += STEP) {
      for (let x = 0; x < W; x += STEP) {
        let sx = x + (Math.random() - 0.5) * STEP * 0.6;
        let sy = y + (Math.random() - 0.5) * STEP * 0.6;
        const startMX = Math.floor(sx / CELL), startMY = Math.floor(sy / CELL);
        if (startMY < 0 || startMY >= mH || startMX < 0 || startMX >= mW) continue;
        if (mask[startMY * mW + startMX]) continue;

        const forward = [], backward = [];
        let cx = sx, cy = sy;
        for (let i = 0; i < MAX_STEPS; i++) {
          const uv = _getWindUV(cx, cy, windData, mapInst, originPoint);
          if (!uv) break;
          const s = Math.hypot(uv.u, uv.v);
          if (s < 0.2) break;
          cx += (uv.u / s) * DT; cy -= (uv.v / s) * DT;
          const mx = Math.floor(cx / CELL), my = Math.floor(cy / CELL);
          if (my < 0 || my >= mH || mx < 0 || mx >= mW) break;
          if (mask[my * mW + mx]) break;
          forward.push([cx, cy]);
        }
        cx = sx; cy = sy;
        for (let i = 0; i < MAX_STEPS; i++) {
          const uv = _getWindUV(cx, cy, windData, mapInst, originPoint);
          if (!uv) break;
          const s = Math.hypot(uv.u, uv.v);
          if (s < 0.2) break;
          cx -= (uv.u / s) * DT; cy += (uv.v / s) * DT;
          const mx = Math.floor(cx / CELL), my = Math.floor(cy / CELL);
          if (my < 0 || my >= mH || mx < 0 || mx >= mW) break;
          if (mask[my * mW + mx]) break;
          backward.push([cx, cy]);
        }
        const line = [...backward.reverse(), [sx, sy], ...forward];
        if (line.length > 12) {
          for (let i = 0; i < line.length; i += 3) {
            const mx = Math.floor(line[i][0] / CELL), my = Math.floor(line[i][1] / CELL);
            if (my >= 0 && my < mH && mx >= 0 && mx < mW) mask[my * mW + mx] = 1;
          }
          ctx.beginPath(); ctx.moveTo(line[0][0], line[0][1]);
          for (let i = 1; i < line.length - 1; i++) {
            const xc = (line[i][0] + line[i + 1][0]) / 2, yc = (line[i][1] + line[i + 1][1]) / 2;
            ctx.quadraticCurveTo(line[i][0], line[i][1], xc, yc);
          }
          ctx.stroke();
          if (line.length > 25) {
            const arrowStep = Math.floor(line.length / 4);
            for (let a = arrowStep; a < line.length - 3; a += arrowStep) {
              const p1 = line[a], p2 = line[a + 2];
              if (p1 && p2) {
                const ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
                ctx.beginPath();
                ctx.moveTo(p1[0], p1[1]);
                ctx.lineTo(p1[0] - 4 * Math.cos(ang - 0.6), p1[1] - 4 * Math.sin(ang - 0.6));
                ctx.moveTo(p1[0], p1[1]);
                ctx.lineTo(p1[0] - 4 * Math.cos(ang + 0.6), p1[1] - 4 * Math.sin(ang + 0.6));
                ctx.stroke();
              }
            }
          } else if (line.length > 15) {
            const last = line[line.length - 1], prev = line[Math.max(0, line.length - 5)];
            if (prev && last !== prev) {
              const ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
              ctx.beginPath();
              ctx.moveTo(last[0], last[1]);
              ctx.lineTo(last[0] - 5 * Math.cos(ang - 0.5), last[1] - 5 * Math.sin(ang - 0.5));
              ctx.moveTo(last[0], last[1]);
              ctx.lineTo(last[0] - 5 * Math.cos(ang + 0.5), last[1] - 5 * Math.sin(ang + 0.5));
              ctx.stroke();
            }
          }
        }
      }
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------
  // Smooth field layer
  // -------------------------------------------------------------------
  const SmoothFieldLayer = L.GridLayer.extend({
    createTile: function(coords, done) {
      const tile = L.DomUtil.create("canvas", "smooth-field-tile");
      const sz = this.getTileSize(); tile.width = sz.x; tile.height = sz.y;
      const gi = this.options.gridInfo, meta = this.options.meta;
      if (!gi || !meta) { setTimeout(() => done(null, tile), 0); return tile; }
      const ctx = tile.getContext("2d"), img = ctx.createImageData(sz.x, sz.y), d = img.data;
      const [dmin, dmax] = meta.domain, pal = meta.palette;
      const nwPt = coords.scaleBy(sz), sePt = L.point(nwPt.x + sz.x, nwPt.y + sz.y);
      const nwLL = map.unproject(nwPt, coords.z), seLL = map.unproject(sePt, coords.z);
      const lonPx = px => nwLL.lng + (seLL.lng - nwLL.lng) * (px / sz.x);
      const latPy = py => nwLL.lat + (seLL.lat - nwLL.lat) * (py / sz.y);
      for (let py = 0; py < sz.y; py++) {
        const la = latPy(py);
        for (let px = 0; px < sz.x; px++) {
          const lo = lonPx(px); let v = sampleGrid(gi, la, lo);
          const idx = (py * sz.x + px) * 4;
          if (v === null) { d[idx + 3] = 0; continue; }
          if (meta.kelvinToCelsius) v -= 273.15;
          if (meta.paToHpa) v /= 100;
          const t = (v - dmin) / (dmax - dmin), rgb = interpolateColor(pal, t);
          d[idx] = rgb[0]; d[idx + 1] = rgb[1]; d[idx + 2] = rgb[2]; d[idx + 3] = 200;
        }
      }
      ctx.putImageData(img, 0, 0);
      setTimeout(() => done(null, tile), 0);
      return tile;
    }
  });

  // -------------------------------------------------------------------
  // WindStreamLayer
  // -------------------------------------------------------------------
  const WindStreamLayer = L.Layer.extend({
    initialize: function (windData, options) {
      L.setOptions(this, options);
      this._windData = windData;
    },
    onAdd: function (mapInst) {
      this._map = mapInst;
      const pane = mapInst.getPane(this.options.pane || "overlayPane");
      this._canvas = L.DomUtil.create("canvas", "wind-stream-canvas leaflet-zoom-hide");
      this._ctx = this._canvas.getContext("2d");
      this._canvas.style.position = "absolute";
      this._canvas.style.pointerEvents = "none";
      pane.appendChild(this._canvas);
      mapInst.on("moveend", this._reset, this);
      mapInst.on("zoomend", this._reset, this);
      mapInst.on("resize", this._reset, this);
      this._reset();
    },
    onRemove: function (mapInst) {
      mapInst.off("moveend", this._reset, this);
      mapInst.off("zoomend", this._reset, this);
      mapInst.off("resize", this._reset, this);
      L.DomUtil.remove(this._canvas);
      this._canvas = null;
      this._ctx = null;
    },
    _reset: function () {
      if (!this._map || !this._canvas) return;
      const size = this._map.getSize();
      const margin = 200;
      const topLeft = this._map.containerPointToLayerPoint([-margin, -margin]);
      L.DomUtil.setPosition(this._canvas, topLeft);
      this._canvas.width = size.x + margin * 2;
      this._canvas.height = size.y + margin * 2;
      this._canvas.style.width = (size.x + margin * 2) + "px";
      this._canvas.style.height = (size.y + margin * 2) + "px";
      this._origin = topLeft;
      this._redraw();
    },
    _redraw: function () {
      if (!this._ctx || !this._canvas || !this._map) return;
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      if (!window.ventEnabled || !this._windData) return;
      _drawStreamlines(this._ctx, this._windData, this._map, this._origin, this._canvas.width, this._canvas.height);
    },
  });

  // -------------------------------------------------------------------
  // POPUP
  // -------------------------------------------------------------------
  function setupMapClick() {
    map.on("click", function (e) {
      if (!state.currentPoints || !state.currentMeta) return;
      const { lat, lon, value } = state.currentPoints;
      const gi = buildGridIndex(lat, lon);
      fillGrid(gi, lat, lon, value);
      let v = sampleGrid(gi, e.latlng.lat, e.latlng.lng);
      if (v === null) return;
      const meta = state.currentMeta;
      if (meta.kelvinToCelsius) v = v - 273.15;
      if (meta.paToHpa) v = v / 100;
      const decimals = meta.decimals || 1;
      const formattedValue = v.toFixed(decimals);
      const latStr = e.latlng.lat.toFixed(4) + "°" + (e.latlng.lat >= 0 ? "N" : "S");
      const lngStr = Math.abs(e.latlng.lng).toFixed(4) + "°" + (e.latlng.lng >= 0 ? "E" : "W");
      const entry = state.steps[state.stepIndex];
      const whenLabel = formatLocalDateTime(entry.step, entry.valid_time_utc);

      let windExtra = "";
      if (state.windData) {
        const w = sampleWind(state.windData, e.latlng.lat, e.latlng.lng);
        if (w) {
          const speed = Math.hypot(w.u, w.v).toFixed(1);
          const dir = ((Math.atan2(w.u, w.v) * 180) / Math.PI + 360) % 360;
          const dirStr = dir.toFixed(0) + "°";
          const levelLabel = state.windData.level || "10m";
          windExtra = `<br><strong>Vent (${levelLabel}):</strong> ${speed} m/s · ${dirStr}`;
        }
      }

      const html = `
        <div style="font-size:13px;line-height:1.6;min-width:180px;color:#ccd6f6">
          <strong style="font-size:14px;color:#fff">${meta.label}</strong><br>
          <span style="font-size:20px;font-weight:bold;color:#4fb0c6">${formattedValue} ${meta.unit}</span>
          ${windExtra}
          <hr style="margin:6px 0;border-color:rgba(255,255,255,0.1)">
          <span style="font-size:11px;color:#8892b0">${latStr} · ${lngStr}</span><br>
          <span style="font-size:11px;color:#8892b0">${whenLabel}</span>
        </div>
      `;

      if (popup) {
        popup.setLatLng(e.latlng).setContent(html).openOn(map);
      } else {
        popup = L.popup({ closeButton: true, autoClose: true, className: "wind-popup" })
          .setLatLng(e.latlng).setContent(html).openOn(map);
      }
    });
  }

  function clearWindLayer() {
    if (state.windLayer) { map.removeLayer(state.windLayer); state.windLayer = null; }
  }

  function renderWind() {
    clearWindLayer();
    if (!window.ventEnabled || !state.windData || !map) return;
    state.windLayer = new WindStreamLayer(state.windData, { pane: "overlayPane" });
    state.windLayer.addTo(map);
  }

  function clearLayer() {
    if (state.layer) { map.removeLayer(state.layer); state.layer = null; }
  }

  function updateVentButton() {
    const bt = document.getElementById("btn-vent-toggle");
    const bm = document.getElementById("btn-vent-mode");
    if (bt) {
      bt.textContent = window.ventEnabled ? "Vent ON" : "Vent OFF";
      bt.classList.toggle("active", window.ventEnabled);
      bt.classList.toggle("off", !window.ventEnabled);
    }
    if (bm) {
      bm.textContent = window.ventMode === "streamlines" ? "Streamlines" : "Particules";
      bm.style.display = window.ventEnabled ? "inline-block" : "none";
    }
  }

  function updateLegend(meta) {
    const titleEl = document.getElementById("legend-title");
    const barEl = document.getElementById("legend-bar");
    const labelsEl = document.getElementById("legend-labels");
    if (!titleEl || !barEl || !labelsEl) return;
    const [dmin, dmax] = meta.domain;
    const stops = 5;
    let gs = [];
    for (let i = 0; i <= stops; i++) {
      const t = i / stops;
      const rgb = interpolateColor(meta.palette, t);
      gs.push(`rgb(${rgb[0]|0},${rgb[1]|0},${rgb[2]|0})`);
    }
    titleEl.textContent = `${meta.label} (${meta.unit})`;
    barEl.style.background = `linear-gradient(to right, ${gs.join(",")})`;
    labelsEl.innerHTML = `<span>${dmin}</span><span>${dmax}</span>`;
  }

  function setStatus(t) {
    const el = document.getElementById("status-text");
    if (el) el.textContent = t;
  }

  function renderVariable(json, varKey, validTimeUtc) {
    clearLayer();
    clearWindLayer();
    state.currentJson = json;
    const meta = VARIABLES[varKey];
    if (!meta) return;
    let entry = json.variables?.[varKey];
    if (!entry) { setStatus(`Sense dades de "${meta.label}"`); return; }
    if (Array.isArray(entry)) entry = entry[0];
    const { lat, lon, value } = entry;
    if (!lat || !lon || !value) { setStatus("Format inesperat"); return; }
    const gi = buildGridIndex(lat, lon);
    fillGrid(gi, lat, lon, value);
    state.currentPoints = { lat, lon, value };
    state.currentMeta = meta;
    const layer = new SmoothFieldLayer({ gridInfo: gi, meta, tileSize: TILE_SIZE, opacity: 1, updateWhenZooming: false, keepBuffer: 2 });
    layer.addTo(map);
    state.layer = layer;

    if (WIND_VARS.includes(varKey)) { window.ventEnabled = true; updateVentButton(); }

    // Extreure vent del nivell seleccionat
    state.windData = extractWindData(json);

    if (window.ventEnabled && state.windData) renderWind();
    updateLegend(meta);

    const levelInfo = state.windData ? ` · vent ${state.windData.level}` : "";
    setStatus(`${meta.label} · ${lat.length} punts${levelInfo} · ${formatLocalDateTime(json.step, validTimeUtc || json.valid_time_utc)}`);
  }

  async function goToStepIndex(idx) {
    if (idx < 0 || idx >= state.steps.length || state.loading) return;
    state.loading = true;
    state.stepIndex = idx;
    const entry = state.steps[idx];
    updateStepUI();
    setStatus("Carregant...");
    try {
      const json = await loadStep(state.run, entry.step);
      renderVariable(json, state.variable, entry.valid_time_utc);
    } catch (e) {
      console.error(e);
      setStatus(`Error: ${formatStepLabel(entry.step)}`);
    } finally {
      state.loading = false;
    }
  }

  function updateStepUI() {
    const entry = state.steps[state.stepIndex];
    const sel = document.getElementById("step-select");
    if (sel) sel.value = String(entry.step);
    const pb = document.getElementById("btn-prev"), nb = document.getElementById("btn-next");
    if (pb) pb.disabled = state.stepIndex <= 0;
    if (nb) nb.disabled = state.stepIndex >= state.steps.length - 1;
  }

  function populateStepSelect() {
    const sel = document.getElementById("step-select");
    if (!sel) return;
    sel.innerHTML = "";
    state.steps.forEach(e => {
      const o = document.createElement("option");
      o.value = String(e.step);
      o.textContent = formatLocalDateTime(e.step, e.valid_time_utc);
      sel.appendChild(o);
    });
  }

  function populateVariableSelect() {
    const sel = document.getElementById("variable-select");
    if (!sel) return;
    sel.innerHTML = "";
    Object.entries(VARIABLES).forEach(([k, m]) => {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = m.label;
      sel.appendChild(o);
    });
    sel.value = state.variable;
  }

  async function discoverSteps(run) {
    try {
      const r = await fetch(`${DATA_BASE}/${run}/steps.json`);
      if (r.ok) {
        const a = await r.json();
        if (Array.isArray(a) && a.length > 0) return a.map(e => typeof e === "number" ? { step: e, valid_time_utc: null } : e);
      }
    } catch (e) { }
    return FALLBACK_STEPS;
  }

  async function loadBorders() {
    const bp = map.createPane("bordersPane");
    bp.style.zIndex = "460";
    bp.style.pointerEvents = "none";
    const style = { pane: "bordersPane", color: "#000", weight: 1, opacity: 0.85, fill: false, interactive: false };
    for (const f of BORDER_GEOJSON_FILES) {
      try {
        const r = await fetch(`${BORDERS_BASE}/${f}`);
        if (r.ok) { const g = await r.json(); L.geoJSON(g, { style }).addTo(map); }
      } catch (e) { }
    }
  }

  async function init() {
    map = L.map("map", { center: [40.2, -3.7], zoom: 6, zoomControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO", maxZoom: 12
    }).addTo(map);

    setupMapClick();
    loadBorders();
    state.steps = await discoverSteps(state.run);
    populateStepSelect();
    populateVariableSelect();

    document.getElementById("btn-prev")?.addEventListener("click", () => goToStepIndex(state.stepIndex - 1));
    document.getElementById("btn-next")?.addEventListener("click", () => goToStepIndex(state.stepIndex + 1));
    document.getElementById("step-select")?.addEventListener("change", e => {
      const s = parseInt(e.target.value, 10);
      const i = state.steps.findIndex(en => en.step === s);
      if (i >= 0) goToStepIndex(i);
    });
    document.getElementById("variable-select")?.addEventListener("change", e => {
      state.variable = e.target.value;
      loadStep(state.run, state.steps[state.stepIndex].step)
        .then(j => renderVariable(j, state.variable, state.steps[state.stepIndex].valid_time_utc));
    });
    document.getElementById("btn-vent-toggle")?.addEventListener("click", () => {
      window.ventEnabled = !window.ventEnabled;
      updateVentButton();
      window.ventEnabled && state.windData ? renderWind() : clearWindLayer();
    });
    document.getElementById("btn-vent-mode")?.addEventListener("click", () => {
      if (!window.ventEnabled) return;
      window.ventMode = window.ventMode === "streamlines" ? "particles" : "streamlines";
      updateVentButton();
      if (state.windData) renderWind();
    });

    // Selector d'altura del vent
    document.getElementById("wind-level-select")?.addEventListener("change", e => {
      window.windLevel = e.target.value;
      if (state.currentJson) {
        state.windData = extractWindData(state.currentJson);
        if (window.ventEnabled && state.windData) renderWind();
        const levelInfo = state.windData ? ` · vent ${state.windData.level}` : "";
        const entry = state.steps[state.stepIndex];
        setStatus(`${state.currentMeta.label} · ${state.currentPoints.lat.length} punts${levelInfo} · ${formatLocalDateTime(entry.step, entry.valid_time_utc)}`);
      }
    });
    document.getElementById("wind-level-select").value = window.windLevel;

    updateVentButton();
    goToStepIndex(0);
  }

  document.addEventListener("DOMContentLoaded", init);
})();