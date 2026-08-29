// ═══════════════════════════════════════════════════════════════════════
//  server.js - VERSIÓ CORREGIDA
// ═══════════════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');


// ═══ IMPORTAR FIREBASE ADMIN ═══
let admin;
try {
    admin = require('firebase-admin');
    console.log('✅ Firebase Admin carregat correctament');
    console.log('   Versió:', admin.SDK_VERSION || 'desconeguda');
} catch (error) {
    console.error('❌ Error carregant firebase-admin:', error.message);
    console.log('   Executa: npm install firebase-admin@11.11.1');
    process.exit(1);
}

// ═══ VERIFICAR QUE EL FITXER EXISTEIX ═══
const serviceAccountPath = './serviceAccountKey.json';

if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ No s\'ha trobat serviceAccountKey.json');
    console.error('   Descarrega\'l de Firebase Console i posa\'l aquí');
    process.exit(1);
}

// ═══ LLEGIR EL FITXER DE CREDENCIALS ═══
let serviceAccount;
try {
    const fileContent = fs.readFileSync(serviceAccountPath, 'utf8');
    serviceAccount = JSON.parse(fileContent);
    console.log('✅ serviceAccountKey.json carregat correctament');
    console.log('   Projecte:', serviceAccount.project_id || 'desconegut');
} catch (error) {
    console.error('❌ Error carregant serviceAccountKey.json:', error.message);
    process.exit(1);
}

// ═══ COMPROVAR QUE admin.credential EXISTEIX ═══
console.log('🔍 Comprovant admin.credential...');
console.log('   admin.credential:', typeof admin.credential);
console.log('   admin.credential.cert:', typeof admin.credential?.cert);

if (!admin.credential || typeof admin.credential.cert !== 'function') {
    console.error('❌ admin.credential.cert no està disponible');
    console.error('   Això pot passar si firebase-admin no s\'ha instal·lat correctament');
    console.log('   Executa: npm install firebase-admin@11.11.1');
    process.exit(1);
}

// ═══ INICIALITZAR FIREBASE ADMIN ═══
try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://tempestescat-default-rtdb.europe-west1.firebasedatabase.app"
    });
    console.log('✅ Firebase Admin inicialitzat correctament');
} catch (error) {
    console.error('❌ Error inicialitzant Firebase Admin:', error.message);
    process.exit(1);
}

const db = admin.firestore();
const app = express();
const PORT = process.env.PORT || 3000;

// ═══ MIDDLEWARE ═══
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST']
}));
app.use(express.json());

// Servir fitxers estàtics
app.use(express.static('public'));

console.log(`📁 Servint fitxers des de: ${path.join(__dirname, 'public')}`);



// ─── Verificar accés a variables premium ──────────────────────────────
function verificarAccesVariable(clau) {
    // Si l'usuari no està loguejat, només pot veure variables lliures
    const user = window._firebaseUser || null;
    if (!user) {
        // Variables lliures (cada 3 hores)
        const VARIABLES_LLIURES = new Set([
            'st', 'sd', 'srh', 'temp_min2m', 'temp_max2m', 
            'wind_speed_10m', 'wind_gust'
        ]);
        return VARIABLES_LLIURES.has(clau);
    }
    
    // Si l'usuari és premium, pot veure totes
    if (typeof comprovarPremiumPerUID === 'function' && comprovarPremiumPerUID()) {
        return true;
    }
    
    // Si l'usuari està loguejat però NO és premium
    if (typeof esParametrePremium === 'function' && esParametrePremium(clau)) {
        return false; // Variable premium bloquejada
    }
    
    return true; // Variable normal accessible
}

// ═══ FUNCIÓ PER VERIFICAR TOKEN ═══
async function verificarToken(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        console.log(`[SEGURETAT] Usuari autenticat: ${decodedToken.email}`);
        next();
    } catch (error) {
        console.warn('[SEGURETAT] Token invàlid:', error.message);
        req.user = null;
        next();
    }
}

// ═══ ENDPOINT: VALIDAR ACCÉS ═══
app.post('/api/validar-acces', verificarToken, async (req, res) => {
    try {
        const { horaIdx } = req.body;
        
        console.log(`[SEGURETAT] Validant accés a hora ${horaIdx}...`);
        
        if (horaIdx === undefined || horaIdx === null || horaIdx < 0) {
            return res.status(400).json({ 
                permis: false, 
                error: 'Índex d\'hora invàlid' 
            });
        }
        
        // HORA 0: SEMPRE ACCESSIBLE
        if (horaIdx === 0) {
            console.log('[SEGURETAT] ✅ Hora 0 - Accés públic');
            return res.json({ 
                permis: true, 
                nivell: 'public' 
            });
        }
        
        // HORES > 0: REQUEREIXEN AUTENTICACIÓ
        if (!req.user) {
            console.log('[SEGURETAT] ❌ Accés denegat - Usuari no autenticat');
            return res.json({ 
                permis: false, 
                error: 'Inicia sessió per veure més hores',
                nivell: 'login_required'
            });
        }
        
        // USUARI AUTENTICAT: ACCÉS TOTAL
        console.log(`[SEGURETAT] ✅ Accés permès a hora ${horaIdx} per ${req.user.email}`);
        
        return res.json({ 
            permis: true, 
            nivell: 'authenticated',
            uid: req.user.uid,
            email: req.user.email
        });
        
    } catch (error) {
        console.error('[SEGURETAT] Error:', error);
        return res.status(500).json({ 
            permis: false, 
            error: 'Error intern del servidor' 
        });
    }
});

// ═══ ENDPOINT: REGISTRAR USUARI ═══
app.post('/api/registrar-usuari', verificarToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticat' });
        }
        
        const userId = req.user.uid;
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            await userRef.set({
                uid: userId,
                email: req.user.email || '',
                displayName: req.user.name || 'Usuari',
                photoURL: req.user.picture || '',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastLogin: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`[SEGURETAT] Nou usuari registrat: ${req.user.email}`);
            return res.json({
                success: true,
                message: 'Usuari registrat correctament!'
            });
        }
        
        await userRef.update({
            lastLogin: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return res.json({
            success: true,
            message: 'Usuari ja registrat'
        });
        
    } catch (error) {
        console.error('[SEGURETAT] Error registrant usuari:', error);
        return res.status(500).json({ error: 'Error intern' });
    }
});

// ═══ RUTA PER DEFECTE (CORREGIDA) ═══
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ═══ INICIAR SERVIDOR ═══
app.listen(PORT, () => {
    console.log('═'.repeat(60));
    console.log(`🚀 Servidor executant-se a http://localhost:${PORT}`);
    console.log(`📁 Servint fitxers des de: ${path.join(__dirname, 'public')}`);
    console.log('═'.repeat(60));
});