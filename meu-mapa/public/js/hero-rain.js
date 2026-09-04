/* ============================================================
   SCROLL RAIN EFFECT — TEMPESTES.CAT
   Efecte de gotes de pluja + llamps ocasionals que cobreix
   TOTA LA PANTALLA quan es fa scroll ràpid, sigui on sigui
   de la pàgina (no limitat a la capçalera).
   No requereix tocar el HTML: aquest script crea els divs
   necessaris dinàmicament i injecta el CSS que li cal.
   ============================================================ */
(function () {
    'use strict';

    function init() {
        // ------------------------------------------------------
        // 1. Injectar el CSS necessari (una sola vegada)
        // ------------------------------------------------------
        if (!document.getElementById('scroll-rain-styles')) {
            const style = document.createElement('style');
            style.id = 'scroll-rain-styles';
            style.textContent = `
                #scrollRainRoot {
                    position: fixed;
                    inset: 0;
                    z-index: 99990;
                    pointer-events: none;
                    overflow: hidden;
                }
                .scroll-rain-overlay {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                    opacity: 0;
                    transition: opacity 0.6s ease;
                }
                .scroll-rain-overlay.active {
                    opacity: 1;
                }
                .rain-drop {
                    position: absolute;
                    width: 3px;
                    background: linear-gradient(to bottom, rgba(120,160,220,0), rgba(80,130,200,0.55) 40%, rgba(50,100,180,0.85));
                    border-radius: 0 0 50% 50%;
                    filter: blur(0.3px);
                    animation-name: scrollDropFall;
                    animation-timing-function: cubic-bezier(0.55, 0.06, 0.68, 0.19);
                    animation-fill-mode: forwards;
                }
                .rain-drop::after {
                    content: '';
                    position: absolute;
                    left: 50%;
                    bottom: -2px;
                    width: 5px;
                    height: 5px;
                    background: rgba(70,120,190,0.5);
                    border-radius: 50%;
                    transform: translateX(-50%);
                    filter: blur(0.4px);
                }
                .rain-drop.trail {
                    background: linear-gradient(to bottom, rgba(120,160,220,0), rgba(80,130,200,0.22));
                    width: 1.5px;
                }
                @keyframes scrollDropFall {
                    0% { transform: translateY(0) scaleY(0.4); opacity: 0; }
                    8% { opacity: 1; }
                    85% { opacity: 0.9; }
                    100% { transform: translateY(var(--fall-distance, 500px)) scaleY(1.1); opacity: 0; }
                }
                .scroll-fog-layer {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at 30% 15%, rgba(120,150,200,0.05), transparent 55%),
                                radial-gradient(circle at 75% 55%, rgba(120,150,200,0.04), transparent 50%);
                    backdrop-filter: blur(0px);
                    opacity: 0;
                    transition: opacity 0.8s ease, backdrop-filter 0.8s ease;
                }
                .scroll-fog-layer.active {
                    opacity: 1;
                    backdrop-filter: blur(1px);
                }
                .scroll-lightning-flash {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at var(--flash-x, 50%) var(--flash-y, 30%), rgba(200,220,255,0.85), rgba(180,200,255,0.4) 55%, rgba(180,200,255,0) 80%);
                    opacity: 0;
                    mix-blend-mode: multiply;
                }
                .scroll-lightning-flash.flash-1 {
                    animation: scrollLightningFlash1 0.5s ease-out forwards;
                }
                .scroll-lightning-flash.flash-2 {
                    animation: scrollLightningFlash2 0.7s ease-out forwards;
                }
                @keyframes scrollLightningFlash1 {
                    0%   { opacity: 0; }
                    6%   { opacity: 0.55; }
                    14%  { opacity: 0.08; }
                    22%  { opacity: 0.45; }
                    35%  { opacity: 0; }
                    100% { opacity: 0; }
                }
                @keyframes scrollLightningFlash2 {
                    0%   { opacity: 0; }
                    5%   { opacity: 0.5; }
                    12%  { opacity: 0.05; }
                    18%  { opacity: 0.35; }
                    28%  { opacity: 0; }
                    40%  { opacity: 0.2; }
                    55%  { opacity: 0; }
                    100% { opacity: 0; }
                }
                @media (max-width: 600px) {
                    .rain-drop { width: 2px; }
                }
                #altitudeLabel {
                    position: fixed;
                    left: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    z-index: 1;
                    pointer-events: none;
                    font-family: 'Inter', -apple-system, system-ui, sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 2px;
                    opacity: 0.32;
                    user-select: none;
                    mix-blend-mode: multiply;
                }
                #altitudeLabel .alt-value {
                    font-size: 13px;
                    font-weight: 800;
                    color: #152c44;
                    letter-spacing: 0.5px;
                    line-height: 1.1;
                }
                #altitudeLabel .alt-unit {
                    font-size: 9px;
                    font-weight: 600;
                    color: #6b7a8f;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                }
                #altitudeLabel .alt-pressure {
                    font-size: 10px;
                    font-weight: 600;
                    color: #6b7a8f;
                    letter-spacing: 0.3px;
                    margin-top: 4px;
                }
                @media (max-width: 700px) {
                    #altitudeLabel {
                        left: 6px;
                    }
                    #altitudeLabel .alt-value {
                        font-size: 11px;
                    }
                    #altitudeLabel .alt-unit,
                    #altitudeLabel .alt-pressure {
                        font-size: 8px;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // ------------------------------------------------------
        // 2. Crear l'estructura d'overlays fixos (una sola vegada)
        // ------------------------------------------------------
        let root = document.getElementById('scrollRainRoot');
        if (!root) {
            root = document.createElement('div');
            root.id = 'scrollRainRoot';

            const fogLayer = document.createElement('div');
            fogLayer.className = 'scroll-fog-layer';
            fogLayer.id = 'scrollFogLayer';

            const rainOverlay = document.createElement('div');
            rainOverlay.className = 'scroll-rain-overlay';
            rainOverlay.id = 'scrollRainOverlay';

            const lightningFlash = document.createElement('div');
            lightningFlash.className = 'scroll-lightning-flash';
            lightningFlash.id = 'scrollLightningFlash';

            root.appendChild(fogLayer);
            root.appendChild(rainOverlay);
            root.appendChild(lightningFlash);
            document.body.appendChild(root);
        }

        // ------------------------------------------------------
        // 2b. Crear l'etiqueta lateral d'altitud/pressió
        // ------------------------------------------------------
        const fogLayer = document.getElementById('scrollFogLayer');
        const rainOverlay = document.getElementById('scrollRainOverlay');
        const lightningFlash = document.getElementById('scrollLightningFlash');

        let altitudeLabel = document.getElementById('altitudeLabel');
        if (!altitudeLabel) {
            altitudeLabel = document.createElement('div');
            altitudeLabel.id = 'altitudeLabel';
            altitudeLabel.innerHTML = `
                <span class="alt-value" id="altitudeValue">15.0</span>
                <span class="alt-unit">km altitud</span>
                <span class="alt-pressure" id="altitudePressure">120 hPa</span>
            `;
            document.body.appendChild(altitudeLabel);
        }
        const altitudeValueEl = document.getElementById('altitudeValue');
        const altitudePressureEl = document.getElementById('altitudePressure');

        // ------------------------------------------------------
        // 3. Lògica de detecció de scroll + generació de gotes
        // ------------------------------------------------------
        let lastScrollY = window.scrollY;
        let lastTime = performance.now();
        let fadeTimeout = null;
        let dropInterval = null;
        const SPEED_THRESHOLD = 5.5; // px/ms — nomes scroll clarament rapid el dispara
        const MAX_DROPS_ON_SCREEN = 55;

        function spawnDrop() {
            if (rainOverlay.childElementCount > MAX_DROPS_ON_SCREEN) return;

            const drop = document.createElement('div');
            const isTrail = Math.random() < 0.35;
            drop.className = 'rain-drop' + (isTrail ? ' trail' : '');

            const viewportHeight = window.innerHeight;
            // Nomes molt a prop dels vores reals de la pantalla: 0%-8% (esquerra) o 92%-100% (dreta)
            const onLeftSide = Math.random() < 0.5;
            const left = onLeftSide
                ? Math.random() * 8
                : 92 + Math.random() * 8;
            const height = 18 + Math.random() * 30;
            const duration = 0.6 + Math.random() * 0.8;
            const fallDistance = 120 + Math.random() * 220;
            const delay = Math.random() * 0.15;
            // Naixement distribuït per TOTA l'alçada visible de la pantalla
            const startTop = Math.random() * (viewportHeight - height);

            drop.style.left = left + '%';
            drop.style.top = startTop + 'px';
            drop.style.height = height + 'px';
            drop.style.setProperty('--fall-distance', fallDistance + 'px');
            drop.style.animationDuration = duration + 's';
            drop.style.animationDelay = delay + 's';

            rainOverlay.appendChild(drop);

            setTimeout(() => drop.remove(), (duration + delay) * 1000 + 100);
        }

        // ------------------------------------------------------
        // Llamps ocasionals mentre baixes ràpid
        // ------------------------------------------------------
        const LIGHTNING_CHANCE_PER_TRIGGER = 0.3; // probabilitat de llamp cada vegada que s'activa l'efecte
        let lightningCooldown = false;

        function triggerLightning() {
            if (lightningCooldown) return;
            lightningCooldown = true;

            const variant = Math.random() < 0.5 ? 'flash-1' : 'flash-2';
            // Posició aleatòria del centre del flaix cada vegada
            const flashX = 10 + Math.random() * 80; // 10%-90%
            const flashY = 5 + Math.random() * 60;  // 5%-65%
            lightningFlash.style.setProperty('--flash-x', flashX + '%');
            lightningFlash.style.setProperty('--flash-y', flashY + '%');

            lightningFlash.classList.remove('flash-1', 'flash-2');
            void lightningFlash.offsetWidth; // forçar reflow per reiniciar l'animació
            lightningFlash.classList.add(variant);

            const duration = variant === 'flash-1' ? 500 : 700;
            setTimeout(() => {
                lightningFlash.classList.remove(variant);
                lightningCooldown = false;
            }, duration + 50);
        }

        function activateEffect() {
            rainOverlay.classList.add('active');
            fogLayer.classList.add('active');

            if (dropInterval) clearInterval(dropInterval);
            dropInterval = setInterval(spawnDrop, 40);

            if (Math.random() < LIGHTNING_CHANCE_PER_TRIGGER) {
                setTimeout(triggerLightning, 80 + Math.random() * 250);
            }

            clearTimeout(fadeTimeout);
            fadeTimeout = setTimeout(deactivateEffect, 900);
        }

        function deactivateEffect() {
            rainOverlay.classList.remove('active');
            fogLayer.classList.remove('active');
            if (dropInterval) {
                clearInterval(dropInterval);
                dropInterval = null;
            }
        }

        function onScroll() {
            const now = performance.now();
            const currentY = window.scrollY;
            const deltaY = Math.abs(currentY - lastScrollY);
            const deltaT = Math.max(now - lastTime, 1);
            const speed = deltaY / deltaT; // px/ms

            if (speed >= SPEED_THRESHOLD) {
                activateEffect();
            }

            lastScrollY = currentY;
            lastTime = now;

            updateAltitudeLabel();
        }

        // ------------------------------------------------------
        // Etiqueta d'altitud/pressió segons el % de scroll
        // 15 km (dalt de tot) -> 0 km (baix de tot)
        // Pressió aproximada segons atmosfera estàndard
        // ------------------------------------------------------
        function altitudeToPressure(altitudeKm) {
            // Aproximació simplificada de l'atmosfera estàndard (hPa)
            // 0km ≈ 1013hPa, 5km ≈ 540hPa, 10km ≈ 265hPa, 15km ≈ 120hPa
            const p0 = 1013.25;
            const scaleHeight = 7.4; // km, aproximació troposfera/baixa estratosfera
            return p0 * Math.exp(-altitudeKm / scaleHeight);
        }

        function updateAltitudeLabel() {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = docHeight > 0 ? Math.min(Math.max(scrollTop / docHeight, 0), 1) : 0;

            const altitudeKm = 15 * (1 - progress); // 15km a dalt -> 0km a baix
            const pressureHpa = altitudeToPressure(altitudeKm);

            if (altitudeValueEl) altitudeValueEl.textContent = altitudeKm.toFixed(1);
            if (altitudePressureEl) altitudePressureEl.textContent = Math.round(pressureHpa) + ' hPa';
        }

        let ticking = false;
        window.addEventListener('scroll', function () {
            if (!ticking) {
                requestAnimationFrame(function () {
                    onScroll();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        // Estat inicial de l'etiqueta (per si es recarrega a mig scroll)
        updateAltitudeLabel();
        window.addEventListener('resize', updateAltitudeLabel, { passive: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();