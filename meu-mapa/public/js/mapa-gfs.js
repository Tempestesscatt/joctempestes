/**
 * mapa-gfs.js
 * -----------
 * Mapa interactiu (Leaflet) amb isolínies de temperatura intel·ligents
 * - 850 hPa: blau a partir de 0°C, vermell a partir de 25°C
 * - 500 hPa: blau a partir de -25°C, vermell a partir de -5°C
 * - 300 hPa: blau a partir de -45°C, vermell a partir de -25°C
 * 
 * Isolínies cada 10°C (gruixudes) i cada 2°C (fines)
 * Colors: blau per fred, vermell per calor, negre per temperat
 * 
 * NOU: Selector de velocitat d'animació + bucle infinit
 */

class MapaGFS {
  constructor(containerId, opts) {
    opts = opts || {};
    
    this.opts = Object.assign(
      {
        dataUrlTemplate: "web_data_EU/gfs_{level}hpa_d{dia:02d}_h{hora:02d}.msgpack.gz",
        initialCenter: [30, 0],
        initialZoom: 3,
        bordersUrl: "dades/fronteres_paisos.geojson",
        bordersNameProp: null,
        onValidTimeChange: null,
        animationDelay: 500,
        maxDays: 16,
        maxHours: 23,
        loop: false,
      },
      opts
    );

    this.map = L.map(containerId, {
      center: this.opts.initialCenter,
      zoom: this.opts.initialZoom,
      worldCopyJump: false,
      maxBounds: [[-85, -180], [85, 180]],
      maxBoundsViscosity: 1.0,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      subdomains: "abc",
      maxZoom: 12,
      noWrap: true,
    }).addTo(this.map);

    this.map.createPane("bandsPane");
    this.map.getPane("bandsPane").style.zIndex = 350;
    this.map.createPane("linesPane");
    this.map.getPane("linesPane").style.zIndex = 400;
    this.map.createPane("barbsPane");
    this.map.getPane("barbsPane").style.zIndex = 450;
    this.map.createPane("bordersPane");
    this.map.getPane("bordersPane").style.zIndex = 500;

    this._bandsLayer = L.layerGroup().addTo(this.map);
    this._linesLayer = L.layerGroup().addTo(this.map);
    this._barbsLayer = L.layerGroup().addTo(this.map);
    this._bordersLayer = null;

    this._cache = new Map();
    this.currentLevel = null;
    this.currentDia = null;
    this.currentHora = null;
    this.currentVariable = null;
    this._data = null;
    this._legendControl = null;
    this._animationTimeout = null;
    this._isAnimating = false;
    this._loop = false;
    this._animationType = null; // 'hours', 'days', 'all'

    if (this.opts.bordersUrl) {
      this._loadBorders(this.opts.bordersUrl);
    }
  }

  // ------------------------------------------------------------------
  // Fronteres
  // ------------------------------------------------------------------

  async _loadBorders(url) {
    try {
      var res = await fetch(url);
      if (!res.ok) {
        throw new Error("No s'ha pogut carregar " + url + " (HTTP " + res.status + ")");
      }
      var geojson = await res.json();

      this._bordersLayer = L.geoJSON(geojson, {
        pane: "bordersPane",
        style: {
          color: "#000000",
          weight: 1.3,
          opacity: 0.7,
          fill: false,
          interactive: false,
        },
      }).addTo(this.map);

      console.log("[MapaGFS] Fronteres carregades:", url);
    } catch (err) {
      console.error("[MapaGFS] Error carregant fronteres:", err.message);
    }
  }

  // ------------------------------------------------------------------
  // Carrega
  // ------------------------------------------------------------------

  _buildUrl(level, dia, hora) {
    var diaStr = String(dia).padStart(2, "0");
    var horaStr = String(hora).padStart(2, "0");
    return this.opts.dataUrlTemplate
      .replace(/\{level\}/g, level)
      .replace(/\{dia:02d\}/g, diaStr)
      .replace(/\{dia\}/g, diaStr)
      .replace(/\{hora:02d\}/g, horaStr)
      .replace(/\{hora\}/g, horaStr);
  }

  async _fetchAndDecode(url) {
    if (this._cache.has(url)) {
      return this._cache.get(url);
    }

    console.log("[MapaGFS] Descarregant:", url);

    var res;
    try {
      res = await fetch(url);
    } catch (err) {
      throw new Error("Error de xarxa carregant " + url + ": " + err.message);
    }

    if (!res.ok) {
      throw new Error("No s'ha pogut carregar " + url + " (HTTP " + res.status + ").");
    }

    var buf;
    try {
      if (typeof DecompressionStream !== "undefined") {
        var decompressedStream = res.body.pipeThrough(new DecompressionStream("gzip"));
        buf = await new Response(decompressedStream).arrayBuffer();
      } else {
        throw new Error("DecompressionStream no suportat.");
      }
    } catch (err) {
      throw new Error("Error descomprimint: " + err.message);
    }

    if (typeof MessagePack === "undefined") {
      throw new Error("MessagePack no carregat.");
    }

    var decoded;
    try {
      decoded = MessagePack.decode(new Uint8Array(buf));
    } catch (err) {
      throw new Error("Error decodificant: " + err.message);
    }

    console.log("[MapaGFS] Decodificat OK:", url);
    this._cache.set(url, decoded);
    return decoded;
  }

  async load(level, dia, hora, variable) {
    variable = variable || "temp";
    
    if (dia > this.opts.maxDays) {
      throw new Error("El dia " + dia + " supera el màxim de " + this.opts.maxDays);
    }
    if (hora > this.opts.maxHours) {
      throw new Error("L'hora " + hora + " supera el màxim de " + this.opts.maxHours);
    }

    var url = this._buildUrl(level, dia, hora);
    var data = await this._fetchAndDecode(url);

    this.currentLevel = level;
    this.currentDia = dia;
    this.currentHora = hora;
    this.currentVariable = variable;
    this._data = data;

    this._render();

    if (typeof this.opts.onValidTimeChange === "function") {
      this.opts.onValidTimeChange(data.valid_time || null, data);
    }

    return data;
  }

  setVariable(variable) {
    if (!this._data) return;
    this.currentVariable = variable;
    this._render();
  }

  async setDia(dia) {
    if (dia === this.currentDia && this._data) {
      this._render();
      return;
    }
    var hora = this.currentHora || 0;
    await this.load(this.currentLevel, dia, hora, this.currentVariable);
  }

  async setHora(hora) {
    if (hora === this.currentHora && this._data) {
      this._render();
      return;
    }
    await this.load(this.currentLevel, this.currentDia, hora, this.currentVariable);
  }

  // ------------------------------------------------------------------
  // ANIMACIÓ AMB BUCLE I VELOCITAT
  // ------------------------------------------------------------------

  /**
   * Anima hores dins d'un dia (amb bucle opcional)
   */
  async animateHours(dia, startHora, endHora, delayMs, onStep, loop) {
    startHora = startHora || 0;
    endHora = endHora || 23;
    delayMs = delayMs || this.opts.animationDelay || 500;
    loop = loop || false;
    
    if (this._isAnimating) {
      this.stopAnimation();
      await new Promise(function(resolve) { setTimeout(resolve, 100); });
    }

    this._isAnimating = true;
    this._loop = loop;
    this._animationType = 'hours';

    if (!this.currentLevel) {
      await this.load(850, dia, startHora, "temp");
    }

    try {
      do {
        for (var hora = startHora; hora <= endHora; hora++) {
          if (!this._isAnimating) break;
          await this.load(this.currentLevel, dia, hora, this.currentVariable);
          if (onStep) onStep(dia, hora);
          if (hora < endHora && this._isAnimating) {
            await new Promise(function(resolve) {
              this._animationTimeout = setTimeout(resolve, delayMs);
            }.bind(this));
          }
        }
      } while (this._isAnimating && this._loop);
    } catch (err) {
      console.error("[MapaGFS] Error:", err);
      this._isAnimating = false;
      throw err;
    }

    this._isAnimating = false;
    this._animationTimeout = null;
  }

  /**
   * Anima dies (amb bucle opcional)
   */
  async animateDays(startDia, endDia, hora, delayMs, onStep, loop) {
    startDia = startDia || 1;
    endDia = endDia || 16;
    hora = hora || 0;
    delayMs = delayMs || this.opts.animationDelay || 700;
    loop = loop || false;
    
    if (this._isAnimating) {
      this.stopAnimation();
      await new Promise(function(resolve) { setTimeout(resolve, 100); });
    }

    this._isAnimating = true;
    this._loop = loop;
    this._animationType = 'days';

    if (!this.currentLevel) {
      await this.load(850, startDia, hora, "temp");
    }

    try {
      do {
        for (var dia = startDia; dia <= endDia; dia++) {
          if (!this._isAnimating) break;
          await this.load(this.currentLevel, dia, hora, this.currentVariable);
          if (onStep) onStep(dia, hora);
          if (dia < endDia && this._isAnimating) {
            await new Promise(function(resolve) {
              this._animationTimeout = setTimeout(resolve, delayMs);
            }.bind(this));
          }
        }
      } while (this._isAnimating && this._loop);
    } catch (err) {
      console.error("[MapaGFS] Error:", err);
      this._isAnimating = false;
      throw err;
    }

    this._isAnimating = false;
    this._animationTimeout = null;
  }

  /**
   * Anima TOTES les hores de TOTS els dies (bucle infinit)
   */
  async animateAll(startDia, endDia, startHora, endHora, delayMs, onStep, loop) {
    startDia = startDia || 1;
    endDia = endDia || 3;
    startHora = startHora || 0;
    endHora = endHora || 23;
    delayMs = delayMs || this.opts.animationDelay || 500;
    loop = loop || false;
    
    if (this._isAnimating) {
      this.stopAnimation();
      await new Promise(function(resolve) { setTimeout(resolve, 100); });
    }

    this._isAnimating = true;
    this._loop = loop;
    this._animationType = 'all';

    if (!this.currentLevel) {
      await this.load(850, startDia, startHora, "temp");
    }

    try {
      do {
        for (var dia = startDia; dia <= endDia; dia++) {
          if (!this._isAnimating) break;
          for (var hora = startHora; hora <= endHora; hora++) {
            if (!this._isAnimating) break;
            await this.load(this.currentLevel, dia, hora, this.currentVariable);
            if (onStep) onStep(dia, hora);
            if ((dia < endDia || hora < endHora) && this._isAnimating) {
              await new Promise(function(resolve) {
                this._animationTimeout = setTimeout(resolve, delayMs);
              }.bind(this));
            }
          }
        }
      } while (this._isAnimating && this._loop);
    } catch (err) {
      console.error("[MapaGFS] Error:", err);
      this._isAnimating = false;
      throw err;
    }

    this._isAnimating = false;
    this._animationTimeout = null;
  }

  /**
   * Atura l'animació
   */
  stopAnimation() {
    this._isAnimating = false;
    this._loop = false;
    if (this._animationTimeout) {
      clearTimeout(this._animationTimeout);
      this._animationTimeout = null;
    }
    console.log("[MapaGFS] Animació aturada");
  }

  /**
   * Canvia la velocitat de l'animació
   */
  setSpeed(delayMs) {
    this.opts.animationDelay = delayMs;
    console.log("[MapaGFS] Velocitat canviada a " + delayMs + "ms");
  }

  // ------------------------------------------------------------------
  // Dibuix
  // ------------------------------------------------------------------

  _clearLayers() {
    this._bandsLayer.clearLayers();
    this._linesLayer.clearLayers();
    this._barbsLayer.clearLayers();
  }

  _rgbaToCss(rgba) {
    var r = rgba[0];
    var g = rgba[1];
    var b = rgba[2];
    var a = rgba[3];
    return "rgba(" + Math.round(r * 255) + ", " + Math.round(g * 255) + ", " + Math.round(b * 255) + ", " + a + ")";
  }

  /**
   * Color intel·ligent per isolínies segons nivell i temperatura
   */
  _getTempLineColor(level, tempValue) {
    var color = "#000000";
    var intensity = 0;
    var r = 0, g = 0, b = 0;
    
    if (level === 850) {
      if (tempValue <= 0) {
        intensity = Math.min(Math.abs(tempValue) / 20, 1);
        r = 20 + 10 * intensity;
        g = 60 + 20 * intensity;
        b = 100 + 155 * intensity;
        color = "rgb(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ")";
      } else if (tempValue >= 20) {
        intensity = Math.min((tempValue - 20) / 20, 1);
        r = 200 + 55 * intensity;
        g = 60 - 40 * intensity;
        b = 60 - 40 * intensity;
        color = "rgb(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ")";
      }
    } else if (level === 500) {
      if (tempValue <= -30) {
        intensity = Math.min(Math.abs(tempValue + 30) / 25, 1);
        r = 20 + 10 * intensity;
        g = 60 + 20 * intensity;
        b = 100 + 155 * intensity;
        color = "rgb(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ")";
      } else if (tempValue >= -10) {
        intensity = Math.min((tempValue + 10) / 20, 1);
        r = 200 + 55 * intensity;
        g = 60 - 40 * intensity;
        b = 60 - 40 * intensity;
        color = "rgb(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ")";
      }
    } else if (level === 300) {
      if (tempValue <= -50) {
        intensity = Math.min(Math.abs(tempValue + 50) / 25, 1);
        r = 20 + 10 * intensity;
        g = 60 + 20 * intensity;
        b = 100 + 155 * intensity;
        color = "rgb(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ")";
      } else if (tempValue >= -30) {
        intensity = Math.min((tempValue + 30) / 20, 1);
        r = 200 + 55 * intensity;
        g = 60 - 40 * intensity;
        b = 60 - 40 * intensity;
        color = "rgb(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ")";
      }
    }
    
    return color;
  }

  _render() {
    this._clearLayers();
    if (!this._data) return;

    var varData = this.currentVariable === "wind" ? this._data.wind : this._data.temperature;
    if (!varData) {
      console.warn("[MapaGFS] No hi ha dades per a:", this.currentVariable);
      return;
    }

    // BANDES DE COLOR
    for (var i = 0; i < varData.bands.length; i++) {
      var band = varData.bands[i];
      var color = this._rgbaToCss(band.color_rgba);
      for (var j = 0; j < band.rings.length; j++) {
        var ring = band.rings[j];
        var latlngs = [];
        for (var k = 0; k < ring.length; k++) {
          var coord = ring[k];
          latlngs.push([coord[1], coord[0]]);
        }
        L.polygon(latlngs, {
          pane: "bandsPane",
          stroke: false,
          fillColor: color,
          fillOpacity: 1,
          interactive: false,
        }).addTo(this._bandsLayer);
      }
    }

    // ISOLÍNIES
    if (this.currentVariable === "temp") {
      this._renderTempIsolines(varData);
    } else {
      var lines = varData.isotachs;
      if (lines) {
        for (var m = 0; m < lines.length; m++) {
          var line = lines[m];
          var latlngsLine = [];
          for (var n = 0; n < line.coords.length; n++) {
            var coordLine = line.coords[n];
            latlngsLine.push([coordLine[1], coordLine[0]]);
          }
          L.polyline(latlngsLine, {
            pane: "linesPane",
            color: line.color || "#ff0000",
            weight: 1.4,
            opacity: 0.85,
          }).addTo(this._linesLayer);
        }
      }
    }

    // BARBES
    if (this.currentVariable === "wind" && varData.barbs) {
      for (var p = 0; p < varData.barbs.length; p++) {
        this._addBarb(varData.barbs[p]);
      }
    }

    this._updateLegend(varData);
  }

  _renderTempIsolines(varData) {
    var tempData = this._data.temperature;
    if (!tempData) return;

    var vmin = tempData.range[0];
    var vmax = tempData.range[1];
    var currentLevel = this.currentLevel;

    var levels10 = [];
    var levels2 = [];

    var start10 = Math.floor(vmin / 10) * 10;
    var start2 = Math.floor(vmin / 2) * 2;

    for (var t = start10; t <= vmax; t += 10) {
      levels10.push(t);
    }

    for (var t2 = start2; t2 <= vmax; t2 += 2) {
      if (levels10.indexOf(t2) === -1) {
        levels2.push(t2);
      }
    }

    var existingLines = tempData.isolines || [];
    var linesByValue = {};
    for (var q = 0; q < existingLines.length; q++) {
      var line = existingLines[q];
      var val = Math.round(line.value);
      if (!linesByValue[val]) {
        linesByValue[val] = [];
      }
      linesByValue[val].push(line);
    }

    // Línies cada 10°C
    for (var r = 0; r < levels10.length; r++) {
      var level = levels10[r];
      var roundedLevel = Math.round(level);
      var lines = linesByValue[roundedLevel] || [];
      var lineColor = this._getTempLineColor(currentLevel, roundedLevel);
      
      for (var s = 0; s < lines.length; s++) {
        var line = lines[s];
        var latlngs = [];
        for (var u = 0; u < line.coords.length; u++) {
          var coord = line.coords[u];
          latlngs.push([coord[1], coord[0]]);
        }
        L.polyline(latlngs, {
          pane: "linesPane",
          color: lineColor,
          weight: 2.5,
          opacity: 0.9,
          interactive: true,
        })
          .bindTooltip(roundedLevel + "°C", {
            permanent: false,
            direction: "center",
            className: "gfs-line-label gfs-line-label-thick",
          })
          .addTo(this._linesLayer);
      }
    }

    // Línies cada 2°C
    for (var v = 0; v < levels2.length; v++) {
      var level2 = levels2[v];
      var roundedLevel2 = Math.round(level2);
      var lines2 = linesByValue[roundedLevel2] || [];
      var lineColor2 = this._getTempLineColor(currentLevel, roundedLevel2);
      
      for (var w = 0; w < lines2.length; w++) {
        var line2 = lines2[w];
        var latlngs2 = [];
        for (var x = 0; x < line2.coords.length; x++) {
          var coord2 = line2.coords[x];
          latlngs2.push([coord2[1], coord2[0]]);
        }
        L.polyline(latlngs2, {
          pane: "linesPane",
          color: lineColor2,
          weight: 0.6,
          opacity: 0.5,
          interactive: false,
        }).addTo(this._linesLayer);
      }
    }
  }

  _addBarb(b) {
    var angleDeg = (Math.atan2(b.u_ms, b.v_ms) * 180) / Math.PI;
    var length = Math.min(10 + b.speed_kt * 0.6, 40);

    var svg = '<svg width="40" height="40" viewBox="-20 -20 40 40" style="transform: rotate(' + angleDeg + 'deg); overflow: visible;">' +
      '<line x1="0" y1="10" x2="0" y2="' + (10 - length) + '" stroke="#111" stroke-width="2" />' +
      '<polygon points="-4,' + (10 - length + 8) + ' 4,' + (10 - length + 8) + ' 0,' + (10 - length) + '" fill="#111" />' +
      '</svg>';

    var icon = L.divIcon({
      html: svg,
      className: "gfs-barb-icon",
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    L.marker([b.lat, b.lon], {
      pane: "barbsPane",
      icon: icon,
      interactive: true,
      title: b.speed_kt + " kt",
    })
      .bindTooltip(b.speed_kt + " kt", { direction: "top", offset: [0, -18] })
      .addTo(this._barbsLayer);
  }

  // ------------------------------------------------------------------
  // Llegenda
  // ------------------------------------------------------------------

  _formatValidTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var dies = ["dg", "dl", "dt", "dc", "dj", "dv", "ds"];
    var mesos = ["gen", "feb", "mar", "abr", "mai", "jun", "jul", "ago", "set", "oct", "nov", "des"];
    var diaSetmana = dies[d.getUTCDay()];
    var diaNum = d.getUTCDate();
    var mes = mesos[d.getUTCMonth()];
    var any = d.getUTCFullYear();
    var hh = String(d.getUTCHours()).padStart(2, "0");
    var mm = String(d.getUTCMinutes()).padStart(2, "0");
    return diaSetmana + " " + diaNum + " " + mes + " " + any + " · " + hh + ":" + mm + " UTC";
  }

  _updateLegend(varData) {
    if (this._legendControl) {
      this.map.removeControl(this._legendControl);
      this._legendControl = null;
    }

    var isWind = this.currentVariable === "wind";
    var min = varData.range[0];
    var max = varData.range[1];
    var unit = isWind ? "kt" : "°C";
    var title = isWind ? "Vent" : "Temperatura";
    var dataHora = this._formatValidTime(this._data.valid_time);

    var legend = L.control({ position: "bottomright" });
    legend.onAdd = function() {
      var div = L.DomUtil.create("div", "gfs-legend");
      var steps = 6;
      var gradientStops = [];
      for (var i = 0; i <= steps; i++) {
        var frac = i / steps;
        var band = this._findBandForFraction(varData.bands, min, max, frac);
        var color = band ? this._rgbaToCss(band.color_rgba) : "#ccc";
        gradientStops.push(color + " " + (frac * 100) + "%");
      }

      var animatingIndicator = this._isAnimating ? " ▶▶▶" : "";
      var loopIndicator = this._loop ? " 🔄" : "";
      
      var colorInfo = "";
      if (!isWind) {
        if (this.currentLevel === 850) {
          colorInfo = '<div class="gfs-legend-extra">Blau (≤0°) · Negre · Vermell (≥20°)</div>';
        } else if (this.currentLevel === 500) {
          colorInfo = '<div class="gfs-legend-extra">Blau (≤-30°) · Negre · Vermell (≥-10°)</div>';
        } else if (this.currentLevel === 300) {
          colorInfo = '<div class="gfs-legend-extra">Blau (≤-50°) · Negre · Vermell (≥-30°)</div>';
        }
      }

      div.innerHTML = 
        '<div class="gfs-legend-title">' + title + ' (' + this.currentLevel + ' hPa)' + animatingIndicator + loopIndicator + '</div>' +
        '<div class="gfs-legend-datetime">' + dataHora + '</div>' +
        '<div class="gfs-legend-datetime">Dia ' + this.currentDia + ' · Hora ' + String(this.currentHora).padStart(2, "0") + ':00</div>' +
        colorInfo +
        '<div class="gfs-legend-bar" style="background: linear-gradient(to right, ' + gradientStops.join(",") + ')"></div>' +
        '<div class="gfs-legend-labels"><span>' + Math.round(min) + unit + '</span><span>' + Math.round(max) + unit + '</span></div>';
      
      return div;
    }.bind(this);
    legend.addTo(this.map);
    this._legendControl = legend;
  }

  _findBandForFraction(bands, min, max, frac) {
    var target = min + frac * (max - min);
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      if (b.level_min !== null && b.level_max !== null && target >= b.level_min && target <= b.level_max) {
        return b;
      }
    }
    return bands[Math.round(frac * (bands.length - 1))] || null;
  }

  destroy() {
    this.stopAnimation();
    this._cache.clear();
    if (this.map) {
      this.map.remove();
    }
  }
}

// Estils
(function injectGfsStyles() {
  var css = 
    '.gfs-legend {' +
      'background: rgba(11, 14, 23, 0.88);' +
      'padding: 6px 10px;' +
      'border-radius: 3px;' +
      'box-shadow: 0 2px 12px rgba(0,0,0,0.5);' +
      'font: 11px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
      'color: #b0b8c8;' +
      'border: 1px solid rgba(255,255,255,0.04);' +
      'backdrop-filter: blur(8px);' +
    '}' +
    '.gfs-legend-title {' +
      'font-weight: 500;' +
      'margin-bottom: 2px;' +
      'color: #e8edf5;' +
      'letter-spacing: 0.3px;' +
    '}' +
    '.gfs-legend-datetime {' +
      'font-size: 10px;' +
      'color: #5a6378;' +
      'margin-bottom: 2px;' +
    '}' +
    '.gfs-legend-extra {' +
      'font-size: 9px;' +
      'color: #4fc3f7;' +
      'margin-bottom: 4px;' +
      'letter-spacing: 0.2px;' +
    '}' +
    '.gfs-legend-bar {' +
      'width: 160px;' +
      'height: 8px;' +
      'border-radius: 2px;' +
      'margin: 2px 0;' +
    '}' +
    '.gfs-legend-labels {' +
      'display: flex;' +
      'justify-content: space-between;' +
      'margin-top: 2px;' +
      'font-size: 9px;' +
      'color: #5a6378;' +
      'letter-spacing: 0.3px;' +
    '}' +
    '.gfs-line-label {' +
      'background: rgba(11, 14, 23, 0.7);' +
      'border: none;' +
      'box-shadow: none;' +
      'font-size: 8px;' +
      'padding: 0 4px;' +
      'color: #b0b8c8;' +
      'font-weight: 400;' +
      'letter-spacing: 0.3px;' +
    '}' +
    '.gfs-line-label-thick {' +
      'font-weight: 500;' +
      'font-size: 9px;' +
      'background: rgba(11, 14, 23, 0.85);' +
      'color: #e8edf5;' +
    '}' +
    '.gfs-barb-icon { pointer-events: auto; }' +
    '.gfs-country-tooltip {' +
      'background: rgba(11, 14, 23, 0.9);' +
      'border: 1px solid rgba(79, 195, 247, 0.15);' +
      'color: #e8edf5;' +
      'font: 500 11px/1.4 -apple-system, sans-serif;' +
      'padding: 2px 8px;' +
      'border-radius: 3px;' +
      'box-shadow: 0 2px 8px rgba(0,0,0,0.4);' +
    '}';

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();

if (typeof window !== "undefined") {
  window.MapaGFS = MapaGFS;
}