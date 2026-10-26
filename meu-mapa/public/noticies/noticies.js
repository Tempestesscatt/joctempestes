/**
 * noticies.js
 * Mostra el resum meteorològic de Catalunya DINS la pàgina del visor.
 *
 * - Afegeix un botó "📰 Notícies" al #dock (barra inferior existent).
 * - En clicar-lo, mostra una secció a pantalla completa amb scroll
 *   propi, integrada al visor (no és un modal flotant, no tapa res
 *   amb overlay fosc: substitueix visualment el mapa).
 * - Llegeix noticies/resum_cataluna.json (generat pel Python).
 *
 * Ús a index.html (ja el tens posat):
 *   <script defer src="noticies/noticies.js"></script>
 */
(function () {
  "use strict";

  const RUTA_JSON = "noticies/resum_cataluna.json";
  const ID_SECCIO = "noticies-catalunya";
  const ID_BOTO_DOCK = "btnNoticies";
  const LS_KEY = "tc_noticies_vist";

  const ICONES_EPISODI = {
    pluja: "🌧️", vent: "💨", neu: "❄️", fred: "🥶",
    calor: "🔥", gelada: "🧊", canvi_termic: "🌡️", altre: "⚠️",
  };
  const COLORS_GRAVETAT = { baixa: "#3fb950", mitjana: "#d29922", alta: "#f85149" };
  const ICONES_ZONA = {
    "Litoral i prelitoral": "🌊",
    "Interior": "🌾",
    "Pirineu i Prepirineu": "🏔️",
    "Camp de Tarragona i Terres de l'Ebre": "🌿",
  };

  // ---------- Utilitats ----------

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function formatData(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T12:00:00");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("ca-ES", { day: "numeric", month: "long" });
  }
  function formatDataHora(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString("ca-ES", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }
  function avuiISO() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function jaVistAvui() {
    try { return localStorage.getItem(LS_KEY) === avuiISO(); } catch (e) { return false; }
  }
  function marcarVistAvui() {
    try { localStorage.setItem(LS_KEY, avuiISO()); } catch (e) {}
  }

  // ---------- CSS ----------

  function injectarCSS() {
    if (document.getElementById("tc-noticies-styles")) return;
    const style = document.createElement("style");
    style.id = "tc-noticies-styles";
    style.textContent = `
      /* ============================================================
         SECCIÓ DE NOTÍCIES — integrada a la pàgina
         Es col·loca damunt del #map, ocupa tot l'espai del visor
         menys la barra inferior (#dock), i té el seu propi scroll.
         ============================================================ */

      #${ID_SECCIO} {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 850; /* per sobre del #map (0) i llegendes, per sota del #dock (900) */
        background: #0d1117;
        color: #c9d1d9;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        display: none;
        padding-bottom: calc(70px + var(--safe-bottom, 0px));
      }
      #${ID_SECCIO}.oberta { display: block; }

      #${ID_SECCIO}::-webkit-scrollbar { width: 8px; }
      #${ID_SECCIO}::-webkit-scrollbar-thumb {
        background: rgba(240,246,252,.15); border-radius: 4px;
      }
      #${ID_SECCIO}::-webkit-scrollbar-track { background: transparent; }

      /* Contenidor interior centrat */
      #${ID_SECCIO} .nc-wrap {
        max-width: 1080px;
        margin: 0 auto;
        padding: calc(20px + var(--safe-top, 0px)) 22px 40px;
      }

      /* Capçalera de la secció amb botó de tornar */
      #${ID_SECCIO} .nc-bar {
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px; margin-bottom: 22px;
        flex-wrap: wrap;
      }
      #${ID_SECCIO} .nc-bar-titol {
        display: flex; align-items: center; gap: 10px;
        font-size: 14px; font-weight: 700; color: #f0f6fc;
        letter-spacing: .3px;
      }
      #${ID_SECCIO} .nc-bar-titol .ico { color: #ffd700; font-size: 18px; }
      #${ID_SECCIO} .nc-boto-tornar {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 8px 14px;
        border: 1px solid rgba(240,246,252,.15);
        border-radius: 8px;
        background: #161b22;
        color: #c9d1d9;
        font: 600 12px 'Inter', system-ui, sans-serif;
        cursor: pointer;
        transition: all .15s ease;
        white-space: nowrap;
      }
      #${ID_SECCIO} .nc-boto-tornar:hover {
        background: #1c2128; border-color: rgba(240,246,252,.3); color: #f0f6fc;
      }

      /* HERO */
      #${ID_SECCIO} .nc-hero {
        padding-bottom: 18px;
        border-bottom: 1px solid rgba(240,246,252,.08);
        margin-bottom: 24px;
      }
      #${ID_SECCIO} .nc-hero-badge {
        display: inline-block;
        font-size: 10px; font-weight: 700;
        letter-spacing: .08em; text-transform: uppercase;
        color: #ffd700;
        background: rgba(255,215,0,.10);
        border: 1px solid rgba(255,215,0,.3);
        padding: 3px 10px; border-radius: 999px;
        margin-bottom: 12px;
      }
      #${ID_SECCIO} .nc-hero-titol {
        font-size: clamp(1.4rem, 3vw, 2rem);
        line-height: 1.2; margin: 0 0 12px;
        color: #f0f6fc; font-weight: 700;
      }
      #${ID_SECCIO} .nc-hero-resum {
        font-size: 15px; line-height: 1.7;
        color: #c9d1d9; margin: 0 0 10px;
      }
      #${ID_SECCIO} .nc-hero-meta {
        font-size: 12px; color: #8b949e; margin: 0;
      }
      #${ID_SECCIO} .nc-hero-meta strong { color: #c9d1d9; font-weight: 600; }

      /* Seccions */
      #${ID_SECCIO} .nc-sec { margin-bottom: 28px; }
      #${ID_SECCIO} .nc-sec-titol {
        font-size: 11px; font-weight: 700;
        text-transform: uppercase; letter-spacing: .08em;
        color: #8b949e; margin: 0 0 14px;
        display: flex; align-items: center; gap: 8px;
      }
      #${ID_SECCIO} .nc-sec-titol::before {
        content: ''; width: 3px; height: 14px;
        background: #58a6ff; border-radius: 2px;
      }

      /* Grid */
      #${ID_SECCIO} .nc-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 14px;
      }
      #${ID_SECCIO} .nc-card {
        background: #161b22;
        border: 1px solid rgba(240,246,252,.08);
        border-radius: 10px;
        padding: 16px 18px;
        transition: transform .15s ease, border-color .15s ease;
      }
      #${ID_SECCIO} .nc-card:hover {
        border-color: rgba(240,246,252,.18);
        transform: translateY(-1px);
      }
      #${ID_SECCIO} .nc-card.incert {
        background: linear-gradient(180deg, rgba(210,153,34,.06), #161b22);
        border-color: rgba(210,153,34,.3);
      }
      #${ID_SECCIO} .nc-card-cap {
        display: flex; align-items: center; gap: 8px;
        font-size: 12.5px; font-weight: 700;
        color: #f0f6fc; margin-bottom: 10px;
      }
      #${ID_SECCIO} .nc-card-cap .tag {
        font-size: 9px; text-transform: uppercase; letter-spacing: .06em;
        background: rgba(210,153,34,.15); color: #d29922;
        padding: 2px 7px; border-radius: 999px; font-weight: 700;
        margin-left: auto;
      }
      #${ID_SECCIO} .nc-card-text {
        font-size: 13.5px; line-height: 1.65;
        color: #c9d1d9; margin: 0 0 8px;
      }
      #${ID_SECCIO} .nc-card-line {
        font-size: 13px; line-height: 1.6;
        color: #8b949e; margin: 5px 0;
      }
      #${ID_SECCIO} .nc-card-line strong { color: #c9d1d9; font-weight: 600; }

      /* Zones */
      #${ID_SECCIO} .nc-zona-cap {
        display: flex; align-items: center; gap: 10px;
        margin-bottom: 10px;
      }
      #${ID_SECCIO} .nc-zona-ico { font-size: 22px; line-height: 1; }
      #${ID_SECCIO} .nc-zona-nom { font-size: 14px; font-weight: 700; color: #f0f6fc; }
      #${ID_SECCIO} .nc-destacats {
        margin: 12px 0 0; padding: 12px 0 0;
        border-top: 1px dashed rgba(240,246,252,.1);
        list-style: none;
      }
      #${ID_SECCIO} .nc-destacats li {
        font-size: 12.5px; line-height: 1.55;
        color: #8b949e; padding: 3px 0;
      }
      #${ID_SECCIO} .nc-destacats li strong { color: #c9d1d9; font-weight: 600; }

      /* Episodis */
      #${ID_SECCIO} .nc-episodis { display: grid; gap: 12px; }
      #${ID_SECCIO} .nc-episodi {
        background: #161b22;
        border: 1px solid rgba(240,246,252,.08);
        border-left: 3px solid #58a6ff;
        border-radius: 10px;
        padding: 14px 16px;
      }
      #${ID_SECCIO} .nc-episodi-cap {
        display: flex; align-items: center; gap: 9px;
        flex-wrap: wrap; margin-bottom: 6px;
      }
      #${ID_SECCIO} .nc-episodi-ico { font-size: 17px; line-height: 1; }
      #${ID_SECCIO} .nc-episodi-tipus {
        font-size: 13px; font-weight: 700; color: #f0f6fc; text-transform: capitalize;
      }
      #${ID_SECCIO} .nc-episodi-grav {
        font-size: 9.5px; font-weight: 800; letter-spacing: .06em;
        text-transform: uppercase;
        padding: 2px 9px; border-radius: 999px;
        border: 1px solid; margin-left: auto;
      }
      #${ID_SECCIO} .nc-episodi-meta {
        font-size: 12px; color: #8b949e; margin-bottom: 8px;
      }
      #${ID_SECCIO} .nc-episodi-valor {
        display: inline-block;
        font-size: 12px; font-weight: 700; color: #f0f6fc;
        background: rgba(240,246,252,.06);
        padding: 3px 9px; border-radius: 6px;
        margin-bottom: 8px;
      }
      #${ID_SECCIO} .nc-episodi-desc {
        font-size: 13px; line-height: 1.6; color: #c9d1d9; margin: 0;
      }
      #${ID_SECCIO} .nc-buit {
        color: #8b949e; font-style: italic; font-size: 13px;
      }

      /* Avís */
      #${ID_SECCIO} .nc-avis {
        margin-top: 22px;
        background: linear-gradient(135deg, rgba(210,153,34,.12), rgba(210,153,34,.05));
        border: 1px solid rgba(210,153,34,.35);
        color: #d29922;
        padding: 14px 16px;
        border-radius: 10px;
        font-size: 13px; line-height: 1.6;
      }
      #${ID_SECCIO} .nc-avis strong { color: #ffd700; }

      /* Estats */
      #${ID_SECCIO} .nc-error {
        color: #f85149;
        background: rgba(248,81,73,.08);
        border: 1px solid rgba(248,81,73,.3);
        padding: 16px 18px; border-radius: 10px;
        font-size: 13px; line-height: 1.5;
      }
      #${ID_SECCIO} .nc-loading {
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 14px; padding: 60px 20px;
        color: #8b949e; font-size: 13px;
      }
      #${ID_SECCIO} .nc-spinner {
        width: 32px; height: 32px;
        border: 2px solid rgba(240,246,252,.15);
        border-top-color: #58a6ff;
        border-radius: 50%;
        animation: ncGira .9s linear infinite;
      }
      @keyframes ncGira { to { transform: rotate(360deg); } }

      /* Botó dins del #dock */
      #${ID_BOTO_DOCK} { position: relative; }
      #${ID_BOTO_DOCK} .nc-badge {
        position: absolute; top: -4px; right: -4px;
        background: #f85149; color: #fff;
        font-size: 8.5px; font-weight: 800;
        min-width: 14px; height: 14px; padding: 0 3px;
        border-radius: 7px;
        display: inline-flex; align-items: center; justify-content: center;
        box-shadow: 0 0 6px rgba(248,81,73,.7);
      }
      #${ID_BOTO_DOCK}.actiu {
        background: var(--accent-soft, rgba(88,166,255,0.12)) !important;
        color: var(--accent, #58a6ff) !important;
        border-color: rgba(88,166,255,0.4) !important;
      }

      /* Responsive */
      @media (max-width: 860px) {
        #${ID_SECCIO} .nc-wrap { padding: 14px 14px 40px; }
        #${ID_SECCIO} .nc-hero-titol { font-size: 1.35rem; }
        #${ID_SECCIO} .nc-hero-resum { font-size: 14px; }
      }
      @media (max-width: 500px) {
        #${ID_SECCIO} .nc-grid { grid-template-columns: 1fr; }
      }

      @media (prefers-reduced-motion: reduce) {
        #${ID_SECCIO} .nc-card { transition: none !important; }
        #${ID_SECCIO} .nc-spinner { animation: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  // ---------- Crear secció buida ----------

  function crearSeccio() {
    if (document.getElementById(ID_SECCIO)) return;
    const sec = document.createElement("section");
    sec.id = ID_SECCIO;
    sec.setAttribute("aria-label", "Notícies meteorològiques de Catalunya");
    // La inserim just després del #map perquè quedi al flux del visor,
    // tot i que amb position:fixed el lloc exacte no importa gaire.
    const map = document.getElementById("map");
    if (map && map.parentNode) map.parentNode.insertBefore(sec, map.nextSibling);
    else document.body.appendChild(sec);
  }

  // ---------- Botó dins del #dock ----------

  function crearBotoDock() {
    if (document.getElementById(ID_BOTO_DOCK)) return;
    const dock = document.getElementById("dock-extra");
    if (!dock) {
      // Si encara no hi ha el dock, reintenta
      setTimeout(crearBotoDock, 300);
      return;
    }
    const b = document.createElement("button");
    b.id = ID_BOTO_DOCK;
    b.type = "button";
    b.title = "Veure notícies del temps";
    b.innerHTML = `<i class="fa-solid fa-newspaper"></i> Notícies<span class="nc-badge" style="display:none">1</span>`;
    b.addEventListener("click", obrir);
    dock.appendChild(b);
  }

  // ---------- Obrir / tancar ----------

  let carregat = false;

  function obrir() {
    injectarCSS();
    crearSeccio();
    const sec = document.getElementById(ID_SECCIO);
    sec.classList.add("oberta");
    sec.scrollTop = 0;

    // Botó actiu
    const boto = document.getElementById(ID_BOTO_DOCK);
    if (boto) {
      boto.classList.add("actiu");
      const badge = boto.querySelector(".nc-badge");
      if (badge) badge.style.display = "none";
    }
    marcarVistAvui();

    // Amagar llegendes i dock extra si cal (opcional: les deixem)
    // Posar el body en mode "noticies" per si vols estilitzar-ho
    document.body.classList.add("noticies-obertes");

    if (!carregat) carregarContingut();
  }

  function tancar() {
    const sec = document.getElementById(ID_SECCIO);
    if (sec) sec.classList.remove("oberta");
    const boto = document.getElementById(ID_BOTO_DOCK);
    if (boto) boto.classList.remove("actiu");
    document.body.classList.remove("noticies-obertes");
  }

  // Escape tanca
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById(ID_SECCIO)?.classList.contains("oberta")) {
      tancar();
    }
  });

  // ---------- Carregar contingut ----------

  async function carregarContingut() {
    const sec = document.getElementById(ID_SECCIO);
    sec.innerHTML = `<div class="nc-wrap"><div class="nc-loading"><div class="nc-spinner"></div><div>Carregant resum…</div></div></div>`;
    try {
      const r = await fetch(RUTA_JSON, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status} en carregar ${RUTA_JSON}`);
      const dades = await r.json();
      sec.innerHTML = "";
      sec.appendChild(renderContingut(dades));
      carregat = true;
    } catch (err) {
      console.error("[noticies.js]", err);
      sec.innerHTML = `<div class="nc-wrap"><div class="nc-error"><strong>No s'ha pogut carregar el resum.</strong><br>${esc(err.message || String(err))}</div></div>`;
    }
  }

  // ---------- Render ----------

  function renderContingut(dades) {
    const wrap = document.createElement("div");
    wrap.className = "nc-wrap";

    // Barra superior amb botó "Tornar al mapa"
    const bar = document.createElement("div");
    bar.className = "nc-bar";
    bar.innerHTML = `
      <div class="nc-bar-titol">
        <span class="ico">📰</span>
        <span>Resum meteorològic · Catalunya</span>
      </div>
      <button class="nc-boto-tornar" type="button">
        ← Tornar al mapa
      </button>
    `;
    bar.querySelector(".nc-boto-tornar").addEventListener("click", tancar);
    wrap.appendChild(bar);

    const r = dades.resum || {};
    const peri = dades.periode || {};

    // HERO
    const hero = document.createElement("div");
    hero.className = "nc-hero";
    hero.innerHTML = `
      <div class="nc-hero-badge">Previsió a 16 dies · GFS</div>
      <h2 class="nc-hero-titol">${esc(r.titol || "Resum meteorològic de Catalunya")}</h2>
      <p class="nc-hero-resum">${esc(r.resum_general || "")}</p>
      <p class="nc-hero-meta">
        ${peri.inici ? `Del <strong>${formatData(peri.inici)}</strong> al <strong>${formatData(peri.fi)}</strong>` : ""}
        · Font: <strong>${esc(dades.font_dades || "GFS")}</strong>
        · Generat el <strong>${formatDataHora(dades.generat)}</strong>
      </p>
    `;
    wrap.appendChild(hero);

    // SETMANES
    if (r.setmana_1 || r.setmana_2) {
      const s = document.createElement("section");
      s.className = "nc-sec";
      s.innerHTML = `<h3 class="nc-sec-titol">Evolució per setmanes</h3>`;
      const g = document.createElement("div");
      g.className = "nc-grid";

      if (r.setmana_1) {
        const c = r.setmana_1;
        const card = document.createElement("article");
        card.className = "nc-card";
        card.innerHTML = `
          <div class="nc-card-cap">Setmana 1</div>
          <p class="nc-card-text">${esc(c.resum || "")}</p>
          ${c.temperatures ? `<p class="nc-card-line"><strong>Temperatures:</strong> ${esc(c.temperatures)}</p>` : ""}
          ${c.precipitacio ? `<p class="nc-card-line"><strong>Precipitació:</strong> ${esc(c.precipitacio)}</p>` : ""}
          ${c.vent ? `<p class="nc-card-line"><strong>Vent:</strong> ${esc(c.vent)}</p>` : ""}
        `;
        g.appendChild(card);
      }
      if (r.setmana_2) {
        const c = r.setmana_2;
        const card = document.createElement("article");
        card.className = "nc-card incert";
        card.innerHTML = `
          <div class="nc-card-cap">Setmana 2 <span class="tag">incertesa</span></div>
          <p class="nc-card-text">${esc(c.resum || "")}</p>
          ${c.incertesa ? `<p class="nc-card-line"><strong>Incertesa:</strong> ${esc(c.incertesa)}</p>` : ""}
        `;
        g.appendChild(card);
      }
      s.appendChild(g);
      wrap.appendChild(s);
    }

    // ZONES
    if (Array.isArray(r.zones) && r.zones.length) {
      const s = document.createElement("section");
      s.className = "nc-sec";
      s.innerHTML = `<h3 class="nc-sec-titol">Per zones</h3>`;
      const g = document.createElement("div");
      g.className = "nc-grid";
      for (const z of r.zones) {
        const ico = ICONES_ZONA[z.zona] || "📍";
        const card = document.createElement("article");
        card.className = "nc-card";
        let html = `
          <div class="nc-zona-cap">
            <span class="nc-zona-ico">${ico}</span>
            <span class="nc-zona-nom">${esc(z.zona)}</span>
          </div>
          <p class="nc-card-text">${esc(z.resum || "")}</p>
        `;
        if (Array.isArray(z.destacats) && z.destacats.length) {
          html += `<ul class="nc-destacats">`;
          for (const d of z.destacats) {
            html += `<li><strong>${esc(d.comarca)}</strong> · ${esc(d.municipi)}${d.motiu ? " — " + esc(d.motiu) : ""}</li>`;
          }
          html += `</ul>`;
        }
        card.innerHTML = html;
        g.appendChild(card);
      }
      s.appendChild(g);
      wrap.appendChild(s);
    }

    // EPISODIS
    if (Array.isArray(r.episodis) && r.episodis.length) {
      const s = document.createElement("section");
      s.className = "nc-sec";
      s.innerHTML = `<h3 class="nc-sec-titol">Episodis destacats</h3>`;
      const cont = document.createElement("div");
      cont.className = "nc-episodis";
      for (const e of r.episodis) {
        const ico = ICONES_EPISODI[e.tipus] || "⚠️";
        const color = COLORS_GRAVETAT[e.gravetat] || "#8b949e";
        const dates =
          e.data_inici && e.data_fi
            ? e.data_inici === e.data_fi
              ? formatData(e.data_inici)
              : `${formatData(e.data_inici)} → ${formatData(e.data_fi)}`
            : "";
        const lloc = [e.comarca, e.municipi].filter(Boolean).join(" · ");
        const item = document.createElement("article");
        item.className = "nc-episodi";
        item.style.borderLeftColor = color;
        item.innerHTML = `
          <div class="nc-episodi-cap">
            <span class="nc-episodi-ico">${ico}</span>
            <span class="nc-episodi-tipus">${esc(e.tipus || "altre")}</span>
            <span class="nc-episodi-grav" style="color:${color};border-color:${color}77;background:${color}1a">
              ${esc(e.gravetat || "baixa")}
            </span>
          </div>
          <div class="nc-episodi-meta">${esc(dates)}${lloc ? " · " + esc(lloc) : ""}</div>
          ${e.valor ? `<div class="nc-episodi-valor">${esc(e.valor)}</div>` : ""}
          <p class="nc-episodi-desc">${esc(e.descripcio || "")}</p>
        `;
        cont.appendChild(item);
      }
      s.appendChild(cont);
      wrap.appendChild(s);
    }

    // AVÍS
    if (r.avis_incertesa) {
      const a = document.createElement("div");
      a.className = "nc-avis";
      a.innerHTML = `⚠️ <strong>Nota:</strong> ${esc(r.avis_incertesa)}`;
      wrap.appendChild(a);
    }

    return wrap;
  }

  // ---------- Inici ----------

  async function iniciar() {
    injectarCSS();
    crearSeccio();
    crearBotoDock();

    // Comprova que existeix el JSON
    let existeix = false;
    try {
      const r = await fetch(RUTA_JSON, { method: "HEAD", cache: "no-store" });
      existeix = r.ok;
    } catch (e) { existeix = false; }
    if (!existeix) return;

    // Badge si no s'ha vist avui
    if (!jaVistAvui()) {
      const boto = document.getElementById(ID_BOTO_DOCK);
      if (boto) {
        const badge = boto.querySelector(".nc-badge");
        if (badge) badge.style.display = "inline-flex";
      }
      // Obre automàticament un cop el visor acabi de carregar
      setTimeout(() => {
        const sec = document.getElementById(ID_SECCIO);
        if (sec && !sec.classList.contains("oberta")) obrir();
      }, 1500);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();