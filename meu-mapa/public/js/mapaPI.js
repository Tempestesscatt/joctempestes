// ═══════════════════════════════════════════════════════════════════════
//  VISOR AROME-PI  ·  mapa_pi.js  (v52)
//  v52: Eliminades referències a satèl·lit real per evitar errors
//       Sense botons Ant/Seg · Indicador "Carregant..."
// ═══════════════════════════════════════════════════════════════════════

(function (window, L) {
    'use strict';

    const REGIONS    = ['catalunya'];
    const BASE_PATH  = 'web_data2';
    const DADES_PATH = './dades';

    const VENT_ALTURAS_DISPONIBLES = [10, 20, 100, 250, 500];
    const VENT_ALTURA_MAX = 500;
    const TIMEZONE_LOCAL = 'Europe/Madrid';

    let _pasActual        = 0;
    let _variableActual    = 'reflectivity';
    let _animacioEnCurs    = false;
    let _temporitzadorAnimacio = null;
    let _hodografVisible   = false;
    let _hodografMarker    = null;
    let _opacitatCapa      = 0.99;
    let _streamlineColorMode = 'dark';
    let _hoursDisponibles  = [];

    const config = {
        capes: {
            'cat_comarques':  { visible: true,  opacitat: 100, gruix: 1.0, color: '#000000' },
            'gir_comarques':  { visible: true,  opacitat: 100, gruix: 1.0, color: '#000000' },
            'lle_comarques':  { visible: true,  opacitat: 100, gruix: 1.0, color: '#000000' },
            'tar_comarques':  { visible: true,  opacitat: 100, gruix: 1.0, color: '#000000' },
            'esp_provincies': { visible: true,  opacitat: 100, gruix: 1.2, color: '#000000' },
            'cat_france':     { visible: true,  opacitat: 100, gruix: 1.5, color: '#000000' },
            'italia':         { visible: true,  opacitat: 100, gruix: 0.9, color: '#000000' },
            'corse':          { visible: true,  opacitat: 100, gruix: 0.9, color: '#000000' },
            'avis':           { visible: true,  opacitat: 100, gruix: 1.2, color: '#000000' },
            'avisesp':        { visible: true,  opacitat: 100, gruix: 1.2, color: '#000000' },
        },
        mapaBase: 'cyclosm',
    };

const MAPES_BASE = {

    // OSM
    osm: {
        url: 'https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/estandard/MON3857NW/{z}/{x}/{y}.png',
        opts: { attribution: '&copy; OpenStreetMap', maxZoom: 19 },
        nom: 'Mapa predeterminat'
    },

    osmde: {
        url: 'https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/orto/MON3857NW/{z}/{x}/{y}.png',
        opts: { attribution: '&copy; OpenStreetMap', maxZoom: 18 },
        nom: 'Satèl·lit (Ortofoto)'
    },

    osmfr: {
        url: 'https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/orto-hibrida/MON3857NW/{z}/{x}/{y}.png',
        opts: { attribution: '&copy; OSM France', subdomains:'abc', maxZoom:20 },
        nom: 'Carreteres i satèl·lit'
    },

    humanitarian: {
        url: 'https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/topografic/MON3857NW/{z}/{x}/{y}.png',
        opts: { attribution: '&copy; HOT OSM', subdomains:'abc', maxZoom:19 },
        nom: 'Topogràfic amb cims'
    },

    cyclosm: {
        url: 'https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/simplificat/MON3857NW/{z}/{x}/{y}.png',
        opts: { attribution: '&copy; CyclOSM', subdomains:'abc', maxZoom:20 },
        nom: 'Topografic sense cims'
    },

    // CARTO
    cartodb_light: {
        url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
        opts: { attribution: '&copy; CARTO', maxZoom:19 },
        nom: 'Ideal per caçar tempestes o saber la zona exacte, noms al detall '
    },


};
    let _capaMapaBase = null;

    const GEOJSON_CAPES = [
        {id:'cat_comarques',nom:'Comarques Catalunya',arxiu:'catalunya_comarques.geojson'},
        {id:'gir_comarques',nom:'Comarques Girona',arxiu:'girona_comarques.geojson'},
        {id:'lle_comarques',nom:'Comarques Lleida',arxiu:'lleida_comarques.geojson'},
        {id:'tar_comarques',nom:'Comarques Tarragona',arxiu:'tarragona_comarques.geojson'},
        {id:'esp_provincies',nom:'Províncies Espanya',arxiu:'espanya_provincies.geojson'},
        {id:'cat_france',nom:'Frontera França',arxiu:'catalunya_france.geojson'},
        {id:'italia',nom:'Regions Itàlia',arxiu:'italia_regioni.geojson'},
        {id:'corse',nom:'Regions Còrsega',arxiu:'corse_regioni.geojson'},
        {id:'avis',nom:'Avisos Catalunya',arxiu:'avis.geojson',esAvisos:true},
        {id:'avisesp',nom:'Avisos Espanya',arxiu:'avisesp.geojson',esAvisos:true},
    ];

    function _extreureAlcadaDeKey(key) {
        const m = key.match(/_(\d+)m$/);
        return m ? parseInt(m[1], 10) : null;
    }

    function _ventAlturaPerVariable(key) {
        const h = _extreureAlcadaDeKey(key);
        if (h === null) return 10;
        if (h > VENT_ALTURA_MAX) return null;
        let millor = VENT_ALTURAS_DISPONIBLES[0];
        let minDist = Math.abs(h - millor);
        for (const a of VENT_ALTURAS_DISPONIBLES) {
            const d = Math.abs(h - a);
            if (d < minDist) { minDist = d; millor = a; }
        }
        return millor;
    }

    function hPaAKm(hpa){if(hpa<=0)return null;if(hpa>=1013)return 0;if(hpa>=500)return +((44307.7*(1-Math.pow(hpa/1013.25,0.190284)))/1000).toFixed(1);return +((7.0*Math.log(1013.25/hpa))).toFixed(1);}
    const LUT_SIZE = 1024;
    function _smoothstep(t){return t*t*(3-2*t);}

    function _buildLUT(def){
        const stops=def.stops,lut=new Uint8Array(LUT_SIZE*4);
        const vMin=stops[0].v,vMax=stops[stops.length-1].v,vRange=vMax-vMin||1;
        for(let i=0;i<LUT_SIZE;i++){
            const v=vMin+(i/(LUT_SIZE-1))*vRange;
            let s0=stops[0],s1=stops[1];
            for(let j=0;j<stops.length-1;j++)if(v>=stops[j].v&&v<=stops[j+1].v){s0=stops[j];s1=stops[j+1];break;}
            const t=_smoothstep(Math.max(0,Math.min(1,(v-s0.v)/((s1.v-s0.v)||1))));
            const lerp=(a,b)=>Math.round(a+(b-a)*t),ii=i*4;
            lut[ii]=lerp(s0.r,s1.r);lut[ii+1]=lerp(s0.g,s1.g);lut[ii+2]=lerp(s0.b,s1.b);lut[ii+3]=lerp(s0.a??200,s1.a??200);
        }
        def._lut=lut;def._vMin=vMin;def._vMax=vMax;
    }

    function getColorContinu(def,valor){
        const stops=def.stops;
        if(valor===null||valor===undefined||isNaN(valor))return{r:0,g:0,b:0,a:0};
        if(valor<=stops[0].v){const s=stops[0];return{r:s.r,g:s.g,b:s.b,a:s.a??200};}
        const last=stops[stops.length-1];
        if(valor>=last.v)return{r:last.r,g:last.g,b:last.b,a:last.a??200};
        if(!def._lut)_buildLUT(def);
        const t=(valor-def._vMin)/((def._vMax-def._vMin)||1);
        const idx=Math.max(0,Math.min(LUT_SIZE-1,Math.round(t*(LUT_SIZE-1))))*4;
        return{r:def._lut[idx],g:def._lut[idx+1],b:def._lut[idx+2],a:def._lut[idx+3]};
    }

    function _hexToRgba(hex){
        if(!hex)return{r:0,g:0,b:0,a:0};
        const h=hex.replace('#','');
        const r=parseInt(h.substring(0,2),16),g=parseInt(h.substring(2,4),16),b=parseInt(h.substring(4,6),16);
        const a=h.length>=8?parseInt(h.substring(6,8),16):255;
        return{r,g,b,a};
    }
    function getColorCategoric(def,valor){
        if(valor===null||valor===undefined||isNaN(valor))return{r:0,g:0,b:0,a:0};
        const c=def.categories[Math.round(valor)];
        if(!c)return{r:90,g:90,b:90,a:60};
        if(!c._rgba)c._rgba=_hexToRgba(c.color);
        return c._rgba;
    }

    function getColor(def,valor){return def.tipus==='categoric'?getColorCategoric(def,valor):getColorContinu(def,valor);}

    function formatValorDefault(v){
        if(v===null||v===undefined||isNaN(v))return'--';
        if(typeof v==='number'){if(Math.abs(v)<10)return v.toFixed(2);if(Math.abs(v)<100)return v.toFixed(1);return Math.round(v).toString();}
        return v.toString();
    }

    function getMeta(){return window._indexData?.meta;}

    // ═══════════════════════════════════════════════════════════════════
    //  REGISTRE DE MAPES
    // ═══════════════════════════════════════════════════════════════════
    const MAPS = {};

    function registerContinuMap(opts){
        const def={
            key: opts.key,
            tipus: 'continu',
            titol: opts.titol,
            unitat: opts.unitat||'',
            descripcio: opts.descripcio||'',
            stops: opts.stops,
            vent: !!opts.vent,
            getValue: opts.getValue || ((surface,i)=>{const arr=surface?.[opts.key];return arr?arr[i]:null;}),
            format: opts.format || ((v)=>({text:formatValorDefault(v),unitat:opts.unitat||''})),
            extraHtml: opts.extraHtml || (()=>''),
        };
        MAPS[def.key]=def;
        return def;
    }

    function registerCategoricMap(opts){
        const def={
            key: opts.key,
            tipus: 'categoric',
            titol: opts.titol,
            unitat: '',
            descripcio: opts.descripcio||'',
            categories: opts.categories,
            getValue: opts.getValue || ((surface,i)=>{const arr=surface?.[opts.key];return arr?arr[i]:null;}),
            format: opts.format || ((v)=>{
                const c=opts.categories[Math.round(v)];
                return {text: c?c.label:`Codi ${Math.round(v)} (no confirmat)`, unitat:''};
            }),
            extraHtml: opts.extraHtml || (()=>''),
        };
        MAPS[def.key]=def;
        return def;
    }
function _stopsT(){
    return [
        {v:-20,r:80,g:0,b:255,a:255},
        {v:-10,r:0,g:140,b:255,a:250},
        {v:0,r:0,g:240,b:240,a:225},
        {v:5,r:180,g:255,b:130,a:195},
        {v:10,r:255,g:240,b:20,a:170},
        {v:15,r:255,g:170,b:0,a:160},
        {v:20,r:255,g:100,b:0,a:180},
        {v:25,r:255,g:30,b:0,a:210},
        {v:30,r:220,g:0,b:30,a:240},
        {v:35,r:170,g:0,b:100,a:255},
        {v:40,r:100,g:0,b:180,a:255},
        {v:50,r:0,g:0,b:255,a:255}
    ];
}

function _stopsRH(){
    return [
        {v:0,r:210,g:180,b:140,a:255},
        {v:20,r:190,g:150,b:70,a:230},
        {v:40,r:150,g:150,b:40,a:210},
        {v:60,r:80,g:170,b:100,a:200},
        {v:75,r:0,g:180,b:200,a:220},
        {v:85,r:0,g:120,b:250,a:240},
        {v:95,r:0,g:40,b:255,a:255},
        {v:100,r:0,g:0,b:255,a:255}
    ];
}

function _stopsPR(){
    return [
        {v:500,r:255,g:100,b:100,a:255},
        {v:700,r:255,g:180,b:100,a:250},
        {v:850,r:240,g:240,b:150,a:220},
        {v:925,r:180,g:220,b:200,a:200},
        {v:1000,r:100,g:180,b:240,a:195},
        {v:1050,r:40,g:100,b:255,a:225}
    ];
}

function _stopsWind(){
    return [
        {v:0,r:255,g:255,b:255,a:120},
        {v:10,r:180,g:220,b:255,a:160},
        {v:20,r:60,g:150,b:255,a:190},
        {v:30,r:80,g:140,b:220,a:210},
        {v:40,r:255,g:255,b:0,a:225},
        {v:50,r:255,g:180,b:0,a:235},
        {v:60,r:255,g:120,b:0,a:245},
        {v:75,r:220,g:30,b:0,a:250},
        {v:100,r:120,g:0,b:120,a:255}
    ];
}


registerContinuMap({
    key: 'reflectivity',
    titol: 'Reflectivitat',
    unitat: 'dBZ',
    descripcio: 'Radar simulat · >40 tempesta',
    stops: [
        {v:0,r:0,g:0,b:0,a:0},
        {v:5,r:0,g:236,b:236,a:150},
        {v:10,r:1,g:160,b:246,a:200},
        {v:15,r:0,g:0,b:246,a:210},
        {v:20,r:0,g:236,b:0,a:220},
        {v:25,r:0,g:180,b:0,a:220},
        {v:30,r:0,g:100,b:0,a:220},
        {v:35,r:255,g:144,b:0,a:230},
        {v:40,r:255,g:0,b:0,a:240},
        {v:45,r:192,g:0,b:0,a:240},
        {v:50,r:120,g:0,b:0,a:240},
        {v:55,r:255,g:0,b:255,a:250},
        {v:60,r:160,g:32,b:240,a:250},
        {v:65,r:80,g:0,b:130,a:255},
        {v:70,r:200,g:200,b:200,a:255},
        {v:75,r:255,g:255,b:255,a:255}
    ]
});


registerContinuMap({
    key: 'stp',
    titol: 'Tornado STP',
    unitat: 'index',
    stops: [
        {v:0,r:200,g:200,b:200,a:0},
        {v:0.3,r:200,g:200,b:200,a:60},
        {v:0.6,r:210,g:210,b:180,a:110},
        {v:1,r:255,g:230,b:80,a:170},
        {v:2,r:255,g:200,b:0,a:210},
        {v:3,r:255,g:150,b:0,a:235},
        {v:4,r:255,g:80,b:0,a:250},
        {v:5,r:230,g:20,b:20,a:255},
        {v:7,r:255,g:0,b:150,a:255}
    ]
});

registerContinuMap({
    key: 'ica',
    titol: 'Convecció ICA',
    unitat: 'index',
    stops: [
        {v:0,r:0,g:0,b:0,a:0},
        {v:1,r:140,g:150,b:255,a:150},
        {v:2,r:100,g:180,b:255,a:195},
        {v:3,r:80,g:220,b:120,a:220},
        {v:4,r:120,g:240,b:60,a:235},
        {v:5,r:220,g:255,b:30,a:245},
        {v:6,r:255,g:220,b:0,a:250},
        {v:7,r:255,g:150,b:0,a:253},
        {v:8,r:255,g:70,b:0,a:255},
        {v:9,r:230,g:20,b:0,a:255},
        {v:10,r:190,g:0,b:0,a:255}
    ]
});


registerContinuMap({
    key: 'ehi',
    titol: 'Helicoidal EHI',
    unitat: 'index',
    stops: [
        {v:0,r:200,g:200,b:200,a:0},
        {v:0.3,r:200,g:200,b:200,a:70},
        {v:0.6,r:210,g:210,b:180,a:120},
        {v:1,r:255,g:230,b:60,a:180},
        {v:1.5,r:255,g:200,b:0,a:215},
        {v:2,r:255,g:140,b:0,a:235},
        {v:2.5,r:230,g:60,b:20,a:248},
        {v:3,r:210,g:0,b:120,a:253},
        {v:4,r:170,g:0,b:200,a:255},
        {v:5,r:110,g:0,b:230,a:255},
        {v:7,r:60,g:0,b:180,a:255}
    ]
});


registerContinuMap({
    key: 'diag_grele',
    titol: 'Diagnòstic granís',
    unitat: 'index',
    stops: [
        {v:0,r:0,g:0,b:0,a:0},
        {v:0.1,r:0,g:0,b:0,a:0},
        {v:0.1,r:0,g:180,b:80,a:180},
        {v:0.5,r:0,g:220,b:40,a:200},
        {v:1,r:120,g:240,b:0,a:215},
        {v:2,r:220,g:250,b:0,a:225},
        {v:3,r:255,g:240,b:0,a:232},
        {v:4,r:255,g:210,b:0,a:238},
        {v:5,r:255,g:170,b:0,a:242},
        {v:6,r:255,g:130,b:0,a:246},
        {v:8,r:255,g:80,b:0,a:249},
        {v:10,r:255,g:30,b:0,a:251},
        {v:12,r:240,g:0,b:30,a:253},
        {v:15,r:200,g:0,b:100,a:254},
        {v:20,r:160,g:0,b:180,a:255},
        {v:24,r:120,g:0,b:240,a:255}
    ]
});


registerContinuMap({
    key: 'diag_fog',
    titol: 'Boira',
    unitat: 'index',
    stops: [
        {v:0,r:20,g:20,b:40,a:0},
        {v:0.2,r:160,g:185,b:210,a:155},
        {v:0.4,r:120,g:160,b:195,a:195},
        {v:0.6,r:80,g:140,b:185,a:225},
        {v:0.8,r:40,g:120,b:175,a:245},
        {v:1.0,r:0,g:100,b:165,a:255}
    ]
});

registerContinuMap({
    key: 'total_precip_rate',
    titol: 'Ritme precip.',
    unitat: 'mm/h',
    stops: [
        {v:0,r:255,g:255,b:255,a:0},
        {v:1,r:120,g:80,b:220,a:180},
        {v:5,r:60,g:60,b:230,a:210},
        {v:10,r:0,g:150,b:230,a:220},
        {v:20,r:0,g:210,b:190,a:225},
        {v:40,r:0,g:220,b:100,a:230},
        {v:60,r:150,g:230,b:0,a:235},
        {v:80,r:255,g:230,b:0,a:240},
        {v:100,r:255,g:150,b:0,a:245},
        {v:200,r:255,g:60,b:0,a:250},
        {v:300,r:220,g:0,b:0,a:250},
        {v:500,r:100,g:0,b:0,a:255}
    ]
});


registerContinuMap({
    key: 'total_precip',
    titol: 'Precip. total',
    unitat: 'mm',
    stops: [
        {v:0,r:255,g:255,b:255,a:0},
        {v:0.5,r:175,g:238,b:255,a:150},
        {v:1,r:100,g:210,b:255,a:180},
        {v:2,r:0,g:180,b:255,a:200},
        {v:5,r:0,g:120,b:255,a:210},
        {v:10,r:0,g:230,b:180,a:210},
        {v:20,r:0,g:200,b:80,a:220},
        {v:40,r:160,g:240,b:0,a:220},
        {v:60,r:255,g:230,b:0,a:220},
        {v:80,r:255,g:140,b:0,a:230},
        {v:100,r:210,g:150,b:140,a:230}
    ]
});


registerContinuMap({
    key: 'total_snow',
    titol: 'Neu total',
    unitat: 'mm',
    stops: [
        {v:0,r:255,g:255,b:255,a:0},
        {v:0.5,r:200,g:220,b:255,a:150},
        {v:1,r:150,g:190,b:255,a:180},
        {v:2,r:100,g:160,b:255,a:200},
        {v:5,r:50,g:130,b:255,a:210},
        {v:10,r:0,g:100,b:255,a:220},
        {v:20,r:0,g:70,b:220,a:230},
        {v:40,r:0,g:40,b:180,a:240}
    ]
});


registerContinuMap({
    key: 'graupel',
    titol: 'Graupel',
    unitat: 'mm',
    stops: [
        {v:0,r:255,g:255,b:255,a:0},
        {v:0.5,r:200,g:230,b:200,a:150},
        {v:1,r:150,g:210,b:150,a:180},
        {v:2,r:100,g:190,b:100,a:200},
        {v:5,r:50,g:170,b:50,a:210},
        {v:10,r:0,g:150,b:0,a:220},
        {v:20,r:0,g:120,b:0,a:230}
    ]
});


registerContinuMap({
    key: 'hail',
    titol: 'Calamarsa',
    unitat: 'mm',
    stops: [
        {v:0,r:255,g:255,b:255,a:0},
        {v:0.5,r:255,g:220,b:220,a:150},
        {v:1,r:255,g:180,b:180,a:180},
        {v:2,r:255,g:140,b:140,a:200},
        {v:5,r:255,g:80,b:80,a:210},
        {v:10,r:255,g:30,b:30,a:220},
        {v:20,r:200,g:0,b:0,a:230},
        {v:40,r:150,g:0,b:50,a:240}
    ]
});


registerContinuMap({
    key: 'high_cloud',
    titol: 'Núvols alts',
    unitat: '%',
    stops: [
        {v:0,r:20,g:30,b:50,a:0},
        {v:1,r:40,g:50,b:80,a:100},
        {v:5,r:60,g:80,b:130,a:140},
        {v:15,r:80,g:110,b:180,a:170},
        {v:30,r:100,g:140,b:210,a:195},
        {v:50,r:130,g:170,b:230,a:215},
        {v:70,r:160,g:200,b:245,a:230},
        {v:85,r:200,g:225,b:255,a:242},
        {v:95,r:230,g:240,b:255,a:250},
        {v:100,r:255,g:255,b:255,a:255}
    ]
});


registerContinuMap({
    key: 'medium_cloud',
    titol: 'Núvols mitjans',
    unitat: '%',
    stops: [
        {v:0,r:20,g:30,b:40,a:0},
        {v:1,r:100,g:100,b:120,a:120},
        {v:5,r:130,g:130,b:150,a:155},
        {v:15,r:155,g:155,b:175,a:180},
        {v:30,r:175,g:175,b:195,a:200},
        {v:50,r:195,g:195,b:210,a:215},
        {v:70,r:215,g:215,b:225,a:228},
        {v:85,r:235,g:235,b:240,a:242},
        {v:95,r:248,g:248,b:250,a:250},
        {v:100,r:255,g:255,b:255,a:255}
    ]
});


registerContinuMap({
    key: 'nebul',
    titol: 'Nuvolositat total',
    unitat: '%',
    stops: [
        {v:0,r:30,g:40,b:60,a:0},
        {v:1,r:50,g:60,b:90,a:100},
        {v:5,r:70,g:85,b:130,a:140},
        {v:10,r:90,g:110,b:165,a:170},
        {v:20,r:110,g:135,b:195,a:195},
        {v:35,r:135,g:165,b:215,a:212},
        {v:50,r:160,g:190,b:230,a:225},
        {v:65,r:185,g:210,b:240,a:235},
        {v:80,r:210,g:230,b:248,a:244},
        {v:90,r:235,g:242,b:252,a:250},
        {v:98,r:255,g:255,b:255,a:255}
    ]
});


registerContinuMap({
    key: 'cb_top_pressure',
    titol: 'Cim CB',
    unitat: 'hPa',
    format: (v) => ({
        text: Math.round(v).toString(),
        unitat: 'hPa'
    }),
    extraHtml: (v) => {
        const km = hPaAKm(v);
        return km !== null ? `<div style="font-size:11px;color:#7ab8e8;margin-top:2px;">~ ${km} km</div>` : '';
    },
    stops: [
        {v:0,r:0,g:0,b:0,a:0},
        {v:50,r:0,g:0,b:0,a:0},
        {v:100,r:160,g:0,b:200,a:255},
        {v:200,r:255,g:70,b:0,a:255},
        {v:300,r:255,g:240,b:0,a:255},
        {v:500,r:0,g:160,b:170,a:255},
        {v:700,r:0,g:40,b:255,a:255},
        {v:900,r:40,g:0,b:180,a:255}
    ]
});


registerContinuMap({
    key: 'cloud_top_pressure',
    titol: 'Cim núvol',
    unitat: 'hPa',
    format: (v) => ({
        text: Math.round(v).toString(),
        unitat: 'hPa'
    }),
    extraHtml: (v) => {
        const km = hPaAKm(v);
        return km !== null ? `<div style="font-size:11px;color:#7ab8e8;margin-top:2px;">~ ${km} km</div>` : '';
    },
    stops: [
        {v:0,r:0,g:0,b:0,a:0},
        {v:50,r:0,g:0,b:0,a:0},
        {v:100,r:140,g:0,b:220,a:255},
        {v:300,r:255,g:240,b:0,a:255},
        {v:500,r:0,g:150,b:200,a:255},
        {v:700,r:40,g:0,b:240,a:255},
        {v:950,r:80,g:0,b:100,a:255}
    ]
});


registerContinuMap({
    key: 'pressure_msl',
    titol: 'Pressió MSL',
    unitat: 'hPa',
    format: (v) => ({
        text: formatValorDefault(v),
        unitat: 'hPa'
    }),
    stops: [
        {v:950,r:255,g:100,b:100,a:255},
        {v:980,r:255,g:180,b:100,a:245},
        {v:995,r:240,g:240,b:150,a:220},
        {v:1005,r:200,g:230,b:200,a:200},
        {v:1013,r:180,g:200,b:220,a:185},
        {v:1020,r:140,g:180,b:240,a:195},
        {v:1028,r:40,g:100,b:255,a:225},
        {v:1040,r:0,g:30,b:200,a:255}
    ]
});


registerContinuMap({
    key: 'tke',
    titol: 'Turbulència TKE',
    unitat: 'J/kg',
    stops: [
        {v:0,r:20,g:20,b:40,a:0},
        {v:2,r:20,g:190,b:250,a:175},
        {v:4,r:80,g:250,b:80,a:215},
        {v:6,r:255,g:240,b:0,a:240},
        {v:8,r:255,g:180,b:0,a:248},
        {v:10,r:255,g:100,b:0,a:252},
        {v:15,r:200,g:0,b:150,a:255}
    ]
});


registerContinuMap({
    key: 'visibility_mini',
    titol: 'Visibilitat mín.',
    unitat: 'm',
    format: (v) => {
        if (v >= 20000) return { text: '>20', unitat: 'km' };
        if (v >= 10000) return { text: (v / 1000).toFixed(1), unitat: 'km' };
        return { text: Math.round(v).toString(), unitat: 'm' };
    },
    stops: [
        {v:0,r:180,g:0,b:0,a:255},
        {v:200,r:255,g:110,b:30,a:242},
        {v:500,r:255,g:200,b:50,a:225},
        {v:1000,r:220,g:245,b:70,a:200},
        {v:2000,r:120,g:245,b:140,a:170},
        {v:5000,r:0,g:185,b:225,a:125},
        {v:10000,r:20,g:35,b:140,a:30},
        {v:12000,r:0,g:0,b:0,a:0}
    ]
});


registerContinuMap({
    key: 'visibility_precip',
    titol: 'Visib. amb pluja',
    unitat: 'm',
    format: (v) => {
        if (v >= 20000) return { text: '>20', unitat: 'km' };
        if (v >= 10000) return { text: (v / 1000).toFixed(1), unitat: 'km' };
        return { text: Math.round(v).toString(), unitat: 'm' };
    },
    stops: [
        {v:0,r:160,g:0,b:80,a:255},
        {v:500,r:255,g:115,b:95,a:225},
        {v:2000,r:220,g:240,b:55,a:168},
        {v:5000,r:50,g:225,b:165,a:122},
        {v:10000,r:10,g:55,b:150,a:28},
        {v:12000,r:0,g:0,b:0,a:0}
    ]
});


registerContinuMap({
    key: 'snow_sc',
    titol: 'Neu estratoc.',
    unitat: 'index',
    stops: [
        {v:0,r:255,g:255,b:255,a:0},
        {v:1,r:200,g:220,b:255,a:150},
        {v:2,r:150,g:190,b:255,a:180},
        {v:5,r:50,g:130,b:255,a:210},
        {v:10,r:0,g:70,b:220,a:240}
    ]
});


registerContinuMap({
    key: 'precip_fzn',
    titol: 'Pluja gelada',
    unitat: 'index',
    stops: [
        {v:0,r:255,g:255,b:255,a:0},
        {v:0.3,r:180,g:200,b:255,a:150},
        {v:0.5,r:100,g:160,b:255,a:200},
        {v:0.7,r:50,g:120,b:255,a:230},
        {v:1,r:0,g:80,b:255,a:255}
    ]
});


registerContinuMap({
    key: 'tpw_0c',
    titol: 'Alçada 0°C',
    unitat: 'm',
    stops: [
        {v:0,r:255,g:100,b:100,a:255},
        {v:1000,r:255,g:180,b:100,a:250},
        {v:2000,r:240,g:240,b:150,a:220},
        {v:3000,r:180,g:220,b:200,a:200},
        {v:4000,r:100,g:180,b:240,a:195},
        {v:5000,r:40,g:100,b:255,a:225}
    ]
});


registerContinuMap({
    key: 'tpw_1c',
    titol: 'Alçada 1°C',
    unitat: 'm',
    stops: [
        {v:0,r:255,g:100,b:100,a:255},
        {v:2000,r:240,g:240,b:150,a:220},
        {v:4000,r:100,g:180,b:240,a:195},
        {v:5000,r:40,g:100,b:255,a:225}
    ]
});


registerContinuMap({
    key: 'tpw_1_5c',
    titol: 'Alçada 1.5°C',
    unitat: 'm',
    stops: [
        {v:0,r:255,g:100,b:100,a:255},
        {v:2000,r:240,g:240,b:150,a:220},
        {v:4000,r:100,g:180,b:240,a:195},
        {v:5000,r:40,g:100,b:255,a:225}
    ]
});


registerContinuMap({
    key: 'tpw_isobaric',
    titol: 'Temp. potencial',
    unitat: '°C',
    stops: [
        {v:-24,r:45,g:0,b:75},
        {v:-20,r:130,g:0,b:160},
        {v:-15,r:65,g:0,b:115},
        {v:-10,r:0,g:0,b:255},
        {v:-5,r:0,g:135,b:255},
        {v:0,r:0,g:235,b:255},
        {v:2,r:0,g:255,b:150},
        {v:5,r:0,g:200,b:0},
        {v:8,r:120,g:255,b:0},
        {v:11,r:255,g:255,b:0},
        {v:14,r:255,g:255,b:170},
        {v:17,r:255,g:235,b:100},
        {v:20,r:255,g:200,b:0},
        {v:23,r:255,g:140,b:0},
        {v:26,r:255,g:70,b:0},
        {v:29,r:255,g:0,b:0},
        {v:32,r:180,g:0,b:0},
        {v:35,r:90,g:0,b:0},
        {v:38,r:150,g:0,b:150},
        {v:42,r:255,g:0,b:255},
        {v:46,r:255,g:185,b:255}
    ]
});


registerContinuMap({
    key: 'sw_radiation',
    titol: 'Radiació SW',
    unitat: 'MJ/m²',
    format: (v) => ({
        text: (v / 1000000).toFixed(2),
        unitat: 'MJ/m²'
    }),
    stops: [
        {v:0,r:20,g:20,b:40,a:0},
        {v:500000,r:150,g:30,b:200,a:200},
        {v:1200000,r:255,g:100,b:50,a:225},
        {v:2500000,r:255,g:240,b:0,a:242},
        {v:3200000,r:255,g:255,b:200,a:250}
    ]
});

    [2,10,20,50,100,250,500].forEach(h=>registerContinuMap({key:`t_${h}m`,titol:`Temperatura ${h}m`,unitat:'°C',stops:_stopsT()}));
    [10,20,35,50,75,100,150,200,250,375,500,750,1000,1500,2000,3000].forEach(h=>registerContinuMap({key:`rh_${h}m`,titol:`Humitat ${h}m`,unitat:'%',stops:_stopsRH()}));
    [10,20,50,100,250,500].forEach(h=>registerContinuMap({key:`dp_${h}m`,titol:`Punt rosada ${h}m`,unitat:'°C',stops:_stopsT()}));
    [10].forEach(h=>registerContinuMap({key:`pr_${h}m`,titol:`Pressió ${h}m`,unitat:'hPa',stops:_stopsPR()}));
    [10,20,100,250,500].forEach(h=>{
        registerContinuMap({key:`wind_speed_${h}m`,titol:`Velocitat vent ${h}m`,unitat:'km/h',stops:_stopsWind()});
        registerContinuMap({key:`wind_direction_${h}m`,titol:`Direcció vent ${h}m`,unitat:'°',format:(v)=>({text:Math.round(v).toString(),unitat:'°'}),stops:[{v:0,r:180,g:190,b:210,a:255},{v:180,r:220,g:220,b:230,a:255},{v:360,r:180,g:190,b:210,a:255}]});
    });



    registerContinuMap({key:'wind_gust_15min',titol:'Ratxa 15min',unitat:'km/h',stops:_stopsWind()});


        // MOCON (×100000) — convergència d'humitat
    const MOCON_STOPS = [
        {v:-100,r:139,g:69,b:19,a:255},   // Marró fosc (convergència forta)
        {v:-50, r:160,g:82,b:45,a:240},   // Marró
        {v:-25, r:210,g:105,b:30,a:225},  // Taronja fosc
        {v:-10, r:255,g:140,b:0,a:215},   // Taronja
        {v:-5,  r:255,g:200,b:0,a:200},   // Groc
        {v:0,   r:255,g:255,b:255,a:0},   // Transparent (sense convergència)
        {v:5,   r:0,g:200,b:255,a:200},   // Blau clar
        {v:10,  r:0,g:140,b:255,a:215},   // Blau
        {v:25,  r:0,g:80,b:200,a:225},    // Blau fosc
        {v:50,  r:0,g:30,b:150,a:240},    // Blau profund
        {v:100, r:0,g:0,b:100,a:255},     // Blau molt fosc (divergència forta)
    ];
// MOCON superfície (×100000) — convergència d'humitat
registerContinuMap({
    key:'mocon',
    titol:'MOCON',
    unitat:'×10⁻⁵',
    descripcio:'Convergència d\'humitat · + = convergència (puja aire) · - = divergència (baixa aire)',
    stops: [
        {v:-100, r:139, g:69,  b:19,  a:255},  // Marró fosc
        {v:-50,  r:160, g:82,  b:45,  a:240},  // Marró
        {v:-25,  r:210, g:105, b:30,  a:225},  // Taronja fosc
        {v:-10,  r:255, g:140, b:0,   a:215},  // Taronja
        {v:-5,   r:255, g:200, b:0,   a:200},  // Groc
        {v:0,    r:255, g:255, b:255, a:0},    // Transparent
        {v:5,    r:0,   g:200, b:255, a:200},  // Blau clar
        {v:10,   r:0,   g:140, b:255, a:215},  // Blau
        {v:25,   r:0,   g:80,  b:200, a:225},  // Blau fosc
        {v:50,   r:0,   g:30,  b:150, a:240},  // Blau profund
        {v:100,  r:0,   g:0,   b:100, a:255},  // Blau molt fosc
    ],
});

    const PRECIP_TIPUS_CATEGORIES = {
        0:{color:'#ffffff00',label:'Sense precipitació'},1:{color:'#3a00c1d6',label:'Pluja intensa'},
        5:{color:'#f24646e6',label:'Pluja intensa amb granís'},137:{color:'#f53838e6',label:'Pluja amb possible granís'},
        181:{color:'#f53838e6',label:'Tempesta amb graupel'},9:{color:'#ff6400e6',label:'Granís'},
        10:{color:'#ff1e00e6',label:'Tempesta forta amb granís'},11:{color:'#ff8c00b4',label:'Codi 11'},
        201:{color:'#3282ffd2',label:'Plujim'},
    };
    registerCategoricMap({key:'precip_type',titol:'Tipus precip.',descripcio:'Codi confirmat empíricament',categories:PRECIP_TIPUS_CATEGORIES});
    registerCategoricMap({key:'severe_precip_type',titol:'Tipus precip. (sever)',descripcio:'Pitjor codi en 15 min',categories:PRECIP_TIPUS_CATEGORIES});

    const PRECIP_ESTIMAT_CATEGORIES = {
        0:{color:'#ffffff00',label:'Sense precipitació'},1:{color:'#9adcffc8',label:'Pluja feble (<3 mm/h)'},
        2:{color:'#1e90ffdc',label:'Pluja moderada (3-15 mm/h)'},3:{color:'#0050c8e6',label:'Pluja intensa (>15 mm/h)'},
        4:{color:'#ff8c00e6',label:'Tempesta / graupel'},5:{color:'#dceeffe6',label:'Neu'},
        6:{color:'#7ab0ffe6',label:'Neu humida'},8:{color:'#a050ffea',label:'Pluja gelant'},
        10:{color:'#ff2020f0',label:'Calamarsa'},
    };
    function _estimarTipusPrecip(surface,i){
        const rate=surface.total_precip_rate?.[i],t2m=surface.t_2m?.[i],refl=surface.reflectivity?.[i],
              hail=surface.hail?.[i],graupel=surface.graupel?.[i],snowSc=surface.snow_sc?.[i],
              totSnow=surface.total_snow?.[i],fzn=surface.precip_fzn?.[i];
        if(rate===undefined||rate===null||isNaN(rate))return null;
        if(rate<=0.05)return 0;if(hail>0)return 10;if(fzn>0.3)return 8;
        if(snowSc>0||totSnow>0)return(t2m!==undefined&&t2m!==null&&t2m>1)?6:5;
        if(graupel>0||refl>40)return 4;if(rate>15)return 3;if(rate>3)return 2;return 1;
    }
    registerCategoricMap({key:'precip_type_estimat',titol:'Tipus precip. (estimat)',descripcio:'Estimació pròpia combinant T, reflectivitat, rate, graupel, calamarsa, neu i pluja gelant',categories:PRECIP_ESTIMAT_CATEGORIES,getValue:(surface,i)=>_estimarTipusPrecip(surface,i)});

    // ═══════════════════════════════════════════════════════════════════
    //  MAPA LEAFLET
    // ═══════════════════════════════════════════════════════════════════
    const mapa = L.map('map', {crs:L.CRS.EPSG3857,zoomControl:false,attributionControl:false,preferCanvas:true,minZoom:5,maxZoom:13}).setView([41.6,1.8],8);
    window._mapInstance = mapa;
    _capaMapaBase = L.tileLayer(MAPES_BASE.cyclosm.url, MAPES_BASE.cyclosm.opts).addTo(mapa);

    function canviarMapaBase(clau){
        const def=MAPES_BASE[clau];if(!def)return;
        if(_capaMapaBase)mapa.removeLayer(_capaMapaBase);
        _capaMapaBase=L.tileLayer(def.url,def.opts).addTo(mapa);
        _capaMapaBase.bringToBack();
        _streamlineColorMode=['dark','darkmatter'].includes(clau)?'white':'dark';
        _bringGeojsonToFront();
        if(canvasLayer._map)canvasLayer._redraw();
    }
    window._canviarMapaBase = canviarMapaBase;

    // ═══════════════════════════════════════════════════════════════════
    //  VENT OVERLAY
    // ═══════════════════════════════════════════════════════════════════
    const WIND_BARB_CONFIG = {BASE_SIZE:14,DENSITY:35,SCALE_FACTORS:{light:0.7,moderate:1.0,strong:1.3,very_strong:1.6,storm:2.0}};
    const STREAMLINE_CONFIG = {STEP:18,DT:1.8,MAX_STEPS:70,CELL:5,WIDTH:1.2,OPACITY:0.7};

    let ventEnabled=false,ventAlturaActiva=10,_ventDisplayMode='barbes';
    let _windBarbCache=null,_windBarbAnchors=null;

    function _sincronitzarVentAmbVariable(key){
        const h=_ventAlturaPerVariable(key);
        if(h===null){_windBarbCache=null;_windBarbAnchors=null;if(canvasLayer._map)canvasLayer._redraw();}
        else{
            ventAlturaActiva=h;
            const sel=document.getElementById('pi-vent-altura');if(sel)sel.value=String(h);
            if(ventEnabled)_actualitzarVent(true);
        }
        const indicador=document.getElementById('pi-vent-altura-activa');
        if(indicador){if(h===null){indicador.textContent='>500m (no disponible)';indicador.style.color='#e06040';}else{indicador.textContent=h+'m';indicador.style.color='#80c8ff';}}
    }

    function _construirCacheVent(bloc,altura){
        const wk=`wind_speed_${altura}m`,dk=`wind_direction_${altura}m`;
        const s=bloc?.surface;if(!s?.[wk]||!s?.[dk])return null;
        const m=window._indexData?.meta;if(!m)return null;
        const N=m.n_grid,sd=s[wk],dd=s[dk];
        if(!sd?.length||!dd?.length)return null;
        return{speed:sd,dir:dd,N,extent:m.extent};
    }

    function _getVent(lat,lng){
        if(!_windBarbCache)return null;
        const{speed,dir,N,extent:fe}=_windBarbCache;
        const fx=((lng-fe[0])/(fe[1]-fe[0]))*(N-1),fy=((fe[3]-lat)/(fe[3]-fe[2]))*(N-1);
        if(fx<0||fx>=N-1||fy<0||fy>=N-1)return null;
        const x0=fx|0,y0=fy|0,tx=fx-x0,ty=fy-y0,x1=Math.min(x0+1,N-1),y1=Math.min(y0+1,N-1);
        const s00=speed[y0*N+x0],s10=speed[y0*N+x1],s01=speed[y1*N+x0],s11=speed[y1*N+x1];
        const d00=dir[y0*N+x0],d10=dir[y0*N+x1],d01=dir[y1*N+x0],d11=dir[y1*N+x1];
        if(isNaN(s00)||isNaN(s10)||isNaN(s01)||isNaN(s11))return null;
        const s=(1-ty)*((1-tx)*s00+tx*s10)+ty*((1-tx)*s01+tx*s11);
        let d=(1-ty)*((1-tx)*d00+tx*d10)+ty*((1-tx)*d01+tx*d11);
        if(d<0)d+=360;if(d>=360)d-=360;
        return{speed:s,dir:d};
    }

    function _regenerarAncoresVent(){
        if(!ventEnabled||_ventDisplayMode!=='barbes'){_windBarbAnchors=null;return;}
        const size=mapa.getSize(),d=WIND_BARB_CONFIG.DENSITY,anchors=[];
        for(let y=d/2;y<size.y;y+=d)for(let x=d/2;x<size.x;x+=d){const ll=mapa.containerPointToLatLng([x,y]);anchors.push({lat:ll.lat,lng:ll.lng});}
        _windBarbAnchors=anchors;
    }

    function _getScaleFactor(s){const f=WIND_BARB_CONFIG.SCALE_FACTORS;if(s<15)return f.light;if(s<30)return f.moderate;if(s<50)return f.strong;if(s<80)return f.very_strong;return f.storm;}
    function _getLineWidth(s){if(s<15)return 1.0;if(s<30)return 1.3;if(s<50)return 1.6;if(s<80)return 2.0;return 2.5;}

    function _dibuixarBarba(ctx,x,y,speed,dir,baseSize){
        if(speed<3){ctx.beginPath();ctx.arc(x,y,baseSize*0.2,0,Math.PI*2);ctx.stroke();return;}
        const sf=_getScaleFactor(speed),lw=_getLineWidth(speed),size=baseSize*sf;
        const angle=(dir+90)*Math.PI/180,hs=size/2;
        ctx.save();ctx.lineWidth=lw;ctx.strokeStyle='#000';ctx.fillStyle='#000';
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(angle)*size,y+Math.sin(angle)*size);ctx.stroke();
        let rem=speed*0.54;
        if(rem>=50){
            const fx=x+Math.cos(angle)*(size*0.12),fy=y+Math.sin(angle)*(size*0.12);
            const pa=angle+Math.PI/2,fs=hs*0.7;
            ctx.beginPath();ctx.moveTo(fx,fy);ctx.lineTo(fx+Math.cos(pa)*fs,fy+Math.sin(pa)*fs);ctx.lineTo(fx+Math.cos(angle)*fs*0.7+Math.cos(pa)*fs*0.3,fy+Math.sin(angle)*fs*0.7+Math.sin(pa)*fs*0.3);ctx.closePath();ctx.fill();rem-=50;
        }
        let pos=size*0.12;const lss=hs*0.55;
        while(rem>=10){const bx=x+Math.cos(angle)*pos,by=y+Math.sin(angle)*pos;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+Math.cos(angle+Math.PI/2)*lss,by+Math.sin(angle+Math.PI/2)*lss);ctx.stroke();pos+=size*0.16;rem-=10;}
        if(rem>=5){const bx=x+Math.cos(angle)*pos,by=y+Math.sin(angle)*pos;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+Math.cos(angle+Math.PI/2)*lss*0.55,by+Math.sin(angle+Math.PI/2)*lss*0.55);ctx.stroke();}
        ctx.restore();
    }

    function _dibuixarWindBarbs(ctx){
        if(!_windBarbAnchors||!ventEnabled)return;
        const baseSize=WIND_BARB_CONFIG.BASE_SIZE*(1+(mapa.getZoom()-8)*0.06);
        ctx.save();ctx.globalAlpha=0.9;ctx.lineCap='round';ctx.lineJoin='round';
        for(const anchor of _windBarbAnchors){const vent=_getVent(anchor.lat,anchor.lng);if(!vent)continue;const p=mapa.latLngToContainerPoint([anchor.lat,anchor.lng]);_dibuixarBarba(ctx,p.x,p.y,vent.speed,vent.dir,baseSize);}
        ctx.restore();
    }

 function _dibuixarStreamlines(ctx,W,H){
        if(!_windBarbCache)return;
        function getUV(px,py){
            if(px<0||px>W||py<0||py>H)return null;
            const ll=mapa.containerPointToLatLng([px,py]);
            const vent=_getVent(ll.lat,ll.lng);
            if(!vent)return null;
            const r=(270-vent.dir)*0.01745329252;
            return {u:vent.speed*Math.cos(r), v:vent.speed*Math.sin(r)};
        }
        const ST=STREAMLINE_CONFIG.STEP,DT=STREAMLINE_CONFIG.DT,MS=STREAMLINE_CONFIG.MAX_STEPS,CL=STREAMLINE_CONFIG.CELL;
        const mW=Math.floor(W/CL)+1,mH=Math.floor(H/CL)+1;
        const mask=new Uint8Array(mW*mH);
        const sc=_streamlineColorMode==='white'?`rgba(255,255,255,${STREAMLINE_CONFIG.OPACITY})`:`rgba(0,0,0,${STREAMLINE_CONFIG.OPACITY})`;
        ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=STREAMLINE_CONFIG.WIDTH;ctx.strokeStyle=sc;ctx.shadowBlur=0;
        for(let y=0;y<H;y+=ST){
            for(let x=0;x<W;x+=ST){
                let sx=x+(Math.random()-0.5)*ST*0.6, sy=y+(Math.random()-0.5)*ST*0.6;
                const sMX=Math.floor(sx/CL),sMY=Math.floor(sy/CL);
                if(sMY<0||sMY>=mH||sMX<0||sMX>=mW)continue;
                if(mask[sMY*mW+sMX])continue;
                const fw=[],bw=[];let cx=sx,cy=sy;
                for(let i=0;i<MS;i++){
                    const uv=getUV(cx,cy);if(!uv)break;
                    const s=Math.hypot(uv.u,uv.v);if(s<0.2)break;
                    cx+=(uv.u/s)*DT;cy-=(uv.v/s)*DT;
                    const mx=Math.floor(cx/CL),my=Math.floor(cy/CL);
                    if(my<0||my>=mH||mx<0||mx>=mW)break;
                    if(mask[my*mW+mx])break;
                    fw.push([cx,cy]);
                }
                cx=sx;cy=sy;
                for(let i=0;i<MS;i++){
                    const uv=getUV(cx,cy);if(!uv)break;
                    const s=Math.hypot(uv.u,uv.v);if(s<0.2)break;
                    cx-=(uv.u/s)*DT;cy+=(uv.v/s)*DT;
                    const mx=Math.floor(cx/CL),my=Math.floor(cy/CL);
                    if(my<0||my>=mH||mx<0||mx>=mW)break;
                    if(mask[my*mW+mx])break;
                    bw.push([cx,cy]);
                }
                const line=[...bw.reverse(),[sx,sy],...fw];
                if(line.length>12){
                    for(let i=0;i<line.length;i+=3){
                        const mx=Math.floor(line[i][0]/CL),my=Math.floor(line[i][1]/CL);
                        if(my>=0&&my<mH&&mx>=0&&mx<mW)mask[my*mW+mx]=1;
                    }
                    ctx.beginPath();ctx.moveTo(line[0][0],line[0][1]);
                    for(let i=1;i<line.length-1;i++){
                        const xc=(line[i][0]+line[i+1][0])/2,yc=(line[i][1]+line[i+1][1])/2;
                        ctx.quadraticCurveTo(line[i][0],line[i][1],xc,yc);
                    }
                    ctx.stroke();
                    if(line.length>25){
                        const aS=Math.floor(line.length/4);
                        for(let a=aS;a<line.length-3;a+=aS){
                            const p1=line[a],p2=line[a+2];
                            if(p1&&p2){
                                const ang=Math.atan2(p2[1]-p1[1],p2[0]-p1[0]);
                                ctx.beginPath();ctx.moveTo(p1[0],p1[1]);
                                ctx.lineTo(p1[0]-4*Math.cos(ang-0.6),p1[1]-4*Math.sin(ang-0.6));
                                ctx.moveTo(p1[0],p1[1]);
                                ctx.lineTo(p1[0]-4*Math.cos(ang+0.6),p1[1]-4*Math.sin(ang+0.6));
                                ctx.stroke();
                            }
                        }
                    } else if(line.length>15){
                        const last=line[line.length-1],prev=line[Math.max(0,line.length-5)];
                        if(prev&&last!==prev){
                            const ang=Math.atan2(last[1]-prev[1],last[0]-prev[0]);
                            ctx.beginPath();ctx.moveTo(last[0],last[1]);
                            ctx.lineTo(last[0]-5*Math.cos(ang-0.5),last[1]-5*Math.sin(ang-0.5));
                            ctx.moveTo(last[0],last[1]);
                            ctx.lineTo(last[0]-5*Math.cos(ang+0.5),last[1]-5*Math.sin(ang+0.5));
                            ctx.stroke();
                        }
                    }
                }
            }
        }
        ctx.restore();
    }

    function _renderVent(ctx,W,H){
        if(!ventEnabled)return;
        const hPerVar=_ventAlturaPerVariable(_variableActual);if(hPerVar===null)return;
        if(_ventDisplayMode==='barbes')_dibuixarWindBarbs(ctx);else _dibuixarStreamlines(ctx,W,H);
    }

    function _actualitzarVent(regenerarAncores){
        if(!ventEnabled||!canvasLayer._dadesActuals){_windBarbCache=null;_windBarbAnchors=null;if(canvasLayer._map)canvasLayer._redraw();return;}
        _windBarbCache=_construirCacheVent(canvasLayer._dadesActuals,ventAlturaActiva);
        if(!_windBarbCache){_windBarbAnchors=null;if(canvasLayer._map)canvasLayer._redraw();return;}
        if(regenerarAncores!==false)_regenerarAncoresVent();
        if(canvasLayer._map)canvasLayer._redraw();
    }

    function toggleVent(enable){
        ventEnabled=enable;
        if(!ventEnabled){_windBarbCache=null;_windBarbAnchors=null;if(canvasLayer._map)canvasLayer._redraw();}
        else _actualitzarVent(true);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  HODÒGRAF
    // ═══════════════════════════════════════════════════════════════════
    function _obtenirVentsTotesAltures(lat,lng){
        if(!canvasLayer._dadesActuals)return null;
        const surface=canvasLayer._dadesActuals.surface;if(!surface)return null;
        const meta=window._indexData?.meta;if(!meta)return null;
        const N=meta.n_grid,ext=meta.extent;
        const col=((lng-ext[0])/(ext[1]-ext[0]))*(N-1),fila=((ext[3]-lat)/(ext[3]-ext[2]))*(N-1);
        if(col<0||col>=N-1||fila<0||fila>=N-1)return null;
        const x0=Math.floor(col),y0=Math.floor(fila),tx=col-x0,ty=fila-y0,x1=Math.min(x0+1,N-1),y1=Math.min(y0+1,N-1);
        const altures=[10,20,100,250,500],result=[];
        for(const h of altures){
            const wk=`wind_speed_${h}m`,dk=`wind_direction_${h}m`;
            const sd=surface[wk],dd=surface[dk];if(!sd||!dd)continue;
            const s00=sd[y0*N+x0],s10=sd[y0*N+x1],s01=sd[y1*N+x0],s11=sd[y1*N+x1];
            const d00=dd[y0*N+x0],d10=dd[y0*N+x1],d01=dd[y1*N+x0],d11=dd[y1*N+x1];
            if(isNaN(s00)||isNaN(s10)||isNaN(s01)||isNaN(s11))continue;
            const speed=(1-ty)*((1-tx)*s00+tx*s10)+ty*((1-tx)*s01+tx*s11);
            let dir=(1-ty)*((1-tx)*d00+tx*d10)+ty*((1-tx)*d01+tx*d11);
            if(dir<0)dir+=360;if(dir>=360)dir-=360;
            result.push({altura:h,speed,dir,spd_kt:speed*0.539957,spd_ms:speed/3.6});
        }
        return result.length>0?result:null;
    }
    function _mostrarHodograf(latlng){
        _tancarHodograf();
        const vents=_obtenirVentsTotesAltures(latlng.lat,latlng.lng);
        if(!vents){alert('No hi ha dades de vent en aquest punt');return;}
        const icon=L.divIcon({className:'pi-hodograf-marker',html:'<div style="width:8px;height:8px;background:#000080;border:1px solid #fff;"></div>',iconSize:[8,8],iconAnchor:[4,4]});
        _hodografMarker=L.marker(latlng,{icon,zIndexOffset:1000}).addTo(mapa);_hodografVisible=true;
    }
    function _tancarHodograf(){if(_hodografMarker){mapa.removeLayer(_hodografMarker);_hodografMarker=null;}_hodografVisible=false;}
    window._tancarHodografExtern=_tancarHodograf;

    // ═══════════════════════════════════════════════════════════════════
    //  CAPES GEOJSON — sempre per sobre del canvas
    // ═══════════════════════════════════════════════════════════════════
    const _capaInstancies={};

    function _bringGeojsonToFront(){
        for(const def of GEOJSON_CAPES){
            const cap=_capaInstancies[def.id];
            if(cap&&mapa.hasLayer(cap))cap.bringToFront();
        }
    }

    function _estilAvis(f){
        const n=(f.properties?.nivell||f.properties?.level||'').toLowerCase();
        const c={groc:{color:'#e6c200',fillColor:'#ffe033',fillOpacity:0.18,weight:1.2},taronja:{color:'#e07000',fillColor:'#ff9020',fillOpacity:0.20,weight:1.4},vermell:{color:'#cc1010',fillColor:'#ff3030',fillOpacity:0.22,weight:1.6},yellow:{color:'#e6c200',fillColor:'#ffe033',fillOpacity:0.18,weight:1.2},orange:{color:'#e07000',fillColor:'#ff9020',fillOpacity:0.20,weight:1.4},red:{color:'#cc1010',fillColor:'#ff3030',fillOpacity:0.22,weight:1.6}};
        return{...(c[n]||{color:'#aaa',fillColor:'#ccc',fillOpacity:0.12,weight:1.0}),opacity:0.85};
    }
    function _onEachAvis(f,l){
        const p=f.properties||{};const t=p.titol||p.title||p.nom||p.name||'',n=p.nivell||p.level||'',fn=p.fenomen||p.type||'';
        if(t||n||fn)l.bindTooltip(`<span style="font-size:11px;">${t?'<strong>'+t+'</strong><br>':''}${fn?fn+'<br>':''}${n?'Nivell: <em>'+n+'</em>':''}</span>`,{sticky:true,opacity:0.92});
    }
    function _crearEstilCapa(id){const c=config.capes[id]||{};return{color:c.color||'#000000',weight:c.gruix||1.0,opacity:(c.opacitat||100)/100,fill:false,dashArray:id.includes('comarques')?'3 3':undefined};}

    async function _carregarCapa(id){
        const d=GEOJSON_CAPES.find(c=>c.id===id);if(!d||_capaInstancies[id])return;
        try{
            const r=await fetch(`${DADES_PATH}/${d.arxiu}`);if(!r.ok)throw new Error('HTTP '+r.status);
            _capaInstancies[id]=L.geoJSON(await r.json(),d.esAvisos?{style:_estilAvis,onEachFeature:_onEachAvis}:{style:_crearEstilCapa(id)});
        }catch(err){console.warn('[GeoJSON] '+d.nom+': '+err.message);}
    }

    async function inicialitzarCapes(){
        for(const d of GEOJSON_CAPES){
            if(config.capes[d.id]?.visible){
                await _carregarCapa(d.id);
                if(_capaInstancies[d.id]&&!mapa.hasLayer(_capaInstancies[d.id]))_capaInstancies[d.id].addTo(mapa);
            }
        }
        _bringGeojsonToFront();
    }

    // Garantim GeoJSON per sobre en qualsevol interacció del mapa
    mapa.on('moveend zoomend', _bringGeojsonToFront);

    // ═══════════════════════════════════════════════════════════════════
    //  PANELL AJUSTOS
    // ═══════════════════════════════════════════════════════════════════
    function _crearBotonsVentMode(){
        const btnVentExistent=document.getElementById('pi-btnVent');if(!btnVentExistent)return;
        const parent=btnVentExistent.parentNode;if(!parent)return;
        const btnMode=document.createElement('button');
        btnMode.id='pi-btn-vent-mode';btnMode.textContent='Escull tipus de vent';btnMode.title='Canvia mode de visualització del vent';
        btnMode.style.cssText=btnVentExistent.style.cssText||'';btnMode.className=btnVentExistent.className||'';btnMode.style.marginLeft='4px';
        const MODES=['barbes','streamlines'];const LABELS={barbes:'↑ Barbes de vent actives!',streamlines:'〜 Streamlineas activas!'};
        btnMode.addEventListener('click',e=>{e.preventDefault();const idx=MODES.indexOf(_ventDisplayMode);_ventDisplayMode=MODES[(idx+1)%MODES.length];btnMode.textContent=LABELS[_ventDisplayMode];_actualitzarVent(true);});
        parent.insertBefore(btnMode,btnVentExistent.nextSibling);
    }

    function _crearPanellAjustos(){
        const btnAncora=document.getElementById('pi-btn-vent-mode')||document.getElementById('pi-btnVent');if(!btnAncora)return;
        const parent=btnAncora.parentNode;if(!parent)return;
        const btnAjustos=document.createElement('button');
        btnAjustos.id='pi-btn-ajustos';btnAjustos.textContent='⚙';btnAjustos.title='Ajustos, capes i mapa base';
        btnAjustos.style.cssText=btnAncora.style.cssText||'';btnAjustos.className=btnAncora.className||'';btnAjustos.style.marginLeft='4px';
        parent.insertBefore(btnAjustos,btnAncora.nextSibling);
        const wrap=document.getElementById('pi-canvas-wrap')||document.body;
        const gridMapesHtml=Object.entries(MAPES_BASE).map(([clau,def])=>`<button data-mapa="${clau}" style="background:${clau===config.mapaBase?'#2a5a8a':'#e8e4dc'};color:${clau===config.mapaBase?'#f0f0f0':'#1a1a1a'};font-weight:${clau===config.mapaBase?'700':'400'};border:1px solid #999;font-size:9px;padding:3px 6px;cursor:pointer;text-align:left;font-family:'MS Sans Serif',Arial,sans-serif;">${def.nom}</button>`).join('');
        const capesHtml=GEOJSON_CAPES.map(def=>`<div class="pi-capa-fila" data-id="${def.id}" style="background:#c0c0c0;padding:3px 4px;margin-bottom:2px;display:flex;align-items:center;gap:4px;border-top:1px solid #fff;border-left:1px solid #fff;border-right:1px solid #808080;border-bottom:1px solid #808080;"><input type="checkbox" checked style="margin:0;width:13px;height:13px;cursor:pointer;flex-shrink:0;"><span style="flex:1;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${def.nom}</span><input type="color" value="#000000" style="width:22px;height:16px;padding:0;border:1px solid #808080;cursor:pointer;flex-shrink:0;"><input type="range" min="10" max="100" value="100" style="width:40px;height:14px;cursor:pointer;flex-shrink:0;accent-color:#000080;"></div>`).join('');
        const panell=document.createElement('div');panell.id='pi-panell-ajustos';
        panell.style.cssText='display:none;position:absolute;z-index:960;width:270px;max-height:85vh;overflow-y:auto;background:#c0c0c0;border-top:2px solid #fff;border-left:2px solid #fff;border-right:2px solid #555;border-bottom:2px solid #555;font-family:"MS Sans Serif","Microsoft Sans Serif",Arial,sans-serif;font-size:11px;color:#000;box-shadow:2px 2px 6px rgba(0,0,0,0.4);';
        panell.innerHTML=`<div style="background:linear-gradient(90deg,#000080,#1084d0);color:#fff;font-weight:700;font-size:11px;padding:3px 5px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #000;cursor:move;" id="pi-ajustos-barra"><span>⚙ Ajustos · Capes · Mapa base</span><button id="pi-ajustos-tancar" style="background:#c0c0c0;border-top:1px solid #fff;border-left:1px solid #fff;border-right:1px solid #555;border-bottom:1px solid #555;color:#000;font-weight:700;font-size:10px;width:16px;height:16px;cursor:pointer;padding:0;line-height:1;">✕</button></div><div style="padding:7px 9px;display:flex;flex-direction:column;gap:6px;"><div><div style="display:flex;justify-content:space-between;"><span>Opacitat capa dades</span><span id="pi-aj-opacitat-val">88%</span></div><input type="range" id="pi-aj-opacitat" min="10" max="100" value="88" style="width:100%;accent-color:#000080;"></div><div style="border-top:1px solid #888;"></div><div style="display:flex;align-items:center;gap:6px;"><span style="font-size:10px;color:#000080;font-weight:700;">↑ Vent</span><span style="font-size:10px;">alçada auto:</span><span id="pi-vent-altura-activa" style="font-size:10px;font-weight:700;color:#80c8ff;">10m</span></div><div style="font-weight:700;color:#000080;font-size:10px;">↑ Barbes</div><div><div style="display:flex;justify-content:space-between;"><span>Densitat</span><span id="pi-aj-barb-dens-val">35px</span></div><input type="range" id="pi-aj-barb-dens" min="15" max="70" value="35" style="width:100%;accent-color:#000080;"></div><div><div style="display:flex;justify-content:space-between;"><span>Mida</span><span id="pi-aj-barb-mida-val">14</span></div><input type="range" id="pi-aj-barb-mida" min="6" max="24" value="14" style="width:100%;accent-color:#000080;"></div><div style="border-top:1px solid #888;"></div><div style="font-weight:700;color:#000080;font-size:10px;">〜 Streamlines</div><div><div style="display:flex;justify-content:space-between;"><span>Densitat</span><span id="pi-aj-stream-dens-val">18px</span></div><input type="range" id="pi-aj-stream-dens" min="8" max="40" value="18" style="width:100%;accent-color:#000080;"></div><div><div style="display:flex;justify-content:space-between;"><span>Gruix</span><span id="pi-aj-stream-gruix-val">1.2</span></div><input type="range" id="pi-aj-stream-gruix" min="5" max="30" value="12" style="width:100%;accent-color:#000080;"></div><div><div style="display:flex;justify-content:space-between;"><span>Opacitat</span><span id="pi-aj-stream-op-val">70%</span></div><input type="range" id="pi-aj-stream-op" min="20" max="100" value="70" style="width:100%;accent-color:#000080;"></div><div style="border-top:1px solid #888;"></div><div style="font-weight:700;color:#000080;font-size:10px;">🗺 Mapa base</div><div id="pi-grid-mapes" style="display:grid;grid-template-columns:1fr 1fr;gap:2px;">${gridMapesHtml}</div><div style="border-top:1px solid #888;"></div><div style="font-weight:700;color:#000080;font-size:10px;">🏷 Capes del mapa</div><div id="pi-llista-capes">${capesHtml}</div></div>`;
        wrap.appendChild(panell);

        function _posicionarPanell(){
            const rb=btnAjustos.getBoundingClientRect(),rw=wrap.getBoundingClientRect();
            let left=rb.left-rw.left-panell.offsetWidth+btnAjustos.offsetWidth;
            left=Math.max(4,Math.min(left,rw.width-panell.offsetWidth-4));
            const top=rb.top-rw.top-Math.min(panell.offsetHeight,rw.height*0.8)-6;
            panell.style.left=left+'px';panell.style.top=Math.max(4,top)+'px';
        }

        let _arr=false,_ox,_oy;
        const barra=panell.querySelector('#pi-ajustos-barra');
        barra.addEventListener('mousedown',(e)=>{if(e.target.tagName==='BUTTON')return;_arr=true;const r=panell.getBoundingClientRect();_ox=e.clientX-r.left;_oy=e.clientY-r.top;e.preventDefault();});
        document.addEventListener('mousemove',(e)=>{if(!_arr)return;const wr=wrap.getBoundingClientRect();let nx=e.clientX-wr.left-_ox,ny=e.clientY-wr.top-_oy;nx=Math.max(0,Math.min(nx,wr.width-panell.offsetWidth));ny=Math.max(0,Math.min(ny,wr.height-panell.offsetHeight));panell.style.left=nx+'px';panell.style.top=ny+'px';panell.style.right='auto';});
        document.addEventListener('mouseup',()=>{_arr=false;});

        let obert=false;
        function _tancarPanell(){obert=false;panell.style.display='none';}
        btnAjustos.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();obert=!obert;if(obert){panell.style.visibility='hidden';panell.style.display='block';_posicionarPanell();panell.style.visibility='visible';}else panell.style.display='none';});
        panell.querySelector('#pi-ajustos-tancar').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();_tancarPanell();});
        document.addEventListener('click',e=>{if(obert&&!panell.contains(e.target)&&e.target!==btnAjustos)_tancarPanell();});

        const $=id=>document.getElementById(id);
        $('pi-aj-opacitat').addEventListener('input',function(){_opacitatCapa=this.value/100;$('pi-aj-opacitat-val').textContent=this.value+'%';if(canvasLayer._map)canvasLayer._redraw();});
        $('pi-aj-barb-dens').addEventListener('input',function(){WIND_BARB_CONFIG.DENSITY=parseInt(this.value,10);$('pi-aj-barb-dens-val').textContent=this.value+'px';if(_ventDisplayMode==='barbes')_actualitzarVent(true);});
        $('pi-aj-barb-mida').addEventListener('input',function(){WIND_BARB_CONFIG.BASE_SIZE=parseInt(this.value,10);$('pi-aj-barb-mida-val').textContent=this.value;if(_ventDisplayMode==='barbes')_actualitzarVent(false);});
        $('pi-aj-stream-dens').addEventListener('input',function(){STREAMLINE_CONFIG.STEP=parseInt(this.value,10);$('pi-aj-stream-dens-val').textContent=this.value+'px';if(canvasLayer._map)canvasLayer._redraw();});
        $('pi-aj-stream-gruix').addEventListener('input',function(){STREAMLINE_CONFIG.WIDTH=this.value/10;$('pi-aj-stream-gruix-val').textContent=(this.value/10).toFixed(1);if(canvasLayer._map)canvasLayer._redraw();});
        $('pi-aj-stream-op').addEventListener('input',function(){STREAMLINE_CONFIG.OPACITY=this.value/100;$('pi-aj-stream-op-val').textContent=this.value+'%';if(canvasLayer._map)canvasLayer._redraw();});

        $('pi-grid-mapes').querySelectorAll('button[data-mapa]').forEach(btn=>{
            btn.addEventListener('click',()=>{
                canviarMapaBase(btn.dataset.mapa);
                $('pi-grid-mapes').querySelectorAll('button').forEach(b=>{b.style.background='#e8e4dc';b.style.color='#1a1a1a';b.style.fontWeight='400';});
                btn.style.background='#2a5a8a';btn.style.color='#f0f0f0';btn.style.fontWeight='700';
            });
        });

        $('pi-llista-capes').querySelectorAll('.pi-capa-fila').forEach(fila=>{
            const id=fila.dataset.id;
            const inputs=fila.querySelectorAll('input');
            const cbEl=inputs[0],colEl=inputs[1],opEl=inputs[2];
            cbEl.addEventListener('change',()=>{if(_capaInstancies[id]){if(cbEl.checked){_capaInstancies[id].addTo(mapa);_bringGeojsonToFront();}else mapa.removeLayer(_capaInstancies[id]);}});
            colEl.addEventListener('input',()=>{if(_capaInstancies[id])_capaInstancies[id].setStyle({color:colEl.value});});
            opEl.addEventListener('input',()=>{if(_capaInstancies[id])_capaInstancies[id].setStyle({opacity:parseInt(opEl.value)/100});});
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CANVAS LAYER — z-index baix per deixar GeoJSON per sobre
    // ═══════════════════════════════════════════════════════════════════
    const CanvasLayer = L.Layer.extend({
        initialize: function(){
            this._canvas=null;this._cacheHores={};this._dadesActuals=null;
            this._mapKey='reflectivity';this._mapDef=MAPS.reflectivity;
            this._pasActual=0;this._cachedTile=null;this._cachedKey='';this._carregant=false;
        },
        onAdd: function(map){
            this._map=map;
            const c=document.createElement('canvas');
            // ▼ z-index baix: el overlayPane de Leaflet (GeoJSON) va per sobre automàticament
            c.style.cssText='position:absolute;top:0;left:0;pointer-events:none;z-index:200;';
            map.getPanes().overlayPane.appendChild(c);
            this._canvas=c;
            map.on('moveend zoomend',this._onMapSettled,this);
            this._redraw();
        },
        onRemove: function(map){
            map.getPanes().overlayPane.removeChild(this._canvas);
            map.off('moveend zoomend',this._onMapSettled,this);
        },
        _onMapSettled: function(){
            if(ventEnabled&&_ventDisplayMode==='barbes')_regenerarAncoresVent();
            this._redraw();
            _bringGeojsonToFront();
        },
        _invalidateCache: function(){this._cachedTile=null;this._cachedKey='';},
        async _carregarHora(idx){
            if(this._cacheHores[idx]){this._dadesActuals=this._cacheHores[idx];return true;}
            if(this._carregant)return false;
            this._carregant=true;
            try{
                const zona=REGIONS[0],hh=String(idx).padStart(2,'0');
                const r=await fetch(`${BASE_PATH}/dades_aromepi_${zona}_h${hh}.js?v=${Date.now()}`);
                if(r.ok){
                    const text=await r.text(),start=text.indexOf('{');
                    if(start!==-1){this._cacheHores[idx]=JSON.parse(text.slice(start).replace(/;\s*$/,''));this._dadesActuals=this._cacheHores[idx];this._carregant=false;return true;}
                }
            }catch(err){console.warn('[PI] h'+idx+': '+err.message);}
            this._carregant=false;return false;
        },
        _obtenirValor: function(lat,lng){
            if(!this._dadesActuals||!window._indexData)return null;
            const surface=this._dadesActuals.surface;if(!surface)return null;
            const ext=window._indexData.meta.extent,N=window._indexData.meta.n_grid;
            const col=Math.round((lng-ext[0])/((ext[1]-ext[0])/(N-1))),fila=Math.round((ext[3]-lat)/((ext[3]-ext[2])/(N-1)));
            if(col<0||col>=N||fila<0||fila>=N)return null;
            const v=this._mapDef.getValue(surface,fila*N+col);
            return(v!==null&&v!==undefined&&!isNaN(v))?v:null;
        },
        _buildTile: function(){
            if(!this._dadesActuals||!window._indexData)return null;
            const surface=this._dadesActuals.surface;if(!surface)return null;
            const N=window._indexData.meta.n_grid,RES=512;
            const tile=document.createElement('canvas');tile.width=RES;tile.height=RES;
            const tctx=tile.getContext('2d'),img=tctx.createImageData(RES,RES),d=img.data;
            const ext=window._indexData.meta.extent,def=this._mapDef;
            const interpolaCategoric=def.tipus==='categoric';
            for(let py=0;py<RES;py++){
                const lat=ext[3]-(py/(RES-1))*(ext[3]-ext[2]);
                for(let px=0;px<RES;px++){
                    const lng=ext[0]+(px/(RES-1))*(ext[1]-ext[0]);
                    const fx=((lng-ext[0])/(ext[1]-ext[0]))*(N-1),fy=((ext[3]-lat)/(ext[3]-ext[2]))*(N-1);
                    let v=null;
                    if(fx>=0&&fx<=N-1&&fy>=0&&fy<=N-1){
                        const x0=Math.max(0,Math.min(N-2,Math.floor(fx))),y0=Math.max(0,Math.min(N-2,Math.floor(fy)));
                        if(interpolaCategoric){const xn=Math.round(fx),yn=Math.round(fy);v=def.getValue(surface,yn*N+xn);}
                        else{const tx=fx-x0,ty=fy-y0;const v00=def.getValue(surface,y0*N+x0),v10=def.getValue(surface,y0*N+x0+1),v01=def.getValue(surface,(y0+1)*N+x0),v11=def.getValue(surface,(y0+1)*N+x0+1);if(v00!=null&&v10!=null&&v01!=null&&v11!=null&&!isNaN(v00)&&!isNaN(v10)&&!isNaN(v01)&&!isNaN(v11))v=(1-ty)*((1-tx)*v00+tx*v10)+ty*((1-tx)*v01+tx*v11);}
                    }
                    const ii=(py*RES+px)*4;
                    if(v===null||v===undefined||isNaN(v)){d[ii+3]=0;continue;}
                    const c=getColor(def,v);if((c.a??220)<5){d[ii+3]=0;continue;}
                    d[ii]=c.r;d[ii+1]=c.g;d[ii+2]=c.b;d[ii+3]=c.a??220;
                }
            }
            tctx.putImageData(img,0,0);return tile;
        },
        _redraw: function(){
            if(!this._dadesActuals||!window._indexData||!this._map)return;
            const map=this._map,size=map.getSize(),canvas=this._canvas;if(!canvas)return;
            canvas.width=size.x;canvas.height=size.y;
            const ctx=canvas.getContext('2d');
            const ext=window._indexData.meta.extent;
            const nw=map.latLngToContainerPoint(L.latLng(ext[3],ext[0])),se=map.latLngToContainerPoint(L.latLng(ext[2],ext[1]));
            L.DomUtil.setPosition(canvas,map.containerPointToLayerPoint([0,0]));
            const cacheKey=this._mapKey+'_'+this._pasActual;
            if(!this._cachedTile||this._cachedKey!==cacheKey){this._cachedTile=this._buildTile();this._cachedKey=cacheKey;}
            if(this._cachedTile){
                ctx.save();ctx.beginPath();ctx.rect(nw.x,nw.y,se.x-nw.x,se.y-nw.y);ctx.clip();
                ctx.imageSmoothingEnabled=this._mapDef.tipus!=='categoric';ctx.imageSmoothingQuality='high';
                ctx.globalAlpha=_opacitatCapa;ctx.drawImage(this._cachedTile,nw.x,nw.y,se.x-nw.x,se.y-nw.y);
                ctx.globalAlpha=1;ctx.restore();
            }
            _renderVent(ctx,size.x,size.y);
            // Garantim GeoJSON per sobre després de cada redraw
            _bringGeojsonToFront();
        },
        setMap: function(mapKey){
            const def=MAPS[mapKey];if(!def)return;
            this._mapKey=mapKey;this._mapDef=def;this._invalidateCache();
            if(this._map)requestAnimationFrame(()=>this._redraw());
        },
        setHour: async function(idx){
            this._pasActual=idx;this._invalidateCache();
            if(await this._carregarHora(idx)){this._redraw();if(ventEnabled)_actualitzarVent(false);}
        },
        getValorALatLng: function(lat,lng){return this._obtenirValor(lat,lng);},
    });
    const canvasLayer=new CanvasLayer();
    window._canvasLayer=canvasLayer;
    canvasLayer.addTo(mapa);

    // ═══════════════════════════════════════════════════════════════════
    //  LLEGENDA
    // ═══════════════════════════════════════════════════════════════════
    function actualitzarLlegenda(def){
        const te=document.querySelector('.pi-leg-title'),ue=document.querySelector('.pi-leg-unit'),de=document.querySelector('.pi-leg-desc');
        if(te)te.textContent=def.titol;if(ue)ue.textContent=def.unitat?`(${def.unitat})`:'';if(de)de.textContent=def.descripcio||'';
        const be=document.getElementById('pi-leg-bar');if(!be)return;be.innerHTML='';
        if(def.tipus==='categoric'){
            be.style.cssText='display:flex;flex-direction:column;gap:3px;width:100%;max-height:160px;overflow-y:auto;padding:2px 0;';
            Object.entries(def.categories).forEach(([codi,cat])=>{
                const fila=document.createElement('div');fila.style.cssText='display:flex;align-items:center;gap:6px;font-size:10px;color:#c0d0e0;';
                const swatch=document.createElement('span');swatch.style.cssText=`display:inline-block;width:14px;height:14px;border-radius:3px;flex-shrink:0;background:${cat.color};border:1px solid rgba(255,255,255,0.25);`;
                const label=document.createElement('span');label.textContent=cat.label;
                fila.appendChild(swatch);fila.appendChild(label);be.appendChild(fila);
            });return;
        }
        be.style.cssText='display:block;width:100%;';
        const amp=Math.max(be.offsetWidth||280,280);
        const cvs=document.createElement('canvas');cvs.width=amp;cvs.height=16;
        cvs.style.cssText='display:block;border-radius:5px;width:100%;height:16px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.12);';
        be.appendChild(cvs);
        const ctx=cvs.getContext('2d'),img=ctx.createImageData(amp,16);
        const min=def.stops[0].v,max=def.stops[def.stops.length-1].v;
        for(let x=0;x<amp;x++){const v=min+(x/(amp-1))*(max-min),c=getColorContinu(def,v);for(let y=0;y<16;y++){const ii=(y*amp+x)*4;img.data[ii]=c.r;img.data[ii+1]=c.g;img.data[ii+2]=c.b;img.data[ii+3]=255;}}
        ctx.putImageData(img,0,0);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  HORA LOCAL
    // ═══════════════════════════════════════════════════════════════════
    function _formatLocal(dt,opts){return new Intl.DateTimeFormat('ca-ES',{timeZone:TIMEZONE_LOCAL,...opts}).format(dt);}
    function _hhmmLocal(dt){return _formatLocal(dt,{hour:'2-digit',minute:'2-digit',hour12:false});}
    function _diaLocal(dt){
        const DIES=['Dg','Dl','Dt','Dc','Dj','Dv','Ds'],MESOS=['Gen','Feb','Mar','Abr','Mai','Jun','Jul','Ago','Set','Oct','Nov','Des'];
        const parts=new Intl.DateTimeFormat('en-US',{timeZone:TIMEZONE_LOCAL,weekday:'short',day:'numeric',month:'short'}).formatToParts(dt);
        const map={};parts.forEach(p=>map[p.type]=p.value);
        const wdMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6},moMap={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
        return`${DIES[wdMap[map.weekday]]??map.weekday} ${map.day} ${MESOS[moMap[map.month]]??map.month}`;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  DETECCIÓ D'HORES DISPONIBLES
    // ═══════════════════════════════════════════════════════════════════
    async function _comprovarHoraDisponible(idx){
        try{const zona=REGIONS[0],hh=String(idx).padStart(2,'0');const r=await fetch(`${BASE_PATH}/dades_aromepi_${zona}_h${hh}.js`,{method:'HEAD',cache:'no-store'});return r.ok;}catch(err){return false;}
    }
    async function _detectarHoresDisponibles(nSteps){
        const checks=[];for(let i=0;i<nSteps;i++)checks.push(_comprovarHoraDisponible(i));
        const resultats=await Promise.all(checks);
        const disponibles=[];for(let i=0;i<nSteps;i++)if(resultats[i])disponibles.push(i);
        return disponibles;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  SELECTOR D'HORES DROPDOWN
    // ═══════════════════════════════════════════════════════════════════
    let _dropdownObert=false;

function _construirSelectorHoresDOM(){
    const hourbar = document.getElementById('pi-hourbar');
    if(!hourbar) return null;
    hourbar.innerHTML = '';
    // ── Estil compacte: tot en una línia, alçada mínima ──
    hourbar.style.cssText = 'width:auto;background:transparent;border-right:none;display:flex;flex-direction:row;align-items:center;overflow:visible;flex-shrink:0;position:relative;gap:2px;padding:0 2px;height:28px;';
    
    // ── Botó ANTERIOR (petit) ──
    const btnPrev = document.createElement('button');
    btnPrev.id = 'pi-hora-prev';
    btnPrev.textContent = '◄';
    btnPrev.title = 'Hora anterior';
    btnPrev.style.cssText = 'background:#c0c0c0;border-top:1px solid #fff;border-left:1px solid #fff;border-right:1px solid #555;border-bottom:1px solid #555;color:#000;font-family:"MS Sans Serif",Arial,sans-serif;font-size:10px;font-weight:700;padding:1px 4px;cursor:pointer;min-width:20px;height:20px;line-height:1;text-align:center;';
    btnPrev.addEventListener('click', (e) => {
        e.preventDefault();
        const pos = _hoursDisponibles.indexOf(_pasActual);
        if(pos > 0) pintarPas(_hoursDisponibles[pos - 1]);
    });
    
    // ── Dropdown (compacte) ──
    const wrap = document.createElement('div');
    wrap.id = 'pi-hora-dropdown-wrap';
    wrap.style.cssText = 'position:relative;font-family:"MS Sans Serif",Arial,sans-serif;font-size:11px;';
    
    const btn = document.createElement('button');
    btn.id = 'pi-hora-dropdown-btn';
    btn.style.cssText = 'background:#c0c0c0;border-top:1px solid #fff;border-left:1px solid #fff;border-right:1px solid #555;border-bottom:1px solid #555;color:#000;font-family:"MS Sans Serif",Arial,sans-serif;font-size:11px;font-weight:700;padding:1px 6px;cursor:pointer;display:flex;align-items:center;gap:4px;min-width:80px;height:20px;justify-content:space-between;';
    btn.innerHTML = `<span id="pi-hora-dropdown-label">--:--</span><span style="font-size:7px;">▼</span>`;

    // Indicador de càrrega (més petit)
    const loadingSpan = document.createElement('span');
    loadingSpan.id = 'pi-hora-loading';
    loadingSpan.textContent = 'Carregant...';
    loadingSpan.title = 'Carregant...';
    loadingSpan.style.cssText = 'display:none;color:#ffcc00;font-size:12px;font-weight:700;margin-left:2px;';

    const llista = document.createElement('div');
    llista.id = 'pi-hora-dropdown-llista';
    llista.style.cssText = 'display:none;position:absolute;top:100%;left:0;margin-top:1px;z-index:950;background:#c0c0c0;border-top:2px solid #fff;border-left:2px solid #fff;border-right:2px solid #555;border-bottom:2px solid #555;max-height:260px;overflow-y:auto;min-width:130px;box-shadow:2px 2px 6px rgba(0,0,0,0.4);';

    wrap.appendChild(btn);
    wrap.appendChild(loadingSpan);
    wrap.appendChild(llista);
    
    // ── Botó SEGÜENT (petit) ──
    const btnNext = document.createElement('button');
    btnNext.id = 'pi-hora-next';
    btnNext.textContent = '►';
    btnNext.title = 'Hora següent';
    btnNext.style.cssText = 'background:#c0c0c0;border-top:1px solid #fff;border-left:1px solid #fff;border-right:1px solid #555;border-bottom:1px solid #555;color:#000;font-family:"MS Sans Serif",Arial,sans-serif;font-size:10px;font-weight:700;padding:1px 4px;cursor:pointer;min-width:20px;height:20px;line-height:1;text-align:center;';
    btnNext.addEventListener('click', (e) => {
        e.preventDefault();
        const pos = _hoursDisponibles.indexOf(_pasActual);
        if(pos >= 0 && pos < _hoursDisponibles.length - 1) pintarPas(_hoursDisponibles[pos + 1]);
    });
    
    // ── Muntar tot (ordre: ◄ | dropdown | ►) ──
    hourbar.appendChild(btnPrev);
    hourbar.appendChild(wrap);
    hourbar.appendChild(btnNext);

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        _dropdownObert = !_dropdownObert;
        llista.style.display = _dropdownObert ? 'block' : 'none';
    });
    
    document.addEventListener('click', (e) => {
        if(_dropdownObert && !wrap.contains(e.target)) {
            _dropdownObert = false;
            llista.style.display = 'none';
        }
    });
    
    return {wrap, btn, llista, btnPrev, btnNext};
}

    function construirBarraHores(){
        const meta=getMeta();if(!meta)return;
        const dom=_construirSelectorHoresDOM();if(!dom)return;
        const{llista}=dom;llista.innerHTML='';
        (meta.times_utc||[]).forEach((ts,i)=>{
            if(!_hoursDisponibles.includes(i))return;
            const dt=new Date(ts),hhmmLocal=_hhmmLocal(dt),mins=i*(meta.step_minutes||15);
            const opt=document.createElement('div');opt.className='pi-hora-opt';opt.setAttribute('data-step',i);
            opt.style.cssText='padding:5px 10px;cursor:pointer;white-space:nowrap;display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #a0a0a0;font-family:"MS Sans Serif","Microsoft Sans Serif",Arial,sans-serif;font-size:11px;';
            opt.innerHTML=`<span style="font-weight:700;">${hhmmLocal}</span><span style="color:#555;">+${mins}m</span>`;
            opt.addEventListener('mouseenter',()=>{opt.style.background='#000080';opt.style.color='#fff';const sp=opt.querySelectorAll('span');sp.forEach(s=>{if(s.style.color==='rgb(85, 85, 85)'||s.style.color==='#555')s.style.color='#cfe0ff';});});
            opt.addEventListener('mouseleave',()=>{opt.style.background='';opt.style.color='#000';const sp=opt.querySelectorAll('span');sp.forEach(s=>{if(s.style.color==='rgb(207, 224, 255)'||s.style.color==='#cfe0ff')s.style.color='#555';});});
            opt.addEventListener('click',()=>{_dropdownObert=false;llista.style.display='none';pintarPas(i);});
            llista.appendChild(opt);
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    //  PINTAR PAS — amb indicador de càrrega
    // ═══════════════════════════════════════════════════════════════════
    async function pintarPas(idx){
        const meta=getMeta();if(!meta)return;
        if(_hoursDisponibles.length===0)return;
        if(!_hoursDisponibles.includes(idx)){
            const millor=_hoursDisponibles.find(h=>h>=idx);
            idx=millor!==undefined?millor:_hoursDisponibles[_hoursDisponibles.length-1];
        }
        _pasActual=idx;

        // Mostrar "Carregant..." si l'hora no està en cache
        const loader=document.getElementById('pi-hora-loading');
        const jaEnCache=!!canvasLayer._cacheHores[idx];
        if(loader&&!jaEnCache)loader.style.display='inline';

        await canvasLayer.setHour(idx);
        actualitzarUIPas(idx);

        // Amagar indicador
        if(loader)loader.style.display='none';
    }

    function actualitzarUIPas(idx){
        const meta=getMeta();if(!meta)return;
        const ts=(meta.times_utc||[])[idx],dt=ts?new Date(ts):null,mins=idx*(meta.step_minutes||15);
        if(dt){
            const ed=document.getElementById('pi-overlay-date'),el=document.getElementById('pi-overlay-local'),eu=document.getElementById('pi-overlay-utc');
            if(ed)ed.textContent=_diaLocal(dt);if(el)el.textContent=_hhmmLocal(dt);
            if(eu)eu.textContent=`${String(dt.getUTCHours()).padStart(2,'0')}:${String(dt.getUTCMinutes()).padStart(2,'0')}Z`;
            const label=document.getElementById('pi-hora-dropdown-label');if(label)label.textContent=_hhmmLocal(dt);
        }
        const edl=document.getElementById('pi-overlay-delta');if(edl)edl.textContent=`+${mins}min`;
        document.querySelectorAll('.pi-hora-opt').forEach(e=>{
            const actiu=parseInt(e.getAttribute('data-step'))===idx;
            e.style.background=actiu?'#2a5a8a':'';e.style.color=actiu?'#f0f0f0':'#000';
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    //  EVENTS BOTONS
    // ═══════════════════════════════════════════════════════════════════
    document.querySelectorAll('.pi-var-btn').forEach(boto=>{
        boto.onclick=function(){
            const clau=boto.dataset.var,def=MAPS[clau];if(!def)return;
            document.querySelectorAll('.pi-var-btn').forEach(b=>b.classList.remove('active'));
            boto.classList.add('active');_variableActual=clau;canvasLayer.setMap(clau);actualitzarLlegenda(def);
            _sincronitzarVentAmbVariable(clau);
        };
    });

    const btnVent=document.getElementById('pi-btnVent');
    if(btnVent){btnVent.addEventListener('click',e=>{e.preventDefault();toggleVent(!ventEnabled);btnVent.classList.toggle('vent-active',ventEnabled);btnVent.textContent=ventEnabled?'Vent ACTIVAT':'Vent DESACTIVAT';});}

    document.getElementById('pi-vent-altura')?.addEventListener('change',function(){ventAlturaActiva=parseInt(this.value);if(ventEnabled)_actualitzarVent(false);});

    // Animació — sense botons Ant/Seg
    document.getElementById('pi-btnPlay')?.addEventListener('click',e=>{
        e.preventDefault();
        if(_animacioEnCurs){
            clearInterval(_temporitzadorAnimacio);_temporitzadorAnimacio=null;_animacioEnCurs=false;
            e.target.textContent='Anim';e.target.classList.remove('playing');
        }else{
            if(_hoursDisponibles.length===0)return;
            _animacioEnCurs=true;e.target.textContent='Stop';e.target.classList.add('playing');
            _temporitzadorAnimacio=setInterval(()=>{
                const pos=_hoursDisponibles.indexOf(_pasActual);
                const novaPos=(pos+1)%_hoursDisponibles.length;
                pintarPas(_hoursDisponibles[novaPos]);
            },500);
        }
    });

    // ═══════════════════════════════════════════════════════════════════
    //  POPUP
    // ═══════════════════════════════════════════════════════════════════
    mapa.on('click',function(e){
        if(e.originalEvent.button===2)return;
        const meta=getMeta();if(!meta)return;
        const def=MAPS[_variableActual];if(!def)return;
        const latlng=e.latlng,v=canvasLayer.getValorALatLng(latlng.lat,latlng.lng);if(v===null)return;
        const{text:valorDisplay,unitat:unitatDisplay}=def.format(v);
        const extraInfo=def.extraHtml(v);const c=getColor(def,v);
        const bandColor=`rgb(${c.r},${c.g},${c.b})`;
        const popupContent=`<div style="padding:6px 10px;font-family:'Segoe UI',Arial,sans-serif;font-size:10px;background:#12172a;color:#c0d0e0;min-width:140px;border:1px solid #2a3a5a;border-radius:4px;box-shadow:0 4px 14px rgba(0,0,0,0.35);"><div style="font-size:8px;color:#5a7a9a;">${latlng.lat.toFixed(3)}N / ${latlng.lng.toFixed(3)}E</div><div style="display:flex;align-items:baseline;gap:4px;margin-top:4px;"><span style="font-size:${def.tipus==='categoric'?'15':'22'}px;font-weight:700;color:#e8f0f8;line-height:1.2;">${valorDisplay}</span><span style="font-size:10px;color:#6a9abf;">${unitatDisplay}</span></div>${extraInfo}<div style="display:flex;align-items:center;gap:4px;margin-top:3px;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${bandColor};flex-shrink:0;"></span><span style="font-size:9px;color:#6a9abf;">${def.titol}</span></div></div>`;
        L.popup({closeButton:true,autoPan:false,offset:[0,-5],className:'pi-popup'}).setLatLng(latlng).setContent(popupContent).openOn(mapa);
    });

    mapa.on('contextmenu',function(e){e.originalEvent.preventDefault();_mostrarHodograf(e.latlng);});

    // ═══════════════════════════════════════════════════════════════════
    //  BOOTSTRAP
    // ═══════════════════════════════════════════════════════════════════
    async function carregar(){
        const zona=REGIONS[0];console.log('[PI] Carregant...');
        try{
            const r=await fetch(`${BASE_PATH}/dades_aromepi_${zona}_index.js?v=${Date.now()}`);
            if(r.ok){const text=await r.text(),start=text.indexOf('{');if(start!==-1){window._indexData=JSON.parse(text.slice(start).replace(/;\s*$/,''));console.log(`[PI] Grid ${window._indexData.meta.n_grid}x${window._indexData.meta.n_grid}`);}}
            else{console.error('[PI] Error HTTP '+r.status);return;}
        }catch(err){console.error('[PI] Error index: '+err.message);return;}

        const meta=getMeta();const nSteps=(meta?.times_utc||[]).length;
        _hoursDisponibles=await _detectarHoresDisponibles(nSteps);

        await inicialitzarCapes();
        construirBarraHores();
        actualitzarLlegenda(MAPS[_variableActual]);

if(_hoursDisponibles.length > 0) {
    // ── Detectar l'hora més propera a l'actual ──
    const meta = getMeta();
    const ara = new Date();  // hora actual del sistema
    const araUTC = ara.getTime();
    
    let millorIdx = _hoursDisponibles[0];
    let minDif = Infinity;
    
    for(const idx of _hoursDisponibles) {
        const ts = (meta.times_utc || [])[idx];
        if(!ts) continue;
        const dif = Math.abs(new Date(ts).getTime() - araUTC);
        if(dif < minDif) {
            minDif = dif;
            millorIdx = idx;
        }
    }
    
    await pintarPas(millorIdx);
    console.log('[PI] Hora més propera: +' + (millorIdx * (meta.step_minutes || 15)) + 'min');
} else {
    console.warn('[PI] Cap hora disponible encara.');
}

        _crearBotonsVentMode();
        _crearPanellAjustos();

        document.getElementById('pi-loader-overlay')?.classList.add('fade-out');
        const app=document.getElementById('pi-app');if(app)app.style.opacity='1';

        _sincronitzarVentAmbVariable(_variableActual);
        console.log('[PI] Llest!');
    }
    carregar();
    window.addEventListener('resize',()=>mapa.invalidateSize());



// ═══════════════════════════════════════════════════════════════════
//  VERSIÓ ULTRA-NETA: NOMÉS UNA CAPA GEOJSON, NEGRE, PER SOBRE
// ═══════════════════════════════════════════════════════════════════
(function() {
    
    let _jaAplicat = false;
    
    function _aplicarForcaLiniesNeta() {
        if (!mapa || !canvasLayer) return;
        
        // 1. CANVAS AL FONS ABSOLUT
        const canvas = canvasLayer._canvas;
        if (canvas) {
            canvas.style.zIndex = '10';
            // Assegurar que està al contenidor correcte
            if (!canvas.parentNode || canvas.parentNode === document.body) {
                const tilePane = mapa.getPane('tilePane');
                if (tilePane) tilePane.appendChild(canvas);
            }
        }
        
        // 2. OVERLAY PANE PER SOBRE
        const overlayPane = mapa.getPane('overlayPane');
        if (overlayPane) {
            overlayPane.style.zIndex = '500';
        }
        
        // 3. NOMÉS PORTAR AL FRONT - NO TOCAR ESTILS (evita duplicats)
        for (const id in _capaInstancies) {
            const capa = _capaInstancies[id];
            if (capa && mapa.hasLayer(capa)) {
                capa.bringToFront();
            }
        }
        
        // 4. SI CAL NEGRE, FER-HO NOMÉS UN COP
        if (!_jaAplicat) {
            _jaAplicat = true;
            for (const id in _capaInstancies) {
                const capa = _capaInstancies[id];
                if (!capa || !mapa.hasLayer(capa)) continue;
                
                const esAvisos = GEOJSON_CAPES.find(c => c.id === id)?.esAvisos;
                if (!esAvisos) {
                    // Aplicar estil a cada feature individual (evita duplicats)
                    capa.eachLayer(function(layer) {
                        if (layer.setStyle && !layer._estilNegreJaAplicat) {
                            layer._estilNegreJaAplicat = true;
                            layer.setStyle({
                                color: '#000000',
                                weight: 2.0,
                                opacity: 1.0,
                                fill: false,
                            });
                        }
                    });
                }
            }
        }
    }
    
    // Interceptar redraw del canvas (sense tocar estils)
    if (canvasLayer && canvasLayer._redraw) {
        const _redrawOriginal = canvasLayer._redraw.bind(canvasLayer);
        canvasLayer._redraw = function() {
            _redrawOriginal();
            // Només portar al front, no tocar estils
            for (const id in _capaInstancies) {
                const capa = _capaInstancies[id];
                if (capa && mapa.hasLayer(capa)) {
                    capa.bringToFront();
                }
            }
        };
    }
    
    // Events del mapa
    if (mapa) {
        mapa.on('moveend', function() {
            for (const id in _capaInstancies) {
                const capa = _capaInstancies[id];
                if (capa && mapa.hasLayer(capa)) capa.bringToFront();
            }
        });
        mapa.on('zoomend', function() {
            for (const id in _capaInstancies) {
                const capa = _capaInstancies[id];
                if (capa && mapa.hasLayer(capa)) capa.bringToFront();
            }
        });
    }
    
    setTimeout(_aplicarForcaLiniesNeta, 500);
    setTimeout(_aplicarForcaLiniesNeta, 2000);
    
    console.log('[PI] ✅ Línies NEGRES - 1 sola capa - Sense duplicats');
})();


// ═══════════════════════════════════════════════════════════════════════
//  METEOGRAMA AROME-PI v5.9  -  NET I ESTABLE
//  - Sense tooltip (evita lag)
//  - Barbes NO dins del terreny (relleu ON)
//  - Paleta T dramàtica (alt contrast)
//  - Un sol panell VENT 0-500m
// ═══════════════════════════════════════════════════════════════════════




(function () {
    'use strict';

    // ── Altures model ────────────────────────────────────────────────
    const ALT_T   = [10, 20, 100, 250, 500];
    const ALT_DP  = [10, 20, 100, 250, 500];
    const ALT_HR  = [10, 20, 35, 50, 75, 100, 150, 200, 250, 375, 500, 750, 1000, 1500, 2000, 3000];
    const ALT_VENT = [10, 20, 100, 250, 500];

    // ── Paleta TEMPERATURA DRAMÀTICA (alt contrast) ──────────────────
    const T_PAL = [
        {v:-30, r:0,   g:0,   b:80},    // Negre-blau
        {v:-25, r:10,  g:0,   b:130},   // Blau fosc
        {v:-20, r:20,  g:10,  b:180},   // Blau profund
        {v:-15, r:30,  g:40,  b:220},   // Blau intens
        {v:-10, r:40,  g:80,  b:240},   // Blau
        {v:-8,  r:45,  g:110, b:242},   // Blau clar
        {v:-5,  r:50,  g:150, b:240},   // Blau cel
        {v:-3,  r:55,  g:180, b:230},   // Blau-verd
        {v:0,   r:60,  g:210, b:200},   // Cian
        {v:2,   r:80,  g:230, b:150},   // Verd clar
        {v:5,   r:130, g:240, b:80},    // Verd
        {v:8,   r:190, g:240, b:40},    // Verd-groc
        {v:10,  r:230, g:235, b:30},    // Groc
        {v:12,  r:248, g:220, b:25},    // Groc intens
        {v:15,  r:252, g:190, b:20},    // Groc-taronja
        {v:18,  r:250, g:150, b:15},    // Taronja
        {v:20,  r:245, g:110, b:10},    // Taronja fosc
        {v:22,  r:238, g:70,  b:8},     // Vermell-taronja
        {v:25,  r:225, g:30,  b:5},     // Vermell
        {v:28,  r:200, g:10,  b:5},     // Vermell intens
        {v:30,  r:175, g:0,   b:5},     // Vermell fosc
        {v:35,  r:140, g:0,   b:0},     // Granat
        {v:40,  r:100, g:0,   b:0},     // Granat fosc
    ];

    // ── Paleta ROSADA ────────────────────────────────────────────────
    const DP_PAL = [
        {v:-30, r:240, g:240, b:250},
        {v:-20, r:210, g:210, b:240},
        {v:-10, r:170, g:160, b:220},
        {v:-5,  r:130, g:110, b:200},
        {v:0,   r:90,  g:70,  b:180},
        {v:2,   r:60,  g:80,  b:190},
        {v:5,   r:40,  g:120, b:170},
        {v:8,   r:50,  g:160, b:130},
        {v:10,  r:60,  g:190, b:100},
        {v:12,  r:100, g:200, b:80},
        {v:15,  r:160, g:210, b:60},
        {v:18,  r:220, g:180, b:40},
        {v:20,  r:240, g:100, b:30},
        {v:22,  r:230, g:50,  b:20},
        {v:25,  r:200, g:15,  b:15},
        {v:28,  r:160, g:0,   b:0},
        {v:30,  r:120, g:0,   b:0},
    ];

    // ── Paleta VENT ──────────────────────────────────────────────────
    const WIND_PAL = [
        {v:0,   r:220, g:238, b:255},
        {v:5,   r:190, g:225, b:255},
        {v:10,  r:155, g:210, b:255},
        {v:15,  r:115, g:190, b:252},
        {v:20,  r:75,  g:170, b:248},
        {v:25,  r:40,  g:145, b:235},
        {v:30,  r:60,  g:185, b:100},
        {v:35,  r:130, g:210, b:45},
        {v:40,  r:210, g:225, b:30},
        {v:45,  r:235, g:210, b:20},
        {v:50,  r:245, g:185, b:15},
        {v:55,  r:248, g:155, b:10},
        {v:60,  r:245, g:120, b:8},
        {v:65,  r:238, g:85,  b:6},
        {v:70,  r:228, g:50,  b:5},
        {v:80,  r:215, g:20,  b:5},
        {v:90,  r:195, g:5,   b:5},
        {v:100, r:170, g:0,   b:0},
        {v:120, r:140, g:0,   b:0},
        {v:140, r:110, g:0,   b:0},
    ];

    const HR_PAL = [
        {v:0,r:245,g:235,b:210},{v:15,r:230,g:215,b:185},{v:30,r:210,g:200,b:170},
        {v:45,r:185,g:205,b:155},{v:60,r:150,g:200,b:140},{v:75,r:80,g:185,b:135},
        {v:85,r:30,g:160,b:170},{v:92,r:10,g:120,b:200},{v:97,r:0,g:60,b:200},{v:100,r:0,g:20,b:160},
    ];
    const DBZ_PAL = [
        {v:0,r:0,g:0,b:0,a:0},{v:5,r:0,g:236,b:236,a:80},{v:10,r:1,g:160,b:246,a:140},
        {v:15,r:0,g:0,b:246,a:170},{v:20,r:0,g:236,b:0,a:190},{v:25,r:0,g:180,b:0,a:200},
        {v:30,r:0,g:100,b:0,a:210},{v:35,r:255,g:144,b:0,a:220},{v:40,r:255,g:0,b:0,a:230},
        {v:45,r:192,g:0,b:0,a:235},{v:50,r:120,g:0,b:0,a:240},{v:55,r:255,g:0,b:255,a:245},
        {v:60,r:160,g:32,b:240,a:250},{v:65,r:80,g:0,b:130,a:255},
    ];

    function palRGB(pal, v) {
        if (v == null || isNaN(v)) return [0,0,0,0];
        const P=pal;
        if (v<=P[0].v) return [P[0].r,P[0].g,P[0].b,P[0].a??255];
        const last=P[P.length-1];
        if (v>=last.v) return [last.r,last.g,last.b,last.a??255];
        for (let i=0;i<P.length-1;i++) {
            if (v>=P[i].v&&v<=P[i+1].v) {
                const f=(v-P[i].v)/(P[i+1].v-P[i].v);
                const a0=P[i].a??255, a1=P[i+1].a??255;
                return [
                    Math.round(P[i].r+f*(P[i+1].r-P[i].r)),
                    Math.round(P[i].g+f*(P[i+1].g-P[i].g)),
                    Math.round(P[i].b+f*(P[i+1].b-P[i].b)),
                    Math.round(a0+f*(a1-a0)),
                ];
            }
        }
        return [180,180,180,255];
    }

    function hpaAMetres(hpa) {
        if (!hpa||hpa<=0) return 0;
        return Math.max(0, 44330*(1-Math.pow(hpa/1013.25,0.1903)));
    }
    function calcLCL(t, td) {
        if (t==null||td==null||isNaN(t)||isNaN(td)) return null;
        return Math.max(0, 125*(t-td));
    }

    function iBloc(bloc, key, lat, lng) {
        try {
            const m=window._indexData?.meta;
            if (!bloc?.surface||!m) return null;
            const arr=bloc.surface[key];
            if (!arr?.length) return null;
            const N=m.n_grid, ext=m.extent;
            const col=((lng-ext[0])/(ext[1]-ext[0]))*(N-1);
            const row=((ext[3]-lat)/(ext[3]-ext[2]))*(N-1);
            const x0=Math.floor(col), y0=Math.floor(row);
            if (x0<0||x0>=N-1||y0<0||y0>=N-1) return null;
            const x1=x0+1,y1=y0+1,tx=col-x0,ty=row-y0;
            const v00=arr[y0*N+x0],v10=arr[y0*N+x1],v01=arr[y1*N+x0],v11=arr[y1*N+x1];
            if ([v00,v10,v01,v11].some(v=>v==null||isNaN(v))) return null;
            return (1-ty)*((1-tx)*v00+tx*v10)+ty*((1-tx)*v01+tx*v11);
        } catch(e){return null;}
    }

    function perfil(bloc, lat, lng) {
        const p={};
        for (const h of ALT_T) {
            p[`t${h}`]  = iBloc(bloc,`t_${h}m`,lat,lng);
            p[`ws${h}`] = iBloc(bloc,`wind_speed_${h}m`,lat,lng);
            p[`wd${h}`] = iBloc(bloc,`wind_direction_${h}m`,lat,lng);
        }
        for (const h of ALT_DP) p[`dp${h}`] = iBloc(bloc,`dp_${h}m`,lat,lng);
        for (const h of ALT_HR) p[`rh${h}`] = iBloc(bloc,`rh_${h}m`,lat,lng);
        for (const h of ALT_VENT) {
            if (p[`ws${h}`]==null) p[`ws${h}`] = iBloc(bloc,`wind_speed_${h}m`,lat,lng);
            if (p[`wd${h}`]==null) p[`wd${h}`] = iBloc(bloc,`wind_direction_${h}m`,lat,lng);
        }
        const pr = iBloc(bloc,'pr_10m',lat,lng);
        p.relieuM = pr ? hpaAMetres(pr) : 0;
        p.alt0c   = iBloc(bloc,'tpw_0c',lat,lng);
        p.alt1c   = iBloc(bloc,'tpw_1c',lat,lng);
        p.alt1_5c = iBloc(bloc,'tpw_1_5c',lat,lng);
        p.dbz     = iBloc(bloc,'reflectivity',lat,lng);
        p.precip  = iBloc(bloc,'total_precip_rate',lat,lng);
        return p;
    }

    function iVert(alts, prefix, p, h) {
        if (h<=alts[0]) return p[prefix+alts[0]];
        if (h>=alts[alts.length-1]) return p[prefix+alts[alts.length-1]];
        for (let i=0;i<alts.length-1;i++) {
            if (h>=alts[i]&&h<=alts[i+1]) {
                const v1=p[prefix+alts[i]], v2=p[prefix+alts[i+1]];
                if (v1==null||v2==null) return v1??v2;
                return v1+(v2-v1)*((h-alts[i])/(alts[i+1]-alts[i]));
            }
        }
        return null;
    }
    const iT  = (p,h)=>iVert(ALT_T,'t',p,h);
    const iDP = (p,h)=>iVert(ALT_DP,'dp',p,h);
    const iHR = (p,h)=>iVert(ALT_HR,'rh',p,h);
    const iWS = (p,h)=>iVert(ALT_VENT,'ws',p,h);
    const iWD = (p,h)=>iVert(ALT_VENT,'wd',p,h);

    function dbzAAlcada(p, h) {
        const dbz = p.dbz;
        if (!dbz||dbz<2) return 0;
        const cbTop = 8000;
        const base  = p.relieuM||0;
        const lcl   = calcLCL(p.t10,p.dp10)||500;
        const baseN = Math.max(base, lcl);
        if (h < baseN || h > cbTop) return 0;
        const frac = (h-baseN)/(cbTop-baseN);
        let factor;
        if (frac<=0.3) factor = frac/0.3;
        else factor = 1-(frac-0.3)/0.7;
        factor = Math.max(0,factor);
        const atenuacio = Math.exp(-h/8000);
        return dbz * factor * (0.5+0.5*atenuacio);
    }

    function nuvol(p, h) {
        const lcl=calcLCL(p.t10,p.dp10);
        if (lcl!==null&&h<lcl) return 0;
        const hr=iHR(p,h);
        if (!hr||hr<60) return 0;
        return Math.min(1, Math.pow((hr-60)/35, 1.5));
    }

    function barbeta(ctx,x,y,ws,wd,sz) {
        if (!ws||ws<1) return;
        ctx.save();
        ctx.strokeStyle='rgba(20,20,60,0.7)';
        ctx.lineWidth=1; ctx.lineCap='round';
        const ang=((wd||0)+90)*Math.PI/180;
        ctx.translate(x,y); ctx.rotate(ang);
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-sz); ctx.stroke();
        let rem=ws*0.539957, pos=-sz;
        const bs=sz*0.5;
        while(rem>=5&&pos<0) {
            const len=rem>=10?bs:bs*0.55;
            ctx.beginPath(); ctx.moveTo(0,pos); ctx.lineTo(bs*0.6,pos+len*0.5); ctx.stroke();
            rem-=rem>=10?10:5; pos+=sz*0.2;
        }
        ctx.restore();
    }

    function graella(ctx,ML,PW,TOP,BOT,hVals,hMax,fmtFn,color='#ddd',colorZero='#aaa') {
        for (const h of hVals) {
            if (h > hMax) continue;
            const y=BOT-(h/hMax)*(BOT-TOP);
            ctx.strokeStyle=h===0?colorZero:color;
            ctx.lineWidth=h===0?1:0.5;
            ctx.setLineDash(h===0?[]:[2,4]);
            ctx.beginPath(); ctx.moveTo(ML,y); ctx.lineTo(ML+PW,y); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle='#555'; ctx.font='9px Arial'; ctx.textAlign='right';
            ctx.fillText(fmtFn(h), ML-3, y+3);
        }
    }

    function borde(ctx,ML,PW,TOP,H) {
        ctx.strokeStyle='#999'; ctx.lineWidth=1;
        ctx.strokeRect(ML,TOP,PW,H);
    }

    function dibuixarRelleu(ctx,ML,PW,TOP,BOT,hMax,cols,xOf,yOf,mode) {
        const nX=cols.length;
        ctx.save();
        ctx.beginPath(); ctx.rect(ML,TOP,PW,BOT-TOP); ctx.clip();
        ctx.beginPath();
        for (let i=0;i<nX;i++) {
            const rM=Math.min(cols[i].relieuM||0,hMax*0.98);
            const y=yOf(rM);
            if(i===0) ctx.moveTo(xOf(i),y); else ctx.lineTo(xOf(i),y);
        }
        ctx.lineTo(xOf(nX-1),BOT); ctx.lineTo(ML,BOT); ctx.closePath();
        const gR=ctx.createLinearGradient(0,TOP,0,BOT);
        if (mode==='dark') {
            gR.addColorStop(0,'rgba(80,60,30,0.9)'); gR.addColorStop(1,'rgba(60,40,20,0.95)');
        } else {
            gR.addColorStop(0,'rgba(130,100,70,0.88)'); gR.addColorStop(1,'rgba(170,140,110,0.95)');
        }
        ctx.fillStyle=gR; ctx.fill();
        ctx.strokeStyle=mode==='dark'?'rgba(100,70,30,0.8)':'rgba(80,55,25,0.7)';
        ctx.lineWidth=1; ctx.stroke();
        ctx.restore();
    }

    function etiquetesX(ctx,cols,nX,ML,PW,BOT,tickStep) {
        const xOf=i=>ML+(i/(nX-1))*PW;
        for (let i=0;i<nX;i+=tickStep) {
            ctx.fillStyle='#444'; ctx.font='9px Arial'; ctx.textAlign='center';
            ctx.fillText(cols[i]._label||'', xOf(i), BOT+14);
        }
    }

    function llegendaBox(ctx, x, y, w, h, items) {
        ctx.fillStyle='rgba(255,255,255,0.94)'; ctx.strokeStyle='#999'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle='#333'; ctx.font='bold 9px Arial'; ctx.textAlign='left';
        ctx.fillText('LLEGENDA', x+6, y+14);
        ctx.font='8px Arial';
        items.forEach((item, i) => {
            const iy = y + 28 + i*16;
            if (item.color) {
                ctx.fillStyle = item.color;
                ctx.beginPath(); ctx.roundRect(x+6, iy-2, 14, 10, 2); ctx.fill();
                ctx.strokeStyle = '#aaa'; ctx.stroke();
            }
            if (item.lineColor) {
                ctx.strokeStyle = item.lineColor;
                ctx.lineWidth = item.lineWidth || 1.5;
                ctx.setLineDash(item.dash || []);
                ctx.beginPath(); ctx.moveTo(x+6, iy+3); ctx.lineTo(x+20, iy+3); ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.fillStyle = '#333'; ctx.fillText(item.label, x+24, iy+6);
        });
    }

    // ══════════════════════════════════════════════════════════════════
    //  DIBUIXOS PANELLS (sense tooltip, barbes fora del terreny)
    // ══════════════════════════════════════════════════════════════════

    function dibuixarPanellT(canvas, cols, nX, opcions) {
        const ctx=canvas.getContext('2d');
        const W=canvas.width, H=canvas.height;
        const ML=52, MR=20, PW=W-ML-MR;
        const hMax = opcions.hMax || 500;
        const hVals = _generarGraella(hMax);
        const TOP=28, BOT=H-20, PH=BOT-TOP;
        const relleuActiu = opcions?.relleu||false;
        const xOf=i=>ML+(i/(nX-1))*PW;
        const yOf=(h)=>BOT-(Math.min(h,hMax)/hMax)*PH;

        ctx.fillStyle='#f8f9ff'; ctx.fillRect(ML,TOP,PW,PH);
        const imgT=ctx.createImageData(PW,PH); const dT=imgT.data;
        for (let px=0;px<PW;px++) {
            const fi=(px/(PW-1))*(nX-1), i0=Math.min(nX-2,Math.floor(fi)), tf=fi-i0;
            const cL=cols[i0], cR=cols[i0+1];
            const relL=cL.relieuM||0, relR=cR.relieuM||0;
            for (let py=0;py<PH;py++) {
                const h=hMax*(1-py/(PH-1));
                const relI=relL+tf*(relR-relL);
                if (relleuActiu&&h<relI) { dT[(py*PW+px)*4+3]=0; continue; }
                const tL=iT(cL,h), tR=iT(cR,h);
                if (tL==null||tR==null) { dT[(py*PW+px)*4+3]=0; continue; }
                const [r,g,b]=palRGB(T_PAL,tL+tf*(tR-tL));
                const ii=(py*PW+px)*4;
                dT[ii]=r;dT[ii+1]=g;dT[ii+2]=b;dT[ii+3]=220;
            }
        }
        ctx.putImageData(imgT,ML,TOP);
        if (relleuActiu) dibuixarRelleu(ctx,ML,PW,TOP,BOT,hMax,cols,xOf,yOf);
        
        ctx.save(); ctx.beginPath(); ctx.rect(ML,TOP,PW,PH); ctx.clip();
        // Isotermes
        [-10,-5,0,5,10,15,20,25,30].forEach(tIso=>{
            ctx.beginPath(); ctx.strokeStyle=tIso===0?'#0055cc':'rgba(0,0,0,0.2)'; ctx.lineWidth=tIso===0?2:0.7;
            ctx.setLineDash(tIso===0?[]:[4,6]);
            let pr=true;
            for (let i=0;i<nX;i++) {
                let y=null;
                for (let ai=0;ai<ALT_T.length-1;ai++) {
                    const h1=ALT_T[ai],h2=ALT_T[ai+1];
                    const t1=cols[i][`t${h1}`],t2=cols[i][`t${h2}`];
                    if (t1==null||t2==null) continue;
                    if ((t1>=tIso&&t2<=tIso)||(t1<=tIso&&t2>=tIso)) {
                        y=yOf(h1+((tIso-t1)/(t2-t1))*(h2-h1)); break;
                    }
                }
                if(y==null||y<TOP||y>BOT){pr=true;continue;}
                if(pr){ctx.moveTo(xOf(i),y);pr=false;}else ctx.lineTo(xOf(i),y);
            }
            ctx.stroke(); ctx.setLineDash([]);
        });
        
        // Barbes NOMÉS si estan per sobre del terreny
        const bStep=Math.max(1,Math.floor(nX/16));
        for (let i=0;i<nX;i+=bStep) {
            for (const h of ALT_T) {
                if (h > hMax) continue;
                const relleu = cols[i].relieuM||0;
                if (relleuActiu && h < relleu) continue; // NO barba dins del terreny
                barbeta(ctx,xOf(i),yOf(h),cols[i][`ws${h}`],cols[i][`wd${h}`],12);
            }
        }
        ctx.restore();
        
        etiquetesX(ctx,cols,nX,ML,PW,BOT,Math.max(1,Math.floor(nX/18)));
        graella(ctx,ML,PW,TOP,BOT,hVals,hMax,h=>h+'m');
        borde(ctx,ML,PW,TOP,PH);
        ctx.fillStyle='#222'; ctx.font='bold 11px Arial'; ctx.textAlign='left';
        ctx.fillText('Temperatura + Vent [0-'+hMax+' m]', ML, TOP-6);
        llegendaBox(ctx, ML+PW-135, TOP+4, 130, 80, [
            {color:'#0055cc', label:'Isoterma 0 C'},
            {lineColor:'rgba(0,0,0,0.2)', lineWidth:0.7, dash:[4,6], label:'Altres isotermes'},
            {color:null, label:'Barbes = vent (nusos)'},
            {color:null, label:'Fons = gradient T (C)'},
        ]);
    }

    function dibuixarPanellDP(canvas, cols, nX, opcions) {
        const ctx=canvas.getContext('2d');
        const W=canvas.width, H=canvas.height;
        const ML=52, MR=20, PW=W-ML-MR;
        const hMax = opcions.hMax || 500;
        const hVals = _generarGraella(hMax);
        const TOP=28, BOT=H-20, PH=BOT-TOP;
        const relleuActiu = opcions?.relleu||false;
        const xOf=i=>ML+(i/(nX-1))*PW;
        const yOf=(h)=>BOT-(Math.min(h,hMax)/hMax)*PH;

        ctx.fillStyle='#f5fdf5'; ctx.fillRect(ML,TOP,PW,PH);
        const imgDP=ctx.createImageData(PW,PH); const dDP=imgDP.data;
        for (let px=0;px<PW;px++) {
            const fi=(px/(PW-1))*(nX-1), i0=Math.min(nX-2,Math.floor(fi)), tf=fi-i0;
            const cL=cols[i0], cR=cols[i0+1];
            for (let py=0;py<PH;py++) {
                const h=hMax*(1-py/(PH-1));
                const dpL=iDP(cL,h), dpR=iDP(cR,h);
                if (dpL==null||dpR==null) { dDP[(py*PW+px)*4+3]=0; continue; }
                const [r,g,b]=palRGB(DP_PAL,dpL+tf*(dpR-dpL));
                const ii=(py*PW+px)*4;
                dDP[ii]=r;dDP[ii+1]=g;dDP[ii+2]=b;dDP[ii+3]=220;
            }
        }
        ctx.putImageData(imgDP,ML,TOP);
        
        ctx.save(); ctx.beginPath(); ctx.rect(ML,TOP,PW,PH); ctx.clip();
        [0, 5, 10, 15, 20].forEach(dpIso=>{
            ctx.beginPath(); 
            ctx.strokeStyle=dpIso===0?'rgba(100,100,255,0.6)':
                            dpIso===20?'rgba(255,50,50,0.7)':'rgba(0,0,0,0.25)';
            ctx.lineWidth=dpIso===0||dpIso===20?1.5:0.7;
            ctx.setLineDash(dpIso===0?[2,4]:dpIso===20?[2,3]:[5,5]);
            let pr=true;
            for (let i=0;i<nX;i++) {
                let y=null;
                for (let ai=0;ai<ALT_DP.length-1;ai++) {
                    const h1=ALT_DP[ai],h2=ALT_DP[ai+1];
                    const dp1=cols[i][`dp${h1}`],dp2=cols[i][`dp${h2}`];
                    if (dp1==null||dp2==null) continue;
                    if ((dp1>=dpIso&&dp2<=dpIso)||(dp1<=dpIso&&dp2>=dpIso)) {
                        y=yOf(h1+((dpIso-dp1)/(dp2-dp1))*(h2-h1)); break;
                    }
                }
                if(y==null||y<TOP||y>BOT){pr=true;continue;}
                if(pr){ctx.moveTo(xOf(i),y);pr=false;}else ctx.lineTo(xOf(i),y);
            }
            ctx.stroke(); ctx.setLineDash([]);
        });
        ctx.restore();
        
        if (relleuActiu) dibuixarRelleu(ctx,ML,PW,TOP,BOT,hMax,cols,xOf,yOf);
        etiquetesX(ctx,cols,nX,ML,PW,BOT,Math.max(1,Math.floor(nX/18)));
        graella(ctx,ML,PW,TOP,BOT,hVals,hMax,h=>h+'m');
        borde(ctx,ML,PW,TOP,PH);
        ctx.fillStyle='#1a6e2e'; ctx.font='bold 11px Arial'; ctx.textAlign='left';
        ctx.fillText('Punt de rosada [0-'+hMax+' m]', ML, TOP-6);
        llegendaBox(ctx, ML+PW-140, TOP+4, 135, 80, [
            {color:'#d0c8f0', label:'Blanc/Lila = molt fred'},
            {color:'#3cb464', label:'Verd = transicio'},
            {color:'#e63214', label:'Vermell = rosada alta'},
            {lineColor:'rgba(255,50,50,0.7)', lineWidth:1.5, dash:[2,3], label:'Isoterma 20 C'},
        ]);
    }

    function dibuixarPanellHR(canvas, cols, nX, opcions) {
        const ctx=canvas.getContext('2d');
        const W=canvas.width, H=canvas.height;
        const ML=52, MR=20, PW=W-ML-MR;
        const hMax = opcions.hMax || 3000;
        const hVals = _generarGraella(hMax);
        const TOP=28, BOT=H-20, PH=BOT-TOP;
        const relleuActiu = opcions?.relleu||false;
        const xOf=i=>ML+(i/(nX-1))*PW;
        const yOf=(h)=>BOT-(Math.min(h,hMax)/hMax)*PH;

        const gFons=ctx.createLinearGradient(0,TOP,0,BOT);
        gFons.addColorStop(0,'#e8f0f8'); gFons.addColorStop(0.5,'#f0f4f8'); gFons.addColorStop(1,'#f5f7fa');
        ctx.fillStyle=gFons; ctx.fillRect(ML,TOP,PW,PH);
        const imgHR=ctx.createImageData(PW,PH); const dHR=imgHR.data;
        for (let px=0;px<PW;px++) {
            const fi=(px/(PW-1))*(nX-1), i0=Math.min(nX-2,Math.floor(fi)), tf=fi-i0;
            const cL=cols[i0], cR=cols[i0+1];
            for (let py=0;py<PH;py++) {
                const h=hMax*(1-py/(PH-1));
                const hrL=iHR(cL,h), hrR=iHR(cR,h);
                if (hrL==null&&hrR==null) continue;
                const hr=(hrL??hrR)+tf*((hrR??hrL)-(hrL??hrR));
                const [r,g,b,a]=palRGB(HR_PAL,hr);
                const ii=(py*PW+px)*4;
                dHR[ii]=r; dHR[ii+1]=g; dHR[ii+2]=b; dHR[ii+3]=Math.round(a*0.75);
                const nL=nuvol(cL,h), nR=nuvol(cR,h);
                const n=nL+tf*(nR-nL);
                if (n>0.03) {
                    const alphaN = Math.round(180 * n);
                    const grey = Math.round(230 * (1-n*0.5));
                    dHR[ii]=Math.round(dHR[ii]*(1-n*0.4) + grey*n*0.4);
                    dHR[ii+1]=Math.round(dHR[ii+1]*(1-n*0.4) + grey*n*0.4);
                    dHR[ii+2]=Math.round(dHR[ii+2]*(1-n*0.4) + Math.min(255,grey+15)*n*0.4);
                    dHR[ii+3]=Math.max(dHR[ii+3], alphaN);
                }
            }
        }
        ctx.putImageData(imgHR,ML,TOP);
        ctx.save();
        ctx.beginPath(); ctx.strokeStyle='rgba(0,100,200,0.55)'; ctx.lineWidth=1.5;
        ctx.setLineDash([6,5]);
        let primerLCL=true;
        for (let i=0;i<nX;i++) {
            const lcl=calcLCL(cols[i].t10,cols[i].dp10);
            if (lcl==null||lcl>hMax){primerLCL=true;continue;}
            const y=yOf(lcl);
            if(primerLCL){ctx.moveTo(xOf(i),y);primerLCL=false;}else ctx.lineTo(xOf(i),y);
        }
        ctx.stroke(); ctx.setLineDash([]);
        const lclMid=calcLCL(cols[Math.floor(nX/2)].t10,cols[Math.floor(nX/2)].dp10);
        if (lclMid!=null&&lclMid<hMax) {
            ctx.fillStyle='rgba(0,100,200,0.75)'; ctx.font='8px Arial'; ctx.textAlign='left';
            ctx.fillText('LCL ~'+Math.round(lclMid)+'m', ML+4, yOf(lclMid)-4);
        }
        ctx.restore();
        if (relleuActiu) dibuixarRelleu(ctx,ML,PW,TOP,BOT,hMax,cols,xOf,yOf);
        etiquetesX(ctx,cols,nX,ML,PW,BOT,Math.max(1,Math.floor(nX/18)));
        graella(ctx,ML,PW,TOP,BOT,hVals,hMax,h=>h>=1000?(h/1000)+'km':h+'m');
        borde(ctx,ML,PW,TOP,PH);
        ctx.fillStyle='#003366'; ctx.font='bold 11px Arial'; ctx.textAlign='left';
        ctx.fillText('Humitat relativa + Nuvols [0-'+_fmtAltura(hMax)+']', ML, TOP-6);
        llegendaBox(ctx, ML+PW-155, TOP+4, 150, 130, [
            {color:'#faf0dc', label:'Beix = HR < 30% (sec)'},
            {color:'#b4c8a0', label:'Verd = HR 50-85%'},
            {color:'#0a50c8', label:'Blau = HR > 95% (saturat)'},
            {color:'rgba(200,200,210,0.8)', label:'Gris = nuvols'},
            {lineColor:'rgba(0,100,200,0.55)', lineWidth:1.5, dash:[6,5], label:'LCL (base nuvols)'},
        ]);
    }

    function dibuixarPanellDBZ(canvas, cols, nX, opcions) {
        const ctx=canvas.getContext('2d');
        const W=canvas.width, H=canvas.height;
        const ML=52, MR=20, PW=W-ML-MR;
        const hMax = opcions.hMax || 8000;
        const hVals = _generarGraella(hMax);
        const TOP=28, BOT=H-20, PH=BOT-TOP;
        const relleuActiu = opcions?.relleu||false;
        const xOf=i=>ML+(i/(nX-1))*PW;
        const yOf=(h)=>BOT-(Math.min(h,hMax)/hMax)*PH;

        ctx.fillStyle='#000811'; ctx.fillRect(ML,TOP,PW,PH);
        const imgDBZ=ctx.createImageData(PW,PH); const dDBZ=imgDBZ.data;
        for (let px=0;px<PW;px++) {
            const fi=(px/(PW-1))*(nX-1), i0=Math.min(nX-2,Math.floor(fi)), tf=fi-i0;
            const cL=cols[i0], cR=cols[i0+1];
            for (let py=0;py<PH;py++) {
                const h=hMax*(1-py/(PH-1));
                if (relleuActiu&&h<((cL.relieuM||0)+tf*((cR.relieuM||0)-(cL.relieuM||0)))) continue;
                const dbzL=dbzAAlcada(cL,h), dbzR=dbzAAlcada(cR,h);
                const dbz=dbzL+tf*(dbzR-dbzL);
                if (dbz<2) continue;
                const [r,g,b,a]=palRGB(DBZ_PAL,dbz);
                const ii=(py*PW+px)*4;
                dDBZ[ii]=r;dDBZ[ii+1]=g;dDBZ[ii+2]=b;dDBZ[ii+3]=a;
            }
        }
        ctx.putImageData(imgDBZ,ML,TOP);
        if (relleuActiu) dibuixarRelleu(ctx,ML,PW,TOP,BOT,hMax,cols,xOf,yOf,'dark');
        for (const h of hVals) {
            const y=yOf(h);
            ctx.strokeStyle=h===0?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.1)';
            ctx.lineWidth=0.5; ctx.setLineDash(h===0?[]:[2,4]);
            ctx.beginPath(); ctx.moveTo(ML,y); ctx.lineTo(ML+PW,y); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.font='9px Arial'; ctx.textAlign='right';
            ctx.fillText(h>=1000?(h/1000)+'km':h+'m', ML-3, y+3);
        }
        const legW=140, legX=ML+PW-legW-4, legY=TOP+4;
        const imgLeg=ctx.createImageData(legW,8);
        for (let lx=0;lx<legW;lx++) {
            const dbz=lx/(legW-1)*65;
            const [r,g,b,a]=palRGB(DBZ_PAL,dbz);
            for (let ly=0;ly<8;ly++){const ii=(ly*legW+lx)*4;imgLeg.data[ii]=r;imgLeg.data[ii+1]=g;imgLeg.data[ii+2]=b;imgLeg.data[ii+3]=a;}
        }
        ctx.putImageData(imgLeg,legX,legY);
        ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=0.5;
        ctx.strokeRect(legX,legY,legW,8);
        ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='7px Arial'; ctx.textAlign='center';
        for (const v of [0,20,40,60]) ctx.fillText(v+'dBZ', legX+(v/65)*legW, legY-1);
        etiquetesX(ctx,cols,nX,ML,PW,BOT,Math.max(1,Math.floor(nX/18)));
        borde(ctx,ML,PW,TOP,PH);
        ctx.fillStyle='#00cc66'; ctx.font='bold 11px Arial'; ctx.textAlign='left';
        ctx.fillText('Radar simulat DBZ [0-'+_fmtAltura(hMax)+']', ML, TOP-6);
        llegendaBox(ctx, ML+4, TOP+4, 120, 70, [
            {color:'rgba(0,236,236,0.5)', label:'Pluja feble (5-15 dBZ)'},
            {color:'rgba(255,0,0,0.7)', label:'Pluja intensa (40+ dBZ)'},
            {color:'rgba(255,0,255,0.7)', label:'Calamarssa (55+ dBZ)'},
        ]);
    }

    function dibuixarPanellISO(canvas, cols, nX, opcions) {
        const ctx=canvas.getContext('2d');
        const W=canvas.width, H=canvas.height;
        const ML=52, MR=20, PW=W-ML-MR;
        const hMax = opcions.hMax || 8000;
        const hVals = _generarGraella(hMax);
        const TOP=28, BOT=H-20, PH=BOT-TOP;
        const relleuActiu = opcions?.relleu||false;
        const xOf=i=>ML+(i/(nX-1))*PW;
        const yOf=(h)=>BOT-(Math.min(h,hMax)/hMax)*PH;

        ctx.fillStyle='#fafafa'; ctx.fillRect(ML,TOP,PW,PH);
        if (relleuActiu) dibuixarRelleu(ctx,ML,PW,TOP,BOT,hMax,cols,xOf,yOf);
        ctx.save(); ctx.beginPath();
        let pIso=true;
        for (let i=0;i<nX;i++) {
            const y0=cols[i].alt0c?yOf(Math.min(cols[i].alt0c,hMax)):null;
            if(y0==null||y0<TOP||y0>BOT){pIso=true;continue;}
            if(pIso){ctx.moveTo(xOf(i),y0);pIso=false;}else ctx.lineTo(xOf(i),y0);
        }
        for (let i=nX-1;i>=0;i--) {
            const y=cols[i].alt1_5c?yOf(Math.min(cols[i].alt1_5c,hMax)):null;
            if(y!=null&&y>=TOP&&y<=BOT) ctx.lineTo(xOf(i),y);
        }
        ctx.closePath(); ctx.fillStyle='rgba(100,180,255,0.18)'; ctx.fill(); ctx.restore();
        const isoConf=[
            {key:'alt0c',  color:'#0055cc', lw:2.5, dash:[],    label:'Isoterma 0 C'},
            {key:'alt1c',  color:'#00aacc', lw:2,   dash:[5,4], label:'Isoterma 1 C'},
            {key:'alt1_5c',color:'#00ccaa', lw:1.5, dash:[3,5], label:'Isoterma 1.5 C'},
        ];
        isoConf.forEach(iso=>{
            ctx.save();
            ctx.beginPath(); ctx.strokeStyle=iso.color; ctx.lineWidth=iso.lw;
            ctx.setLineDash(iso.dash);
            let pr=true;
            for (let i=0;i<nX;i++) {
                const v=cols[i][iso.key];
                if (!v||v<0||v>hMax*1.05){pr=true;continue;}
                const y=yOf(Math.min(v,hMax));
                if(y<TOP||y>BOT){pr=true;continue;}
                if(pr){ctx.moveTo(xOf(i),y);pr=false;}else ctx.lineTo(xOf(i),y);
            }
            ctx.stroke(); ctx.setLineDash([]); ctx.restore();
        });
        etiquetesX(ctx,cols,nX,ML,PW,BOT,Math.max(1,Math.floor(nX/18)));
        graella(ctx,ML,PW,TOP,BOT,hVals,hMax,h=>h>=1000?(h/1000)+'km':h+'m');
        borde(ctx,ML,PW,TOP,PH);
        ctx.fillStyle='#003388'; ctx.font='bold 11px Arial'; ctx.textAlign='left';
        ctx.fillText('Isotermes 0 C / 1 C / 1.5 C [0-'+_fmtAltura(hMax)+']', ML, TOP-6);
        llegendaBox(ctx, ML+PW-145, TOP+4, 140, 95, [
            {lineColor:'#0055cc', lineWidth:2.5, dash:[], label:'Isoterma 0 C'},
            {lineColor:'#00aacc', lineWidth:2, dash:[5,4], label:'Isoterma 1 C'},
            {lineColor:'#00ccaa', lineWidth:1.5, dash:[3,5], label:'Isoterma 1.5 C'},
            {color:'rgba(100,180,255,0.25)', label:'Zona 0 - 1.5 C'},
            {color:null, label:'(pluja/neu/gel)'},
        ]);
    }

    function dibuixarPanellVENT(canvas, cols, nX, opcions) {
        const ctx=canvas.getContext('2d');
        const W=canvas.width, H=canvas.height;
        const ML=52, MR=20, PW=W-ML-MR;
        const hMax = opcions.hMax || 500;
        const hVals = _generarGraella(hMax);
        const TOP=28, BOT=H-20, PH=BOT-TOP;
        const relleuActiu = opcions?.relleu||false;
        const xOf=i=>ML+(i/(nX-1))*PW;
        const yOf=(h)=>BOT-(Math.min(h,hMax)/hMax)*PH;

        ctx.fillStyle='#f5f8ff'; ctx.fillRect(ML,TOP,PW,PH);
        const imgW=ctx.createImageData(PW,PH); const dW=imgW.data;
        for (let px=0;px<PW;px++) {
            const fi=(px/(PW-1))*(nX-1), i0=Math.min(nX-2,Math.floor(fi)), tf=fi-i0;
            const cL=cols[i0], cR=cols[i0+1];
            const relL=cL.relieuM||0, relR=cR.relieuM||0;
            for (let py=0;py<PH;py++) {
                const h=hMax*(1-py/(PH-1));
                const relI=relL+tf*(relR-relL);
                if (relleuActiu&&h<relI) { dW[(py*PW+px)*4+3]=0; continue; }
                const wsL=iWS(cL,h), wsR=iWS(cR,h);
                if (wsL==null||wsR==null) { dW[(py*PW+px)*4+3]=0; continue; }
                const ws = wsL+tf*(wsR-wsL);
                const [r,g,b] = palRGB(WIND_PAL, ws);
                const ii=(py*PW+px)*4;
                dW[ii]=r; dW[ii+1]=g; dW[ii+2]=b; dW[ii+3]=200;
            }
        }
        ctx.putImageData(imgW,ML,TOP);
        
        ctx.save(); ctx.beginPath(); ctx.rect(ML,TOP,PW,PH); ctx.clip();
        const bStep=Math.max(1,Math.floor(nX/14));
        for (let i=0;i<nX;i+=bStep) {
            for (const h of ALT_VENT) {
                if (h > hMax) continue;
                const relleu = cols[i].relieuM||0;
                if (relleuActiu && h < relleu) continue; // NO barba dins del terreny
                barbeta(ctx, xOf(i), yOf(h), cols[i][`ws${h}`], cols[i][`wd${h}`], 11);
            }
        }
        ctx.restore();
        
        if (relleuActiu) dibuixarRelleu(ctx,ML,PW,TOP,BOT,hMax,cols,xOf,yOf);
        etiquetesX(ctx,cols,nX,ML,PW,BOT,Math.max(1,Math.floor(nX/18)));
        graella(ctx,ML,PW,TOP,BOT,hVals,hMax,h=>h+'m');
        borde(ctx,ML,PW,TOP,PH);
        
        const legW=160, legX=ML+PW-legW-4, legY=TOP+4;
        const imgLeg=ctx.createImageData(legW,8);
        for (let lx=0;lx<legW;lx++) {
            const ws=lx/(legW-1)*120;
            const [r,g,b]=palRGB(WIND_PAL,ws);
            for (let ly=0;ly<8;ly++){const ii=(ly*legW+lx)*4;imgLeg.data[ii]=r;imgLeg.data[ii+1]=g;imgLeg.data[ii+2]=b;imgLeg.data[ii+3]=255;}
        }
        ctx.putImageData(imgLeg,legX,legY);
        ctx.strokeStyle='#999'; ctx.lineWidth=0.5; ctx.strokeRect(legX,legY,legW,8);
        ctx.fillStyle='#444'; ctx.font='7px Arial'; ctx.textAlign='center';
        for (const v of [0,30,60,90,120]) ctx.fillText(v+' km/h', legX+(v/120)*legW, legY-1);
        
        ctx.fillStyle='#004499'; ctx.font='bold 11px Arial'; ctx.textAlign='left';
        ctx.fillText('Vent 10-500 m (km/h) + Barbes', ML, TOP-6);
    }

    function _generarGraella(hMax) {
        if (hMax <= 500) return [0,100,200,300,400,500].filter(h=>h<=hMax);
        if (hMax <= 1000) return [0,200,400,600,800,1000].filter(h=>h<=hMax);
        if (hMax <= 3000) return [0,500,1000,1500,2000,2500,3000].filter(h=>h<=hMax);
        if (hMax <= 5000) return [0,1000,2000,3000,4000,5000].filter(h=>h<=hMax);
        return [0,1000,2000,3000,4000,5000,6000,7000,8000].filter(h=>h<=hMax);
    }
    function _fmtAltura(h) {
        if (h >= 1000) return (h/1000).toFixed(1)+' km';
        return h+' m';
    }

    // ══════════════════════════════════════════════════════════════════
    //  ESTAT
    // ══════════════════════════════════════════════════════════════════
    let _mode='espai', _punt1=null, _punt2=null;
    let _mk1=null, _mk2=null, _linia=null;
    let _latlngT=null, _mkT=null;
    let _relleuActiu=false;
    let _panellActiu = 'TOTS';
    let _meteogramaObert = false;
    let _alturesCustom = { 'T': 500, 'DP': 500, 'HR': 3000, 'DBZ': 8000, 'ISO': 8000, 'VENT': 500 };

    const PANELL_INFO = [
        {id:'TOTS', label:'TOTS', desc:'Vista general: tots els panells junts', hOptions:null},
        {id:'T',    label:'T + Vent', desc:'Temperatura i vent', hOptions:[100,200,300,500]},
        {id:'DP',   label:'Rosada', desc:'Punt de rosada', hOptions:[100,200,300,500]},
        {id:'HR',   label:'HR + Nuvols', desc:'Humitat relativa i nuvols', hOptions:[500,1000,2000,3000]},
        {id:'DBZ',  label:'Radar', desc:'Reflectivitat radar simulada', hOptions:[1000,2000,4000,6000,8000]},
        {id:'ISO',  label:'Iso 0 C', desc:'Isotermes 0, 1 i 1.5 C', hOptions:[1000,2000,4000,6000,8000]},
        {id:'VENT', label:'Vent', desc:'Vent 10-500 m amb barbes (km/h)', hOptions:[100,200,300,500]},
    ];

    // ══════════════════════════════════════════════════════════════════
    //  UI
    // ══════════════════════════════════════════════════════════════════
    function crearUI() {
        const existing = document.getElementById('meteoWin5');
        if (existing) { _actualitzarUI(); return; }
        
        const win=document.createElement('div');
        win.id='meteoWin5';
        win.style.cssText=`
            display:none;position:fixed;top:50%;left:50%;
            transform:translate(-50%,-50%);z-index:99999;
            background:#c0c0c0;
            border-top:2px solid #fff;border-left:2px solid #fff;
            border-right:2px solid #444;border-bottom:2px solid #444;
            font-family:"MS Sans Serif",Arial,sans-serif;font-size:11px;
            box-shadow:4px 4px 16px rgba(0,0,0,0.5);
            min-width:900px;max-width:98vw;
        `;
        win.innerHTML = _generarHTML();
        document.body.appendChild(win);
        _vincularEvents();
    }

    function _generarHTML() {
        let tabsHTML = '';
        PANELL_INFO.forEach(p=>{
            tabsHTML += `<button class="m5tab" data-pid="${p.id}" style="
                background:#d4d0c8;color:#222;font-size:10px;font-weight:700;
                border-top:1px solid #fff;border-left:1px solid #fff;
                border-right:1px solid #555;border-bottom:1px solid #555;
                padding:2px 10px;cursor:pointer;
                ${p.id===_panellActiu?'background:#fff;border-bottom:1px solid #fff;margin-bottom:-1px;':''}
            ">${p.label}</button>`;
        });

        let alturaOptions = '';
        const panellActual = PANELL_INFO.find(p=>p.id===_panellActiu);
        if (panellActual && panellActual.hOptions) {
            const currentH = _alturesCustom[_panellActiu] || panellActual.hOptions[panellActual.hOptions.length-1];
            alturaOptions = panellActual.hOptions.map(h=>{
                const sel = h===currentH ? 'selected' : '';
                const label = h>=1000 ? (h/1000)+'km' : h+'m';
                return `<option value="${h}" ${sel}>${label}</option>`;
            }).join('');
        }

        const modeLabel = _mode==='temps'?'TEMPS':'ESPAI';
        const relleuLabel = 'Relleu '+(_relleuActiu?'ON':'OFF');
        const relleuColor = _relleuActiu?'#000080':'#555';
        const showAltura = panellActual && panellActual.hOptions ? 'flex' : 'none';
        const legendaText = panellActual ? panellActual.desc : 'Vista general: tots els panells junts';

        return `
            <div id="meteoBar5" style="
                background:linear-gradient(90deg,#000080,#1084d0);
                color:#fff;font-weight:700;font-size:11px;
                padding:3px 6px;display:flex;justify-content:space-between;align-items:center;
                cursor:move;border-bottom:1px solid #000;
            ">
                <span>Meteograma AROME-PI · <span id="meteoInfo5">--</span></span>
                <div style="display:flex;gap:3px;align-items:center;">
                    <button id="m5ModeBtn" class="m5-ctrl-btn">Mode: ${modeLabel}</button>
                    <button id="m5RelleuBtn" class="m5-ctrl-btn" style="color:${relleuColor};">${relleuLabel}</button>
                    <button id="m5NouTall" class="m5-ctrl-btn" style="color:#800;">Nou tall</button>
                    <button id="m5Close" class="m5-ctrl-btn" style="width:18px;height:18px;padding:0;">X</button>
                </div>
            </div>
            <div style="background:#c0c0c0;padding:3px 6px;border-bottom:1px solid #888;
                display:flex;gap:12px;align-items:center;font-size:10px;">
                <span>P1: <b id="m5P1">--</b></span>
                <span id="m5P2wrap" style="display:none;">> P2: <b id="m5P2">--</b>
                    &nbsp;Dist: <b id="m5Dist" style="color:#800;">--</b></span>
                <span id="m5Hint" style="margin-left:auto;color:#444;font-size:9px;">
                    Clic dret al mapa: selecciona punts
                </span>
            </div>
            <div style="background:#c0c0c0;padding:2px 6px;display:flex;gap:2px;align-items:center;border-bottom:1px solid #999;">
                <div id="m5TabsContainer" style="display:flex;gap:2px;">${tabsHTML}</div>
                <div id="m5AlturaWrap" style="margin-left:12px;display:${showAltura};align-items:center;gap:4px;">
                    <span style="font-size:9px;color:#333;">Altura max:</span>
                    <select id="m5AlturaSel" style="font-size:9px;padding:1px 3px;background:#fff;border:1px solid #888;">
                        ${alturaOptions}
                    </select>
                </div>
            </div>
            <div style="padding:5px;background:#c0c0c0;">
                <div style="border:2px inset #888;background:#fff;padding:0;">
                    <canvas id="m5Canvas" width="900" height="650" style="display:block;"></canvas>
                </div>
                <div style="padding:4px 6px;margin-top:4px;font-size:9px;color:#333;
                    background:#e0e0e0;border:1px inset #aaa;" id="m5Legenda">${legendaText}</div>
            </div>
        `;
    }

    function _vincularEvents() {
        const win = document.getElementById('meteoWin5');
        if (!win) return;

        win.querySelectorAll('.m5tab').forEach(btn=>{
            btn.addEventListener('click',()=>{
                _panellActiu = btn.dataset.pid;
                const info = PANELL_INFO.find(p=>p.id===_panellActiu);
                if (info && info.hOptions) {
                    _alturesCustom[_panellActiu] = info.hOptions[info.hOptions.length-1];
                }
                _actualitzarUI();
                if (_meteogramaObert && _punt1 && (_mode==='temps'||_punt2)) actualitzar();
            });
        });

        const alturaSel = document.getElementById('m5AlturaSel');
        if (alturaSel) {
            alturaSel.addEventListener('change', ()=>{
                _alturesCustom[_panellActiu] = parseInt(alturaSel.value);
                actualitzar();
            });
        }

        let ox,oy,arr=false;
        const barra = document.getElementById('meteoBar5');
        if (barra) {
            barra.onmousedown=e=>{
                if(e.target.tagName==='BUTTON'||e.target.tagName==='SELECT')return;
                arr=true; const r=win.getBoundingClientRect();
                ox=e.clientX-r.left; oy=e.clientY-r.top;
            };
        }
        document.addEventListener('mousemove',e=>{
            if(!arr)return;
            win.style.left=(e.clientX-ox)+'px'; win.style.top=(e.clientY-oy)+'px';
            win.style.transform='none';
        });
        document.addEventListener('mouseup',()=>arr=false);

        document.getElementById('m5Close').onclick = tancar;
        document.getElementById('m5NouTall').onclick = nouTall;
        document.getElementById('m5ModeBtn').onclick = canviarMode;
        document.getElementById('m5RelleuBtn').onclick = ()=>{
            _relleuActiu=!_relleuActiu;
            _actualitzarUI();
            actualitzar();
        };
        
        document.addEventListener('keydown', e=>{ if(e.key==='Escape') tancar(); });
    }

    function _actualitzarUI() {
        const win = document.getElementById('meteoWin5');
        if (!win) return;
        
        const tabsContainer = document.getElementById('m5TabsContainer');
        if (tabsContainer) {
            let tabsHTML = '';
            PANELL_INFO.forEach(p=>{
                tabsHTML += `<button class="m5tab" data-pid="${p.id}" style="
                    background:#d4d0c8;color:#222;font-size:10px;font-weight:700;
                    border-top:1px solid #fff;border-left:1px solid #fff;
                    border-right:1px solid #555;border-bottom:1px solid #555;
                    padding:2px 10px;cursor:pointer;
                    ${p.id===_panellActiu?'background:#fff;border-bottom:1px solid #fff;margin-bottom:-1px;':''}
                ">${p.label}</button>`;
            });
            tabsContainer.innerHTML = tabsHTML;
        }
        
        const alturaWrap = document.getElementById('m5AlturaWrap');
        const alturaSel = document.getElementById('m5AlturaSel');
        const panellActual = PANELL_INFO.find(p=>p.id===_panellActiu);
        
        if (alturaWrap && alturaSel && panellActual && panellActual.hOptions) {
            alturaWrap.style.display = 'flex';
            const currentH = _alturesCustom[_panellActiu] || panellActual.hOptions[panellActual.hOptions.length-1];
            alturaSel.innerHTML = panellActual.hOptions.map(h=>{
                const sel = h===currentH ? 'selected' : '';
                const label = h>=1000 ? (h/1000)+'km' : h+'m';
                return `<option value="${h}" ${sel}>${label}</option>`;
            }).join('');
        } else if (alturaWrap) {
            alturaWrap.style.display = 'none';
        }
        
        const btnMode = document.getElementById('m5ModeBtn');
        if (btnMode) btnMode.textContent = 'Mode: '+(_mode==='temps'?'TEMPS':'ESPAI');
        
        const btnRelleu = document.getElementById('m5RelleuBtn');
        if (btnRelleu) {
            btnRelleu.textContent = 'Relleu '+(_relleuActiu?'ON':'OFF');
            btnRelleu.style.color = _relleuActiu?'#000080':'#555';
        }
        
        const leg = document.getElementById('m5Legenda');
        if (leg && panellActual) leg.textContent = panellActual.desc;
        
        if (tabsContainer) {
            tabsContainer.querySelectorAll('.m5tab').forEach(btn=>{
                btn.addEventListener('click',()=>{
                    _panellActiu = btn.dataset.pid;
                    const info = PANELL_INFO.find(p=>p.id===_panellActiu);
                    if (info && info.hOptions) {
                        _alturesCustom[_panellActiu] = info.hOptions[info.hOptions.length-1];
                    }
                    _actualitzarUI();
                    if (_meteogramaObert && _punt1 && (_mode==='temps'||_punt2)) actualitzar();
                });
            });
        }
        
        const newAlturaSel = document.getElementById('m5AlturaSel');
        if (newAlturaSel) {
            newAlturaSel.addEventListener('change', ()=>{
                _alturesCustom[_panellActiu] = parseInt(newAlturaSel.value);
                actualitzar();
            });
        }
    }

    function hint(t) { const h=document.getElementById('m5Hint'); if(h) h.textContent=t; }
    function fmt(ll) { return ll.lat.toFixed(3)+' N '+ll.lng.toFixed(3)+' E'; }
    function mkIcon(color) {
        return L.divIcon({className:'',
            html:`<div style="width:10px;height:10px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 0 5px ${color};"></div>`,
            iconSize:[14,14],iconAnchor:[7,7]});
    }

    function eliminarMarcadors() {
        const mapa=window._mapInstance;
        if (!mapa) return;
        try {
            if (_mk1) { mapa.removeLayer(_mk1); _mk1=null; }
            if (_mk2) { mapa.removeLayer(_mk2); _mk2=null; }
            if (_linia) { mapa.removeLayer(_linia); _linia=null; }
            if (_mkT) { mapa.removeLayer(_mkT); _mkT=null; }
        } catch(e) {}
        _punt1=null; _punt2=null; _latlngT=null;
    }

    function resetUI() {
        ['m5P1','m5P2','m5Dist'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent='--';});
        const p2w=document.getElementById('m5P2wrap');if(p2w)p2w.style.display='none';
        const info=document.getElementById('meteoInfo5');if(info)info.textContent='--';
    }

    function netejarCanvas() {
        const canvas=document.getElementById('m5Canvas');
        if(!canvas) return;
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#000080';ctx.font='bold 13px Arial';ctx.textAlign='center';
        if (_mode==='temps') {
            ctx.fillText('Selecciona un punt amb clic dret al mapa',canvas.width/2,canvas.height/2-10);
            ctx.fillText('per veure l\'evolucio temporal',canvas.width/2,canvas.height/2+10);
        } else {
            ctx.fillText('Selecciona 2 punts amb clic dret al mapa',canvas.width/2,canvas.height/2-10);
            ctx.fillText('Punt 1: inici del tall  |  Punt 2: final del tall',canvas.width/2,canvas.height/2+10);
        }
    }

    function canviarMode() {
        _mode = _mode==='temps'?'espai':'temps';
        eliminarMarcadors();
        resetUI();
        netejarCanvas();
        _actualitzarUI();
        hint(_mode==='temps'?'Clic dret: selecciona punt temporal':'Clic dret: Punt 1 (inici del tall)');
    }

    function nouTall() {
        eliminarMarcadors();
        resetUI();
        netejarCanvas();
        hint(_mode==='temps'?'Clic dret: selecciona punt temporal':'Clic dret: Punt 1 (inici del tall)');
    }

    function tancar() {
        eliminarMarcadors();
        _meteogramaObert = false;
        const w = document.getElementById('meteoWin5');
        if (w) w.style.display = 'none';
    }

    function obrirFinestra() {
        const win = document.getElementById('meteoWin5');
        if (!win) return;
        win.style.display = 'block';
        _meteogramaObert = true;
        
        if (window._mapInstance && !window._meteoCtxHandler) {
            window._meteoCtxHandler = function(e) {
                e.originalEvent.preventDefault();
                onClic(e.latlng);
            };
            window._mapInstance.on('contextmenu', window._meteoCtxHandler);
        }
    }

    function onClic(latlng) {
        const mapa = window._mapInstance;
        if (!mapa) return;

        if (_mode === 'temps') {
            if (_mkT) { try { mapa.removeLayer(_mkT); } catch(e) {} }
            _mkT = L.marker(latlng, {icon: mkIcon('#0055ff'), zIndexOffset: 2000}).addTo(mapa);
            _mkT.bindTooltip('Evolucio temporal', {permanent: true, direction: 'top'});
            _latlngT = latlng;
            _punt1 = null; _punt2 = null;
            
            document.getElementById('m5P1').textContent = fmt(latlng);
            document.getElementById('meteoInfo5').textContent = 'TEMPS - ' + fmt(latlng);
            document.getElementById('m5P2wrap').style.display = 'none';
            
            obrirFinestra();
            actualitzar();
            hint('Clic dret per canviar el punt');
        } else {
            if (_punt1 && _punt2) { hint('Prem "Nou tall"'); return; }
            
            if (!_punt1) {
                eliminarMarcadors();
                _punt1 = latlng;
                _mk1 = L.marker(latlng, {icon: mkIcon('#0055ff'), zIndexOffset: 2000}).addTo(mapa);
                _mk1.bindTooltip('P1', {permanent: true, direction: 'top'});
                document.getElementById('m5P1').textContent = fmt(latlng);
                document.getElementById('m5P2wrap').style.display = 'none';
                document.getElementById('meteoInfo5').textContent = 'Selecciona el Punt 2...';
                obrirFinestra();
                netejarCanvas();
                hint('Selecciona el Punt 2');
            } else {
                _punt2 = latlng;
                _mk2 = L.marker(latlng, {icon: mkIcon('#cc2200'), zIndexOffset: 2000}).addTo(mapa);
                _mk2.bindTooltip('P2', {permanent: true, direction: 'top'});
                _linia = L.polyline([_punt1, latlng], {color:'#cc2200',weight:2,dashArray:'8 6',opacity:0.8}).addTo(mapa);
                
                const dist = (mapa.distance(_punt1, latlng) / 1000).toFixed(1);
                document.getElementById('m5P2').textContent = fmt(latlng);
                document.getElementById('m5Dist').textContent = dist + ' km';
                document.getElementById('m5P2wrap').style.display = 'inline';
                document.getElementById('meteoInfo5').textContent = 'ESPAI - ' + dist + ' km';
                
                actualitzar();
                hint('Prem "Nou tall" per un altre');
            }
        }
    }

    function actualitzar() {
        const canvas=document.getElementById('m5Canvas'); if (!canvas) return;
        const meta=window._indexData?.meta; if (!meta) return;
        const mapa=window._mapInstance;
        const opcions={relleu:_relleuActiu, hMax: _alturesCustom[_panellActiu] || null};
        let cols=[];

        if (_mode==='temps') {
            if (!_latlngT) return;
            const cache=window._canvasLayer?._cacheHores||{};
            const horaDisp=window._hoursDisponibles||[];
            if (horaDisp.length===0) {
                const ctx=canvas.getContext('2d');
                ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
                ctx.fillStyle='#000080';ctx.font='bold 13px Arial';ctx.textAlign='center';
                ctx.fillText('No hi ha hores disponibles.',canvas.width/2,canvas.height/2);
                return;
            }
            cols=[];
            for (const idx of horaDisp) {
                const bloc=cache[idx]; if(!bloc) continue;
                const p=perfil(bloc,_latlngT.lat,_latlngT.lng);
                const ts=(meta.times_utc||[])[idx];
                if (ts) {
                    const dt=new Date(ts);
                    const local=dt.toLocaleTimeString('ca-ES',{timeZone:'Europe/Madrid',hour:'2-digit',minute:'2-digit',hour12:false});
                    const wd=dt.toLocaleDateString('ca-ES',{timeZone:'Europe/Madrid',weekday:'short'}).slice(0,2);
                    p._label=(parseInt(local)===0||cols.length===0)?wd+'\n'+local:local;
                }
                cols.push(p);
            }
        } else {
            if (!_punt1||!_punt2) return;
            const numPts=80;
            const dist=mapa.distance(_punt1,_punt2)/1000;
            const bloc=window._canvasLayer?._dadesActuals;
            if (!bloc) return;
            cols=[];
            for (let i=0;i<numPts;i++) {
                const f=i/(numPts-1);
                const lat=_punt1.lat+(_punt2.lat-_punt1.lat)*f;
                const lng=_punt1.lng+(_punt2.lng-_punt1.lng)*f;
                const p=perfil(bloc,lat,lng);
                p.f=f; p._label=(dist*f).toFixed(0)+'km';
                cols.push(p);
            }
        }

        const nX=cols.length;
        if (nX<2) return;

        // Netejar listeners del canvas
        canvas.onmousemove = null;
        canvas.onmouseleave = null;

        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);

        if (_panellActiu==='TOTS') {
            _dibuixarTots(ctx,cols,nX,canvas.width,canvas.height,opcions);
        } else {
            const dibuixos = {'T':dibuixarPanellT,'DP':dibuixarPanellDP,'HR':dibuixarPanellHR,'DBZ':dibuixarPanellDBZ,'ISO':dibuixarPanellISO,'VENT':dibuixarPanellVENT};
            const fn = dibuixos[_panellActiu];
            if (fn) fn(canvas, cols, nX, opcions);
        }
    }

    function _dibuixarTots(ctx,cols,nX,W,H,opcions) {
        const ML=52, MR=52, PW=W-ML-MR;
        const relleuActiu = opcions?.relleu||false;
        const PANELLS = [
            { id:'T', label:'Temperatura + Vent [0-500 m]', hMax:500, fH:0.18 },
            { id:'DP', label:'Punt de rosada [0-500 m]', hMax:500, fH:0.13 },
            { id:'HR', label:'Humitat + Nuvols [0-3000 m]', hMax:3000, fH:0.16 },
            { id:'DBZ', label:'Radar DBZ [0-8 km]', hMax:8000, fH:0.17 },
            { id:'ISO', label:'Isotermes 0/1/1.5 C [0-8 km]', hMax:8000, fH:0.13 },
            { id:'VENT', label:'Vent 10-500 m (km/h)', hMax:500, fH:0.10 },
        ];
        const MT=20, MB=28, SEP=6;
        const totalSep=SEP*(PANELLS.length-1);
        const totalH=H-MT-MB-totalSep;
        let curY=MT;
        for (const pan of PANELLS) { pan.TOP=curY; pan.PH=Math.floor(totalH*pan.fH); pan.BOT=pan.TOP+pan.PH; curY=pan.BOT+SEP; }
        const xOf=i=>ML+(i/(nX-1))*PW;
        const yOf=(pan,h)=>pan.BOT-(Math.min(h,pan.hMax)/pan.hMax)*pan.PH;
        const tickStep=Math.max(1,Math.floor(nX/18));
        
        ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H);
        
        for (let i=0;i<nX;i+=tickStep) {
            const x=xOf(i);
            ctx.strokeStyle='rgba(0,0,0,0.05)'; ctx.lineWidth=0.5;
            ctx.beginPath(); ctx.moveTo(x,MT); ctx.lineTo(x,PANELLS[5].BOT); ctx.stroke();
            ctx.fillStyle='#444'; ctx.font='8px Arial'; ctx.textAlign='center';
            ctx.fillText(cols[i]._label||'', x, H-MB+12);
        }

        // P0: T
        const PT=PANELLS[0];
        ctx.fillStyle='#f8f9ff'; ctx.fillRect(ML,PT.TOP,PW,PT.PH);
        const imgT=ctx.createImageData(PW,PT.PH); const dT=imgT.data;
        for (let px=0;px<PW;px++) {
            const fi=(px/(PW-1))*(nX-1), i0=Math.min(nX-2,Math.floor(fi)), tf=fi-i0;
            const cL=cols[i0], cR=cols[i0+1];
            for (let py=0;py<PT.PH;py++) {
                const h=PT.hMax*(1-py/(PT.PH-1));
                const tL=iT(cL,h), tR=iT(cR,h);
                if (tL==null||tR==null) { dT[(py*PW+px)*4+3]=0; continue; }
                const [r,g,b]=palRGB(T_PAL,tL+tf*(tR-tL));
                const ii=(py*PW+px)*4; dT[ii]=r;dT[ii+1]=g;dT[ii+2]=b;dT[ii+3]=210;
            }
        }
        ctx.putImageData(imgT,ML,PT.TOP);
        if (relleuActiu) dibuixarRelleu(ctx,ML,PW,PT.TOP,PT.BOT,PT.hMax,cols,xOf,(h)=>yOf(PT,h));
        ctx.save(); ctx.beginPath(); ctx.rect(ML,PT.TOP,PW,PT.PH); ctx.clip();
        const bStepT=Math.max(1,Math.floor(nX/20));
        for (let i=0;i<nX;i+=bStepT) {
            for (const h of ALT_T) {
                if (h>PT.hMax) continue;
                const relleu = cols[i].relieuM||0;
                if (relleuActiu && h < relleu) continue;
                barbeta(ctx,xOf(i),yOf(PT,h),cols[i][`ws${h}`],cols[i][`wd${h}`],8);
            }
        }
        ctx.restore();
        graella(ctx,ML,PW,PT.TOP,PT.BOT,[0,100,200,300,400,500],PT.hMax,h=>h+'m');
        borde(ctx,ML,PW,PT.TOP,PT.PH);
        ctx.fillStyle='#222'; ctx.font='bold 8px Arial'; ctx.textAlign='left';
        ctx.fillText(PT.label, ML, PT.TOP-5);

        // P1: DP
        const PD=PANELLS[1];
        ctx.fillStyle='#f5fdf5'; ctx.fillRect(ML,PD.TOP,PW,PD.PH);
        const imgDP=ctx.createImageData(PW,PD.PH); const dDP=imgDP.data;
        for (let px=0;px<PW;px++) {
            const fi=(px/(PW-1))*(nX-1), i0=Math.min(nX-2,Math.floor(fi)), tf=fi-i0;
            const cL=cols[i0], cR=cols[i0+1];
            for (let py=0;py<PD.PH;py++) {
                const h=PD.hMax*(1-py/(PD.PH-1));
                const dpL=iDP(cL,h), dpR=iDP(cR,h);
                if (dpL==null||dpR==null) { dDP[(py*PW+px)*4+3]=0; continue; }
                const [r,g,b]=palRGB(DP_PAL,dpL+tf*(dpR-dpL));
                const ii=(py*PW+px)*4; dDP[ii]=r;dDP[ii+1]=g;dDP[ii+2]=b;dDP[ii+3]=210;
            }
        }
        ctx.putImageData(imgDP,ML,PD.TOP);
        if (relleuActiu) dibuixarRelleu(ctx,ML,PW,PD.TOP,PD.BOT,PD.hMax,cols,xOf,(h)=>yOf(PD,h));
        graella(ctx,ML,PW,PD.TOP,PD.BOT,[0,100,200,300,400,500],PD.hMax,h=>h+'m');
        borde(ctx,ML,PW,PD.TOP,PD.PH);
        ctx.fillStyle='#1a6e2e'; ctx.font='bold 8px Arial'; ctx.textAlign='left';
        ctx.fillText(PD.label, ML, PD.TOP-5);

        // P2: HR
        const PH=PANELLS[2];
        ctx.fillStyle='#e8f0f8'; ctx.fillRect(ML,PH.TOP,PW,PH.PH);
        const imgHR=ctx.createImageData(PW,PH.PH); const dHR=imgHR.data;
        for (let px=0;px<PW;px++) {
            const fi=(px/(PW-1))*(nX-1), i0=Math.min(nX-2,Math.floor(fi)), tf=fi-i0;
            const cL=cols[i0], cR=cols[i0+1];
            for (let py=0;py<PH.PH;py++) {
                const h=PH.hMax*(1-py/(PH.PH-1));
                const hrL=iHR(cL,h), hrR=iHR(cR,h);
                if (hrL==null&&hrR==null) continue;
                const hr=(hrL??hrR)+tf*((hrR??hrL)-(hrL??hrR));
                const [r,g,b,a]=palRGB(HR_PAL,hr);
                const ii=(py*PW+px)*4;
                dHR[ii]=r;dHR[ii+1]=g;dHR[ii+2]=b;dHR[ii+3]=Math.round(a*0.7);
            }
        }
        ctx.putImageData(imgHR,ML,PH.TOP);
        if (relleuActiu) dibuixarRelleu(ctx,ML,PW,PH.TOP,PH.BOT,PH.hMax,cols,xOf,(h)=>yOf(PH,h));
        graella(ctx,ML,PW,PH.TOP,PH.BOT,[0,500,1000,1500,2000,2500,3000],PH.hMax,h=>h>=1000?(h/1000)+'km':h+'m');
        borde(ctx,ML,PW,PH.TOP,PH.PH);
        ctx.fillStyle='#003366'; ctx.font='bold 8px Arial'; ctx.textAlign='left';
        ctx.fillText(PH.label, ML, PH.TOP-5);

        // P3: DBZ
        const PDBZ=PANELLS[3];
        ctx.fillStyle='#000811'; ctx.fillRect(ML,PDBZ.TOP,PW,PDBZ.PH);
        const imgDBZ=ctx.createImageData(PW,PDBZ.PH); const dDBZ=imgDBZ.data;
        for (let px=0;px<PW;px++) {
            const fi=(px/(PW-1))*(nX-1), i0=Math.min(nX-2,Math.floor(fi)), tf=fi-i0;
            const cL=cols[i0], cR=cols[i0+1];
            for (let py=0;py<PDBZ.PH;py++) {
                const h=PDBZ.hMax*(1-py/(PDBZ.PH-1));
                const dbzL=dbzAAlcada(cL,h), dbzR=dbzAAlcada(cR,h);
                const dbz=dbzL+tf*(dbzR-dbzL);
                if (dbz<2) continue;
                const [r,g,b,a]=palRGB(DBZ_PAL,dbz);
                const ii=(py*PW+px)*4; dDBZ[ii]=r;dDBZ[ii+1]=g;dDBZ[ii+2]=b;dDBZ[ii+3]=a;
            }
        }
        ctx.putImageData(imgDBZ,ML,PDBZ.TOP);
        if (relleuActiu) dibuixarRelleu(ctx,ML,PW,PDBZ.TOP,PDBZ.BOT,PDBZ.hMax,cols,xOf,(h)=>yOf(PDBZ,h),'dark');
        for (const h of [0,1000,2000,3000,4000,5000,6000,7000,8000]) {
            const y=yOf(PDBZ,h);
            ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=0.5;
            ctx.beginPath(); ctx.moveTo(ML,y); ctx.lineTo(ML+PW,y); ctx.stroke();
        }
        borde(ctx,ML,PW,PDBZ.TOP,PDBZ.PH);
        ctx.fillStyle='#00cc66'; ctx.font='bold 8px Arial'; ctx.textAlign='left';
        ctx.fillText(PDBZ.label, ML, PDBZ.TOP-5);

        // P4: ISO
        const PISO=PANELLS[4];
        ctx.fillStyle='#fafafa'; ctx.fillRect(ML,PISO.TOP,PW,PISO.PH);
        if (relleuActiu) dibuixarRelleu(ctx,ML,PW,PISO.TOP,PISO.BOT,PISO.hMax,cols,xOf,(h)=>yOf(PISO,h));
        ctx.save();
        [0,1,1.5].forEach((iso,i)=>{
            const key=i===0?'alt0c':i===1?'alt1c':'alt1_5c';
            const colors=['#0055cc','#00aacc','#00ccaa'];
            const dashes=[[],[5,4],[3,5]];
            ctx.beginPath(); ctx.strokeStyle=colors[i]; ctx.lineWidth=2-i*0.5;
            ctx.setLineDash(dashes[i]);
            let pr=true;
            for (let j=0;j<nX;j++) {
                const v=cols[j][key];
                if (!v||v<0) {pr=true;continue;}
                const y=yOf(PISO,Math.min(v,PISO.hMax));
                if(pr){ctx.moveTo(xOf(j),y);pr=false;}else ctx.lineTo(xOf(j),y);
            }
            ctx.stroke(); ctx.setLineDash([]);
        });
        ctx.restore();
        graella(ctx,ML,PW,PISO.TOP,PISO.BOT,[0,1000,2000,3000,4000,5000,6000,7000,8000],PISO.hMax,h=>h>=1000?(h/1000)+'km':h+'m');
        borde(ctx,ML,PW,PISO.TOP,PISO.PH);
        ctx.fillStyle='#003388'; ctx.font='bold 8px Arial'; ctx.textAlign='left';
        ctx.fillText(PISO.label, ML, PISO.TOP-5);

        // P5: VENT
        const PV=PANELLS[5];
        ctx.fillStyle='#f5f8ff'; ctx.fillRect(ML,PV.TOP,PW,PV.PH);
        const imgW=ctx.createImageData(PW,PV.PH); const dW=imgW.data;
        for (let px=0;px<PW;px++) {
            const fi=(px/(PW-1))*(nX-1), i0=Math.min(nX-2,Math.floor(fi)), tf=fi-i0;
            const cL=cols[i0], cR=cols[i0+1];
            for (let py=0;py<PV.PH;py++) {
                const h=PV.hMax*(1-py/(PV.PH-1));
                const wsL=iWS(cL,h), wsR=iWS(cR,h);
                if (wsL==null||wsR==null) { dW[(py*PW+px)*4+3]=0; continue; }
                const ws=wsL+tf*(wsR-wsL);
                const [r,g,b]=palRGB(WIND_PAL,ws);
                const ii=(py*PW+px)*4; dW[ii]=r;dW[ii+1]=g;dW[ii+2]=b;dW[ii+3]=190;
            }
        }
        ctx.putImageData(imgW,ML,PV.TOP);
        ctx.save(); ctx.beginPath(); ctx.rect(ML,PV.TOP,PW,PV.PH); ctx.clip();
        const bStepV=Math.max(1,Math.floor(nX/18));
        for (let i=0;i<nX;i+=bStepV) {
            for (const h of ALT_VENT) {
                if (h>PV.hMax) continue;
                const relleu = cols[i].relieuM||0;
                if (relleuActiu && h < relleu) continue;
                barbeta(ctx,xOf(i),yOf(PV,h),cols[i][`ws${h}`],cols[i][`wd${h}`],8);
            }
        }
        ctx.restore();
        if (relleuActiu) dibuixarRelleu(ctx,ML,PW,PV.TOP,PV.BOT,PV.hMax,cols,xOf,(h)=>yOf(PV,h));
        graella(ctx,ML,PW,PV.TOP,PV.BOT,[0,100,200,300,400,500],PV.hMax,h=>h+'m');
        borde(ctx,ML,PW,PV.TOP,PV.PH);
        ctx.fillStyle='#004499'; ctx.font='bold 8px Arial'; ctx.textAlign='left';
        ctx.fillText(PV.label, ML, PV.TOP-5);

        ctx.strokeStyle='#888'; ctx.lineWidth=1;
        ctx.strokeRect(ML,MT,PW,PANELLS[5].BOT-MT);
    }

    // ══════════════════════════════════════════════════════════════════
    //  INIT
    // ══════════════════════════════════════════════════════════════════
    function init() {
        if (window._mapInstance && window._canvasLayer && window._indexData) {
            crearUI();
            
            if (window._meteoCtxHandler) {
                window._mapInstance.off('contextmenu', window._meteoCtxHandler);
            }
            window._meteoCtxHandler = function(e) {
                e.originalEvent.preventDefault();
                onClic(e.latlng);
            };
            window._mapInstance.on('contextmenu', window._meteoCtxHandler);
            
            window._meteoActualitzar = actualitzar;
            console.log('[METEO v5.9] Net i estable - Sense lag, barbes fora terreny, paleta T dramatica');
        } else {
            setTimeout(init, 200);
        }
    }
    
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 300);
    } else {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 300));
    }

})();




})(window, L);