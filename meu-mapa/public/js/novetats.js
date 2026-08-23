// ═══════════════════════════════════════════════════════════════════════
//  NOTIFICACIONS.JS — Sistema d'avisos amb control per IP
//  Versió 1.0 Oficial - Notificacions laterals per usuaris existents
// ═══════════════════════════════════════════════════════════════════════

const NOTIFICACIONS = {
    versio: '1.0.0',
    logo: 'blob:https://web.telegram.org/abaf44b2-7d72-443a-8422-5cf351110b0a',
    modeProves: false,
    avisos: [
        {
            id: 'rendiment_v1',
            tipus: 'exit',
            titol: 'VERSIÓ 1.0 OFICIAL',
            missatge: 'Actualització de rendiment i memòria RAM',
            detalls: [
                'Optimització per a més dispositius   ',
                'Millora de velocitat de càrrega',
                'Reducció de consum de RAM',
                'Compatibilitat amb dispositius antics',
                'Estabilitat millorada del sistema'
            ],
            data: '2024-01-15',
            prioritat: 'alta',
            icona: 'rendiment',
            imatgeFons: 'https://miro.medium.com/v2/resize:fit:1200/1*L8AOPwkeMKvSs10jRNjCkQ.jpeg'
        }
    ]
};

// ──────────────────────────────────────────────────────────────
//  DETECCIÓ DE DISPOSITIU
// ──────────────────────────────────────────────────────────────

function detectarDispositiu() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const userAgent = navigator.userAgent.toLowerCase();
    
    let dispositiu = {
        tipus: 'escriptori',
        esMobil: false,
        esTauleta: false,
        esEscriptori: false,
        width: width,
        height: height
    };
    
    if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent)) {
        dispositiu.tipus = 'mobil';
        dispositiu.esMobil = true;
    }
    else if (/tablet|ipad/.test(userAgent) || (width >= 768 && width <= 1024)) {
        dispositiu.tipus = 'tauleta';
        dispositiu.esTauleta = true;
    }
    else {
        dispositiu.tipus = 'escriptori';
        dispositiu.esEscriptori = true;
    }
    
    if (width < 480) {
        dispositiu.esMobil = true;
        dispositiu.tipus = 'mobil';
    }
    
    return dispositiu;
}

// ──────────────────────────────────────────────────────────────
//  GESTIÓ D'IP I USUARIS
// ──────────────────────────────────────────────────────────────

async function obtenirIP() {
    try {
        const resposta = await fetch('https://api.ipify.org?format=json');
        const dades = await resposta.json();
        return dades.ip;
    } catch (error) {
        console.warn('[Notificacions] No s\'ha pogut obtenir IP, intentant mètode alternatiu...');
        try {
            const resposta2 = await fetch('https://api.ip.sb/ip');
            return await resposta2.text();
        } catch (error2) {
            return 'ip_desconeguda';
        }
    }
}

function obtenirIdentificadorUsuari() {
    const user = window._firebaseUser;
    if (user && user.uid) {
        return `uid_${user.uid}`;
    }
    return null;
}

async function obtenirClauEmmagatzematge() {
    // Prioritat: UID > IP
    const uid = obtenirIdentificadorUsuari();
    if (uid) {
        return `notif_vistes_${uid}`;
    }
    
    const ip = await obtenirIP();
    return `notif_vistes_ip_${ip}`;
}

async function comprovarNotificacionsVistes() {
    if (NOTIFICACIONS.modeProves) {
        return {};
    }
    
    const clau = await obtenirClauEmmagatzematge();
    
    try {
        const dades = localStorage.getItem(clau);
        return dades ? JSON.parse(dades) : {};
    } catch (error) {
        console.warn('[Notificacions] Error llegint localStorage:', error);
        return {};
    }
}

async function marcarNotificacioVista(id) {
    if (NOTIFICACIONS.modeProves) {
        return;
    }
    
    const vistes = await comprovarNotificacionsVistes();
    vistes[id] = {
        data: new Date().toISOString(),
        versio: NOTIFICACIONS.versio
    };
    
    const clau = await obtenirClauEmmagatzematge();
    
    try {
        localStorage.setItem(clau, JSON.stringify(vistes));
    } catch (error) {
        console.warn('[Notificacions] Error guardant localStorage:', error);
    }
}

async function esNouUsuari() {
    const vistes = await comprovarNotificacionsVistes();
    const clau = await obtenirClauEmmagatzematge();
    
    // Comprovar si existeix alguna entrada al localStorage per aquesta IP/UID
    try {
        const existeix = localStorage.getItem(clau) !== null;
        return !existeix;
    } catch (error) {
        return true;
    }
}

async function obtenirNotificacionsPendents() {
    const vistes = await comprovarNotificacionsVistes();
    return NOTIFICACIONS.avisos.filter(avis => !vistes[avis.id]);
}

// ──────────────────────────────────────────────────────────────
//  NOTIFICACIÓ LATERAL (PER USUARIS EXISTENTS)
// ──────────────────────────────────────────────────────────────

function mostrarNotificacioLateral(avis) {
    const dispositiu = detectarDispositiu();
    
    const lateral = document.createElement('div');
    lateral.id = `lateral_${avis.id}`;
    
    // Estils per a notificació lateral
    let estilsLateral = `
        position: fixed;
        z-index: 9996;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-right: 4px solid #00C853;
        border-radius: 0 12px 12px 0;
        padding: ${dispositiu.esMobil ? '12px' : '16px'};
        box-shadow: 4px 0 32px rgba(0,0,0,0.5);
        animation: lateralSlideIn 0.5s ease-out;
        cursor: pointer;
        transition: all 0.3s ease;
        max-width: ${dispositiu.esMobil ? '280px' : '350px'};
        width: calc(100% - 20px);
    `;
    
    // Posició lateral (esquerra)
    if (dispositiu.esMobil) {
        estilsLateral += `
            top: 50%;
            left: 0;
            transform: translateY(-50%);
        `;
    } else {
        estilsLateral += `
            bottom: 30px;
            left: 0;
        `;
    }
    
    lateral.style.cssText = estilsLateral;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes lateralSlideIn {
            0% { transform: translateX(-100%); opacity: 0; }
            100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes lateralSlideOut {
            0% { transform: translateX(0); opacity: 1; }
            100% { transform: translateX(-100%); opacity: 0; }
        }
        @keyframes lateralPulse {
            0%, 100% { box-shadow: 4px 0 32px rgba(0,0,0,0.5); }
            50% { box-shadow: 4px 0 40px rgba(0,200,83,0.4); }
        }
    `;
    
    if (!document.querySelector('#lateralStyles')) {
        style.id = 'lateralStyles';
        document.head.appendChild(style);
    }
    
    lateral.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 10px;">
            <img src="${NOTIFICACIONS.logo}" alt="Logo" style="
                width: ${dispositiu.esMobil ? '28px' : '32px'};
                height: ${dispositiu.esMobil ? '28px' : '32px'};
                border-radius: 50%;
                object-fit: cover;
                border: 2px solid #00C853;
            " onerror="this.style.display='none'">
            <div style="flex: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h4 style="
                        margin: 0 0 5px 0;
                        color: #00C853;
                        font-size: ${dispositiu.esMobil ? '11px' : '13px'};
                        font-weight: 600;
                    ">
                        ${avis.titol}
                    </h4>
                    <button onclick="event.stopPropagation(); this.closest('[id^=lateral_]').remove()" style="
                        background: none;
                        border: none;
                        color: #666;
                        cursor: pointer;
                        font-size: 16px;
                        padding: 0 2px;
                    ">×</button>
                </div>
                <p style="
                    margin: 0;
                    color: #b0c0d0;
                    font-size: ${dispositiu.esMobil ? '10px' : '12px'};
                    line-height: 1.3;
                ">
                    ${avis.missatge}
                </p>
                <span style="
                    color: #666;
                    font-size: ${dispositiu.esMobil ? '8px' : '9px'};
                    display: block;
                    margin-top: 5px;
                ">
                    Click per veure detalls
                </span>
            </div>
        </div>
    `;
    
    // Efecte hover
    lateral.addEventListener('mouseenter', () => {
        lateral.style.animation = 'lateralPulse 2s infinite';
    });
    
    lateral.addEventListener('mouseleave', () => {
        lateral.style.animation = '';
    });
    
    // Click per obrir panell complet
    lateral.addEventListener('click', () => {
        mostrarPanellComplet(avis);
        lateral.remove();
    });
    
    document.body.appendChild(lateral);
    
    marcarNotificacioVista(avis.id);
    
    // Auto-eliminar després de 5 segons
    setTimeout(() => {
        if (lateral.parentNode) {
            lateral.style.animation = 'lateralSlideOut 0.5s ease-in';
            setTimeout(() => {
                if (lateral.parentNode) {
                    lateral.remove();
                }
            }, 500);
        }
    }, 5000);
}

// ──────────────────────────────────────────────────────────────
//  POPUP COMPLET (PER USUARIS NOUS)
// ──────────────────────────────────────────────────────────────

function mostrarPopupNotificacio(avis) {
    const dispositiu = detectarDispositiu();
    
    const contenidor = document.createElement('div');
    contenidor.id = `popup_${avis.id}`;
    
    let estilsPopup = `
        position: fixed;
        z-index: 9997;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-left: 4px solid #00C853;
        border-radius: 12px;
        padding: ${dispositiu.esMobil ? '16px' : '20px'};
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        animation: popupSlideIn 0.5s ease-out;
        border: 1px solid rgba(0,200,83,0.3);
        cursor: pointer;
    `;
    
    if (dispositiu.esMobil) {
        estilsPopup += `
            bottom: 20px;
            right: 10px;
            max-width: 340px;
            width: calc(100% - 20px);
        `;
    } else if (dispositiu.esTauleta) {
        estilsPopup += `
            bottom: 25px;
            right: 20px;
            max-width: 400px;
            width: calc(100% - 40px);
        `;
    } else {
        estilsPopup += `
            bottom: 30px;
            right: 25px;
            max-width: 420px;
            width: calc(100% - 50px);
        `;
    }
    
    contenidor.style.cssText = estilsPopup;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes popupSlideIn {
            0% { transform: translateX(100%); opacity: 0; }
            100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes popupSlideOut {
            0% { transform: translateX(0); opacity: 1; }
            100% { transform: translateX(100%); opacity: 0; }
        }
        @keyframes popupGlow {
            0%, 100% { box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
            50% { box-shadow: 0 8px 40px rgba(0,200,83,0.3); }
        }
    `;
    
    if (!document.querySelector('#popupStyles')) {
        style.id = 'popupStyles';
        document.head.appendChild(style);
    }
    
    const fonsHTML = avis.imatgeFons ? `
        <div style="
            margin: 12px 0;
            border-radius: 8px;
            overflow: hidden;
            position: relative;
            height: ${dispositiu.esMobil ? '100px' : '130px'};
        ">
            <img src="${avis.imatgeFons}" alt="Actualització" style="
                width: 100%;
                height: 100%;
                object-fit: cover;
                filter: blur(2px);
            ">
            <div style="
                position: absolute;
                inset: 0;
                background: rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <span style="
                    color: white;
                    font-size: ${dispositiu.esMobil ? '12px' : '14px'};
                    font-weight: 600;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
                ">
                    Versió ${NOTIFICACIONS.versio}
                </span>
            </div>
        </div>
    ` : '';
    
    contenidor.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px;">
            <img src="${NOTIFICACIONS.logo}" alt="Logo" style="
                width: ${dispositiu.esMobil ? '32px' : '36px'};
                height: ${dispositiu.esMobil ? '32px' : '36px'};
                border-radius: 50%;
                object-fit: cover;
                border: 2px solid #00C853;
            " onerror="this.style.display='none'">
            <div style="flex: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h4 style="
                        margin: 0 0 8px 0;
                        color: #00C853;
                        font-size: ${dispositiu.esMobil ? '14px' : '16px'};
                        font-weight: 600;
                    ">
                        ${avis.titol}
                    </h4>
                    <button onclick="event.stopPropagation(); this.closest('[id^=popup_]').remove()" style="
                        background: none;
                        border: none;
                        color: #666;
                        cursor: pointer;
                        font-size: 20px;
                        padding: 0 4px;
                    ">×</button>
                </div>
                <p style="
                    margin: 0;
                    color: #b0c0d0;
                    font-size: ${dispositiu.esMobil ? '12px' : '14px'};
                    line-height: 1.4;
                ">
                    ${avis.missatge}
                </p>
                ${fonsHTML}
                <div style="
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid rgba(255,255,255,0.1);
                ">
                    <ul style="
                        list-style: none;
                        padding: 0;
                        margin: 0;
                    ">
                        ${avis.detalls.map(detall => `
                            <li style="
                                color: #90a0b0;
                                font-size: ${dispositiu.esMobil ? '11px' : '12px'};
                                padding: 4px 0;
                            ">
                                <span style="color: #00C853; margin-right: 5px;">✓</span>${detall}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        </div>
    `;
    
    contenidor.addEventListener('mouseenter', () => {
        contenidor.style.animation = 'popupGlow 2s infinite';
    });
    
    contenidor.addEventListener('mouseleave', () => {
        contenidor.style.animation = '';
    });
    
    document.body.appendChild(contenidor);
    
    marcarNotificacioVista(avis.id);
    
    setTimeout(() => {
        if (contenidor.parentNode) {
            contenidor.style.animation = 'popupSlideOut 0.5s ease-in';
            setTimeout(() => {
                if (contenidor.parentNode) {
                    contenidor.remove();
                }
            }, 500);
        }
    }, 12000);
}

// ──────────────────────────────────────────────────────────────
//  PANELL COMPLET (PER USUARIS EXISTENTS)
// ──────────────────────────────────────────────────────────────

function mostrarPanellComplet(avis) {
    const dispositiu = detectarDispositiu();
    
    const panell = document.createElement('div');
    panell.id = `panell_${avis.id}`;
    
    let estilsPanell = `
        position: fixed;
        z-index: 9995;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.8);
        animation: panellSlideIn 0.4s ease-out;
        border: 1px solid rgba(0,200,83,0.3);
        overflow-y: auto;
    `;
    
    if (dispositiu.esMobil) {
        estilsPanell += `
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: calc(100vw - 30px);
            max-width: 400px;
            max-height: 70vh;
        `;
    } else {
        estilsPanell += `
            bottom: 30px;
            left: 30px;
            width: 420px;
            max-width: calc(100vw - 60px);
            max-height: 70vh;
        `;
    }
    
    panell.style.cssText = estilsPanell;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes panellSlideIn {
            0% { transform: translateY(20px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
        }
    `;
    
    if (!document.querySelector('#panellStyles')) {
        style.id = 'panellStyles';
        document.head.appendChild(style);
    }
    
    const fonsHTML = avis.imatgeFons ? `
        <div style="
            margin: 15px 0;
            border-radius: 10px;
            overflow: hidden;
            position: relative;
            height: ${dispositiu.esMobil ? '120px' : '150px'};
        ">
            <img src="${avis.imatgeFons}" alt="Actualització" style="
                width: 100%;
                height: 100%;
                object-fit: cover;
                filter: blur(2px);
            ">
            <div style="
                position: absolute;
                inset: 0;
                background: rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <span style="
                    color: white;
                    font-size: ${dispositiu.esMobil ? '13px' : '15px'};
                    font-weight: 600;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
                ">
                    Versió ${NOTIFICACIONS.versio}
                </span>
            </div>
        </div>
    ` : '';
    
    panell.innerHTML = `
        <div style="
            padding: ${dispositiu.esMobil ? '15px' : '20px'};
            background: linear-gradient(135deg, #00C853, #009624);
            border-radius: 16px 16px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        ">
            <div style="display: flex; align-items: center; gap: 12px;">
                <img src="${NOTIFICACIONS.logo}" alt="Logo" style="
                    width: ${dispositiu.esMobil ? '35px' : '40px'};
                    height: ${dispositiu.esMobil ? '35px' : '40px'};
                    border-radius: 50%;
                    border: 2px solid white;
                    object-fit: cover;
                " onerror="this.style.display='none'">
                <div>
                    <h3 style="margin: 0; color: white; font-size: ${dispositiu.esMobil ? '16px' : '18px'}; font-weight: 600;">
                        ${avis.titol}
                    </h3>
                    <p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.8); font-size: ${dispositiu.esMobil ? '11px' : '12px'};">
                        Versió ${NOTIFICACIONS.versio} Oficial
                    </p>
                </div>
            </div>
            <button onclick="this.closest('[id^=panell_]').remove()" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 16px;
            ">×</button>
        </div>
        <div style="padding: ${dispositiu.esMobil ? '15px' : '20px'};">
            <p style="
                color: #b0c0d0;
                font-size: ${dispositiu.esMobil ? '12px' : '14px'};
                line-height: 1.5;
                margin: 0 0 10px 0;
            ">
                ${avis.missatge}
            </p>
            ${fonsHTML}
            <div style="
                margin-top: 15px;
                padding-top: 15px;
                border-top: 1px solid rgba(255,255,255,0.1);
            ">
                <h5 style="
                    margin: 0 0 10px 0;
                    color: #00C853;
                    font-size: ${dispositiu.esMobil ? '12px' : '14px'};
                    font-weight: 600;
                ">
                    Millores incloses:
                </h5>
                <ul style="
                    list-style: none;
                    padding: 0;
                    margin: 0;
                ">
                    ${avis.detalls.map(detall => `
                        <li style="
                            color: #90a0b0;
                            font-size: ${dispositiu.esMobil ? '11px' : '13px'};
                            padding: 5px 0;
                        ">
                            <span style="color: #00C853; margin-right: 5px;">✓</span>${detall}
                        </li>
                    `).join('')}
                </ul>
            </div>
            <span style="
                color: #666;
                font-size: ${dispositiu.esMobil ? '9px' : '10px'};
                display: block;
                margin-top: 15px;
            ">
                ${avis.data} · Prioritat: ${avis.prioritat}
            </span>
        </div>
    `;
    
    document.body.appendChild(panell);
}

// ──────────────────────────────────────────────────────────────
//  INICIALITZACIÓ
// ──────────────────────────────────────────────────────────────

async function inicialitzarNotificacions() {
    console.log('[Notificacions] Inicialitzant sistema...');
    console.log('[Notificacions] Versió:', NOTIFICACIONS.versio);
    
    const dispositiu = detectarDispositiu();
    console.log('[Notificacions] Dispositiu:', dispositiu.tipus);
    
    const ip = await obtenirIP();
    console.log('[Notificacions] IP:', ip);
    
    const nouUsuari = await esNouUsuari();
    console.log('[Notificacions] Usuari nou:', nouUsuari ? 'SÍ' : 'NO');
    
    const pendents = await obtenirNotificacionsPendents();
    
    if (pendents.length > 0) {
        console.log(`[Notificacions] ${pendents.length} notificacions pendents`);
        
        pendents.forEach((avis, index) => {
            setTimeout(() => {
                if (nouUsuari) {
                    // Usuari nou: popup complet
                    mostrarPopupNotificacio(avis);
                } else {
                    // Usuari existent: notificació lateral
                    mostrarNotificacioLateral(avis);
                }
            }, 500 + (index * 800));
        });
    } else {
        console.log('[Notificacions] Cap notificació pendent');
    }
}

// ──────────────────────────────────────────────────────────────
//  FUNCIONS PÚBLIQUES
// ──────────────────────────────────────────────────────────────

function afegirNovaNotificacio(avis) {
    if (!avis.id || !avis.titol || !avis.missatge) {
        console.error('[Notificacions] Notificació invàlida');
        return false;
    }
    
    const existeix = NOTIFICACIONS.avisos.some(a => a.id === avis.id);
    if (!existeix) {
        NOTIFICACIONS.avisos.push({
            tipus: avis.tipus || 'info',
            data: avis.data || new Date().toISOString().split('T')[0],
            prioritat: avis.prioritat || 'normal',
            icona: avis.icona || 'info',
            ...avis
        });
        return true;
    }
    
    return false;
}

async function netejarHistorial() {
    const clau = await obtenirClauEmmagatzematge();
    localStorage.removeItem(clau);
    console.log('[Notificacions] Historial netejat');
}

function activarModeProves() {
    NOTIFICACIONS.modeProves = true;
    console.log('[Notificacions] Mode proves ACTIVAT');
}

function desactivarModeProves() {
    NOTIFICACIONS.modeProves = false;
    console.log('[Notificacions] Mode proves DESACTIVAT');
}

// ──────────────────────────────────────────────────────────────
//  EXPOSAR FUNCIONS
// ──────────────────────────────────────────────────────────────

window.NOTIFICACIONS = NOTIFICACIONS;
window.inicialitzarNotificacions = inicialitzarNotificacions;
window.mostrarPopupNotificacio = mostrarPopupNotificacio;
window.mostrarNotificacioLateral = mostrarNotificacioLateral;
window.mostrarPanellComplet = mostrarPanellComplet;
window.afegirNovaNotificacio = afegirNovaNotificacio;
window.netejarHistorial = netejarHistorial;
window.activarModeProves = activarModeProves;
window.desactivarModeProves = desactivarModeProves;
window.detectarDispositiu = detectarDispositiu;

// Auto-inicialitzar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(inicialitzarNotificacions, 1000);
    });
} else {
    setTimeout(inicialitzarNotificacions, 1000);
}

console.log('[Notificacions] Sistema carregat');
console.log('[Notificacions] Versió:', NOTIFICACIONS.versio);
console.log('[Notificacions] Control per IP: Activat');