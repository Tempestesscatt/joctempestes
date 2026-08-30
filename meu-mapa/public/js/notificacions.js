// ═══════════════════════════════════════════════════════════════════════
//  NOTIFICACIONS.JS — Versió Definitiva (CORREGIDA)
//  SEMPRE comprova notificacions noves, fins i tot amb el panell obert
//
//  FIX aplicat: el filtre "notificacioRecent" que hi havia dins de
//  comprovarMissatgesXat() (a l'HTML principal) bloquejava notificacions
//  noves de qualsevol usuari que ja tingués una notificació (llegida o
//  no) dels últims 2 minuts. Com que "marcar com llegida" no elimina la
//  notificació de l'array, aquest bloqueig es podia perpetuar en xats
//  actius, i només "Eliminar totes" el desbloquejava. Ara el control de
//  duplicats es fa NOMÉS per msgId (missatgesVistos), que és l'únic
//  control que cal i que no depèn de l'estat llegit/no llegit.
// ═══════════════════════════════════════════════════════════════════════

const NOTIFICACIONS = {
    versio: '2.4.1',
    checkInterval: 10000, // 🔥 10 segons per comprovar més ràpid
    maxNotifications: 50,
    storageKey: 'meteo_notificacions'
};

const TIPUS_NOTIFICACIO = {
    ALERTA: 'alerta',
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning'
};

// ─── CONFIGURACIÓ D'ICONES PROFESSIONALS ────────────────────────────

const ICONES_PROFESSIONALS = {
    [TIPUS_NOTIFICACIO.ALERTA]: {
        icon: 'fa-exclamation-triangle',
        color: '#FF1744',
        bg: 'rgba(255, 23, 68, 0.12)',
        border: 'rgba(255, 23, 68, 0.3)'
    },
    [TIPUS_NOTIFICACIO.WARNING]: {
        icon: 'fa-bolt',
        color: '#FF9100',
        bg: 'rgba(255, 145, 0, 0.12)',
        border: 'rgba(255, 145, 0, 0.3)'
    },
    [TIPUS_NOTIFICACIO.SUCCESS]: {
        icon: 'fa-check-circle',
        color: '#00E676',
        bg: 'rgba(0, 230, 118, 0.12)',
        border: 'rgba(0, 230, 118, 0.3)'
    },
    [TIPUS_NOTIFICACIO.INFO]: {
        icon: 'fa-info-circle',
        color: '#2979FF',
        bg: 'rgba(41, 121, 255, 0.12)',
        border: 'rgba(41, 121, 255, 0.3)'
    }
};

// ─── GESTIÓ D'ESTAT ──────────────────────────────────────────────────

function obtenirNotificacions() {
    try {
        const data = localStorage.getItem(NOTIFICACIONS.storageKey);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function guardarNotificacions(notificacions) {
    try {
        if (notificacions.length > NOTIFICACIONS.maxNotifications) {
            notificacions = notificacions.slice(-NOTIFICACIONS.maxNotifications);
        }
        localStorage.setItem(NOTIFICACIONS.storageKey, JSON.stringify(notificacions));
    } catch (e) {}
}

function marcarComLlegida(id) {
    const notificacions = obtenirNotificacions();
    const index = notificacions.findIndex(n => n.id === id);
    if (index !== -1) {
        notificacions[index].llegida = true;
        guardarNotificacions(notificacions);
        actualitzarComptador();
        if (document.getElementById('notificacionsPanel')?.style.display === 'block') {
            renderitzarNotificacions();
        }
        return true;
    }
    return false;
}

function marcarTotesLlegides() {
    const notificacions = obtenirNotificacions();
    notificacions.forEach(n => n.llegida = true);
    guardarNotificacions(notificacions);
    actualitzarComptador();
    if (document.getElementById('notificacionsPanel')?.style.display === 'block') {
        renderitzarNotificacions();
    }
}

function eliminarNotificacio(id) {
    let notificacions = obtenirNotificacions();
    notificacions = notificacions.filter(n => n.id !== id);
    guardarNotificacions(notificacions);
    actualitzarComptador();
    if (document.getElementById('notificacionsPanel')?.style.display === 'block') {
        renderitzarNotificacions();
    }
}

function eliminarTotesNotificacions() {
    guardarNotificacions([]);
    actualitzarComptador();
    if (document.getElementById('notificacionsPanel')?.style.display === 'block') {
        renderitzarNotificacions();
    }
}

// ─── COMPTADOR ──────────────────────────────────────────────────────

function actualitzarComptador() {
    const notificacions = obtenirNotificacions();
    const noLlegides = notificacions.filter(n => !n.llegida).length;
    
    const badge = document.getElementById('notificacionsBadge');
    if (badge) {
        if (noLlegides > 0) {
            badge.style.display = 'flex';
            badge.textContent = noLlegides > 99 ? '99+' : noLlegides;
        } else {
            badge.style.display = 'none';
        }
    }
    
    // 🔥 SEMPRE animar (independentment de l'estat del panell)
    animarBotoNotificacions();
    
    if (noLlegides > 0) {
        document.title = `(${noLlegides}) ⚡ Tempestes.cat`;
    } else {
        document.title = '⚡ Tempestes.cat';
    }
}

// ─── CREAR NOTIFICACIÓ ──────────────────────────────────────────────

function crearNotificacio(titol, missatge, tipus = TIPUS_NOTIFICACIO.INFO, data = null) {
    const iconData = ICONES_PROFESSIONALS[tipus] || ICONES_PROFESSIONALS[TIPUS_NOTIFICACIO.INFO];
    
    const notificacio = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        titol: titol,
        missatge: missatge,
        tipus: tipus,
        data: data || new Date().toISOString(),
        llegida: false,
        timestamp: Date.now(),
        icon: iconData.icon,
        iconColor: iconData.color
    };
    
    const notificacions = obtenirNotificacions();
    notificacions.push(notificacio);
    guardarNotificacions(notificacions);
    actualitzarComptador();
    
    // 🔥 SEMPRE renderitzar si el panell està obert
    if (document.getElementById('notificacionsPanel')?.style.display === 'block') {
        renderitzarNotificacions();
    }
    
    return notificacio;
}

// ─── ANIMACIÓ DEL BOTÓ (DEFINITIVA) ─────────────────────────────────

let animacioInterval = null;
let animacioActiva = false;

function animarBotoNotificacions() {
    const btn = document.getElementById('notificacionsBtn');
    if (!btn) return;
    
    const noLlegides = obtenirNotificacions().filter(n => !n.llegida).length;
    
    // 🔥 Si no hi ha notificacions, aturar animació
    if (noLlegides === 0) {
        if (animacioInterval) {
            clearInterval(animacioInterval);
            animacioInterval = null;
            animacioActiva = false;
        }
        btn.style.boxShadow = 'none';
        btn.style.borderColor = 'rgba(255, 215, 0, 0.1)';
        btn.style.background = 'rgba(255, 215, 0, 0.05)';
        btn.style.transition = 'all 0.3s ease';
        return;
    }
    
    // 🔥 Si ja està activa, no fer res (però seguir comprovant)
    if (animacioActiva) {
        // Comprovar si encara hi ha notificacions
        return;
    }
    
    animacioActiva = true;
    let paso = 0;
    
    // Netejar interval anterior
    if (animacioInterval) {
        clearInterval(animacioInterval);
        animacioInterval = null;
    }
    
    animacioInterval = setInterval(() => {
        // 🔥 Recalcular per si han canviat les notificacions
        const noLlegidesAra = obtenirNotificacions().filter(n => !n.llegida).length;
        if (noLlegidesAra === 0) {
            // Si ja no n'hi ha, aturar
            if (animacioInterval) {
                clearInterval(animacioInterval);
                animacioInterval = null;
                animacioActiva = false;
            }
            btn.style.boxShadow = 'none';
            btn.style.borderColor = 'rgba(255, 215, 0, 0.1)';
            btn.style.background = 'rgba(255, 215, 0, 0.05)';
            return;
        }
        
        paso++;
        const intensity = 0.06 + 0.06 * Math.sin(paso * 0.5);
        btn.style.boxShadow = `0 0 25px rgba(255, 215, 0, ${intensity})`;
        btn.style.borderColor = `rgba(255, 215, 0, ${0.15 + 0.15 * Math.sin(paso * 0.5)})`;
        btn.style.background = `rgba(255, 215, 0, ${0.05 + 0.05 * Math.sin(paso * 0.5)})`;
    }, 800);
}

// ─── RENDERITZAR NOTIFICACIONS ──────────────────────────────────────

function renderitzarNotificacions() {
    const panel = document.getElementById('notificacionsPanel');
    const llista = document.getElementById('notificacionsLlista');
    const buit = document.getElementById('notificacionsBuit');
    const comptador = document.getElementById('notificacionsComptador');
    
    if (!panel || !llista) return;
    
    const notificacions = obtenirNotificacions();
    const noLlegides = notificacions.filter(n => !n.llegida).length;
    
    if (comptador) {
        comptador.textContent = noLlegides;
        comptador.style.display = noLlegides > 0 ? 'inline' : 'none';
    }
    
    if (notificacions.length === 0) {
        if (buit) buit.style.display = 'block';
        llista.innerHTML = '';
        return;
    }
    
    if (buit) buit.style.display = 'none';
    
    const sorted = [...notificacions].reverse();
    
    llista.innerHTML = sorted.map(n => {
        const iconData = ICONES_PROFESSIONALS[n.tipus] || ICONES_PROFESSIONALS[TIPUS_NOTIFICACIO.INFO];
        const esNoLlegida = !n.llegida;
        
        return `
            <div class="notificacio-item ${esNoLlegida ? 'no-llegida' : 'llegida'}" 
                 data-id="${n.id}"
                 style="
                     position: relative;
                     padding: 14px 18px 14px 16px;
                     border-bottom: 1px solid rgba(255,255,255,0.04);
                     cursor: pointer;
                     transition: all 0.25s ease;
                     background: ${esNoLlegida ? iconData.bg : 'transparent'};
                     border-left: 3px solid ${esNoLlegida ? iconData.color : 'transparent'};
                 "
                 onmouseenter="this.style.background='${esNoLlegida ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'}'"
                 onmouseleave="this.style.background='${esNoLlegida ? iconData.bg : 'transparent'}'">
                
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                    <div style="
                        width: 34px;
                        height: 34px;
                        border-radius: 50%;
                        background: ${iconData.bg};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                        border: 1px solid ${iconData.border};
                    ">
                        <i class="fas ${iconData.icon}" style="color: ${iconData.color}; font-size: 14px;"></i>
                    </div>
                    
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
                            <strong style="color: ${esNoLlegida ? '#ffffff' : '#8899bb'}; font-size: 13px; font-weight: 600;">
                                ${n.titol}
                            </strong>
                            ${esNoLlegida ? `
                                <span style="
                                    background: ${iconData.color};
                                    width: 6px;
                                    height: 6px;
                                    border-radius: 50%;
                                    flex-shrink: 0;
                                "></span>
                            ` : ''}
                        </div>
                        <p style="
                            margin: 0;
                            color: ${esNoLlegida ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)'};
                            font-size: 12px;
                            line-height: 1.5;
                            word-wrap: break-word;
                        ">
                            ${n.missatge}
                        </p>
                        <span style="
                            color: rgba(255,255,255,0.2);
                            font-size: 9px;
                            display: block;
                            margin-top: 4px;
                            font-weight: 400;
                            letter-spacing: 0.3px;
                        ">
                            ${new Date(n.data).toLocaleString('ca-ES', { 
                                day: '2-digit', 
                                month: 'short', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                            })}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    llista.querySelectorAll('.notificacio-item').forEach(item => {
        item.addEventListener('click', function(e) {
            const id = this.dataset.id;
            if (id) {
                marcarComLlegida(id);
                renderitzarNotificacions();
            }
        });
    });
}

// ─── UTILITATS ──────────────────────────────────────────────────────

function getColorTipus(tipus) {
    const colors = {
        [TIPUS_NOTIFICACIO.ALERTA]: '#FF1744',
        [TIPUS_NOTIFICACIO.WARNING]: '#FF9100',
        [TIPUS_NOTIFICACIO.SUCCESS]: '#00E676',
        [TIPUS_NOTIFICACIO.INFO]: '#2979FF'
    };
    return colors[tipus] || '#2979FF';
}

// ─── PANELL DE NOTIFICACIONS ───────────────────────────────────────

function toggleNotificacionsPanel() {
    const panel = document.getElementById('notificacionsPanel');
    if (!panel) return;
    
    const isOpen = panel.style.display === 'block';
    
    if (isOpen) {
        panel.style.display = 'none';
        // 🔥 Reactivar animació en tancar
        setTimeout(() => {
            animarBotoNotificacions();
        }, 100);
    } else {
        panel.style.display = 'block';
        renderitzarNotificacions();
        // 🔥 Aturar animació mentre es veu el panell (per no distreure)
        if (animacioInterval) {
            clearInterval(animacioInterval);
            animacioInterval = null;
            animacioActiva = false;
            const btn = document.getElementById('notificacionsBtn');
            if (btn) {
                btn.style.boxShadow = 'none';
                btn.style.borderColor = 'rgba(255, 215, 0, 0.1)';
                btn.style.background = 'rgba(255, 215, 0, 0.05)';
            }
        }
    }
}

function tancarPanellNotificacions() {
    const panel = document.getElementById('notificacionsPanel');
    if (panel) {
        panel.style.display = 'none';
        // 🔥 Reactivar animació en tancar
        setTimeout(() => {
            animarBotoNotificacions();
        }, 100);
    }
}

function crearPanelNotificacions() {
    if (document.getElementById('notificacionsPanel')) return;
    
    const panel = document.createElement('div');
    panel.id = 'notificacionsPanel';
    panel.style.cssText = `
        position: fixed;
        top: 62px;
        right: 16px;
        width: 400px;
        max-width: calc(100% - 32px);
        max-height: 520px;
        background: #0d1826;
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 12px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.6);
        z-index: 10000;
        display: none;
        overflow: hidden;
        font-family: 'Segoe UI', Tahoma, sans-serif;
        backdrop-filter: blur(12px);
    `;
    
    panel.innerHTML = `
        <div style="
            padding: 14px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(13, 24, 38, 0.95);
        ">
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-bell" style="color: #FFD700; font-size: 16px;"></i>
                <h3 style="margin: 0; color: white; font-size: 14px; font-weight: 600; letter-spacing: 0.3px;">
                    Notificacions
                </h3>
                <span id="notificacionsComptador" style="
                    background: #FF1744;
                    color: white;
                    font-size: 9px;
                    font-weight: 700;
                    padding: 1px 8px;
                    border-radius: 10px;
                    display: none;
                    letter-spacing: 0.3px;
                ">0</span>
            </div>
            <div style="display: flex; gap: 6px;">
                <button onclick="marcarTotesLlegides(); renderitzarNotificacions();" 
                        style="
                            background: rgba(255,255,255,0.04);
                            border: 1px solid rgba(255,255,255,0.06);
                            color: rgba(255,255,255,0.5);
                            padding: 4px 10px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 10px;
                            font-weight: 500;
                            transition: all 0.2s;
                            font-family: inherit;
                        "
                        onmouseenter="this.style.background='rgba(255,255,255,0.08)'"
                        onmouseleave="this.style.background='rgba(255,255,255,0.04)'">
                    Marcar totes
                </button>
                <button onclick="eliminarTotesNotificacions(); renderitzarNotificacions();" 
                        style="
                            background: rgba(255,23,68,0.08);
                            border: 1px solid rgba(255,23,68,0.15);
                            color: rgba(255,255,255,0.5);
                            padding: 4px 10px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 10px;
                            font-weight: 500;
                            transition: all 0.2s;
                            font-family: inherit;
                        "
                        onmouseenter="this.style.background='rgba(255,23,68,0.15)'"
                        onmouseleave="this.style.background='rgba(255,23,68,0.08)'">
                    <i class="fas fa-trash-alt" style="font-size: 9px; margin-right: 3px;"></i>
                    Eliminar
                </button>
                <button onclick="tancarPanellNotificacions();" 
                        style="
                            background: rgba(255,255,255,0.03);
                            border: 1px solid rgba(255,255,255,0.04);
                            color: rgba(255,255,255,0.3);
                            width: 28px;
                            height: 28px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            transition: all 0.25s ease;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-family: inherit;
                        "
                        onmouseenter="this.style.background='rgba(255,255,255,0.08)'; this.style.color='rgba(255,255,255,0.7)'"
                        onmouseleave="this.style.background='rgba(255,255,255,0.03)'; this.style.color='rgba(255,255,255,0.3)'">
                    ✕
                </button>
            </div>
        </div>
        
        <div id="notificacionsLlista" style="
            overflow-y: auto;
            max-height: 440px;
            padding: 0;
        "></div>
        
        <div id="notificacionsBuit" style="
            padding: 50px 20px;
            text-align: center;
            color: rgba(255,255,255,0.2);
            display: none;
        ">
            <i class="fas fa-inbox" style="font-size: 36px; display: block; margin-bottom: 12px; color: rgba(255,255,255,0.08);"></i>
            <p style="margin: 0; font-size: 14px; font-weight: 400; letter-spacing: 0.3px;">Cap notificació pendent</p>
            <p style="margin: 4px 0 0; font-size: 11px; color: rgba(255,255,255,0.1);">Tornaràs a rebre notificacions quan hi hagi novetats</p>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    afegirBotoNotificacions();
}

// ─── AFEGIR BOTÓ AL COSTAT DEL RADAR ─────────────────────────────

function afegirBotoNotificacions() {
    if (document.getElementById('notificacionsBtn')) return;
    
    let radarBtn = document.getElementById('btnRadarLive');
    
    if (!radarBtn) {
        setTimeout(afegirBotoNotificacions, 500);
        return;
    }
    
    const parent = radarBtn.parentNode;
    if (!parent) {
        setTimeout(afegirBotoNotificacions, 500);
        return;
    }
    
    const btn = document.createElement('button');
    btn.id = 'notificacionsBtn';
    btn.className = 'topnav-radar-btn';
    btn.title = 'Notificacions';
    btn.style.cssText = `
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 215, 0, 0.05);
        border: 1px solid rgba(255, 215, 0, 0.1);
        border-radius: 6px;
        color: rgba(255, 215, 0, 0.8);
        font-size: 10px;
        font-weight: 500;
        padding: 4px 12px 4px 10px;
        cursor: pointer;
        transition: all 0.25s ease;
        height: 28px;
        white-space: nowrap;
        font-family: inherit;
        margin-right: 4px;
        letter-spacing: 0.2px;
    `;
    
    btn.innerHTML = `
        <i class="fas fa-bell" style="font-size: 12px;"></i>
        <span>Notificacions</span>
        <span id="notificacionsBadge" style="
            position: absolute;
            top: -4px;
            right: -4px;
            background: #FF1744;
            color: white;
            font-size: 8px;
            font-weight: 700;
            padding: 1px 5px;
            border-radius: 50%;
            min-width: 16px;
            height: 16px;
            display: none;
            align-items: center;
            justify-content: center;
            border: 2px solid #0d1826;
            line-height: 1;
            letter-spacing: 0.2px;
        ">0</span>
    `;
    
    btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(255, 215, 0, 0.1)';
        btn.style.borderColor = 'rgba(255, 215, 0, 0.25)';
        btn.style.color = '#FFD700';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(255, 215, 0, 0.05)';
        btn.style.borderColor = 'rgba(255, 215, 0, 0.1)';
        btn.style.color = 'rgba(255, 215, 0, 0.8)';
    });
    
    btn.addEventListener('click', toggleNotificacionsPanel);
    
    const separator = document.createElement('span');
    separator.className = 'topnav-visor-separator';
    separator.textContent = '|';
    separator.style.cssText = 'color: rgba(255,255,255,0.06); user-select: none; margin: 0 4px;';
    
    parent.insertBefore(separator, radarBtn.nextSibling);
    parent.insertBefore(btn, separator.nextSibling);
    
    actualitzarComptador();
}

// ─── INICIALITZACIÓ ──────────────────────────────────────────────────

let intervalComprovacio = null;

function inicialitzarNotificacions() {
    crearPanelNotificacions();
    actualitzarComptador();
    
    // 🔥 Interval de comprovació continu (cada 10 segons)
    if (intervalComprovacio) {
        clearInterval(intervalComprovacio);
    }
    intervalComprovacio = setInterval(() => {
        // 🔥 Comprovar notificacions del xat
        if (typeof comprovarMissatgesXat === 'function') {
            comprovarMissatgesXat();
        }
        // 🔥 Actualitzar comptador
        actualitzarComptador();
    }, NOTIFICACIONS.checkInterval);
    
    console.log('[Notificacions] 🔔 Sistema actiu. Comprovant cada ' + (NOTIFICACIONS.checkInterval / 1000) + 's');
}

// ─── EXPOSAR FUNCIONS ──────────────────────────────────────────────

window.notificacions = {
    crear: crearNotificacio,
    marcarLlegida: marcarComLlegida,
    marcarTotes: marcarTotesLlegides,
    eliminar: eliminarNotificacio,
    eliminarTotes: eliminarTotesNotificacions,
    obtenir: obtenirNotificacions,
    renderitzar: renderitzarNotificacions,
    togglePanel: toggleNotificacionsPanel,
    tancarPanel: tancarPanellNotificacions
};

window.crearNotificacio = crearNotificacio;
window.marcarTotesLlegides = marcarTotesLlegides;
window.eliminarTotesNotificacions = eliminarTotesNotificacions;
window.eliminarNotificacio = eliminarNotificacio;
window.renderitzarNotificacions = renderitzarNotificacions;
window.toggleNotificacionsPanel = toggleNotificacionsPanel;
window.tancarPanellNotificacions = tancarPanellNotificacions;

// Auto-inicialitzar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicialitzarNotificacions);
} else {
    inicialitzarNotificacions();
}