// ═══════════════════════════════════════════════════════
//  TEMPESTES.CAT · Firebase Auth + Realtime Database
//  Fitxer: public/js/auth.js
// ═══════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  get
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── CONFIG ────────────────────────────────────────────
const _0x4da217=_0x4e5c;(function(_0x32be16,_0x1e52f2){const _0x18094b=_0x4e5c,_0xac8185=_0x32be16();while(!![]){try{const _0x53af9d=-parseInt(_0x18094b(0xad))/0x1*(-parseInt(_0x18094b(0x97))/0x2)+parseInt(_0x18094b(0xaa))/0x3*(parseInt(_0x18094b(0x9e))/0x4)+-parseInt(_0x18094b(0xa6))/0x5+parseInt(_0x18094b(0x9d))/0x6+-parseInt(_0x18094b(0x9a))/0x7*(parseInt(_0x18094b(0x99))/0x8)+parseInt(_0x18094b(0x95))/0x9*(parseInt(_0x18094b(0xb1))/0xa)+-parseInt(_0x18094b(0xa0))/0xb;if(_0x53af9d===_0x1e52f2)break;else _0xac8185['push'](_0xac8185['shift']());}catch(_0xf806a4){_0xac8185['push'](_0xac8185['shift']());}}}(_0x4152,0xa92ab));const _0x3e2def=(function(){let _0x2850f0=!![];return function(_0xa33c90,_0x4487b1){const _0x1a2792=_0x2850f0?function(){const _0x44406f=_0x4e5c;if(_0x4487b1){const _0x1a8177=_0x4487b1[_0x44406f(0x98)](_0xa33c90,arguments);return _0x4487b1=null,_0x1a8177;}}:function(){};return _0x2850f0=![],_0x1a2792;};}()),_0x3c9e44=_0x3e2def(this,function(){const _0x43e0b8=_0x4e5c;return _0x3c9e44[_0x43e0b8(0x9f)]()[_0x43e0b8(0xb0)](_0x43e0b8(0xa3)+'+$')[_0x43e0b8(0x9f)]()['constructo'+'r'](_0x3c9e44)[_0x43e0b8(0xb0)](_0x43e0b8(0xa3)+'+$');});function _0x4e5c(_0x1513bd,_0x418c8a){_0x1513bd=_0x1513bd-0x92;const _0x336ad7=_0x4152();let _0x3c9e44=_0x336ad7[_0x1513bd];return _0x3c9e44;}_0x3c9e44();const firebaseConfig={'apiKey':_0x4da217(0x9c)+_0x4da217(0xa1)+_0x4da217(0x94)+_0x4da217(0xa8),'authDomain':_0x4da217(0xaf)+_0x4da217(0xac)+'eapp.com','databaseURL':_0x4da217(0xab)+'mpestescat'+_0x4da217(0xa4)+_0x4da217(0x92)+_0x4da217(0xa7)+_0x4da217(0xa9)+_0x4da217(0x93),'projectId':'tempestesc'+'at','storageBucket':_0x4da217(0xaf)+_0x4da217(0xac)+'estorage.a'+'pp','messagingSenderId':_0x4da217(0x9b)+'75','appId':_0x4da217(0xae)+_0x4da217(0x96)+_0x4da217(0xa5)+_0x4da217(0xb2)+'a','measurementId':_0x4da217(0xa2)+'XF'};function _0x4152(){const _0xd20e58=['3cPCrMp','https://te','at.firebas','37223OlVbay','1:68324035','tempestesc','search','4291190VHBzGI','37b9cc28d2','tdb.europe','ase.app','g9Yv-nqMJ5','9LNmRWS','1775:web:b','24AnxYRm','apply','752lWrirz','21441nEnEEy','6832403517','AIzaSyBGcG','5784126FQudBo','1410092JUktod','toString','3981021tGrExq','Uk2gsoDaHk','G-QDWCZ0Z9','(((.+)+)+)','-default-r','c65d732495','4247995SToRNr','-west1.fir','_x-QPTMS8','ebasedatab'];_0x4152=function(){return _0xd20e58;};return _0x4152();}

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

window._firebaseAuth   = auth;
window._googleProvider = googleProvider;
window._visorAuthAction = 'login';

// ── ESTAT ─────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (user) {
    window._firebaseUser = user;
    showUserUI(user);
    window.dispatchEvent(new CustomEvent('tc:login', { detail: user }));
  } else {
    window._firebaseUser = null;
    showLoggedOutUI();
    window.dispatchEvent(new CustomEvent('tc:logout'));
  }
});

// ── GUARDAR / CARREGAR variable activa ────────────────
window.tcSaveVar = async function(visor, varKey) {
  const user = auth.currentUser;
  if (!user) return;
  try { await set(ref(db, `users/${user.uid}/prefs/${visor}/lastVar`), varKey); }
  catch(e) { console.warn('[TC] Error guardant variable:', e); }
};

window.tcLoadVar = async function(visor) {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const snap = await get(ref(db, `users/${user.uid}/prefs/${visor}/lastVar`));
    return snap.exists() ? snap.val() : null;
  } catch(e) { console.warn('[TC] Error carregant variable:', e); return null; }
};

// ── UI loguejat ───────────────────────────────────────
function showUserUI(user) {
  const name    = user.displayName || user.email.split('@')[0];
  const initial = name[0].toUpperCase();

  const avatar = document.getElementById('user-avatar-icon');
  const uname  = document.getElementById('user-display-name');
  const ddName = document.getElementById('dd-name');
  const ddMail = document.getElementById('dd-email');
  const btn    = document.getElementById('btn-open-auth');
  const pill   = document.getElementById('user-pill');

  if (avatar) avatar.textContent = initial;
  if (uname)  uname.textContent  = name;
  if (ddName) ddName.textContent = name;
  if (ddMail) ddMail.textContent = user.email;
  if (btn)    btn.style.display  = 'none';
  if (pill)   pill.style.display = 'flex';

  if (typeof closeAuth === 'function') closeAuth();

  if (typeof window._onVisorAuthChange === 'function') {
    window._onVisorAuthChange(user);
  }
}

// ── UI desloguejat ────────────────────────────────────
function showLoggedOutUI() {
  const btn  = document.getElementById('btn-open-auth');
  const pill = document.getElementById('user-pill');
  const dd   = document.getElementById('user-dropdown');
  if (btn)  btn.style.display  = 'flex';
  if (pill) pill.style.display = 'none';
  if (dd)   dd.classList.remove('open');

  if (typeof window._onVisorAuthChange === 'function') {
    window._onVisorAuthChange(null);
  }
}

window.loginWithGoogle = async function () {
    window._visorAuthAction = 'login'; // ← marcar
  const isVisor = !!document.getElementById('auth-modal-visor');
  const msgFn   = isVisor ? showVisorMsgLocal : showAuthMsg;
  clearAllAuthMsg();
  msgFn('🔄 Connectant amb Google...', 'success');
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    msgFn(firebaseError(err.code), 'error');
  }
};

// ── EMAIL LOGIN (index.html) ──────────────────────────
window.loginWithEmail = async function () {
  const email = document.getElementById('login-email')?.value.trim();
  const pass  = document.getElementById('login-password')?.value;
  if (!email || !pass) { showAuthMsg('❌ Omple tots els camps.', 'error'); return; }
  clearAllAuthMsg();
  showAuthMsg('🔄 Entrant...', 'success');
  try { await signInWithEmailAndPassword(auth, email, pass); }
  catch (err) { showAuthMsg(firebaseError(err.code), 'error'); }
};

// ── EMAIL REGISTER (index.html) ───────────────────────
window.registerWithEmail = async function () {
  const name  = document.getElementById('reg-name')?.value.trim();
  const email = document.getElementById('reg-email')?.value.trim();
  const pass  = document.getElementById('reg-password')?.value;
  const pass2 = document.getElementById('reg-password2')?.value;
  if (!name || !email || !pass || !pass2) { showAuthMsg('❌ Omple tots els camps.', 'error'); return; }
  if (pass !== pass2)  { showAuthMsg('❌ Les contrasenyes no coincideixen.', 'error'); return; }
  if (pass.length < 6) { showAuthMsg('❌ Mínim 6 caràcters.', 'error'); return; }
  clearAllAuthMsg();
  showAuthMsg('🔄 Creant compte...', 'success');
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    showUserUI({ ...cred.user, displayName: name });
  } catch (err) { showAuthMsg(firebaseError(err.code), 'error'); }
};

// ── FORGOT PASSWORD ───────────────────────────────────
window.showForgot = async function (e) {
  e.preventDefault();
  const email = document.getElementById('login-email')?.value.trim();
  if (!email) { showAuthMsg('💡 Introdueix el teu correu primer.', 'error'); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    showAuthMsg(`📧 Correu de recuperació enviat a ${email}`, 'success');
  } catch (err) { showAuthMsg(firebaseError(err.code), 'error'); }
};

// ── LOGOUT ────────────────────────────────────────────
window.logoutUser = async function () {
  try { await signOut(auth); }
  catch (err) { console.error('Error logout:', err); }
};

// ── ERRORS Firebase ───────────────────────────────────
function firebaseError(code) {
  const errors = {
    'auth/user-not-found':         '❌ No existeix cap compte amb aquest correu.',
    'auth/wrong-password':         '❌ Contrasenya incorrecta.',
    'auth/email-already-in-use':   '❌ Aquest correu ja està registrat.',
    'auth/invalid-email':          '❌ Correu electrònic no vàlid.',
    'auth/weak-password':          '❌ Contrasenya massa feble (mínim 6 caràcters).',
    'auth/popup-closed-by-user':   '⚠️ Has tancat la finestra de Google.',
    'auth/network-request-failed': '❌ Error de xarxa. Comprova la connexió.',
    'auth/too-many-requests':      '⚠️ Massa intents. Espera uns minuts.',
    'auth/invalid-credential':     '❌ Credencials incorrectes.',
  };
  return errors[code] || `❌ Error: ${code}`;
}

// ── HELPERS missatges ─────────────────────────────────
window.showAuthMsg = function(text, type) {
  const m = document.getElementById('auth-msg');
  if (!m) return;
  m.textContent = text;
  m.className   = 'auth-msg ' + type;
  if (type === 'success') setTimeout(() => { if (m.textContent === text) clearAllAuthMsg(); }, 3000);
};

function showVisorMsgLocal(text, type) {
  const m = document.getElementById('auth-msg-v');
  if (!m) return;
  m.textContent = text;
  m.className   = 'auth-msg-v ' + type;
}

window.clearAuthMsg = function() {
  const m = document.getElementById('auth-msg');
  if (!m) return;
  m.className = 'auth-msg'; m.textContent = '';
};

function clearAllAuthMsg() {
  if (typeof window.clearAuthMsg === 'function') window.clearAuthMsg();
  const mv = document.getElementById('auth-msg-v');
  if (mv) { mv.className = 'auth-msg-v'; mv.textContent = ''; }
}

window.closeAuth = function() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
  clearAllAuthMsg();
};

// ── Funcions exposades per als visors ─────────────────
window._tcLoginEmail = async function(email, pass) {
  return signInWithEmailAndPassword(auth, email, pass);
};

window._tcRegisterEmail = async function(email, pass, name) {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  if (name) await updateProfile(cred.user, { displayName: name });
  return cred;
};

window._tcForgot = async function(email) {
  return sendPasswordResetEmail(auth, email);
};

window._tcLogout = async function() {
  return signOut(auth);
};