import { createRemoteJWKSet, jwtVerify } from 'jose';

const PROJECT_ID = 'tempestescat';
const ORIGENS = [
  'https://tempestes.cat',
  'https://www.tempestes.cat',
  'http://127.0.0.1:8080',
  'http://localhost:8080',
];
const JWKS = createRemoteJWKSet(new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

// ── Mateixes llistes que mapapngs.js ──
const setDe = s => new Set(s.trim().split(/\s+/));
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[\s\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

const GRATIS = setDe(`st sd srh sh2 feels_like temp_min2m temp_max2m wind_speed_10m wind_gust
  wind_speed_gust_specific_height_level_above_ground pressure_msl sp tp neige_ground tsnowp
  snow_depth_ground_or_water_surface water_equivalent_accumulated_snow_ground_or_water_surface
  hteurneige_ground hteuneige_ground hterneige_ground neige_sc_ground resr_neige_ground rr_sol_gele_ground
  total_cloud_cover_ground_or_water_surface low_cloud_cover medium_cloud_cover high_cloud_cover
  base_nuage_ground plafond_ground bt_channels_62 cape convective_inhibition_ground_or_water_surface
  altitude_iso_t_27315 altitude_iso_tpw_27315 altitude_iso_tpw_27415 altitude_iso_tpw_27465
  tpw_isobaric_850 thetav_isobaric_850`);
const ENTUSIASTA = setDe(`precip_ground bt_channels_108 reflectivity_max_dbz_ground_or_water_surface
  shear_01 shear_03 shear_06 srh_01 srh_03 storm_speed helicite_ground`);
const PROFESSIONAL = setDe('spbl diag_grele_ground diag_ehi_ground diag_scp_ground diag_stp_ground');
const SENSE_SESSIO = setDe(`st temp_min2m temp_max2m srh sh2 wind_speed_10m
  wind_speed_gust_specific_height_level_above_ground`);
const NIVELL_GRATIS_3D = setDe('t dpt r wind_speed w');
const ENTUSIASTA_3D = setDe('shear_01 shear_03 shear_06 srh_01 srh_03 storm_speed helicite_ground');

const DIA = '(?:ahir|avui|dema_passat|dema|\\d{4})';
const RE = {
  sfc:   new RegExp(`^sfc_\\d{2}_${DIA}_(.+)\\.png\\.enc$`),
  isoS:  new RegExp(`^isolines_\\d{2}_${DIA}_(.+)\\.js\\.enc$`),
  d3:    new RegExp(`^3d_\\d{2}_${DIA}_(.+)_(\\d+|col)\\.png\\.enc$`),
  iso3:  new RegExp(`^isolines_3d_\\d{2}_${DIA}_(.+)_(\\d+|col)\\.js\\.enc$`),
};

function rangVariable(v) {
  const o = norm(v), b = o.replace(/_\d+$/, '');
  for (const k of [o, b]) {
    if (PROFESSIONAL.has(k)) return 2;
    if (ENTUSIASTA.has(k)) return 1;
    if (GRATIS.has(k)) return 0;
  }
  return 2;
}
const rang3D = (v, niv) => (niv !== 'col' && NIVELL_GRATIS_3D.has(v)) ? 0 : ENTUSIASTA_3D.has(v) ? 1 : 2;

// Retorna: -1 = públic sense sessió · 0 = cal sessió · 1/2 = pla mínim
function reglaFitxer(key) {
  const mm = key.match(/^arome\/(web_data_[A-Za-z]+)\/imatges\/(.+)$/);
  if (!mm) return 2;                                         // fora de la ruta esperada: tancat
  const carpeta = mm[1], nom = mm[2];
  const derivats = carpeta === 'web_data_derivats';

  if (/^manifest.*\.json\.enc$/.test(nom) || nom === 'info_run.json') return -1;
  if (/^legend_/.test(nom) || /^(fons|vores)\.png\.enc$/.test(nom)) return -1;
  if (derivats) return 2;                                     // tot el que quedi als derivats: Professional

  let m;
  if ((m = nom.match(RE.sfc)) || (m = nom.match(RE.isoS))) {
    const r = rangVariable(m[1]);
    return (r === 0 && SENSE_SESSIO.has(norm(m[1]))) ? -1 : r;
  }
  if ((m = nom.match(RE.d3)) || (m = nom.match(RE.iso3))) return rang3D(m[1], m[2]);
  if (/^vent_/.test(nom)) return -1;                          // camp de vent 10 m (streamlines)
  if (/^sondeig_/.test(nom) || /^stormmotion_/.test(nom)) return 1;   // Skew-T i barbes
  if (/^vent3d_/.test(nom)) return 0;
  return 0;                                                   // desconegut (p. ex. outlooks): cal sessió
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin');
    const cors = {
      'Access-Control-Allow-Origin': ORIGENS.includes(origin) ? origin : ORIGENS[0],
      'Access-Control-Allow-Headers': 'Authorization',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    const resp = (t, s) => new Response(t, { status: s, headers: cors });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'GET' && req.method !== 'HEAD') return resp('Mètode no permès', 405);

    let key;
    try { key = decodeURIComponent(new URL(req.url).pathname.slice(1)); }
    catch { return resp('No trobat', 404); }
    if (!key || key.includes('..')) return resp('No trobat', 404);

    let plan = -1, tokenDolent = false;                       // -1 = sense sessió
    const auth = req.headers.get('Authorization');
    if (auth && auth.startsWith('Bearer ')) {
      try {
        const { payload } = await jwtVerify(auth.slice(7), JWKS,
          { issuer: `https://securetoken.google.com/${PROJECT_ID}`, audience: PROJECT_ID });
        plan = payload.admin === true ? 2 : (Number(payload.plan) || 0);
      } catch { tokenDolent = true; }
    }

    const need = reglaFitxer(key);
    if (need !== -1) {
      if (plan === -1 || tokenDolent) return resp('Cal iniciar sessió', 401);
      if (plan < need) return resp('Pla insuficient', 403);
    }

    const obj = await env.BUCKET.get(key);
    if (!obj) return resp('No trobat', 404);
    const h = new Headers(cors);
    h.set('Content-Type', key.endsWith('.json') ? 'application/json' : 'application/octet-stream');
    h.set('Cache-Control', need === -1 ? 'public, max-age=60' : 'private, max-age=3600');
    h.set('ETag', obj.httpEtag);
    return new Response(req.method === 'HEAD' ? null : obj.body, { headers: h });
  },
};