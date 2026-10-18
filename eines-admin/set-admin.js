const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const [email, flag] = process.argv.slice(2);
if (!email) {
    console.error('Ús: node set-admin.js correu@exemple.com [--remove]');
    process.exit(1);
}

initializeApp({ credential: applicationDefault() });

(async () => {
    const auth = getAuth();
    const user = await auth.getUserByEmail(email);
    const claims = Object.assign({}, user.customClaims || {});
    if (flag === '--remove') delete claims.admin; else claims.admin = true;
    await auth.setCustomUserClaims(user.uid, claims);
    console.log((flag === '--remove' ? 'Admin retirat a ' : 'Admin assignat a ') + email);
    process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });