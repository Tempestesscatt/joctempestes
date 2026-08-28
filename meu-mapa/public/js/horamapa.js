/**
 * ============================================================
 *  HORA MAPA - Gestió d'hores carregades/no carregades
 *  Mostra prefix "+" a les hores que no tenen dades
 *  ✅ SENSE CONFLICTES DE VARIABLES
 * ============================================================
 */

// ─── Variables globals amb seguretat ──────────────────────────────
// Comprovar si ja existeixen per evitar conflictes
if (typeof window._horaMapaInicialitzat === 'undefined') {
    window._horaMapaInicialitzat = false;
}

// Variables que NO xoquen amb mapa.js
let _horaMapaCargaEnProgreso = false;
let _horaMapaTotesLesHores = window.totesLesHores || [];
let _horaMapaCurIdx = window.curIdx || 0;
let _horaMapaVariableActiva = window._currentParameter || 'st';

// ─── Constants ──────────────────────────────────────────────────────
const HORA_MAPA_CLAUS_3D = new Set(['t','u','v','r','w','dpt','pv','wind_speed']);

// ─── Funció per obtenir la clau base ───────────────────────────────
function horaMapaClauBase(c) {
    if (window.PALETES && window.PALETES[c]) return c;
    if (window.ALIES_CLAUS && window.ALIES_CLAUS[c] && window.PALETES && window.PALETES[window.ALIES_CLAUS[c]]) return window.ALIES_CLAUS[c];
    const m = c.match(/^(.+)_(-?\d+)$/);
    return (m && window.PALETES && window.PALETES[m[1]]) ? m[1] : 'st';
}

// ─── Comprovar si una variable requereix 3D ────────────────────────
function horaMapaRequereix3D(clau) {
    const base = horaMapaClauBase(clau);
    return HORA_MAPA_CLAUS_3D.has(base) || 
           clau.includes('pv_') ||
           clau.includes('wind_speed_') ||
           ['u', 'v', 'w', 'dpt', 't', 'r', 'pv'].includes(base);
}

// ─── Comprovar si una hora té dades 3D ─────────────────────────────
function horaMapaTe3D(idx) {
    if (idx < 0 || idx >= _horaMapaTotesLesHores.length) return false;
    const item = _horaMapaTotesLesHores[idx];
    return item && item.data && item.data._te3d && item.data.coordenadas_3d;
}

// ════════════════════════════════════════════════════════════════════
//  FUNCIÓ PER ACTUALITZAR LA CAPÇALERA "Vàlid:"
// ════════════════════════════════════════════════════════════════════

function horaMapaActualitzarUI(idx) {
    const label = document.getElementById('current_time_label');
    if (!label) return;

    // Usar les dades globals
    _horaMapaTotesLesHores = window.totesLesHores || [];
    _horaMapaVariableActiva = window._currentParameter || 'st';

    const item = _horaMapaTotesLesHores[idx];
    if (!item || !item.dateObj) {
        label.textContent = '⏳ Sense dades';
        label.style.color = '#7f9bb3';
        return;
    }

    // Comprovar si REALMENT té dades carregades
    const teDataReal = !!item.data && 
                       !!item.data.variables && 
                       Object.keys(item.data.variables).length > 0;
    
    // Comprovar si té 3D (per a variables que ho requereixin)
    const requereix3DVar = horaMapaRequereix3D(_horaMapaVariableActiva);
    const teDadesCompletes = teDataReal && (!requereix3DVar || (requereix3DVar && item.data._te3d));
    const prefix = teDadesCompletes ? '' : '+';

    try {
        const madridTime = new Date(item.dateObj.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
        const horaStr = madridTime.toLocaleString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit', 
            day: '2-digit', 
            month: 'short' 
        });
        
        // Mostrar amb prefix "+" si NO està completament carregada
        if (!teDadesCompletes) {
            label.innerHTML = `<span style="color:#FFA500;font-weight:700;">${prefix}</span> ${horaStr}`;
            label.style.color = '#FFA500';
        } else {
            label.textContent = horaStr;
            label.style.color = '#cfe0ee';
        }
        
        // Tooltip amb informació extra
        if (!teDadesCompletes && requereix3DVar) {
            label.title = '⏳ Carregant dades 3D...';
        } else if (!teDadesCompletes) {
            label.title = '⏳ Dades pendents de carregar';
        } else {
            label.title = '';
        }
        
    } catch (e) {
        const step = item.step;
        const horaStep = Math.floor(step / 2);
        const minutosStep = (step % 2) * 30;
        const horaStr = String(horaStep).padStart(2, '0') + ':' + String(minutosStep).padStart(2, '0');
        
        if (!teDadesCompletes) {
            label.innerHTML = `<span style="color:#FFA500;font-weight:700;">+</span> ${horaStr}`;
            label.style.color = '#FFA500';
        } else {
            label.textContent = horaStr;
            label.style.color = '#cfe0ee';
        }
    }
}

// ════════════════════════════════════════════════════════════════════
//  FUNCIÓ PER RESALTAR L'HORA AL GRID
// ════════════════════════════════════════════════════════════════════

function horaMapaResaltarEnGrid(idx) {
    document.querySelectorAll('.fh-item').forEach((el, i) => {
        el.classList.toggle('active', i === idx);
        el.style.background = i === idx ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.03)';
        el.style.color = i === idx ? '#FFD700' : '#556680';
        el.style.border = i === idx ? '1px solid rgba(255,215,0,0.3)' : '1px solid transparent';
    });
    const target = document.querySelector(`.fh-item[data-idx="${idx}"]`);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
}

// ════════════════════════════════════════════════════════════════════
//  FUNCIÓ PER CONSTRUIR LA GRAELLA D'HORES AMB PREFIX "+"
// ════════════════════════════════════════════════════════════════════

function horaMapaConstruirGraella() {
    const grid = document.getElementById('fh_grid');
    if (!grid) {
        console.warn('[HoraMapa] Element fh_grid no trobat');
        return;
    }

    grid.innerHTML = '';

    _horaMapaTotesLesHores = window.totesLesHores || [];
    _horaMapaCurIdx = window.curIdx || 0;

    if (!_horaMapaTotesLesHores || _horaMapaTotesLesHores.length === 0) {
        grid.innerHTML = '<div style="color:#556680;padding:6px 12px;font-size:11px;text-align:center;width:100%;">Carregant dades...</div>';
        return;
    }

    const container = document.createElement('div');
    container.className = 'fh-grid-container';
    container.style.cssText = 'display:flex;gap:3px;align-items:center;padding:2px 4px;overflow-x:auto;';

    if (_horaMapaCurIdx >= _horaMapaTotesLesHores.length) {
        _horaMapaCurIdx = 0;
        window.curIdx = 0;
    }

    _horaMapaTotesLesHores.forEach((item, i) => {
        const teDataReal = !!item.dateObj && !!item.data && !!item.data.variables;
        
        let horaStr = '';
        let minStr = '';

        // DETECTAR si l'hora està REALMENT carregada (té dades)
        const estaCarregada = teDataReal && Object.keys(item.data.variables).length > 0;

        if (teDataReal) {
            try {
                const madridTime = new Date(item.dateObj.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
                const horas = String(madridTime.getHours()).padStart(2, '0');
                const minutos = String(madridTime.getMinutes()).padStart(2, '0');
                
                // Si NO està carregada, afegir "+" al davant
                horaStr = (estaCarregada ? '' : '+') + horas + 'h';
                minStr = minutos;
            } catch (e) {
                const step = item.step;
                const horaStep = Math.floor(step / 2);
                const minutosStep = (step % 2) * 30;
                horaStr = (estaCarregada ? '' : '+') + String(horaStep).padStart(2, '0') + 'h';
                minStr = String(minutosStep).padStart(2, '0');
            }
        } else {
            const step = item.step;
            const horaStep = Math.floor(step / 2);
            const minutosStep = (step % 2) * 30;
            // Sense dades → sempre "+"
            horaStr = '+' + String(horaStep).padStart(2, '0') + 'h';
            minStr = String(minutosStep).padStart(2, '0');
        }

        const isActive = (i === _horaMapaCurIdx);
        const horaLliure = (i % 3 === 0);
        const userAra = window._firebaseUser || null;
        const itemBloquejatVisual = !userAra && !horaLliure;

        const cell = document.createElement('div');
        cell.className = 'fh-item' + (isActive ? ' active' : '');
        cell.dataset.idx = i;

        cell.style.cssText = `
            flex: 0 0 auto;
            padding: 2px 8px;
            border-radius: 3px;
            cursor: ${itemBloquejatVisual ? 'not-allowed' : 'pointer'};
            font-size: 11px;
            font-weight: 500;
            color: ${isActive ? '#FFD700' : '#556680'};
            background: ${isActive ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.03)'};
            border: ${isActive ? '1px solid rgba(255,215,0,0.3)' : '1px solid transparent'};
            transition: all 0.15s ease;
            text-align: center;
            min-width: 32px;
            position: relative;
            user-select: none;
            font-family: 'Segoe UI', Tahoma, sans-serif;
            line-height: 1.2;
            opacity: ${itemBloquejatVisual ? '0.3' : (teDataReal ? '1' : '0.55')};
        `;

        // Si NO està carregada, posar el "+" en color diferent
        const prefixStyle = estaCarregada ? '' : 'color:#FFA500;';

        if (itemBloquejatVisual) {
            cell.title = 'Inicia sessió per desbloquejar';
            cell.innerHTML = `
                <span style="font-size:12px;font-weight:600;display:block;${prefixStyle}">${horaStr}</span>
                <span style="font-size:7px;color:#3a4a5a;display:block;margin-top:-1px;">${minStr}</span>
                <span style="position:absolute;top:-2px;right:-1px;font-size:7px;color:#FF6B35;"><i class="fas fa-lock"></i></span>
            `;
        } else {
            cell.innerHTML = `
                <span style="font-size:12px;font-weight:600;display:block;${prefixStyle}">${horaStr}</span>
                <span style="font-size:7px;color:#3a4a5a;display:block;margin-top:-1px;">${minStr}</span>
            `;
        }

        cell.addEventListener('click', function(e) {
            e.stopPropagation();
            const idx = parseInt(this.dataset.idx);
            if (isNaN(idx)) return;
            
            const lliure = (idx % 3 === 0);
            const userActual = window._firebaseUser || null;

            if (!userActual && !lliure) {
                if (typeof window.loginWithGoogle === 'function') {
                    window.loginWithGoogle();
                }
                return;
            }
            
            // Intentar cridar mostrarHora de diferents maneres
            if (typeof window.mostrarHora === 'function') {
                window.mostrarHora(idx);
            } else if (typeof window._mostrarHoraOriginal === 'function') {
                window._mostrarHoraOriginal(idx);
            } else {
                console.warn('[HoraMapa] No s\'ha trobat la funció mostrarHora');
                // Fallback: canviar curIdx manualment
                window.curIdx = idx;
                if (typeof window.resaltarHoraEnGrid === 'function') {
                    window.resaltarHoraEnGrid(idx);
                }
            }
        });

        cell.addEventListener('mouseenter', function() {
            if (!this.classList.contains('active')) {
                this.style.background = 'rgba(255,255,255,0.08)';
                this.style.color = '#c8d8e8';
            }
        });

        cell.addEventListener('mouseleave', function() {
            if (!this.classList.contains('active')) {
                this.style.background = 'rgba(255,255,255,0.03)';
                this.style.color = '#556680';
            }
        });

        container.appendChild(cell);
    });

    grid.appendChild(container);

    setTimeout(() => {
        const active = grid.querySelector('.fh-item.active');
        if (active) {
            active.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }, 100);
}

// ════════════════════════════════════════════════════════════════════
//  FUNCIÓ PER ACTUALITZAR LES DADES GLOBALS
// ════════════════════════════════════════════════════════════════════

function horaMapaActualitzarDades() {
    _horaMapaTotesLesHores = window.totesLesHores || [];
    _horaMapaCurIdx = window.curIdx || 0;
    _horaMapaVariableActiva = window._currentParameter || 'st';
}

// ════════════════════════════════════════════════════════════════════
//  INICIALITZACIÓ
// ════════════════════════════════════════════════════════════════════

function horaMapaInit() {
    // Evitar doble inicialització
    if (window._horaMapaInicialitzat) {
        console.log('🕐 HoraMapa ja inicialitzat, saltant...');
        return;
    }
    
    console.log('🕐 Inicialitzant HoraMapa...');
    window._horaMapaInicialitzat = true;
    
    // Actualitzar dades inicials
    horaMapaActualitzarDades();
    
    // Reconstruir graella si existeix
    if (document.getElementById('fh_grid')) {
        horaMapaConstruirGraella();
    }
    
    // Actualitzar UI si existeix el label
    if (document.getElementById('current_time_label') && _horaMapaCurIdx < _horaMapaTotesLesHores.length) {
        horaMapaActualitzarUI(_horaMapaCurIdx);
    }
    
    // Escoltar canvis a les dades globals
    let oldHores = window.totesLesHores;
    let oldIdx = window.curIdx;
    
    // Comprovar canvis periòdicament
    setInterval(() => {
        if (window.totesLesHores !== oldHores || window.curIdx !== oldIdx) {
            oldHores = window.totesLesHores;
            oldIdx = window.curIdx;
            horaMapaActualitzarDades();
            if (document.getElementById('fh_grid')) {
                horaMapaConstruirGraella();
            }
            if (document.getElementById('current_time_label') && _horaMapaCurIdx < _horaMapaTotesLesHores.length) {
                horaMapaActualitzarUI(_horaMapaCurIdx);
            }
        }
    }, 500);
    
    console.log('✅ HoraMapa inicialitzat correctament');
}

// ─── Exposar funcions globalment (amb prefix per evitar conflictes) ──
window.horaMapaActualitzarUI = horaMapaActualitzarUI;
window.horaMapaResaltarEnGrid = horaMapaResaltarEnGrid;
window.horaMapaConstruirGraella = horaMapaConstruirGraella;
window.horaMapaActualitzarDades = horaMapaActualitzarDades;
window.horaMapaInit = horaMapaInit;
window.horaMapaTe3D = horaMapaTe3D;
window.horaMapaRequereix3D = horaMapaRequereix3D;

// ════════════════════════════════════════════════════════════════════
//  OVERRIDE DE LES FUNCIONS ORIGINALS (si cal)
// ════════════════════════════════════════════════════════════════════

// Si les funcions originals no existeixen, les creem
if (typeof window.construirGraellaHores === 'undefined') {
    window.construirGraellaHores = horaMapaConstruirGraella;
}

if (typeof window.actualitzarUIHora === 'undefined') {
    window.actualitzarUIHora = horaMapaActualitzarUI;
}

if (typeof window.resaltarHoraEnGrid === 'undefined') {
    window.resaltarHoraEnGrid = horaMapaResaltarEnGrid;
}

// ─── Auto-inicialitzar ──────────────────────────────────────────────
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // Esperar una mica per assegurar que mapa.js s'ha carregat
    setTimeout(horaMapaInit, 100);
} else {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(horaMapaInit, 100);
    });
}

console.log('✅ HoraMapa carregat correctament (sense conflictes)');