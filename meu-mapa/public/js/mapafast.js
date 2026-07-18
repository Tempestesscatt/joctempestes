// mapafast.js - Visualitzador AROME0025 · Estil Meteociel
// Alta resolució · Popup al clicar · Barbes adaptatives al zoom

class AromeFastViewer {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './webdata_arome';
        this.containerId = options.containerId || 'map';
        this.controlsId = options.controlsId || 'controls';
        this.geojsonPath = options.geojsonPath || './dades/girona_comarques.geojson';
        
        // Estat intern
        this.horaActual = 1;
        this.variableActual = null;
        this.totalHores = 1;
        this.variables = [];
        this.dadesIndex = null;
        this.dadesHores = {};
        this.dataReferencia = null;
        this.dadesActuals = null;  // Per popup al clicar
        
        // Capes Leaflet
        this.mapa = null;
        this.capaRaster = null;
        this.capaVent = null;
        this.capaFronteres = null;
        this.popupClic = null;
        
        // Configuració
        this.config = {
            opacitatRaster: 0.85,
            ventVelocitatMinima: 0.5,
            mostrarVent: true,
            mostrarRaster: true,
            mostrarFronteres: true,
            reproduccioAutomatica: false,
            intervalReproduccio: 800,
            densitatVentBase: 35,  // px entre barbes a zoom 8
        };
        
        this.temporitzadorAuto = null;
        
        // NOMS DE VARIABLES EN CATALÀ
        this.nomsVariables = {
            't2m': 'Temperatura a 2m',
            'r2': 'Humitat relativa',
            'prmsl': 'Pressió nivell mar',
            'tp': 'Precipitació total',
            'max_i10fg': 'Ràfegues màximes',
            'efg10': 'Vent mitjà 10m',
            'nfg10': 'Nuvolositat',
            'ssrd': 'Radiació solar',
            'tgrp': 'Temperatura sòl',
            'tsnowp': 'Temperatura neu',
            'CAPE_INS': 'CAPE (Inestabilitat)',
            'si10': 'Velocitat vent',
            'wdir10': 'Direcció vent'
        };
        
        this.unitatsVariables = {
            't2m': '°C',
            'r2': '%',
            'prmsl': 'hPa',
            'tp': 'mm',
            'max_i10fg': 'm/s',
            'efg10': 'm/s',
            'nfg10': '%',
            'ssrd': 'W/m²',
            'tgrp': '°C',
            'tsnowp': '°C',
            'CAPE_INS': 'J/kg',
            'si10': 'm/s',
            'wdir10': '°'
        };
        
        this.inicialitzar();
    }
    
    async inicialitzar() {
        console.log('🌍 AROME0025 · Alta Resolució · Popup · Vent Adaptatiu');
        
        await this.carregarIndex();
        this.crearMapa();
        await this.carregarFronteres();
        this.crearControls();
        this.configurarPopupClic();
        this.configurarVentAdaptatiu();
        
        if (this.totalHores > 0 && this.variables.length > 0) {
            await this.carregarHora(1);
            this.variableActual = this.variables.find(v => 
                !['u10', 'v10', 'si10', 'wdir10'].includes(v)
            ) || this.variables[0];
            
            const selector = document.getElementById('varSelect');
            if (selector) selector.value = this.variableActual;
            
            this.renderitzarVariable(this.variableActual);
        }
        
        console.log('✅ Visor preparat!');
    }
    
    async carregarIndex() {
        try {
            const url = `${this.dataDir}/arome_index.json`;
            const resposta = await fetch(url);
            if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
            
            this.dadesIndex = await resposta.json();
            this.totalHores = this.dadesIndex.hours || 1;
            this.variables = (this.dadesIndex.variables || []).filter(v => 
                !['u10', 'v10', 'si10'].includes(v)
            );
            
            if (this.dadesIndex.generated) {
                this.dataReferencia = new Date(this.dadesIndex.generated);
            } else {
                this.dataReferencia = new Date();
            }
            
            console.log(`✓ ${this.totalHores}h · ${this.variables.length} variables`);
            
        } catch (error) {
            console.error('❌ Error índex:', error);
            this.variables = ['t2m', 'r2', 'prmsl', 'tp', 'CAPE_INS'];
            this.totalHores = 5;
            this.dataReferencia = new Date();
        }
    }
    
    obtenirHoraMadrid(dataBase, offsetHores) {
        const dataPrevisio = new Date(dataBase.getTime() + offsetHores * 3600 * 1000);
        return dataPrevisio;
    }
    
    formatarDataCompleta(data) {
        const diesSetmana = [
            'Diumenge', 'Dilluns', 'Dimarts', 'Dimecres',
            'Dijous', 'Divendres', 'Dissabte'
        ];
        const mesos = [
            'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny',
            'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre'
        ];
        
        const diaSetmana = diesSetmana[data.getDay()];
        const dia = data.getDate();
        const mes = mesos[data.getMonth()];
        const any = data.getFullYear();
        const hores = String(data.getHours()).padStart(2, '0');
        const minuts = String(data.getMinutes()).padStart(2, '0');
        
        return `${diaSetmana} ${dia} ${mes} ${any} - ${hores}:${minuts}`;
    }
    
    formatarHoraCurta(data) {
        const hores = String(data.getHours()).padStart(2, '0');
        const minuts = String(data.getMinutes()).padStart(2, '0');
        return `${hores}:${minuts}`;
    }
    
    obtenirDataPrevisio(offsetHores) {
        return this.obtenirHoraMadrid(this.dataReferencia, offsetHores);
    }
    
    crearMapa() {
        this.mapa = L.map(this.containerId, {
            zoomControl: true,
            preferCanvas: false,
            maxBounds: [[40.0, -0.5], [43.5, 4.5]],
            maxBoundsViscosity: 0.8,
            minZoom: 7,
            maxZoom: 14,
            zoomSnap: 0.5,       // Zoom més fi
            zoomDelta: 0.5       // Zoom més precís
        }).setView([41.7, 2.0], 8);
        
        // ===== MAPA BASE ICC =====
        L.tileLayer(
            'https://geoserveis.icgc.cat/servei/catalunya/mapa-topografic-gris/{z}/{x}/{y}.png',
            {
                attribution: '© <a href="https://www.icgc.cat/" target="_blank">ICGC</a>',
                maxZoom: 19,
                minZoom: 7,
                zIndex: 0,
                opacity: 1.0,
                tileSize: 512,      // Tiles més grans = més resolució
                zoomOffset: -1      // Compensar tileSize
            }
        ).addTo(this.mapa);
        
        L.tileLayer(
            'https://geoserveis.icgc.cat/servei/catalunya/mapa-topografic-gris/noms/{z}/{x}/{y}.png',
            {
                attribution: '',
                maxZoom: 19,
                minZoom: 7,
                zIndex: 2,
                opacity: 0.9,
                tileSize: 512,
                zoomOffset: -1
            }
        ).addTo(this.mapa);
        
        // Capes de dades
        this.capaRaster = L.layerGroup().addTo(this.mapa);
        this.capaVent = L.layerGroup().addTo(this.mapa);
        
        // Escala
        L.control.scale({
            metric: true,
            imperial: false,
            position: 'bottomleft',
            maxWidth: 200
        }).addTo(this.mapa);
    }
    
    async carregarFronteres() {
        try {
            const resposta = await fetch(this.geojsonPath);
            if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
            
            const dadesGeoJSON = await resposta.json();
            
            this.capaFronteres = L.geoJSON(dadesGeoJSON, {
                style: {
                    color: '#3a3a4a',
                    weight: 1.5,
                    opacity: 0.6,
                    fillColor: 'transparent',
                    fillOpacity: 0,
                },
                onEachFeature: (feature, layer) => {
                    if (feature.properties) {
                        const nom = feature.properties.NOM_COMAR || 
                                   feature.properties.nom_comar ||
                                   feature.properties.name || '';
                        if (nom) {
                            layer.bindTooltip(`🏘️ ${nom}`, {
                                permanent: false,
                                direction: 'center',
                                className: 'tooltip-comarca'
                            });
                        }
                    }
                }
            }).addTo(this.mapa);
            
            console.log(`✓ ${dadesGeoJSON.features?.length || 0} comarques`);
            
        } catch (error) {
            console.warn('⚠ Fronteres no disponibles');
        }
    }
    
    /**
     * Configurar popup al fer clic al mapa
     */
    configurarPopupClic() {
        this.popupClic = L.popup({
            maxWidth: 300,
            minWidth: 200,
            className: 'popup-meteociel'
        });
        
        this.mapa.on('click', (e) => {
            this.mostrarPopupClic(e.latlng);
        });
    }
    
    /**
     * Mostrar dades al punt clicat
     */
    mostrarPopupClic(latlng) {
        if (!this.dadesActuals) {
            this.popupClic
                .setLatLng(latlng)
                .setContent('<div style="padding:5px;">⏳ Carregant dades...</div>')
                .openOn(this.mapa);
            return;
        }
        
        const dadesHora = this.dadesHores[this.horaActual];
        if (!dadesHora || !dadesHora.variables) return;
        
        // Buscar el valor més proper al punt clicat
        const lat = latlng.lat;
        const lng = latlng.lng;
        
        let contingut = `<div style="padding:8px;font-size:13px;">`;
        contingut += `<strong style="color:#64b5f6;">📍 ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E</strong><br>`;
        contingut += `<small style="color:#888;">${this.formatarDataCompleta(this.obtenirDataPrevisio(this.horaActual))}</small><br><br>`;
        
        // Per cada variable, trobar valor més proper
        for (const [nomVar, dadesVar] of Object.entries(dadesHora.variables)) {
            if (!dadesVar.values || !dadesVar.metadata) continue;
            
            const valor = this.interpolarValor(lat, lng, dadesVar.values, dadesHora.extent);
            
            if (valor !== null) {
                const nom = this.nomsVariables[nomVar] || nomVar;
                const unitat = this.unitatsVariables[nomVar] || dadesVar.metadata.units || '';
                
                contingut += `
                    <div style="display:flex;justify-content:space-between;margin:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                        <span style="color:#aaa;">${nom}:</span>
                        <strong style="color:#fff;">${valor.toFixed(1)} ${unitat}</strong>
                    </div>
                `;
            }
        }
        
        // Vent
        if (dadesHora.wind && dadesHora.wind.length > 0) {
            const ventProxim = this.trobarVentProxim(lat, lng, dadesHora.wind);
            if (ventProxim) {
                const velKmh = ventProxim.speed * 3.6;
                const dirGraus = Math.round((Math.atan2(ventProxim.v, ventProxim.u) * 180 / Math.PI + 360) % 360);
                const direccio = this.grausADireccio(dirGraus);
                
                contingut += `
                    <div style="display:flex;justify-content:space-between;margin:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                        <span style="color:#ffd54f;">💨 Vent:</span>
                        <strong style="color:#ffd54f;">${ventProxim.speed.toFixed(1)} m/s · ${direccio}</strong>
                    </div>
                `;
            }
        }
        
        contingut += `</div>`;
        
        this.popupClic
            .setLatLng(latlng)
            .setContent(contingut)
            .openOn(this.mapa);
    }
    
    /**
     * Interpolar valor al punt clicat
     */
    interpolarValor(lat, lng, values, extent) {
        if (!values || !extent) return null;
        
        const [lonMin, lonMax, latMin, latMax] = extent;
        const files = values.length;
        const cols = values[0].length;
        
        // Convertir lat/lon a índexs
        const fx = ((lng - lonMin) / (lonMax - lonMin)) * (cols - 1);
        const fy = ((latMax - lat) / (latMax - latMin)) * (files - 1);
        
        if (fx < 0 || fx >= cols - 1 || fy < 0 || fy >= files - 1) return null;
        
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fx - x0, ty = fy - y0;
        const x1 = Math.min(x0 + 1, cols - 1);
        const y1 = Math.min(y0 + 1, files - 1);
        
        // Interpolació bilineal
        const v00 = values[y0][x0], v10 = values[y0][x1];
        const v01 = values[y1][x0], v11 = values[y1][x1];
        
        if (isNaN(v00) || isNaN(v10) || isNaN(v01) || isNaN(v11)) return null;
        
        return (1 - ty) * ((1 - tx) * v00 + tx * v10) + ty * ((1 - tx) * v01 + tx * v11);
    }
    
    /**
     * Trobar vector de vent més proper
     */
    trobarVentProxim(lat, lng, windData) {
        if (!windData || windData.length === 0) return null;
        
        let minDist = Infinity;
        let ventProxim = null;
        
        for (const vec of windData) {
            const dist = Math.hypot(vec.lat - lat, vec.lon - lng);
            if (dist < minDist) {
                minDist = dist;
                ventProxim = vec;
            }
        }
        
        // Només retornar si està prou a prop (0.1 graus ≈ 11 km)
        return minDist < 0.15 ? ventProxim : null;
    }
    
    /**
     * Convertir graus a direcció cardinal
     */
    grausADireccio(graus) {
        const direccions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                           'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(graus / 22.5) % 16;
        return direccions[index];
    }
    
    /**
     * Configurar actualització de barbes al canviar zoom
     */
    configurarVentAdaptatiu() {
        this.mapa.on('zoomend', () => {
            if (this.config.mostrarVent && this.dadesActuals) {
                this.dibuixarBarbesVent(this.dadesActuals);
            }
        });
    }
    
    /**
     * Calcular densitat de barbes segons zoom
     */
    obtenirDensitatVent() {
        const zoom = this.mapa.getZoom();
        // Més zoom = menys espai entre barbes (més densitat)
        const factor = Math.pow(2, 8 - zoom);  // 8 = zoom base
        return Math.max(15, Math.min(80, this.config.densitatVentBase * factor));
    }
    
    crearControls() {
        const div = document.getElementById(this.controlsId);
        if (!div) return;
        
        const opcionsVariables = this.variables.map(v => {
            const nom = this.nomsVariables[v] || v;
            return `<option value="${v}">${nom}</option>`;
        }).join('');
        
        const dataHora1 = this.obtenirDataPrevisio(1);
        const dataHoraTotal = this.obtenirDataPrevisio(this.totalHores);
        
        div.innerHTML = `
            <div class="panell-meteociel">
                <div class="capcalera-meteociel">
                    <div class="titol-meteociel">AROME 0.025°</div>
                    <div class="data-meteociel" id="dataPrevisio">
                        ${this.formatarDataCompleta(dataHora1)}
                    </div>
                    <div class="run-meteociel">
                        Run: ${this.formatarHoraCurta(this.dataReferencia)} · 
                        +1h a +${this.totalHores}h
                    </div>
                </div>
                
                <div class="grup-meteociel">
                    <label>Variable</label>
                    <select id="varSelect" class="selector-meteociel">
                        ${opcionsVariables}
                    </select>
                </div>
                
                <div class="grup-meteociel">
                    <div class="navegacio-temporal">
                        <button id="btnAnterior" class="boto-fletxa" title="← Hora anterior">◀</button>
                        <div class="info-hora">
                            <span class="hora-actual-meteociel" id="horaLabel">
                                ${this.formatarHoraCurta(dataHora1)}
                            </span>
                            <span class="hora-total-meteociel">/ +${this.totalHores}h</span>
                        </div>
                        <button id="btnSeguent" class="boto-fletxa" title="Hora següent →">▶</button>
                    </div>
                    <input type="range" id="horaSlider" 
                           min="1" max="${this.totalHores}" value="1" step="1"
                           class="slider-meteociel">
                    <div class="rang-hora-meteociel">
                        <span>+1h (${this.formatarHoraCurta(dataHora1)})</span>
                        <span>+${this.totalHores}h (${this.formatarHoraCurta(dataHoraTotal)})</span>
                    </div>
                </div>
                
                <div class="grup-botons-meteociel">
                    <button id="btnReproduir" class="boto-reproduir">▶ Reproduir</button>
                    <button id="btnActual" class="boto-actual">Ara</button>
                </div>
                
                <div class="grup-checkboxes-meteociel">
                    <label class="checkbox-meteociel">
                        <input type="checkbox" id="chkRaster" checked>
                        <span>Dades</span>
                    </label>
                    <label class="checkbox-meteociel">
                        <input type="checkbox" id="chkVent" checked>
                        <span>Vent</span>
                    </label>
                    <label class="checkbox-meteociel">
                        <input type="checkbox" id="chkFronteres" checked>
                        <span>Comarques</span>
                    </label>
                </div>
                
                <div class="info-meteociel">
                    <div id="infoVariable" class="txt-variable">Selecciona variable</div>
                    <div id="infoVent" class="txt-vent">—</div>
                </div>
                
                <div class="llegenda-meteociel">
                    <span>← → navegar</span>
                    <span>Espai play</span>
                    <span>Clic = dades</span>
                </div>
            </div>
        `;
        
        this.afegirEstilsMeteociel();
        this.configurarEvents();
    }
    
    afegirEstilsMeteociel() {
        if (document.getElementById('estils-meteociel')) return;
        
        const estils = document.createElement('style');
        estils.id = 'estils-meteociel';
        estils.textContent = `
            .panell-meteociel {
                background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
                color: #e0e0e0;
                padding: 18px;
                border-radius: 12px;
                font-family: 'Segoe UI', system-ui, sans-serif;
                min-width: 280px;
                max-width: 310px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.7);
                border: 1px solid rgba(100,150,255,0.15);
                backdrop-filter: blur(10px);
            }
            .capcalera-meteociel {
                text-align: center;
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            .titol-meteociel {
                font-size: 22px;
                font-weight: 700;
                color: #64b5f6;
                letter-spacing: 1px;
                margin-bottom: 4px;
            }
            .data-meteociel {
                font-size: 13px;
                color: #fff;
                font-weight: 500;
                margin-bottom: 2px;
            }
            .run-meteociel {
                font-size: 10px;
                color: #7f8c8d;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .grup-meteociel {
                margin-bottom: 14px;
            }
            .grup-meteociel label {
                display: block;
                font-size: 10px;
                color: #7f8c8d;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 5px;
                font-weight: 600;
            }
            .selector-meteociel {
                width: 100%;
                padding: 9px 12px;
                background: rgba(30,40,60,0.9);
                color: #fff;
                border: 1px solid rgba(100,150,255,0.2);
                border-radius: 6px;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .selector-meteociel:hover {
                border-color: #64b5f6;
                background: rgba(40,50,70,0.9);
            }
            .selector-meteociel:focus {
                outline: none;
                border-color: #64b5f6;
                box-shadow: 0 0 0 3px rgba(100,180,255,0.1);
            }
            .navegacio-temporal {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 15px;
                margin-bottom: 8px;
            }
            .boto-fletxa {
                background: rgba(100,150,255,0.1);
                color: #64b5f6;
                border: 1px solid rgba(100,150,255,0.2);
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .boto-fletxa:hover {
                background: rgba(100,150,255,0.2);
                border-color: #64b5f6;
                transform: scale(1.1);
            }
            .info-hora {
                text-align: center;
            }
            .hora-actual-meteociel {
                font-size: 24px;
                font-weight: 700;
                color: #fff;
                display: block;
                letter-spacing: 1px;
            }
            .hora-total-meteociel {
                font-size: 11px;
                color: #7f8c8d;
            }
            .slider-meteociel {
                width: 100%;
                height: 4px;
                accent-color: #64b5f6;
                cursor: pointer;
                margin: 8px 0;
            }
            .rang-hora-meteociel {
                display: flex;
                justify-content: space-between;
                font-size: 9px;
                color: #556;
            }
            .grup-botons-meteociel {
                display: flex;
                gap: 8px;
                margin-bottom: 14px;
            }
            .boto-reproduir {
                flex: 1;
                background: linear-gradient(135deg, #2196F3, #1565C0);
                color: #fff;
                border: none;
                padding: 9px 0;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
                letter-spacing: 0.5px;
                transition: all 0.2s;
            }
            .boto-reproduir:hover {
                background: linear-gradient(135deg, #42A5F5, #1976D2);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(33,150,243,0.3);
            }
            .boto-actual {
                padding: 9px 16px;
                background: rgba(255,255,255,0.05);
                color: #aaa;
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            }
            .boto-actual:hover {
                background: rgba(255,255,255,0.1);
                color: #fff;
            }
            .grup-checkboxes-meteociel {
                display: flex;
                gap: 12px;
                margin-bottom: 14px;
            }
            .checkbox-meteociel {
                display: flex;
                align-items: center;
                gap: 5px;
                cursor: pointer;
                font-size: 11px;
                color: #aaa;
                user-select: none;
            }
            .checkbox-meteociel input[type="checkbox"] {
                accent-color: #64b5f6;
                width: 14px;
                height: 14px;
                cursor: pointer;
            }
            .info-meteociel {
                background: rgba(33,150,243,0.05);
                padding: 10px 12px;
                border-radius: 6px;
                border-left: 2px solid #2196F3;
                margin-bottom: 10px;
            }
            .txt-variable {
                font-size: 12px;
                font-weight: 600;
                color: #64b5f6;
                margin-bottom: 4px;
            }
            .txt-vent {
                font-size: 11px;
                color: #ffd54f;
                line-height: 1.4;
            }
            .llegenda-meteociel {
                display: flex;
                gap: 10px;
                font-size: 9px;
                color: #445;
                justify-content: center;
            }
            .tooltip-comarca {
                background: rgba(20,20,40,0.9);
                border: 1px solid #64b5f6;
                color: #fff;
                font-size: 11px;
                padding: 4px 8px;
                border-radius: 4px;
            }
            .tooltip-vent {
                background: rgba(20,20,40,0.9);
                border: 1px solid #ffd54f;
                color: #fff;
                font-size: 11px;
                padding: 4px 8px;
                border-radius: 4px;
            }
            .icona-barba-vent {
                background: transparent !important;
                border: none !important;
            }
            
            /* Popup al clicar */
            .popup-meteociel .leaflet-popup-content-wrapper {
                background: rgba(20,22,35,0.95);
                color: #fff;
                border-radius: 10px;
                border: 1px solid rgba(100,150,255,0.2);
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            }
            .popup-meteociel .leaflet-popup-tip {
                background: rgba(20,22,35,0.95);
                border: 1px solid rgba(100,150,255,0.2);
            }
            .popup-meteociel .leaflet-popup-close-button {
                color: #64b5f6;
            }
        `;
        document.head.appendChild(estils);
    }
    
    configurarEvents() {
        document.getElementById('varSelect').onchange = (e) => {
            this.variableActual = e.target.value;
            this.renderitzarVariable(this.variableActual);
        };
        
        document.getElementById('horaSlider').oninput = async (e) => {
            const hora = parseInt(e.target.value);
            await this.actualitzarHora(hora);
        };
        
        document.getElementById('btnAnterior').onclick = () => this.canviarHora(-1);
        document.getElementById('btnSeguent').onclick = () => this.canviarHora(1);
        document.getElementById('btnReproduir').onclick = () => this.alternarReproduccio();
        document.getElementById('btnActual').onclick = async () => {
            await this.actualitzarHora(1);
        };
        
        document.getElementById('chkRaster').onchange = (e) => {
            this.config.mostrarRaster = e.target.checked;
            this.renderitzarVariable(this.variableActual);
        };
        
        document.getElementById('chkVent').onchange = (e) => {
            this.config.mostrarVent = e.target.checked;
            this.renderitzarVariable(this.variableActual);
        };
        
        document.getElementById('chkFronteres').onchange = (e) => {
            this.config.mostrarFronteres = e.target.checked;
            if (this.capaFronteres) {
                e.target.checked ? this.capaFronteres.addTo(this.mapa) : this.capaFronteres.remove();
            }
        };
        
        document.onkeydown = (e) => {
            switch(e.key) {
                case 'ArrowLeft': e.preventDefault(); this.canviarHora(-1); break;
                case 'ArrowRight': e.preventDefault(); this.canviarHora(1); break;
                case ' ': e.preventDefault(); this.alternarReproduccio(); break;
                case 'f': case 'F': e.preventDefault(); document.getElementById('chkFronteres').click(); break;
                case 'Home': e.preventDefault(); this.actualitzarHora(1); break;
            }
        };
    }
    
    async actualitzarHora(hora) {
        this.horaActual = hora;
        document.getElementById('horaSlider').value = hora;
        
        const dataPrevisio = this.obtenirDataPrevisio(hora);
        document.getElementById('horaLabel').textContent = this.formatarHoraCurta(dataPrevisio);
        document.getElementById('dataPrevisio').textContent = this.formatarDataCompleta(dataPrevisio);
        
        await this.carregarHora(hora);
        this.renderitzarVariable(this.variableActual);
    }
    
    async canviarHora(delta) {
        const novaHora = this.horaActual + delta;
        if (novaHora < 1 || novaHora > this.totalHores) return;
        await this.actualitzarHora(novaHora);
    }
    
    async carregarHora(hora) {
        if (this.dadesHores[hora]) {
            this.horaActual = hora;
            return;
        }
        
        const fitxer = `arome_h${String(hora).padStart(2, '0')}.js`;
        const url = `${this.dataDir}/${fitxer}`;
        
        return new Promise((resoldre, rebutjar) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => {
                const clau = `hour${String(hora).padStart(2, '0')}`;
                if (window.aromeData?.[clau]) {
                    this.dadesHores[hora] = window.aromeData[clau];
                    this.horaActual = hora;
                }
                resoldre();
            };
            script.onerror = () => rebutjar(new Error(`Error: ${fitxer}`));
            document.head.appendChild(script);
        });
    }
    
    renderitzarVariable(nomVariable) {
        const dadesHora = this.dadesHores[this.horaActual];
        if (!dadesHora) return;
        
        this.dadesActuals = dadesHora;  // Guardar per popup
        
        const dadesVariable = dadesHora.variables[nomVariable];
        if (!dadesVariable) return;
        
        this.capaRaster.clearLayers();
        
        if (this.config.mostrarRaster) {
            this.renderitzarRaster(dadesVariable, dadesHora.extent);
        }
        
        this.dibuixarBarbesVent(dadesHora);
        this.actualitzarInformacio(nomVariable, dadesVariable.metadata, dadesHora.wind);
    }
    
    renderitzarRaster(dadesVariable, extent) {
        const { values, metadata } = dadesVariable;
        if (!values?.length || !values[0]?.length) return;
        
        // Canvas d'alta resolució (2x per més qualitat)
        const escalaQualitat = 2;
        const canvas = document.createElement('canvas');
        canvas.width = values[0].length * escalaQualitat;
        canvas.height = values.length * escalaQualitat;
        canvas.style.width = values[0].length + 'px';
        canvas.style.height = values.length + 'px';
        
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        const imatge = ctx.createImageData(canvas.width, canvas.height);
        
        const minim = metadata.min;
        const maxim = metadata.max;
        const rang = maxim - minim || 1;
        
        for (let i = 0; i < values.length; i++) {
            for (let j = 0; j < values[0].length; j++) {
                const valor = values[i][j];
                
                for (let di = 0; di < escalaQualitat; di++) {
                    for (let dj = 0; dj < escalaQualitat; dj++) {
                        const pi = i * escalaQualitat + di;
                        const pj = j * escalaQualitat + dj;
                        const idx = (pi * canvas.width + pj) * 4;
                        
                        if (valor == null || isNaN(valor)) {
                            imatge.data[idx + 3] = 0;
                        } else {
                            const t = Math.max(0, Math.min(1, (valor - minim) / rang));
                            const [r, g, b] = this.colorViridis(t);
                            imatge.data[idx] = r;
                            imatge.data[idx + 1] = g;
                            imatge.data[idx + 2] = b;
                            imatge.data[idx + 3] = 210;
                        }
                    }
                }
            }
        }
        
        ctx.putImageData(imatge, 0, 0);
        
        const ex = extent || [0.1, 3.6, 40.4, 42.95];
        const limits = [[ex[2], ex[0]], [ex[3], ex[1]]];
        
        L.imageOverlay(canvas.toDataURL('image/png', 1.0), limits, {
            opacity: this.config.opacitatRaster,
            zIndex: 3,
            className: 'raster-alta-qualitat'
        }).addTo(this.capaRaster);
    }
    
    colorViridis(t) {
        const punts = [
            [68, 1, 84], [72, 35, 116], [64, 83, 134], [49, 129, 123],
            [53, 165, 85], [130, 193, 46], [213, 216, 30], [253, 231, 37]
        ];
        const escalat = t * (punts.length - 1);
        const idx = Math.min(punts.length - 2, Math.floor(escalat));
        const frac = escalat - idx;
        
        return [
            Math.round(punts[idx][0] + (punts[idx+1][0] - punts[idx][0]) * frac),
            Math.round(punts[idx][1] + (punts[idx+1][1] - punts[idx][1]) * frac),
            Math.round(punts[idx][2] + (punts[idx+1][2] - punts[idx][2]) * frac)
        ];
    }
    
    dibuixarBarbesVent(dadesHora) {
        this.capaVent.clearLayers();
        
        if (!this.config.mostrarVent) return;
        if (!dadesHora?.wind?.length) return;
        
        const extent = dadesHora.extent || [0.1, 3.6, 40.4, 42.95];
        const densitat = this.obtenirDensitatVent();
        const zoom = this.mapa.getZoom();
        
        // Filtrar vectors segons densitat adaptativa
        const vectorsFiltrats = this.filtrarPerDensitat(dadesHora.wind, densitat, extent);
        
        let barbesDibuixades = 0;
        
        for (const vector of vectorsFiltrats) {
            if (vector.speed < this.config.ventVelocitatMinima) continue;
            if (vector.lat < extent[2] || vector.lat > extent[3] || 
                vector.lon < extent[0] || vector.lon > extent[1]) continue;
            
            const velocitatKmh = vector.speed * 3.6;
            const mida = zoom > 10 ? 56 : (zoom > 9 ? 48 : 40);  // Mida adaptativa
            const icona = this.crearIconaBarbaVent(vector.u, vector.v, velocitatKmh, mida);
            
            const marcador = L.marker([vector.lat, vector.lon], {
                icon: icona,
                interactive: true,
                keyboard: false,
                zIndexOffset: 10
            });
            
            marcador.bindTooltip(
                `${velocitatKmh.toFixed(0)} km/h`, 
                {
                    permanent: false,
                    direction: 'top',
                    offset: [0, -mida/2],
                    className: 'tooltip-vent'
                }
            );
            
            this.capaVent.addLayer(marcador);
            barbesDibuixades++;
        }
        
        console.log(`💨 ${barbesDibuixades} barbes · zoom ${zoom} · densitat ${densitat.toFixed(0)}px`);
    }
    
    /**
     * Filtrar vectors de vent per densitat adaptativa
     */
    filtrarPerDensitat(vectors, densitat, extent) {
        if (vectors.length === 0) return [];
        
        // Crear una graella i agafar el vector més proper a cada cel·la
        const latRange = extent[3] - extent[2];
        const lonRange = extent[1] - extent[0];
        
        // Convertir densitat (píxels) a graus aproximadament
        const densitatGraus = densitat / 111000;  // 1° ≈ 111 km
        
        const filesGraella = Math.ceil(latRange / densitatGraus);
        const colsGraella = Math.ceil(lonRange / densitatGraus);
        
        const graella = {};
        const resultat = [];
        
        for (const vec of vectors) {
            const fila = Math.floor((vec.lat - extent[2]) / densitatGraus);
            const col = Math.floor((vec.lon - extent[0]) / densitatGraus);
            const clau = `${fila},${col}`;
            
            if (!graella[clau]) {
                graella[clau] = vec;
                resultat.push(vec);
            }
        }
        
        return resultat;
    }
    
    crearIconaBarbaVent(u, v, velocitatKmh, mida = 48) {
        const centre = mida / 2;
        const angle = Math.atan2(v, -u) * (180 / Math.PI);
        const escala = mida / 48;  // Escalar tot proporcionalment
        
        let contingutSVG = '';
        const colorVent = '#1a1a2e';
        const gruixLinia = 2.5 * escala;
        
        if (velocitatKmh < 2) {
            const radi = 9 * escala;
            contingutSVG = `
                <circle cx="0" cy="0" r="${radi}" fill="none" stroke="${colorVent}" stroke-width="${gruixLinia}"/>
                <circle cx="0" cy="0" r="${2.5 * escala}" fill="${colorVent}"/>
            `;
        } else {
            const longAsta = 18 * escala;
            const longPloma = 9 * escala;
            const espaiPlomes = 4.5 * escala;
            const anglePloma = 0.85;
            
            let valor = Math.round(velocitatKmh / 5) * 5;
            const banderoles = Math.floor(valor / 50);
            valor -= banderoles * 50;
            const plomesCompletes = Math.floor(valor / 10);
            valor -= plomesCompletes * 10;
            const mitjaPloma = valor >= 5 ? 1 : 0;
            
            let plomesSVG = '';
            let posicio = longAsta;
            const dx = Math.cos(anglePloma) * longPloma;
            const dy = Math.sin(anglePloma) * longPloma;
            
            for (let i = 0; i < banderoles; i++) {
                plomesSVG += `<polygon points="${posicio},0 ${posicio-dx},${dy} ${posicio-espaiPlomes*2.2},0" fill="${colorVent}" stroke="${colorVent}" stroke-width="1"/>`;
                posicio -= espaiPlomes * 2.3;
            }
            
            for (let i = 0; i < plomesCompletes; i++) {
                plomesSVG += `<line x1="${posicio}" y1="0" x2="${posicio-dx}" y2="${dy}" stroke="${colorVent}" stroke-width="${gruixLinia}" stroke-linecap="round"/>`;
                posicio -= espaiPlomes;
            }
            
            if (mitjaPloma) {
                plomesSVG += `<line x1="${posicio}" y1="0" x2="${posicio-dx*0.55}" y2="${dy*0.55}" stroke="${colorVent}" stroke-width="${gruixLinia}" stroke-linecap="round"/>`;
            }
            
            contingutSVG = `
                <line x1="0" y1="0" x2="${longAsta}" y2="0" stroke="${colorVent}" stroke-width="${gruixLinia}" stroke-linecap="round"/>
                ${plomesSVG}
            `;
        }
        
        const marge = mida / 2;
        const svgComplet = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${mida}" height="${mida}" viewBox="-${marge} -${marge} ${mida} ${mida}">
                <g transform="rotate(${angle})">
                    ${contingutSVG}
                </g>
            </svg>
        `;
        
        return L.divIcon({
            html: svgComplet,
            className: 'icona-barba-vent',
            iconSize: [mida, mida],
            iconAnchor: [centre, centre],
            popupAnchor: [0, -centre]
        });
    }
    
    actualitzarInformacio(nomVariable, metadades, dadesVent) {
        const infoVar = document.getElementById('infoVariable');
        const infoVent = document.getElementById('infoVent');
        
        if (infoVar && metadades) {
            const nom = this.nomsVariables[nomVariable] || metadades.long_name || nomVariable;
            const unitat = this.unitatsVariables[nomVariable] || metadades.units || '';
            
            infoVar.innerHTML = `
                ${nom}
                <span style="font-size:10px;color:#7f8c8d;display:block;margin-top:2px;">
                    ${metadades.min.toFixed(1)} → ${metadades.max.toFixed(1)} ${unitat}
                </span>
            `;
        }
        
        if (infoVent && dadesVent?.length) {
            const velocitats = dadesVent.map(v => v.speed).filter(v => v > 0);
            const mitjana = velocitats.length ? 
                (velocitats.reduce((a,b) => a+b, 0) / velocitats.length) : 0;
            const maxima = velocitats.length ? Math.max(...velocitats) : 0;
            
            infoVent.innerHTML = `
                💨 Vent: ${mitjana.toFixed(1)} m/s (${(mitjana*3.6).toFixed(0)} km/h) · 
                🌪️ Màx: ${maxima.toFixed(1)} m/s
            `;
        }
    }
    
    alternarReproduccio() {
        const boto = document.getElementById('btnReproduir');
        
        if (this.temporitzadorAuto) {
            clearInterval(this.temporitzadorAuto);
            this.temporitzadorAuto = null;
            boto.innerHTML = '▶ Reproduir';
            boto.style.background = 'linear-gradient(135deg, #2196F3, #1565C0)';
        } else {
            boto.innerHTML = '⏸ Aturar';
            boto.style.background = 'linear-gradient(135deg, #f44336, #c62828)';
            
            this.temporitzadorAuto = setInterval(async () => {
                const novaHora = this.horaActual >= this.totalHores ? 1 : this.horaActual + 1;
                await this.actualitzarHora(novaHora);
            }, this.config.intervalReproduccio);
        }
    }
}

// Inicialitzar
window.visorArome = null;
document.addEventListener('DOMContentLoaded', () => {
    window.visorArome = new AromeFastViewer({
        dataDir: './webdata_arome',
        containerId: 'map',
        controlsId: 'controls',
        geojsonPath: './dades/girona_comarques.geojson'
    });
});