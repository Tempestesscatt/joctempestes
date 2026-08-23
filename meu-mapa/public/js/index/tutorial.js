// js/tutorial.js
// Tutorial complet per a TEMPESTES.CAT - Versió 5.0
// Amb targetes verticals i imatges grans

function carregarTutorial() {
    const container = document.getElementById('tutorialGrid');
    if (!container) return;

    // Afegir estils dinàmics per a les animacions
    if (!document.getElementById('tutorialStyles')) {
        const style = document.createElement('style');
        style.id = 'tutorialStyles';
        style.textContent = `
            /* ===== CONTENIDOR ===== */
            .tutorial-wrapper {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 24px;
            }

            /* ===== TARGETA VERTICAL ===== */
            .tutorial-card {
                background: linear-gradient(145deg, #ffffff, #f8f9fc);
                border-radius: 16px;
                padding: 0 0 18px 0;
                border: 1px solid rgba(0,0,0,0.04);
                box-shadow: 0 4px 16px rgba(0,0,0,0.04);
                transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                overflow: hidden;
                cursor: default;
                opacity: 0;
                transform: translateY(30px);
                animation: fadeInUp 0.6s ease forwards;
                display: flex;
                flex-direction: column;
            }
            .tutorial-card:nth-child(1) { animation-delay: 0.05s; }
            .tutorial-card:nth-child(2) { animation-delay: 0.10s; }
            .tutorial-card:nth-child(3) { animation-delay: 0.15s; }
            .tutorial-card:nth-child(4) { animation-delay: 0.20s; }
            .tutorial-card:nth-child(5) { animation-delay: 0.25s; }
            .tutorial-card:nth-child(6) { animation-delay: 0.30s; }
            .tutorial-card:nth-child(7) { animation-delay: 0.35s; }
            .tutorial-card:nth-child(8) { animation-delay: 0.40s; }
            .tutorial-card:nth-child(9) { animation-delay: 0.45s; }
            .tutorial-card:nth-child(10) { animation-delay: 0.50s; }

            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(30px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .tutorial-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, #0058EE, #FFD700);
                opacity: 0;
                transition: opacity 0.4s ease;
            }
            .tutorial-card:hover::before { opacity: 1; }
            .tutorial-card:hover {
                transform: translateY(-6px);
                box-shadow: 0 12px 40px rgba(0, 88, 238, 0.12);
                border-color: rgba(0, 88, 238, 0.15);
            }

            /* ===== IMATGE - OCUPA TOT L'AMPLE ===== */
            .tutorial-card .card-image {
                width: 100%;
                height: 200px;
                border-radius: 16px 16px 0 0;
                overflow: hidden;
                background: linear-gradient(135deg, #e8edf8, #dce3f0);
                flex-shrink: 0;
                position: relative;
            }
            .tutorial-card .card-image img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
                transition: transform 0.4s ease;
            }
            .tutorial-card:hover .card-image img {
                transform: scale(1.05);
            }
            .tutorial-card .card-image .image-fallback {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 100%;
                color: #8899bb;
                font-size: 14px;
                font-weight: 600;
                background: linear-gradient(135deg, #e8edf8, #dce3f0);
                gap: 8px;
            }
            .tutorial-card .card-image .image-fallback i {
                font-size: 40px;
                color: #aabbcc;
            }

            /* ===== COS DE LA TARGETA ===== */
            .tutorial-card .card-body {
                padding: 16px 18px 0 18px;
                display: flex;
                flex-direction: column;
                flex: 1;
            }

            .tutorial-card .card-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 44px;
                height: 44px;
                border-radius: 12px;
                background: linear-gradient(135deg, #e8edf8, #dce3f0);
                color: #0058EE;
                font-size: 18px;
                margin-bottom: 10px;
                transition: all 0.35s ease;
                flex-shrink: 0;
                margin-top: -22px;
                position: relative;
                z-index: 2;
                border: 2px solid #ffffff;
                box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            }
            .tutorial-card:hover .card-icon {
                background: linear-gradient(135deg, #0058EE, #003399);
                color: #FFD700;
                transform: scale(1.05) rotate(-3deg);
                box-shadow: 0 4px 16px rgba(0, 88, 238, 0.25);
            }

            .tutorial-card .card-number {
                position: absolute;
                top: 14px;
                right: 16px;
                font-size: 12px;
                font-weight: 800;
                color: rgba(255,255,255,0.6);
                letter-spacing: 0.5px;
                font-family: 'Segoe UI', 'Tahoma', sans-serif;
                background: rgba(0,0,0,0.3);
                backdrop-filter: blur(4px);
                padding: 2px 12px;
                border-radius: 20px;
                transition: color 0.3s ease;
                z-index: 3;
            }
            .tutorial-card:hover .card-number {
                color: rgba(255,255,255,0.9);
                background: rgba(0,0,0,0.4);
            }

            .tutorial-card h4 {
                font-size: 16px;
                font-weight: 700;
                color: #1a2a40;
                margin: 0 0 6px 0;
            }
            .tutorial-card p {
                font-size: 13.5px;
                color: #4a5a6e;
                line-height: 1.6;
                margin: 0 0 12px 0;
                flex: 1;
            }
            .tutorial-card .card-tag {
                display: inline-block;
                font-size: 10px;
                font-weight: 600;
                color: #0058EE;
                background: rgba(0, 88, 238, 0.08);
                padding: 3px 14px;
                border-radius: 20px;
                letter-spacing: 0.3px;
                transition: all 0.3s ease;
                align-self: flex-start;
                margin-bottom: 4px;
            }
            .tutorial-card:hover .card-tag {
                background: rgba(0, 88, 238, 0.15);
                color: #003399;
            }

            /* ===== TÍTOLS DE SECCIÓ ===== */
            .tutorial-section-title {
                grid-column: 1 / -1;
                font-size: 20px;
                font-weight: 800;
                color: #1a2a40;
                padding: 24px 0 10px;
                border-bottom: 2px solid rgba(0, 88, 238, 0.1);
                display: flex;
                align-items: center;
                gap: 14px;
                opacity: 0;
                animation: fadeInUp 0.6s ease forwards;
            }
            .tutorial-section-title:nth-of-type(1) { animation-delay: 0.02s; }
            .tutorial-section-title:nth-of-type(2) { animation-delay: 0.22s; }
            .tutorial-section-title:nth-of-type(3) { animation-delay: 0.42s; }
            .tutorial-section-title i {
                color: #0058EE;
                font-size: 22px;
            }

            /* ===== PEU DE PÀGINA ===== */
            .tutorial-footer {
                grid-column: 1 / -1;
                text-align: center;
                padding: 24px 0 8px;
                font-size: 14px;
                color: #8899bb;
                border-top: 1px solid rgba(0,0,0,0.04);
                margin-top: 8px;
                opacity: 0;
                animation: fadeInUp 0.6s ease 0.8s forwards;
            }
            .tutorial-footer i {
                color: #FFD700;
                margin: 0 6px;
            }
            .tutorial-footer strong {
                color: #1a2a40;
                font-weight: 700;
            }

            /* ===== RESPONSIVE ===== */
            @media (max-width: 1024px) {
                .tutorial-wrapper { 
                    grid-template-columns: repeat(2, 1fr);
                    gap: 20px;
                }
                .tutorial-card .card-image {
                    height: 200px;
                }
            }
            @media (max-width: 768px) {
                .tutorial-wrapper { 
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                }
                .tutorial-card .card-image { 
                    height: 180px; 
                }
                .tutorial-card .card-body {
                    padding: 14px 16px 0 16px;
                }
                .tutorial-card .card-icon { 
                    width: 40px; 
                    height: 40px; 
                    font-size: 16px; 
                    margin-top: -20px;
                }
                .tutorial-card h4 { 
                    font-size: 15px; 
                }
                .tutorial-card p { 
                    font-size: 13px; 
                }
                .tutorial-section-title { 
                    font-size: 18px; 
                }
            }
            @media (max-width: 480px) {
                .tutorial-wrapper { 
                    grid-template-columns: 1fr;
                    gap: 14px;
                }
                .tutorial-card .card-image { 
                    height: 200px; 
                }
                .tutorial-card .card-body {
                    padding: 14px 16px 0 16px;
                }
                .tutorial-card .card-icon { 
                    width: 40px; 
                    height: 40px; 
                    font-size: 16px; 
                    margin-top: -20px;
                }
                .tutorial-card h4 { 
                    font-size: 16px; 
                }
                .tutorial-card p { 
                    font-size: 13.5px; 
                }
                .tutorial-section-title { 
                    font-size: 17px; 
                    padding: 18px 0 8px;
                }
                .tutorial-footer {
                    font-size: 13px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Definir les imatges PNG
    const IMAGES = {
        visor: 'img/visor.png',
        navegacio: 'img/navegacio.png',
        parametres: 'img/parametres.png',
        interaccio: 'img/interaccio.png',
        skewt: 'img/skewt.png',
        vent: 'img/vent.png',
        conveccio: 'img/conveccio.png',
        animacio: 'img/animacio.png',
        radar: 'img/radar.png',
        alertes: 'img/alertes.png'
    };

    // Funció per generar l'HTML d'una targeta amb imatge
    function cardHTML(num, icon, title, desc, tag, imgKey, imgAlt) {
        const imgUrl = IMAGES[imgKey] || '';
        return `
            <div class="tutorial-card">
                <div class="card-number">${String(num).padStart(2, '0')}</div>
                <div class="card-image">
                    ${imgUrl ? `<img src="${imgUrl}" alt="${imgAlt || title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'image-fallback\\'><i class=\\'fa-regular fa-image\\'></i><span>${imgAlt || title}</span></div>'">` : `<div class="image-fallback"><i class="fa-regular fa-image"></i><span>${imgAlt || title}</span></div>`}
                </div>
                <div class="card-body">
                    <div class="card-icon"><i class="${icon}"></i></div>
                    <h4>${title}</h4>
                    <p>${desc}</p>
                    <span class="card-tag">${tag}</span>
                </div>
            </div>
        `;
    }

    // Secció 1: Com funciona el visor de mapes
    const tutorialsBase = [
        {
            num: 1,
            icon: 'fa-solid fa-map',
            title: 'Visor de mapes',
            desc: 'El visor mostra dades del model AROME en alta resolució (1,3 km). Cada punt del mapa té una previsió per a les properes 51 hores.',
            tag: 'Base',
            img: 'visor',
            alt: 'Visor de mapes AROME'
        },
        {
            num: 2,
            icon: 'fa-solid fa-clock',
            title: 'Navegació per hores',
            desc: 'Utilitza les fletxes per avançar o retrocedir en el temps. El control lliscant et permet saltar ràpidament entre les 51 hores de previsió.',
            tag: 'Base',
            img: 'navegacio',
            alt: 'Navegació per hores'
        },
        {
            num: 3,
            icon: 'fa-solid fa-sliders',
            title: 'Panell de paràmetres',
            desc: 'Al panell esquerre pots seleccionar quina variable meteorològica vols veure: temperatura, precipitació, vent, humitat, CAPE, neu, pressió i moltes més.',
            tag: 'Base',
            img: 'parametres',
            alt: 'Panell de paràmetres'
        },
        {
            num: 4,
            icon: 'fa-solid fa-hand-pointer',
            title: 'Interacció amb el mapa',
            desc: 'Fes clic a qualsevol punt del mapa per veure el valor exacte de la variable seleccionada. També pots arrossegar per moure\'t i fer zoom amb la roda.',
            tag: 'Base',
            img: 'interaccio',
            alt: 'Interacció amb el mapa'
        }
    ];

    // Secció 2: Eines avançades
    const tutorialsAvancat = [
        {
            num: 5,
            icon: 'fa-solid fa-chart-line',
            title: 'Skew-T (clic dret)',
            desc: 'Fes clic dret a qualsevol punt del mapa i selecciona "Obrir Skew-T". Obtindràs un diagrama termodinàmic amb la temperatura, humitat atmosfèrica fins a 100hpa / 15 km d\'altura.',
            tag: 'Avançat',
            img: 'skewt',
            alt: 'Diagrama Skew-T'
        },
        {
            num: 6,
            icon: 'fa-solid fa-wind',
            title: 'Mode vent i streamlines',
            desc: 'Activa el mode vent per veure la direcció i intensitat del vent. El botó "Streamlines" mostra les línies de corrent del vent, ideal per entendre la circulació atmosfèrica.',
            tag: 'Avançat',
            img: 'vent',
            alt: 'Mode vent'
        },
        {
            num: 7,
            icon: 'fa-solid fa-cloud-bolt',
            title: 'Paràmetres de convecció',
            desc: 'Variables com CAPE, CIN, LCL i LFC t\'ajuden a identificar zones de tempestes. Els valors alts de CAPE indiquen inestabilitat i possibilitat de tempestes fortes.',
            tag: 'Avançat',
            img: 'conveccio',
            alt: 'Paràmetres de convecció'
        },
        {
            num: 8,
            icon: 'fa-solid fa-play-circle',
            title: 'Animació de mapes',
            desc: 'Prem el botó d\'animació per reproduir automàticament les 51 hores de previsió. Ideal per veure l\'evolució de les tempestes, fronts i sistemes meteorològics.',
            tag: 'Avançat',
            img: 'animacio',
            alt: 'Animació de mapes'
        }
    ];

    // Secció 3: Eines addicionals
    const tutorialsExtra = [
        {
            num: 9,
            icon: 'fa-solid fa-satellite-dish',
            title: 'Radar en temps real',
            desc: 'Accedeix al radar meteorològic des del botó superior. Veuràs la reflectivitat en temps real de la península amb actualitzacions cada 10 minuts.',
            tag: 'Extra',
            img: 'radar',
            alt: 'Radar en temps real'
        },
        {
            num: 10,
            icon: 'fa-solid fa-triangle-exclamation',
            title: 'Avisos i alertes',
            desc: 'A la pàgina principal trobaràs els avisos actius amb imatges PNG. Mantingues-te informat sobre fenòmens extrems, pluges, vent, neu i tempestes.',
            tag: 'Extra',
            img: 'alertes',
            alt: 'Avisos i alertes'
        }
    ];

    // Muntar HTML
    let html = '<div class="tutorial-wrapper">';

    // Secció 1
    html += `
        <div class="tutorial-section-title">
            <i class="fa-solid fa-compass"></i> Navega pel visor de mapes
        </div>
    `;
    tutorialsBase.forEach(t => {
        html += cardHTML(t.num, t.icon, t.title, t.desc, t.tag, t.img, t.alt);
    });

    // Secció 2
    html += `
        <div class="tutorial-section-title">
            <i class="fa-solid fa-star"></i> Eines avançades
        </div>
    `;
    tutorialsAvancat.forEach(t => {
        html += cardHTML(t.num, t.icon, t.title, t.desc, t.tag, t.img, t.alt);
    });

    // Secció 3
    html += `
        <div class="tutorial-section-title">
            <i class="fa-solid fa-circle-plus"></i> Funcionalitats extra
        </div>
    `;
    tutorialsExtra.forEach(t => {
        html += cardHTML(t.num, t.icon, t.title, t.desc, t.tag, t.img, t.alt);
    });

    // Peu de pàgina
    html += `
        <div class="tutorial-footer">
            <i class="fa-solid fa-cloud-sun"></i>
            <strong>TEMPESTES.CAT</strong> · Meteorologia professional · Dades AROME 1.3 km
            <i class="fa-solid fa-cloud-bolt"></i>
        </div>
    `;

    html += '</div>';
    container.innerHTML = html;
}

// Auto-carregar si el DOM està llest
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', carregarTutorial);
} else {
    carregarTutorial();
}