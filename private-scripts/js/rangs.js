(function() {
    'use strict';

    if (window._RANGS_LOADED) return;
    window._RANGS_LOADED = true;

    const CONFIG = {
        MAX_RATE: 100,          // punts/hora al començament (p=0) — enganxa ràpid
        MIN_RATE: 8,            // punts/hora asimptòtic al final del tot — grind molt llarg
        DECAY_TAU: 22000,       // constant de decaïment (punts). Més petit = decau més rapid = mes dur al final
        TICK_INTERVAL: 3000,
        LEVEL_STEP: 500,
        MAX_LEVEL: 100000,

        // ── LÍMITS DE PROGRÉS OFFLINE (molt restrictius) ──
        MAX_OFFLINE_MINUTES: 10,        // maxim de temps offline que compta (abans: 60 min)
        OFFLINE_COOLDOWN_MS: 30 * 60000, // nomes es pot cobrar "offline" un cop cada 30 min reals,
                                          // evita que tancar/obrir moltes vegades seguides sumi cada cop

        MAX_IDLE_MINUTES: 15,
        MAX_TICK_GAP_MS: 10000,
        STORAGE_KEY_PREFIX: 'tempestescat_rangs_',
        SESSION_START_KEY: 'tempestescat_rangs_session',
        LAST_OFFLINE_CLAIM_KEY: 'tempestescat_rangs_offline_claim',
        OBSERVER_DEBOUNCE_MS: 300,          // espera d'inactivitat abans de re-escanejar el DOM
        OBSERVER_SCOPE_SELECTORS: [          // contenidors preferits a observar (en lloc de tot body)
            '#observacions', '.obs-list', '.observations-list',
            '#comentaris', '.comments-list', '.comment-list',
            '.container','#xatModalMsgs' 
        ]
    };

    const RARITY_LABEL = {
        common: '',
        uncommon: 'Poc Comú',
        rare: 'Rar',
        epic: 'Èpic',
        legendary: 'Llegendari',
        mythic: 'Mític'
    };

    // ============================================================
    // UTILITATS DE COLOR
    // ============================================================
    function hexToRgb(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const num = parseInt(hex, 16);
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    }
    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
    }
    function lerpColor(hexA, hexB, t) {
        const a = hexToRgb(hexA), b = hexToRgb(hexB);
        return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
    }
    function lightenColor(hex, percent) {
        const { r, g, b } = hexToRgb(hex);
        const amt = percent / 100;
        return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
    }

    // ============================================================
    // ERES DE RANGS — 24 categories temàtiques que cobreixen 0-100.000
    // Ara amb un tier CADA 500 PUNTS EXACTES (200 tiers en total) i
    // un qualificador únic per cada tier (sense numeració romana).
    // ============================================================
const ERES = [
  { nom: 'Nouvingut', desde: 0, fins: 500,
    colorStart: '#556680', colorEnd: '#556680', rarity: 'common',
    icons: ['fa-solid fa-seedling'],
    qualificadors: ['Curiós'] },

  { nom: 'Aprenent del Cel', desde: 500, fins: 2000,
    colorStart: '#5c7a99', colorEnd: '#7f9cc0', rarity: 'common',
    icons: ['fa-solid fa-cloud', 'fa-solid fa-cloud-sun', 'fa-solid fa-binoculars', 'fa-solid fa-compass'],
    qualificadors: ['Primerenc', 'Despert', 'Atent', 'Interessat', 'Constant', 'Dedicat'] },

  { nom: 'Novici del Núvol', desde: 2000, fins: 4500,
    colorStart: '#527aa8', colorEnd: '#6f92c8', rarity: 'common',
    icons: ['fa-solid fa-cloud', 'fa-solid fa-umbrella', 'fa-solid fa-water', 'fa-solid fa-droplet'],
    qualificadors: ['Iniciat', 'Perseverant', 'Enfocat', 'Hàbil', 'Segur'] },

  { nom: 'Observador de Núvols', desde: 4500, fins: 8000,
    colorStart: '#5a92cf', colorEnd: '#4f7fe0', rarity: 'common',
    icons: ['fa-solid fa-cloud', 'fa-solid fa-magnifying-glass', 'fa-solid fa-eye', 'fa-solid fa-camera', 'fa-solid fa-cloud-sun-rain', 'fa-solid fa-map-location-dot'],
    qualificadors: ['Meticulós', 'Agut', 'Perspicaç', 'Rigorós', 'Metòdic', 'Precís', 'Expert'] },

  { nom: 'Explorador Atmosfèric', desde: 8000, fins: 12000,
    colorStart: '#4a86d6', colorEnd: '#3d8bea', rarity: 'common',
    icons: ['fa-solid fa-compass', 'fa-solid fa-map', 'fa-solid fa-binoculars', 'fa-solid fa-route'],
    qualificadors: ['Aventurer', 'Intrèpid', 'Audaç', 'Resolt', 'Incansable', 'Temerari', 'Destre'] },

  { nom: 'Vigia del Cel', desde: 12000, fins: 17000,
    colorStart: '#3d8bea', colorEnd: '#2f74e6', rarity: 'uncommon',
    icons: ['fa-solid fa-cloud-showers-water', 'fa-solid fa-satellite', 'fa-solid fa-tower-observation', 'fa-solid fa-video', 'fa-solid fa-cloud-bolt', 'fa-solid fa-radar', 'fa-solid fa-wave-square'],
    qualificadors: ['Alerta', 'Vigilant', 'Incorruptible', 'Insomne', 'Custodi', 'Sentinella', 'Guardià', 'Ferm', 'Inquebrantable', 'Impertèrrit'] },

  { nom: 'Caçatempestes Novell', desde: 17000, fins: 22000,
    colorStart: '#22a0e8', colorEnd: '#1487df', rarity: 'uncommon',
    icons: ['fa-solid fa-car-side', 'fa-solid fa-road', 'fa-solid fa-signal', 'fa-solid fa-cloud-showers-heavy', 'fa-solid fa-triangle-exclamation', 'fa-solid fa-bolt', 'fa-solid fa-wind'],
    qualificadors: ['Novell', 'Impetuós', 'Arriscat', 'Decidit', 'Trepidant', 'Impulsiu', 'Fervent', 'Ardent', 'Encoratjat', 'Valent'] },

  { nom: 'Caçatempestes Actiu', desde: 22000, fins: 27000,
    colorStart: '#1a97de', colorEnd: '#1280d0', rarity: 'uncommon',
    icons: ['fa-solid fa-car-side', 'fa-solid fa-gauge', 'fa-solid fa-signal', 'fa-solid fa-cloud-showers-heavy', 'fa-solid fa-bolt', 'fa-solid fa-wind'],
    qualificadors: ['Curtit', 'Veterà', 'Implacable', 'Destre', 'Àgil', 'Astut', 'Precís', 'Letal', 'Ferotge', 'Salvatge'] },

  { nom: 'Rastrejador de Tempestes', desde: 27000, fins: 33000,
    colorStart: '#12b3c4', colorEnd: '#0d97b0', rarity: 'uncommon',
    icons: ['fa-solid fa-satellite-dish', 'fa-solid fa-tower-cell', 'fa-solid fa-broadcast-tower', 'fa-solid fa-signal-stream', 'fa-solid fa-tv', 'fa-solid fa-chart-area', 'fa-solid fa-route', 'fa-solid fa-map-pin'],
    qualificadors: ['Instintiu', 'Calculat', 'Sagaç', 'Estratega', 'Lúcid', 'Meticulós', 'Tàctic', 'Infalible', 'Metòdic', 'Sistemàtic', 'Analític', 'Científic'] },

  { nom: 'Lector de Radar', desde: 33000, fins: 39000,
    colorStart: '#16c2a0', colorEnd: '#0fa588', rarity: 'rare',
    icons: ['fa-solid fa-wave-square', 'fa-solid fa-radar', 'fa-solid fa-chart-line', 'fa-solid fa-laptop-code', 'fa-solid fa-diagram-project', 'fa-solid fa-table-cells', 'fa-solid fa-microchip', 'fa-solid fa-server'],
    qualificadors: ['Perspicaç', 'Detallista', 'Expert', 'Especialitzat', 'Refinat', 'Depurat', 'Avançat', 'Superior', 'Virtuós', 'Mestre', 'Eminent', 'Il·lustre'] },

  { nom: 'Tècnic de Radar', desde: 39000, fins: 44000,
    colorStart: '#12ae95', colorEnd: '#0c9a80', rarity: 'rare',
    icons: ['fa-solid fa-satellite-dish', 'fa-solid fa-wave-square', 'fa-solid fa-server', 'fa-solid fa-microchip'],
    qualificadors: ['Certificat', 'Acreditat', 'Reconegut', 'Consagrat', 'Titulat', 'Diplomat', 'Competent', 'Solvent', 'Fiable', 'Rigorós'] },

  { nom: 'Analista Atmosfèric', desde: 44000, fins: 50000,
    colorStart: '#3fc06a', colorEnd: '#2c9f4e', rarity: 'rare',
    icons: ['fa-solid fa-chart-line', 'fa-solid fa-calculator', 'fa-solid fa-brain', 'fa-solid fa-flask', 'fa-solid fa-microscope', 'fa-solid fa-vial', 'fa-solid fa-clipboard-list', 'fa-solid fa-list-check', 'fa-solid fa-hourglass-half'],
    qualificadors: ['Brillant', 'Erudit', 'Sagaç', 'Perspicaç', 'Cerebral', 'Analític', 'Metòdic', 'Científic', 'Exhaustiu', 'Sistemàtic', 'Rigorós', 'Precís'] },

  { nom: 'Analista Sènior', desde: 50000, fins: 55000,
    colorStart: '#5cb833', colorEnd: '#79c11f', rarity: 'rare',
    icons: ['fa-solid fa-chart-line', 'fa-solid fa-brain', 'fa-solid fa-microscope', 'fa-solid fa-list-check'],
    qualificadors: ['Sènior', 'Consolidat', 'Referent', 'Autoritat', 'Consagrat', 'Prestigiós', 'Renomenat', 'Distingit', 'Eminent', 'Il·lustre'] },

  { nom: 'Predictor del Temps', desde: 55000, fins: 61000,
    colorStart: '#a8cc2e', colorEnd: '#d1b81c', rarity: 'rare',
    icons: ['fa-solid fa-wand-magic-sparkles', 'fa-solid fa-bullseye', 'fa-solid fa-cloud-sun-rain', 'fa-solid fa-clock', 'fa-solid fa-stopwatch', 'fa-solid fa-crystal-ball', 'fa-solid fa-chart-area', 'fa-solid fa-cloud', 'fa-solid fa-star'],
    qualificadors: ['Encertat', 'Infal·lible', 'Visionari', 'Clarident', 'Perspicaç', 'Precís', 'Certer', 'Endevinaire', 'Oracular', 'Profètic', 'Lúcid', 'Sagaç'] },

  { nom: 'Predictor Expert', desde: 61000, fins: 66000,
    colorStart: '#d4c418', colorEnd: '#e8b616', rarity: 'epic',
    icons: ['fa-solid fa-bullseye', 'fa-solid fa-crystal-ball', 'fa-solid fa-chart-area', 'fa-solid fa-star'],
    qualificadors: ['Expert', 'Magistral', 'Sublim', 'Excels', 'Suprem', 'Eminent', 'Virtuós', 'Genial', 'Prodigiós', 'Extraordinari'] },

  { nom: 'Meteoròleg', desde: 66000, fins: 72000,
    colorStart: '#e8b620', colorEnd: '#e8900f', rarity: 'epic',
    icons: ['fa-solid fa-sun', 'fa-solid fa-graduation-cap', 'fa-solid fa-book-open', 'fa-solid fa-chalkboard', 'fa-solid fa-award', 'fa-solid fa-temperature-half', 'fa-solid fa-medal', 'fa-solid fa-star', 'fa-solid fa-trophy'],
    qualificadors: ['Titulat', 'Acadèmic', 'Doctorat', 'Catedràtic', 'Erudit', 'Savi', 'Mestre', 'Professor', 'Autoritat', 'Referent', 'Prestigiós', 'Consagrat'] },

  { nom: 'Meteoròleg Expert', desde: 72000, fins: 78000,
    colorStart: '#e87c14', colorEnd: '#e2560f', rarity: 'epic',
    icons: ['fa-solid fa-fire', 'fa-solid fa-mountain-sun', 'fa-solid fa-wind', 'fa-solid fa-compass-drafting', 'fa-solid fa-binoculars', 'fa-solid fa-flag', 'fa-solid fa-location-crosshairs', 'fa-solid fa-tower-observation'],
    qualificadors: ['Endurit', 'Temprat', 'Forjat', 'Foguejat', 'Curtit', 'Implacable', 'Indomable', 'Invencible', 'Aferrissat', 'Incombustible', 'Indestructible', 'Impertèrrit'] },

  { nom: 'Vigilant Atmosfèric', desde: 78000, fins: 83000,
    colorStart: '#e2481d', colorEnd: '#d42a2a', rarity: 'epic',
    icons: ['fa-solid fa-mountain', 'fa-solid fa-tornado', 'fa-solid fa-hurricane', 'fa-solid fa-gauge-high', 'fa-solid fa-bolt', 'fa-solid fa-cloud-bolt', 'fa-solid fa-radiation'],
    qualificadors: ['Fèrri', 'Implacable', 'Inexorable', 'Despietat', 'Ferotge', 'Aclaparador', 'Devastador', 'Colossal', 'Titànic', 'Descomunal'] },

  { nom: 'Especialista Climàtic', desde: 83000, fins: 88000,
    colorStart: '#d81f66', colorEnd: '#c00e96', rarity: 'epic',
    icons: ['fa-solid fa-earth-europe', 'fa-solid fa-globe', 'fa-solid fa-book-atlas', 'fa-solid fa-shield-halved', 'fa-solid fa-ranking-star', 'fa-solid fa-trophy'],
    qualificadors: ['Global', 'Universal', 'Il·limitat', 'Transcendent', 'Suprem', 'Sobirà', 'Magne', 'Excels', 'Insigne', 'Egregi'] },

  { nom: 'Mestre dels Vents', desde: 88000, fins: 92000,
    colorStart: '#9a1fd0', colorEnd: '#6c1ee8', rarity: 'legendary',
    icons: ['fa-solid fa-tornado', 'fa-solid fa-wind', 'fa-solid fa-fan', 'fa-solid fa-hurricane', 'fa-solid fa-rotate', 'fa-solid fa-circle-notch'],
    qualificadors: ['Ancestral', 'Etern', 'Immemorial', 'Primigeni', 'Arcà', 'Mític', 'Llegendari', 'Fabulós'] },

  { nom: 'Mestre de Tempestes', desde: 92000, fins: 95500,
    colorStart: '#701fea', colorEnd: '#3d18f2', rarity: 'legendary',
    icons: ['fa-solid fa-cloud-bolt', 'fa-solid fa-bolt-lightning', 'fa-solid fa-cloud-showers-heavy', 'fa-solid fa-meteor', 'fa-solid fa-radiation'],
    qualificadors: ['Suprem', 'Omnipotent', 'Sobirà', 'Totpoderós', 'Diví', 'Celestial', 'Transcendent'] },

  { nom: 'Llegenda Meteorològica', desde: 95500, fins: 98000,
    colorStart: '#e01ea0', colorEnd: '#f23d78', rarity: 'legendary',
    icons: ['fa-solid fa-crown', 'fa-solid fa-trophy', 'fa-solid fa-star', 'fa-solid fa-gem'],
    qualificadors: ['Immortal', 'Eixampat', 'Gloriós', 'Radiant', 'Fulgurant', 'Resplendent'] },

  { nom: 'Titan Atmosfèric', desde: 98000, fins: 99500,
    colorStart: '#ffcf20', colorEnd: '#ff8a10', rarity: 'mythic',
    icons: ['fa-solid fa-hurricane', 'fa-solid fa-meteor', 'fa-solid fa-fire'],
    qualificadors: ['Colossal', 'Descomunal', 'Titànic'] },

  { nom: 'Déu de les Tempestes', desde: 99500, fins: 100000,
    colorStart: '#ffd700', colorEnd: '#fff4b0', rarity: 'mythic',
    icons: ['fa-solid fa-crown'],
    qualificadors: ['Etern', 'Suprem'] }
];

    // CONSTRUIR RANGS (200 nivells, cada 500 punts, 0-100000)
    const RANGS = {};
    ERES.forEach((era) => {
        const numTiers = Math.round((era.fins - era.desde) / CONFIG.LEVEL_STEP);
        for (let t = 0; t < numTiers; t++) {
            const llindar = era.desde + t * CONFIG.LEVEL_STEP;
            const qualificador = era.qualificadors[t % era.qualificadors.length];
            const nom = numTiers > 1 ? (qualificador + ' ' + era.nom) : era.nom;
            const color = lerpColor(era.colorStart, era.colorEnd, numTiers > 1 ? t / (numTiers - 1) : 0);
            RANGS[llindar] = {
                nom: nom,
                color: color,
                colorLight: lightenColor(color, 20),
                icon: era.icons[t % era.icons.length],
                baseNom: era.nom,
                tier: t + 1,
                totalTiers: numTiers,
                rarity: era.rarity
            };
        }
    });

    // OPTIMITZACIÓ: cachejar les claus ordenades UN COP, en comptes de
    // fer Object.keys(...).map(...).sort(...) cada cop que es consulta un rang.
    const CLAUS_ORDENADES = Object.keys(RANGS).map(Number).sort((a, b) => a - b);

    // ESTAT
    let punts = 0;
    let intervalId = null;
    let ultimRangNotificat = 0;
    let lastInteraction = Date.now();
    let isActive = true;
    let lastTickTime = Date.now();
    let ultimDesat = Date.now();
    let containerInjected = false;
    let mutationObserver = null;
    let etiquetesDebounceTimer = null;

    // FUNCIONS
    function detectarUsuari() {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.includes('firebase:authUser')) {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data && data.uid) return data.uid;
                }
            }
        } catch(e) {}
        let anonId = localStorage.getItem('tempestescat_anon_id');
        if (!anonId) {
            anonId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('tempestescat_anon_id', anonId);
        }
        return anonId;
    }

    function getStorageKey() {
        return CONFIG.STORAGE_KEY_PREFIX + detectarUsuari();
    }

    function getOfflineClaimKey() {
        return CONFIG.LAST_OFFLINE_CLAIM_KEY + '_' + detectarUsuari();
    }

    // Ritme de punts/hora segons els punts acumulats (decau exponencialment,
    // ara amb una TAU mes petita = cau mes rapid = els trams alts costen molt mes)
    function obtenirRate(p) {
        const clamped = Math.max(0, Math.min(p, CONFIG.MAX_LEVEL));
        return CONFIG.MIN_RATE + (CONFIG.MAX_RATE - CONFIG.MIN_RATE) * Math.exp(-clamped / CONFIG.DECAY_TAU);
    }

    function carregarDades() {
        try {
            const key = getStorageKey();
            const saved = localStorage.getItem(key);
            if (saved) {
                const data = JSON.parse(saved);
                punts = Math.min(data.punts || 0, CONFIG.MAX_LEVEL);
                ultimRangNotificat = data.ultimRangNotificat || 0;
            }

            // ── PROGRÉS OFFLINE, MOLT LIMITAT ──
            const savedSession = localStorage.getItem(CONFIG.SESSION_START_KEY);
            const ara = Date.now();
            const ultimClaim = parseInt(localStorage.getItem(getOfflineClaimKey()) || '0');
            const potReclamar = (ara - ultimClaim) >= CONFIG.OFFLINE_COOLDOWN_MS;

            if (savedSession && potReclamar) {
                const oldTimestamp = parseInt(savedSession);
                const offlineTimeMs = ara - oldTimestamp;
                const maxOfflineMs = CONFIG.MAX_OFFLINE_MINUTES * 60 * 1000;
                const tempsComputableMs = Math.min(offlineTimeMs, maxOfflineMs);

                if (tempsComputableMs > 0) {
                    const rateActual = obtenirRate(punts);
                    const offlinePunts = (tempsComputableMs / 3600000) * rateActual;
                    const capOffline = (CONFIG.MAX_OFFLINE_MINUTES / 60) * CONFIG.MAX_RATE;
                    if (offlinePunts > 0 && offlinePunts <= capOffline) {
                        punts = Math.round(Math.min(punts + offlinePunts, CONFIG.MAX_LEVEL) * 10) / 10;
                    }
                }
                localStorage.setItem(getOfflineClaimKey(), ara.toString());
            }

            lastTickTime = Date.now();
            lastInteraction = Date.now();
            desarDades();
        } catch (e) {
            punts = 0;
            lastTickTime = Date.now();
        }
    }

    function desarDades() {
        try {
            const key = getStorageKey();
            localStorage.setItem(key, JSON.stringify({
                punts: punts,
                ultimRangNotificat: ultimRangNotificat
            }));
            localStorage.setItem(CONFIG.SESSION_START_KEY, Date.now().toString());
        } catch (e) {}
    }

    function obtenirRang(p) {
        for (let i = CLAUS_ORDENADES.length - 1; i >= 0; i--) {
            if (p >= CLAUS_ORDENADES[i]) {
                const rang = RANGS[CLAUS_ORDENADES[i]];
                return {
                    nivell: CLAUS_ORDENADES[i],
                    ...rang,
                    nom: rang.nom || 'Nouvingut',
                    color: rang.color || '#556680',
                    colorLight: rang.colorLight || '#7f96c0',
                    icon: rang.icon || 'fa-solid fa-seedling',
                    baseNom: rang.baseNom || 'Nouvingut',
                    tier: rang.tier || 1,
                    totalTiers: rang.totalTiers || 1,
                    rarity: rang.rarity || 'common'
                };
            }
        }
        return {
            nivell: 0,
            nom: 'Nouvingut',
            color: '#556680',
            colorLight: '#7f96c0',
            icon: 'fa-solid fa-seedling',
            baseNom: 'Nouvingut',
            tier: 1,
            totalTiers: 1,
            rarity: 'common'
        };
    }

    function seguentLlindar(p) {
        for (let i = 0; i < CLAUS_ORDENADES.length; i++) {
            if (CLAUS_ORDENADES[i] > p) return CLAUS_ORDENADES[i];
        }
        return CONFIG.MAX_LEVEL;
    }

    function progressPercent(p) {
        if (p >= CONFIG.MAX_LEVEL) return 100;
        const nivellActual = Math.floor(p / CONFIG.LEVEL_STEP) * CONFIG.LEVEL_STEP;
        if (nivellActual >= CONFIG.MAX_LEVEL) return 100;
        const seguentNivell = Math.min(nivellActual + CONFIG.LEVEL_STEP, CONFIG.MAX_LEVEL);
        return ((p - nivellActual) / (seguentNivell - nivellActual)) * 100;
    }

    function formatPunts(p) {
        return p.toFixed(1).replace('.', ',');
    }

    // ============================================================
    // OBTENIR RANG PER USUARI (per etiquetes)
    // ============================================================
    function obtenirRangPerUsuari(uid) {
        try {
            const key = CONFIG.STORAGE_KEY_PREFIX + uid;
            const saved = localStorage.getItem(key);
            if (saved) {
                const data = JSON.parse(saved);
                const puntsUsuari = Math.min(data.punts || 0, CONFIG.MAX_LEVEL);
                return obtenirRang(puntsUsuari);
            }
        } catch(e) {}
        return obtenirRang(0);
    }

    // TICK
    function tick() {
        const ara = Date.now();
        const gap = ara - lastTickTime;
        lastTickTime = ara;
        const idleTime = (ara - lastInteraction) / 60000;
        if (idleTime > CONFIG.MAX_IDLE_MINUTES || !isActive) return;
        if (gap > CONFIG.MAX_TICK_GAP_MS || gap <= 0) return;
        const puntsAnteriors = punts;
        const rateActual = obtenirRate(punts);
        const puntsGuanyats = (gap / 3600000) * rateActual;
        punts = Math.round(Math.min(punts + puntsGuanyats, CONFIG.MAX_LEVEL) * 10) / 10;
        if (Math.abs(punts - puntsAnteriors) > 0.001) {
            actualitzarUI();
            comprovarRang(puntsAnteriors);
            actualitzarEtiquetes();
        }
    }

    function tickAmbDesat() {
        tick();
        if (Date.now() - ultimDesat > 30000) {
            desarDades();
            ultimDesat = Date.now();
        }
    }

    // NOTIFICACIONS
    function comprovarRang(puntsAnteriors) {
        const rangAnterior = obtenirRang(puntsAnteriors);
        const rangActual = obtenirRang(punts);
        if (rangActual.nivell > rangAnterior.nivell && rangActual.nivell > ultimRangNotificat) {
            ultimRangNotificat = rangActual.nivell;
            mostrarNotificacioRang(rangActual);
            desarDades();
        }
    }

    function mostrarNotificacioRang(rang) {
        window.dispatchEvent(new CustomEvent('nouRang', {
            detail: {
                nom: rang.nom,
                nivell: rang.nivell,
                color: rang.color,
                icon: rang.icon,
                baseNom: rang.baseNom,
                tier: rang.tier,
                totalTiers: rang.totalTiers,
                rarity: rang.rarity
            }
        }));

        const esEpic = rang.rarity === 'epic';
        const esTop = rang.rarity === 'legendary' || rang.rarity === 'mythic';
        const rarityText = RARITY_LABEL[rang.rarity] ? RARITY_LABEL[rang.rarity].toUpperCase() : '';

        const toast = document.createElement('div');
        toast.className = 'rang-visual';
        toast.setAttribute('data-rarity', rang.rarity);
        toast.style.setProperty('--rang-glow', rang.color);
        toast.style.cssText += `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, ${rang.color}, ${rang.colorLight});
            background-size: 200% 200%;
            color: #fff;
            padding: 18px 34px;
            border-radius: 35px;
            font-family: 'Segoe UI', system-ui, sans-serif;
            font-weight: 700;
            font-size: 14px;
            z-index: 99999;
            border: ${esTop ? '2px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.15)'};
            animation-name: rangSlideUp, rangFadeOut${esEpic || esTop ? ', rangPulseGlow' : ''}${esTop ? ', rangGradientShift' : ''};
            animation-duration: 0.6s, 0.4s${esEpic || esTop ? ', 1.8s' : ''}${esTop ? ', 3s' : ''};
            animation-timing-function: ease, ease${esEpic || esTop ? ', ease-in-out' : ''}${esTop ? ', ease' : ''};
            animation-delay: 0s, 4.5s${esEpic || esTop ? ', 0s' : ''}${esTop ? ', 0s' : ''};
            animation-fill-mode: forwards, forwards, none, none;
            animation-iteration-count: 1, 1, infinite, infinite;
            text-align: center;
            max-width: 90vw;
            pointer-events: none;
        `;
        toast.innerHTML = `
            ${rarityText ? `<div style="font-size:9px;letter-spacing:2px;opacity:0.85;margin-bottom:2px;">${esTop ? '✦ ' : ''}${rarityText}${esTop ? ' ✦' : ''}</div>` : ''}
            <div style="font-size:22px;margin-bottom:4px;"><i class="${rang.icon}" style="margin-right:10px;"></i>Nivell ${rang.nivell / CONFIG.LEVEL_STEP}</div>
            <div style="font-size:17px;letter-spacing:0.3px;">${rang.nom}</div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }

    // ============================================================
    // ETIQUETES DE RANG AL COSTAT DEL NOM
    // ============================================================
    function aplicarEstilVisual(el, rang) {
        el.classList.add('rang-visual');
        el.setAttribute('data-rarity', rang.rarity);
        el.style.background = `linear-gradient(135deg, ${rang.color}, ${rang.colorLight})`;
        el.style.setProperty('--rang-glow', rang.color);
    }

    function actualitzarEtiquetes() {
        const rang = obtenirRang(punts);

        document.querySelectorAll('[data-rang-tag]').forEach(el => {
            const uid = el.getAttribute('data-rang-tag');
            const r = uid ? obtenirRangPerUsuari(uid) : rang;
            el.innerHTML = `<i class="${r.icon}" style="font-size:10px;margin-right:3px;"></i>${r.nom}`;
            aplicarEstilVisual(el, r);
            el.style.display = 'inline-flex';
        });
    }

    // Injectar etiquetes a les observacions i comentaris
    function injectarEtiquetesExistents() {
        document.querySelectorAll('.obs-name').forEach(el => {
            if (!el.querySelector('[data-rang-tag]')) {
                const tag = document.createElement('span');
                tag.setAttribute('data-rang-tag', '');
                tag.style.cssText = `
                    display: none;
                    font-size: 8px;
                    font-weight: 700;
                    color: #fff;
                    background: #556680;
                    padding: 1px 8px;
                    border-radius: 10px;
                    margin-left: 6px;
                    align-items: center;
                    letter-spacing: 0.3px;
                    white-space: nowrap;
                `;
                const card = el.closest('.obs-card');
                if (card) {
                    const delBtn = card.querySelector('.obs-del');
                    if (delBtn) {
                        const match = delBtn.getAttribute('onclick');
                        if (match) {
                            const uidMatch = match.match(/delObs\('([^']+)','([^']+)'\)/);
                            if (uidMatch && uidMatch[2]) {
                                tag.setAttribute('data-rang-tag', uidMatch[2]);
                            }
                        }
                    }
                }
                el.appendChild(tag);
            }
        });

        document.querySelectorAll('.comment-name').forEach(el => {
            if (!el.querySelector('[data-rang-tag]')) {
                const tag = document.createElement('span');
                tag.setAttribute('data-rang-tag', '');
                tag.style.cssText = `
                    display: none;
                    font-size: 7px;
                    font-weight: 700;
                    color: #fff;
                    background: #556680;
                    padding: 0px 6px;
                    border-radius: 8px;
                    margin-left: 4px;
                    align-items: center;
                    letter-spacing: 0.3px;
                    white-space: nowrap;
                `;
                const comment = el.closest('.comment');
                if (comment) {
                    const delBtn = comment.querySelector('.comment-del');
                    if (delBtn) {
                        const match = delBtn.getAttribute('onclick');
                        if (match) {
                            const uidMatch = match.match(/delComment\('([^']+)','([^']+)'\)/);
                            if (uidMatch && uidMatch[2]) {
                                tag.setAttribute('data-rang-tag', uidMatch[2]);
                            }
                        }
                    }
                }
                el.appendChild(tag);
            }
        });

        actualitzarEtiquetes();
    }

    function programarActualitzacioEtiquetes() {
        if (etiquetesDebounceTimer) clearTimeout(etiquetesDebounceTimer);
        etiquetesDebounceTimer = setTimeout(() => {
            injectarEtiquetesExistents();
            actualitzarEtiquetes();
        }, CONFIG.OBSERVER_DEBOUNCE_MS);
    }

    // UI - ACTUALITZACIÓ BÀSICA
    function actualitzarUI() {
        const rang = obtenirRang(punts);
        const progress = progressPercent(punts);
        const proper = seguentLlindar(punts);
        const puntsFalten = Math.max(0, proper - punts);
        const properRang = proper < CONFIG.MAX_LEVEL ? obtenirRang(proper) : null;
        const nivellActual = Math.floor(punts / CONFIG.LEVEL_STEP);
        const esTextBrillant = rang.rarity === 'legendary' || rang.rarity === 'mythic';

        document.querySelectorAll('[data-rang-container]').forEach(el => {
            const elNom = el.querySelector('[data-rang-nom]');
            const elPunts = el.querySelector('[data-rang-punts]');
            const elNivell = el.querySelector('[data-rang-nivell]');
            const elProgress = el.querySelector('[data-rang-progress-fill]');
            const elInfo = el.querySelector('[data-rang-info]');
            const elIcon = el.querySelector('[data-rang-icon]');
            const elTier = el.querySelector('[data-rang-tier]');
            const elBadge = el.querySelector('[data-rang-badge]');
            const elRarity = el.querySelector('[data-rang-rarity]');

            if (elPunts) elPunts.textContent = formatPunts(punts);
            if (elNivell) elNivell.textContent = 'Nivell ' + nivellActual;
            if (elProgress) {
                elProgress.style.width = Math.min(progress, 100) + '%';
                elProgress.style.background = 'linear-gradient(90deg,' + rang.color + 'aa,' + rang.color + ')';
            }
            if (elIcon) elIcon.className = rang.icon;
            if (elBadge) aplicarEstilVisual(elBadge, rang);
            if (elTier) {
                if (rang.totalTiers > 1) {
                    elTier.textContent = 'Tier ' + rang.tier + '/' + rang.totalTiers;
                    elTier.style.display = '';
                } else {
                    elTier.style.display = 'none';
                }
            }
            if (elRarity) {
                const label = RARITY_LABEL[rang.rarity];
                if (label) {
                    elRarity.textContent = label;
                    elRarity.style.color = rang.colorLight;
                    elRarity.style.display = '';
                } else {
                    elRarity.style.display = 'none';
                }
            }
            if (elNom) {
                elNom.textContent = rang.nom;
                if (esTextBrillant) {
                    elNom.style.background = `linear-gradient(90deg,#fff,${rang.colorLight},#fff)`;
                    elNom.style.backgroundSize = '200% auto';
                    elNom.style.webkitBackgroundClip = 'text';
                    elNom.style.backgroundClip = 'text';
                    elNom.style.color = 'transparent';
                    elNom.style.webkitTextFillColor = 'transparent';
                    elNom.style.animation = 'rangTextShimmer 3s linear infinite';
                } else {
                    elNom.style.background = 'none';
                    elNom.style.webkitTextFillColor = '';
                    elNom.style.color = '#fff';
                    elNom.style.animation = 'none';
                }
            }
            if (elInfo) {
                if (punts < CONFIG.MAX_LEVEL) {
                    const properNom = properRang ? properRang.nom : 'nivell ' + (proper / CONFIG.LEVEL_STEP);
                    elInfo.textContent = formatPunts(puntsFalten) + ' pts per ' + properNom;
                } else {
                    elInfo.textContent = ' Rang màxim assolit!';
                }
            }
        });

        document.body.setAttribute('data-rang', rang.nom);
        document.body.setAttribute('data-rang-nivell', nivellActual);
        document.body.setAttribute('data-rang-color', rang.color);
        document.body.setAttribute('data-rang-rarity', rang.rarity);
    }

    // INJECTAR CONTAINER (barra superior)
    function injectarRangContainer() {
        if (containerInjected) return;
        if (document.querySelector('[data-rang-container]')) {
            containerInjected = true;
            return;
        }

        const template = document.createElement('div');
        template.setAttribute('data-rang-container', '');
        template.style.cssText = `
            background: linear-gradient(135deg, #0a1628 0%, #1a3050 100%);
            border-bottom: 3px solid #FFD700;
            padding: 6px 16px;
            font-family: 'Segoe UI', system-ui, sans-serif;
            position: sticky;
            top: 0;
            z-index: 999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            width: 100%;
            backdrop-filter: blur(8px);
            margin-bottom: 12px;
        `;

        template.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;max-width:1200px;margin:0 auto;flex-wrap:wrap;gap:4px;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span style="font-size:8px;color:#8899bb;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Rang</span>
                    <span data-rang-nivell style="font-size:8px;color:#aab;background:rgba(255,255,255,0.08);padding:1px 6px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);">Nivell 0</span>
                    <span data-rang-tier style="display:none;font-size:7px;color:#aab;background:rgba(255,255,255,0.06);padding:1px 6px;border-radius:6px;">Tier 1/1</span>
                    <span data-rang-rarity style="display:none;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;"></span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1;min-width:120px;">
                    <span data-rang-badge style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px 2px 5px;border-radius:10px;background:#556680;white-space:nowrap;">
                        <i data-rang-icon class="fa-solid fa-seedling" style="font-size:10px;color:#fff;"></i>
                        <span data-rang-nom style="font-size:10px;font-weight:700;letter-spacing:0.2px;">Nouvingut</span>
                    </span>
                    <div style="flex:1;min-width:40px;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;">
                        <div data-rang-progress-fill style="width:0%;height:100%;background:linear-gradient(90deg,#FFD700,#FFA500);border-radius:2px;transition:width 0.5s linear;"></div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span style="font-size:9px;color:#aab;"><strong data-rang-punts style="color:#FFD700;font-size:11px;">0,0</strong> pts</span>
                    <span data-rang-info style="font-size:8px;color:#8899bb;text-align:right;">---</span>
                </div>
            </div>
        `;

        const container = document.querySelector('.container') || document.body;
        container.insertBefore(template, container.firstChild);
        containerInjected = true;
    }

    function iniciarObservador() {
        if (mutationObserver) return;

        let target = null;
        for (const selector of CONFIG.OBSERVER_SCOPE_SELECTORS) {
            const el = document.querySelector(selector);
            if (el) { target = el; break; }
        }
        if (!target) target = document.body;

        mutationObserver = new MutationObserver(() => {
            programarActualitzacioEtiquetes();
        });
        mutationObserver.observe(target, { childList: true, subtree: true });
    }

    // INICIALITZAR
    function iniciar() {
        carregarDades();
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(() => {
                injectarRangContainer();
                actualitzarUI();
                injectarEtiquetesExistents();
                actualitzarEtiquetes();
                iniciarObservador();
            }, 100);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    injectarRangContainer();
                    actualitzarUI();
                    injectarEtiquetesExistents();
                    actualitzarEtiquetes();
                    iniciarObservador();
                }, 100);
            });
        }

        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(tickAmbDesat, CONFIG.TICK_INTERVAL);

        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'wheel'];
        events.forEach(event => {
            document.addEventListener(event, () => { lastInteraction = Date.now(); }, { passive: true });
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) { isActive = false; desarDades(); }
            else { isActive = true; lastInteraction = Date.now(); lastTickTime = Date.now(); carregarDades(); actualitzarUI(); actualitzarEtiquetes(); }
        });

        window.addEventListener('beforeunload', () => { desarDades(); });
        window.addEventListener('blur', () => { isActive = false; desarDades(); });
        window.addEventListener('focus', () => { isActive = true; lastInteraction = Date.now(); lastTickTime = Date.now(); carregarDades(); actualitzarUI(); actualitzarEtiquetes(); });
        window.addEventListener('pageshow', () => { isActive = true; lastInteraction = Date.now(); lastTickTime = Date.now(); });

        window.addEventListener('tc:login', () => {
            setTimeout(() => { carregarDades(); actualitzarUI(); actualitzarEtiquetes(); }, 500);
        });
        window.addEventListener('tc:logout', () => {
            setTimeout(() => { carregarDades(); actualitzarUI(); actualitzarEtiquetes(); }, 500);
        });
    }

    // API PÚBLICA
    window.TempestescatRangs = {
        obtenirPunts: () => punts,
        obtenirRang: () => obtenirRang(punts),
        obtenirRangPerUsuari: (uid) => obtenirRangPerUsuari(uid),
        obtenirProgress: () => progressPercent(punts),
        obtenirTotsRangs: () => RANGS,
        obtenirRatePerHora: () => obtenirRate(punts),
        actualitzar: () => { carregarDades(); actualitzarUI(); actualitzarEtiquetes(); },
        actualitzarEtiquetes: actualitzarEtiquetes
    };

    // ============================================================
    // ESTILS — badges/etiquetes amb rareses escalades i animacions
    // NEON REFORÇAT per als rangs alts (rare/epic/legendary/mythic)
    // ============================================================
    if (!document.getElementById('rang-estils')) {
        const style = document.createElement('style');
        style.id = 'rang-estils';
style.textContent = `
    @keyframes rangSlideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(50px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes rangFadeOut {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
    @keyframes rangPulseGlow {
        0%, 100% { filter: brightness(1); }
        50% { filter: brightness(1.35); }
    }
    @keyframes rangGradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }
    @keyframes rangHueRotate {
        0% { filter: brightness(1.2) hue-rotate(0deg); }
        100% { filter: brightness(1.2) hue-rotate(360deg); }
    }
    @keyframes rangShineMove {
        0% { left: -150%; }
        55% { left: 150%; }
        100% { left: 150%; }
    }
    @keyframes rangIconBounce {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-2px) scale(1.2); }
    }
    @keyframes rangSparkle {
        0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
        50% { opacity: 1; transform: scale(1.3) rotate(180deg); }
    }
    @keyframes rangTextShimmer {
        0% { background-position: 0% center; }
        100% { background-position: 200% center; }
    }
    @keyframes rangNeonFlicker {
        0%, 19%, 21%, 23%, 54%, 56%, 100% { opacity: 1; }
        20%, 22%, 55% { opacity: 0.82; }
    }
    @keyframes rangBorderSpin {
        0% { filter: hue-rotate(0deg); }
        100% { filter: hue-rotate(360deg); }
    }

    [data-rang-tag], [data-rang-badge] {
        position: relative;
        overflow: hidden;
        color: #fff !important;
        transition: box-shadow 0.4s ease, transform 0.3s ease;
    }
    [data-rang-tag] {
        display: inline-flex !important;
        align-items: center;
        font-size: 8px !important;
        font-weight: 700 !important;
        padding: 1px 8px !important;
        border-radius: 10px !important;
        margin-left: 6px !important;
        letter-spacing: 0.3px !important;
        white-space: nowrap !important;
        vertical-align: middle !important;
        line-height: 1.4 !important;
    }
    [data-rang-tag] i, [data-rang-badge] i { font-size: 9px; margin-right: 3px; color: #fff; }

    /* COMMON / UNCOMMON — subtils */
    .rang-visual[data-rarity="common"] { box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
    .rang-visual[data-rarity="uncommon"] { box-shadow: 0 2px 6px rgba(0,0,0,0.35), 0 0 8px var(--rang-glow, transparent); }

    /* RARE — neon suau constant */
    .rang-visual[data-rarity="rare"] {
        box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 10px var(--rang-glow, transparent), 0 0 18px var(--rang-glow, transparent);
        animation: rangNeonFlicker 4s linear infinite;
    }

    /* EPIC — neon pulsant més intens */
    .rang-visual[data-rarity="epic"] {
        box-shadow: 0 2px 10px rgba(0,0,0,0.45), 0 0 16px var(--rang-glow, transparent), 0 0 32px var(--rang-glow, transparent), 0 0 48px var(--rang-glow, transparent);
        animation: rangPulseGlow 2s ease-in-out infinite;
        border: 1px solid rgba(255,255,255,0.25);
    }

    /* LEGENDARY — neon brillant + degradat en moviment */
    .rang-visual[data-rarity="legendary"] {
        box-shadow: 0 2px 14px rgba(0,0,0,0.5), 0 0 20px var(--rang-glow, transparent), 0 0 40px var(--rang-glow, transparent), 0 0 60px var(--rang-glow, transparent);
        background-size: 200% 200% !important;
        animation: rangPulseGlow 1.6s ease-in-out infinite, rangGradientShift 3.5s ease infinite;
        border: 1.5px solid rgba(255,255,255,0.5);
    }

    /* MYTHIC — maxim neon: hue-rotate + glow gegant + espurnes */
    .rang-visual[data-rarity="mythic"] {
        box-shadow: 0 2px 16px rgba(0,0,0,0.55), 0 0 26px var(--rang-glow, transparent), 0 0 52px var(--rang-glow, transparent), 0 0 78px var(--rang-glow, transparent), 0 0 100px var(--rang-glow, transparent);
        background-size: 200% 200% !important;
        animation: rangPulseGlow 1.2s ease-in-out infinite, rangHueRotate 4s linear infinite;
        border: 2px solid rgba(255,255,255,0.75);
    }

    /* Efecte de resplendor lliscant per rare+ */
    .rang-visual[data-rarity="rare"]::after,
    .rang-visual[data-rarity="epic"]::after,
    .rang-visual[data-rarity="legendary"]::after,
    .rang-visual[data-rarity="mythic"]::after {
        content: '';
        position: absolute;
        top: 0;
        left: -150%;
        width: 60%;
        height: 100%;
        background: linear-gradient(120deg, transparent, rgba(255,255,255,0.6), transparent);
        transform: skewX(-20deg);
        animation: rangShineMove 2.6s ease-in-out infinite;
        pointer-events: none;
    }

    .rang-visual[data-rarity="legendary"] i, .rang-visual[data-rarity="mythic"] i {
        animation: rangIconBounce 1.4s ease-in-out infinite;
    }

    /* Espurnes multiples per mythic */
    .rang-visual[data-rarity="mythic"]::before {
        content: '\\2726';
        position: absolute;
        top: -6px;
        right: -3px;
        font-size: 11px;
        color: #fff;
        opacity: 0;
        animation: rangSparkle 1.6s ease-in-out infinite;
        pointer-events: none;
        text-shadow: 0 0 6px #fff, 0 0 12px var(--rang-glow, #fff);
    }

    .obs-name [data-rang-tag] { font-size: 7px !important; padding: 0px 6px !important; margin-left: 4px !important; }
    .comment-name [data-rang-tag] { font-size: 6px !important; padding: 0px 5px !important; margin-left: 3px !important; border-radius: 6px !important; }
    .xat-modal-msg-name [data-rang-tag] { font-size: 6px !important; padding: 0px 5px !important; margin-left: 4px !important; border-radius: 6px !important; }
`;
        document.head.appendChild(style);
    }

    // ARRANCAR
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }

})();