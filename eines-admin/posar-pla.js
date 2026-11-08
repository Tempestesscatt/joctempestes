// Ús: node posar-pla.js CORREU_O_UID PLA     (PLA: 0, 1 o 2)
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

initializeApp({ credential: cert(require('./clau-servei.json')) });

(async () => {
  const [ident, plan] = [process.argv[2], Number(process.argv[3])];
  if (!ident || ![0, 1, 2].includes(plan)) {
    console.log('Ús: node posar-pla.js CORREU_O_UID PLA   (PLA = 0, 1 o 2)');
    process.exit(1);
  }
  const auth = getAuth();
  const user = ident.includes('@') ? await auth.getUserByEmail(ident) : await auth.getUser(ident);
  await auth.setCustomUserClaims(user.uid, { plan });
  console.log('OK', user.email, '→ pla', plan);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });