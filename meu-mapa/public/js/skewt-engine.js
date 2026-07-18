// ═══════════════════════════════════════════════════════════════════════
//  skewt-engine.js — Motor termodinàmic i de vent per al Skew-T
//  Sense dependències, JS pur. No toca el DOM.
//  Llegeix el format de dades produït per t_final_blindado.py / mapa.js
// ═══════════════════════════════════════════════════════════════════════

(function (global) {
    'use strict';

    // ─── CONSTANTS FÍSIQUES ─────────────────────────────────────────────
    const RD = 287.05;      // J/(kg·K) constant gas sec
    const CP = 1004.6;      // J/(kg·K) calor específica pressió constant
    const RD_CP = RD / CP;
    const G0 = 9.80665;     // m/s²
    const EPS = 0.6219707;  // Rd/Rv
    const L = 2.501e6;      // J/kg calor latent vaporització

    // Nivells de pressió que produeix el pipeline (hPa), de superfície a top
    const NIVELLS_PRESSIO = [1000, 950, 925, 900, 875, 850, 800, 750, 700, 650,
                              600, 550, 500, 450, 400, 350, 300, 250, 200, 150, 100];

    // ─── UTILITATS BÀSIQUES ─────────────────────────────────────────────

    function esFinit(v) {
        return v !== null && v !== undefined && !isNaN(v) && isFinite(v);
    }

    // Pressió → alçada geopotencial aproximada (atmosfera estàndard, m)
    function pressioAAlcada(pHpa) {
        const T0 = 288.15, p0 = 1013.25, lapse = 0.0065;
        return (T0 / lapse) * (1.0 - Math.pow(pHpa / p0, RD * lapse / G0));
    }

    // Alçada → pressió (invers de l'anterior)
    function alcadaAPressio(zM) {
        const T0 = 288.15, p0 = 1013.25, lapse = 0.0065;
        return p0 * Math.pow(1.0 - (lapse * zM) / T0, G0 / (RD * lapse));
    }

    // Pressió de vapor saturant (Bolton 1980), hPa, t en °C
    function esatBolton(tC) {
        return 6.112 * Math.exp((17.67 * tC) / (tC + 243.5));
    }

    // Ràtio de mescla saturant (kg/kg)
    function wsat(tC, pHpa) {
        const es = esatBolton(tC);
        return EPS * es / Math.max(pHpa - es, 0.1);
    }

    // Temperatura del punt de rosada a partir de la humitat relativa
    function tdFromRH(tC, rhPct) {
        const es = esatBolton(tC);
        const e = es * Math.max(0.01, Math.min(100, rhPct)) / 100;
        return (243.5 * Math.log(e / 6.112)) / (17.67 - Math.log(e / 6.112));
    }

    // ─── TERMODINÀMICA DE LA PARCEL·LA ──────────────────────────────────

    // LCL (Bolton 1980): pressió i temperatura del nivell de condensació
    function lclBolton(tC, tdC, pHpa) {
        const tK = tC + 273.15;
        const tdK = tdC + 273.15;
        const tLclK = 1.0 / (1.0 / (tdK - 56.0) + Math.log(tK / tdK) / 800.0) + 56.0;
        const pLcl = pHpa * Math.pow(tLclK / tK, 1.0 / RD_CP);
        return { p: pLcl, t: tLclK - 273.15 };
    }

    // Gradient adiabàtic humit aproximat (°C/hPa)
    function gradientHumit(tC, pHpa) {
        const tK = tC + 273.15;
        const es = esatBolton(tC);
        const ws = EPS * es / Math.max(pHpa - es, 0.1);
        const num = 1.0 + (L * ws) / (RD * tK);
        const den = 1.0 + (0.622 * L * L * ws) / (CP * RD * tK * tK);
        return (RD * tK) / (CP * pHpa) * (num / den);
    }



    // ─── MIXED LAYER (capa de mescla) ──────────────────────────────────

/**
 * Calcula la parcel·la de capa de mescla (Mixed Layer).
 * Fa la mitjana de T i Td als primers `dp` hPa des de superfície,
 * i després aixeca la parcel·la resultant.
 */
function perfilMixedLayer(perfil, dpMix) {
    if (!perfil || perfil.p.length < 2) return null;
    
    const pSfc = perfil.p[0];
    const pTopMix = pSfc - (dpMix || 100); // Per defecte 100 hPa de capa de mescla
    
    // Trobar tots els nivells dins la capa de mescla
    let sumT = 0, sumTd = 0, count = 0;
    
    for (let i = 0; i < perfil.p.length; i++) {
        if (perfil.p[i] >= pTopMix) {
            sumT += perfil.t[i];
            sumTd += perfil.td[i];
            count++;
        } else {
            break;
        }
    }
    
    if (count === 0) return null;
    
    const tMix = sumT / count;
    const tdMix = sumTd / count;
    
    // Calcular la parcel·la per a la capa de mescla
    return perfilParcela(tMix, tdMix, pSfc, perfil.p);
}

// Afegir a l'export:
// global.SkewtEngine.perfilMixedLayer = perfilMixedLayer;


    // Temperatura d'una parcel·la ascendent (seca fins LCL, humida després)
    // a una pressió destí donada.
    function tempParcelaANivell(tSfc, tdSfc, pSfc, pDest, lcl) {
        if (!lcl) lcl = lclBolton(tSfc, tdSfc, pSfc);
        // Tram sec (adiabàtica seca, Poisson)
        const tSec = (tSfc + 273.15) * Math.pow(pDest / pSfc, RD_CP) - 273.15;
        if (pDest >= lcl.p) return tSec;
        // Tram humit: integració senzilla amb pas de 5 hPa des del LCL
        let p = lcl.p;
        let t = lcl.t;
        const pasMax = 5;
        while (p > pDest) {
            const dp = Math.min(pasMax, p - pDest);
            const gamma = gradientHumit(t, p - dp / 2);
            t = t - gamma * (-dp) * -1; // t augmenta en descendre pressió? no: pugem, p baixa
            t = t + gamma * (-dp);      // dp positiu, p baixa → t baixa
            p -= dp;
        }
        return t;
    }

    // Versió vectoritzada/iterativa més simple i estable per tot el perfil
    // d'un cop (evita error acumulat integrant per trams curts)
    function perfilParcela(tSfc, tdSfc, pSfc, pLevels) {
        const lcl = lclBolton(tSfc, tdSfc, pSfc);
        const out = new Array(pLevels.length);
        for (let i = 0; i < pLevels.length; i++) {
            const pDest = pLevels[i];
            if (pDest >= pSfc) { out[i] = null; continue; }
            if (pDest >= lcl.p) {
                out[i] = (tSfc + 273.15) * Math.pow(pDest / pSfc, RD_CP) - 273.15;
            } else {
                // Integració Runge-Kutta 2n ordre des del LCL fins pDest
                let p = lcl.p, t = lcl.t;
                const nPassos = Math.max(1, Math.ceil((lcl.p - pDest) / 5));
                const dp = (lcl.p - pDest) / nPassos;
                for (let k = 0; k < nPassos; k++) {
                    const g1 = gradientHumit(t, p);
                    const tMig = t - g1 * (dp / 2);
                    const g2 = gradientHumit(tMig, p - dp / 2);
                    t = t - g2 * dp;
                    p -= dp;
                }
                out[i] = t;
            }
        }
        return { valors: out, lcl };
    }

    function calcularIndexsTermo(perfil) {
    const { p, t, td } = perfil;
    const n = p.length;
    if (n < 3) return null;

    const pSfc = p[0], tSfc = t[0], tdSfc = td[0];
    const { valors: tParcela, lcl } = perfilParcela(tSfc, tdSfc, pSfc, p);

    const z = p.map(pressioAAlcada);

    // Buoyancy en cada nivell
    const buoy = new Array(n);
    for (let i = 0; i < n; i++) {
        if (tParcela[i] === null || !esFinit(t[i])) { buoy[i] = null; continue; }
        buoy[i] = tParcela[i] - t[i];
    }

    // ─── DETECCIÓ DE LFC AMB MÍNIM 2 KM DE FLOTABILITAT ──────────
    
    let cape = 0, cin = 0;
    let lfcZ = null;
    let elZ = null;
    let candidatLFC = null;
    let flotabilitatContinua = 0;
    const MIN_FLOTABILITAT_M = 2000; // 2 km mínim

    for (let i = 1; i < n; i++) {
        if (buoy[i] === null || buoy[i - 1] === null) continue;
        const dz = z[i] - z[i - 1];
        if (dz <= 0) continue;
        
        const b0 = buoy[i - 1], b1 = buoy[i];
        const tk0 = t[i - 1] + 273.15, tk1 = t[i] + 273.15;
        const e0 = G0 * (b0 / tk0);
        const e1 = G0 * (b1 / tk1);

        if (b0 >= 0 && b1 >= 0) {
            // Tram positiu
            if (candidatLFC === null) {
                // Possible inici de flotabilitat
                candidatLFC = z[i - 1];
                flotabilitatContinua = 0;
            }
            flotabilitatContinua += dz;
            cape += 0.5 * (e0 + e1) * dz;
            elZ = z[i];
            
        } else if (b0 < 0 && b1 >= 0) {
            // Creuament de negatiu a positiu
            const frac = b0 / (b0 - b1);
            const zCross = z[i - 1] + frac * dz;
            
            if (candidatLFC === null) {
                candidatLFC = zCross;
                flotabilitatContinua = 0;
            }
            
            // Afegir CIN fins al creuament si encara no tenim LFC confirmat
            if (lfcZ === null) {
                cin += 0.5 * e0 * (zCross - z[i - 1]);
            }
            
            flotabilitatContinua += (z[i] - zCross);
            cape += 0.5 * e1 * (z[i] - zCross);
            elZ = z[i];
            
        } else if (b0 >= 0 && b1 < 0) {
            // Creuament de positiu a negatiu
            const frac = b0 / (b0 - b1);
            const zCross = z[i - 1] + frac * dz;
            
            flotabilitatContinua += (zCross - z[i - 1]);
            cape += 0.5 * e0 * (zCross - z[i - 1]);
            
            // Comprovar si la flotabilitat acumulada supera el mínim
            if (candidatLFC !== null && flotabilitatContinua >= MIN_FLOTABILITAT_M && lfcZ === null) {
                lfcZ = candidatLFC;
            }
            
            elZ = zCross;
            candidatLFC = null;
            flotabilitatContinua = 0;
            
        } else {
            // Tot negatiu
            if (lfcZ === null) {
                cin += 0.5 * (e0 + e1) * dz;
            }
            candidatLFC = null;
            flotabilitatContinua = 0;
        }
    }
    
    // Si al final del perfil encara estem en zona positiva
    if (candidatLFC !== null && flotabilitatContinua >= MIN_FLOTABILITAT_M && lfcZ === null) {
        lfcZ = candidatLFC;
    }

    const lfc = lfcZ !== null ? alcadaAPressio(lfcZ) : null;
    const el = elZ !== null ? alcadaAPressio(elZ) : null;

    // Lifted Index
    let li = null;
    const idx500 = p.reduce((best, pv, i) => {
        return (Math.abs(pv - 500) < Math.abs(p[best] - 500)) ? i : best;
    }, 0);
    if (Math.abs(p[idx500] - 500) < 40 && esFinit(t[idx500])) {
        const tp500 = perfilParcela(tSfc, tdSfc, pSfc, [500]).valors[0];
        if (tp500 !== null) li = t[idx500] - tp500;
    }

    return {
        cape: Math.max(0, cape),
        cin: Math.min(0, -Math.abs(cin)),
        lcl_p: lcl.p, lcl_t: lcl.t, lcl_z: pressioAAlcada(lcl.p),
        lfc_p: lfc, lfc_z: lfcZ,
        el_p: el, el_z: elZ,
        li: li,
        tParcela: tParcela,
        z: z
    };
}

    // K-Index, Totals Totals, Showalter — índexs clàssics addicionals
    function indexsAddicionals(perfil) {
        const { p, t, td } = perfil;
        function tAt(pTarget) {
            // interpolació lineal en pressió (log-p seria millor, aprox suficient)
            for (let i = 0; i < p.length - 1; i++) {
                if (p[i] >= pTarget && p[i + 1] <= pTarget) {
                    const f = (p[i] - pTarget) / (p[i] - p[i + 1]);
                    return t[i] + f * (t[i + 1] - t[i]);
                }
            }
            return null;
        }
        function tdAt(pTarget) {
            for (let i = 0; i < p.length - 1; i++) {
                if (p[i] >= pTarget && p[i + 1] <= pTarget) {
                    const f = (p[i] - pTarget) / (p[i] - p[i + 1]);
                    return td[i] + f * (td[i + 1] - td[i]);
                }
            }
            return null;
        }

        const t850 = tAt(850), td850 = tdAt(850), t700 = tAt(700), td700 = tdAt(700), t500 = tAt(500);
        let kIndex = null, totalsTotals = null, showalter = null;

        if (esFinit(t850) && esFinit(td850) && esFinit(t700) && esFinit(td700) && esFinit(t500)) {
            kIndex = (t850 - t500) + td850 - (t700 - td700);
            totalsTotals = (t850 + td850) - 2 * t500;
        }
        if (esFinit(t850) && esFinit(td850) && esFinit(t500)) {
            const lcl850 = lclBolton(t850, td850, 850);
            const tp500 = perfilParcela(t850, td850, 850, [500]).valors[0];
            if (tp500 !== null) showalter = t500 - tp500;
        }

        return { kIndex, totalsTotals, showalter };
    }

    // ─── VENT / HODÒGRAF ─────────────────────────────────────────────────

    // Component U/V → velocitat (m/s o km/h segons factor) i direcció (graus meteorològics, d'on ve el vent)
    function uvASpeedDir(u, v, factor) {
        factor = factor || 1;
        const spd = Math.sqrt(u * u + v * v) * factor;
        let dir = Math.atan2(-u, -v) * 180 / Math.PI;
        if (dir < 0) dir += 360;
        return { speed: spd, dir: dir };
    }

    // Bulk shear entre dos nivells (m/s), a partir de perfils u(z), v(z)
    function bulkShear(uBase, vBase, uTop, vTop) {
        const du = uTop - uBase, dv = vTop - vBase;
        return Math.sqrt(du * du + dv * dv);
    }

    // Storm motion segons mètode Bunkers (right-mover / left-mover)
    // requereix mitjana 0-6km i shear vector 0-6km
    function stormMotionBunkers(uMean06, vMean06, uShear06, vShear06) {
        const shearMag = Math.sqrt(uShear06 * uShear06 + vShear06 * vShear06);
        if (shearMag < 0.1) {
            return { right: { u: uMean06, v: vMean06 }, left: { u: uMean06, v: vMean06 } };
        }
        // vector perpendicular al shear, normalitzat, mòdul 7.5 m/s (constant de Bunkers)
        const D = 7.5;
        const uPerpR = D * (vShear06 / shearMag);
        const vPerpR = D * (-uShear06 / shearMag);
        return {
            right: { u: uMean06 + uPerpR, v: vMean06 + vPerpR },
            left: { u: uMean06 - uPerpR, v: vMean06 - vPerpR }
        };
    }

    // SRH (Storm Relative Helicity) entre dues alçades (m²/s²)
    // niveis: array de {z, u, v} ordenats per z creixent
    function calcularSRH(nivells, stormU, stormV, zBase, zTop) {
        let srh = 0;
        for (let i = 0; i < nivells.length - 1; i++) {
            const a = nivells[i], b = nivells[i + 1];
            if (a.z > zTop || b.z < zBase) continue;
            // limitem el tram a [zBase, zTop]
            let z0 = Math.max(a.z, zBase), z1 = Math.min(b.z, zTop);
            if (z1 <= z0) continue;
            const frac0 = (z0 - a.z) / (b.z - a.z || 1);
            const frac1 = (z1 - a.z) / (b.z - a.z || 1);
            const u0 = a.u + frac0 * (b.u - a.u), v0 = a.v + frac0 * (b.v - a.v);
            const u1 = a.u + frac1 * (b.u - a.u), v1 = a.v + frac1 * (b.v - a.v);
            // integral discreta de helicitat: (u0-us)(v1-vs) - (u1-us)(v0-vs)
            srh += (u0 - stormU) * (v1 - stormV) - (u1 - stormU) * (v0 - stormV);
        }
        return srh;
    }

    // Mitjana ponderada del vent entre dues alçades (per Bunkers, EHI, etc.)
    function ventMitja(nivells, zBase, zTop) {
        let sumU = 0, sumV = 0, sumW = 0;
        for (let i = 0; i < nivells.length - 1; i++) {
            const a = nivells[i], b = nivells[i + 1];
            if (a.z > zTop || b.z < zBase) continue;
            let z0 = Math.max(a.z, zBase), z1 = Math.min(b.z, zTop);
            if (z1 <= z0) continue;
            const frac0 = (z0 - a.z) / (b.z - a.z || 1);
            const frac1 = (z1 - a.z) / (b.z - a.z || 1);
            const u0 = a.u + frac0 * (b.u - a.u), v0 = a.v + frac0 * (b.v - a.v);
            const u1 = a.u + frac1 * (b.u - a.u), v1 = a.v + frac1 * (b.v - a.v);
            const w = z1 - z0;
            sumU += 0.5 * (u0 + u1) * w;
            sumV += 0.5 * (v0 + v1) * w;
            sumW += w;
        }
        if (sumW === 0) return null;
        return { u: sumU / sumW, v: sumV / sumW };
    }

    // Interpola u,v a una alçada z concreta dins la llista de nivells {z,u,v}
    function ventAAlcada(nivells, zTarget) {
        for (let i = 0; i < nivells.length - 1; i++) {
            const a = nivells[i], b = nivells[i + 1];
            if (zTarget >= a.z && zTarget <= b.z) {
                const f = (zTarget - a.z) / (b.z - a.z || 1);
                return { u: a.u + f * (b.u - a.u), v: a.v + f * (b.v - a.v) };
            }
        }
        if (zTarget <= nivells[0].z) return { u: nivells[0].u, v: nivells[0].v };
        return { u: nivells[nivells.length - 1].u, v: nivells[nivells.length - 1].v };
    }

    /**
     * Calcula el paquet complet de shear/SRH/storm-motion a partir del
     * perfil de vent (nivells amb z en metres AGL, u/v en m/s).
     */
    function calcularVentComposite(nivellsVent, zSfc) {
        if (!nivellsVent || nivellsVent.length < 3) return null;
        // normalitzem a AGL
        const niv = nivellsVent.map(n => ({ z: n.z - zSfc, u: n.u, v: n.v }))
                                .filter(n => n.z >= -10)
                                .sort((a, b) => a.z - b.z);
        if (niv.length < 3) return null;

        const sfc = ventAAlcada(niv, 0);
        const v1km = ventAAlcada(niv, 1000);
        const v3km = ventAAlcada(niv, 3000);
        const v6km = ventAAlcada(niv, 6000);
        const v8km = ventAAlcada(niv, 8000);

        const shear01 = bulkShear(sfc.u, sfc.v, v1km.u, v1km.v);
        const shear03 = bulkShear(sfc.u, sfc.v, v3km.u, v3km.v);
        const shear06 = bulkShear(sfc.u, sfc.v, v6km.u, v6km.v);
        const shear08 = bulkShear(sfc.u, sfc.v, v8km.u, v8km.v);

        const mean06 = ventMitja(niv, 0, 6000) || v6km;
        const uShear06 = v6km.u - sfc.u, vShear06 = v6km.v - sfc.v;

        const bunkers = stormMotionBunkers(mean06.u, mean06.v, uShear06, vShear06);

        const srh01 = calcularSRH(niv, bunkers.right.u, bunkers.right.v, 0, 1000);
        const srh03 = calcularSRH(niv, bunkers.right.u, bunkers.right.v, 0, 3000);
        const srhEff = srh01; // aproximació: capa efectiva ~ 0-1km si no calculem capa efectiva real

        return {
            niv, sfc, v1km, v3km, v6km, v8km,
            shear01, shear03, shear06, shear08,
            mean06, bunkers,
            srh01, srh03, srhEff
        };
    }

    // ─── EXTRACCIÓ DE PERFIL DES DE LES DADES DE mapa.js ────────────────

    /**
     * Troba l'índex del punt de graella més proper a (lat, lon).
     */
    function indexGraellaMesProper(lats, lons, lat, lon) {
        let iBest = 0, bestDLat = Infinity;
        for (let i = 0; i < lats.length; i++) {
            const d = Math.abs(lats[i] - lat);
            if (d < bestDLat) { bestDLat = d; iBest = i; }
        }
        let jBest = 0, bestDLon = Infinity;
        for (let j = 0; j < lons.length; j++) {
            const d = Math.abs(lons[j] - lon);
            if (d < bestDLon) { bestDLon = d; jBest = j; }
        }
        return { i: iBest, j: jBest };
    }

    // Donat un array de latituds tal com ve a coordenadas.lat, retorna
    // l'índex de fila REAL dins de `datos` (flat, row-major) corresponent
    // a l'índex `i` dins l'array `lats`.
    //
    // mapa.js only inverteix la fila quan lats[0] > lats[last] (és a dir,
    // quan l'array de latituds ve donat de NORD a SUD). Si en canvi ve de
    // SUD a NORD (creixent, l'ordre habitual en aquest pipeline), NO cal
    // invertir res: l'índex dins `lats` ja coincideix amb la fila real.
    // skewt-engine.js ha d'aplicar exactament la mateixa regla, si no,
    // els punts del Nord i del Sud del domini queden bescanviats.
    function filaRealPerIndex(lats, i) {
        const latNord = lats[0] > lats[lats.length - 1];
        return latNord ? (lats.length - 1 - i) : i;
    }

    /**
     * Donat un objecte `data` (com window.totesLesHores[idx].data) i un
     * punt lat/lon, extreu el perfil vertical complet: temperatura, punt
     * de rosada i vent a cada nivell disponible, incloent la superfície.
     *
     * Retorna { p, t, td, u, v, z } ordenat per pressió descendent
     * (superfície primer) i llest per calcularIndexsTermo / vent.
     */
    function extreurePerfil(data, lat, lon, spSuperficieOverride) {
        const vars = data.variables || {};
        const coordSfc = data.coordenadas;
        const coord3d = data.coordenadas_3d || data.coordenadas;

        const out = { p: [], t: [], td: [], u: [], v: [] };

        // ── Superfície ──
        let pSfc = null, tSfc = null, tdSfc = null, uSfc = null, vSfc = null;
        if (coordSfc && vars.st && vars.st.datos) {
            const idx = indexGraellaMesProper(coordSfc.lat, coordSfc.lon, lat, lon);
            const Nlon = coordSfc.lon.length;
            const filaReal = filaRealPerIndex(coordSfc.lat, idx.i);
            const flatIdx = filaReal * Nlon + idx.j;

            const rawSt = vars.st.datos[flatIdx];
            tSfc = esFinit(rawSt) ? (rawSt > 100 ? rawSt - 273.15 : rawSt) : null;

            if (vars.sd && vars.sd.datos) {
                const rawSd = vars.sd.datos[flatIdx];
                tdSfc = esFinit(rawSd) ? (rawSd > 100 ? rawSd - 273.15 : rawSd) : null;
            }
            if (vars.sp && vars.sp.datos) {
                pSfc = vars.sp.datos[flatIdx];
            }
            if (vars.su && vars.su.datos) uSfc = vars.su.datos[flatIdx];
            if (vars.sv && vars.sv.datos) vSfc = vars.sv.datos[flatIdx];
        }
        if (spSuperficieOverride && esFinit(spSuperficieOverride)) pSfc = spSuperficieOverride;

        if (esFinit(pSfc) && esFinit(tSfc) && esFinit(tdSfc)) {
            out.p.push(pSfc); out.t.push(tSfc); out.td.push(tdSfc);
            out.u.push(esFinit(uSfc) ? uSfc : 0);
            out.v.push(esFinit(vSfc) ? vSfc : 0);
        }

        // ── Nivells 3D ──
        if (coord3d) {
            const idx3d = indexGraellaMesProper(coord3d.lat, coord3d.lon, lat, lon);
            const Nlon3 = coord3d.lon.length;
            const filaReal3 = filaRealPerIndex(coord3d.lat, idx3d.i);
            const flatIdx3 = filaReal3 * Nlon3 + idx3d.j;

            NIVELLS_PRESSIO.forEach(niv => {
                if (pSfc !== null && niv >= pSfc) return; // per sota de terra
                const kt = 't_' + niv, kd = 'dpt_' + niv, ku = 'u_' + niv, kv = 'v_' + niv;
                if (!vars[kt] || !vars[kt].datos) return;
                let tv = vars[kt].datos[flatIdx3];
                if (!esFinit(tv)) return;
                if (tv > 100) tv -= 273.15; // per si venen en Kelvin

                let tdv = null;
                if (vars[kd] && vars[kd].datos) {
                    tdv = vars[kd].datos[flatIdx3];
                    if (esFinit(tdv) && tdv > 100) tdv -= 273.15;
                }
                if (!esFinit(tdv)) return; // sense punt de rosada no dibuixem el nivell

                let uv = 0, vv = 0;
                if (vars[ku] && vars[ku].datos) uv = vars[ku].datos[flatIdx3];
                if (vars[kv] && vars[kv].datos) vv = vars[kv].datos[flatIdx3];
                if (!esFinit(uv)) uv = 0;
                if (!esFinit(vv)) vv = 0;

                out.p.push(niv); out.t.push(tv); out.td.push(tdv);
                out.u.push(uv); out.v.push(vv);
            });
        }

        // Ordenem per pressió descendent (per si de cas) i eliminem duplicats
        const idxOrdre = out.p.map((_, i) => i).sort((a, b) => out.p[b] - out.p[a]);
        const net = { p: [], t: [], td: [], u: [], v: [] };
        let lastP = Infinity;
        idxOrdre.forEach(i => {
            if (out.p[i] >= lastP) return; // evita pressions repetides/no monòtones
            net.p.push(out.p[i]); net.t.push(out.t[i]); net.td.push(out.td[i]);
            net.u.push(out.u[i]); net.v.push(out.v[i]);
            lastP = out.p[i];
        });

        if (net.p.length < 3) return null;

        net.z = net.p.map(pressioAAlcada);
        return net;
    }

    // ─── EXPORT ──────────────────────────────────────────────────────────

    global.SkewtEngine = {
        // constants
        NIVELLS_PRESSIO,
        // utilitats
        esFinit, pressioAAlcada, alcadaAPressio, esatBolton, wsat, tdFromRH,
        // termodinàmica
        lclBolton, gradientHumit, perfilParcela, calcularIndexsTermo, indexsAddicionals,
        perfilMixedLayer, 
        // vent
        uvASpeedDir, bulkShear, stormMotionBunkers, calcularSRH, ventMitja, ventAAlcada,
        calcularVentComposite,
        // extracció
        indexGraellaMesProper, filaRealPerIndex, extreurePerfil
    };

})(window);