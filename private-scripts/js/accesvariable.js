// ═══════════════════════════════════════════════════════════════════════
//  ACCESVARIABLE.JS — Login obligatori + Suport per variables premium
// ═══════════════════════════════════════════════════════════════════════

// Variables lliures (sense login)
const PARAMETRES_LLIURES = new Set([
    'st', 'sd', 'srh', 'temp_min2m', 'temp_max2m', 'wind_speed_10m', 'wind_gust'
]);

function esParametreLliure(paramName) {
    if (!paramName) return false;
    const base = paramName.replace(/_\d+$/, '');
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

// Funció principal de verificació
window.verificarAccesVariable = function(paramName) {
    const user = window._firebaseUser || null;
    
    // 1. Si és lliure → permès sempre
    if (esParametreLliure(paramName)) {
        amagarOverlay();
        return true;
    }
    
    // 2. Si NO és lliure i no hi ha usuari → bloquejar amb login
    if (!user) {
        mostrarAvisLogin(paramName);
        return false;
    }
    
    // 3. Si és PREMIUM → delegar a premium.js
    if (typeof window.esParametrePremium === 'function' && window.esParametrePremium(paramName)) {
        if (typeof window.comprovarPremiumPerUID === 'function') {
            const isPremium = window.comprovarPremiumPerUID();
            if (isPremium) {
                amagarOverlay();
                return true;
            } else {
                if (typeof window.mostrarAvisPremium === 'function') {
                    window.mostrarAvisPremium(paramName);
                }
                return false;
            }
        }
    }
    
    // 4. Usuari loguejat, no premium → permès
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