/**
 * js/index/noticies.js
 * ---------------------------------------------------------------
 * Sistema de notícies manual amb Firebase
 *   - Publicar notícies (només admin)
 *   - Caducitat automàtica als 7 dies
 *   - Mostra en dues seccions:
 *     - ÚLTIMA HORA: Notícies de les últimes 24h
 *     - NOTÍCIES: Resta de notícies actives
 * 
 * ADMIN UID: zD8SlXoDNOQCboc0JQ3zCnFza9W2
 * ---------------------------------------------------------------
 */

(function () {
    'use strict';

    // ============================================================
    // CONFIGURACIÓ
    // ============================================================
    const ADMIN_UID = "zD8SlXoDNOQCboc0JQ3zCnFza9W2";
    const CACHE_KEY = 'tc_news_cache_v1';
    const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minuts

    // Firebase config
    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyBGcGUk2gsoDaHkg9Yv-nqMJ5_x-QPTMS8",
        authDomain: "tempestescat.firebaseapp.com",
        databaseURL: "https://tempestescat-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "tempestescat",
        storageBucket: "tempestescat.firebasestorage.app",
        messagingSenderId: "683240351775",
        appId: "1:683240351775:web:bc65d73249537b9cc28d2a"
    };

    // ============================================================
    // ESTAT
    // ============================================================
    let user = null;
    let auth = null;
    let db = null;
    let isFirebaseReady = false;
    let allNews = [];
    let editingKey = null;
    let tempImage = null;

    // ============================================================
    // INJECTAR ESTILS
    // ============================================================
    function injectStyles() {
        if (document.getElementById('noticiesStyles')) return;

        const style = document.createElement('style');
        style.id = 'noticiesStyles';
        style.textContent = `
            .news-container {
                max-width: 900px;
                margin: 0 auto;
                padding: 0 12px;
            }

            /* ===== PANELL ADMIN ===== */
            .news-admin-bar {
                display: flex;
                align-items: center;
                gap: 12px;
                background: #fff;
                border-radius: 16px;
                padding: 12px 20px;
                margin-bottom: 24px;
                border: 1px solid rgba(0,0,0,0.06);
                box-shadow: 0 2px 12px rgba(0,0,0,0.04);
                flex-wrap: wrap;
            }
            .news-admin-bar .admin-label {
                font-size: 12px;
                font-weight: 600;
                color: #556680;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .news-admin-bar .admin-label i {
                color: #1DA1F2;
            }
            .news-admin-bar .admin-user {
                font-size: 13px;
                font-weight: 600;
                color: #1a2a40;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .news-admin-bar .admin-avatar {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: linear-gradient(135deg, #1DA1F2, #0d8bd9);
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                font-weight: 700;
                font-size: 12px;
            }
            .news-admin-bar .btn-news {
                padding: 8px 18px;
                border-radius: 25px;
                border: none;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                font-family: inherit;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                transition: all 0.2s;
            }
            .btn-news-primary {
                background: #1DA1F2;
                color: #fff;
            }
            .btn-news-primary:hover {
                background: #0d8bd9;
                transform: translateY(-2px);
                box-shadow: 0 4px 16px rgba(29,161,242,0.3);
            }
            .btn-news-outline {
                background: transparent;
                border: 1px solid #d0d8e8;
                color: #556680;
            }
            .btn-news-outline:hover {
                border-color: #1DA1F2;
                color: #1DA1F2;
            }
            .btn-news-danger {
                background: #e05555;
                color: #fff;
            }
            .btn-news-danger:hover {
                background: #cc4444;
            }

            /* ===== FORMULARI ===== */
            .news-form {
                display: none;
                background: #fff;
                border-radius: 16px;
                padding: 24px;
                margin-bottom: 24px;
                border: 1px solid rgba(0,0,0,0.06);
                box-shadow: 0 4px 20px rgba(0,0,0,0.04);
            }
            .news-form.open { display: block; }
            .news-form .form-title {
                font-size: 16px;
                font-weight: 700;
                color: #1a2a40;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .news-form textarea {
                width: 100%;
                background: #f5f7fa;
                border: 1px solid #e0e4ea;
                color: #1a2a40;
                padding: 14px;
                border-radius: 12px;
                font-family: inherit;
                font-size: 14px;
                resize: vertical;
                min-height: 80px;
                max-height: 150px;
                transition: border 0.2s;
            }
            .news-form textarea:focus {
                border-color: #1DA1F2;
                outline: none;
                box-shadow: 0 0 0 3px rgba(29,161,242,0.1);
            }
            .news-form .form-row {
                display: flex;
                gap: 12px;
                margin-top: 12px;
                align-items: center;
                flex-wrap: wrap;
            }
            .news-form .form-row .img-upload {
                width: 70px;
                height: 70px;
                border-radius: 12px;
                border: 2px dashed #d0d8e8;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                overflow: hidden;
                transition: all 0.2s;
                flex-shrink: 0;
            }
            .news-form .form-row .img-upload:hover {
                border-color: #1DA1F2;
                background: rgba(29,161,242,0.04);
            }
            .news-form .form-row .img-upload img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .news-form .form-row .img-upload.has-img {
                border-style: solid;
                border-color: #d0d8e8;
            }
            .news-form .form-hint {
                font-size: 11px;
                color: #8899bb;
                margin-top: 10px;
            }
            .btn-news-publish {
                background: #1DA1F2;
                color: #fff;
                border: none;
                padding: 10px 24px;
                border-radius: 30px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 700;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                transition: all 0.2s;
                font-family: inherit;
                margin-left: auto;
            }
            .btn-news-publish:hover {
                background: #0d8bd9;
                transform: translateY(-2px);
                box-shadow: 0 4px 16px rgba(29,161,242,0.3);
            }
            .btn-news-publish:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            .btn-news-cancel {
                background: #f0f2f5;
                color: #556680;
                border: none;
                padding: 10px 20px;
                border-radius: 30px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
                font-family: inherit;
                transition: all 0.2s;
            }
            .btn-news-cancel:hover { background: #e4e7ec; }

            .news-section { margin-bottom: 40px; }
            .news-header {
                display: flex;
                align-items: baseline;
                justify-content: space-between;
                margin-bottom: 24px;
                gap: 12px;
                flex-wrap: wrap;
            }
            .news-header h2 {
                font-size: clamp(22px, 3vw, 30px);
                font-weight: 800;
                color: #1a2a40;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .news-header h2 i { color: #1DA1F2; font-size: 28px; }
            .news-header h2 .badge-twitter {
                font-size: 12px;
                background: #1DA1F2;
                color: #fff;
                padding: 2px 14px;
                border-radius: 20px;
                font-weight: 600;
                letter-spacing: 0.3px;
            }
            .news-header h2 .count-badge {
                font-size: 12px;
                background: rgba(29, 161, 242, 0.12);
                color: #1DA1F2;
                padding: 2px 14px;
                border-radius: 20px;
                font-weight: 700;
                letter-spacing: 0.3px;
            }

            .ultima-hora-section {
                background: linear-gradient(135deg, #f0f7ff, #e8f0fe);
                border-radius: 20px;
                padding: 24px 24px 8px 24px;
                margin-bottom: 40px;
                border-left: 4px solid #ff4444;
                position: relative;
            }
            .ultima-hora-section .ultima-hora-label {
                position: absolute;
                top: -12px;
                left: 24px;
                background: #ff4444;
                color: #fff;
                font-size: 11px;
                font-weight: 700;
                padding: 4px 16px;
                border-radius: 20px;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                box-shadow: 0 2px 8px rgba(255, 68, 68, 0.3);
            }
            .ultima-hora-section .ultima-hora-label i { margin-right: 6px; }
            .ultima-hora-section .news-grid { grid-template-columns: repeat(3, 1fr); }
            .ultima-hora-section .news-card { border-color: rgba(255, 68, 68, 0.15); }
            .ultima-hora-section .news-card:hover {
                border-color: rgba(255, 68, 68, 0.3);
                box-shadow: 0 16px 48px rgba(255, 68, 68, 0.08);
            }
            .ultima-hora-section .news-card .news-card-badge {
                background: linear-gradient(135deg, #ff4444, #cc0000);
                box-shadow: 0 4px 12px rgba(255, 68, 68, 0.4);
            }

            .news-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 24px;
            }

            .news-card {
                background: #FFF;
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0,0,0,0.06);
                text-decoration: none;
                color: inherit;
                display: flex;
                flex-direction: column;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                border: 1px solid rgba(0,0,0,0.04);
                position: relative;
            }
            .news-card:hover {
                transform: translateY(-8px);
                box-shadow: 0 16px 48px rgba(0,0,0,0.12);
                border-color: rgba(29, 161, 242, 0.2);
            }

            .news-card-img {
                width: 100%;
                aspect-ratio: 16/10;
                background: linear-gradient(135deg, #e8edf8, #d5dce8);
                position: relative;
                overflow: hidden;
                flex-shrink: 0;
            }
            .news-card-img img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
                transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .news-card:hover .news-card-img img { transform: scale(1.05); }

            .news-card-badge {
                position: absolute;
                top: 14px;
                right: 14px;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: linear-gradient(135deg, #1DA1F2, #0d8bd9);
                display: flex;
                align-items: center;
                justify-content: center;
                color: #FFF;
                font-size: 16px;
                box-shadow: 0 4px 12px rgba(29, 161, 242, 0.4);
                transition: transform 0.3s ease;
            }
            .news-card:hover .news-card-badge { transform: scale(1.1) rotate(5deg); }

            .news-card-body {
                padding: 20px 22px 22px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                flex: 1;
                background: #FFF;
            }

            .news-card-text {
                font-size: 15px;
                color: #1a2a40;
                line-height: 1.6;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                -webkit-box-orient: vertical;
                overflow: hidden;
                font-weight: 500;
                letter-spacing: -0.01em;
            }

            .news-card-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-top: 4px;
                padding-top: 12px;
                border-top: 1px solid rgba(0,0,0,0.05);
            }
            .news-card-time {
                font-size: 12px;
                color: #8899bb;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .news-card-time i { font-size: 13px; color: #aab; }
            .news-card-time .urgent { color: #ff4444; font-weight: 700; }
            .news-card-link {
                font-size: 12px;
                font-weight: 700;
                color: #1DA1F2;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.3s ease;
                padding: 4px 12px;
                border-radius: 20px;
                background: rgba(29, 161, 242, 0.06);
                cursor: pointer;
                border: none;
                font-family: inherit;
            }
            .news-card-link:hover {
                background: rgba(29, 161, 242, 0.12);
                gap: 10px;
            }

            .news-card-number {
                position: absolute;
                top: 14px;
                left: 14px;
                font-size: 11px;
                font-weight: 700;
                color: rgba(255,255,255,0.8);
                background: rgba(0,0,0,0.5);
                backdrop-filter: blur(4px);
                padding: 2px 12px;
                border-radius: 20px;
                letter-spacing: 0.5px;
            }

            .news-card-actions {
                position: absolute;
                top: 14px;
                left: 60px;
                display: none;
                gap: 6px;
            }
            .news-card:hover .news-card-actions { display: flex; }

            .news-card-actions button {
                background: rgba(0,0,0,0.5);
                backdrop-filter: blur(4px);
                border: none;
                color: #fff;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                transition: all 0.2s;
            }
            .news-card-actions button:hover { transform: scale(1.1); }
            .news-card-actions .btn-del:hover { background: #e05555; }
            .news-card-actions .btn-edit:hover { background: #1DA1F2; }

            .seccio-divider {
                display: flex;
                align-items: center;
                gap: 16px;
                margin: 40px 0 24px 0;
            }
            .seccio-divider .line {
                flex: 1;
                height: 1px;
                background: linear-gradient(90deg, transparent, #d0d8e8, transparent);
            }
            .seccio-divider .text {
                font-size: 13px;
                font-weight: 700;
                color: #8899bb;
                text-transform: uppercase;
                letter-spacing: 1px;
                white-space: nowrap;
            }

            .news-empty {
                grid-column: 1 / -1;
                text-align: center;
                padding: 60px 20px;
                color: #8899bb;
                font-size: 15px;
                background: #FFF;
                border-radius: 20px;
                border: 2px dashed rgba(0,0,0,0.06);
            }
            .news-empty i {
                font-size: 40px;
                color: #1DA1F2;
                opacity: 0.3;
                display: block;
                margin-bottom: 16px;
            }

            .news-loading {
                grid-column: 1 / -1;
                text-align: center;
                padding: 60px 20px;
                color: #8899bb;
                font-size: 15px;
                background: #FFF;
                border-radius: 20px;
            }
            .news-loading i {
                font-size: 32px;
                color: #1DA1F2;
                display: block;
                margin-bottom: 12px;
            }

            @media (max-width: 1024px) {
                .news-grid { grid-template-columns: repeat(2, 1fr); gap: 20px; }
                .ultima-hora-section .news-grid { grid-template-columns: repeat(2, 1fr); }
            }
            @media (max-width: 640px) {
                .news-grid { grid-template-columns: 1fr; gap: 16px; }
                .ultima-hora-section .news-grid { grid-template-columns: 1fr; }
                .news-card-body { padding: 16px 18px 18px; }
                .news-card-text { font-size: 14px; -webkit-line-clamp: 4; }
                .news-card-img { aspect-ratio: 16/9; }
                .news-header h2 { font-size: 20px; }
                .news-card-badge { width: 30px; height: 30px; font-size: 13px; top: 10px; right: 10px; }
                .news-card-number { font-size: 9px; top: 10px; left: 10px; padding: 1px 10px; }
                .ultima-hora-section { padding: 20px 16px 8px 16px; }
                .ultima-hora-section .ultima-hora-label { font-size: 10px; top: -10px; left: 16px; padding: 3px 12px; }
                .news-card-actions { left: 50px; }
                .news-card-actions button { width: 24px; height: 24px; font-size: 10px; }
                .news-form { padding: 16px; }
                .news-admin-bar { padding: 10px 16px; flex-direction: column; align-items: stretch; }
                .news-admin-bar .admin-label { font-size: 11px; }
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================================
    // UTILS
    // ============================================================
    function esc(t) {
        if (!t) return '';
        return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function formatTimeAgo(isoOrTs) {
        if (!isoOrTs) return '';
        const t = typeof isoOrTs === 'number' ? isoOrTs : new Date(isoOrTs).getTime();
        if (isNaN(t)) return '';
        const m = Math.floor((Date.now() - t) / 60000);
        if (m < 1) return 'Ara mateix';
        if (m < 60) return `Fa ${m} min`;
        const h = Math.floor(m / 60);
        if (h < 24) return `Fa ${h} h`;
        const d = Math.floor(h / 24);
        if (d < 7) return `Fa ${d} d`;
        return `Fa ${Math.floor(d / 7)} setmanes`;
    }

    function esUltimaHora(timestamp) {
        if (!timestamp) return false;
        const diffHours = (Date.now() - timestamp) / (1000 * 60 * 60);
        return diffHours <= 24;
    }

    function estaCaducada(timestamp) {
        if (!timestamp) return true;
        const diffDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
        return diffDays > 7;
    }

    function getElement(id) { return document.getElementById(id); }

    // ============================================================
    // INICIALITZAR FIREBASE
    // ============================================================
    function initFirebase() {
        if (isFirebaseReady) return;

        const scripts = [
            'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
            'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js',
            'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js'
        ];

        let loaded = 0;

        function loadNext() {
            if (loaded >= scripts.length) {
                try {
                    firebase.initializeApp(FIREBASE_CONFIG);
                    db = firebase.database();
                    auth = firebase.auth();

                    auth.onAuthStateChanged(function(u) {
                        user = u;
                        updateUI();
                        renderNews();
                    });

                    isFirebaseReady = true;
                    loadNews();
                } catch (e) {
                    console.error('[noticies.js] Error inicialitzant Firebase:', e);
                }
                return;
            }

            const script = document.createElement('script');
            script.src = scripts[loaded];
            script.onload = function() { loaded++; loadNext(); };
            script.onerror = function() { loaded++; loadNext(); };
            document.head.appendChild(script);
        }

        loadNext();
    }

    // ============================================================
    // PUBLICAR / ELIMINAR NOTÍCIA
    // ============================================================
    window.newsPublish = function() {
        if (!user || user.uid !== ADMIN_UID) {
            alert('No estàs autoritzat per publicar notícies');
            return;
        }

        const text = getElement('news-text');
        const caption = text ? text.value.trim() : '';

        if (!caption) {
            alert('Escriu el text de la notícia');
            return;
        }

        const btn = getElement('news-publish-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publicant...';
        }

        const now = Date.now();
        const newsItem = {
            caption: caption,
            timestamp: now,
            uid: user.uid,
            nick: user.displayName || 'Admin'
        };

        if (tempImage) {
            newsItem.image = tempImage;
        }

        if (editingKey) {
            db.ref('noticies/' + editingKey).update(newsItem, function(error) {
                if (error) alert('Error: ' + error.message);
                editingKey = null;
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-regular fa-paper-plane"></i> Publicar';
                }
                resetForm();
                loadNews();
            });
        } else {
            db.ref('noticies').push(newsItem, function(error) {
                if (error) alert('Error: ' + error.message);
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-regular fa-paper-plane"></i> Publicar';
                }
                resetForm();
                loadNews();
            });
        }
    };

    window.newsDelete = function(key) {
        if (!user || user.uid !== ADMIN_UID) {
            alert('No pots eliminar això');
            return;
        }
        if (!confirm('Eliminar aquesta notícia?')) return;

        db.ref('noticies/' + key).remove().catch(function(e) {
            alert('Error: ' + e.message);
        });
    };

    window.newsEdit = function(key) {
        if (!user || user.uid !== ADMIN_UID) return;

        const item = allNews.find(function(n) { return n.key === key; });
        if (!item) return;

        editingKey = key;
        const text = getElement('news-text');
        if (text) text.value = item.caption;

        if (item.image) {
            tempImage = item.image;
            const preview = getElement('news-img-preview');
            if (preview) {
                preview.innerHTML = '<img src="' + item.image + '">';
                preview.classList.add('has-img');
            }
        }

        const btn = getElement('news-publish-btn');
        if (btn) btn.innerHTML = '<i class="fa-regular fa-pen-to-square"></i> Actualitzar';

        const form = getElement('news-form');
        if (form) {
            form.classList.add('open');
            document.getElementById('news-form-title').textContent = '✏️ Editar notícia';
            window.scrollTo({ top: form.offsetTop - 20, behavior: 'smooth' });
        }
    };

    // ============================================================
    // FORMULARI
    // ============================================================
    function resetForm() {
        const text = getElement('news-text');
        if (text) text.value = '';
        editingKey = null;
        tempImage = null;
        const preview = getElement('news-img-preview');
        if (preview) {
            preview.innerHTML = '<i class="fa-regular fa-image" style="font-size:24px;opacity:0.4;"></i>';
            preview.classList.remove('has-img');
        }
        const btn = getElement('news-publish-btn');
        if (btn) btn.innerHTML = '<i class="fa-regular fa-paper-plane"></i> Publicar';
        const title = getElement('news-form-title');
        if (title) title.textContent = '📝 Nova notícia';
    }

    window.newsCancelEdit = function() {
        resetForm();
        const form = getElement('news-form');
        if (form) form.classList.remove('open');
    };

    window.newsToggleForm = function() {
        if (!user || user.uid !== ADMIN_UID) {
            alert('Inicia sessió com a administrador');
            return;
        }
        const form = getElement('news-form');
        if (form) {
            form.classList.toggle('open');
            if (!form.classList.contains('open')) {
                resetForm();
            }
        }
    };

    window.newsHandleImage = function() {
        const input = getElement('news-img-input');
        if (!input) return;
        const file = input.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            alert('Màxim 2MB per imatge');
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            tempImage = e.target.result;
            const preview = getElement('news-img-preview');
            if (preview) {
                preview.innerHTML = '<img src="' + tempImage + '">';
                preview.classList.add('has-img');
            }
        };
        reader.readAsDataURL(file);
    };

    // ============================================================
    // RENDERITZAR NOTÍCIES
    // ============================================================
    function renderNews() {
        const container = getElement('newsContainer');
        if (!container) return;

        const actives = allNews.filter(function(n) {
            return !estaCaducada(n.timestamp);
        });

        if (actives.length === 0) {
            container.innerHTML = `
                <div class="news-empty">
                    <i class="fa-regular fa-newspaper"></i>
                    No hi ha notícies disponibles.
                    <small>Les notícies caduquen automàticament als 7 dies.</small>
                </div>
            `;
            return;
        }

        const ultimaHora = [];
        const resta = [];

        actives.forEach(function(n) {
            if (esUltimaHora(n.timestamp)) {
                ultimaHora.push(n);
            } else {
                resta.push(n);
            }
        });

        ultimaHora.sort(function(a, b) { return b.timestamp - a.timestamp; });
        resta.sort(function(a, b) { return b.timestamp - a.timestamp; });

        let html = '';

        if (ultimaHora.length > 0) {
            html += `
                <div class="ultima-hora-section">
                    <span class="ultima-hora-label"><i class="fa-solid fa-bolt"></i> Última hora</span>
                    <div class="news-grid" id="ultimaHoraGrid"></div>
                </div>
            `;
        }

        if (resta.length > 0) {
            html += `
                <div class="seccio-divider">
                    <span class="line"></span>
                    <span class="text">Notícies anteriors</span>
                    <span class="line"></span>
                </div>
                <div class="news-grid" id="noticiesGrid"></div>
            `;
        }

        container.innerHTML = html;

        const uhGrid = getElement('ultimaHoraGrid');
        if (uhGrid) {
            uhGrid.innerHTML = '';
            ultimaHora.forEach(function(n, index) {
                uhGrid.appendChild(renderNewsCard(n, index, true));
            });
        }

        const nGrid = getElement('noticiesGrid');
        if (nGrid) {
            nGrid.innerHTML = '';
            resta.forEach(function(n, index) {
                nGrid.appendChild(renderNewsCard(n, index, false));
            });
        }
    }

    function renderNewsCard(item, index, isUrgent) {
        const isOwn = user && user.uid === item.uid;
        const card = document.createElement('div');
        card.className = 'news-card';

        const time = formatTimeAgo(item.timestamp);
        const imgUrl = item.image || '';

        const imgHtml = imgUrl
            ? `<img src="${esc(imgUrl)}" alt="Notícia" loading="lazy">`
            : `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:linear-gradient(135deg,#1DA1F2,#0d8bd9);color:#fff;font-size:48px;"><i class="fa-regular fa-newspaper"></i></div>`;

        const urgentClass = isUrgent ? 'urgent' : '';
        const urgentIcon = isUrgent ? '<i class="fa-solid fa-circle" style="color:#ff4444;font-size:8px;margin-right:4px;"></i>' : '';

        let actionsHtml = '';
        if (isOwn) {
            actionsHtml = `
                <div class="news-card-actions">
                    <button class="btn-edit" onclick="event.stopPropagation();newsEdit('${item.key}')" title="Editar"><i class="fa-regular fa-pen-to-square"></i></button>
                    <button class="btn-del" onclick="event.stopPropagation();newsDelete('${item.key}')" title="Eliminar"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="news-card-img">
                ${imgHtml}
                <span class="news-card-number">#${String(index + 1).padStart(2, '0')}</span>
                <div class="news-card-badge">
                    <i class="fa-regular fa-newspaper"></i>
                </div>
                ${actionsHtml}
            </div>
            <div class="news-card-body">
                <div class="news-card-text">${esc(item.caption)}</div>
                <div class="news-card-footer">
                    <span class="news-card-time">
                        <i class="fa-regular fa-clock"></i> 
                        <span class="${urgentClass}">${urgentIcon} ${esc(time)}</span>
                        ${item.nick ? `<span style="color:#8899bb;font-weight:400;">· ${esc(item.nick)}</span>` : ''}
                    </span>
                    <span class="news-card-link" onclick="window.open('https://x.com/tempestes_cat','_blank')">
                        Veure a X <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </span>
                </div>
            </div>
        `;

        return card;
    }

    // ============================================================
    // CARREGAR NOTÍCIES
    // ============================================================
    function loadNews() {
        if (!db) return;

        db.ref('noticies').once('value').then(function(snap) {
            allNews = [];
            if (snap.exists()) {
                const data = snap.val();
                const keys = Object.keys(data);
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    var item = data[key];
                    item.key = key;
                    allNews.push(item);
                }
            }
            renderNews();
        }).catch(function(e) {
            console.error('[noticies.js] Error carregant:', e);
        });

        db.ref('noticies').on('child_added', function(snap) {
            const key = snap.key;
            const data = snap.val();
            data.key = key;

            var existing = null;
            for (var i = 0; i < allNews.length; i++) {
                if (allNews[i].key === key) {
                    existing = allNews[i];
                    break;
                }
            }

            if (existing) {
                for (var prop in data) {
                    if (data.hasOwnProperty(prop)) {
                        existing[prop] = data[prop];
                    }
                }
            } else {
                allNews.push(data);
            }
            renderNews();
        });

        db.ref('noticies').on('child_removed', function(snap) {
            const key = snap.key;
            for (var i = 0; i < allNews.length; i++) {
                if (allNews[i].key === key) {
                    allNews.splice(i, 1);
                    break;
                }
            }
            renderNews();
        });

        db.ref('noticies').on('child_changed', function(snap) {
            const key = snap.key;
            const data = snap.val();
            data.key = key;

            for (var i = 0; i < allNews.length; i++) {
                if (allNews[i].key === key) {
                    for (var prop in data) {
                        if (data.hasOwnProperty(prop)) {
                            allNews[i][prop] = data[prop];
                        }
                    }
                    break;
                }
            }
            renderNews();
        });
    }

    // ============================================================
    // UI UPDATES
    // ============================================================
    function updateUI() {
        const adminBar = getElement('news-admin-bar');
        const userAvatar = getElement('news-admin-avatar');
        const userName = getElement('news-admin-name');
        const loginBtn = getElement('news-login-btn');
        const logoutBtn = getElement('news-logout-btn');
        const publishBtn = getElement('news-publish-btn-header');

        if (!adminBar) return;

        if (user) {
            if (userAvatar) userAvatar.textContent = (user.displayName || 'U')[0].toUpperCase();
            if (userName) userName.textContent = user.displayName || user.email || 'Usuari';
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-flex';

            if (user.uid === ADMIN_UID) {
                adminBar.style.display = 'flex';
                if (publishBtn) publishBtn.style.display = 'inline-flex';
            } else {
                adminBar.style.display = 'flex';
                if (publishBtn) publishBtn.style.display = 'none';
            }
        } else {
            if (userAvatar) userAvatar.textContent = '?';
            if (userName) userName.textContent = 'No autenticat';
            if (loginBtn) loginBtn.style.display = 'inline-flex';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (publishBtn) publishBtn.style.display = 'none';
        }
    }

    // ============================================================
    // INJECTAR HTML
    // ============================================================
    function injectHTML() {
        const container = getElement('newsContainer');
        if (!container) return;

        // Barra d'administració
        const adminHTML = `
            <div class="news-admin-bar" id="news-admin-bar" style="display:none;">
                <div class="admin-label">
                    <i class="fa-solid fa-user-shield"></i> Admin
                </div>
                <div class="admin-user">
                    <span class="admin-avatar" id="news-admin-avatar">?</span>
                    <span id="news-admin-name">No autenticat</span>
                </div>
                <button class="btn-news btn-news-primary" id="news-publish-btn-header" onclick="newsToggleForm()" style="display:none;">
                    <i class="fa-regular fa-pen-to-square"></i> Nova notícia
                </button>
                <button class="btn-news btn-news-primary" id="news-login-btn" onclick="newsLogin()" style="display:inline-flex;">
                    <i class="fa-solid fa-right-to-bracket"></i> Entrar
                </button>
                <button class="btn-news btn-news-outline" id="news-logout-btn" onclick="newsLogout()" style="display:none;">
                    <i class="fa-solid fa-sign-out-alt"></i> Sortir
                </button>
            </div>
        `;

        // Formulari
        const formHTML = `
            <div class="news-form" id="news-form">
                <div class="form-title" id="news-form-title">📝 Nova notícia</div>
                <textarea id="news-text" placeholder="Escriu la notícia aquí..." maxlength="500"></textarea>
                <div class="form-row">
                    <div class="img-upload" id="news-img-preview" onclick="document.getElementById('news-img-input').click()">
                        <i class="fa-regular fa-image" style="font-size:24px;opacity:0.4;"></i>
                    </div>
                    <input type="file" id="news-img-input" accept="image/*" style="display:none" onchange="newsHandleImage()">
                    <button class="btn-news-publish" id="news-publish-btn" onclick="newsPublish()">
                        <i class="fa-regular fa-paper-plane"></i> Publicar
                    </button>
                    <button class="btn-news-cancel" onclick="newsCancelEdit()">Cancel·lar</button>
                </div>
                <div class="form-hint"><i class="fa-regular fa-circle-info"></i> Màxim 500 caràcters · Imatge opcional (màxim 2MB)</div>
            </div>
        `;

        container.insertAdjacentHTML('beforebegin', adminHTML + formHTML);

        // Injectar Font Awesome si no existeix
        if (!document.querySelector('link[href*="font-awesome"]')) {
            var fa = document.createElement('link');
            fa.rel = 'stylesheet';
            fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
            document.head.appendChild(fa);
        }
    }

    // ============================================================
    // AUTH FUNCTIONS
    // ============================================================
    window.newsLogin = function() {
        if (!auth) return;
        var provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch(function(e) {
            alert('Error: ' + e.message);
        });
    };

    window.newsLogout = function() {
        if (!auth) return;
        if (confirm('Tancar sessió?')) {
            auth.signOut();
        }
    };

    // ============================================================
    // INICIALITZAR
    // ============================================================
    function init() {
        injectStyles();
        injectHTML();
        initFirebase();

        console.log('[noticies.js] Inicialitzat correctament');
        console.log('[noticies.js] Admin UID:', ADMIN_UID);
    }

    // ============================================================
    // EXECUTAR
    // ============================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.TempestescatNews = {
        reload: loadNews,
        publish: window.newsPublish,
        login: window.newsLogin,
        logout: window.newsLogout
    };

})();