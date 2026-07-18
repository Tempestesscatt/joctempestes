// ============================================================
// cap.js — Captura de pantalla i copia al porta-retalls
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
        WATERMARK_OPACITY: 0.35,
        FLASH_DURATION: 350,
        CAPTURE_DELAY: 1500
    };

    // ── Estat ──
    let btnInjected = false;
    let capturant = false;

    // ── Toast de notificació ──
    function mostrarToast(missatge, tipus) {
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
            font-family: 'Segoe UI', system-ui, sans-serif;
            font-weight: 600;
            font-size: 13px;
            z-index: 99999;
            box-shadow: 0 8px 32px rgba(0,0,0,0.35);
            animation: captToastIn 0.35s ease, captToastOut 0.35s ease ${CONFIG.TOAST_DURATION - 350}ms forwards;
            pointer-events: none;
            white-space: nowrap;
            max-width: 90vw;
            text-align: center;
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
            background: rgba(255, 255, 255, 0.3);
            pointer-events: none;
            animation: captFlashIn ${CONFIG.FLASH_DURATION}ms ease-out forwards;
        `;
        document.body.appendChild(flash);

        setTimeout(() => flash.remove(), CONFIG.FLASH_DURATION + 50);
    }

    // ── Inyectar botó flotant ──
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
            backdrop-filter: blur(8px);
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
            transition: all 0.25s ease;
            opacity: 0.75;
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

    // ── Afegir marca d'aigua al canvas ──
    function afegirMarcaAigua(canvas) {
        const ctx = canvas.getContext('2d');
        const text = CONFIG.WATERMARK_TEXT;
        
        const fontSize = Math.max(12, Math.round(canvas.width * 0.022));
        ctx.font = `600 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
        
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = fontSize;
        
        const padding = Math.round(canvas.width * 0.015);
        const x = canvas.width - textWidth - padding;
        const y = canvas.height - padding;
        
        ctx.fillStyle = `rgba(0, 0, 0, ${CONFIG.WATERMARK_OPACITY * 0.6})`;
        const bgPadding = Math.round(fontSize * 0.4);
        
        ctx.fillRect(
            x - bgPadding,
            y - textHeight - bgPadding * 0.5,
            textWidth + bgPadding * 2,
            textHeight + bgPadding
        );
        
        ctx.fillStyle = `rgba(255, 255, 255, ${CONFIG.WATERMARK_OPACITY})`;
        ctx.fillText(text, x, y);
    }

    // ── Captura principal ──
    async function capturarPantalla() {
        if (capturant) return;
        capturant = true;

        // 1. Mostrar flash immediatament
        mostrarFlash();

        const btn = document.getElementById('btnCapturaPantalla');
        if (btn) {
            btn.style.opacity = '0';
            btn.style.pointerEvents = 'none';
        }

        // 2. Esperar que el flash s'acabi + delay complet
        await new Promise(resolve => setTimeout(resolve, CONFIG.CAPTURE_DELAY));

        // 3. Amagar overlays (el flash ja ha desaparegut)
        const elementsAmagats = [];
        const selectorsPerAmagar = [
            '.rang-visual[style*="position: fixed"]',
            '#xatModal.active',
            '#profileModal.active',
            '#loading_overlay.visible'
        ];

        selectorsPerAmagar.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                if (el.offsetParent !== null) {
                    elementsAmagats.push({ el: el, display: el.style.display });
                    el.style.display = 'none';
                }
            });
        });

        // 4. Fer la captura
        try {
            if (typeof html2canvas !== 'undefined') {
                const canvas = await html2canvas(document.body, {
                    useCORS: true,
                    allowTaint: true,
                    scale: window.devicePixelRatio || 1,
                    backgroundColor: '#0a1628',
                    logging: false
                });
                
                afegirMarcaAigua(canvas);
                await copiarCanvasAlPortaRetalls(canvas);
            } else {
                await capturaNativa();
            }
        } catch (err) {
            console.error('[Capt] Error:', err);
            mostrarToast('Error fent la captura', 'error');
        }

        // 5. Restaurar
        elementsAmagats.forEach(({ el, display }) => {
            el.style.display = display;
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

            mostrarToast('\u2705 Captura copiada al porta-retalls!', 'ok');
        } catch (err) {
            console.error('[Capt] Error copiant:', err);
            const url = canvas.toDataURL(CONFIG.FORMAT, CONFIG.QUALITY);
            window.open(url, '_blank');
            mostrarToast('Captura oberta en finestra nova', 'info');
        }
    }

    // ── Captura nativa ──
    async function capturaNativa() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                preferCurrentTab: true,
                video: { displaySurface: 'browser' }
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
                'error'
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
        }
    };

    // ── Inicialitzar ──
    function iniciar() {
        injectarEstils();
        setTimeout(injectarBoto, 500);

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