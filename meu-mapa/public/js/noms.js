// ═══════════════════════════════════════════════════════════════════════
//  NOMS.JS — Llegeix el nom personalitzat guardat i el fa servir al xat
//  Sense opció de canviar-lo. Només lectura.
// ═══════════════════════════════════════════════════════════════════════

(function() {
    'use strict';
    
    const RTDB_URL = 'https://tempestescat-default-rtdb.firebaseio.com';
    const API_URL = 'https://tempestes-cat.pages.dev/api';
    let cacheNom = {};
    let cacheFoto = {};
    
    // ═══════════════════════════════════════════════════════════════
    //  OBTENIR NOM PERSONALITZAT (només lectura)
    // ═══════════════════════════════════════════════════════════════
    
    async function obtenirNomUsuari(user) {
        if (!user) return null;
        if (cacheNom[user.uid]) return cacheNom[user.uid];
        
        // 1. localStorage (el més ràpid)
        const nomLocal = localStorage.getItem('nom_usuari_' + user.uid);
        if (nomLocal && nomLocal !== 'undefined' && nomLocal !== 'null') {
            cacheNom[user.uid] = nomLocal;
            return nomLocal;
        }
        
        // 2. Realtime Database
        try {
            const resposta = await fetch(RTDB_URL + '/users/' + user.uid + '/nomPersonalitzat.json');
            if (resposta.ok) {
                const dades = await resposta.json();
                if (dades && typeof dades === 'string') {
                    localStorage.setItem('nom_usuari_' + user.uid, dades);
                    cacheNom[user.uid] = dades;
                    return dades;
                }
            }
        } catch (e) {}
        
        // 3. Fallback: nom de Google
        const nomGoogle = user.displayName || (user.email ? user.email.split('@')[0] : 'Usuari');
        cacheNom[user.uid] = nomGoogle;
        return nomGoogle;
    }
    
    // ═══════════════════════════════════════════════════════════════
    //  OBTENIR FOTO (només lectura)
    // ═══════════════════════════════════════════════════════════════
    
    async function obtenirFotoUsuari(user) {
        if (!user) return null;
        if (cacheFoto[user.uid]) return cacheFoto[user.uid];
        
        const fotoLocal = localStorage.getItem('foto_usuari_' + user.uid);
        if (fotoLocal && fotoLocal.startsWith('data:image')) {
            cacheFoto[user.uid] = fotoLocal;
            return fotoLocal;
        }
        
        try {
            const resposta = await fetch(RTDB_URL + '/users/' + user.uid + '/fotoPerfil.json');
            if (resposta.ok) {
                const dades = await resposta.json();
                if (dades && typeof dades === 'string' && dades.startsWith('data:image')) {
                    localStorage.setItem('foto_usuari_' + user.uid, dades);
                    cacheFoto[user.uid] = dades;
                    return dades;
                }
            }
        } catch (e) {}
        
        const fotoGoogle = user.photoURL || null;
        cacheFoto[user.uid] = fotoGoogle;
        return fotoGoogle;
    }
    
    // ═══════════════════════════════════════════════════════════════
    //  ENVIAR MISSATGE AMB FALLBACK
    // ═══════════════════════════════════════════════════════════════
    
    async function enviarMissatgeAmbFallback(missatge) {
        // Intent 1: API normal
        try {
            const resp = await fetch(API_URL + '/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(missatge)
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.ok) return { exit: true, metode: 'api' };
            }
        } catch (e) {
            console.warn('[Xat] API fallida, provant RTDB...');
        }
        
        // Intent 2: Realtime Database
        try {
            const token = await window._firebaseUser.getIdToken();
            const resp = await fetch(RTDB_URL + '/chat/messages.json?auth=' + token, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(missatge)
            });
            if (resp.ok) return { exit: true, metode: 'rtdb' };
        } catch (e) {
            console.warn('[Xat] RTDB fallida, guardant localment...');
        }
        
        // Intent 3: localStorage (sempre funciona)
        try {
            const missatgesLocals = JSON.parse(localStorage.getItem('missatges_pendents') || '[]');
            missatgesLocals.push({
                ...missatge,
                ts: Date.now(),
                pendent: true
            });
            localStorage.setItem('missatges_pendents', JSON.stringify(missatgesLocals));
            return { exit: true, metode: 'local' };
        } catch (e) {
            return { exit: false, error: 'No s\'ha pogut enviar' };
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    //  UTILITATS
    // ═══════════════════════════════════════════════════════════════
    
    function escHtml(t) {
        return (t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    
    function formatTime(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
    }
    
    function getAvatarColor(nom) {
        const colors = ['#4080c0','#c04040','#40a060','#c08020','#8040c0','#20a0a0','#c04080','#608020','#204080','#806020'];
        let h = 0;
        for (let i = 0; i < (nom || '').length; i++) h = (h * 31 + nom.charCodeAt(i)) & 0xffff;
        return colors[h % colors.length];
    }
    
    // ═══════════════════════════════════════════════════════════════
    //  MOSTRAR MISSATGE LOCALMENT
    // ═══════════════════════════════════════════════════════════════
    
    function mostrarMissatgeLocal(missatge) {
        const msgs = document.getElementById('xatMsgs');
        if (!msgs) return;
        
        const cl = getAvatarColor(missatge.nick || 'X');
        const av = missatge.photo && missatge.photo.length < 5000 
            ? '<img src="' + escHtml(missatge.photo) + '" alt="">' 
            : (missatge.nick || '?')[0].toUpperCase();
        
        let rangInfo = '';
        if (missatge.rangNom) {
            rangInfo = '<span style="font-size:8px;background:' + (missatge.rangColor || '#556680') + ';color:#fff;padding:0px 7px;border-radius:10px;font-weight:700;margin-left:4px;">' + escHtml(missatge.rangNom) + '</span>';
        }
        
        const div = document.createElement('div');
        div.className = 'xat-msg';
        div.innerHTML = '<div class="xat-msg-header">' +
            '<div class="xat-msg-avatar" style="background:' + cl + '">' + av + '</div>' +
            '<span class="xat-msg-name">' + escHtml(missatge.nick || 'Anonim') + '</span>' +
            rangInfo +
            '<span class="xat-msg-time">' + formatTime(missatge.ts) + '</span>' +
            '</div><div class="xat-msg-bubble">' + escHtml(missatge.text) + '</div>';
        
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
    }
    
    // ═══════════════════════════════════════════════════════════════
    //  INTEGRACIÓ AMB EL XAT
    // ═══════════════════════════════════════════════════════════════
    
    function integrarAmbXat() {
        let intents = 0;
        const maxIntents = 20;
        
        const intentar = setInterval(function() {
            intents++;
            
            if (typeof window.enviarMissatgeXatHome === 'function' || intents >= maxIntents) {
                clearInterval(intentar);
                
                if (typeof window.enviarMissatgeXatHome === 'function') {
                    window.enviarMissatgeXatHome = async function() {
                        const input = document.getElementById('xatHomeInput');
                        const text = input?.value?.trim();
                        if (!text) return;
                        
                        const user = window._firebaseUser;
                        if (!user) {
                            alert("Has d'iniciar sessió per xatejar!");
                            return;
                        }
                        
                        // SEMPRE fer servir el nom personalitzat guardat
                        const nick = await obtenirNomUsuari(user);
                        const photo = await obtenirFotoUsuari(user) || user.photoURL || '';
                        const uid = user.uid || 'anon';
                        
                        let rangNom = '', rangColor = '#556680', punts = 0;
                        try {
                            if (window.TempestescatRangs) {
                                const rang = window.TempestescatRangs.obtenirRang();
                                punts = window.TempestescatRangs.obtenirPunts();
                                if (rang && rang.nom) {
                                    rangNom = rang.nom;
                                    rangColor = rang.color || '#556680';
                                }
                            }
                        } catch (e) {}
                        
                        const btn = document.getElementById('xatHomeSendBtn');
                        if (btn) { btn.disabled = true; btn.textContent = '...'; }
                        
                        const missatge = {
                            nick: nick,
                            photo: photo,
                            uid: uid,
                            text: text,
                            rangNom: rangNom,
                            rangColor: rangColor,
                            punts: Math.round(punts),
                            ts: Date.now()
                        };
                        
                        const resultat = await enviarMissatgeAmbFallback(missatge);
                        
                        if (resultat.exit) {
                            if (input) input.value = '';
                            if (btn) { btn.textContent = 'OK'; setTimeout(function() { if (btn) btn.textContent = 'Enviar'; }, 1000); }
                            
                            mostrarMissatgeLocal(missatge);
                        } else {
                            alert(resultat.error || 'Error enviant missatge');
                        }
                        
                        if (typeof actualitzarEstatBotoXatHome === 'function') {
                            actualitzarEstatBotoXatHome();
                        }
                    };
                    
                    console.log('[Noms] Xat integrat amb nom personalitzat');
                }
            }
        }, 500);
    }
    
    // ═══════════════════════════════════════════════════════════════
    //  ACTUALITZAR UI (només lectura)
    // ═══════════════════════════════════════════════════════════════
    
    function actualitzarUI() {
        const user = window._firebaseUser;
        if (!user) return;
        
        obtenirNomUsuari(user).then(function(nom) {
            const nameEl = document.getElementById('userDisplayName');
            if (nameEl) nameEl.textContent = nom;
            
            obtenirFotoUsuari(user).then(function(foto) {
                const avatar = document.getElementById('userAvatarFallback');
                if (avatar) {
                    if (foto && foto.startsWith('data:image')) {
                        avatar.innerHTML = '<img src="' + foto + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
                    } else if (user.photoURL) {
                        avatar.innerHTML = '<img src="' + user.photoURL + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
                    } else {
                        avatar.textContent = nom.charAt(0).toUpperCase();
                    }
                }
            });
        });
    }
    
    function inicialitzar() {
        window.addEventListener('tc:login', function(e) {
            const user = e.detail;
            if (user) {
                delete cacheNom[user.uid];
                delete cacheFoto[user.uid];
                setTimeout(actualitzarUI, 300);
                integrarAmbXat();
            }
        });
        
        if (window._firebaseUser) {
            setTimeout(actualitzarUI, 300);
        }
        
        integrarAmbXat();
        console.log('[Noms] Carregat (només lectura)');
    }
    
    window.Noms = {
        obtenirNomUsuari: obtenirNomUsuari,
        obtenirFotoUsuari: obtenirFotoUsuari,
        actualitzarUI: actualitzarUI
    };
    
    if (document.readyState === 'complete') {
        inicialitzar();
    } else {
        window.addEventListener('load', inicialitzar);
    }
    
})();