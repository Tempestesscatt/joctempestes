// ═══════════════════════════════════════════════════════════════════════
//  ACCESVARIABLE.JS — Login obligatori + suport per variables premium
// ═══════════════════════════════════════════════════════════════════════

// Variables lliures: sense login ni subscripció.
// La classificació Entusiasta/Professional es resol a premium.js / mapaspng.js.
const PARAMETRES_LLIURES = new Set([
    // Temperatura i humitat
    'st', 'sd', 'srh', 'sh2', 'feels_like',
    'temp_min2m', 'temp_max2m',

    // Vent habitual, incloses les ratxes
    'wind_speed_10m', 'wind_gust',
    'wind_speed_gust_specific_height_level_above_ground',

    // Pressió
    'pressure_msl', 'sp',

    // Precipitació acumulada i neu bàsica (precipitació específica d'1 h: Entusiasta)
    'tp', 'neige_ground', 'tsnowp',
    'snow_depth_ground_or_water_surface',
    'water_equivalent_accumulated_snow_ground_or_water_surface',
    'hteurneige_ground', 'hteuneige_ground', 'hterneige_ground',
    'neige_sc_ground', 'resr_neige_ground', 'rr_sol_gele_ground',

    // Núvols generals: gratuïts
    'total_cloud_cover_ground_or_water_surface',
    'low_cloud_cover', 'medium_cloud_cover', 'high_cloud_cover',
    'base_nuage_ground', 'plafond_ground',
    'bt_channels_62', // Vapor d'aigua (6,2 µm); només BT10 és Entusiasta

    // CAPE i CIN bàsics
    'cape', 'convective_inhibition_ground_or_water_surface',

    // Altures i camps atmosfèrics/isotermes generals
    'altitude_iso_t_27315',
    'altitude_iso_tpw_27315', 'altitude_iso_tpw_27415',
    'altitude_iso_tpw_27465',
    'tpw_isobaric_850', 'thetav_isobaric_850',
]);

function esParametreLliure(paramName) {
    if (!paramName) return false;
    const base = String(paramName).replace(/_\d+$/, '');
    return PARAMETRES_LLIURES.has(paramName) || PARAMETRES_LLIURES.has(base);
}

function amagarOverlay() {
    const overlay = document.getElementById('mapLockOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.innerHTML = '';
    }
    const mapa = document.getElementById('map');
    if (mapa) {
        mapa.style.opacity = '1';
        mapa.style.pointerEvents = 'auto';
    }
}

function mostrarAvisLogin(paramName) {
    const overlay = document.getElementById('mapLockOverlay');
    if (!overlay) {
        alert('Inicia sessió per veure: ' + paramName);
        return;
    }

    let nomVariable = paramName;
    if (typeof getPaleta === 'function') {
        const pal = getPaleta(paramName);
        if (pal && pal.titol) nomVariable = pal.titol;
    }

    overlay.style.display = 'flex';
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.8)';
    overlay.style.zIndex = '9999';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const mapa = document.getElementById('map');
    if (mapa) {
        mapa.style.opacity = '0.15';
        mapa.style.pointerEvents = 'none';
    }

    overlay.innerHTML = `
        <div style="
            background: #0d1826;
            border: 2px solid #3ea6ff;
            border-radius: 14px;
            padding: 30px 25px;
            max-width: 400px;
            width: 90%;
            text-align: center;
            box-shadow: 0 12px 40px rgba(0,0,0,0.9);
        ">
            <div style="font-size:40px; margin-bottom:15px;">
                <i class="fas fa-lock" style="color:#3ea6ff;"></i>
            </div>
            <h3 style="color:#3ea6ff; font-size:20px; margin:0 0 10px;">
                Inicia sessió
            </h3>
            <p style="color:#b0c0d0; font-size:14px; margin:0 0 20px;">
                <strong style="color:#3ea6ff;">${nomVariable}</strong>
                requereix iniciar sessió.
            </p>
            <button onclick="loginWithGoogle()" style="
                background: #2a5a8a;
                color: #fff;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 14px;
                cursor: pointer;
            ">
                <i class="fab fa-google"></i> Iniciar sessió amb Google
            </button>
        </div>
    `;
}

// Funció principal de verificació d'accés
window.verificarAccesVariable = function(paramName) {
    const user = window._firebaseUser || null;

    // 1. Variables lliures: accés sempre permès, fins i tot sense login.
    if (esParametreLliure(paramName)) {
        amagarOverlay();
        return true;
    }

    // 2. Qualsevol altra variable requereix iniciar sessió.
    if (!user) {
        mostrarAvisLogin(paramName);
        return false;
    }

    // 3. Si és premium, delegar la comprovació del pla a premium.js.
    if (typeof window.esParametrePremium === 'function' &&
        window.esParametrePremium(paramName)) {
        if (typeof window.comprovarPremiumPerUID === 'function') {
            const isPremium = window.comprovarPremiumPerUID();
            if (isPremium) {
                amagarOverlay();
                return true;
            }
            if (typeof window.mostrarAvisPremium === 'function') {
                window.mostrarAvisPremium(paramName);
            }
            return false;
        }
        // Si no hi ha comprovador premium carregat, no concedim accés per error.
        return false;
    }

    // 4. Usuari registrat i variable no premium: accés permès.
    amagarOverlay();
    return true;
};

window.tancarBloqueig = function() {
    amagarOverlay();
};

window.esParametreLliure = esParametreLliure;
window.amagarOverlay = amagarOverlay;

window.addEventListener('tc:login', function() {
    amagarOverlay();
});

window.addEventListener('tc:logout', function() {
    amagarOverlay();
    if (typeof seleccionarVariable === 'function') {
        seleccionarVariable('st', true);
    }
});