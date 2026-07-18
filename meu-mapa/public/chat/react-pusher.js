// ========== SISTEMA DE REACCIONS AMB PUSHER ==========
window.REACTS_LLISTA = [
    { id: 'like', file: 'like.png', alt: 'Like' },
    { id: 'love', file: 'love.png', alt: 'Love' },
    { id: 'haha', file: 'haha.png', alt: 'Haha' },
    { id: 'wow',  file: 'wow.png',  alt: 'Wow' }
];

// Ruta de les imatges (funciona en local i en producció)
window.REACTS_PATH = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? 'chat/reacts/' 
    : 'https://tempestes-cat.pages.dev/chat/reacts/';

let reactPickerObert = null;

// Cache local de reaccions per missatge
window._reactionsCache = window._reactionsCache || {};

function urlSticker(f) { 
    return window.REACTS_PATH + f; 
}

function tancarPickerObert() {
    if (reactPickerObert) {
        const el = document.getElementById('react-picker-' + reactPickerObert);
        if (el) el.remove();
        reactPickerObert = null;
    }
}

// Tancar picker amb Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') tancarPickerObert();
});

// ========== OBRIR SAFATA DE REACCIONS ==========
window.toggleReactPicker = function (msgKey, btnEl) {
    tancarPickerObert();

    const picker = document.createElement('div');
    picker.className = 'react-picker';
    picker.id = 'react-picker-' + msgKey;

    window.REACTS_LLISTA.forEach(function (r) {
        const img = document.createElement('img');
        img.src = urlSticker(r.file);
        img.alt = r.id;
        img.className = 'react-picker-item';
        img.title = r.alt;
        img.onclick = function (e) {
            e.stopPropagation();
            e.preventDefault();
            window._enviarReaccio(msgKey, r.id);
            tancarPickerObert();
        };
        picker.appendChild(img);
    });

    // Posar el picker dins del missatge
    const msgEl = document.getElementById('msg-' + msgKey);
    if (msgEl) {
        msgEl.style.position = 'relative';
        msgEl.appendChild(picker);
        reactPickerObert = msgKey;
    }

    // Tancar amb clic fora
    setTimeout(function () {
        document.addEventListener('click', function clk(e) {
            if (!picker.contains(e.target)) {
                tancarPickerObert();
                document.removeEventListener('click', clk);
            }
        });
    }, 100);
};

// ========== ENVIAR REACCIÓ ==========
window._enviarReaccio = async function (msgKey, reactId) {
    const uid = localStorage.getItem('chatUserId') || 'anon_' + Math.random().toString(36).substr(2, 9);
    
    // Inicialitzar cache per aquest missatge
    if (!window._reactionsCache[msgKey]) {
        window._reactionsCache[msgKey] = {};
    }
    
    const reaccions = window._reactionsCache[msgKey];
    
    // Toggle: si l'usuari ja té aquesta reacció, eliminar-la
    if (reaccions[uid] === reactId) {
        delete reaccions[uid];
    } else {
        reaccions[uid] = reactId;
    }
    
    // PINTAR IMMEDIATAMENT (optimista)
    window.pintarReaccionsMsg(msgKey, reaccions);

    // Enviar al servidor en segon pla
    try {
        const response = await fetch('https://tempestes-cat.pages.dev/api/send-reaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                msgKey: msgKey, 
                reactId: reactId, 
                uid: uid 
            })
        });
        
        const data = await response.json();
        if (!data.ok) {
            console.warn('[REACT] Error del servidor, revertint...');
            // Revertir si el servidor falla
            if (reaccions[uid] === reactId) {
                delete reaccions[uid];
            } else {
                reaccions[uid] = reactId;
            }
            window.pintarReaccionsMsg(msgKey, reaccions);
        }
    } catch (err) {
        console.error('[REACT] Error de xarxa:', err);
        // No revertim, confiem en l'optimista
    }
};

// ========== PINTAR REACCIONS AL MISSATGE ==========
window.pintarReaccionsMsg = function (msgKey, reaccions) {
    const msgEl = document.getElementById('msg-' + msgKey);
    if (!msgEl) return;

    // Eliminar antic contenidor de reaccions
    const oldContainer = document.getElementById('reacts-' + msgKey);
    if (oldContainer) oldContainer.remove();

    // Si no hi ha reaccions, sortir
    if (!reaccions || Object.keys(reaccions).length === 0) return;

    // Comptar reaccions per tipus
    const comptador = {};
    Object.entries(reaccions).forEach(function (entry) {
        const uid = entry[0];
        const rid = entry[1];
        if (!comptador[rid]) {
            comptador[rid] = { count: 0, uids: [] };
        }
        comptador[rid].count++;
        comptador[rid].uids.push(uid);
    });

    // Crear contenidor
    const cont = document.createElement('div');
    cont.className = 'chat-msg-reacts';
    cont.id = 'reacts-' + msgKey;

    const myUid = localStorage.getItem('chatUserId') || '';

    // Crear píndoles per cada tipus de reacció
    Object.entries(comptador).forEach(function (entry) {
        const rid = entry[0];
        const info = entry[1];
        
        const reactInfo = window.REACTS_LLISTA.find(function (r) { return r.id === rid; });
        if (!reactInfo) return;
        
        const isMine = info.uids.includes(myUid);
        
        const pill = document.createElement('button');
        pill.className = 'react-pill' + (isMine ? ' mine' : '');
        pill.title = reactInfo.alt + ': ' + info.count;
        pill.innerHTML = 
            '<img src="' + urlSticker(reactInfo.file) + '" class="react-pill-img" alt="' + rid + '">' +
            '<span class="react-pill-count">' + info.count + '</span>';
        
        pill.onclick = function (e) {
            e.stopPropagation();
            e.preventDefault();
            window._enviarReaccio(msgKey, rid);
        };
        
        cont.appendChild(pill);
    });

    // Afegir al missatge
    if (cont.children.length > 0) {
        msgEl.appendChild(cont);
    }
};

// ========== ESCOLTAR REACCIONS PER PUSHER ==========
function initReactListener() {
    // Evitar inicialitzar dues vegades
    if (window._reactPusherReady) return;
    
    try {
        const reactPusher = new Pusher('54b645506c85aed5b62e', { 
            cluster: 'eu' 
        });
        
        const reactChannel = reactPusher.subscribe('reactions-channel');
        
        reactChannel.bind('reaction-updated', function (data) {
            const myUid = localStorage.getItem('chatUserId') || '';
            
            // Ignorar les nostres pròpies reaccions (ja les hem pintat)
            if (data.uid === myUid) return;
            
            const key = data.msgKey;
            if (!key) return;
            
            // Inicialitzar cache si cal
            if (!window._reactionsCache[key]) {
                window._reactionsCache[key] = {};
            }
            
            // Toggle al cache
            const current = window._reactionsCache[key][data.uid];
            if (current === data.reactId) {
                delete window._reactionsCache[key][data.uid];
            } else {
                window._reactionsCache[key][data.uid] = data.reactId;
            }
            
            // Pintar
            window.pintarReaccionsMsg(key, window._reactionsCache[key]);
        });
        
        window._reactPusherReady = true;
        console.log('[REACT] Pusher de reaccions inicialitzat ✅');
        
    } catch (err) {
        console.error('[REACT] Error inicialitzant Pusher:', err);
    }
}

// ========== INICIAR ==========
// Esperar que Pusher estigui disponible
function esperarPusher() {
    if (typeof Pusher !== 'undefined') {
        initReactListener();
    } else {
        setTimeout(esperarPusher, 200);
    }
}

// Iniciar quan el DOM estigui llest
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', esperarPusher);
} else {
    esperarPusher();
}