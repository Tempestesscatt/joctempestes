/* =====================================================================
   enquesta.js · Enquesta "typeform-style" per a TEMPESTES.CAT
   ---------------------------------------------------------------------
   · Una pregunta per pantalla amb animació de slide
   · Barra de progrés
   · No demana login si ja estàs autenticat (mostra qui respon)
   · Si NO estàs loguejat, mostra un botó per fer-ho
   · Desa a Firebase RTDB: /enquesta/respostes/{uid}
   · Només una resposta per usuari
   · Panell d'admin (si /admin/{email} === true)
   · Exportació CSV
   · Icones SVG pròpies (hereten el color del tema)
   · Salt intel·ligent segons el pla/cicle clicat a preus.html
   ===================================================================== */

const DB_URL = 'https://tempestescat-default-rtdb.europe-west1.firebasedatabase.app';
const RUTA_RESPOSTES = DB_URL + '/enquesta/respostes';
const RUTA_ADMIN = DB_URL + '/admin';

/* ───────────────────────────────────────────────────────────────────
   ICONES SVG
   ─────────────────────────────────────────────────────────────────── */
const ICONES = {
  fletxaDreta: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>`,
  fletxaEsq: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 5l-7 7 7 7"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
  enviar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`,
  tanca: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,

  nuvol: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></svg>`,
  llamp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  edifici: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 9h.01M15 9h.01M9 13h.01M15 13h.01"/></svg>`,
  gratis: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9.5c0-1.1.9-2 2-2h2a2 2 0 0 1 0 4h-2a2 2 0 0 0 0 4h2c1.1 0 2-.9 2-2M12 6v2M12 16v2"/></svg>`,
  cor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  polze: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z"/></svg>`,
  pensatiu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>`,
  trist: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01"/></svg>`,
  calendari: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
  moneda: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 6v12M15 9.5a2.5 2.5 0 0 0-2.5-2.5h-1a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4h-1A2.5 2.5 0 0 1 9 12.5"/></svg>`,
  dubte: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>`,
  grafic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18M7 15l4-4 4 4 5-6"/></svg>`,
  tempesta: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 16H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9zM13 12l-2 4h3l-2 4"/></svg>`,
  capes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  calculadora: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>`,
  radar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12l7-7"/><circle cx="12" cy="12" r="2"/><path d="M4.93 19.07A10 10 0 1 1 19.07 4.93M7.76 16.24a6 6 0 1 1 8.48-8.48"/></svg>`,
  api: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h8"/></svg>`,
  campana: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  campanaOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0M18.63 13A17.89 17.89 0 0 1 18 8M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.33-5M2 2l20 20"/></svg>`,
  descarregar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>`,
  refrescar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  tauler: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
  eina: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  objectiu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`
};

/* ───────────────────────────────────────────────────────────────────
   PREGUNTES (amb condicions de visibilitat)
   ─────────────────────────────────────────────────────────────────── */
const PREGUNTES = [
  {
    id: 'pla',
    tipus: 'single',
    titol: 'Quin pla t\'interessaria més?',
    hint: 'Tria el que més s\'acosti al que necessites.',
    // Només es mostra si no s'ha preseleccionat cap pla des del botó
    condicio: () => !ESTAT.preseleccionat,
    opcions: [
      { valor: 'entusiasta',   ico: 'nuvol',    text: 'Entusiasta',  sub: '4,99 €/mes' },
      { valor: 'professional', ico: 'llamp',    text: 'Professional', sub: '9,99 €/mes' },
      { valor: 'equips',       ico: 'edifici',  text: 'Equips', sub: 'per a mitjans, agències, universitats…' },
      { valor: 'cap',          ico: 'gratis',   text: 'De moment cap', sub: 'em quedo amb el Gratuït' }
    ]
  },
  {
    id: 'preu',
    tipus: 'single',
    titol: 'Què et semblen els preus?',
    hint: 'Siguis sincer, no et compromet a res.',
    condicio: () => ESTAT.respostes.pla !== 'cap',
    opcions: [
      { valor: 'barat',     ico: 'cor',       text: 'Barats' },
      { valor: 'just',      ico: 'polze',     text: 'Justos' },
      { valor: 'car',       ico: 'pensatiu',  text: 'Una mica cars' },
      { valor: 'massa_car', ico: 'trist',     text: 'Massa cars, no pagaria' }
    ]
  },
  {
    id: 'cicle',
    tipus: 'single',
    titol: 'Com preferiries pagar?',
    hint: 'El pagament anual té un descompte de fins al 17%.',
    condicio: () => ESTAT.respostes.pla !== 'cap',
    opcions: [
      { valor: 'mensual', ico: 'calendari', text: 'Mensual' },
      { valor: 'anual',   ico: 'moneda',    text: 'Anual', sub: 'estalvi fins al 17%' },
      { valor: 'nols',    ico: 'dubte',     text: 'No ho sé' }
    ]
  },
  {
    // 🔥 Pregunta EXTRA que només surt si el pla és "equips"
    id: 'equips_necessitats',
    tipus: 'text',
    titol: 'Què necessitaries exactament?',
    hint: 'Explica\'ns què necessita el teu equip, mitjà o institució.',
    placeholder: 'Ex: 5 comptes d\'usuari, accés a l\'API per integrar-ho al nostre web, facturació a nom d\'empresa…',
    maxlength: 500,
    condicio: () => ESTAT.respostes.pla === 'equips'
  },
  {
    id: 'equips_motiu',
    tipus: 'text',
    titol: 'I per a què ho faríeu servir?',
    hint: 'Ens ajuda a entendre el teu cas d\'ús.',
    placeholder: 'Ex: som un mitjà local i volem fer seguiment d\'episodis severs…',
    maxlength: 500,
    condicio: () => ESTAT.respostes.pla === 'equips'
  },
  {
    id: 'funcions',
    tipus: 'multi',
    titol: 'Quines funcions et fan més falta?',
    hint: 'Pots triar-ne diverses.',
    opcions: [
      { valor: 'skewt',    ico: 'grafic',      text: 'Skew-T complet' },
      { valor: 'convecio', ico: 'tempesta',    text: 'Variables avançades de convecció' },
      { valor: 'pressio',  ico: 'capes',       text: 'Nivells de pressió' },
      { valor: 'indexs',   ico: 'calculadora', text: 'Índexs compostos (EHI, SCP, STP)' },
      { valor: 'radar',    ico: 'radar',       text: 'Radar ampliat / 24 h' },
      { valor: 'api',      ico: 'api',         text: 'API de dades' }
    ]
  },
  {
    id: 'comentari',
    tipus: 'text',
    titol: 'Algun comentari o suggeriment?',
    hint: 'Opcional. Què hi afegiries, treuries o canviaries?',
    placeholder: 'Escriu el que vulguis…',
    maxlength: 500
  },
  {
    id: 'avisar',
    tipus: 'single',
    titol: 'Vols que t\'avisem quan surtin?',
    hint: 'T\'enviarem un correu quan els plans premium estiguin disponibles.',
    opcions: [
      { valor: '1', ico: 'campana',    text: 'Sí, avisa\'m per correu' },
      { valor: '0', ico: 'campanaOff', text: 'No, gràcies' }
    ]
  }
];

const ETIQ = {
  pla: { entusiasta: 'Entusiasta', professional: 'Professional', equips: 'Equips', cap: 'Cap (Gratuït)' },
  preu: { barat: 'Barats', just: 'Justos', car: 'Una mica cars', massa_car: 'Massa cars' },
  cicle: { mensual: 'Mensual', anual: 'Anual', nols: 'No ho sap' },
  funcions: { skewt: 'Skew-T', convecio: 'Convecció avançada', pressio: 'Nivells de pressió', indexs: 'Índexs compostos', radar: 'Radar ampliat', api: 'API de dades' }
};

/* ───────────────────────────────────────────────────────────────────
   ESTAT
   ─────────────────────────────────────────────────────────────────── */
const ESTAT = {
  preguntaActual: 0,
  respostes: {},
  animant: false,
  jaRespost: false,
  preseleccionat: false // si ve d'un botó "Subscriure'm" concret
};

let respostesAdmin = [];
let esAdmin = false;

const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const cont = () => document.getElementById('enq');
const contAdmin = () => document.getElementById('enqAdmin');

/* Retorna les preguntes visibles segons les respostes actuals */
function preguntesVisibles() {
  return PREGUNTES.filter(p => !p.condicio || p.condicio());
}

/* ───────────────────────────────────────────────────────────────────
   API
   ─────────────────────────────────────────────────────────────────── */
async function api(metode, url, cos) {
  const user = window._fbUser;
  if (!user) throw new Error('No autenticat');
  const token = await user.getIdToken();
  const sep = url.includes('?') ? '&' : '?';
  const opts = { method: metode, cache: 'no-store' };
  if (cos) {
    opts.body = JSON.stringify(cos);
    opts.headers = { 'Content-Type': 'application/json' };
  }
  return fetch(url + sep + 'auth=' + token, opts);
}

async function comprovarAdmin() {
  const user = window._fbUser;
  if (!user || !user.email) return false;
  try {
    const r = await fetch(RUTA_ADMIN + '.json', { cache: 'no-store' });
    if (!r.ok) return false;
    const admins = await r.json() || {};
    const clau = user.email.toLowerCase().replace(/\./g, ',');
    return admins[clau] === true;
  } catch (e) { return false; }
}

/* ───────────────────────────────────────────────────────────────────
   RENDER SHELL
   ─────────────────────────────────────────────────────────────────── */
function renderShell() {
  const el = cont();
  if (!el) return;
  el.innerHTML = `
    <button type="button" class="enq-tanca" id="enqTanca" aria-label="Tanca">${ICONES.tanca}</button>

    <div class="enq-shell" id="enqPantallaLogin" hidden>
      <div class="enq-pantalla">
        <div class="icona"><i class="fa-solid fa-clipboard-list"></i></div>
        <h3>Ajuda'ns a decidir els plans</h3>
        <p>Són unes preguntes i tardes menys d'un minut. Per respondre necessitem que iniciïs sessió (així evitem respostes duplicades).</p>
        <button type="button" class="enq-btn-pill" id="enqBtnLogin">
          <i class="fa-brands fa-google"></i> Inicia sessió amb Google
        </button>
      </div>
    </div>

    <div class="enq-shell" id="enqPantallaPregunta" hidden>
      <div class="enq-progress"><div class="bar" id="enqBar"></div></div>
      <div class="enq-head">
        <span class="step" id="enqStep"></span>
        <span class="qui" id="enqQui"></span>
      </div>
      <div class="enq-body" id="enqBody"></div>
      <div class="enq-foot">
        <button type="button" class="enrere" id="enqEnrere">
          ${ICONES.fletxaEsq} Enrere
        </button>
        <div class="enq-espai"></div>
        <button type="button" class="seguent" id="enqSeguent">
          Següent ${ICONES.fletxaDreta}
        </button>
      </div>
    </div>

    <div class="enq-shell" id="enqPantallaFet" hidden>
      <div class="enq-pantalla">
        <div class="enq-ok-icon">${ICONES.check}</div>
        <h3>Gràcies per la teva resposta!</h3>
        <p>Ens ajudarà molt a decidir com seran els plans premium de TEMPESTES.CAT.</p>
        <button type="button" class="enq-btn-pill" id="enqBtnTancarFet">
          Tanca
        </button>
      </div>
    </div>
  `;
}

function mostrarPantalla(nom) {
  $('#enqPantallaLogin').hidden    = nom !== 'login';
  $('#enqPantallaPregunta').hidden = nom !== 'pregunta';
  $('#enqPantallaFet').hidden      = nom !== 'fet';
}

function pintarUsuariCapcalera() {
  const el = $('#enqQui');
  if (!el) return;
  const u = window._fbUser;
  if (!u) { el.innerHTML = ''; return; }
  const nom = u.displayName || (u.email ? u.email.split('@')[0] : 'Usuari');
  const inicial = nom[0].toUpperCase();
  const avatar = u.photoURL
    ? `<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">`
    : `<span>${esc(inicial)}</span>`;
  el.innerHTML = `
    <span class="qui-avatar">${avatar}</span>
    <span class="qui-nom">${esc(nom)}</span>
  `;
}

/* ───────────────────────────────────────────────────────────────────
   RENDER PREGUNTA
   ─────────────────────────────────────────────────────────────────── */
function renderPregunta(index) {
  const visibles = preguntesVisibles();
  const p = visibles[index];
  if (!p) { enviarEnquesta(); return; }

  const body = $('#enqBody');
  if (!body) return;

  const val = ESTAT.respostes[p.id];

  let htmlOpts = '';
  if (p.tipus === 'single') {
    htmlOpts = `<div class="enq-opcions">${p.opcions.map(o => `
      <label class="enq-op" data-tipus="single">
        <input type="radio" name="${p.id}" value="${esc(o.valor)}" ${val === o.valor ? 'checked' : ''}>
        <span class="marca"></span>
        <span class="ico">${ICONES[o.ico] || ''}</span>
        <span class="text">
          <span class="titol">${esc(o.text)}</span>
          ${o.sub ? `<span class="sub">${esc(o.sub)}</span>` : ''}
        </span>
      </label>`).join('')}</div>`;
  } else if (p.tipus === 'multi') {
    const arr = Array.isArray(val) ? val : [];
    htmlOpts = `<div class="enq-opcions">${p.opcions.map(o => `
      <label class="enq-op" data-tipus="multi">
        <input type="checkbox" name="${p.id}" value="${esc(o.valor)}" ${arr.includes(o.valor) ? 'checked' : ''}>
        <span class="marca"></span>
        <span class="ico">${ICONES[o.ico] || ''}</span>
        <span class="text">
          <span class="titol">${esc(o.text)}</span>
          ${o.sub ? `<span class="sub">${esc(o.sub)}</span>` : ''}
        </span>
      </label>`).join('')}</div>`;
  } else if (p.tipus === 'text') {
    htmlOpts = `<textarea class="enq-textarea" id="enqText" maxlength="${p.maxlength || 500}"
      placeholder="${esc(p.placeholder || '')}">${esc(val || '')}</textarea>`;
  }

  body.innerHTML = `
    <div class="enq-slide" id="enqSlide">
      <h3>${esc(p.titol)}</h3>
      ${p.hint ? `<p class="hint">${esc(p.hint)}</p>` : ''}
      ${htmlOpts}
    </div>
  `;

  // Barra i comptador (sobre el total de visibles)
  const totalVisibles = visibles.length;
  const pct = (index / totalVisibles) * 100;
  $('#enqBar').style.width = pct + '%';
  $('#enqStep').textContent = `Pregunta ${index + 1} de ${totalVisibles}`;
  $('#enqEnrere').disabled = index === 0;

  actualitzarBotoSeguent();
  pintarUsuariCapcalera();

  if (p.tipus === 'single') {
    $$('input[name="' + p.id + '"]', body).forEach(inp => {
      inp.addEventListener('change', () => {
        ESTAT.respostes[p.id] = inp.value;
        actualitzarBotoSeguent();
        setTimeout(() => { if (!ESTAT.animant) seguent(); }, 280);
      });
    });
  } else if (p.tipus === 'multi') {
    $$('input[name="' + p.id + '"]', body).forEach(inp => {
      inp.addEventListener('change', () => {
        ESTAT.respostes[p.id] = $$('input[name="' + p.id + '"]:checked', body).map(x => x.value);
        actualitzarBotoSeguent();
      });
    });
  } else if (p.tipus === 'text') {
    const ta = $('#enqText', body);
    if (ta) {
      ta.addEventListener('input', () => {
        ESTAT.respostes[p.id] = ta.value;
        actualitzarBotoSeguent();
      });
      ta.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (!ESTAT.animant) seguent();
        }
      });
      // Focus automàtic als textarea
      setTimeout(() => ta.focus(), 100);
    }
  }

  requestAnimationFrame(() => {
    const slide = $('#enqSlide', body);
    if (slide) slide.classList.add('actiu');
  });
}

function actualitzarBotoSeguent() {
  const visibles = preguntesVisibles();
  const p = visibles[ESTAT.preguntaActual];
  if (!p) return;
  const btn = $('#enqSeguent');
  if (!btn) return;

  let ok = false;
  const val = ESTAT.respostes[p.id];
  if (p.tipus === 'single') ok = !!val;
  else if (p.tipus === 'multi') ok = Array.isArray(val) && val.length > 0;
  else if (p.tipus === 'text') {
    // Text opcional excepte per a les preguntes d'equips, que són obligatòries
    if (p.id.startsWith('equips_')) ok = typeof val === 'string' && val.trim().length >= 3;
    else ok = true;
  }

  const esUltima = ESTAT.preguntaActual === visibles.length - 1;
  btn.innerHTML = esUltima
    ? `Envia l'enquesta ${ICONES.enviar}`
    : `Següent ${ICONES.fletxaDreta}`;
  btn.disabled = !ok;
}

/* ───────────────────────────────────────────────────────────────────
   NAVEGACIÓ
   ─────────────────────────────────────────────────────────────────── */
function seguent() {
  if (ESTAT.animant) return;
  const visibles = preguntesVisibles();
  const p = visibles[ESTAT.preguntaActual];
  if (!p) return;

  const val = ESTAT.respostes[p.id];
  let ok = false;
  if (p.tipus === 'single') ok = !!val;
  else if (p.tipus === 'multi') ok = Array.isArray(val) && val.length > 0;
  else if (p.tipus === 'text') {
    if (p.id.startsWith('equips_')) ok = typeof val === 'string' && val.trim().length >= 3;
    else ok = true;
  }
  if (!ok) {
    window.mostrarToast && window.mostrarToast('Completa aquesta pregunta', 'error');
    return;
  }

  if (ESTAT.preguntaActual >= visibles.length - 1) {
    enviarEnquesta();
    return;
  }

  ESTAT.animant = true;
  const slide = $('#enqSlide');
  if (slide) slide.classList.add('sortint');
  setTimeout(() => {
    ESTAT.preguntaActual++;
    renderPregunta(ESTAT.preguntaActual);
    ESTAT.animant = false;
  }, 240);
}

function enrere() {
  if (ESTAT.animant || ESTAT.preguntaActual === 0) return;
  ESTAT.animant = true;
  const slide = $('#enqSlide');
  if (slide) slide.classList.add('sortint');
  setTimeout(() => {
    ESTAT.preguntaActual--;
    renderPregunta(ESTAT.preguntaActual);
    ESTAT.animant = false;
  }, 240);
}

/* ───────────────────────────────────────────────────────────────────
   ENVIAR
   ─────────────────────────────────────────────────────────────────── */
async function enviarEnquesta() {
  const user = window._fbUser;
  if (!user) { window.mostrarToast && window.mostrarToast('Cal iniciar sessió', 'error'); return; }

  const btn = $('#enqSeguent');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Enviant…'; }

  const r = ESTAT.respostes;
  const cos = {
    pla: r.pla || '',
    preu: r.preu || '',
    cicle: r.cicle || '',
    funcions: Array.isArray(r.funcions) ? r.funcions : [],
    comentari: (r.comentari || '').toString().trim().slice(0, 500),
    equips_necessitats: (r.equips_necessitats || '').toString().trim().slice(0, 500),
    equips_motiu: (r.equips_motiu || '').toString().trim().slice(0, 500),
    avisar: r.avisar === '1',
    nom: user.displayName || '',
    email: user.email || '',
    data: Date.now()
  };

  try {
    const resp = await api('PUT', RUTA_RESPOSTES + '/' + encodeURIComponent(user.uid) + '.json', cos);
    if (resp.ok) {
      window.mostrarToast && window.mostrarToast('Gràcies per respondre!', 'ok');
      ESTAT.jaRespost = true;
      mostrarPantalla('fet');
      if (esAdmin) carregarAdmin();
    } else if (resp.status === 401 || resp.status === 403) {
      window.mostrarToast && window.mostrarToast('Firebase ha denegat el desat. Revisa les regles.', 'error');
      if (btn) { btn.disabled = false; actualitzarBotoSeguent(); }
    } else {
      window.mostrarToast && window.mostrarToast('No s\'ha pogut desar. Torna-ho a provar.', 'error');
      if (btn) { btn.disabled = false; actualitzarBotoSeguent(); }
    }
  } catch (e) {
    window.mostrarToast && window.mostrarToast('Error de connexió', 'error');
    if (btn) { btn.disabled = false; actualitzarBotoSeguent(); }
  }
}

/* ───────────────────────────────────────────────────────────────────
   OBERTURA / TANCAMENT
   ─────────────────────────────────────────────────────────────────── */
async function obrirEnquesta(opcions) {
  const el = cont();
  if (!el) return;

  // opcions pot ser un string (només pla) o un objecte { pla, cicle }
  let pla = null, cicle = null;
  if (typeof opcions === 'string') {
    pla = opcions;
  } else if (opcions && typeof opcions === 'object') {
    pla = opcions.pla;
    cicle = opcions.cicle;
  }

  // Preselecció del pla
  if (pla && ['entusiasta','professional','equips'].includes(pla)) {
    ESTAT.respostes.pla = pla;
    ESTAT.preseleccionat = true;
  } else {
    ESTAT.preseleccionat = false;
  }

  // Preselecció del cicle (mensual/anual)
  if (cicle && ['mensual','anual'].includes(cicle)) {
    ESTAT.respostes.cicle = cicle;
  }

  el.classList.add('modal');
  el.scrollTop = 0;
  document.body.style.overflow = 'hidden';

  if (!window._fbUser) {
    mostrarPantalla('login');
    return;
  }

  ESTAT.jaRespost = await comprovarJaRespost(window._fbUser);
  if (ESTAT.jaRespost) {
    mostrarPantalla('fet');
  } else {
    // Sempre comença per la primera pregunta visible
    ESTAT.preguntaActual = 0;
    renderPregunta(0);
    mostrarPantalla('pregunta');
  }
}

function tancarEnquesta() {
  const el = cont();
  if (!el) return;
  el.classList.remove('modal');
  document.body.style.overflow = '';
}

async function comprovarJaRespost(user) {
  try {
    const r = await api('GET', RUTA_RESPOSTES + '/' + encodeURIComponent(user.uid) + '.json');
    if (!r.ok) return false;
    const v = await r.json();
    return !!v;
  } catch (e) { return false; }
}

/* ───────────────────────────────────────────────────────────────────
   PANELL ADMIN
   ─────────────────────────────────────────────────────────────────── */
async function carregarAdmin() {
  if (!esAdmin) return;
  const user = window._fbUser;
  if (!user) return;
  try {
    const r = await api('GET', RUTA_RESPOSTES + '.json');
    if (!r.ok) return;
    const dades = await r.json();
    respostesAdmin = Object.entries(dades || {}).map(([uid, v]) => ({ uid, ...v }))
      .sort((a, b) => (b.data || 0) - (a.data || 0));
    pintarAdmin();
  } catch (e) {}
}

function comptar(camp, multi) {
  const c = {};
  respostesAdmin.forEach(r => {
    const vals = multi ? (r[camp] || []) : [r[camp]];
    vals.forEach(v => { if (v) c[v] = (c[v] || 0) + 1; });
  });
  return c;
}

function blocStats(titol, comptes, etiquetes) {
  const total = respostesAdmin.length || 1;
  return `<div class="stat-bloc"><h4>${esc(titol)}</h4>${
    Object.keys(etiquetes).map(k => {
      const n = comptes[k] || 0;
      const pct = Math.round((n / total) * 100);
      return `<div class="stat-fila"><span>${esc(etiquetes[k])}</span><div class="stat-barra"><span style="width:${pct}%"></span></div><span class="stat-n">${n}</span></div>`;
    }).join('')
  }</div>`;
}

function pintarAdmin() {
  const wrap = contAdmin();
  if (!wrap) return;
  wrap.dataset.obert = '1';
  const avisar = respostesAdmin.filter(r => r.avisar).length;
  const ambEquips = respostesAdmin.filter(r => r.pla === 'equips').length;

  wrap.innerHTML = `
    <div class="admin-inner">
      <h3>${ICONES.tauler} Panell d'administrador</h3>
      <p class="enq-nota">${respostesAdmin.length} respostes · ${avisar} volen avís per correu · ${ambEquips} interessats en Equips</p>
      <div id="enqStats">
        ${blocStats('Pla preferit', comptar('pla'), ETIQ.pla)}
        ${blocStats('Opinió dels preus', comptar('preu'), ETIQ.preu)}
        ${blocStats('Cicle de pagament', comptar('cicle'), ETIQ.cicle)}
        ${blocStats('Funcions més demanades', comptar('funcions', true), ETIQ.funcions)}
      </div>
      <div class="stat-bloc">
        <h4>Respostes</h4>
        <div class="resp-llista">
          ${respostesAdmin.length ? respostesAdmin.map(r => {
            const data = r.data ? new Date(r.data).toLocaleString('ca-ES') : '';
            const funcs = (r.funcions || []).map(f => ETIQ.funcions[f] || f).join(', ') || '—';
            const extraEquips = (r.pla === 'equips' && (r.equips_necessitats || r.equips_motiu))
              ? `<div class="com"><b>Necessitats:</b> ${esc(r.equips_necessitats || '—')}\n<b>Motiu:</b> ${esc(r.equips_motiu || '—')}</div>`
              : '';
            return `<div class="resp-item">
              <div class="qui">${esc(r.nom || 'Sense nom')} · ${esc(r.email || '')}</div>
              <div class="meta">${esc(data)}${r.avisar ? ' · vol avís' : ''}</div>
              <div>Pla: <b>${esc(ETIQ.pla[r.pla] || r.pla)}</b> · Preus: ${esc(ETIQ.preu[r.preu] || r.preu)} · Pagament: ${esc(ETIQ.cicle[r.cicle] || r.cicle)}</div>
              <div>Funcions: ${esc(funcs)}</div>
              ${extraEquips}
              ${r.comentari ? `<div class="com">${esc(r.comentari)}</div>` : ''}
            </div>`;
          }).join('') : '<div class="resp-item">Encara no hi ha respostes.</div>'}
        </div>
      </div>
      <div class="enq-admin-accions">
        <button type="button" class="enq-btn-pill" id="enqBtnCsv">${ICONES.descarregar} Descarrega CSV</button>
        <button type="button" class="enq-btn-pill" id="enqBtnRefresca">${ICONES.refrescar} Actualitza</button>
        <button type="button" class="enq-btn-pill" id="enqBtnTancaAdmin">${ICONES.tanca} Tanca</button>
      </div>
    </div>
  `;
  $('#enqBtnCsv')?.addEventListener('click', descarregarCsv);
  $('#enqBtnRefresca')?.addEventListener('click', carregarAdmin);
  $('#enqBtnTancaAdmin')?.addEventListener('click', () => { wrap.dataset.obert = '0'; });
}

function descarregarCsv() {
  const cap = ['data','nom','email','pla','preu','cicle','funcions','equips_necessitats','equips_motiu','avisar','comentari'];
  const cel = v => {
    let s = String(v == null ? '' : v).replace(/"/g, '""');
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s + '"';
  };
  const files = respostesAdmin.map(r => [
    r.data ? new Date(r.data).toISOString() : '', r.nom, r.email, r.pla, r.preu, r.cicle,
    (r.funcions || []).join('|'), r.equips_necessitats || '', r.equips_motiu || '',
    r.avisar ? 'si' : 'no', r.comentari
  ].map(cel).join(','));
  const csv = '\ufeff' + [cap.join(',')].concat(files).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'enquesta-plans.csv';
  document.body.appendChild(a); a.click(); a.remove();
}

/* ───────────────────────────────────────────────────────────────────
   LISTENERS
   ─────────────────────────────────────────────────────────────────── */
function inicialitzarListeners() {
  document.addEventListener('click', e => {
    if (e.target.closest('#enqBtnLogin')) {
      e.preventDefault();
      window._login().catch(err => {
        if (err && err.code !== 'auth/popup-closed-by-user') {
          window.mostrarToast && window.mostrarToast('No s\'ha pogut iniciar sessió', 'error');
        }
      });
    }
    if (e.target.closest('#enqTanca') || e.target.closest('#enqBtnTancarFet')) {
      tancarEnquesta();
    }
    if (e.target.closest('#enqSeguent')) { e.preventDefault(); seguent(); }
    if (e.target.closest('#enqEnrere'))  { e.preventDefault(); enrere(); }
  });

  document.addEventListener('click', e => {
    const el = cont();
    if (el && el.classList.contains('modal') && e.target === el) tancarEnquesta();
  });

  document.addEventListener('keydown', e => {
    const el = cont();
    if (e.key === 'Escape' && el && el.classList.contains('modal')) tancarEnquesta();
  });

  // Canvi d'usuari
  window.addEventListener('preus:user', async e => {
    const user = e.detail;
    pintarUsuariCapcalera();
    if (!user) {
      ESTAT.jaRespost = false;
      esAdmin = false;
      const el = cont();
      if (el && el.classList.contains('modal')) mostrarPantalla('login');
      return;
    }
    esAdmin = await comprovarAdmin();
    if (esAdmin) carregarAdmin();

    const el = cont();
    if (el && el.classList.contains('modal')) {
      const loginVisible = !$('#enqPantallaLogin')?.hidden;
      if (loginVisible) {
        ESTAT.jaRespost = await comprovarJaRespost(user);
        if (ESTAT.jaRespost) mostrarPantalla('fet');
        else { ESTAT.preguntaActual = 0; renderPregunta(0); mostrarPantalla('pregunta'); }
      } else {
        pintarUsuariCapcalera();
      }
    }
  });
}

/* ───────────────────────────────────────────────────────────────────
   INIT
   ─────────────────────────────────────────────────────────────────── */
function init() {
  renderShell();
  inicialitzarListeners();
  window.obrirEnquesta = obrirEnquesta;
  window.tancarEnquesta = tancarEnquesta;
  pintarUsuariCapcalera();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();