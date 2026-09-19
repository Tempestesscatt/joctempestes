// ═══════════════════════════════════════════════════════════════════════
//  convertiraltura.js
//  Conversió de nivells de pressió (hPa) a altura aproximada (km)
//  Basat en l'atmosfera estàndard ISA.
//
//  Ús:
//    ConvertirAltura.hpaAKm(850)        → 1.50
//    ConvertirAltura.hpaAKm(850, true)  → "1.50 km"
//    ConvertirAltura.textPerClau('wind_speed_850') → "(1.50 km)"
//    ConvertirAltura.hpaAKm(1013)       → null  (no és un nivell estàndard)
// ═══════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // Taula hPa → km (atmosfera estàndard ISA)
    const ALTURES_HPA = {
        1000: 0.11,  975: 0.32,  950: 0.54,  925: 0.77,  900: 1.00,
        875: 1.24,   850: 1.50,  825: 1.77,  800: 2.05,  775: 2.35,
        750: 2.66,   700: 3.01,  650: 3.59,  600: 4.24,  550: 4.97,
        500: 5.84,   450: 6.35,  400: 7.18,  350: 8.10,  300: 9.16,
        250: 10.36,  200: 11.78, 150: 13.50, 100: 16.18,
    };

    /**
     * Converteix un nivell de pressió (hPa) a altura (km).
     * Retorna null si el nivell no és estàndard.
     */
    function hpaAKm(hpa) {
        if (hpa === null || hpa === undefined) return null;
        const n = parseInt(hpa, 10);
        if (isNaN(n)) return null;
        return ALTURES_HPA[n] !== undefined ? ALTURES_HPA[n] : null;
    }

    /**
     * Retorna l'altura com a text (ex: "1.50 km") o null.
     */
    function hpaAKmText(hpa, decimals) {
        const km = hpaAKm(hpa);
        if (km === null) return null;
        const d = (decimals === undefined) ? 2 : decimals;
        return km.toFixed(d) + ' km';
    }

    /**
     * Extreu la pressió d'una clau tipus "wind_speed_850" o "t_500".
     * Retorna el número o null.
     */
    function extreurePressioDeClau(clau) {
        if (typeof clau !== 'string') return null;
        const m = clau.match(/_(\d{3,4})$/);
        if (!m) return null;
        return parseInt(m[1], 10);
    }

    /**
     * Donada una clau, retorna un text HTML amb l'altura entre parèntesis
     * (ex: "(1.50 km)") o cadena buida si no aplica.
     * Pensat per enganxar directament dins d'un innerHTML.
     */
    function textHtmlPerClau(clau, estil) {
        const hpa = extreurePressioDeClau(clau);
        if (hpa === null) return '';
        const text = hpaAKmText(hpa);
        if (!text) return '';
        const style = estil || 'color:#667788;font-size:10px;margin-left:4px;';
        return `<span class="param-altura" style="${style}">(${text})</span>`;
    }

    /**
     * Versió sense HTML, només text pla (per a title= o logs).
     */
    function textPlanoPerClau(clau) {
        const hpa = extreurePressioDeClau(clau);
        if (hpa === null) return '';
        const text = hpaAKmText(hpa);
        return text ? `(${text})` : '';
    }

    // Exposar globalment
    window.ConvertirAltura = {
        ALTURES_HPA,
        hpaAKm,
        hpaAKmText,
        extreurePressioDeClau,
        textHtmlPerClau,
        textPlanoPerClau,
    };
})();