// ═══════════════════════════════════════════════════════════════════════
//  memory-manager.js — Gestor de memòria per evitar Out of Memory
//  Carrega en ordre: primer les dades essencials, després la resta
//  Allibera memòria de les hores no visibles
// ═══════════════════════════════════════════════════════════════════════

(function(global) {
    'use strict';

    const MemoryManager = {
        // Configuració
        MAX_HORES_EN_MEMORIA: 3,      // Només mantenir 3 hores en memòria
        MAX_FITXERS_SIMULTANIS: 8,    // Carregar 8 fitxers alhora (no tots de cop)
        HORES_BUFFER: 1,              // Hores de marge a cada costat
        
        // Estat intern
        _cache: {},                   // { '06': { variables, coordenadas } }
        _horesCarregades: [],         // ['05', '06', '07']
        _carregant: new Set(),        // Hores que s'estan carregant ara
        _observers: [],               // Callbacks quan una hora es carrega
        
        /**
         * Inicialitza el gestor de memòria.
         * Crida-ho un cop al principi.
         */
        init: function(dadesPath) {
            this.DADES_PATH = dadesPath || 'web_data_arome';
            console.log('[Mem] Gestor de memòria inicialitzat. Màx ' + this.MAX_HORES_EN_MEMORIA + ' hores en memòria');
            return this;
        },
        
        /**
         * Carrega una hora concreta (si no està ja en memòria).
         * @param {number} hora - Índex de l'hora (ex: 6)
         * @returns {Promise} - Resol amb les dades de l'hora
         */
        carregarHora: async function(hora) {
            const horaStr = String(hora).padStart(2, '0');
            
            // Si ja està en cache, retornar immediatament
            if (this._cache[horaStr]) {
                console.log('[Mem] Hora ' + horaStr + ' ja en cache');
                return this._cache[horaStr];
            }
            
            // Si s'està carregant, esperar
            if (this._carregant.has(horaStr)) {
                console.log('[Mem] Hora ' + horaStr + ' ja s\'està carregant, esperant...');
                return new Promise((resolve) => {
                    const check = setInterval(() => {
                        if (this._cache[horaStr]) {
                            clearInterval(check);
                            resolve(this._cache[horaStr]);
                        }
                    }, 200);
                });
            }
            
            // Marcar com a "carregant"
            this._carregant.add(horaStr);
            console.log('[Mem] Carregant hora ' + horaStr + '...');
            
            try {
                const base = `${this.DADES_PATH}/${horaStr}/`;
                
                // 1. Llegir status.json
                const statusRes = await fetch(`${base}status.json`);
                if (!statusRes.ok) throw new Error('status.json no trobat');
                const status = await statusRes.json();
                
                const fitxers = status.variables_disponibles;
                if (!fitxers || fitxers.length === 0) throw new Error('Cap variable disponible');
                
                // 2. Carregar fitxers en lots (no tots de cop!)
                const resultats = [];
                for (let i = 0; i < fitxers.length; i += this.MAX_FITXERS_SIMULTANIS) {
                    const lot = fitxers.slice(i, i + this.MAX_FITXERS_SIMULTANIS);
                    const promesesLot = lot.map(f => 
                        fetch(`${base}${f}.js`)
                            .then(r => r.ok ? r.json() : null)
                            .catch(() => null)
                    );
                    const resLot = await Promise.all(promesesLot);
                    resultats.push(...resLot);
                    
                    // Petita pausa per no saturar el navegador
                    await new Promise(r => setTimeout(r, 50));
                }
                
                // 3. Reconstruir variables
                const variables = {};
                let coordenadas = null;
                
                for (const data of resultats) {
                    if (!data || !data.variables) continue;
                    if (!coordenadas && data.coordenadas) {
                        coordenadas = data.coordenadas;
                    }
                    Object.assign(variables, data.variables);
                }
                
                // 4. Guardar en cache
                const horaData = {
                    step: status.step,
                    hora_utc: status.hora_utc,
                    variables: variables,
                    coordenadas: coordenadas,
                    dateObj: new Date(status.hora_utc + 'Z')
                };
                
                this._cache[horaStr] = horaData;
                this._horesCarregades.push(horaStr);
                
                // 5. Alliberar memòria d'hores antigues
                this._netejarCache();
                
                console.log('[Mem] Hora ' + horaStr + ' carregada (' + Object.keys(variables).length + ' vars, ' + this._horesCarregades.length + ' hores en memòria)');
                
                return horaData;
                
            } catch (e) {
                console.error('[Mem] Error carregant hora ' + horaStr + ':', e);
                return null;
            } finally {
                this._carregant.delete(horaStr);
            }
        },
        
        /**
         * Obté les dades d'una hora (de la cache si hi és, o les carrega).
         */
        obtenirHora: async function(hora) {
            const horaStr = String(hora).padStart(2, '0');
            if (this._cache[horaStr]) {
                return this._cache[horaStr];
            }
            return await this.carregarHora(hora);
        },
        
        /**
         * Precarrega les hores del voltant per a navegació fluida.
         */
        precarregarEntorn: async function(horaActual) {
            const horesAPrecarregar = [];
            for (let i = -this.HORES_BUFFER; i <= this.HORES_BUFFER; i++) {
                if (i === 0) continue;
                const h = horaActual + i;
                if (h >= 0 && h < 52) {
                    horesAPrecarregar.push(h);
                }
            }
            
            console.log('[Mem] Precarregant hores properes:', horesAPrecarregar);
            
            // Carregar en segon pla (no bloquejar)
            for (const h of horesAPrecarregar) {
                const horaStr = String(h).padStart(2, '0');
                if (!this._cache[horaStr] && !this._carregant.has(horaStr)) {
                    this.carregarHora(h).catch(() => {});
                }
            }
        },
        
        /**
         * Allibera memòria de les hores més antigues.
         */
        _netejarCache: function() {
            while (this._horesCarregades.length > this.MAX_HORES_EN_MEMORIA) {
                const horaAntiga = this._horesCarregades.shift();
                if (horaAntiga && this._cache[horaAntiga]) {
                    delete this._cache[horaAntiga];
                    console.log('[Mem] Alliberada hora ' + horaAntiga + ' (cache: ' + this._horesCarregades.length + ' hores)');
                }
            }
        },
        
        /**
         * Força l'alliberament de TOTA la memòria.
         */
        netejarTot: function() {
            this._cache = {};
            this._horesCarregades = [];
            this._carregant.clear();
            console.log('[Mem] Memòria netejada completament');
        },
        
        /**
         * Retorna estadístiques d'ús de memòria.
         */
        estadistiques: function() {
            let totalVars = 0;
            let totalPunts = 0;
            for (const horaStr of this._horesCarregades) {
                const data = this._cache[horaStr];
                if (data && data.variables) {
                    totalVars += Object.keys(data.variables).length;
                    if (data.coordenadas) {
                        totalPunts += data.coordenadas.lat.length * data.coordenadas.lon.length;
                    }
                }
            }
            return {
                horesEnCache: this._horesCarregades.length,
                carregant: this._carregant.size,
                totalVariables: totalVars,
                totalPunts: totalPunts,
                memoriaEstimada: (totalPunts * totalVars * 8 / 1024 / 1024).toFixed(1) + ' MB'
            };
        }
    };
    
    // Exportar
    global.MemoryManager = MemoryManager;
    
})(window);