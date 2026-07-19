// ═══════════════════════════════════════════════════════════════════════
//  skewt-engine.js — Motor termodinàmic i de vent per al Skew-T
//  Sense dependències, JS pur. No toca el DOM.
//  Llegeix el format de dades produït per t_final_blindado.py / mapa.js
//  Inclou: SARS (Sounding Analog Retrieval System)
//
//  ── REVISIÓ FÍSICA/MATEMÀTICA ──────────────────────────────────────────
//  Verificat contra: Bolton (1980, Mon. Wea. Rev. 108), SHARPpy
//  (sharptab/winds.py — non_parcel_bunkers_motion), i les definicions
//  estàndard de LFC/EL/CAPE/CIN de l'AMS Glossary i SPC.
//  Únic canvi funcional: FIX #1 a calcularIndexsTermo() (vegeu comentari
//  al costat). La resta del motor (Bolton e_sat, LCL, gradient
//  pseudoadiabàtic, Bunkers, SRH) és correcte i s'ha deixat intacte.
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

    const NIVELLS_PRESSIO = [1000, 950, 925, 900, 875, 850, 800, 750, 700, 650,
                              600, 550, 500, 450, 400, 350, 300, 250, 200, 150, 100];

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

    // Bolton (1980), eq. 10 — e_sat en hPa, T en °C. Verificat: fórmula estàndard.
    function esatBolton(tC) { return 6.112 * Math.exp((17.67 * tC) / (tC + 243.5)); }
    function wsat(tC, pHpa) { const es = esatBolton(tC); return EPS * es / Math.max(pHpa - es, 0.1); }
    function tdFromRH(tC, rhPct) { const es = esatBolton(tC); const e = es * Math.max(0.01, Math.min(100, rhPct)) / 100; return (243.5 * Math.log(e / 6.112)) / (17.67 - Math.log(e / 6.112)); }

    // Bolton (1980), eq. 22 — temperatura del LCL. Verificat: constants
    // (56.0, 800.0) i estructura coincideixen amb la fórmula publicada.
    function lclBolton(tC, tdC, pHpa) {
        const tK = tC + 273.15, tdK = tdC + 273.15;
        const tLclK = 1.0 / (1.0 / (tdK - 56.0) + Math.log(tK / tdK) / 800.0) + 56.0;
        const pLcl = pHpa * Math.pow(tLclK / tK, 1.0 / RD_CP);
        return { p: pLcl, t: tLclK - 273.15 };
    }

    // Gradient pseudoadiabàtic saturat Γ_sw = (g/cp)·[(1+D)/(1+F·D)] amb
    // D = L·w_sat/(Rd·T). Verificat contra la formulació estàndard
    // (Durran & Klemp 1982 / Emanuel 1994 / AMS Glossary). Correcte.
    function gradientHumit(tC, pHpa) {
        const tK = tC + 273.15, es = esatBolton(tC);
        const ws = EPS * es / Math.max(pHpa - es, 0.1);
        const num = 1.0 + (L * ws) / (RD * tK);
        const den = 1.0 + (0.622 * L * L * ws) / (CP * RD * tK * tK);
        return (RD * tK) / (CP * pHpa) * (num / den);
    }

    function perfilMixedLayer(perfil, dpMix) {
        if (!perfil || perfil.p.length < 2) return null;
        const pSfc = perfil.p[0], pTopMix = pSfc - (dpMix || 100);
        let sumT = 0, sumTd = 0, count = 0;
        for (let i = 0; i < perfil.p.length; i++) {
            if (perfil.p[i] >= pTopMix) { sumT += perfil.t[i]; sumTd += perfil.td[i]; count++; }
            else break;
        }
        if (count === 0) return null;
        return perfilParcela(sumT / count, sumTd / count, pSfc, perfil.p);
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
    //  TEMPERATURA DE BULB HUMIT (Tw)
    //  ------------------------------------------------------------------
    //  Mètode estàndard (Millersville Univ. / procediment equivalent al
    //  de SHARPpy `thermo.wetbulb`): a cada nivell de pressió,
    //    1) des del punt de rosada, es puja seguint una línia de ràtio
    //       de mescla constant (w = wsat(Td, p)) fins trobar el punt on
    //       aquesta creua la dry adiabat que passa per la temperatura
    //       ambient en aquell nivell — això dona el "LCL local".
    //    2) des d'aquesta intersecció, es baixa pseudoadiabàticament
    //       (igual que `perfilParcela` fa per sobre del LCL) fins tornar
    //       al nivell de pressió original.
    //    3) la temperatura resultant en aquest punt és Tw.
    //  Es resol el pas (1) amb bisecció sobre la pressió del LCL local,
    //  ja que no hi ha una fórmula tancada senzilla (com Bolton per LCL
    //  normal) quan es parteix del punt de rosada en lloc de T i Td junts.
    function temperaturaBulbHumit(tC, tdC, pHpa) {
        if (!esFinit(tC) || !esFinit(tdC) || !esFinit(pHpa)) return null;
        if (tdC >= tC) return tC; // aire ja saturat: Tw = T = Td

        const wObjectiu = wsat(tdC, pHpa); // ràtio de mescla del punt de rosada real
        const RD_CP_LOCAL = RD_CP;
        const tK = tC + 273.15;

        // Funció: donada una pressió p1 <= pHpa, la temperatura sobre la
        // dry adiabat que surt de (tC, pHpa) en arribar a p1.
        function tDryAdiabat(p1) {
            return tK * Math.pow(p1 / pHpa, RD_CP_LOCAL) - 273.15;
        }

        // Cerquem, per bisecció, la pressió p1 on w_sat(tDryAdiabat(p1), p1)
        // == wObjectiu. A mesura que puja (p1 baixa), la dry adiabat es
        // refreda i wsat baixa; wObjectiu és constant. Busquem el creuament.
        let pLo = 50, pHi = pHpa;
        // Comprovació de signe als extrems abans de bisectar
        const fHi = wsat(tDryAdiabat(pHi), pHi) - wObjectiu; // ~ (wsat(tC,pHpa) - wObjectiu), >=0 normalment
        const fLo = wsat(tDryAdiabat(pLo), pLo) - wObjectiu;
        if (fHi < 0) {
            // Cas ja saturat pràcticament en superfície
            return tC;
        }
        let pLcl = pHpa;
        if (fLo > 0) {
            // No hem trobat creuament fins a 50 hPa (extremadament rar);
            // fem servir el LCL de Bolton com a aproximació de seguretat.
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

        // Baixem pseudoadiabàticament de pLcl a pHpa (procés invers al de
        // perfilParcela, que hi puja; aquí el gradient és positiu en
        // baixar, per tant sumem en lloc de restar).
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

    // Calcula Tw a tot un perfil (mateix format d'entrada/sortida que
    // `perfilParcela`: array paral·lel als nivells de pressió del sondeig).
    function perfilBulbHumit(perfil) {
        if (!perfil || !perfil.p) return null;
        const out = new Array(perfil.p.length);
        for (let i = 0; i < perfil.p.length; i++) {
            out[i] = temperaturaBulbHumit(perfil.t[i], perfil.td[i], perfil.p[i]);
        }
        return out;
    }

    // ══════════════════════════════════════════════════════════════════
    //  FIX #1 (ÚNIC CANVI FUNCIONAL DE TOTA LA REVISIÓ)
    //  ------------------------------------------------------------------
    //  Bug original: en tancar un tram de flotabilitat positiva
    //  (b0>=0 && b1<0), el codi feia `elZ = zCross` INCONDICIONALMENT,
    //  encara que aquest tram no arribés al gruix mínim per ser
    //  considerat un LFC vàlid (`flotabilitatContinua < MIN_FLOTABILITAT_M`).
    //
    //  Conseqüència física: una capa fina de flotabilitat espúria a
    //  nivells alts (p.ex. per soroll numèric o una petita inversió
    //  tallada) podia sobreescriure un EL ja calculat correctament més
    //  avall, deixant un EL fals i, per tant, un CAPE mal delimitat
    //  visualment (tot i que la integral de CAPE en si —que només suma
    //  quan hi ha flotabilitat positiva— no es veia afectada en valor).
    //
    //  Definició de referència (AMS Glossary / SPC / Markowski &
    //  Richardson): l'EL és el nivell, per sobre del LFC, on la parcel·la
    //  torna a ser negativament flotant. És a dir, l'EL ha d'anar
    //  aparellat amb un LFC real, no amb qualsevol creuament de signe.
    //
    //  Correcció: `elZ` només s'actualitza quan el tram que es tanca
    //  compleix el mateix criteri de gruix mínim que ja s'exigia per
    //  confirmar `lfcZ`.
    // ══════════════════════════════════════════════════════════════════
    function calcularIndexsTermo(perfil) {
        const { p, t, td } = perfil;
        const n = p.length;
        if (n < 3) return null;
        const pSfc = p[0], tSfc = t[0], tdSfc = td[0];
        const { valors: tParcela, lcl } = perfilParcela(tSfc, tdSfc, pSfc, p);
        const z = p.map(pressioAAlcada);
        const buoy = new Array(n);
        for (let i = 0; i < n; i++) {
            if (tParcela[i] === null || !esFinit(t[i])) { buoy[i] = null; continue; }
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
                // FIX #1: abans `elZ = zCross;` s'executava sempre.
                // Ara només es confirma elZ (i lfcZ, com ja era el cas)
                // si el tram tancat arriba al gruix mínim exigit.
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
        if (Math.abs(p[idx500] - 500) < 40 && esFinit(t[idx500])) {
            const tp500 = perfilParcela(tSfc, tdSfc, pSfc, [500]).valors[0];
            if (tp500 !== null) li = t[idx500] - tp500;
        }
        // FIX CIN: la definició estàndard (AMS Glossary, Stull) diu que el
        // CIN és l'energia necessària per portar la parcel·la des de la
        // superfície/LCL fins al LFC. Si el sondeig no arriba MAI a tenir
        // un LFC vàlid (flotabilitat positiva prou gruixuda), `lfcZ` es
        // manté `null` durant tot el bucle, i la condició `if (lfcZ ===
        // null) cin += ...` era certa a CADA capa negativa del sondeig
        // sencer — no només "fins al LFC", perquè no n'hi ha cap. Això
        // acumulava la inhibició de desenes de capes de dalt a baix del
        // perfil, donant valors físicament absurds (p. ex. -10000 J/kg).
        // Igual que CAPE només té sentit si hi ha LFC (per tant es posa a
        // 0 si no n'hi ha), el CIN tampoc té sentit acumulat sense LFC:
        // es reporta 0 en aquest cas, en lloc de la suma bruta.
        const cinFinal = (lfcZ !== null) ? Math.min(0, -Math.abs(cin)) : 0;

        // FIX SARS: s'exposa tSfc (abans es calculava però mai sortia de
        // la funció), necessari perquè trobarAnàlegsSARS pugui descartar
        // tipus de tempesta físicament incompatibles amb la temperatura
        // real de superfície (p. ex. "Tempesta hivernal" amb 30°C).
        return { cape: Math.max(0, cape), cin: cinFinal, tSfc: tSfc, lcl_p: lcl.p, lcl_t: lcl.t, lcl_z: pressioAAlcada(lcl.p), lfc_p: lfc, lfc_z: lfcZ, el_p: el, el_z: elZ, li: li, tParcela: tParcela, z: z };
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

    function bulkShear(uBase, vBase, uTop, vTop) { const du = uTop - uBase, dv = vTop - vBase; return Math.sqrt(du * du + dv * dv); }

    // Bunkers (2000) — verificat signe per signe contra la implementació
    // de referència de SHARPpy (sharptab/winds.py, non_parcel_bunkers_motion):
    //   tmp = D/|shear|
    //   rstu = mean.u + tmp*shear.v      rstv = mean.v - tmp*shear.u
    //   lstu = mean.u - tmp*shear.v      lstv = mean.v + tmp*shear.u
    // El codi ja tenia exactament aquest signe (uPerpR=D·v/|shear|,
    // vPerpR=D·(-u)/|shear|). Sense canvis.
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

    function indexGraellaMesProper(lats, lons, lat, lon) {
        let iBest = 0, bestDLat = Infinity; for (let i = 0; i < lats.length; i++) { const d = Math.abs(lats[i] - lat); if (d < bestDLat) { bestDLat = d; iBest = i; } }
        let jBest = 0, bestDLon = Infinity; for (let j = 0; j < lons.length; j++) { const d = Math.abs(lons[j] - lon); if (d < bestDLon) { bestDLon = d; jBest = j; } }
        return { i: iBest, j: jBest };
    }

    function filaRealPerIndex(lats, i) { const latNord = lats[0] > lats[lats.length - 1]; return latNord ? (lats.length - 1 - i) : i; }

    function extreurePerfil(data, lat, lon, spSuperficieOverride) {
        const vars = data.variables || {}, coordSfc = data.coordenadas, coord3d = data.coordenadas_3d || data.coordenadas;
        const out = { p: [], t: [], td: [], u: [], v: [] };
        let pSfc = null, tSfc = null, tdSfc = null, uSfc = null, vSfc = null;
        if (coordSfc && vars.st && vars.st.datos) {
            const idx = indexGraellaMesProper(coordSfc.lat, coordSfc.lon, lat, lon);
            const Nlon = coordSfc.lon.length, filaReal = filaRealPerIndex(coordSfc.lat, idx.i), flatIdx = filaReal * Nlon + idx.j;
            const rawSt = vars.st.datos[flatIdx]; tSfc = esFinit(rawSt) ? (rawSt > 100 ? rawSt - 273.15 : rawSt) : null;
            if (vars.sd && vars.sd.datos) { const rawSd = vars.sd.datos[flatIdx]; tdSfc = esFinit(rawSd) ? (rawSd > 100 ? rawSd - 273.15 : rawSd) : null; }
            if (vars.sp && vars.sp.datos) pSfc = vars.sp.datos[flatIdx];
            if (vars.su && vars.su.datos) uSfc = vars.su.datos[flatIdx];
            if (vars.sv && vars.sv.datos) vSfc = vars.sv.datos[flatIdx];
        }
        if (spSuperficieOverride && esFinit(spSuperficieOverride)) pSfc = spSuperficieOverride;
        if (esFinit(pSfc) && esFinit(tSfc) && esFinit(tdSfc)) {
            out.p.push(pSfc); out.t.push(tSfc); out.td.push(tdSfc);
            out.u.push(esFinit(uSfc) ? uSfc : 0); out.v.push(esFinit(vSfc) ? vSfc : 0);
        }
        if (coord3d) {
            const idx3d = indexGraellaMesProper(coord3d.lat, coord3d.lon, lat, lon);
            const Nlon3 = coord3d.lon.length, filaReal3 = filaRealPerIndex(coord3d.lat, idx3d.i), flatIdx3 = filaReal3 * Nlon3 + idx3d.j;
            NIVELLS_PRESSIO.forEach(niv => {
                if (pSfc !== null && niv >= pSfc) return;
                const kt = 't_' + niv, kd = 'dpt_' + niv, ku = 'u_' + niv, kv = 'v_' + niv;
                if (!vars[kt] || !vars[kt].datos) return;
                let tv = vars[kt].datos[flatIdx3]; if (!esFinit(tv)) return; if (tv > 100) tv -= 273.15;
                let tdv = null;
                if (vars[kd] && vars[kd].datos) { tdv = vars[kd].datos[flatIdx3]; if (esFinit(tdv) && tdv > 100) tdv -= 273.15; }
                if (!esFinit(tdv)) return;
                let uv = 0, vv = 0;
                if (vars[ku] && vars[ku].datos) uv = vars[ku].datos[flatIdx3];
                if (vars[kv] && vars[kv].datos) vv = vars[kv].datos[flatIdx3];
                if (!esFinit(uv)) uv = 0; if (!esFinit(vv)) vv = 0;
                out.p.push(niv); out.t.push(tv); out.td.push(tdv); out.u.push(uv); out.v.push(vv);
            });
        }
        const idxOrdre = out.p.map((_, i) => i).sort((a, b) => out.p[b] - out.p[a]);
        const net = { p: [], t: [], td: [], u: [], v: [] }; let lastP = Infinity;
        idxOrdre.forEach(i => { if (out.p[i] >= lastP) return; net.p.push(out.p[i]); net.t.push(out.t[i]); net.td.push(out.td[i]); net.u.push(out.u[i]); net.v.push(out.v[i]); lastP = out.p[i]; });
        if (net.p.length < 3) return null;
        net.z = net.p.map(pressioAAlcada);
        return net;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  SARS MILLORAT
    // ═══════════════════════════════════════════════════════════════════════

    // NOTA: s'ha afegit el camp `tSfc` (temperatura de superfície, °C) a
    // cada perfil de referència. És imprescindible: sense ell, tipus com
    // "Tempesta hivernal" no tenien CAP variable tèrmica de superfície amb
    // què descartar-se quan la temperatura real és, per exemple, de 30°C.
    // Rangs basats en climatologia bàsica de convecció (severe/dryline
    // envs: NWS/SPC; neu: exigeix ~0°C o menys en tota la columna baixa;
    // tropical: SST i CLT típicament 24-33°C).
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
        // FIX SARS #5a: el rang de SRH del Dret/bow echo abans exigia
        // {50,200}, essencialment idèntic a una supercèl·lula ordinària.
        // Físicament és incorrecte: els bow echoes/derechos es formen per
        // shear predominantment de tipus SPEED (no direccional) i per la
        // força del cold pool (DCAPE), no per rotació mesociclònica.
        // El paràmetre operatiu de referència, el DCP (Evans & Doswell
        // 2001), ni tan sols inclou SRH a la seva fórmula. Per tant
        // s'amplia el rang a {-250,250}: no exigeix rotació ciclònica ni
        // la penalitza, ja que un hodògraf rectilini (típic de bow echo)
        // pot donar SRH proper a zero o fins i tot lleugerament negatiu.
        { nom: 'Dret / bow echo', icon: '', tSfc: { min: 18, max: 36 }, cape: { min: 1500, max: 4000 }, cin: { min: -80, max: -5 }, li: { min: -10, max: -4 }, lcl: { min: 600, max: 1500 }, lfc: { min: 600, max: 2000 }, el: { min: 8000, max: 14000 }, shear06: { min: 25, max: 55 }, srh01: { min: -250, max: 250 }, srh03: { min: -300, max: 300 }, desc: 'Vents destructors en línia recta (>120 km/h), impulsats per un cold pool fort i shear predominantment lineal (no requereix rotació mesociclònica).', nivellRisc: 5 },
        // FIX SARS #5b: NOU PERFIL. Abans no existia cap categoria per
        // l'entorn "CAPE molt alt + shear moderat + SRH desfavorable/nul",
        // que és un cas real i freqüent: convecció explosiva (calamarsa
        // gegant, ratxes destructores per corrents descendents forts)
        // SENSE els ingredients de rotació organitzada que exigeix una
        // supercèl·lula. Amb el sistema anterior, aquest tipus de perfil
        // (p. ex. CAPE=4300, SRH=-113) queia fora de tots els perfils
        // existents i el rànquing final no oferia cap opció amb sentit.
        { nom: 'Multicèl·lula d\'alt CAPE (sense rotació)', icon: '', tSfc: { min: 18, max: 38 }, cape: { min: 2500, max: 6000 }, cin: { min: -450, max: -20 }, li: { min: -14, max: -5 }, lcl: { min: 600, max: 2200 }, lfc: { min: 1500, max: 4500 }, el: { min: 9000, max: 14000 }, shear06: { min: 15, max: 42 }, srh01: { min: -300, max: 60 }, srh03: { min: -400, max: 100 }, desc: 'Inestabilitat extrema amb shear moderat però sense rotació organitzada coherent (SRH baix o negatiu). Calamarsa molt gran per pur creixement vertical de l\'updraft i ratxes fortes per corrents descendents (downbursts), sense mesocicló. Tornado improbable.', nivellRisc: 4 }
    ];

    // ── FIX SARS #1: penalització per fora de rang ──────────────────────
    // Abans, `similitudRang` decreixia LINEALMENT i mai arribava realment
    // a 0: amb `maxDesv = rang*0.5`, calia una desviació d'1.5x el propi
    // rang per tocar 0, i com que `Math.max(...) `sempre inclou un terra
    // de 10, valors petits com el rang de CAPE de "Tempesta hivernal"
    // (0-300) permetien que un CAPE de 2000+ encara puntués >0. A més,
    // com que el pes de cada variable és petit (≤0.20), fins i tot un 0
    // en una sola variable només fa baixar el score total uns pocs punts.
    // Ara la penalització és QUADRÀTICA (cau molt més ràpid a prop del
    // límit del rang) i satura a 0 real quan la desviació supera el propi
    // amplitud del rang (en lloc d'1.5x-3x com abans).
    function similitudRang(valor, rang) {
        if (valor >= rang.min && valor <= rang.max) return 1.0;
        const amplitud = Math.max(rang.max - rang.min, 1);
        const diff = valor < rang.min ? (rang.min - valor) : (valor - rang.max);
        const x = Math.min(1, diff / amplitud);
        let s = Math.max(0, 1 - x * x);
        // FIX SARS #4: penalització extra quan el valor té signe oposat al
        // del rang sencer. Rellevant sobretot per SRH: un rang de
        // referència que exigeix SRH positiu (p.ex. 100-400, típic de
        // right-mover) i un valor negatiu observat no són "una mica lluny
        // l'un de l'altre" en un sentit físic — són règims de rotació
        // diferents (ciclònica vs anticiclònica respecte al right-mover).
        // Sense aquest ajust, un SRH=-103 contra un rang de 100-400 encara
        // puntuava ~0.54 de similitud, perquè la distància numèrica bruta
        // no era prou gran per si sola.
        if (rang.min > 0 && valor < 0) s *= 0.15;
        else if (rang.max < 0 && valor > 0) s *= 0.15;
        return s;
    }

    // ── FIX SARS #2: "hard gate" per variables decisives ────────────────
    // Un sistema additiu pur (mitjana ponderada de 9-10 variables) sempre
    // es "dilueix": encara que una variable sigui físicament incompatible
    // (p. ex. 30°C de superfície per a "Tempesta hivernal", que exigeix
    // columna gelada), la resta de variables poden arrossegar el score
    // fins a un 70-80% perquè cap pes individual és prou gran per si sol.
    // Aquesta és una pràctica estàndard en sistemes de similitud amb
    // restriccions: es calcula el score ponderat normal i, per sobre,
    // s'aplica un factor multiplicatiu de penalització quan alguna
    // variable "decisiva" (temperatura de superfície o CAPE, que són les
    // que més defineixen si un tipus de tempesta és físicament possible)
    // està molt fora de rang. Un multiplicador, en lloc d'una resta,
    // garanteix que el score final tendeixi a 0 encara que la resta de
    // variables (shear, SRH...) casualment coincideixin.
    function factorGate(similitudVariable) {
        // Per sota de 0.35 de similitud en una variable decisiva, el
        // multiplicador cau ràpidament fins a gairebé 0.
        if (similitudVariable >= 0.35) return 1.0;
        const t = similitudVariable / 0.35; // 0..1
        return Math.max(0, t * t * t); // caiguda cúbica: molt severa a prop de 0
    }

    function calcularSimilitudSARS(indexsActual, ventActual, perfilRef) {
        const tSfc = esFinit(indexsActual.tSfc) ? indexsActual.tSfc : null;
        const cape = indexsActual.cape || 0, cin = indexsActual.cin || 0, li = indexsActual.li || 0;
        const lcl = indexsActual.lcl_z || 1500, lfc = indexsActual.lfc_z || 2000, el = indexsActual.el_z || 10000;
        const shear06 = ventActual ? ventActual.shear06 : 0;
        // FIX SARS #3: NO es fa Math.abs() de l'SRH. Tots els perfils de
        // referència tenen rangs de SRH positius perquè descriuen entorns
        // de right-mover (Bunkers RM), que és l'estàndard operatiu (SPC).
        // Un SRH negatiu respecte al right-mover NO és "el mateix però amb
        // signe diferent": significa que l'entorn no dona helicitat
        // ciclònica coherent a un right-mover, és a dir, absència del
        // ingredient clau per a rotació organitzada de supercèl·lula.
        // Abans, `Math.abs(-103)=103` queia dins el rang de "Supercèl·lula
        // clàssica" (100-400) i donava un score alt totalment fals.
        const srh01 = ventActual ? ventActual.srh01 : 0;
        const srh03 = ventActual ? ventActual.srh03 : 0;

        const sCape = similitudRang(cape, perfilRef.cape), sCin = similitudRang(cin, perfilRef.cin), sLi = similitudRang(li, perfilRef.li);
        const sLcl = similitudRang(lcl, perfilRef.lcl), sLfc = similitudRang(lfc, perfilRef.lfc), sEl = similitudRang(el, perfilRef.el);
        const sShear06 = similitudRang(shear06, perfilRef.shear06), sSrh01 = similitudRang(srh01, perfilRef.srh01), sSrh03 = similitudRang(srh03, perfilRef.srh03);
        // Si no hi ha tSfc disponible (dades antigues sense aquest camp),
        // es neutralitza a 1.0 perquè no distorsioni el resultat, però
        // sempre que hi hagi dada real s'utilitza.
        const sTsfc = (tSfc !== null && perfilRef.tSfc) ? similitudRang(tSfc, perfilRef.tSfc) : 1.0;

        const pes = { tSfc: 0.10, cape: 0.18, cin: 0.09, li: 0.09, lcl: 0.09, lfc: 0.09, el: 0.05, shear06: 0.13, srh01: 0.09, srh03: 0.09 };
        const scoreBase = pes.tSfc * sTsfc + pes.cape * sCape + pes.cin * sCin + pes.li * sLi +
                           pes.lcl * sLcl + pes.lfc * sLfc + pes.el * sEl +
                           pes.shear06 * sShear06 + pes.srh01 * sSrh01 + pes.srh03 * sSrh03;

        // Gate dur: si tSfc, CAPE, o SRH 0-1km (les variables més
        // decisives per determinar si un tipus de tempesta és físicament
        // plausible i, en el cas de l'SRH, si hi ha rotació coherent) estan
        // molt fora de rang, es penalitza tot el score. S'afegeix `sSrh01`
        // al gate perquè un entorn amb SRH negatiu/nul mai pot donar lloc
        // a una supercèl·lula rotatòria dretana, per molt que CAPE i shear
        // siguin alts (com al cas d'aquest exemple: STP=0.00, EHI<0).
        const gate = factorGate(sTsfc) * factorGate(sCape) * factorGate(sSrh01);

        return Math.round(scoreBase * gate * 100);
    }

    function trobarAnàlegsSARS(indexsActual, ventActual) {
        return PERFILS_REFERENCIA.map(ref => ({ ...ref, similitud: calcularSimilitudSARS(indexsActual, ventActual, ref) })).sort((a, b) => b.similitud - a.similitud);
    }

    // ─── EXPORT FINAL (UN SOL COP) ──────────────────────────────────────
    global.SkewtEngine = {
        NIVELLS_PRESSIO,
        esFinit, pressioAAlcada, alcadaAPressio, esatBolton, wsat, tdFromRH,
        lclBolton, gradientHumit, perfilParcela, calcularIndexsTermo, indexsAddicionals,
        perfilMixedLayer,
        temperaturaBulbHumit, perfilBulbHumit,
        bulkShear, stormMotionBunkers, calcularSRH, ventMitja, ventAAlcada,
        calcularVentComposite,
        indexGraellaMesProper, filaRealPerIndex, extreurePerfil,
        PERFILS_REFERENCIA, calcularSimilitudSARS, trobarAnàlegsSARS
    };

})(window);