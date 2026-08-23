import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const fc = {
    apiKey: 'AIzaSyBGcGUk2gsoDaHkg9Yv-nqMJ5_x-QPTMS8',
    authDomain: 'tempestescat.firebaseapp.com',
    databaseURL: 'https://tempestescat-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'tempestescat',
    storageBucket: 'tempestescat.firebasestorage.app',
    messagingSenderId: '683240351775',
    appId: '1:683240351775:web:bc65d73249537b9cc28d2a'
};

const app = initializeApp(fc);
const auth = getAuth(app);

window.loginWithGoogle = async function() {
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error(error);
    }
};

window.visorLogout = async function() {
    try { await signOut(auth); } catch (error) { console.error(error); }
};

onAuthStateChanged(auth, function(user) {
    window._firebaseUser = user;
    if (user) window.dispatchEvent(new CustomEvent('tc:login', { detail: user }));
    else window.dispatchEvent(new CustomEvent('tc:logout'));
});
