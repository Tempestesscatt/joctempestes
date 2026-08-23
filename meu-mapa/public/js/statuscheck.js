// ═══════════════════════════════════════════════════════════════════════
//  statuscheck.js — Llegeix status.js (generat pel Python)
//  Mostra: estat + hora de generació
//  Versió: 2.0 - Amb protecció anti-caché total
// ═══════════════════════════════════════════════════════════════════════

(function() {
    'use strict';

    let intervalId = null;
    let lastDataHash = null;
    let carregantDades = false;

    function crearBadgeEstat() {
        if (document.getElementById('statusBadge')) return;

        const topnavRight = document.querySelector('.topnav-right');
        if (!topnavRight) return;

        const badge = document.createElement('div');
        badge.id = 'statusBadge';
        badge.className = 'status-badge';
        badge.innerHTML = `
            <span class="status-dot"></span>
            <span class="status-text">Comprovant...</span>
            <span class="status-hora"></span>
            <span class="status-refresh" title="Actualitzar ara">↻</span>
        `;

        const xatBtn = document.getElementById('btnXat');
        if (xatBtn) {
            topnavRight.insertBefore(badge, xatBtn);
        } else {
            topnavRight.appendChild(badge);
        }

        // Afegir event listener per actualització manual
        const refreshBtn = badge.querySelector('.status-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                comprovarEstat(true);
            });
        }
    }

    function tempsRelatiu(dataIso) {
        if (!dataIso) return 'desconegut';
        const ara = new Date();
        const data = new Date(dataIso + (dataIso.endsWith('Z') ? '' : 'Z'));
        const diffMin = Math.floor((ara - data) / 60000);

        if (diffMin < 0) return 'ara mateix';
        if (diffMin === 0) return 'fa un moment';
        if (diffMin === 1) return 'fa 1 minut';
        if (diffMin < 60) return 'fa ' + diffMin + ' minuts';
        const diffHores = Math.floor(diffMin / 60);
        if (diffHores === 1) return 'fa 1 hora';
        if (diffHores < 24) return 'fa ' + diffHores + ' hores';
        return 'fa ' + Math.floor(diffHores / 24) + ' dies';
    }

    function formatarDiaHora(dataIso) {
        if (!dataIso) return '';
        const data = new Date(dataIso + (dataIso.endsWith('Z') ? '' : 'Z'));
        const d = String(data.getDate()).padStart(2, '0');
        const m = String(data.getMonth() + 1).padStart(2, '0');
        const any = data.getFullYear();
        const h = String(data.getHours()).padStart(2, '0');
        const min = String(data.getMinutes()).padStart(2, '0');
        return d + '/' + m + '/' + any + ' ' + h + ':' + min + ' UTC';
    }

    function formatarHoraCurta(dataIso) {
        if (!dataIso) return '';
        const data = new Date(dataIso + (dataIso.endsWith('Z') ? '' : 'Z'));
        const h = String(data.getHours()).padStart(2, '0');
        const min = String(data.getMinutes()).padStart(2, '0');
        return h + ':' + min + 'h';
    }

    function calcularHash(data) {
        if (!data || !data.generat) return null;
        // Crear un hash simple basado en los datos
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convertir a 32bit integer
        }
        return Math.abs(hash);
    }

    function actualitzarBadge(data) {
        const badge = document.getElementById('statusBadge');
        const fhValidTime = document.getElementById('fh_validtime');

        if (!badge) return;

        const dot = badge.querySelector('.status-dot');
        const text = badge.querySelector('.status-text');
        const horaSpan = badge.querySelector('.status-hora');

        // Verificar si los datos cambiaron
        const nouHash = calcularHash(data);
        if (nouHash === lastDataHash) {
            // Los datos son los mismos, no actualizar
            return;
        }
        lastDataHash = nouHash;

        if (!data || !data.generat) {
            dot.className = 'status-dot status-error';
            text.textContent = 'Sense dades';
            if (horaSpan) horaSpan.textContent = '';
            badge.title = '';
            if (fhValidTime) fhValidTime.style.color = '';
            return;
        }

        const generat = data.generat;
        const faQuant = tempsRelatiu(generat);
        const diaHora = formatarDiaHora(generat);
        const horaCurta = formatarHoraCurta(generat);

        const ara = new Date();
        const dataGen = new Date(generat + (generat.endsWith('Z') ? '' : 'Z'));
        const diffHores = (ara - dataGen) / 3600000;

        // Mostrar l'hora de generació
        if (horaSpan) {
            horaSpan.textContent = ' ⏱ ' + horaCurta;
            horaSpan.style.cssText = 'font-size:10px;color:#667788;margin-left:4px;';
        }

        if (diffHores < 3) {
            // 🟢 Menys de 3 hores — Tot perfecte
            dot.className = 'status-dot status-ok';
            text.innerHTML = 'Tot perfecte · ' + faQuant;
            badge.title = 'Generat: ' + diaHora;

            if (fhValidTime) {
                fhValidTime.style.color = '';
                fhValidTime.title = '';
            }
        } else if (diffHores < 6) {
            // 🟡 Entre 3 i 6 hores — Tot bé
            dot.className = 'status-dot status-old';
            text.innerHTML = 'Tot bé · ' + faQuant;
            badge.title = 'Generat: ' + diaHora;

            if (fhValidTime) {
                fhValidTime.style.color = '#ffaa2b';
                fhValidTime.title = 'Actualitzat ' + faQuant;
            }
        } else {
            // 🔴 Més de 6 hores — Alguna cosa no va bé
            dot.className = 'status-dot status-error';
            text.innerHTML = '❌ Alguna cosa no va bé, aviat ho arreglarem';
            badge.title = 'Generat: ' + diaHora + ' — Estem treballant per resoldre-ho.';

            if (fhValidTime) {
                fhValidTime.style.color = '#ff5e5e';
                fhValidTime.title = 'Actualitzat ' + faQuant + ' · Alguna cosa no va bé';
            }
        }
    }

    function carregarStatusJS(forçarRecarrega) {
        return new Promise((resolve, reject) => {
            // Crear un timestamp únic per evitar caché
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(7);
            const parametresAntiCache = '?nocache=' + timestamp + '_' + random;
            
            // Intentar carregar amb fetch primer
            fetch('./js/status.js' + parametresAntiCache, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'If-Modified-Since': '0'
                },
                credentials: 'same-origin'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('HTTP error! status: ' + response.status);
                }
                return response.text();
            })
            .then(text => {
                // Limpiar variables anteriores
                window.STATUS_DATA = null;
                
                // Ejecutar el código para definir STATUS_DATA
                try {
                    // Usar Function en lugar de eval para mayor seguridad
                    const func = new Function(text + '\n;return window.STATUS_DATA;');
                    const data = func();
                    
                    if (data) {
                        window.STATUS_DATA = data;
                        resolve(data);
                    } else {
                        reject(new Error('No s\'ha trobat STATUS_DATA vàlid'));
                    }
                } catch (evalError) {
                    // Si falla, intentar con eval normal
                    try {
                        eval(text);
                        if (window.STATUS_DATA) {
                            resolve(window.STATUS_DATA);
                        } else {
                            reject(new Error('No s\'ha trobat STATUS_DATA'));
                        }
                    } catch (evalError2) {
                        reject(evalError2);
                    }
                }
            })
            .catch(reject);
        });
    }

    function carregarStatusViaScript(forçarRecarrega) {
        return new Promise((resolve, reject) => {
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(7);
            
            // Eliminar scripts antiguos
            const scriptsAntics = document.querySelectorAll('script[data-status-script="true"]');
            scriptsAntics.forEach(script => script.remove());
            
            // Crear nuevo script
            const script = document.createElement('script');
            script.src = './js/status.js?nocache=' + timestamp + '_' + random;
            script.setAttribute('data-status-script', 'true');
            script.async = true;
            
            script.onload = function() {
                if (window.STATUS_DATA) {
                    resolve(window.STATUS_DATA);
                } else {
                    reject(new Error('Script carregat però sense STATUS_DATA'));
                }
            };
            
            script.onerror = function() {
                reject(new Error('Error carregant script'));
            };
            
            document.head.appendChild(script);
            
            // Timeout de seguridad
            setTimeout(() => {
                reject(new Error('Timeout carregant script'));
            }, 10000);
        });
    }

    function comprovarEstat(forçarRecarrega) {
        // Evitar múltiples cargues simultànies
        if (carregantDades) return;
        carregantDades = true;
        
        const iniciarComprovacio = () => {
            try {
                // Primero intentar con fetch (más control)
                carregarStatusJS(forçarRecarrega)
                    .then(data => {
                        actualitzarBadge(data);
                        carregantDades = false;
                    })
                    .catch(err => {
                        console.warn('[Status] Error amb fetch, intentant amb script:', err.message);
                        // Si fetch falla, intentar con script tag
                        return carregarStatusViaScript(forçarRecarrega);
                    })
                    .then(data => {
                        if (data) {
                            actualitzarBadge(data);
                        }
                        carregantDades = false;
                    })
                    .catch(err => {
                        console.warn('[Status] Error carregant status.js:', err.message);
                        mostrarErrorBadge();
                        carregantDades = false;
                    });
            } catch (err) {
                console.warn('[Status] Error:', err.message);
                mostrarErrorBadge();
                carregantDades = false;
            }
        };
        
        // Pequeña pausa para permitir UI updates
        setTimeout(iniciarComprovacio, forçarRecarrega ? 0 : 100);
    }

    function mostrarErrorBadge() {
        const badge = document.getElementById('statusBadge');
        if (badge) {
            badge.querySelector('.status-dot').className = 'status-dot status-error';
            badge.querySelector('.status-text').textContent = 'Sense dades';
            const hora = badge.querySelector('.status-hora');
            if (hora) hora.textContent = '';
        }
    }

    function inicialitzar() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', iniciar);
        } else {
            iniciar();
        }
    }

    function iniciar() {
        crearBadgeEstat();
        comprovarEstat(true); // Forzar primera carga
        
        // Actualizar cada 5 minutos
        intervalId = setInterval(() => {
            comprovarEstat(true); // Siempre forzar recarga
        }, 5 * 60 * 1000);
        
        // También actualizar cuando la pestaña vuelve a ser visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                comprovarEstat(true);
            }
        });
    }

    window.addEventListener('beforeunload', () => {
        if (intervalId) clearInterval(intervalId);
    });

    // Exponer función de actualización manual globalmente
    window.actualitzarEstat = function() {
        comprovarEstat(true);
    };

    inicialitzar();
})();