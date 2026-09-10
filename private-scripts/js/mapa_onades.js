// ============================================================
// mapa_onades.js — VERSIO OPTIMITZADA · Render per textura,
// clic per veure valor, i animacio de flux d'onades
// ============================================================

class MapaOnades {
    constructor(containerId = 'mapa') {
        this.containerId = containerId;
        this.fronteresURL = 'dades/espanya_provincies.geojson';
        this.dadesDir = 'webdata_waves/';

        this.bounds = {
            south: 40.40,
            north: 42.95,
            west: 0.10,
            east: 3.60
        };

        this.mapa = null;
        this.canvasLayer = null;
        this.canvas = null;
        this.ctx = null;
        this.particleCanvas = null;
        this.particleCtx = null;
        this.fronteresLayer = null;
        this.dadesActuals = null;
        this.horaActual = 0;
        this.totalHores = 48;
        this.varActiva = 'swh';

        // Escala comuna per a totes les variables
        this.escalaComuna = [
            {v:0,r:200,g:200,b:255},{v:5,r:150,g:200,b:255},{v:10,r:100,g:180,b:255},
            {v:15,r:0,g:150,b:255},{v:20,r:0,g:200,b:220},{v:25,r:0,g:220,b:180},
            {v:30,r:0,g:255,b:100},{v:35,r:50,g:255,b:0},{v:40,r:150,g:255,b:0},
            {v:45,r:220,g:255,b:0},{v:50,r:255,g:255,b:0},{v:55,r:255,g:230,b:0},
            {v:60,r:255,g:200,b:0},{v:65,r:255,g:170,b:0},{v:70,r:255,g:140,b:0},
            {v:75,r:255,g:110,b:0},{v:80,r:255,g:80,b:0},{v:85,r:255,g:50,b:0},
            {v:90,r:255,g:20,b:0},{v:95,r:255,g:0,b:0},{v:100,r:230,g:0,b:0},
            {v:110,r:210,g:0,b:0},{v:120,r:190,g:0,b:30},{v:130,r:170,g:0,b:60},
            {v:140,r:150,g:0,b:100},{v:150,r:130,g:0,b:140},{v:160,r:180,g:0,b:180},
            {v:170,r:200,g:0,b:200},{v:180,r:220,g:20,b:220},{v:190,r:240,g:50,b:240},
            {v:200,r:250,g:100,b:250},{v:220,r:255,g:150,b:255},{v:240,r:255,g:200,b:255},
            {v:260,r:255,g:220,b:255},{v:280,r:255,g:240,b:255},{v:300,r:255,g:255,b:255}
        ];

        this.varsConfig = {
            'swh':    { 
                nom: 'Alçada total de les ones',  
                min: 0, max: 6, unitat: 'm', 
                escala: this.escalaComuna,
                particula: { cos: '#ffffff', vora: '#000000' }
            },
            'shww':   { 
                nom: 'Alçada de les ones de vent',          
                min: 0, max: 4, unitat: 'm', 
                escala: this.escalaComuna,
                particula: { cos: '#ffffff', vora: '#000000' }
            },
            'shts':   { 
                nom: 'Alçada de les ones de fons (mar de lluny)',    
                min: 0, max: 5, unitat: 'm', 
                escala: this.escalaComuna,
                particula: { cos: '#ffffff', vora: '#000000' }
            },
            'si10':   { 
                nom: 'Velocitat del vent',     
                min: 0, max: 40, unitat: 'nusos', 
                escala: this.escalaComuna,
                particula: { cos: '#ffffff', vora: '#000000' }
            },
            'pp1d':   { 
                nom: 'Període de les ones més grans',              
                min: 2, max: 14, unitat: 's', 
                escala: this.escalaComuna,
                particula: { cos: '#ffffff', vora: '#000000' }
            },
            'mwp':    { 
                nom: 'Període mitjà de totes les ones',               
                min: 2, max: 12, unitat: 's', 
                escala: this.escalaComuna,
                particula: { cos: '#ffffff', vora: '#000000' }
            },
            'mwd':    { 
                nom: 'Direcció d\'on venen les ones',            
                min: 0, max: 360, unitat: 'graus', 
                escala: this.escalaComuna,
                particula: { cos: '#ffffff', vora: '#000000' }
            },
            'wdir10': { 
                nom: 'Direcció del vent',           
                min: 0, max: 360, unitat: 'graus', 
                escala: this.escalaComuna,
                particula: { cos: '#ffffff', vora: '#000000' }
            }
        };

        this.direccioPerVar = {
            swh: 'mwd', shww: 'mwd', shts: 'mwd', pp1d: 'mwd', mwp: 'mwd',
            si10: 'wdir10', mwd: 'mwd', wdir10: 'wdir10'
        };

        // ------------------------------------------------------------
        // Quina(es) variable(s) determinen la VELOCITAT de l'animacio
        // per a cada capa activa. Aixo es independent de quina variable
        // es dibuixa en color al mapa de fons.
        //
        // - Per a variables que JA son una magnitud fisica de moviment
        //   (altura d'ona, vent...) s'usa ella mateixa.
        // - Per a periodes (pp1d, mwp) que no son "velocitat" en si,
        //   s'usa l'altura d'ona (swh) com a proxy de la magnitud.
        // - Per a variables de DIRECCIO (mwd, wdir10), que no porten
        //   informacio de magnitud, es fa una mitjana ponderada entre
        //   vent (si10) i altura d'ona (swh), normalitzats cadascun
        //   al seu propi rang, per tenir una velocitat "combinada"
        //   realista de com es mou el mar en aquell punt.
        // ------------------------------------------------------------
        this.velocitatPerVar = {
            swh:    { tipus: 'simple', vars: ['swh'] },
            shww:   { tipus: 'simple', vars: ['shww'] },
            shts:   { tipus: 'simple', vars: ['shts'] },
            si10:   { tipus: 'simple', vars: ['si10'] },
            pp1d:   { tipus: 'simple', vars: ['swh'] },
            mwp:    { tipus: 'simple', vars: ['swh'] },
            mwd:    { tipus: 'combinada', vars: ['si10', 'swh'], pesos: [0.5, 0.5] },
            wdir10: { tipus: 'combinada', vars: ['si10', 'swh'], pesos: [0.5, 0.5] }
        };

        this.cacheDades = {};
        this.gridCanvasCache = {};
        this.lats = null;
        this.lons = null;
        this.nlat = 0;
        this.nlon = 0;
        this.latAscending = true;
        this.lonAscending = true;
        this.dataBounds = null;
        this.stepLat = 1;
        this.stepLon = 1;

        this.particles = [];
        this.numParticles = 6600;
        this.animantParticules = true;
        this.animFrameId = null;
        this.marcadorClic = null;
        this.popupClic = null;
        this.topLeft = { x: 0, y: 0 };
    }

    async inicialitzar() {
        try {
            const status = await this.carregarJSON(this.dadesDir + 'status.json');
            this.totalHores = status.total_hores || 48;
        } catch (e) {
            console.warn('status.json no trobat, usant 48h');
        }

        this.crearMapa();

        try {
            const geojson = await this.carregarJSON(this.fronteresURL);
            this.fronteresLayer = L.geoJSON(geojson, {
                style: { color: '#4a5568', weight: 1.5, opacity: 0.6, fillOpacity: 0, dashArray: '6 4' }
            }).addTo(this.mapa);
        } catch (e) {
            console.warn('Fronteres no disponibles');
        }

        this.crearCapaCanvas();
        this.configurarClic();
        await this.carregarHora(0);
        
        setTimeout(() => {
            if (this.particleCanvas) {
                this.iniciarAnimacio();
            }
        }, 500);
    }

    crearMapa() {
        const centerLat = (this.bounds.south + this.bounds.north) / 2;
        const centerLon = (this.bounds.west + this.bounds.east) / 2;

        this.mapa = L.map(this.containerId, {
            center: [centerLat, centerLon],
            zoom: 8,
            minZoom: 7,
            maxZoom: 12,
            zoomControl: true,
            attributionControl: false,
            preferCanvas: true
        });

        const sw = L.latLng(this.bounds.south, this.bounds.west);
        const ne = L.latLng(this.bounds.north, this.bounds.east);
        this.mapa.setMaxBounds(L.latLngBounds(sw, ne).pad(0.2));

        L.tileLayer('https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/orto-hibrida/MON3857NW/{z}/{x}/{y}.png', {
            subdomains: 'abcd',
            maxZoom: 12,
            minZoom: 7
        }).addTo(this.mapa);

        L.control.attribution({
            position: 'bottomleft',
            prefix: 'MFWAM0025 | '
        }).addAttribution('MeteoFetch').addTo(this.mapa);
    }

    crearCapaCanvas() {
        const self = this;

        const CanvasLayer = L.Layer.extend({
            initialize: function () {
                this._canvas = document.createElement('canvas');
                this._canvas.style.position = 'absolute';
                this._canvas.style.top = '0';
                this._canvas.style.left = '0';
                this._canvas.style.pointerEvents = 'none';
                this._canvas.style.zIndex = '400';
                L.DomUtil.addClass(this._canvas, 'leaflet-zoom-animated');
                this._ctx = this._canvas.getContext('2d');

                this._pCanvas = document.createElement('canvas');
                this._pCanvas.style.position = 'absolute';
                this._pCanvas.style.top = '0';
                this._pCanvas.style.left = '0';
                this._pCanvas.style.pointerEvents = 'none';
                this._pCanvas.style.zIndex = '410';
                L.DomUtil.addClass(this._pCanvas, 'leaflet-zoom-animated');
                this._pCtx = this._pCanvas.getContext('2d');
            },

            onAdd: function (map) {
                map.getPanes().overlayPane.appendChild(this._canvas);
                map.getPanes().overlayPane.appendChild(this._pCanvas);
                map.on('moveend', this._reset, this);
                map.on('zoomend', this._reset, this);
                map.on('resize', this._reset, this);
                if (map.options.zoomAnimation) {
                    map.on('zoomanim', this._animateZoom, this);
                }
                this._reset();
            },

            onRemove: function (map) {
                map.getPanes().overlayPane.removeChild(this._canvas);
                map.getPanes().overlayPane.removeChild(this._pCanvas);
                map.off('moveend', this._reset, this);
                map.off('zoomend', this._reset, this);
                map.off('resize', this._reset, this);
                map.off('zoomanim', this._animateZoom, this);
            },

            _animateZoom: function (e) {
                const map = this._map;
                const scale = map.getZoomScale(e.zoom);
                const offset = map._latLngToNewLayerPoint(map.containerPointToLatLng([0, 0]), e.zoom, e.center);
                [this._canvas, this._pCanvas].forEach(c => {
                    L.DomUtil.setTransform(c, offset, scale);
                });
            },

            _reset: function () {
                const map = this._map;
                if (!map) return;
                const size = map.getSize();
                const topLeft = map.containerPointToLayerPoint([0, 0]);

                [this._canvas, this._pCanvas].forEach(c => {
                    L.DomUtil.setTransform(c, new L.Point(0, 0), 1);
                    L.DomUtil.setPosition(c, topLeft);
                    c.width = size.x;
                    c.height = size.y;
                    c.style.width = size.x + 'px';
                    c.style.height = size.y + 'px';
                });

                self.topLeft = topLeft;
                if (self.dadesActuals) self.renderitzar();
            },

            getCanvas: function () { return this._canvas; },
            getCtx: function () { return this._ctx; },
            getParticleCanvas: function () { return this._pCanvas; },
            getParticleCtx: function () { return this._pCtx; }
        });

        this.canvasLayer = new CanvasLayer();
        this.canvasLayer.addTo(this.mapa);

        setTimeout(() => {
            this.canvas = this.canvasLayer.getCanvas();
            this.ctx = this.canvasLayer.getCtx();
            this.particleCanvas = this.canvasLayer.getParticleCanvas();
            this.particleCtx = this.canvasLayer.getParticleCtx();
        }, 200);
    }

    puntCanvas(lat, lon) {
        const lp = this.mapa.latLngToLayerPoint([lat, lon]);
        const tl = this.topLeft || { x: 0, y: 0 };
        return { x: lp.x - tl.x, y: lp.y - tl.y };
    }

    async carregarJSON(url) {
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
        return await resposta.json();
    }

    async carregarHora(hora) {
        if (this.cacheDades[hora]) {
            this.dadesActuals = this.cacheDades[hora];
            this.horaActual = hora;
            this.renderitzar();
            return true;
        }

        const nomFitxer = 'mar_' + String(hora).padStart(2, '0') + '.json';
        const url = this.dadesDir + nomFitxer;

        try {
            const dades = await this.carregarJSON(url);

            if (!this.lats && dades.coordenadas) {
                this.lats = dades.coordenadas.lat;
                this.lons = dades.coordenadas.lon;
                this.nlat = this.lats.length;
                this.nlon = this.lons.length;
                this.stepLat = this.lats[1] - this.lats[0];
                this.stepLon = this.lons[1] - this.lons[0];

                this.latAscending = this.lats[this.nlat - 1] > this.lats[0];
                this.lonAscending = this.lons[this.nlon - 1] > this.lons[0];

                const north = this.latAscending ? this.lats[this.nlat - 1] : this.lats[0];
                const south = this.latAscending ? this.lats[0] : this.lats[this.nlat - 1];
                const west = this.lonAscending ? this.lons[0] : this.lons[this.nlon - 1];
                const east = this.lonAscending ? this.lons[this.nlon - 1] : this.lons[0];
                this.dataBounds = { north, south, west, east };
            }

            this.cacheDades[hora] = dades;
            this.dadesActuals = dades;
            this.horaActual = hora;
            this.renderitzar();
            return true;
        } catch (e) {
            console.error('Error +' + hora + 'h:', e.message);
            return false;
        }
    }

    renderitzar() {
        if (!this.ctx || !this.canvas || !this.dadesActuals || !this.dadesActuals.variables) return;

        const vars = this.dadesActuals.variables;
        const varData = vars[this.varActiva];
        if (!varData) return;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        const gridCanvas = this.obtenirGridCanvas(this.varActiva, this.horaActual, varData);
        if (!gridCanvas || !this.dataBounds) return;

        const pNW = this.puntCanvas(this.dataBounds.north, this.dataBounds.west);
        const pSE = this.puntCanvas(this.dataBounds.south, this.dataBounds.east);
        const x = pNW.x;
        const y = pNW.y;
        const destW = pSE.x - pNW.x;
        const destH = pSE.y - pNW.y;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(gridCanvas, x, y, destW, destH);
    }

    interpolarColorEscala(escala, t) {
        if (!escala || escala.length === 0) return [128, 128, 128];
        if (t <= 0) return [escala[0].r, escala[0].g, escala[0].b];
        if (t >= 1) {
            const ultim = escala[escala.length - 1];
            return [ultim.r, ultim.g, ultim.b];
        }
        
        const vMin = escala[0].v;
        const vMax = escala[escala.length - 1].v;
        const valor = vMin + t * (vMax - vMin);
        
        let i = 0;
        for (i = 0; i < escala.length - 1; i++) {
            if (valor <= escala[i + 1].v) break;
        }
        
        const p1 = escala[i];
        const p2 = escala[Math.min(i + 1, escala.length - 1)];
        
        if (p1.v === p2.v) return [p1.r, p1.g, p1.b];
        
        const frac = (valor - p1.v) / (p2.v - p1.v);
        return [
            Math.round(p1.r + (p2.r - p1.r) * frac),
            Math.round(p1.g + (p2.g - p1.g) * frac),
            Math.round(p1.b + (p2.b - p1.b) * frac)
        ];
    }

    obtenirGridCanvas(varId, hora, varData) {
        const key = hora + '_' + varId;
        if (this.gridCanvasCache[key]) return this.gridCanvasCache[key];

        const config = this.varsConfig[varId] || { min: 0, max: 10, escala: this.escalaComuna };
        const escala = config.escala || this.escalaComuna;
        const nlat = this.nlat, nlon = this.nlon;
        const dades = varData.datos;
        if (!dades || dades.length !== nlat * nlon) return null;

        const c = document.createElement('canvas');
        c.width = nlon;
        c.height = nlat;
        const cctx = c.getContext('2d');
        const imgData = cctx.createImageData(nlon, nlat);
        const px = imgData.data;

        for (let i = 0; i < nlat; i++) {
            const filaCanvas = this.latAscending ? (nlat - 1 - i) : i;
            for (let j = 0; j < nlon; j++) {
                const colCanvas = this.lonAscending ? j : (nlon - 1 - j);
                const idx = i * nlon + j;
                const v = dades[idx];
                const p = (filaCanvas * nlon + colCanvas) * 4;
                if (v == null) { px[p + 3] = 0; continue; }
                const t = Math.max(0, Math.min(1, (v - config.min) / (config.max - config.min)));
                const [r, g, b] = this.interpolarColorEscala(escala, t);
                px[p] = r; px[p + 1] = g; px[p + 2] = b; px[p + 3] = 225;
            }
        }
        cctx.putImageData(imgData, 0, 0);
        this.gridCanvasCache[key] = c;
        return c;
    }

    calcularIndexs(lat, lon) {
        let fi = (lat - this.lats[0]) / this.stepLat;
        let fj = (lon - this.lons[0]) / this.stepLon;
        fi = Math.max(0, Math.min(this.nlat - 1.0001, fi));
        fj = Math.max(0, Math.min(this.nlon - 1.0001, fj));
        const i0 = Math.floor(fi), j0 = Math.floor(fj);
        const i1 = Math.min(i0 + 1, this.nlat - 1);
        const j1 = Math.min(j0 + 1, this.nlon - 1);
        return { i0, i1, j0, j1, fi: fi - i0, fj: fj - j0 };
    }

    interpolarValor(lat, lon, dades) {
        if (!dades || !this.dataBounds) return null;
        if (lat < this.dataBounds.south || lat > this.dataBounds.north ||
            lon < this.dataBounds.west || lon > this.dataBounds.east) return null;
        const { i0, i1, j0, j1, fi, fj } = this.calcularIndexs(lat, lon);
        const nlon = this.nlon;
        const v00 = dades[i0 * nlon + j0], v01 = dades[i0 * nlon + j1];
        const v10 = dades[i1 * nlon + j0], v11 = dades[i1 * nlon + j1];
        if (v00 == null || v01 == null || v10 == null || v11 == null) return null;
        const v0 = v00 + (v01 - v00) * fj;
        const v1 = v10 + (v11 - v10) * fj;
        return v0 + (v1 - v0) * fi;
    }

    valorProper(lat, lon, dades) {
        if (!dades) return null;
        const { i0, i1, j0, j1, fi, fj } = this.calcularIndexs(lat, lon);
        const i = fi < 0.5 ? i0 : i1;
        const j = fj < 0.5 ? j0 : j1;
        return dades[i * this.nlon + j];
    }

    hexARGB(hex) {
        const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [0, 0, 0];
    }

    actualitzarVisualitzacio() {
        this.renderitzar();
    }

    configurarClic() {
        this.mapa.on('click', (e) => this.gestionarClic(e));
        this.mapa.on('contextmenu', (e) => this.gestionarClicDret(e));
    }

    obtenirDescripcioPerValor(varId, valor) {
        if (valor == null) return null;
        
        switch(varId) {
            case 'swh':
                if (valor < 0.3) return 'Mar plana o arrissada. Ideal per banyar-se i navegar.';
                if (valor < 1.0) return 'Ones petites. Bany segur, navegació còmoda.';
                if (valor < 2.0) return 'Ones moderades. Precaució al banyar-se. Navegació acceptable.';
                if (valor < 3.0) return 'Ones grans. Perill moderat per banyar-se. Navegació incòmoda.';
                if (valor < 4.0) return 'Ones molt grans. Perill alt. No recomanat banyar-se ni navegar amb barques petites.';
                if (valor < 5.0) return 'Temporal marítim. Perill molt alt. Només per embarcacions grans.';
                return 'Temporal fort. Perill extrem. Navegació molt perillosa.';
                
            case 'shww':
                if (valor < 0.2) return 'Sense ones de vent. El mar està llis.';
                if (valor < 0.5) return 'Ones de vent molt petites. Mar un xic picat.';
                if (valor < 1.0) return 'Ones de vent petites. Mar picat però navegable.';
                if (valor < 2.0) return 'Ones de vent moderades. Mar molt picat, incòmode.';
                if (valor < 3.0) return 'Ones de vent fortes. Mar molt desordenat amb escuma. Perillós.';
                return 'Ones de vent molt fortes. Temporal de vent. Perill alt.';
                
            case 'shts':
                if (valor < 0.3) return 'Sense mar de fons. Només hi ha ones locals.';
                if (valor < 1.0) return 'Mar de fons petit. Ones llargues i suaus.';
                if (valor < 2.0) return 'Mar de fons moderat. Ones de lluny notables.';
                if (valor < 3.0) return 'Mar de fons important. Ones molt llargues i potents. Precaució.';
                if (valor < 4.0) return 'Mar de fons fort. Ones molt potents. Perill a les platges.';
                return 'Mar de fons molt fort. Onades trencant amb molta força. Perill extrem.';

            case 'si10': {
                const nusos = valor * 1.94384;
                if (nusos < 5) return 'Vent en calma (' + nusos.toFixed(0) + ' nusos).';
                if (nusos < 10) return 'Brisa suau (' + nusos.toFixed(0) + ' nusos).';
                if (nusos < 15) return 'Brisa moderada (' + nusos.toFixed(0) + ' nusos).';
                if (nusos < 20) return 'Vent fresc (' + nusos.toFixed(0) + ' nusos). Comença a aixecar ones locals.';
                if (nusos < 25) return 'Vent fort (' + nusos.toFixed(0) + ' nusos). Genera ones locals grosses.';
                if (nusos < 30) return 'Vent molt fort (' + nusos.toFixed(0) + ' nusos). Perill per barques petites.';
                if (nusos < 35) return 'Vendaval (' + nusos.toFixed(0) + ' nusos). Només per embarcacions grans.';
                if (nusos < 40) return 'Temporal fort de vent (' + nusos.toFixed(0) + ' nusos). Perill extrem.';
                return 'Temporal molt fort de vent (' + nusos.toFixed(0) + ' nusos). Navegació impossible.';
            }

            case 'pp1d':
                if (valor < 4) return 'Ones molt seguides (cada ' + valor.toFixed(0) + ' segons), típic de vent local.';
                if (valor < 6) return 'Ones seguides (cada ' + valor.toFixed(0) + ' segons), típic de mar de vent.';
                if (valor < 8) return 'Ones moderadament espaiades (cada ' + valor.toFixed(0) + ' segons), mar mixt.';
                if (valor < 10) return 'Ones espaiades (cada ' + valor.toFixed(0) + ' segons), indica mar de fons.';
                if (valor < 12) return 'Ones molt espaiades (cada ' + valor.toFixed(0) + ' segons), mar de fons notable.';
                if (valor < 14) return 'Ones molt llargues (cada ' + valor.toFixed(0) + ' segons), mar de fons potent.';
                return 'Ones extremadament llargues (cada ' + valor.toFixed(0) + ' segons).';
                
            case 'mwp':
                if (valor < 4) return 'Període curt (' + valor.toFixed(1) + ' s). Ones picades i desordenades.';
                if (valor < 6) return 'Període mitjà-baix (' + valor.toFixed(1) + ' s).';
                if (valor < 8) return 'Període mitjà (' + valor.toFixed(1) + ' s).';
                if (valor < 10) return 'Període alt (' + valor.toFixed(1) + ' s). Mar de fons present.';
                if (valor < 12) return 'Període molt alt (' + valor.toFixed(1) + ' s). Mar de fons dominant.';
                return 'Període extrem (' + valor.toFixed(1) + ' s). Grans onades de fons.';
                
            case 'mwd': {
                const dirNomMwd = this.bruixola(valor);
                const dirsOnes = {
                    'N': 'Ones venint del nord (Tramuntana).',
                    'NE': 'Ones venint del nord-est (Gregal).',
                    'E': 'Ones venint de l\'est (Llevant).',
                    'SE': 'Ones venint del sud-est (Xaloc).',
                    'S': 'Ones venint del sud (Migjorn).',
                    'SO': 'Ones venint del sud-oest.',
                    'O': 'Ones venint de l\'oest.',
                    'NO': 'Ones venint del nord-oest (Mestral).'
                };
                return (dirsOnes[dirNomMwd] || 'Ones venint de ' + dirNomMwd) + ' (' + valor.toFixed(0) + ' graus).';
            }

            case 'wdir10': {
                const dirNomWdir = this.bruixola(valor);
                const dirsVent = {
                    'N': 'Vent del nord (Tramuntana).',
                    'NE': 'Vent del nord-est (Gregal).',
                    'E': 'Vent de l\'est (Llevant).',
                    'SE': 'Vent del sud-est (Xaloc).',
                    'S': 'Vent del sud (Migjorn).',
                    'SO': 'Vent del sud-oest (Garbí/Llebeig).',
                    'O': 'Vent de l\'oest (Ponent).',
                    'NO': 'Vent del nord-oest (Mestral).'
                };
                return (dirsVent[dirNomWdir] || 'Vent de ' + dirNomWdir) + ' (' + valor.toFixed(0) + ' graus).';
            }

            default:
                return null;
        }
    }

    obtenirDescripcioCombinada(vars, lat, lon) {
        const swh = vars.swh ? this.interpolarValor(lat, lon, vars.swh.datos) : null;
        const shts = vars.shts ? this.interpolarValor(lat, lon, vars.shts.datos) : null;
        const shww = vars.shww ? this.interpolarValor(lat, lon, vars.shww.datos) : null;
        const ventMS = vars.si10 ? this.interpolarValor(lat, lon, vars.si10.datos) : null;
        const nusos = ventMS != null ? ventMS * 1.94384 : null;
        const periode = vars.pp1d ? this.interpolarValor(lat, lon, vars.pp1d.datos) : null;

        const frases = [];

        if (swh != null) {
            if (swh < 0.3) frases.push('Mar pràcticament plana');
            else if (swh < 1.0) frases.push('Mar amb ones petites');
            else if (swh < 2.0) frases.push('Mar moderat');
            else if (swh < 3.0) frases.push('Mar agitat, ones grans');
            else if (swh < 4.0) frases.push('Mar molt agitat, ones molt grans');
            else frases.push('Temporal marítim, perill alt');
        }

        const hiHaVentSignificatiu = nusos != null && nusos >= 12;
        const hiHaFonsSignificatiu = shts != null && shts >= 0.8;
        const periodeIndicaFons = periode != null && periode >= 8;

        if (hiHaFonsSignificatiu && !hiHaVentSignificatiu) {
            frases.push('degut principalment a mar de fons que arriba de lluny, tot i que el vent local és fluix (' +
                (nusos != null ? nusos.toFixed(0) + ' nusos' : 'sense dades de vent') + ')');
        } else if (hiHaFonsSignificatiu && hiHaVentSignificatiu) {
            frases.push('combinació de vent local (' + nusos.toFixed(0) + ' nusos) i mar de fons de lluny');
        } else if (hiHaVentSignificatiu && !hiHaFonsSignificatiu) {
            frases.push('generat principalment pel vent local (' + nusos.toFixed(0) + ' nusos)');
        } else if (nusos != null) {
            frases.push('amb vent fluix (' + nusos.toFixed(0) + ' nusos) i poc mar de fons');
        }

        if (periode != null) {
            if (periodeIndicaFons && !hiHaVentSignificatiu) {
                frases.push('ones espaiades cada ' + periode.toFixed(0) + ' s, típic de mar de fons sense vent local');
            } else if (periode < 5 && hiHaVentSignificatiu) {
                frases.push('ones seguides cada ' + periode.toFixed(0) + ' s, típic de mar de vent');
            } else {
                frases.push('període d\'ones al voltant de ' + periode.toFixed(0) + ' s');
            }
        }

        if (frases.length === 0) return null;

        const primera = frases[0];
        const resta = frases.slice(1).join(', ');
        return resta ? primera + ', ' + resta + '.' : primera + '.';
    }

    gestionarClic(e) {
        const { lat, lng } = e.latlng;
        if (!this.dadesActuals || !this.lats || !this.dataBounds) return;
        if (lat < this.dataBounds.south || lat > this.dataBounds.north ||
            lng < this.dataBounds.west || lng > this.dataBounds.east) return;

        const vars = this.dadesActuals.variables;
        const config = this.varsConfig[this.varActiva];
        const varData = vars[this.varActiva];
        if (!varData) return;

        let valor = this.interpolarValor(lat, lng, varData.datos);
        let valorMostrar = valor;
        
        if (this.varActiva === 'si10' && valor != null) {
            valorMostrar = valor * 1.94384;
        }

        const descripcioCombinada = this.obtenirDescripcioCombinada(vars, lat, lng);
        const descripcio = descripcioCombinada || this.obtenirDescripcioPerValor(this.varActiva, valor);

        let html = '<div class="value-popup">';
        html += '<div class="vp-title">' + config.nom + '</div>';
        html += '<div class="vp-value">' + (valorMostrar != null ? valorMostrar.toFixed(1) : '--') + ' <span class="vp-unit">' + config.unitat + '</span></div>';
        
        if (descripcio) {
            html += '<div class="vp-info">' + descripcio + '</div>';
        }

        const dirId = this.direccioPerVar[this.varActiva];
        if (dirId && vars[dirId]) {
            const dirVal = this.interpolarValor(lat, lng, vars[dirId].datos);
            if (dirVal != null) {
                const dirNom = this.bruixola(dirVal);
                html += '<div class="vp-extra">Direcció: ' + dirNom + ' (' + dirVal.toFixed(0) + ' graus)</div>';
            }
        }

        if (['swh', 'shww', 'shts'].includes(this.varActiva) && vars['pp1d']) {
            const perVal = this.interpolarValor(lat, lng, vars['pp1d'].datos);
            if (perVal != null) {
                html += '<div class="vp-extra">Període entre ones: ' + perVal.toFixed(1) + ' segons</div>';
            }
        }

        html += '<div class="vp-coords">Coordenades: ' + lat.toFixed(3) + ' N, ' + lng.toFixed(3) + ' E</div>';
        html += '</div>';

        if (this.popupClic) this.mapa.closePopup(this.popupClic);
        this.popupClic = L.popup({ closeButton: true, className: 'dark-popup', offset: [0, -4], maxWidth: 320 })
            .setLatLng(e.latlng)
            .setContent(html)
            .openOn(this.mapa);
    }

    bruixola(graus) {
        const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
        return dirs[Math.round(graus / 45) % 8];
    }

    toggleAnimacioParticules() {
        if (this.animantParticules) {
            this.aturarAnimacio();
        } else {
            this.iniciarAnimacio();
        }
        return this.animantParticules;
    }

    iniciarAnimacio() {
        if (!this.particleCanvas) return;
        this.animantParticules = true;
        this.inicialitzarParticules();
        this._loopParticules();
    }

    aturarAnimacio() {
        this.animantParticules = false;
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        if (this.particleCtx && this.particleCanvas) {
            this.particleCtx.clearRect(0, 0, this.particleCanvas.width, this.particleCanvas.height);
        }
    }

    inicialitzarParticules() {
        this.particles = [];
        for (let k = 0; k < this.numParticles; k++) {
            this.particles.push(this.novaParticula());
        }
    }

    novaParticula() {
        const b = this.dataBounds || this.bounds;
        return {
            lat: b.south + Math.random() * (b.north - b.south),
            lon: b.west + Math.random() * (b.east - b.west),
            vida: 25 + Math.random() * 25,   // rastre mes curt i uniforme -> estil Windy
            edat: Math.random() * 50         // desincronitza el naixement de particules
        };
    }

    _loopParticules() {
        if (!this.animantParticules) return;
        this.dibuixarParticules();
        this.animFrameId = requestAnimationFrame(() => this._loopParticules());
    }

    // Llindars per l'efecte de "cresta trencada" (whitecaps), sempre
    // en funcio de swh (l'altura real de l'ona), independentment de
    // quina variable s'estigui visualitzant al mapa de colors.
    static get SWH_INICI_TRENCAMENT() { return 1.5; } // m: comença a trencar
    static get SWH_TRENCAMENT_TOTAL()  { return 4.0; } // m: caos maxim

    // Retorna un valor 0-1 de magnitud normalitzada per a una variable
    // concreta en un punt (lat, lon), usant el seu propi min/max de
    // varsConfig. Retorna null si no hi ha dades en aquell punt.
    magnitudNormalitzada(varId, lat, lon, vars) {
        const varData = vars[varId];
        const cfg = this.varsConfig[varId];
        if (!varData || !cfg) return null;
        const v = this.valorProper(lat, lon, varData.datos);
        if (v == null) return null;
        return Math.max(0, Math.min(1, (v - cfg.min) / (cfg.max - cfg.min)));
    }

    // Calcula la velocitat normalitzada (0-1) que ha de portar la
    // particula en aquest punt, segons la capa activa: simple (usa
    // la propia variable o swh com a proxy) o combinada (mitjana
    // ponderada vent+onada, per a capes de nomes-direccio).
    velocitatNormalitzada(lat, lon, vars) {
        const regla = this.velocitatPerVar[this.varActiva] || { tipus: 'simple', vars: [this.varActiva] };

        if (regla.tipus === 'combinada') {
            let suma = 0, sumaPesos = 0;
            regla.vars.forEach((vId, idx) => {
                const t = this.magnitudNormalitzada(vId, lat, lon, vars);
                if (t != null) {
                    const pes = regla.pesos[idx];
                    suma += t * pes;
                    sumaPesos += pes;
                }
            });
            return sumaPesos > 0 ? suma / sumaPesos : null;
        }

        // simple: agafa la primera variable de la llista que tingui dades
        for (const vId of regla.vars) {
            const t = this.magnitudNormalitzada(vId, lat, lon, vars);
            if (t != null) return t;
        }
        return null;
    }

    dibuixarParticules() {
        if (!this.particleCtx || !this.particleCanvas || !this.dadesActuals) return;
        const vars = this.dadesActuals.variables;
        const dirId = this.direccioPerVar[this.varActiva];
        const dirData = dirId && vars[dirId] ? vars[dirId].datos : null;
        const config = this.varsConfig[this.varActiva];
        const pConfig = config && config.particula ? config.particula : { cos: '#ffffff', vora: '#000000' };

        // Dades d'altura d'ona (swh) sempre disponibles per calcular
        // el trencament, encara que la capa activa sigui una altra.
        const swhData = vars.swh ? vars.swh.datos : null;

        const ctx = this.particleCtx;

        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(0, 0, this.particleCanvas.width, this.particleCanvas.height);
        ctx.globalCompositeOperation = 'source-over';

        if (!dirData || !this.lats) return;

        const cosRGB = this.hexARGB(pConfig.cos);
        const SWH_INI = MapaOnades.SWH_INICI_TRENCAMENT;
        const SWH_MAX = MapaOnades.SWH_TRENCAMENT_TOTAL;

        for (const p of this.particles) {
            const dir = this.valorProper(p.lat, p.lon, dirData);
            if (dir == null) { Object.assign(p, this.novaParticula()); continue; }

            const punt = this.puntCanvas(p.lat, p.lon);

            // Velocitat SEMPRE basada en una magnitud fisica real
            // (vent, altura d'ona, o mitjana d'ambdos), MAI en un
            // valor de direccio (graus), encara que la capa activa
            // sigui una capa de direccio (mwd / wdir10).
            const tVel = this.velocitatNormalitzada(p.lat, p.lon, vars);
            const t = tVel != null ? Math.max(0.15, tVel) : 0.5;

            // Grau de "trencament" (0 = mar llisa, 1 = mar molt picada)
            // segons l'altura real de l'ona (swh) en aquest punt.
            const swhLocal = swhData ? this.valorProper(p.lat, p.lon, swhData) : 0;
            const trencament = swhLocal != null
                ? Math.max(0, Math.min(1, (swhLocal - SWH_INI) / (SWH_MAX - SWH_INI)))
                : 0;

            const velGraus = 0.0035 * t;
            const dirOnVa = (dir + 180) % 360;
            const rad = (dirOnVa * Math.PI) / 180;

            // Jitter: com mes trencament, mes es desvia la particula
            // del rumb net -> aspecte caotic/escumos en mar picada.
            const jitterMax = trencament * 1.1; // radians
            const jitter = trencament > 0 ? (Math.random() - 0.5) * jitterMax : 0;
            const radFinal = rad + jitter;

            // La velocitat tambe s'accelera lleugerament amb el trencament
            // (les crestes es mouen mes rapid i erraticament que el flux de fons)
            const velAmbTrencament = velGraus * (1 + trencament * 0.6);

            const dLat = Math.cos(radFinal) * velAmbTrencament;
            const dLon = Math.sin(radFinal) * velAmbTrencament / Math.max(0.2, Math.cos(p.lat * Math.PI / 180));
            const nouLat = p.lat + dLat;
            const nouLon = p.lon + dLon;
            const nouPunt = this.puntCanvas(nouLat, nouLon);

            const vidaFrac = p.edat / p.vida;
            const alpha = vidaFrac < 0.15
                ? vidaFrac / 0.15
                : Math.max(0, 1 - (vidaFrac - 0.15) / 0.85);

            if (punt.x >= 0 && punt.x <= this.particleCanvas.width &&
                punt.y >= 0 && punt.y <= this.particleCanvas.height) {

                if (trencament > 0.05) {
                    // --- Zona de mar picada: traç mes curt, mes gruixut
                    // i amb un puntet d'"escuma" per simular la cresta
                    // trencant, en lloc d'una linia neta de flux ---
                    const gruix = 1 + trencament * 1.8;
                    ctx.strokeStyle = 'rgba(' + cosRGB[0] + ',' + cosRGB[1] + ',' + cosRGB[2] + ',' + (0.9 * alpha) + ')';
                    ctx.lineWidth = gruix;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(punt.x, punt.y);
                    ctx.lineTo(nouPunt.x, nouPunt.y);
                    ctx.stroke();

                    // Punt d'escuma ocasional (whitecap): nomes en una
                    // fraccio de particules i proporcional al trencament,
                    // perque no sigui un soroll constant sino intermitent
                    if (Math.random() < trencament * 0.35) {
                        const radiEscuma = 0.6 + trencament * 1.4;
                        ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * alpha) + ')';
                        ctx.beginPath();
                        ctx.arc(nouPunt.x, nouPunt.y, radiEscuma, 0, Math.PI * 2);
                        ctx.fill();
                    }
                } else {
                    // --- Mar tranquil·la: traç fi de flux net, com abans ---
                    ctx.strokeStyle = 'rgba(' + cosRGB[0] + ',' + cosRGB[1] + ',' + cosRGB[2] + ',' + (0.85 * alpha) + ')';
                    ctx.lineWidth = 1;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(punt.x, punt.y);
                    ctx.lineTo(nouPunt.x, nouPunt.y);
                    ctx.stroke();
                }
            }

            p.lat = nouLat;
            p.lon = nouLon;
            p.edat++;
            const b = this.dataBounds || this.bounds;
            if (p.edat > p.vida || p.lat < b.south || p.lat > b.north || p.lon < b.west || p.lon > b.east) {
                Object.assign(p, this.novaParticula());
            }
        }
    }
}