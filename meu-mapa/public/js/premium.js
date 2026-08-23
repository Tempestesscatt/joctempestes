// ═══════════════════════════════════════════════════════════════════════
//  PREMIUM.JS — Accés exclusiu per UID a variables empresarials
//  Variables: SCP (risc supercèl·lula) i Calamarsa (mida aprox.)
// ═══════════════════════════════════════════════════════════════════════

// Variables que requereixen accés EMPRESARIAL (a més de login)
const VARIABLES_PREMIUM = new Set([
    // ÍNDEXS DE TEMPESTES SEVERES
    'scp',          // SCP - Supercell Composite Parameter (risc de supercèl·lula)
    'scp_wcs',      // SCP - Versió de Météo-France
    'stp',          // STP - Significant Tornado Parameter (risc de tornado EF2+)
    'ehi',          // EHI - Energy Helicity Index (risc de tornado)
    'hail_cm',      // Calamarsa - Mida aprox. en cm
    
    // SHEAR I SRH (nivells superiors)
    'srh_03',       // SRH 0-3km
    'shear_03',     // Shear 0-3km
    

    'lfc_m',        // LFC - Level of Free Convection (alçada)
    'lifted_index', // Lifted Index (estabilitat)
    'el_m',         // EL - Equilibrium Level (alçada)
    
    // NÚVOLS I PRECIPITACIÓ ESPECÍFICA
    'ciwc_500',     // Gel núvols @500hPa (per a tempestes)
    'cld_rain_850', // Pluja núvols @850hPa (per a tempestes)
   
  
    'thetav_850',   // Theta virtual @850hPa (inestabilitat)
    
    // REFLECTIVITAT I RADAR
    'radar_dbz',    // Radar simulat (reflectivitat)
    'REFLECTIVITY_MAX__GROUND_OR_WATER_SURFACE',       // Reflectivitat WCS
  
    
    // WCS 3D MITJANA (variables avançades)
    'CIWC_MITJANA',     // Gel núvols (mitjana 925-300hPa)
    'CLD_RAIN_MITJANA', // Pluja núvols (mitjana 925-300hPa)
    'TPW_MITJANA',      // Aigua precipitable (mitjana 925-300hPa)
    
    // WCS 3D PV SURFACES
    'GEOPOTENTIAL_PV1500',
    'GEOPOTENTIAL_PV2000',
    'THETA_PV1500',
    'THETA_PV2000',
    'U_PV1500',
    'U_PV2000',
    'V_PV1500',
    'V_PV2000',
    'WIND_PV1500',
    'WIND_PV2000',
    
    // WCS 3D ISOTERMES
    'ALTITUDE_ISOTERMA_0C',
    'ALTITUDE_ISOTERMA_M10C',
]);

// UIDs amb accés empresarial
const UIDS_PREMIUM = new Set([
    '86Ljz4YlGag8w6BxJpziaxD3cX92',
    'zD8SlXoDNOQCboc0JQ3zCnFza9W2',
    'xdkTCZMnsOS29WxJ3DqMccN8iYW2',
    'VWM3W2Gi66UEHkJFPa0R0OQj27C3',
    'euwB3lQCVWVih7fqb8Gkmf86ffX2',
    'xESlMcddSgWNW8g5zoK6YDkFklW2',
    'xqrOr8v1awb11l5LUsxo7bkGP622'
    
]);

function esParametrePremium(paramName) {
    if (!paramName) return false;
    const base = paramName.replace(/_\d+$/, '');
    return VARIABLES_PREMIUM.has(paramName) || VARIABLES_PREMIUM.has(base);
}

function comprovarPremiumPerUID() {
    const user = window._firebaseUser;
    if (!user || !user.uid) return false;
    const isPremium = UIDS_PREMIUM.has(user.uid);
    console.log('[Empresa] UID:', user.uid, '→ Accés:', isPremium);
    return isPremium;
}

// Comptar membres actius (excloent strings buits)
function comptarMembresActius() {
    let count = 0;
    UIDS_PREMIUM.forEach(uid => {
        if (uid && uid.trim() !== '') count++;
    });
    return count;
}

function mostrarAvisPremium(paramName) {
    const overlay = document.getElementById('mapLockOverlay');
    if (!overlay) return;
    
    let nomVariable = paramName;
    if (typeof getPaleta === 'function') {
        const pal = getPaleta(paramName);
        if (pal && pal.titol) nomVariable = pal.titol;
    }
    
    const numMembres = comptarMembresActius();
    
    overlay.style.display = 'flex';
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.zIndex = '9999';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    
    // Fons amb imatge desenfocada
    overlay.style.background = 'url("https://thumbs.dreamstime.com/b/surreal-image-depicts-celestial-sky-filled-fluffy-clouds-glowing-mathematical-formulas-symbols-abstract-437262557.jpg") center/cover no-repeat';
    overlay.style.backdropFilter = 'blur(8px)';
    overlay.style.webkitBackdropFilter = 'blur(8px)';
    
    const mapa = document.getElementById('map');
    if (mapa) {
        mapa.style.opacity = '0.15';
        mapa.style.pointerEvents = 'none';
    }
    
    overlay.innerHTML = `
        <div style="
            background: rgba(13, 24, 38, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 2px solid #FF8C00;
            border-radius: 18px;
            padding: 35px 30px;
            max-width: 420px;
            width: 90%;
            text-align: center;
            box-shadow: 0 15px 50px rgba(0,0,0,0.95), 0 0 30px rgba(255,140,0,0.3);
            animation: fadeInScale 0.4s ease-out;
        ">
            <style>
                @keyframes fadeInScale {
                    0% { opacity: 0; transform: scale(0.85); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes pulseGlow {
                    0%, 100% { box-shadow: 0 0 20px rgba(255,140,0,0.4); }
                    50% { box-shadow: 0 0 40px rgba(255,140,0,0.8); }
                }
                .premium-icon {
                    width: 70px;
                    height: 70px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #FF8C00, #FF4500);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                    animation: pulseGlow 2s infinite;
                    font-size: 30px;
                    color: #fff;
                    font-weight: bold;
                }
                .premium-btn {
                    background: linear-gradient(135deg, #FF8C00, #FF4500);
                    color: #fff;
                    border: none;
                    padding: 14px 30px;
                    border-radius: 10px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    letter-spacing: 0.5px;
                    box-shadow: 0 4px 15px rgba(255,140,0,0.4);
                }
                .premium-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(255,140,0,0.6);
                    background: linear-gradient(135deg, #FF9A20, #FF5500);
                }
                .feature-item {
                    transition: all 0.3s ease;
                }
                .feature-item:hover {
                    background: rgba(255,140,0,0.15);
                    transform: translateX(5px);
                }
            </style>
            
            <div class="premium-icon">🔒</div>
            
            <h3 style="
                color: #FF8C00; 
                font-size: 24px; 
                margin: 0 0 12px;
                font-weight: 700;
                letter-spacing: 1px;
            ">
                ACCÉS PRIVAT
            </h3>
            
            <p style="color: #c0d0e0; font-size: 15px; margin: 0 0 8px; line-height: 1.5;">
                <strong style="color: #FF8C00;">${nomVariable}</strong> 
                és una variable exclusiva
            </p>
            <p style="color: #90a0b0; font-size: 13px; margin: 0 0 25px;">
                per membres interns autoritzats
            </p>
            
            <div style="
                display: flex;
                flex-direction: column;
                gap: 6px;
                margin-bottom: 25px;
                text-align: left;
                padding: 16px;
                background: rgba(255,255,255,0.06);
                border-radius: 12px;
                border: 1px solid rgba(255,140,0,0.3);
            ">
                <span class="feature-item" style="color:#d0e0f0; font-size:13px; padding: 6px 8px; border-radius: 6px;">
                    <span style="color:#FF8C00; font-weight:bold; margin-right:8px;">▸</span> 
                    SCP - Risc supercèl·lula
                </span>
                <span class="feature-item" style="color:#d0e0f0; font-size:13px; padding: 6px 8px; border-radius: 6px;">
                    <span style="color:#FF8C00; font-weight:bold; margin-right:8px;">▸</span> 
                    Calamarsa - Mida aprox.
                </span>
                <span class="feature-item" style="color:#d0e0f0; font-size:13px; padding: 6px 8px; border-radius: 6px;">
                    <span style="color:#FF8C00; font-weight:bold; margin-right:8px;">▸</span> 
                    Radar - Reflectivitat dBZ
                </span>
                <span class="feature-item" style="color:#d0e0f0; font-size:13px; padding: 6px 8px; border-radius: 6px;">
                    <span style="color:#FF8C00; font-weight:bold; margin-right:8px;">▸</span> 
                    WCS 3D - Núvols i PV
                </span>
            </div>
            
            <button onclick="window.tancarBloqueig()" class="premium-btn">
                TANCAR AVÍS
            </button>
            
            <div style="
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px solid rgba(255,255,255,0.1);
            ">
                <p style="color:#556680; font-size:11px; margin:0;">
                    <span style="color:#FF8C00; font-weight:bold; font-size:13px;">${numMembres}</span> 
                    membres amb accés actiu
                </p>
            </div>
        </div>
    `;
}

// Exposar funcions
window.esParametrePremium = esParametrePremium;
window.comprovarPremiumPerUID = comprovarPremiumPerUID;
window.mostrarAvisPremium = mostrarAvisPremium;
window.comptarMembresActius = comptarMembresActius;

console.log('[Empresa] Carregat | Variables:', [...VARIABLES_PREMIUM].join(', '));
console.log('[Empresa] UIDs autoritzats:', [...UIDS_PREMIUM].join(', '));
console.log('[Empresa] Membres actius:', comptarMembresActius());