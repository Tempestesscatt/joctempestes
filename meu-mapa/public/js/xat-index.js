// ═══════════════════════════════════════════════════════════════════════
//  XAT - TEMPESTES.CAT (index.html)
//  Amb badge de notificacions i caché persistent a localStorage
// ═══════════════════════════════════════════════════════════════════════

const PUSHER_KEY = '54b645506c85aed5b62e';
const PUSHER_CLUSTER = 'eu';
const API_URL_CHAT = 'https://tempestes-cat.pages.dev/api';
const LS_VISTOS = 'xat_vistos_index';

let xatObert = false;
let missatgesActuals = [];

// ═══════════════════════════════════════════════════════════════════
//  LOCALSTORAGE
// ═══════════════════════════════════════════════════════════════════

function obtenirVistos() {
    try {
        const d = localStorage.getItem(LS_VISTOS);
        return d ? new Set(JSON.parse(d)) : new Set();
    } catch(e) { return new Set(); }
}

function guardarVistos(set) {
    try {
        let arr = Array.from(set);
        if (arr.length > 500) arr = arr.slice(-500);
        localStorage.setItem(LS_VISTOS, JSON.stringify(arr));
    } catch(e) {}
}

function msgId(msg) {
    return msg.id || `${msg.ts}_${msg.uid || msg.nick}_${(msg.text || '').substring(0, 20)}`;
}

// ═══════════════════════════════════════════════════════════════════
//  BADGE
// ═══════════════════════════════════════════════════════════════════

function actualitzarBadge() {
    const btn = document.querySelector('.btn-xat-topbar');
    if (!btn) return;

    const vistos = obtenirVistos();
    let count = 0;
    missatgesActuals.slice(-50).forEach(m => {
        if (m.type === 'system') return;
        if (!vistos.has(msgId(m))) count++;
    });

    // Eliminar badge anterior
    const old = btn.querySelector('.xat-badge');
    if (old) old.remove();

    // Crear badge nou si cal
    if (count > 0) {
        const b = document.createElement('span');
        b.className = 'xat-badge';
        b.textContent = count > 99 ? '99+' : count;
        btn.appendChild(b);
    }
}

function marcarTotsVistos() {
    const vistos = obtenirVistos();
    missatgesActuals.forEach(m => {
        if (m.type !== 'system') vistos.add(msgId(m));
    });
    guardarVistos(vistos);
    actualitzarBadge();
}

// ═══════════════════════════════════════════════════════════════════
//  TOGGLE XAT
// ═══════════════════════════════════════════════════════════════════

window.toggleXat = function() {
    xatObert = !xatObert;
    const modal = document.getElementById('xatModal');
    if (!modal) return;

    modal.classList.toggle('active', xatObert);

    if (xatObert) {
        carregarMissatges().then(() => {
            setTimeout(marcarTotsVistos, 800);
        });
        const inp = document.getElementById('xatInput');
        if (inp) setTimeout(() => inp.focus(), 300);
        actualitzarBoto();
    }
};

// ═══════════════════════════════════════════════════════════════════
//  UTILITATS
// ═══════════════════════════════════════════════════════════════════

function esc(t) {
    return (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hora(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

function colorAvatar(n) {
    const c = ['#4080c0','#c04040','#40a060','#c08020','#8040c0','#20a0a0','#c04080','#608020'];
    let h = 0;
    for (let i = 0; i < (n || '').length; i++) h = (h * 31 + n.charCodeAt(i)) & 0xffff;
    return c[h % c.length];
}

// ═══════════════════════════════════════════════════════════════════
//  RENDER MISSATGE
// ═══════════════════════════════════════════════════════════════════

const renderitzats = new Set();

function renderMissatge(msg) {
    const cont = document.getElementById('xatModalMsgs');
    if (!cont) return;

    const id = msgId(msg);
    if (renderitzats.has(id)) return;
    renderitzats.add(id);
    if (renderitzats.size > 200) {
        [...renderitzats].slice(0, 50).forEach(x => renderitzats.delete(x));
    }

    const isSys = msg.type === 'system';
    const cl = colorAvatar(msg.nick || 'X');
    const av = msg.photo && msg.photo.length < 5000
        ? '<img src="' + esc(msg.photo) + '" alt="">'
        : (msg.nick || '?')[0].toUpperCase();

    let rang = '';
    if (!isSys && msg.rangNom) {
        rang = `<span style="font-size:8px;background:${msg.rangColor || '#556680'};color:#fff;padding:0px 7px;border-radius:10px;font-weight:700;margin-left:4px;">${esc(msg.rangNom)}</span>`;
    }
    let punts = '';
    if (!isSys && msg.punts !== undefined && msg.punts !== null) {
        punts = `<span style="font-size:8px;color:#FFD700;margin-left:3px;">⭐ ${msg.punts.toLocaleString('ca')}</span>`;
    }

    const div = document.createElement('div');
    div.className = 'xat-modal-msg' + (isSys ? ' system' : '');

    if (isSys) {
        div.innerHTML = '<div class="xat-modal-msg-bubble">' + esc(msg.text) + '</div>';
    } else {
        div.innerHTML = `
            <div class="xat-modal-msg-header">
                <div class="xat-modal-msg-avatar" style="background:${cl}">${av}</div>
                <span class="xat-modal-msg-name">${esc(msg.nick || 'Anonim')}</span>
                ${rang}${punts}
                <span class="xat-modal-msg-time">${hora(msg.ts)}</span>
            </div>
            <div class="xat-modal-msg-bubble">${esc(msg.text || '')}</div>
        `;
    }

    cont.appendChild(div);
    while (cont.children.length > 50) cont.removeChild(cont.firstChild);
    cont.scrollTop = cont.scrollHeight;
}

// ═══════════════════════════════════════════════════════════════════
//  CARREGAR MISSATGES
// ═══════════════════════════════════════════════════════════════════

async function carregarMissatges() {
    const cont = document.getElementById('xatModalMsgs');
    if (!cont) return;

    try {
        const r = await fetch(API_URL_CHAT + '/get-messages');
        const msgs = await r.json();
        cont.innerHTML = '';
        renderitzats.clear();

        if (msgs && msgs.length) {
            missatgesActuals = msgs;
            msgs.slice(-30).forEach(renderMissatge);
        } else {
            cont.innerHTML = '<div style="text-align:center;color:#556680;padding:20px;font-size:13px;">Encara no hi ha missatges</div>';
            missatgesActuals = [];
        }
    } catch(e) {
        console.error('[Xat] Error carregant:', e);
        cont.innerHTML = '<div style="text-align:center;color:#556680;padding:20px;font-size:13px;">Error carregant xat</div>';
    }
}

// ═══════════════════════════════════════════════════════════════════
//  ENVIAR MISSATGE
// ═══════════════════════════════════════════════════════════════════

window.enviarMissatgeXat = async function() {
    const inp = document.getElementById('xatInput');
    const text = inp?.value?.trim();
    if (!text) return;

    const user = window._firebaseUser;
    if (!user) { alert('Has d\'iniciar sessió per xatejar!'); return; }

    const nick = user.displayName || (user.email ? user.email.split('@')[0] : 'Usuari');
    const photo = user.photoURL || '';
    const uid = user.uid || 'anon';

    let rangNom = '', rangColor = '#556680', punts = 0;
    try {
        if (window.TempestescatRangs) {
            const r = window.TempestescatRangs.obtenirRang();
            punts = window.TempestescatRangs.obtenirPunts();
            if (r && r.nom) { rangNom = r.nom; rangColor = r.color || '#556680'; }
        }
    } catch(e) {}

    const btn = document.getElementById('xatSendBtn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    try {
        const r = await fetch(API_URL_CHAT + '/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nick, photo, uid, text, rangNom, rangColor, punts: Math.round(punts) })
        });
        const d = await r.json();

        if (d.ok) {
            if (inp) inp.value = '';
            actualitzarBoto();
            if (btn) { btn.textContent = 'OK'; setTimeout(() => { if (btn) btn.textContent = 'Enviar'; }, 1000); }

            // El nostre propi missatge → marcar com a vist
            if (d.message) {
                const v = obtenirVistos();
                v.add(msgId(d.message));
                guardarVistos(v);
            }
        } else {
            alert('Error: ' + (d.error || 'No s\'ha pogut enviar'));
            if (btn) { btn.disabled = false; btn.textContent = 'Enviar'; }
        }
    } catch(e) {
        console.error('[Xat] Error enviant:', e);
        alert('Error enviant missatge');
        if (btn) { btn.disabled = false; btn.textContent = 'Enviar'; }
    }
};

// ═══════════════════════════════════════════════════════════════════
//  ESTAT BOTÓ ENVIAR
// ═══════════════════════════════════════════════════════════════════

function actualitzarBoto() {
    const inp = document.getElementById('xatInput');
    const btn = document.getElementById('xatSendBtn');
    if (!inp || !btn) return;

    const ok = inp.value.trim().length > 0 && window._firebaseUser;
    btn.disabled = !ok;
    btn.style.opacity = ok ? '1' : '0.5';
    btn.style.cursor = ok ? 'pointer' : 'not-allowed';
}

// ═══════════════════════════════════════════════════════════════════
//  PUSHER (temps real)
// ═══════════════════════════════════════════════════════════════════

function initPusher() {
    try {
        if (typeof Pusher === 'undefined') {
            console.warn('[Xat] Pusher no carregat');
            return;
        }
        const p = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
        const ch = p.subscribe('chat-channel');

        ch.bind('new-message', function(msg) {
            missatgesActuals.push(msg);
            if (missatgesActuals.length > 100) missatgesActuals = missatgesActuals.slice(-100);

            if (xatObert) {
                renderMissatge(msg);
                const v = obtenirVistos();
                v.add(msgId(msg));
                guardarVistos(v);
            }
            actualitzarBadge();
        });
    } catch(e) {
        console.warn('[Xat] Pusher no disponible:', e);
    }
}

// ═══════════════════════════════════════════════════════════════════
//  INICIALITZACIÓ
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
    // Input del xat
    const inp = document.getElementById('xatInput');
    if (inp) {
        inp.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); window.enviarMissatgeXat(); }
        });
        inp.addEventListener('input', actualitzarBoto);
    }

    // Carregar missatges inicials per al badge
    fetch(API_URL_CHAT + '/get-messages')
        .then(r => r.json())
        .then(msgs => {
            if (msgs && msgs.length) {
                missatgesActuals = msgs;
                actualitzarBadge();
            }
        })
        .catch(e => console.warn('[Xat] Error inicial:', e));

    // Pusher
    setTimeout(initPusher, 1500);

    // ESC per tancar
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && xatObert) window.toggleXat();
    });

    // Clic fora per tancar
    const modal = document.getElementById('xatModal');
    if (modal) {
        modal.addEventListener('click', e => {
            if (e.target === modal) window.toggleXat();
        });
    }
});