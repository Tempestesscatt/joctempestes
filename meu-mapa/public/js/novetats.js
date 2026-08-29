// ═══════════════════════════════════════════════════════════════════════
//  NOTIFICACIONS.JS — Sistema de notificacions Meteorologia
//  Versió 1.0.0
// ═══════════════════════════════════════════════════════════════════════

const NOTIFICACIONS = {
    versio: '1.0.0',
    checkInterval: 300000, // 5 minuts
    maxNotifications: 50,
    storageKey: 'meteo_notificacions'
};

// ─── TIPUS DE NOTIFICACIONS ──────────────────────────────────────────

const TIPUS_NOTIFICACIO = {
    ALERTA: 'alerta',
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning'
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
        // Limitar nombre de notificacions
        if (notificacions.length > NOTIFICACIONS.maxNotifications) {
            notificacions = notificacions.slice(-NOTIFICACIONS.maxNotifications);
        }
        localStorage.setItem(NOTIFICACIONS.storageKey, JSON.stringify(notificacions));
    } catch (e) {
        // Error guardant notificacions
    }
}

function marcarComLlegida(id) {
    const notificacions = obtenirNotificacions();
    const index = notificacions.findIndex(n => n.id === id);
    if (index !== -1) {
        notificacions[index].llegida = true;
        guardarNotificacions(notificacions);
        actualitzarComptador();
        return true;
    }
    return false;
}

function marcarTotesLlegides() {
    const notificacions = obtenirNotificacions();
    notificacions.forEach(n => n.llegida = true);
    guardarNotificacions(notificacions);
    actualitzarComptador();
}

function eliminarNotificacio(id) {
    let notificacions = obtenirNotificacions();
    notificacions = notificacions.filter(n => n.id !== id);
    guardarNotificacions(notificacions);
    actualitzarComptador();
}

function eliminarTotesNotificacions() {
    guardarNotificacions([]);
    actualitzarComptador();
}

// ─── COMPTADOR ────────────────────────────────────────────────────────

function actualitzarComptador() {
    const notificacions = obtenirNotificacions();
    const noLlegides = notificacions.filter(n => !n.llegida).length;
    
    // Actualitzar badge al header
    const badge = document.getElementById('notificacionsBadge');
    if (badge) {
        if (noLlegides > 0) {
            badge.style.display = 'flex';
            badge.textContent = noLlegides > 99 ? '99+' : noLlegides;
        } else {
            badge.style.display = 'none';
        }
    }
    
    // Actualitzar títol de la pàgina
    if (noLlegides > 0) {
        document.title = `(${noLlegides}) Meteorologia`;
    } else {
        document.title = 'Meteorologia';
    }
}

// ─── CREAR NOTIFICACIÓ ──────────────────────────────────────────────

function crearNotificacio(titol, missatge, tipus = TIPUS_NOTIFICACIO.INFO, data = null) {
    const notificacio = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        titol: titol,
        missatge: missatge,
        tipus: tipus,
        data: data || new Date().toISOString(),
        llegida: false,
        timestamp: Date.now()
    };
    
    const notificacions = obtenirNotificacions();
    notificacions.push(notificacio);
    guardarNotificacions(notificacions);
    
    actualitzarComptador();
    
    // Mostrar notificació al panell si està obert
    if (document.getElementById('notificacionsPanel')?.style.display === 'block') {
        renderitzarNotificacions();
    }
    
    return notificacio;
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
    
    // Actualitzar comptador
    if (comptador) {
        comptador.textContent = noLlegides;
        comptador.style.display = noLlegides > 0 ? 'inline' : 'none';
    }
    
    // Mostrar missatge buit
    if (notificacions.length === 0) {
        if (buit) buit.style.display = 'block';
        llista.innerHTML = '';
        return;
    }
    
    if (buit) buit.style.display = 'none';
    
    // Renderitzar llista (més recents primer)
    const sorted = [...notificacions].reverse();
    
    llista.innerHTML = sorted.map(n => `
        <div class="notificacio-item ${n.llegida ? 'llegida' : 'no-llegida'}" 
             data-id="${n.id}"
             style="
                 padding: 12px 15px;
                 border-bottom: 1px solid rgba(255,255,255,0.05);
                 cursor: pointer;
                 transition: all 0.2s;
                 background: ${n.llegida ? 'transparent' : 'rgba(62, 166, 255, 0.05)'};
                 border-left: 3px solid ${getColorTipus(n.tipus)};
             "
             onmouseover="this.style.background='rgba(255,255,255,0.05)'"
             onmouseout="this.style.background='${n.llegida ? 'transparent' : 'rgba(62, 166, 255, 0.05)'}'">
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="font-size: 16px;">${getIconTipus(n.tipus)}</span>
                        <strong style="color: white; font-size: 14px;">${n.titol}</strong>
                        ${!n.llegida ? '<span style="background: #3ea6ff; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;"></span>' : ''}
                    </div>
                    <p style="margin: 0; color: rgba(255,255,255,0.7); font-size: 13px; line-height: 1.4; word-wrap: break-word;">
                        ${n.missatge}
                    </p>
                    <span style="color: rgba(255,255,255,0.3); font-size: 10px; display: block; margin-top: 4px;">
                        ${new Date(n.data).toLocaleString('ca-ES')}
                    </span>
                </div>
                <button onclick="event.stopPropagation(); eliminarNotificacio('${n.id}')" 
                        style="
                            background: rgba(255,255,255,0.1);
                            border: none;
                            color: rgba(255,255,255,0.4);
                            width: 24px;
                            height: 24px;
                            border-radius: 50%;
                            cursor: pointer;
                            font-size: 12px;
                            transition: all 0.2s;
                            flex-shrink: 0;
                        "
                        onmouseover="this.style.background='rgba(255,0,0,0.3)'; this.style.color='white'"
                        onmouseout="this.style.background='rgba(255,255,255,0.1)'; this.style.color='rgba(255,255,255,0.4)'">
                    ✕
                </button>
            </div>
        </div>
    `).join('');
    
    // Afegir event listeners per marcar com a llegida
    llista.querySelectorAll('.notificacio-item').forEach(item => {
        item.addEventListener('click', function() {
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
        [TIPUS_NOTIFICACIO.ALERTA]: '#FF4500',
        [TIPUS_NOTIFICACIO.WARNING]: '#FF8C00',
        [TIPUS_NOTIFICACIO.SUCCESS]: '#4CAF50',
        [TIPUS_NOTIFICACIO.INFO]: '#3ea6ff'
    };
    return colors[tipus] || '#3ea6ff';
}

function getIconTipus(tipus) {
    const icons = {
        [TIPUS_NOTIFICACIO.ALERTA]: '⚠️',
        [TIPUS_NOTIFICACIO.WARNING]: '⚡',
        [TIPUS_NOTIFICACIO.SUCCESS]: '✅',
        [TIPUS_NOTIFICACIO.INFO]: 'ℹ️'
    };
    return icons[tipus] || '📢';
}

// ─── PANELL DE NOTIFICACIONS ───────────────────────────────────────

function toggleNotificacionsPanel() {
    const panel = document.getElementById('notificacionsPanel');
    if (!panel) return;
    
    const isOpen = panel.style.display === 'block';
    
    if (isOpen) {
        panel.style.display = 'none';
    } else {
        panel.style.display = 'block';
        renderitzarNotificacions();
    }
}

function crearPanelNotificacions() {
    // Comprovar si ja existeix
    if (document.getElementById('notificacionsPanel')) return;
    
    // Crear contenidor del panel
    const panel = document.createElement('div');
    panel.id = 'notificacionsPanel';
    panel.style.cssText = `
        position: fixed;
        top: 60px;
        right: 15px;
        width: 380px;
        max-width: calc(100% - 30px);
        max-height: 500px;
        background: #0d1826;
        border: 1px solid rgba(62, 166, 255, 0.2);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        z-index: 10000;
        display: none;
        overflow: hidden;
        font-family: 'Segoe UI', Tahoma, sans-serif;
    `;
    
    panel.innerHTML = `
        <div style="
            padding: 15px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(13, 24, 38, 0.95);
        ">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">🔔</span>
                <h3 style="margin: 0; color: white; font-size: 16px; font-weight: 600;">
                    Notificacions
                </h3>
                <span id="notificacionsComptador" style="
                    background: #3ea6ff;
                    color: white;
                    font-size: 10px;
                    padding: 1px 8px;
                    border-radius: 10px;
                    display: none;
                ">0</span>
            </div>
            <div style="display: flex; gap: 8px;">
                <button onclick="marcarTotesLlegides(); renderitzarNotificacions();" 
                        style="
                            background: rgba(255,255,255,0.05);
                            border: none;
                            color: rgba(255,255,255,0.6);
                            padding: 4px 10px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 11px;
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                        onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                    Marcar totes
                </button>
                <button onclick="eliminarTotesNotificacions(); renderitzarNotificacions();" 
                        style="
                            background: rgba(255,0,0,0.1);
                            border: none;
                            color: rgba(255,255,255,0.6);
                            padding: 4px 10px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 11px;
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.background='rgba(255,0,0,0.2)'"
                        onmouseout="this.style.background='rgba(255,0,0,0.1)'">
                    Eliminar totes
                </button>
            </div>
        </div>
        
        <div id="notificacionsLlista" style="
            overflow-y: auto;
            max-height: 420px;
            padding: 0;
        "></div>
        
        <div id="notificacionsBuit" style="
            padding: 40px 20px;
            text-align: center;
            color: rgba(255,255,255,0.3);
            display: none;
        ">
            <div style="font-size: 40px; margin-bottom: 10px;">📭</div>
            <p style="margin: 0; font-size: 14px;">Cap notificació pendent</p>
            <p style="margin: 5px 0 0; font-size: 12px;">Tornaràs a rebre notificacions quan hi hagi novetats</p>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Afegir botó de notificacions al header
    afegirBotoNotificacions();
}

function afegirBotoNotificacions() {
    // Comprovar si el botó ja existeix
    if (document.getElementById('notificacionsBtn')) return;
    
    // Buscar el contenidor del header
    const header = document.querySelector('.header-right') || document.querySelector('#app > div > div > div > div > div');
    if (!header) return;
    
    // Crear botó
    const btn = document.createElement('button');
    btn.id = 'notificacionsBtn';
    btn.style.cssText = `
        background: none;
        border: none;
        color: rgba(255,255,255,0.7);
        font-size: 20px;
        cursor: pointer;
        position: relative;
        padding: 6px;
        transition: all 0.2s;
        border-radius: 50%;
        width: 38px;
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    btn.innerHTML = `
        🔔
        <span id="notificacionsBadge" style="
            position: absolute;
            top: -2px;
            right: -2px;
            background: #FF4500;
            color: white;
            font-size: 9px;
            font-weight: 700;
            padding: 2px 5px;
            border-radius: 50%;
            min-width: 18px;
            height: 18px;
            display: none;
            align-items: center;
            justify-content: center;
            border: 2px solid #0d1826;
        ">0</span>
    `;
    btn.title = 'Notificacions';
    
    btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(255,255,255,0.05)';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.background = 'none';
    });
    
    btn.addEventListener('click', toggleNotificacionsPanel);
    
    // Inserir al header
    header.appendChild(btn);
    
    // Actualitzar comptador
    actualitzarComptador();
}

// ─── NOTIFICACIONS PREDEFINIDES ─────────────────────────────────────

function notificacioAlertaTempesta(temps, intensitat) {
    const titol = ` Alerta de tempesta${intensitat ? ' ' + intensitat : ''}`;
    const missatge = `Tempesta detectada${temps ? ' per a ' + temps : ''}. Precaució!`;
    return crearNotificacio(titol, missatge, TIPUS_NOTIFICACIO.ALERTA);
}

function notificacioCanviModel(temps, model) {
    const titol = ` Canvi en el model`;
    const missatge = `El model ${model || 'desconegut'} ha actualitzat les dades${temps ? ' per a ' + temps : ''}.`;
    return crearNotificacio(titol, missatge, TIPUS_NOTIFICACIO.INFO);
}

function notificacioNovaVariable(temps, variable) {
    const titol = ` Nova variable disponible`;
    const missatge = `S'ha afegit ${variable || 'una nova variable'}${temps ? ' per a ' + temps : ''}.`;
    return crearNotificacio(titol, missatge, TIPUS_NOTIFICACIO.SUCCESS);
}

function notificacioRiscAlt(temps, risc) {
    const titol = ` Risc elevat`;
    const missatge = `Nivell de risc ${risc || 'alt'} detectat${temps ? ' per a ' + temps : ''}.`;
    return crearNotificacio(titol, missatge, TIPUS_NOTIFICACIO.WARNING);
}

// ─── NOTIFICACIONS PER TEMPS ────────────────────────────────────────

function notificacioPerTemps(temps) {
    if (!temps) return;
    
    // Exemples de notificacions basades en el temps
    const tempsLower = temps.toLowerCase();
    
    if (tempsLower.includes('pluja') || tempsLower.includes('ruixat')) {
        crearNotificacio(
            ' Precipitació prevista',
            `Pluja esperada${temps ? ' per a ' + temps : ''}. Porta paraigua!`,
            TIPUS_NOTIFICACIO.INFO
        );
    }
    
    if (tempsLower.includes('tempesta') || tempsLower.includes('trons')) {
        crearNotificacio(
            ' Tempesta imminent',
            `Tempesta detectada${temps ? ' per a ' + temps : ''}. Precaució!`,
            TIPUS_NOTIFICACIO.ALERTA
        );
    }
    
    if (tempsLower.includes('calor') || tempsLower.includes('onada de calor')) {
        crearNotificacio(
            ' Onada de calor',
            `Temperatures extremes${temps ? ' per a ' + temps : ''}. Mantén-te hidratat!`,
            TIPUS_NOTIFICACIO.WARNING
        );
    }
}

// ─── INICIALITZACIÓ ──────────────────────────────────────────────────

function inicialitzarNotificacions() {
    // Crear panel
    crearPanelNotificacions();
    
    // Actualitzar comptador
    actualitzarComptador();
    
    // Verificar notificacions periòdicament
    setInterval(() => {
        // Aquí es podrien verificar noves notificacions del servidor
        actualitzarComptador();
    }, NOTIFICACIONS.checkInterval);
}

// ─── EXPOSAR FUNCIONS ──────────────────────────────────────────────

window.notificacions = {
    crear: crearNotificacio,
    crearAlerta: notificacioAlertaTempesta,
    crearCanviModel: notificacioCanviModel,
    crearNovaVariable: notificacioNovaVariable,
    crearRiscAlt: notificacioRiscAlt,
    crearPerTemps: notificacioPerTemps,
    marcarLlegida: marcarComLlegida,
    marcarTotes: marcarTotesLlegides,
    eliminar: eliminarNotificacio,
    eliminarTotes: eliminarTotesNotificacions,
    obtenir: obtenirNotificacions,
    renderitzar: renderitzarNotificacions,
    togglePanel: toggleNotificacionsPanel
};

window.crearNotificacio = crearNotificacio;
window.marcarTotesLlegides = marcarTotesLlegides;
window.eliminarTotesNotificacions = eliminarTotesNotificacions;
window.eliminarNotificacio = eliminarNotificacio;
window.renderitzarNotificacions = renderitzarNotificacions;
window.toggleNotificacionsPanel = toggleNotificacionsPanel;

// Auto-inicialitzar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicialitzarNotificacions);
} else {
    inicialitzarNotificacions();
}