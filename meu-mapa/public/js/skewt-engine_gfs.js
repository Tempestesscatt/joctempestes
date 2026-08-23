// ═══════════════════════════════════════════════════════════════════════
//  skewt-engine.js — Motor termodinàmic i de vent per al Skew-T
//  ADAPTAT PER A GFS GLOBAL + PRESSIÓ DE SUPERFÍCIE REAL (GFS)
// ═══════════════════════════════════════════════════════════════════════

(function (global) {
    'use strict';

    // ─── CONSTANTS FÍSIQUES ─────────────────────────────────────────────
    const RD = 287.05;
    const CP = 1004.6;
    const RD_CP = RD / CP;
    const G0 = 9.80665;
    const EPS = 0.6219707;
    const L = 2.501e6;

    const NIVELLS_PRESSIO = [1000, 975, 950, 925, 900, 875, 850, 825, 800, 775, 750, 725, 700, 675, 650, 625,
                              600, 575, 550, 525, 500, 475, 450, 425, 400, 375, 350, 325, 300, 275, 250, 225, 200, 175, 150, 125, 100];

    // ══════════════════════════════════════════════════════════════════
    //  CÀRREGA DE PRESSIÓ DE SUPERFÍCIE REAL (GFS)
    //  (abans: elevació real del terreny des d'una API d'altures;
    //   ara: pressió de superfície directa des del GFS)
    // ══════════════════════════════════════════════════════════════════

    let _elevationData = null;
    let _elevationLoading = false;
    let _elevationPromise = null;

    /**
     * Carrega el fitxer de pressió de superfície global (si no està ja carregat)
     * @param {string} url - Ruta al fitxer elevation_global.json (conté pressio superficial en hPa)
     * @returns {Promise<object|null>}
     */
    async function carregarElevacioGlobal(url) {
        if (_elevationData) return _elevationData;
        if (_elevationLoading) return _elevationPromise;

        _elevationLoading = true;
        _elevationPromise = (async () => {
            try {
                const resp = await fetch(url);
                if (!resp.ok) {
                    console.warn('[SkewT] No sha pogut carregar pressio superficial:', url);
                    _elevationLoading = false;
                    return null;
                }
                const json = await resp.json();

                const sp = json?.variables?.surface_pressure;
                if (!sp || !sp.datos || !json.coordenadas) {
                    console.warn('[SkewT] Format inesperat a', url, '(esperava variables.surface_pressure.datos)');
                    _elevationLoading = false;
                    return null;
                }

                _elevationData = {
                    coordenadas: json.coordenadas,
                    surfacePressure: sp.datos // hPa, array pla lat*lon
                };

                const valids = sp.datos.filter(v => v !== null && v !== undefined);
                console.log('[SkewT] Pressio superficial carregada | Min:', Math.min(...valids), 'hPa | Max:', Math.max(...valids), 'hPa');
                _elevationLoading = false;
                return _elevationData;
            } catch (e) {
                console.warn('[SkewT] Error carregant pressio superficial:', e.message);
                _elevationLoading = false;
                return null;
            }
        })();
        return _elevationPromise;
    }

    /**
     * Obté la pressió de superfície real (hPa) per a unes coordenades donades
     * @param {number} lat - Latitud
     * @param {number} lon - Longitud
     * @returns {number|null} - Pressió en hPa, o null si no disponible
     */
    function obtenirPressioSuperficieReal(lat, lon) {
        if (!_elevationData || !_elevationData.surfacePressure) return null;

        const lats = _elevationData.coordenadas.lat;
        const lons = _elevationData.coordenadas.lon;

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

        const Nlon = lons.length;
        const flatIdx = iBest * Nlon + jBest;
        const p = _elevationData.surfacePressure[flatIdx];
        return (p !== null && p !== undefined && !isNaN(p)) ? p : null;
    }

    // Mantinguda per compatibilitat amb codi que encara demani "elevació":
    // ara retorna null perquè ja no calculem elevació, treballem amb pressió directa.
    function obtenirElevacioTerreny(lat, lon) {
        return null;
    }

    /**
     * Converteix elevació del terreny a pressió aproximada (fórmula barométrica).
     * Es manté per compatibilitat però ja NO s'usa per obtenir la pressió real,
     * ja que ara la pressió de superfície ve directament del GFS.
     * @param {number} elevM - Elevació en metres
     * @returns {number} - Pressió en hPa
     */
    function elevacioAPressio(elevM) {
        if (elevM === null || elevM === undefined || !isFinite(elevM)) return 1013.25;
        const T0 = 288.15, p0 = 1013.25, lapse = 0.0065;
        return p0 * Math.pow(1.0 - (lapse * elevM) / T0, G0 / (RD * lapse));
    }

    // ─── UTILITATS BÀSIQUES ─────────────────────────────────────────────

    function esFinit(v) {
        return v !== null && v !== undefined && !isNaN(v) && isFinite(v);
    }

    function pressioAAlcada(pHpa) {
        const T0 = 288.15, p0 = 1013.25, lapse = 0.0065;
        return (T0 / lapse) * (1.0 - Math.pow(pHpa / p0, RD * lapse / G0));
    }

    function alcadaAPressio(zM) {
        const T0 = 288.15, p0 = 1013.25, lapse = 0.0065;
        return p0 * Math.pow(1.0 - (lapse * zM) / T0, G0 / (RD * lapse));
    }

    // Bolton (1980), eq. 10 — e_sat en hPa, T en °C
    function esatBolton(tC) { return 6.112 * Math.exp((17.67 * tC) / (tC + 243.5)); }
    function wsat(tC, pHpa) { const es = esatBolton(tC); return EPS * es / Math.max(pHpa - es, 0.1); }
    function tdFromRH(tC, rhPct) { const es = esatBolton(tC); const e = es * Math.max(0.01, Math.min(100, rhPct)) / 100; return (243.5 * Math.log(e / 6.112)) / (17.67 - Math.log(e / 6.112)); }

    // Bolton (1980), eq. 22 — temperatura del LCL
    function lclBolton(tC, tdC, pHpa) {
        const tK = tC + 273.15, tdK = tdC + 273.15;
        const tLclK = 1.0 / (1.0 / (tdK - 56.0) + Math.log(tK / tdK) / 800.0) + 56.0;
        const pLcl = pHpa * Math.pow(tLclK / tK, 1.0 / RD_CP);
        return { p: pLcl, t: tLclK - 273.15 };
    }

    function gradientHumit(tC, pHpa) {
        const tK = tC + 273.15, es = esatBolton(tC);
        const ws = EPS * es / Math.max(pHpa - es, 0.1);
        const num = 1.0 + (L * ws) / (RD * tK);
        const den = 1.0 + (0.622 * L * L * ws) / (CP * RD * tK * tK);
        return (RD * tK) / (CP * pHpa) * (num / den);
    }

    function perfilParcela(tSfc, tdSfc, pSfc, pLevels) {
        const lcl = lclBolton(tSfc, tdSfc, pSfc);
        const out = new Array(pLevels.length);
        for (let i = 0; i < pLevels.length; i++) {
            const pDest = pLevels[i];
            if (pDest >= pSfc) { out[i] = null; continue; }
            if (pDest >= lcl.p) {
                out[i] = (tSfc + 273.15) * Math.pow(pDest / pSfc, RD_CP) - 273.15;
            } else {
                let p = lcl.p, t = lcl.t;
                const nPassos = Math.max(1, Math.ceil((lcl.p - pDest) / 5));
                const dp = (lcl.p - pDest) / nPassos;
                for (let k = 0; k < nPassos; k++) {
                    const g1 = gradientHumit(t, p);
                    const tMig = t - g1 * (dp / 2);
                    const g2 = gradientHumit(tMig, p - dp / 2);
                    t = t - g2 * dp; p -= dp;
                }
                out[i] = t;
            }
        }
        return { valors: out, lcl };
    }

    // ══════════════════════════════════════════════════════════════════
    //  CÀLCUL D'ÍNDEXS TERMODINÀMICS
    // ══════════════════════════════════════════════════════════════════
    function calcularIndexsTermo(perfil, opcions) {
        const opt = opcions || {};
        const origen = opt.origenParcela || 'sfc';
        const { p, t, td } = perfil;
        const n = p.length;
        if (n < 3) return null;

        let pSfc = p[0], tSfc = t[0], tdSfc = td[0];
        let origenReal = 'sfc';
        let origenInfo = { p: p[0], t: t[0], td: td[0] };

        if (origen === 'ml') {
            const ml = mitjanaMixedLayer(perfil, esFinit(opt.dpMix) ? opt.dpMix : 100);
            if (ml) { pSfc = ml.p; tSfc = ml.t; tdSfc = ml.td; origenReal = 'ml'; origenInfo = ml; }
        } else if (origen === 'manual' && esFinit(opt.pManual)) {
            const niv = interpolarNivell(perfil, opt.pManual);
            if (niv) { pSfc = niv.p; tSfc = niv.t; tdSfc = niv.td; origenReal = 'manual'; origenInfo = niv; }
        }

        const { valors: tParcela, lcl } = perfilParcela(tSfc, tdSfc, pSfc, p);
        const z = p.map(pressioAAlcada);
        const buoy = new Array(n);
        for (let i = 0; i < n; i++) {
            if (tParcela[i] === null || !esFinit(t[i]) || p[i] >= pSfc) { buoy[i] = null; continue; }
            buoy[i] = tParcela[i] - t[i];
        }
        let cape = 0, cin = 0, lfcZ = null, elZ = null, candidatLFC = null, flotabilitatContinua = 0;
        const MIN_FLOTABILITAT_M = 2000;
        for (let i = 1; i < n; i++) {
            if (buoy[i] === null || buoy[i - 1] === null) continue;
            const dz = z[i] - z[i - 1]; if (dz <= 0) continue;
            const b0 = buoy[i - 1], b1 = buoy[i];
            const tk0 = t[i - 1] + 273.15, tk1 = t[i] + 273.15;
            const e0 = G0 * (b0 / tk0), e1 = G0 * (b1 / tk1);
            if (b0 >= 0 && b1 >= 0) {
                if (candidatLFC === null) { candidatLFC = z[i - 1]; flotabilitatContinua = 0; }
                flotabilitatContinua += dz; cape += 0.5 * (e0 + e1) * dz; elZ = z[i];
            } else if (b0 < 0 && b1 >= 0) {
                const frac = b0 / (b0 - b1), zCross = z[i - 1] + frac * dz;
                if (candidatLFC === null) { candidatLFC = zCross; flotabilitatContinua = 0; }
                if (lfcZ === null) cin += 0.5 * e0 * (zCross - z[i - 1]);
                flotabilitatContinua += (z[i] - zCross); cape += 0.5 * e1 * (z[i] - zCross); elZ = z[i];
            } else if (b0 >= 0 && b1 < 0) {
                const frac = b0 / (b0 - b1), zCross = z[i - 1] + frac * dz;
                flotabilitatContinua += (zCross - z[i - 1]); cape += 0.5 * e0 * (zCross - z[i - 1]);
                if (candidatLFC !== null && flotabilitatContinua >= MIN_FLOTABILITAT_M) {
                    if (lfcZ === null) lfcZ = candidatLFC;
                    elZ = zCross;
                }
                candidatLFC = null; flotabilitatContinua = 0;
            } else {
                if (lfcZ === null) cin += 0.5 * (e0 + e1) * dz;
                candidatLFC = null; flotabilitatContinua = 0;
            }
        }
        if (candidatLFC !== null && flotabilitatContinua >= MIN_FLOTABILITAT_M && lfcZ === null) lfcZ = candidatLFC;
        const lfc = lfcZ !== null ? alcadaAPressio(lfcZ) : null;
        const el = elZ !== null ? alcadaAPressio(elZ) : null;
        let li = null;
        const idx500 = p.reduce((best, pv, i) => (Math.abs(pv - 500) < Math.abs(p[best] - 500)) ? i : best, 0);
        if (Math.abs(p[idx500] - 500) < 40 && esFinit(t[idx500]) && p[idx500] < pSfc) {
            const tp500 = perfilParcela(tSfc, tdSfc, pSfc, [500]).valors[0];
            if (tp500 !== null) li = t[idx500] - tp500;
        }
        const cinFinal = (lfcZ !== null) ? Math.min(0, -Math.abs(cin)) : 0;
        const pwat = calcularAiguaPrecipitable(perfil);

        return {
            cape: Math.max(0, cape), cin: cinFinal,
            tSfc: t[0],
            lcl_p: lcl.p, lcl_t: lcl.t, lcl_z: pressioAAlcada(lcl.p),
            lfc_p: lfc, lfc_z: lfcZ, el_p: el, el_z: elZ, li: li,
            tParcela: tParcela, z: z,
            pwat: pwat,
            origenParcela: origenReal, origenParcelaInfo: origenInfo,
            pOrigenParcela: pSfc, tOrigenParcela: tSfc, tdOrigenParcela: tdSfc
        };
    }

    function mitjanaMixedLayer(perfil, dpMix) {
        if (!perfil || perfil.p.length < 2) return null;
        const pSfc = perfil.p[0], pTopMix = pSfc - (dpMix || 100);
        let sumT = 0, sumTd = 0, count = 0;
        for (let i = 0; i < perfil.p.length; i++) {
            if (perfil.p[i] >= pTopMix) { sumT += perfil.t[i]; sumTd += perfil.td[i]; count++; }
            else break;
        }
        if (count === 0) return null;
        return { p: pSfc, t: sumT / count, td: sumTd / count };
    }

    function interpolarNivell(perfil, pTarget) {
        if (!perfil || !perfil.p || perfil.p.length < 2) return null;
        const p = perfil.p, t = perfil.t, td = perfil.td;
        if (pTarget > p[0] || pTarget < p[p.length - 1]) return null;
        for (let i = 0; i < p.length - 1; i++) {
            if (p[i] >= pTarget && p[i + 1] <= pTarget) {
                const denom = (p[i] - p[i + 1]) || 1;
                const f = (p[i] - pTarget) / denom;
                return { p: pTarget, t: t[i] + f * (t[i + 1] - t[i]), td: td[i] + f * (td[i + 1] - td[i]) };
            }
            if (p[i] === pTarget) return { p: pTarget, t: t[i], td: td[i] };
        }
        return null;
    }

    function interpolarTAAlcada(perfil, zTarget) {
        if (!perfil || !perfil.z || perfil.z.length < 2) return null;
        const z = perfil.z, t = perfil.t;
        const zMin = z[0], zMax = z[z.length - 1];
        if (zTarget < zMin || zTarget > zMax) return null;
        for (let i = 0; i < z.length - 1; i++) {
            if (z[i] <= zTarget && z[i + 1] >= zTarget) {
                const denom = (z[i + 1] - z[i]) || 1;
                const f = (zTarget - z[i]) / denom;
                return t[i] + f * (t[i + 1] - t[i]);
            }
            if (z[i] === zTarget) return t[i];
        }
        return null;
    }

    function descendirSecAPressio(tC, pOrigen, pDesti) {
        if (!esFinit(tC) || !esFinit(pOrigen) || !esFinit(pDesti) || pOrigen <= 0) return null;
        const tK = tC + 273.15;
        const tDestiK = tK * Math.pow(pDesti / pOrigen, RD_CP);
        return tDestiK - 273.15;
    }

    function temperaturaBulbHumit(tC, tdC, pHpa) {
        if (!esFinit(tC) || !esFinit(tdC) || !esFinit(pHpa)) return null;
        if (tdC >= tC) return tC;

        const wObjectiu = wsat(tdC, pHpa);
        const RD_CP_LOCAL = RD_CP;
        const tK = tC + 273.15;

        function tDryAdiabat(p1) {
            return tK * Math.pow(p1 / pHpa, RD_CP_LOCAL) - 273.15;
        }

        let pLo = 50, pHi = pHpa;
        const fHi = wsat(tDryAdiabat(pHi), pHi) - wObjectiu;
        const fLo = wsat(tDryAdiabat(pLo), pLo) - wObjectiu;
        if (fHi < 0) {
            return tC;
        }
        let pLcl = pHpa;
        if (fLo > 0) {
            pLcl = lclBolton(tC, tdC, pHpa).p;
        } else {
            for (let iter = 0; iter < 40; iter++) {
                const pMig = (pLo + pHi) / 2;
                const fMig = wsat(tDryAdiabat(pMig), pMig) - wObjectiu;
                if (fMig > 0) pHi = pMig; else pLo = pMig;
            }
            pLcl = (pLo + pHi) / 2;
        }
        const tLcl = tDryAdiabat(pLcl);

        let p = pLcl, t = tLcl;
        const nPassos = Math.max(1, Math.ceil((pHpa - pLcl) / 5));
        const dp = (pHpa - pLcl) / nPassos;
        for (let k = 0; k < nPassos; k++) {
            const g1 = gradientHumit(t, p);
            const tMig = t + g1 * (dp / 2);
            const g2 = gradientHumit(tMig, p + dp / 2);
            t = t + g2 * dp; p += dp;
        }
        return t;
    }

    function calcularAiguaPrecipitable(perfil) {
        if (!perfil || !perfil.p || perfil.p.length < 2) return null;
        const p = perfil.p, td = perfil.td;
        let integral = 0;
        for (let i = 0; i < p.length - 1; i++) {
            if (!esFinit(td[i]) || !esFinit(td[i + 1])) continue;
            const w0 = wsat(td[i], p[i]);
            const w1 = wsat(td[i + 1], p[i + 1]);
            const dp = p[i] - p[i + 1];
            if (dp <= 0) continue;
            integral += 0.5 * (w0 + w1) * dp;
        }
        const pwatMm = (integral * 100) / G0;
        return esFinit(pwatMm) ? pwatMm : null;
    }

    function millorOrigenParcela(perfil, opcions) {
        if (!perfil || !perfil.p || perfil.p.length < 3) return null;
        const opt = opcions || {};
        const pLimit = esFinit(opt.pMinim) ? opt.pMinim : 500;
        const capeEpsilon = esFinit(opt.capeEpsilon) ? opt.capeEpsilon : 25;

        let millorP = perfil.p[0];
        let millorCape = -Infinity;
        let millorDiffTd = Infinity;

        for (let i = 0; i < perfil.p.length; i++) {
            const pNiv = perfil.p[i];
            if (pNiv > perfil.p[0] || pNiv < pLimit) continue;
            const t = perfil.t[i], td = perfil.td[i];
            if (!esFinit(t) || !esFinit(td)) continue;

            const idx = calcularIndexsTermo(perfil, { origenParcela: 'manual', pManual: pNiv });
            if (!idx) continue;
            const cape = idx.cape || 0;
            const diffTd = t - td;

            if (cape > millorCape + capeEpsilon) {
                millorCape = cape; millorP = pNiv; millorDiffTd = diffTd;
            } else if (Math.abs(cape - millorCape) <= capeEpsilon) {
                if (diffTd < millorDiffTd) {
                    millorCape = Math.max(millorCape, cape); millorP = pNiv; millorDiffTd = diffTd;
                }
            }
        }

        return esFinit(millorP) ? { p: millorP, cape: millorCape } : null;
    }

    function indexsAddicionals(perfil) {
        const { p, t, td } = perfil;
        function tAt(pTarget) { for (let i = 0; i < p.length - 1; i++) { if (p[i] >= pTarget && p[i + 1] <= pTarget) { const f = (p[i] - pTarget) / (p[i] - p[i + 1]); return t[i] + f * (t[i + 1] - t[i]); } } return null; }
        function tdAt(pTarget) { for (let i = 0; i < p.length - 1; i++) { if (p[i] >= pTarget && p[i + 1] <= pTarget) { const f = (p[i] - pTarget) / (p[i] - p[i + 1]); return td[i] + f * (td[i + 1] - td[i]); } } return null; }
        const t850 = tAt(850), td850 = tdAt(850), t700 = tAt(700), td700 = tdAt(700), t500 = tAt(500);
        let kIndex = null, totalsTotals = null, showalter = null;
        if (esFinit(t850) && esFinit(td850) && esFinit(t700) && esFinit(td700) && esFinit(t500)) { kIndex = (t850 - t500) + td850 - (t700 - td700); totalsTotals = (t850 + td850) - 2 * t500; }
        if (esFinit(t850) && esFinit(td850) && esFinit(t500)) { const tp500 = perfilParcela(t850, td850, 850, [500]).valors[0]; if (tp500 !== null) showalter = t500 - tp500; }
        return { kIndex, totalsTotals, showalter };
    }

    // ══════════════════════════════════════════════════════════════════
    //  VENT
    // ══════════════════════════════════════════════════════════════════

    function bulkShear(uBase, vBase, uTop, vTop) { const du = uTop - uBase, dv = vTop - vBase; return Math.sqrt(du * du + dv * dv); }

    function stormMotionBunkers(uMean06, vMean06, uShear06, vShear06) {
        const shearMag = Math.sqrt(uShear06 * uShear06 + vShear06 * vShear06);
        if (shearMag < 0.1) return { right: { u: uMean06, v: vMean06 }, left: { u: uMean06, v: vMean06 } };
        const D = 7.5, uPerpR = D * (vShear06 / shearMag), vPerpR = D * (-uShear06 / shearMag);
        return { right: { u: uMean06 + uPerpR, v: vMean06 + vPerpR }, left: { u: uMean06 - uPerpR, v: vMean06 - vPerpR } };
    }

    function calcularSRH(nivells, stormU, stormV, zBase, zTop) {
        let srh = 0;
        for (let i = 0; i < nivells.length - 1; i++) {
            const a = nivells[i], b = nivells[i + 1];
            if (a.z > zTop || b.z < zBase) continue;
            let z0 = Math.max(a.z, zBase), z1 = Math.min(b.z, zTop); if (z1 <= z0) continue;
            const frac0 = (z0 - a.z) / (b.z - a.z || 1), frac1 = (z1 - a.z) / (b.z - a.z || 1);
            const u0 = a.u + frac0 * (b.u - a.u), v0 = a.v + frac0 * (b.v - a.v);
            const u1 = a.u + frac1 * (b.u - a.u), v1 = a.v + frac1 * (b.v - a.v);
            srh += (u0 - stormU) * (v1 - stormV) - (u1 - stormU) * (v0 - stormV);
        }
        return srh;
    }

    function ventMitja(nivells, zBase, zTop) {
        let sumU = 0, sumV = 0, sumW = 0;
        for (let i = 0; i < nivells.length - 1; i++) {
            const a = nivells[i], b = nivells[i + 1];
            if (a.z > zTop || b.z < zBase) continue;
            let z0 = Math.max(a.z, zBase), z1 = Math.min(b.z, zTop); if (z1 <= z0) continue;
            const frac0 = (z0 - a.z) / (b.z - a.z || 1), frac1 = (z1 - a.z) / (b.z - a.z || 1);
            const u0 = a.u + frac0 * (b.u - a.u), v0 = a.v + frac0 * (b.v - a.v);
            const u1 = a.u + frac1 * (b.u - a.u), v1 = a.v + frac1 * (b.v - a.v);
            const w = z1 - z0;
            sumU += 0.5 * (u0 + u1) * w; sumV += 0.5 * (v0 + v1) * w; sumW += w;
        }
        if (sumW === 0) return null;
        return { u: sumU / sumW, v: sumV / sumW };
    }

    function ventAAlcada(nivells, zTarget) {
        for (let i = 0; i < nivells.length - 1; i++) {
            const a = nivells[i], b = nivells[i + 1];
            if (zTarget >= a.z && zTarget <= b.z) { const f = (zTarget - a.z) / (b.z - a.z || 1); return { u: a.u + f * (b.u - a.u), v: a.v + f * (b.v - a.v) }; }
        }
        if (zTarget <= nivells[0].z) return { u: nivells[0].u, v: nivells[0].v };
        return { u: nivells[nivells.length - 1].u, v: nivells[nivells.length - 1].v };
    }

    function calcularVentComposite(nivellsVent, zSfc) {
        if (!nivellsVent || nivellsVent.length < 3) return null;
        const niv = nivellsVent.map(n => ({ z: n.z - zSfc, u: n.u, v: n.v })).filter(n => n.z >= -10).sort((a, b) => a.z - b.z);
        if (niv.length < 3) return null;
        const sfc = ventAAlcada(niv, 0), v1km = ventAAlcada(niv, 1000), v3km = ventAAlcada(niv, 3000), v6km = ventAAlcada(niv, 6000), v8km = ventAAlcada(niv, 8000);
        const shear01 = bulkShear(sfc.u, sfc.v, v1km.u, v1km.v), shear03 = bulkShear(sfc.u, sfc.v, v3km.u, v3km.v);
        const shear06 = bulkShear(sfc.u, sfc.v, v6km.u, v6km.v), shear08 = bulkShear(sfc.u, sfc.v, v8km.u, v8km.v);
        const mean06 = ventMitja(niv, 0, 6000) || v6km;
        const uShear06 = v6km.u - sfc.u, vShear06 = v6km.v - sfc.v;
        const bunkers = stormMotionBunkers(mean06.u, mean06.v, uShear06, vShear06);
        const srh01 = calcularSRH(niv, bunkers.right.u, bunkers.right.v, 0, 1000);
        const srh03 = calcularSRH(niv, bunkers.right.u, bunkers.right.v, 0, 3000);
        return { niv, sfc, v1km, v3km, v6km, v8km, shear01, shear03, shear06, shear08, mean06, bunkers, srh01, srh03 };
    }

    // ══════════════════════════════════════════════════════════════════
    //  EXTRACCION DE PERFIL — ADAPTAT PER GFS + PRESSIÓ DE SUPERFÍCIE REAL
    // ══════════════════════════════════════════════════════════════════

    function indexGraellaMesProper(lats, lons, lat, lon) {
        let iBest = 0, bestDLat = Infinity; for (let i = 0; i < lats.length; i++) { const d = Math.abs(lats[i] - lat); if (d < bestDLat) { bestDLat = d; iBest = i; } }
        let jBest = 0, bestDLon = Infinity; for (let j = 0; j < lons.length; j++) { const d = Math.abs(lons[j] - lon); if (d < bestDLon) { bestDLon = d; jBest = j; } }
        return { i: iBest, j: jBest };
    }

    function filaRealPerIndex(lats, i) { const latNord = lats[0] > lats[lats.length - 1]; return latNord ? (lats.length - 1 - i) : i; }

    function extreurePerfilGFS(data, lat, lon, spSuperficieOverride) {
        const vars = data.variables || {};
        const coords = data.coordenadas;
        if (!coords) return null;

        const out = { p: [], t: [], td: [], u: [], v: [] };

        // ═══ OBTENIR PRESSIÓ DE SUPERFÍCIE REAL (GFS, directa) ═══
        let pSfcReal = null;
        if (_elevationData) {
            pSfcReal = obtenirPressioSuperficieReal(lat, lon);
        }

        let pSfc = null, tSfc = null, tdSfc = null, uSfc = null, vSfc = null;

        // Variables de superfície (GFS SFC)
        if (coords && vars.temperature && vars.temperature.datos) {
            const idx = indexGraellaMesProper(coords.lat, coords.lon, lat, lon);
            const Nlon = coords.lon.length;
            const filaReal = filaRealPerIndex(coords.lat, idx.i);
            const flatIdx = filaReal * Nlon + idx.j;

            // Temperatura
            const rawT = vars.temperature.datos[flatIdx];
            tSfc = esFinit(rawT) ? rawT : null;

            // Punt de rosada
            if (vars.dew_point && vars.dew_point.datos) {
                const rawTd = vars.dew_point.datos[flatIdx];
                tdSfc = esFinit(rawTd) ? rawTd : null;
            }

            // Pressió MSL del model (fallback si no hi ha pressió real)
            if (vars.mslp && vars.mslp.datos) {
                pSfc = vars.mslp.datos[flatIdx];
            }

            // Vent
            if (vars.wind_u && vars.wind_u.datos) uSfc = vars.wind_u.datos[flatIdx];
            if (vars.wind_v && vars.wind_v.datos) vSfc = vars.wind_v.datos[flatIdx];
        }

        if (spSuperficieOverride && esFinit(spSuperficieOverride)) pSfc = spSuperficieOverride;

        // ═══ USAR PRESSIÓ REAL DE SUPERFÍCIE SI DISPONIBLE ═══
        // Abans es calculava a partir de l'elevació del terreny; ara ve
        // directament del GFS (typeOfLevel=surface, 'sp'), així que no cal
        // cap descens adiabàtic per obtenir-la — només ajustem la
        // temperatura si la pressió real difereix de la MSL usada pel model.
        if (esFinit(pSfcReal) && esFinit(tSfc) && esFinit(pSfc) && Math.abs(pSfcReal - pSfc) > 0.5) {
            const tSfcReal = descendirSecAPressio(tSfc, pSfc, pSfcReal);
            if (esFinit(tSfcReal)) {
                tSfc = tSfcReal;
            }
            pSfc = pSfcReal;
        }

        // Afegir superfície
        if (esFinit(pSfc) && esFinit(tSfc) && esFinit(tdSfc)) {
            out.p.push(pSfc);
            out.t.push(tSfc);
            out.td.push(tdSfc);
            out.u.push(esFinit(uSfc) ? uSfc : 0);
            out.v.push(esFinit(vSfc) ? vSfc : 0);
        }

        // Nivells de pressió (GFS PRES)
        const nivellsTrobats = new Set();
        Object.keys(vars).forEach(key => {
            const match = key.match(/^([a-z]+)_(\d+)$/);
            if (match && match[1] === 't') {
                nivellsTrobats.add(parseInt(match[2]));
            }
        });

        const nivellsOrdenats = Array.from(nivellsTrobats).sort((a, b) => b - a);

        if (coords) {
            const idx3d = indexGraellaMesProper(coords.lat, coords.lon, lat, lon);
            const Nlon3 = coords.lon.length;
            const filaReal3 = filaRealPerIndex(coords.lat, idx3d.i);
            const flatIdx3 = filaReal3 * Nlon3 + idx3d.j;

            nivellsOrdenats.forEach(niv => {
                if (pSfc !== null && niv >= pSfc) return;

                const kt = 't_' + niv;
                if (!vars[kt] || !vars[kt].datos) return;
                let tv = vars[kt].datos[flatIdx3];
                if (!esFinit(tv)) return;

                const kr = 'r_' + niv;
                let tdv = null;
                if (vars[kr] && vars[kr].datos) {
                    const rawRh = vars[kr].datos[flatIdx3];
                    if (esFinit(rawRh)) {
                        tdv = tdFromRH(tv, rawRh);
                    }
                }
                if (!esFinit(tdv)) return;

                const ku = 'u_' + niv, kv = 'v_' + niv;
                let uv = 0, vv = 0;
                if (vars[ku] && vars[ku].datos) uv = vars[ku].datos[flatIdx3];
                if (vars[kv] && vars[kv].datos) vv = vars[kv].datos[flatIdx3];
                if (!esFinit(uv)) uv = 0;
                if (!esFinit(vv)) vv = 0;

                out.p.push(niv);
                out.t.push(tv);
                out.td.push(tdv);
                out.u.push(uv);
                out.v.push(vv);
            });
        }

        const idxOrdre = out.p.map((_, i) => i).sort((a, b) => out.p[b] - out.p[a]);
        const net = { p: [], t: [], td: [], u: [], v: [] };
        let lastP = Infinity;
        idxOrdre.forEach(i => {
            if (out.p[i] >= lastP) return;
            net.p.push(out.p[i]);
            net.t.push(out.t[i]);
            net.td.push(out.td[i]);
            net.u.push(out.u[i]);
            net.v.push(out.v[i]);
            lastP = out.p[i];
        });

        if (net.p.length < 3) return null;
        net.z = net.p.map(pressioAAlcada);

        // Afegir informació de pressió de superfície real al perfil
        net.pSfcReal = pSfcReal;

        return net;
    }

    function extreurePerfil(data, lat, lon, spSuperficieOverride) {
        return extreurePerfilGFS(data, lat, lon, spSuperficieOverride);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  SARS
    // ═══════════════════════════════════════════════════════════════════════

    const PERFILS_REFERENCIA = [
        { nom: 'Tempesta ordinària (pols)', icon: '', tSfc: { min: 18, max: 34 }, cape: { min: 100, max: 800 }, cin: { min: -300, max: 0 }, li: { min: -2, max: 2 }, lcl: { min: 800, max: 2000 }, lfc: { min: 1000, max: 3500 }, el: { min: 5000, max: 9000 }, shear06: { min: 5, max: 15 }, srh01: { min: 0, max: 80 }, srh03: { min: 0, max: 150 }, desc: 'Tempestes disperses de curta durada. Calamarsa petita, vents moderats. Baix potencial sever.', nivellRisc: 1 },
        { nom: 'Tempesta ordinària (organitzada)', icon: '', tSfc: { min: 16, max: 32 }, cape: { min: 500, max: 1500 }, cin: { min: -200, max: -10 }, li: { min: -4, max: -1 }, lcl: { min: 600, max: 1800 }, lfc: { min: 800, max: 3000 }, el: { min: 6000, max: 11000 }, shear06: { min: 10, max: 20 }, srh01: { min: 20, max: 120 }, srh03: { min: 50, max: 200 }, desc: 'Tempestes que poden organitzar-se. Calamarsa moderada, vents forts. Risc moderat.', nivellRisc: 2 },
        { nom: 'Multicèl·lula', icon: '', tSfc: { min: 15, max: 32 }, cape: { min: 1000, max: 2500 }, cin: { min: -150, max: -10 }, li: { min: -6, max: -2 }, lcl: { min: 500, max: 1500 }, lfc: { min: 600, max: 2500 }, el: { min: 8000, max: 13000 }, shear06: { min: 15, max: 28 }, srh01: { min: 50, max: 180 }, srh03: { min: 100, max: 300 }, desc: 'Tempestes organitzades en grup. Calamarsa mitjana-gran, vents molt forts, possible inundació.', nivellRisc: 3 },
        { nom: 'Supercèl·lula clàssica', icon: '', tSfc: { min: 16, max: 34 }, cape: { min: 1500, max: 4000 }, cin: { min: -120, max: -10 }, li: { min: -10, max: -4 }, lcl: { min: 500, max: 1500 }, lfc: { min: 500, max: 2000 }, el: { min: 9000, max: 14000 }, shear06: { min: 20, max: 40 }, srh01: { min: 100, max: 400 }, srh03: { min: 150, max: 600 }, desc: 'Tempesta rotatòria amb mesocicló. Calamarsa gran, vents destructors, tornado possible.', nivellRisc: 4 },
        { nom: 'Supercèl·lula HP', icon: '', tSfc: { min: 18, max: 34 }, cape: { min: 2000, max: 5000 }, cin: { min: -100, max: -5 }, li: { min: -12, max: -5 }, lcl: { min: 400, max: 1000 }, lfc: { min: 400, max: 1500 }, el: { min: 10000, max: 15000 }, shear06: { min: 15, max: 30 }, srh01: { min: 100, max: 350 }, srh03: { min: 150, max: 500 }, desc: 'Precipitació extrema, calamarsa gran, inundacions sobtades. Tornado possible.', nivellRisc: 4 },
        { nom: 'Supercèl·lula LP', icon: '', tSfc: { min: 16, max: 34 }, cape: { min: 1000, max: 3000 }, cin: { min: -150, max: -20 }, li: { min: -8, max: -3 }, lcl: { min: 1000, max: 2500 }, lfc: { min: 800, max: 2500 }, el: { min: 8000, max: 13000 }, shear06: { min: 25, max: 50 }, srh01: { min: 150, max: 500 }, srh03: { min: 250, max: 800 }, desc: 'Poca pluja però calamarsa gegant. Tornado violent possible.', nivellRisc: 5 },
        { nom: 'Tempesta tropical / huracà', icon: '', tSfc: { min: 22, max: 34 }, cape: { min: 500, max: 2500 }, cin: { min: -50, max: 0 }, li: { min: -3, max: 2 }, lcl: { min: 300, max: 800 }, lfc: { min: 400, max: 1200 }, el: { min: 10000, max: 16000 }, shear06: { min: 3, max: 15 }, srh01: { min: 200, max: 800 }, srh03: { min: 300, max: 1000 }, desc: 'Pluges torrencials, vents huracanats. Baixa activitat elèctrica.', nivellRisc: 5 },
        { nom: 'Tempesta seca', icon: '', tSfc: { min: 22, max: 40 }, cape: { min: 1000, max: 3500 }, cin: { min: -200, max: -30 }, li: { min: -7, max: -2 }, lcl: { min: 2000, max: 4000 }, lfc: { min: 2000, max: 4000 }, el: { min: 7000, max: 12000 }, shear06: { min: 10, max: 25 }, srh01: { min: 30, max: 200 }, srh03: { min: 80, max: 350 }, desc: 'Llamps sense pluja. Risc extrem d\'incendis.', nivellRisc: 3 },
        { nom: 'Tempesta hivernal', icon: '', tSfc: { min: -15, max: 2 }, cape: { min: 0, max: 300 }, cin: { min: -500, max: -100 }, li: { min: 0, max: 5 }, lcl: { min: 200, max: 800 }, lfc: { min: 3000, max: 6000 }, el: { min: 4000, max: 8000 }, shear06: { min: 10, max: 30 }, srh01: { min: 50, max: 300 }, srh03: { min: 100, max: 500 }, desc: 'Neu intensa, vents forts.', nivellRisc: 2 },
        { nom: 'Dret / bow echo', icon: '', tSfc: { min: 18, max: 36 }, cape: { min: 1500, max: 4000 }, cin: { min: -80, max: -5 }, li: { min: -10, max: -4 }, lcl: { min: 600, max: 1500 }, lfc: { min: 600, max: 2000 }, el: { min: 8000, max: 14000 }, shear06: { min: 25, max: 55 }, srh01: { min: -250, max: 250 }, srh03: { min: -300, max: 300 }, desc: 'Vents destructors en línia recta (>120 km/h).', nivellRisc: 5 },
        { nom: 'Multicèl·lula d\'alt CAPE (sense rotació)', icon: '', tSfc: { min: 18, max: 38 }, cape: { min: 2500, max: 6000 }, cin: { min: -450, max: -20 }, li: { min: -14, max: -5 }, lcl: { min: 600, max: 2200 }, lfc: { min: 1500, max: 4500 }, el: { min: 9000, max: 14000 }, shear06: { min: 15, max: 42 }, srh01: { min: -300, max: 60 }, srh03: { min: -400, max: 100 }, desc: 'Inestabilitat extrema sense rotació. Calamarsa molt gran, downbursts.', nivellRisc: 4 }
    ];

    function similitudRang(valor, rang) {
        if (valor >= rang.min && valor <= rang.max) return 1.0;
        const amplitud = Math.max(rang.max - rang.min, 1);
        const diff = valor < rang.min ? (rang.min - valor) : (valor - rang.max);
        const x = Math.min(1, diff / amplitud);
        let s = Math.max(0, 1 - x * x);
        if (rang.min > 0 && valor < 0) s *= 0.15;
        else if (rang.max < 0 && valor > 0) s *= 0.15;
        return s;
    }

    function factorGate(similitudVariable) {
        if (similitudVariable >= 0.35) return 1.0;
        const t = similitudVariable / 0.35;
        return Math.max(0, t * t * t);
    }

    function calcularSimilitudSARS(indexsActual, ventActual, perfilRef) {
        const tSfc = esFinit(indexsActual.tSfc) ? indexsActual.tSfc : null;
        const cape = indexsActual.cape || 0, cin = indexsActual.cin || 0, li = indexsActual.li || 0;
        const lcl = indexsActual.lcl_z || 1500, lfc = indexsActual.lfc_z || 2000, el = indexsActual.el_z || 10000;
        const shear06 = ventActual ? ventActual.shear06 : 0;
        const srh01 = ventActual ? ventActual.srh01 : 0;
        const srh03 = ventActual ? ventActual.srh03 : 0;

        const sCape = similitudRang(cape, perfilRef.cape), sCin = similitudRang(cin, perfilRef.cin), sLi = similitudRang(li, perfilRef.li);
        const sLcl = similitudRang(lcl, perfilRef.lcl), sLfc = similitudRang(lfc, perfilRef.lfc), sEl = similitudRang(el, perfilRef.el);
        const sShear06 = similitudRang(shear06, perfilRef.shear06), sSrh01 = similitudRang(srh01, perfilRef.srh01), sSrh03 = similitudRang(srh03, perfilRef.srh03);
        const sTsfc = (tSfc !== null && perfilRef.tSfc) ? similitudRang(tSfc, perfilRef.tSfc) : 1.0;

        const pes = { tSfc: 0.10, cape: 0.18, cin: 0.09, li: 0.09, lcl: 0.09, lfc: 0.09, el: 0.05, shear06: 0.13, srh01: 0.09, srh03: 0.09 };
        const scoreBase = pes.tSfc * sTsfc + pes.cape * sCape + pes.cin * sCin + pes.li * sLi +
                           pes.lcl * sLcl + pes.lfc * sLfc + pes.el * sEl +
                           pes.shear06 * sShear06 + pes.srh01 * sSrh01 + pes.srh03 * sSrh03;

        const gate = factorGate(sTsfc) * factorGate(sCape) * factorGate(sSrh01);
        return Math.round(scoreBase * gate * 100);
    }

    function trobarAnàlegsSARS(indexsActual, ventActual) {
        return PERFILS_REFERENCIA.map(ref => ({ ...ref, similitud: calcularSimilitudSARS(indexsActual, ventActual, ref) })).sort((a, b) => b.similitud - a.similitud);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  EXPORT
    // ═══════════════════════════════════════════════════════════════════════

    global.SkewtEngine = {
        NIVELLS_PRESSIO,
        esFinit,
        pressioAAlcada,
        alcadaAPressio,
        esatBolton,
        wsat,
        tdFromRH,
        lclBolton,
        gradientHumit,
        perfilParcela,
        calcularIndexsTermo,
        indexsAddicionals,
        mitjanaMixedLayer,
        interpolarNivell,
        millorOrigenParcela,
        interpolarTAAlcada,
        descendirSecAPressio,
        temperaturaBulbHumit,
        calcularAiguaPrecipitable,
        bulkShear,
        stormMotionBunkers,
        calcularSRH,
        ventMitja,
        ventAAlcada,
        calcularVentComposite,
        indexGraellaMesProper,
        filaRealPerIndex,
        extreurePerfil,
        extreurePerfilGFS,
        // Funcions de pressió de superfície (abans elevació)
        carregarElevacioGlobal,
        obtenirElevacioTerreny,
        obtenirPressioSuperficieReal,
        elevacioAPressio,
        PERFILS_REFERENCIA,
        calcularSimilitudSARS,
        trobarAnàlegsSARS
    };

})(window);