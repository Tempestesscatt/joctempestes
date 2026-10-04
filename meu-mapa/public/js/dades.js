// ═══════════════════════════════════════════════════════════════════
//  dades.js — càrrega de capes binàries (una variable, totes les hores)
//  Estructura: web_data_NE/{sfc,3d}/meta.json + <variable>.bin.gz
//  Carregar ABANS de mapa.js
// ═══════════════════════════════════════════════════════════════════

const BASE = 'web_data_NE/';
const DADES = {
    meta: {},          // { sfc: meta, '3d': meta }
    vars: {},          // clau -> {nombre, unidades, min, max, n, src} (o {deriv:[u,v]})
    capes: new Map(),  // clau -> {q:Uint16Array, min, max, n}
    pend: new Map(),   // descàrregues en curs
    mapa: {},          // src -> [índex de la llista principal -> índex dins el meta]
    steps: [],         // llista principal d'hores (la del sfc)
    run: '',
};

async function _fetchBin(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    let b = new Uint8Array(await r.arrayBuffer());
    if (b[0] === 0x1f && b[1] === 0x8b) {   // si el servidor no l'ha descomprimit
        const s = new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'));
        b = new Uint8Array(await new Response(s).arrayBuffer());
    }
    return b;
}

async function carregarMetes() {
    const get = p => fetch(`${BASE}${p}/meta.json`, { cache: 'no-cache' })
        .then(r => (r.ok ? r.json() : null)).catch(() => null);
    const [sfc, td] = await Promise.all([get('sfc'), get('3d')]);
    if (!sfc) return false;

    DADES.meta = { sfc, '3d': td };
    DADES.steps = sfc.steps;
    DADES.run = sfc.run_utc;

    for (const [src, m] of Object.entries(DADES.meta)) {
        if (!m) continue;
        for (const [k, v] of Object.entries(m.vars)) DADES.vars[k] = { ...v, src };
        const perLocal = new Map(m.steps.map((s, i) => [s.local, i]));
        DADES.mapa[src] = sfc.steps.map(s => perLocal.get(s.local) ?? -1);
    }

    // Variables derivades (velocitat del vent en km/h)
    if (DADES.vars.su && DADES.vars.sv && !DADES.vars.wind_speed_10m) {
        DADES.vars.wind_speed_10m = { nombre: 'Vent 10m', unidades: 'km/h', src: 'sfc', deriv: ['su', 'sv'] };
    }
    for (const k of Object.keys(DADES.vars)) {
        const m = k.match(/^u_(\d+)$/);
        if (m && DADES.vars['v_' + m[1]]) {
            DADES.vars['wind_speed_' + m[1]] = {
                nombre: `Vent @ ${m[1]}hPa`, unidades: 'km/h', src: '3d', deriv: [k, 'v_' + m[1]],
            };
        }
    }
    return true;
}

function carregarCapa(clau) {
    const info = DADES.vars[clau];
    if (!info) return Promise.resolve(null);
    if (info.deriv) return Promise.all(info.deriv.map(carregarCapa));
    if (DADES.capes.has(clau)) return Promise.resolve(DADES.capes.get(clau));
    if (DADES.pend.has(clau)) return DADES.pend.get(clau);

    const p = (async () => {
        const b = await _fetchBin(`${BASE}${info.src}/${clau}.bin.gz?v=${encodeURIComponent(DADES.run)}`);
        const capa = { q: new Uint16Array(b.buffer, b.byteOffset, b.byteLength >> 1), min: info.min, max: info.max, n: info.n };
        DADES.capes.set(clau, capa);
        return capa;
    })().catch(e => { console.warn('[capa]', clau, e.message); return null; })
        .finally(() => DADES.pend.delete(clau));

    DADES.pend.set(clau, p);
    return p;
}

// Valors d'UNA hora (idx de la llista principal) -> Float32Array amb NaN
function valorsHora(clau, idx) {
    const info = DADES.vars[clau];
    if (!info) return null;

    if (info.deriv) {
        const u = valorsHora(info.deriv[0], idx), v = valorsHora(info.deriv[1], idx);
        if (!u || !v) return null;
        const o = new Float32Array(u.length);
        for (let i = 0; i < o.length; i++) o[i] = Math.hypot(u[i], v[i]) * 3.6;
        return o;
    }

    const c = DADES.capes.get(clau);
    const h = DADES.mapa[info.src]?.[idx];
    if (!c || h === undefined || h < 0) return null;
    const o = new Float32Array(c.n), k = (c.max - c.min) / 65534, off = h * c.n;
    for (let i = 0; i < c.n; i++) {
        const x = c.q[off + i];
        o[i] = x === 65535 ? NaN : c.min + x * k;
    }
    return o;
}

function graellaDe(clau) {
    const info = DADES.vars[clau];
    if (!info) return null;
    if (info.deriv) return graellaDe(info.deriv[0]);
    const m = DADES.meta[info.src];
    return m ? { lats: m.lats, lons: m.lons } : null;
}

// Retorna {vals, lats, lons, info} d'una variable en una hora
async function obtenirCapa(clau, idx) {
    const info = DADES.vars[clau];
    if (!info) return null;
    await carregarCapa(clau);
    const vals = valorsHora(clau, idx);
    const g = graellaDe(clau);
    if (!vals || !g) return null;
    return { vals, lats: g.lats, lons: g.lons, info };
}

function diaRelatiu(localISO) {
    const avui = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
    const d = Math.round((Date.parse(localISO.slice(0, 10)) - Date.parse(avui)) / 864e5);
    if (d === -1) return 'ahir';
    if (d === 0) return 'avui';
    if (d === 1) return 'dema';
    if (d === 2) return 'dema_passat';
    return localISO.slice(8, 10) + '/' + localISO.slice(5, 7);
}