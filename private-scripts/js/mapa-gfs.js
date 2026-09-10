/**
 * mapa-gfs.js
 * -----------
 * Mapa interactiu (Leaflet) amb isolínies de temperatura intel·ligents
 * - 850 hPa: blau a partir de 0°C, vermell a partir de 25°C
 * - 700 hPa: blau a partir de -8°C, vermell a partir de 15°C  (interpolat 850↔500)
 * - 500 hPa: blau a partir de -25°C, vermell a partir de -5°C
 * - 300 hPa: blau a partir de -45°C, vermell a partir de -25°C
 *
 * Aquests 4 nivells (850/700/500/300) són els ÚNICS seleccionables al mapa.
 * Els altres nivells generats pel script Python (1000,950,900,800,750,650,
 * 600,550,450,400,350,250,200,150,100) es reserven per a un sondeig vertical
 * en un altre component i no apareixen aquí (vegeu SONDEIG_ONLY_LEVELS).
 *
 * NOU: Mode "surface" combinat — pressió reduïda al nivell del mar (PRMSL)
 * com a isòbares amb etiqueta de valor incrustada a la línia, superposades
 * sobre les bandes de color de la precipitació acumulada (APCP). Es
 * carreguen i es dibuixen sempre junts.
 *
 * NOU: Sondeig Skew-T sota demanda. Un clic dret al mapa descarrega
 * gfs_sounding_d{dia}_h{hora}.msgpack.gz (graella completa, tots els
 * LEVELS que fa servir el pipeline Python) i obre el modal Skew-T
 * (window.openSkewtModal) amb el perfil vertical del punt més proper.
 *
 * Isolínies cada 10°C (gruixudes) i cada 2°C (fines)
 * Colors: blau per fred, vermell per calor, negre per temperat
 *
 * Selector de velocitat d'animació + bucle infinit
 */

// Nivells seleccionables al mapa (temperatura + vent)
var MAP_LEVELS = [850, 700, 500, 300];

// Nivells que el pipeline Python genera però que NOMÉS serveixen per a un
// sondeig vertical (no tenen entrada al selector d'aquest mapa)
var SONDEIG_ONLY_LEVELS = [1000, 950, 900, 800, 750, 650, 600, 550, 450, 400, 350, 250, 200, 150, 100];

// Tots els nivells que el pipeline Python descarrega i que apareixen al
// fitxer de sondeig (gfs_sounding_d{dia}_h{hora}.msgpack.gz), en ordre
// de pressió decreixent (superfície -> alçada). Ha de coincidir amb
// LEVELS del script Python.
var SOUNDING_LEVELS = [1000, 950, 900, 850, 800, 750, 700, 650, 600, 550,
                        500, 450, 400, 350, 300, 250, 200, 150, 100];

class MapaGFS {
  constructor(containerId, opts) {
    opts = opts || {};

    this.opts = Object.assign(
      {
        dataUrlTemplate: "web_data_EU/gfs_{level}hpa_d{dia:02d}_h{hora:02d}.msgpack.gz",
        surfacePrmslUrlTemplate: "web_data_EU/gfs_prmsl_d{dia:02d}_h{hora:02d}.msgpack.gz",
        surfaceApcpUrlTemplate: "web_data_EU/gfs_apcp_d{dia:02d}_h{hora:02d}.msgpack.gz",
        soundingUrlTemplate: "web_data_EU/gfs_sounding_d{dia:02d}_h{hora:02d}.msgpack.gz",
        // Si es true, un clic dret sobre el mapa obre automàticament el
        // modal Skew-T (window.openSkewtModal) amb el sondeig del punt.
        enableSoundingOnRightClick: true,
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
    this._soundingCache = new Map(); // cache separada pels fitxers de sondeig (poden ser grans)
    this.currentLevel = null;
    this.currentDia = null;
    this.currentHora = null;
    this.currentVariable = null; // "temp" | "wind" | "surface"
    this._data = null;           // dades del nivell (temp/vent)
    this._surfaceData = null;    // { prmsl: {...}, apcp: {...} } quan variable === "surface"
    this._legendControl = null;
    this._animationTimeout = null;
    this._isAnimating = false;
    this._loop = false;
    this._animationType = null; // 'hours', 'days', 'all'

    if (this.opts.bordersUrl) {
      this._loadBorders(this.opts.bordersUrl);
    }

    if (this.opts.enableSoundingOnRightClick) {
      this._bindSoundingRightClick();
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

  _pad2(n) {
    return String(n).padStart(2, "0");
  }

  _buildUrl(level, dia, hora) {
    var diaStr = this._pad2(dia);
    var horaStr = this._pad2(hora);
    return this.opts.dataUrlTemplate
      .replace(/\{level\}/g, level)
      .replace(/\{dia:02d\}/g, diaStr)
      .replace(/\{dia\}/g, diaStr)
      .replace(/\{hora:02d\}/g, horaStr)
      .replace(/\{hora\}/g, horaStr);
  }

  _buildSurfaceUrl(template, dia, hora) {
    var diaStr = this._pad2(dia);
    var horaStr = this._pad2(hora);
    return template
      .replace(/\{dia:02d\}/g, diaStr)
      .replace(/\{dia\}/g, diaStr)
      .replace(/\{hora:02d\}/g, horaStr)
      .replace(/\{hora\}/g, horaStr);
  }

  _buildSoundingUrl(dia, hora) {
    return this._buildSurfaceUrl(this.opts.soundingUrlTemplate, dia, hora);
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

  /**
   * Igual que _fetchAndDecode però amb una cache pròpia (els fitxers de
   * sondeig poden ser més grans i no cal barrejar-los amb la cache dels
   * mapes de nivell/superfície).
   */
  async _fetchAndDecodeSounding(url) {
    if (this._soundingCache.has(url)) {
      return this._soundingCache.get(url);
    }

    console.log("[MapaGFS] Descarregant sondeig:", url);

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

    console.log("[MapaGFS] Sondeig decodificat OK:", url);
    this._soundingCache.set(url, decoded);
    return decoded;
  }

  /**
   * Carrega un nivell de pressió (temp/vent). Només vàlid per a MAP_LEVELS.
   */
  async load(level, dia, hora, variable) {
    variable = variable || "temp";

    if (variable === "surface") {
      return this.loadSurface(dia, hora);
    }

    if (MAP_LEVELS.indexOf(level) === -1) {
      throw new Error(
        "El nivell " + level + " hPa no és seleccionable en aquest mapa (només " +
        MAP_LEVELS.join(", ") + " hPa). Els altres nivells són només per al sondeig."
      );
    }

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
    this._surfaceData = null;

    this._render();

    if (typeof this.opts.onValidTimeChange === "function") {
      this.opts.onValidTimeChange(data.valid_time || null, data);
    }

    return data;
  }

  /**
   * Carrega el mode combinat de superfície: pressió (isòbares) + pluja
   * (bandes de color). Sempre es carreguen i es dibuixen junts.
   */
  async loadSurface(dia, hora) {
    if (dia > this.opts.maxDays) {
      throw new Error("El dia " + dia + " supera el màxim de " + this.opts.maxDays);
    }
    if (hora > this.opts.maxHours) {
      throw new Error("L'hora " + hora + " supera el màxim de " + this.opts.maxHours);
    }

    var prmslUrl = this._buildSurfaceUrl(this.opts.surfacePrmslUrlTemplate, dia, hora);
    var apcpUrl = this._buildSurfaceUrl(this.opts.surfaceApcpUrlTemplate, dia, hora);

    var results = await Promise.all([
      this._fetchAndDecode(prmslUrl),
      this._fetchAndDecode(apcpUrl),
    ]);
    var prmslData = results[0];
    var apcpData = results[1];

    this.currentLevel = null;
    this.currentDia = dia;
    this.currentHora = hora;
    this.currentVariable = "surface";
    this._data = null;
    this._surfaceData = { prmsl: prmslData, apcp: apcpData };

    this._render();

    var validTime = (prmslData && prmslData.valid_time) || (apcpData && apcpData.valid_time) || null;
    if (typeof this.opts.onValidTimeChange === "function") {
      this.opts.onValidTimeChange(validTime, this._surfaceData);
    }

    return this._surfaceData;
  }

  // ------------------------------------------------------------------
  // Sondeig Skew-T
  // ------------------------------------------------------------------

  /**
   * Troba l'índex (i, j) del punt de graella regular (lons[], lats[])
   * més proper a (lat, lon). Assumeix graella regular però no necessita
   * que estigui ordenada de cap manera concreta (fa cerca lineal, ja que
   * la graella de sondeig no sol tenir més de ~1500x600 punts).
   */
  _indexGraellaMesProper(lons, lats, lat, lon) {
    var jBest = 0, bestDLon = Infinity;
    for (var j = 0; j < lons.length; j++) {
      var d = Math.abs(lons[j] - lon);
      if (d < bestDLon) { bestDLon = d; jBest = j; }
    }
    var iBest = 0, bestDLat = Infinity;
    for (var i = 0; i < lats.length; i++) {
      var d2 = Math.abs(lats[i] - lat);
      if (d2 < bestDLat) { bestDLat = d2; iBest = i; }
    }
    return { i: iBest, j: jBest, distLon: bestDLon, distLat: bestDLat };
  }

  /**
   * Descarrega (o reutilitza de la cache) el fitxer de sondeig del
   * dia/hora indicats i en munta el perfil vertical {p, t, td, u, v, z}
   * per al punt (lat, lon) més proper de la graella, en el format que
   * espera SkewtEngine.calcularIndexsTermo (ordenat per pressió
   * decreixent, és a dir, de superfície cap a l'alçada).
   *
   * Retorna { perfil, meta } on meta conté lat/lon reals del punt de
   * graella trobat, distància, dia, hora, valid_time, etc.
   */
  async fetchSoundingProfile(lat, lon, dia, hora) {
    if (dia > this.opts.maxDays) {
      throw new Error("El dia " + dia + " supera el màxim de " + this.opts.maxDays);
    }
    if (hora > this.opts.maxHours) {
      throw new Error("L'hora " + hora + " supera el màxim de " + this.opts.maxHours);
    }

    var url = this._buildSoundingUrl(dia, hora);
    var raw = await this._fetchAndDecodeSounding(url);

    if (!raw || !raw.lons || !raw.lats || !raw.data) {
      throw new Error("Fitxer de sondeig invàlid o buit: " + url);
    }

    var lons = raw.lons, lats = raw.lats;
    var nLon = raw.n_lons || lons.length;

    var idx = this._indexGraellaMesProper(lons, lats, lat, lon);
    var flatIdx = idx.i * nLon + idx.j;

    // Nivells disponibles al fitxer, en l'ordre en què el pipeline
    // Python els ha exportat (SOUNDING_LEVELS és l'ordre de referència,
    // però només agafem els que realment són a raw.levels).
    var levelsDisponibles = SOUNDING_LEVELS.filter(function (lvl) {
      return raw.levels.indexOf(lvl) !== -1 && raw.data[String(lvl)];
    });

    var perfil = { p: [], t: [], td: [], u: [], v: [] };

    levelsDisponibles.forEach(function (lvl) {
      var d = raw.data[String(lvl)];
      var tv = d.t[flatIdx];
      var tdv = d.td[flatIdx];
      var uv = d.u[flatIdx];
      var vv = d.v[flatIdx];

      if (tv === null || tv === undefined) return; // nivell sota terra o sense dada

      perfil.p.push(lvl);
      perfil.t.push(tv);
      perfil.td.push((tdv === null || tdv === undefined) ? tv - 5 : tdv); // fallback conservador
      perfil.u.push((uv === null || uv === undefined) ? 0 : uv);
      perfil.v.push((vv === null || vv === undefined) ? 0 : vv);
    });

    if (perfil.p.length < 3) {
      throw new Error("No hi ha prou nivells vàlids per construir el sondeig en aquest punt.");
    }

    // Ordenar per pressió decreixent (superfície -> alçada), tal com
    // espera SkewtEngine.
    var ordre = perfil.p.map(function (_, i) { return i; })
      .sort(function (a, b) { return perfil.p[b] - perfil.p[a]; });

    var net = { p: [], t: [], td: [], u: [], v: [] };
    ordre.forEach(function (i) {
      net.p.push(perfil.p[i]);
      net.t.push(perfil.t[i]);
      net.td.push(perfil.td[i]);
      net.u.push(perfil.u[i]);
      net.v.push(perfil.v[i]);
    });

    // Alçada geopotencial aproximada (atmosfera estàndard) per a cada
    // nivell, igual que fa skewt-engine.js internament.
    var E = window.SkewtEngine;
    net.z = net.p.map(function (pHpa) {
      if (E && E.pressioAAlcada) return E.pressioAAlcada(pHpa);
      // Fallback local si SkewtEngine encara no està carregat.
      var T0 = 288.15, p0 = 1013.25, lapse = 0.0065, RD = 287.05, G0 = 9.80665;
      return (T0 / lapse) * (1.0 - Math.pow(pHpa / p0, RD * lapse / G0));
    });

    var meta = {
      lat: lats[idx.i],
      lon: lons[idx.j],
      latClic: lat,
      lonClic: lon,
      distLat: idx.distLat,
      distLon: idx.distLon,
      dia: dia,
      hora: hora,
      valid_time: raw.valid_time || null,
      fxx: raw.fxx,
    };

    return { perfil: net, meta: meta };
  }

  /**
   * Descarrega el sondeig per (lat, lon, dia, hora) i obre directament
   * el modal Skew-T (window.openSkewtModal), deixant el perfil i el punt
   * precarregats a window._skewtPerfilPrecarregat / _skewtPuntPrecarregat
   * (mecanisme ja existent a skewt-modal.js).
   */
  async openSoundingAt(lat, lon, dia, hora) {
    if (typeof window.openSkewtModal !== "function") {
      throw new Error("window.openSkewtModal no està definit. Comprova que skewt-modal.js estigui carregat.");
    }

    var resultat = await this.fetchSoundingProfile(lat, lon, dia, hora);

    window._skewtPerfilPrecarregat = resultat.perfil;
    window._skewtPuntPrecarregat = {
      lat: resultat.meta.lat,
      lon: resultat.meta.lon,
      hourIdx: (dia - 1) * 24 + hora,
    };

    window.openSkewtModal();

    return resultat;
  }

  /**
   * Enganxa un listener de clic dret al mapa Leaflet: obre el sondeig
   * pel dia/hora actualment mostrats al mapa GFS. Si el mapa encara no
   * ha carregat cap frame (currentDia/currentHora nuls), es fa servir
   * dia 1 / hora 0 per defecte.
   */
  _bindSoundingRightClick() {
    var self = this;
    this.map.on("contextmenu", function (e) {
      // Evita el menú contextual del navegador.
      if (e.originalEvent) e.originalEvent.preventDefault();

      var lat = e.latlng.lat;
      var lon = e.latlng.lng;
      var dia = self.currentDia || 1;
      var hora = (self.currentHora !== null && self.currentHora !== undefined) ? self.currentHora : 0;

      self.openSoundingAt(lat, lon, dia, hora).catch(function (err) {
        console.error("[MapaGFS] Error obrint sondeig:", err);
        if (typeof window.showToast === "function") {
          window.showToast("Sondeig: " + err.message);
        } else {
          alert("No s'ha pogut carregar el sondeig: " + err.message);
        }
      });
    });
  }

  setVariable(variable) {
    if (variable === "surface") {
      if (!this._surfaceData) return;
      this.currentVariable = "surface";
      this._render();
      return;
    }
    if (!this._data) return;
    this.currentVariable = variable;
    this._render();
  }

  async setDia(dia) {
    if (dia === this.currentDia && (this._data || this._surfaceData)) {
      this._render();
      return;
    }
    var hora = this.currentHora || 0;
    if (this.currentVariable === "surface") {
      await this.loadSurface(dia, hora);
    } else {
      await this.load(this.currentLevel, dia, hora, this.currentVariable);
    }
  }

  async setHora(hora) {
    if (hora === this.currentHora && (this._data || this._surfaceData)) {
      this._render();
      return;
    }
    if (this.currentVariable === "surface") {
      await this.loadSurface(this.currentDia, hora);
    } else {
      await this.load(this.currentLevel, this.currentDia, hora, this.currentVariable);
    }
  }

  // ------------------------------------------------------------------
  // ANIMACIÓ AMB BUCLE I VELOCITAT
  // ------------------------------------------------------------------

  async _loadCurrentFrame(dia, hora) {
    if (this.currentVariable === "surface") {
      return this.loadSurface(dia, hora);
    }
    return this.load(this.currentLevel, dia, hora, this.currentVariable);
  }

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

    if (!this.currentLevel && this.currentVariable !== "surface") {
      await this.load(850, dia, startHora, "temp");
    }

    try {
      do {
        for (var hora = startHora; hora <= endHora; hora++) {
          if (!this._isAnimating) break;
          await this._loadCurrentFrame(dia, hora);
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

    if (!this.currentLevel && this.currentVariable !== "surface") {
      await this.load(850, startDia, hora, "temp");
    }

    try {
      do {
        for (var dia = startDia; dia <= endDia; dia++) {
          if (!this._isAnimating) break;
          await this._loadCurrentFrame(dia, hora);
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

    if (!this.currentLevel && this.currentVariable !== "surface") {
      await this.load(850, startDia, startHora, "temp");
    }

    try {
      do {
        for (var dia = startDia; dia <= endDia; dia++) {
          if (!this._isAnimating) break;
          for (var hora = startHora; hora <= endHora; hora++) {
            if (!this._isAnimating) break;
            await this._loadCurrentFrame(dia, hora);
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

_getTempLineColor(level, tempValue) {
    // Sempre retorna un color visible!
    var intensity = 0;
    var r = 0, g = 0, b = 0;
    
    // Per a TOTS els nivells: gradient de blau (fred) a vermell (calor)
    // Així SEMPRE hi haurà color a les línies!
    
    if (level === 850) {
        // Rang típic per a 850 hPa: -40°C a 40°C
        var norm = (tempValue + 40) / 80; // 0 a 1
        norm = Math.max(0, Math.min(1, norm));
        
        // Blau (fred) -> Verd -> Vermell (calor)
        r = Math.round(20 + 235 * norm);
        g = Math.round(60 + 100 * (1 - Math.abs(norm - 0.5) * 2));
        b = Math.round(255 - 235 * norm);
        
    } else if (level === 700) {
        var norm = (tempValue + 50) / 90;
        norm = Math.max(0, Math.min(1, norm));
        r = Math.round(20 + 235 * norm);
        g = Math.round(60 + 100 * (1 - Math.abs(norm - 0.5) * 2));
        b = Math.round(255 - 235 * norm);
        
    } else if (level === 500) {
        var norm = (tempValue + 60) / 80;
        norm = Math.max(0, Math.min(1, norm));
        r = Math.round(20 + 235 * norm);
        g = Math.round(60 + 100 * (1 - Math.abs(norm - 0.5) * 2));
        b = Math.round(255 - 235 * norm);
        
    } else if (level === 300) {
        var norm = (tempValue + 80) / 80;
        norm = Math.max(0, Math.min(1, norm));
        r = Math.round(20 + 235 * norm);
        g = Math.round(60 + 100 * (1 - Math.abs(norm - 0.5) * 2));
        b = Math.round(255 - 235 * norm);
        
    } else {
        // Fallback per a qualsevol altre nivell
        var norm = (tempValue + 50) / 100;
        norm = Math.max(0, Math.min(1, norm));
        r = Math.round(20 + 235 * norm);
        g = Math.round(60 + 100 * (1 - Math.abs(norm - 0.5) * 2));
        b = Math.round(255 - 235 * norm);
    }
    
    return "rgb(" + r + ", " + g + ", " + b + ")";
}

  _render() {
    this._clearLayers();

    if (this.currentVariable === "surface") {
      this._renderSurface();
      this._updateLegend(null);
      return;
    }

    if (!this._data) return;

    var varData = this.currentVariable === "wind" ? this._data.wind : this._data.temperature;
    if (!varData) {
      console.warn("[MapaGFS] No hi ha dades per a:", this.currentVariable);
      return;
    }

    // BANDES DE COLOR
    this._renderBands(varData.bands);

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

  _renderBands(bands) {
    if (!bands) return;
    for (var i = 0; i < bands.length; i++) {
      var band = bands[i];
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
  }

  /**
   * Mode combinat de superfície: bandes de color de la pluja (APCP) de
   * fons, amb les isòbares de la pressió (PRMSL) a sobre. L'etiqueta de
   * valor de cada isòbara va incrustada al mig de la línia (sense hover).
   */
  _renderSurface() {
    if (!this._surfaceData) return;
    var prmslData = this._surfaceData.prmsl;
    var apcpData = this._surfaceData.apcp;

    // 1) Pluja com a bandes de color de fons
    if (apcpData && apcpData.precipitation) {
      this._renderBands(apcpData.precipitation.bands);
    }

    // 2) Isòbares de pressió per sobre, amb número incrustat a la línia
    if (prmslData && prmslData.pressure && prmslData.pressure.isolines) {
      var isolines = prmslData.pressure.isolines;
      for (var i = 0; i < isolines.length; i++) {
        var line = isolines[i];
        var latlngs = [];
        for (var k = 0; k < line.coords.length; k++) {
          var coord = line.coords[k];
          latlngs.push([coord[1], coord[0]]);
        }
        if (latlngs.length < 2) continue;

        var roundedVal = Math.round(line.value);
        var isThick = roundedVal % 8 === 0; // cada 8 hPa una isòbara més gruixuda i etiquetada

        var poly = L.polyline(latlngs, {
          pane: "linesPane",
          color: "#111111",
          weight: isThick ? 1.6 : 1,
          opacity: 0.85,
          interactive: false,
        }).addTo(this._linesLayer);

        if (isThick) {
          // Etiqueta incrustada al punt central de la línia, sense hover
          var midIdx = Math.floor(latlngs.length / 2);
          var midPoint = latlngs[midIdx];
          var label = L.marker(midPoint, {
            pane: "linesPane",
            interactive: false,
            icon: L.divIcon({
              className: "gfs-isobar-label",
              html: '<span>' + roundedVal + '</span>',
              iconSize: [30, 14],
              iconAnchor: [15, 7],
            }),
          }).addTo(this._linesLayer);
        }
      }
    }
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

    if (this.currentVariable === "surface") {
      this._updateSurfaceLegend();
      return;
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
        } else if (this.currentLevel === 700) {
          colorInfo = '<div class="gfs-legend-extra">Blau (≤-8°) · Negre · Vermell (≥15°)</div>';
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

  _updateSurfaceLegend() {
    if (!this._surfaceData || !this._surfaceData.apcp || !this._surfaceData.prmsl) return;
    var apcpData = this._surfaceData.apcp;
    var prmslData = this._surfaceData.prmsl;
    var precip = apcpData.precipitation;
    var min = precip.range[0];
    var max = precip.range[1];
    var dataHora = this._formatValidTime(prmslData.valid_time || apcpData.valid_time);

    var legend = L.control({ position: "bottomright" });
    legend.onAdd = function() {
      var div = L.DomUtil.create("div", "gfs-legend");
      var steps = 6;
      var gradientStops = [];
      for (var i = 0; i <= steps; i++) {
        var frac = i / steps;
        var band = this._findBandForFraction(precip.bands, min, max, frac);
        var color = band ? this._rgbaToCss(band.color_rgba) : "#ccc";
        gradientStops.push(color + " " + (frac * 100) + "%");
      }

      var animatingIndicator = this._isAnimating ? " ▶▶▶" : "";
      var loopIndicator = this._loop ? " 🔄" : "";

      div.innerHTML =
        '<div class="gfs-legend-title">Pressió + Pluja (superfície)' + animatingIndicator + loopIndicator + '</div>' +
        '<div class="gfs-legend-datetime">' + dataHora + '</div>' +
        '<div class="gfs-legend-datetime">Dia ' + this.currentDia + ' · Hora ' + String(this.currentHora).padStart(2, "0") + ':00</div>' +
        '<div class="gfs-legend-extra">Línies: isòbares PRMSL (hPa) · Fons: pluja acumulada</div>' +
        '<div class="gfs-legend-bar" style="background: linear-gradient(to right, ' + gradientStops.join(",") + ')"></div>' +
        '<div class="gfs-legend-labels"><span>' + Math.round(min) + ' mm</span><span>' + Math.round(max) + ' mm</span></div>';

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
    this._soundingCache.clear();
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
    '.gfs-isobar-label {' +
      'pointer-events: none;' +
    '}' +
    '.gfs-isobar-label span {' +
      'display: inline-block;' +
      'background: rgba(255, 255, 255, 0.82);' +
      'color: #111;' +
      'font: 600 9px/1 -apple-system, sans-serif;' +
      'padding: 1px 4px;' +
      'border-radius: 2px;' +
      'white-space: nowrap;' +
    '}' +
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
  window.MAP_LEVELS = MAP_LEVELS;
  window.SONDEIG_ONLY_LEVELS = SONDEIG_ONLY_LEVELS;
  window.SOUNDING_LEVELS = SOUNDING_LEVELS;
}