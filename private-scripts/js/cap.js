// ============================================================
// cap.js — Captura de pantalla i copia al porta-retalls
// Versió 2.0 - Millorada i refinada
// ============================================================
(function() {
    'use strict';

    if (window._CAPT_LOADED) return;
    window._CAPT_LOADED = true;

    // ── Configuració ──
    const CONFIG = {
        BTN_TITLE: 'Captura pantalla',
        BTN_ICON: 'fa-solid fa-camera',
        TOAST_DURATION: 2500,
        FORMAT: 'image/png',
        QUALITY: 1.0,
        WATERMARK_TEXT: '@tempestes.cat',
        WATERMARK_OPACITY: 0.45,
        WATERMARK_FONT: '"Outfit", "Segoe UI", system-ui, -apple-system, sans-serif',
        FLASH_DURATION: 350,
        CAPTURE_DELAY: 800,
        MAX_CAPTURE_WIDTH: 1920
    };

    // ── Estat ──
    let btnInjected = false;
    let capturant = false;
    let ultimPermis = null;

    // ── Toast de notificació ──
    function mostrarToast(missatge, tipus = 'info') {
        const toast = document.createElement('div');
        const colors = {
            ok: 'linear-gradient(135deg, #2ecc71, #27ae60)',
            error: 'linear-gradient(135deg, #e74c3c, #c0392b)',
            info: 'linear-gradient(135deg, #3498db, #2980b9)'
        };
        
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: ${colors[tipus] || colors.info};
            color: #fff;
            padding: 12px 28px;
            border-radius: 30px;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            font-weight: 500;
            font-size: 13px;
            z-index: 99999;
            box-shadow: 0 8px 32px rgba(0,0,0,0.35);
            animation: captToastIn 0.35s ease, captToastOut 0.35s ease ${CONFIG.TOAST_DURATION - 350}ms forwards;
            pointer-events: none;
            white-space: nowrap;
            max-width: 90vw;
            text-align: center;
            letter-spacing: 0.3px;
        `;
        toast.textContent = missatge;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), CONFIG.TOAST_DURATION);
    }

    // ── Animació de flash minimalista ──
    function mostrarFlash() {
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 99997;
            background: rgba(255, 255, 255, 0.25);
            pointer-events: none;
            animation: captFlashIn ${CONFIG.FLASH_DURATION}ms ease-out forwards;
        `;
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), CONFIG.FLASH_DURATION + 50);
    }

    // ── Injectar botó flotant ──
    function injectarBoto() {
        if (btnInjected || document.getElementById('btnCapturaPantalla')) {
            btnInjected = true;
            return;
        }

        const btn = document.createElement('button');
        btn.id = 'btnCapturaPantalla';
        btn.title = CONFIG.BTN_TITLE;
        btn.innerHTML = `<i class="${CONFIG.BTN_ICON}"></i>`;
        btn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9998;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.25);
            background: rgba(10, 22, 40, 0.85);
            color: #fff;
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            opacity: 0.75;
            outline: none;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        `;

        btn.addEventListener('mouseenter', () => {
            btn.style.opacity = '1';
            btn.style.transform = 'scale(1.08)';
            btn.style.boxShadow = '0 6px 24px rgba(0,0,0,0.55)';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.opacity = '0.75';
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)';
        });
        
        btn.addEventListener('click', capturarPantalla);

        document.body.appendChild(btn);
        btnInjected = true;
    }

    // ── Afegir marca d'aigua al canvas (estil elegant i petit) ──
    function afegirMarcaAigua(canvas) {
        const ctx = canvas.getContext('2d');
        const text = CONFIG.WATERMARK_TEXT;
        
        // Mida de font proporcional però més petita
        const fontSize = Math.max(10, Math.round(Math.min(canvas.width, canvas.height) * 0.018));
        ctx.font = `500 ${fontSize}px ${CONFIG.WATERMARK_FONT}`;
        
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = fontSize;
        
        // Padding més petit
        const padding = Math.round(Math.min(canvas.width, canvas.height) * 0.012);
        const x = canvas.width - textWidth - padding;
        const y = canvas.height - padding;
        
        // Fons semi-transparent per millorar llegibilitat
        ctx.fillStyle = `rgba(0, 0, 0, ${CONFIG.WATERMARK_OPACITY * 0.5})`;
        const bgPadding = Math.round(fontSize * 0.35);
        const borderRadius = Math.round(fontSize * 0.3);
        
        // Dibuixar fons arrodonit
        ctx.beginPath();
        ctx.roundRect(
            x - bgPadding,
            y - textHeight - bgPadding * 0.6,
            textWidth + bgPadding * 2,
            textHeight + bgPadding * 1.2,
            borderRadius
        );
        ctx.fill();
        
        // Text amb opacitat
        ctx.fillStyle = `rgba(255, 255, 255, ${CONFIG.WATERMARK_OPACITY})`;
        ctx.textBaseline = 'bottom';
        ctx.fillText(text, x, y);
    }

    // ── Captura principal optimitzada ──
    async function capturarPantalla() {
        if (capturant) {
            mostrarToast('Captura en procés...', 'info');
            return;
        }
        
        capturant = true;
        mostrarFlash();

        const btn = document.getElementById('btnCapturaPantalla');
        if (btn) {
            btn.style.opacity = '0';
            btn.style.pointerEvents = 'none';
        }

        // Delay reduït per ser més àgil
        await new Promise(resolve => setTimeout(resolve, CONFIG.CAPTURE_DELAY));

        // Amagar overlays que puguin interferir
        const elementsAmagats = [];
        const selectorsPerAmagar = [
            '.rang-visual[style*="position: fixed"]',
            '#xatModal.active',
            '#profileModal.active',
            '#loading_overlay.visible',
            '[role="dialog"][aria-modal="true"]'
        ];

        selectorsPerAmagar.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                if (el.offsetParent !== null) {
                    elementsAmagats.push({ 
                        el: el, 
                        display: el.style.display,
                        visibility: el.style.visibility 
                    });
                    el.style.display = 'none';
                    el.style.visibility = 'hidden';
                }
            });
        });

        // Fer la captura
        try {
            if (typeof html2canvas !== 'undefined') {
                const canvas = await html2canvas(document.body, {
                    useCORS: true,
                    allowTaint: true,
                    scale: Math.min(window.devicePixelRatio || 1, 2),
                    backgroundColor: '#0a1628',
                    logging: false,
                    width: Math.min(document.body.scrollWidth, CONFIG.MAX_CAPTURE_WIDTH),
                    windowWidth: document.body.scrollWidth,
                    windowHeight: document.body.scrollHeight
                });
                
                afegirMarcaAigua(canvas);
                await copiarCanvasAlPortaRetalls(canvas);
            } else {
                await capturaNativa();
            }
        } catch (err) {
            console.error('[Capt] Error:', err);
            mostrarToast('Error en fer la captura', 'error');
        }

        // Restaurar elements amagats
        elementsAmagats.forEach(({ el, display, visibility }) => {
            el.style.display = display;
            el.style.visibility = visibility;
        });

        if (btn) {
            btn.style.opacity = '0.75';
            btn.style.pointerEvents = 'auto';
        }
        
        capturant = false;
    }

    // ── Copiar canvas al porta-retalls ──
    async function copiarCanvasAlPortaRetalls(canvas) {
        try {
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob(blob => {
                    if (blob) resolve(blob);
                    else reject(new Error('No s\'ha pogut crear el blob'));
                }, CONFIG.FORMAT, CONFIG.QUALITY);
            });

            await navigator.clipboard.write([
                new ClipboardItem({ [CONFIG.FORMAT]: blob })
            ]);

            mostrarToast('✅ Captura copiada al porta-retalls!', 'ok');
        } catch (err) {
            console.error('[Capt] Error copiant:', err);
            
            // Fallback: obrir en finestra nova
            const url = canvas.toDataURL(CONFIG.FORMAT, CONFIG.QUALITY);
            const novaFinestra = window.open('', '_blank');
            if (novaFinestra) {
                novaFinestra.document.write(`<img src="${url}" style="max-width:100%;height:auto;">`);
                novaFinestra.document.title = 'Captura - Tempestes.cat';
                mostrarToast('Captura oberta en finestra nova', 'info');
            } else {
                mostrarToast('No s\'ha pogut obrir la captura', 'error');
            }
        }
    }

    // ── Captura nativa (com a fallback) ──
    async function capturaNativa() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                preferCurrentTab: true,
                video: { 
                    displaySurface: 'browser',
                    width: { ideal: CONFIG.MAX_CAPTURE_WIDTH }
                }
            });

            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);

            stream.getTracks().forEach(track => track.stop());
            video.remove();

            afegirMarcaAigua(canvas);
            await copiarCanvasAlPortaRetalls(canvas);
        } catch (err) {
            console.warn('[Capt] Captura nativa no disponible:', err);
            mostrarToast(
                'Per fer captures instal·la html2canvas:\n' +
                '<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>',
                'info'
            );
        }
    }

    // ── Estils CSS ──
    function injectarEstils() {
        if (document.getElementById('capt-estils')) return;
        const style = document.createElement('style');
        style.id = 'capt-estils';
        style.textContent = `
            @keyframes captToastIn {
                from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
            @keyframes captToastOut {
                from { opacity: 1; transform: translateX(-50%) translateY(0); }
                to { opacity: 0; transform: translateX(-50%) translateY(-15px); }
            }
            @keyframes captFlashIn {
                0% { opacity: 0; }
                30% { opacity: 1; }
                100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // ── API pública ──
    window.TempestescatCapt = {
        capturar: capturarPantalla,
        amagarBoto: () => {
            const btn = document.getElementById('btnCapturaPantalla');
            if (btn) btn.style.display = 'none';
        },
        mostrarBoto: () => {
            const btn = document.getElementById('btnCapturaPantalla');
            if (btn) btn.style.display = 'flex';
        },
        actualizarConfig: (novaConfig) => {
            Object.assign(CONFIG, novaConfig);
        }
    };

    // ── Inicialització ──
    function iniciar() {
        injectarEstils();
        
        // Injectar botó amb petit delay per assegurar DOM carregat
        setTimeout(injectarBoto, 500);

        // Drecera de teclat: Ctrl+Shift+C
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                capturarPantalla();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }

})();