/**
 * mapa-grele.js
 * -----------
 * Mapa interactiu (Leaflet) que pinta cada COMARCA/PROVINCIA d'un geojson
 * segons la FORÇA MÀXIMA del DIAG_GRELE (índex de granís de l'AROME) que
 * li toca a sobre, per a una hora concreta.
 *
 * Font de dades: grele_d{dia:02d}_h{hora:02d}.msgpack.gz
 * (generats per arome_grele_catalunya.py — bandes de contorn amb el valor
 * BRUT de l'índex DIAG_GRELE, aprox. 0-40, NO percentatge).
 *
 * Llindars de color (índex brut):
 *   < 5        -> sense color (risc molt baix / nul)
 *   5  - 10    -> Groc
 *   10 - 20    -> Taronja
 *   20 - 30    -> Vermell
 *   >= 30      -> Morat
 *
 * Per cada comarca es pren el valor MÀXIM de granís que la toca
 * (l'enfocament més alarmista/visible), mirant totes les bandes de
 * contorn del msgpack que intersequen la geometria de la comarca.
 */

class MapaGrele {
  constructor(containerId, opts) {
    opts = opts || {};

    this.opts = Object.assign(
      {
        dataUrlTemplate: "dades_anim/grele_d{dia:02d}_h{hora:02d}.msgpack.gz",
        geojsonUrl: "dades/girona_comarques.geojson",
        // Propietat del geojson que conté el nom de la comarca/provincia
        // (s'autodetecta si es deixa a null, veure _detectNameProp).
        nameProp: null,
        initialCenter: [41.9, 2.6],
        initialZoom: 8,
        onValidTimeChange: null,
        animationDelay: 700,
        maxDia: 4,
        maxHora: 23,
        loop: false,
      },
      opts
    );

    this.map = L.map(containerId, {
      center: this.opts.initialCenter,
      zoom: this.opts.initialZoom,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      subdomains: "abc",
      maxZoom: 14,
    }).addTo(this.map);

    this.map.createPane("comarquesPane");
    this.map.getPane("comarquesPane").style.zIndex = 400;

    this._comarquesLayer = null;
    this._geojsonData = null;
    this._nameProp = this.opts.nameProp;

    this._cache = new Map();
    this.currentDia = null;
    this.currentHora = null;
    this._data = null;
    this._valorsPerComarca = null;

    this._legendControl = null;
    this._animationTimeout = null;
    this._isAnimating = false;
    this._loop = false;

    this._ready = this._init();
  }

  async _init() {
    await this._loadGeojson(this.opts.geojsonUrl);
    this._buildLegend();
  }

  // ------------------------------------------------------------------
  // Carrega del geojson de comarques
  // ------------------------------------------------------------------

  async _loadGeojson(url) {
    var res = await fetch(url);
    if (!res.ok) {
      throw new Error("No s'ha pogut carregar " + url + " (HTTP " + res.status + ")");
    }
    var geojson = await res.json();
    this._geojsonData = geojson;

    if (!this._nameProp) {
      this._nameProp = this._detectNameProp(geojson);
    }

    this._comarquesLayer = L.geoJSON(geojson, {
      pane: "comarquesPane",
      style: this._defaultStyle.bind(this),
      onEachFeature: this._onEachFeature.bind(this),
    }).addTo(this.map);

    try {
      this.map.fitBounds(this._comarquesLayer.getBounds(), { padding: [10, 10] });
    } catch (e) {
      // si el geojson no te geometries valides, es queda al centre per defecte
    }

    console.log("[MapaGrele] Geojson carregat:", url, "| propietat de nom:", this._nameProp);
  }

  _detectNameProp(geojson) {
    var candidats = ["nom_comar", "nomComar", "NOMCOMAR", "nom", "NAME", "name", "comarca", "COMARCA"];
    var feature = geojson.features && geojson.features[0];
    if (!feature || !feature.properties) return "nom";
    var props = feature.properties;
    for (var i = 0; i < candidats.length; i++) {
      if (candidats[i] in props) return candidats[i];
    }
    // si no trobem cap coincidencia coneguda, agafem la primera propietat string
    var keys = Object.keys(props);
    for (var j = 0; j < keys.length; j++) {
      if (typeof props[keys[j]] === "string") return keys[j];
    }
    return keys[0] || "nom";
  }

  _defaultStyle() {
    return {
      color: "#333333",
      weight: 1,
      fillColor: "#cccccc",
      fillOpacity: 0.15,
    };
  }

  _onEachFeature(feature, layer) {
    var nom = this._nomComarca(feature);
    layer.bindTooltip(nom, { sticky: true, className: "grele-comarca-tooltip" });
  }

  _nomComarca(feature) {
    if (!feature || !feature.properties) return "?";
    return feature.properties[this._nameProp] || "?";
  }

  // ------------------------------------------------------------------
  // Carrega de dades de granís
  // ------------------------------------------------------------------

  _buildUrl(dia, hora) {
    var diaStr = String(dia).padStart(2, "0");
    var horaStr = String(hora).padStart(2, "0");
    return this.opts.dataUrlTemplate
      .replace(/\{dia:02d\}/g, diaStr)
      .replace(/\{dia\}/g, diaStr)
      .replace(/\{hora:02d\}/g, horaStr)
      .replace(/\{hora\}/g, horaStr);
  }

  async _fetchAndDecode(url) {
    if (this._cache.has(url)) {
      return this._cache.get(url);
    }

    console.log("[MapaGrele] Descarregant:", url);

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
    if (typeof DecompressionStream !== "undefined") {
      var decompressedStream = res.body.pipeThrough(new DecompressionStream("gzip"));
      buf = await new Response(decompressedStream).arrayBuffer();
    } else {
      throw new Error("DecompressionStream no suportat en aquest navegador.");
    }

    if (typeof MessagePack === "undefined") {
      throw new Error("MessagePack no carregat.");
    }

    var decoded = MessagePack.decode(new Uint8Array(buf));
    console.log("[MapaGrele] Decodificat OK:", url);
    this._cache.set(url, decoded);
    return decoded;
  }

  async load(dia, hora) {
    await this._ready;

    if (dia > this.opts.maxDia) {
      throw new Error("El dia " + dia + " supera el màxim de " + this.opts.maxDia);
    }
    if (hora > this.opts.maxHora) {
      throw new Error("L'hora " + hora + " supera el màxim de " + this.opts.maxHora);
    }

    var url = this._buildUrl(dia, hora);
    var data = await this._fetchAndDecode(url);

    this.currentDia = dia;
    this.currentHora = hora;
    this._data = data;

    this._valorsPerComarca = this._calcularValorsPerComarca(data);
    this._render();

    if (typeof this.opts.onValidTimeChange === "function") {
      this.opts.onValidTimeChange(data.valid_time || null, data);
    }

    return data;
  }

  async setHora(hora) {
    if (hora === this.currentHora && this._data) {
      this._render();
      return;
    }
    await this.load(this.currentDia || 1, hora);
  }

  async setDia(dia) {
    if (dia === this.currentDia && this._data) {
      this._render();
      return;
    }
    await this.load(dia, this.currentHora || 0);
  }

  // ------------------------------------------------------------------
  // Calcul del valor de granís (index brut) per comarca
  // ------------------------------------------------------------------

  /**
   * Per cada comarca, calcula el valor MAXIM de l'index de granís entre
   * totes les bandes de contorn del msgpack que intersequen la seva
   * geometria. S'utilitza level_max de la banda com a valor representatiu
   * (l'extrem superior de l'interval que cobreix aquella banda).
   */
  _calcularValorsPerComarca(data) {
    var valors = {};
    if (!this._geojsonData || !data || !data.grele || !data.grele.bands) {
      return valors;
    }

    var bands = data.grele.bands;
    var features = this._geojsonData.features || [];

    for (var i = 0; i < features.length; i++) {
      var feature = features[i];
      var nom = this._nomComarca(feature);
      var comarcaBBox = this._bboxOfFeature(feature);
      if (!comarcaBBox) continue;

      var maxValor = 0;

      for (var b = 0; b < bands.length; b++) {
        var band = bands[b];
        var valorBanda = band.level_max != null ? band.level_max : band.level_min;
        if (valorBanda == null || valorBanda <= maxValor) continue;

        // comprovacio rapida: si algun ring de la banda intersecta el
        // bbox de la comarca, considerem que la banda hi toca.
        var tocaBanda = false;
        for (var r = 0; r < band.rings.length; r++) {
          if (this._ringIntersectsBBox(band.rings[r], comarcaBBox)) {
            tocaBanda = true;
            break;
          }
        }

        if (tocaBanda) {
          maxValor = valorBanda;
        }
      }

      valors[nom] = maxValor;
    }

    return valors;
  }

  _bboxOfFeature(feature) {
    try {
      var layer = L.geoJSON(feature);
      var b = layer.getBounds();
      if (!b.isValid()) return null;
      return {
        lonMin: b.getWest(),
        lonMax: b.getEast(),
        latMin: b.getSouth(),
        latMax: b.getNorth(),
      };
    } catch (e) {
      return null;
    }
  }

  _ringIntersectsBBox(ring, bbox) {
    // ring: array de [lon, lat]. Comprovacio per bbox (rapida i suficient
    // per a la resolucio d'aquest mapa; no cal interseccio exacta de
    // poligons per decidir un color de comarca).
    var lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
    for (var i = 0; i < ring.length; i++) {
      var lon = ring[i][0];
      var lat = ring[i][1];
      if (lon < lonMin) lonMin = lon;
      if (lon > lonMax) lonMax = lon;
      if (lat < latMin) latMin = lat;
      if (lat > latMax) latMax = lat;
    }
    return !(lonMax < bbox.lonMin || lonMin > bbox.lonMax || latMax < bbox.latMin || latMin > bbox.latMax);
  }

  // ------------------------------------------------------------------
  // Colors segons llindars de l'index de granis
  // ------------------------------------------------------------------

  static llindars() {
    return [
      { min: 30, color: "#8e24aa", label: "Molt alt (≥30)" }, // Morat
      { min: 20, color: "#e53935", label: "Alt (20-30)" },     // Vermell
      { min: 10, color: "#fb8c00", label: "Moderat (10-20)" }, // Taronja
      { min: 5, color: "#fdd835", label: "Baix (5-10)" },      // Groc
    ];
  }

  _colorPerValor(valor) {
    var llindars = MapaGrele.llindars();
    for (var i = 0; i < llindars.length; i++) {
      if (valor >= llindars[i].min) return llindars[i].color;
    }
    return null; // sense color (risc molt baix / nul, < 5)
  }

  // ------------------------------------------------------------------
  // Animació
  // ------------------------------------------------------------------

  async animateHours(dia, startHora, endHora, delayMs, onStep, loop) {
    startHora = startHora != null ? startHora : 0;
    endHora = endHora != null ? endHora : this.opts.maxHora;
    delayMs = delayMs || this.opts.animationDelay || 700;
    loop = loop || false;

    if (this._isAnimating) {
      this.stopAnimation();
      await new Promise(function (resolve) { setTimeout(resolve, 100); });
    }

    this._isAnimating = true;
    this._loop = loop;

    try {
      do {
        for (var hora = startHora; hora <= endHora; hora++) {
          if (!this._isAnimating) break;
          await this.load(dia, hora);
          if (onStep) onStep(dia, hora);
          if (hora < endHora && this._isAnimating) {
            await new Promise(function (resolve) {
              this._animationTimeout = setTimeout(resolve, delayMs);
            }.bind(this));
          }
        }
      } while (this._isAnimating && this._loop);
    } catch (err) {
      console.error("[MapaGrele] Error durant l'animació:", err);
      this._isAnimating = false;
      throw err;
    }

    this._isAnimating = false;
    this._animationTimeout = null;
  }

  stopAnimation() {
    this._isAnimating = false;
    this._loop = false;
    if (this._animationTimeout) {
      clearTimeout(this._animationTimeout);
      this._animationTimeout = null;
    }
  }

  setSpeed(delayMs) {
    this.opts.animationDelay = delayMs;
  }

  // ------------------------------------------------------------------
  // Dibuix
  // ------------------------------------------------------------------

  _render() {
    if (!this._comarquesLayer || !this._valorsPerComarca) return;

    this._comarquesLayer.eachLayer(
      function (layer) {
        var nom = this._nomComarca(layer.feature);
        var valor = this._valorsPerComarca[nom] || 0;
        var color = this._colorPerValor(valor);

        if (color) {
          layer.setStyle({
            color: "#333333",
            weight: 1.2,
            fillColor: color,
            fillOpacity: 0.65,
          });
        } else {
          layer.setStyle(this._defaultStyle());
        }

        var tooltipText = nom + " — índex granís: " + valor.toFixed(1);
        layer.setTooltipContent(tooltipText);
      }.bind(this)
    );

    this._updateLegendInfo();
  }

  // ------------------------------------------------------------------
  // Llegenda
  // ------------------------------------------------------------------

  _buildLegend() {
    var legend = L.control({ position: "bottomright" });
    legend.onAdd = function () {
      var div = L.DomUtil.create("div", "grele-legend");
      div.innerHTML = this._legendHtml();
      return div;
    }.bind(this);
    legend.addTo(this.map);
    this._legendControl = legend;
  }

  _legendHtml(dataHoraStr) {
    var llindars = MapaGrele.llindars().slice().reverse(); // de baix a alt
    var files = "";
    for (var i = 0; i < llindars.length; i++) {
      files +=
        '<div class="grele-legend-row">' +
        '<span class="grele-legend-swatch" style="background:' + llindars[i].color + '"></span>' +
        '<span>' + llindars[i].label + "</span>" +
        "</div>";
    }
    files =
      '<div class="grele-legend-row">' +
      '<span class="grele-legend-swatch" style="background:transparent;border:1px dashed #888"></span>' +
      "<span>Molt baix (&lt;5)</span>" +
      "</div>" + files;

    return (
      '<div class="grele-legend-title">Risc de calamarsa (índex DIAG_GRELE)</div>' +
      '<div class="grele-legend-datetime">' + (dataHoraStr || "") + "</div>" +
      files
    );
  }

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

  _updateLegendInfo() {
    if (!this._legendControl || !this._legendControl.getContainer()) return;
    var dataHora = this._formatValidTime(this._data ? this._data.valid_time : null);
    this._legendControl.getContainer().innerHTML = this._legendHtml(dataHora);
  }

  destroy() {
    this.stopAnimation();
    this._cache.clear();
    if (this.map) {
      this.map.remove();
    }
  }
}

// Estils (coherents amb mapa-gfs.js)
(function injectGreleStyles() {
  var css =
    ".grele-legend {" +
    "background: rgba(11, 14, 23, 0.88);" +
    "padding: 8px 12px;" +
    "border-radius: 3px;" +
    "box-shadow: 0 2px 12px rgba(0,0,0,0.5);" +
    'font: 11px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
    "color: #b0b8c8;" +
    "border: 1px solid rgba(255,255,255,0.04);" +
    "backdrop-filter: blur(8px);" +
    "max-width: 220px;" +
    "}" +
    ".grele-legend-title {" +
    "font-weight: 500;" +
    "margin-bottom: 2px;" +
    "color: #e8edf5;" +
    "letter-spacing: 0.3px;" +
    "}" +
    ".grele-legend-datetime {" +
    "font-size: 10px;" +
    "color: #5a6378;" +
    "margin-bottom: 6px;" +
    "}" +
    ".grele-legend-row {" +
    "display: flex;" +
    "align-items: center;" +
    "gap: 6px;" +
    "margin: 2px 0;" +
    "}" +
    ".grele-legend-swatch {" +
    "display: inline-block;" +
    "width: 14px;" +
    "height: 14px;" +
    "border-radius: 2px;" +
    "flex-shrink: 0;" +
    "}" +
    ".grele-comarca-tooltip {" +
    "background: rgba(11, 14, 23, 0.9);" +
    "border: 1px solid rgba(79, 195, 247, 0.15);" +
    "color: #e8edf5;" +
    "font: 500 11px/1.4 -apple-system, sans-serif;" +
    "padding: 2px 8px;" +
    "border-radius: 3px;" +
    "box-shadow: 0 2px 8px rgba(0,0,0,0.4);" +
    "}";

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();

if (typeof window !== "undefined") {
  window.MapaGrele = MapaGrele;
}