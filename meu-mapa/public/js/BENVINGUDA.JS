// ═══════════════════════════════════════════════════════════════════════
//  BENVINGUDA.JS — Salutació personalitzada amb Meteocons
//  Versió 6.0 - Amb nom d'usuari
// ═══════════════════════════════════════════════════════════════════════

const BENVINGUDA = {
    versio: '6.0.0',
    logo: 'blob:https://web.telegram.org/abaf44b2-7d72-443a-8422-5cf351110b0a',
    timeout: 6000, // 6 segons
};

// ─── ICONES METEOCONS ───────────────────────────────────────────────

const METEOCONS = {
    matinada: 'https://cdn.meteocons.com/3.0.0-next.10/svg/monochrome/clear-night.svg',
    mati: 'https://cdn.meteocons.com/3.0.0-next.10/svg/monochrome/clear-day.svg',
    migdia: 'https://cdn.meteocons.com/3.0.0-next.10/svg/monochrome/clear-day.svg',
    tarda: 'https://cdn.meteocons.com/3.0.0-next.10/svg/monochrome/fog-day.svg',
    nit: 'https://cdn.meteocons.com/3.0.0-next.10/svg/monochrome/clear-night.svg',
};

// ─── OBTENIR HORA DE MADRID ────────────────────────────────────────

function obtenirHoraMadrid() {
    const ara = new Date();
    return new Date(ara.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
}

// ─── OBTENIR NOM D'USUARI ──────────────────────────────────────────

async function obtenirNomUsuariBenvinguda() {
    const user = window._firebaseUser;
    
    if (!user) {
        return '';
    }
    
    // Intentar obtenir el nom personalitzat (de noms.js)
    if (typeof window.obtenirNomUsuari === 'function') {
        try {
            const nom = await window.obtenirNomUsuari(user);
            return nom;
        } catch (e) {
            // Error obtenint nom
        }
    }
    
    // Fallback: nom de Google o email
    if (user.displayName) {
        return user.displayName;
    }
    
    if (user.email) {
        return user.email.split('@')[0];
    }
    
    return '';
}

// ─── SALUTACIONS PERSONALITZADES ──────────────────────────────────

function obtenirSalutacio(nomUsuari) {
    const hora = obtenirHoraMadrid();
    const hores = hora.getHours();
    
    let salutacio = {
        titol: '',
        missatge: '',
        icona: '',
        color: ''
    };
    
    // Construir el missatge amb el nom si existeix
    const nom = nomUsuari ? `, ${nomUsuari}` : '';
    
    if (hores >= 0 && hores < 6) {
        salutacio = {
            titol: 'Bona matinada' + nom,
            missatge: 'Hora tranquil·la per analitzar models',
            icona: METEOCONS.matinada,
            color: '#1a1a2e'
        };
    }
    else if (hores >= 6 && hores < 12) {
        salutacio = {
            titol: 'Bon dia' + nom,
            missatge: 'Revisa les condicions per avui',
            icona: METEOCONS.mati,
            color: '#FF8C00'
        };
    }
    else if (hores >= 12 && hores < 17) {
        salutacio = {
            titol: 'Bona tarda' + nom,
            missatge: 'Hora de màxima activitat convectiva',
            icona: METEOCONS.migdia,
            color: '#FF4500'
        };
    }
    else if (hores >= 17 && hores < 22) {
        salutacio = {
            titol: 'Bon vespre' + nom,
            missatge: 'Les tempestes de tarda són les més intenses',
            icona: METEOCONS.tarda,
            color: '#FF6347'
        };
    }
    else {
        salutacio = {
            titol: 'Bona nit' + nom,
            missatge: 'Les tempestes nocturnes poden ser importants',
            icona: METEOCONS.nit,
            color: '#4B0082'
        };
    }
    
    return salutacio;
}

// ─── CREAR I MOSTRAR BENVINGUDA ────────────────────────────────────

async function mostrarBenvinguda() {
    const nomUsuari = await obtenirNomUsuariBenvinguda();
    const salutacio = obtenirSalutacio(nomUsuari);
    const hora = obtenirHoraMadrid();
    
    // Crear contenidor
    const contenidor = document.createElement('div');
    contenidor.id = 'benvinguda_' + Date.now();
    
    // Estils
    contenidor.style.cssText = `
        position: fixed;
        z-index: 9999;
        background: linear-gradient(135deg, ${salutacio.color} 0%, #0f1a2e 100%);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 14px;
        padding: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        animation: benvingudaSlideIn 0.6s ease-out;
        cursor: pointer;
        max-width: 320px;
        width: calc(100% - 30px);
        font-family: 'Segoe UI', Tahoma, sans-serif;
    `;
    
    // Posició
    const width = window.innerWidth;
    if (width < 480) {
        contenidor.style.cssText += `
            top: 10px;
            right: 10px;
            left: 10px;
        `;
    } else {
        contenidor.style.cssText += `
            top: 15px;
            right: 15px;
        `;
    }
    
    // Animacions CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes benvingudaSlideIn {
            0% { transform: translateY(-100%); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes benvingudaSlideOut {
            0% { transform: translateY(0); opacity: 1; }
            100% { transform: translateY(-100%); opacity: 0; }
        }
        @keyframes benvingudaPulse {
            0%, 100% { box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
            50% { box-shadow: 0 8px 40px rgba(255,255,255,0.3); }
        }
        @keyframes iconaFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }
    `;
    
    if (!document.querySelector('#benvingudaStyles')) {
        style.id = 'benvingudaStyles';
        document.head.appendChild(style);
    }
    
    // Contingut HTML compacte amb icona Meteocons
    contenidor.innerHTML = `
        <div style="
            display: flex;
            align-items: center;
            gap: 12px;
        ">
            <div style="
                width: 45px;
                height: 45px;
                flex-shrink: 0;
                animation: iconaFloat 2s ease-in-out infinite;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
            ">
                <img src="${salutacio.icona}" 
                     alt="${salutacio.titol}" 
                     style="
                         width: 100%;
                         height: 100%;
                         object-fit: contain;
                         filter: brightness(0) invert(1);
                     " 
                     onerror="this.style.display='none'">
            </div>
            
            <div style="flex: 1; min-width: 0;">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 4px;
                ">
                    <h3 style="
                        margin: 0;
                        color: white;
                        font-size: 17px;
                        font-weight: 700;
                        text-shadow: 0 1px 3px rgba(0,0,0,0.3);
                    ">
                        ${salutacio.titol}
                    </h3>
                    <button onclick="event.stopPropagation(); this.closest('[id^=benvinguda_]').remove()" style="
                        background: rgba(255,255,255,0.15);
                        border: none;
                        color: white;
                        width: 22px;
                        height: 22px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 11px;
                        transition: all 0.2s;
                        flex-shrink: 0;
                    " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
                       onmouseout="this.style.background='rgba(255,255,255,0.15)'">✕</button>
                </div>
                
                <p style="
                    margin: 0;
                    color: rgba(255,255,255,0.85);
                    font-size: 13px;
                    font-weight: 500;
                    line-height: 1.3;
                ">
                    ${salutacio.missatge}
                </p>
                
                <span style="
                    color: rgba(255,255,255,0.4);
                    font-size: 9px;
                    display: block;
                    margin-top: 4px;
                ">
                    ${hora.toLocaleTimeString('ca-ES', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        timeZone: 'Europe/Madrid'
                    })} · Cada visita és nova
                </span>
            </div>
        </div>
    `;
    
    // Efecte hover
    contenidor.addEventListener('mouseenter', () => {
        contenidor.style.animation = 'benvingudaPulse 2s infinite';
    });
    
    contenidor.addEventListener('mouseleave', () => {
        contenidor.style.animation = '';
    });
    
    // Click per tancar
    contenidor.addEventListener('click', () => {
        tancarBenvinguda(contenidor);
    });
    
    document.body.appendChild(contenidor);
    
    // Auto-tancar
    setTimeout(() => {
        tancarBenvinguda(contenidor);
    }, BENVINGUDA.timeout);
}

// ─── TANCAR BENVINGUDA ─────────────────────────────────────────────

function tancarBenvinguda(element) {
    if (!element || !element.parentNode) return;
    
    element.style.animation = 'benvingudaSlideOut 0.5s ease-in';
    
    setTimeout(() => {
        if (element.parentNode) {
            element.remove();
        }
    }, 500);
}

// ─── INICIALITZAR ──────────────────────────────────────────────────

async function inicialitzarBenvinguda() {
    const hora = obtenirHoraMadrid();
    
    // Esperar una mica més perquè el login es processi
    setTimeout(async () => {
        await mostrarBenvinguda();
    }, 2000);
}

// ─── EXPOSAR FUNCIONS ─────────────────────────────────────────────

window.mostrarBenvinguda = mostrarBenvinguda;
window.obtenirSalutacio = obtenirSalutacio;
window.inicialitzarBenvinguda = inicialitzarBenvinguda;

// Auto-inicialitzar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        inicialitzarBenvinguda();
    });
} else {
    inicialitzarBenvinguda();
}