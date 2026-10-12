/**
 * POST /api/webhook
 * Rep esdeveniments de Stripe i actualitza el camp pla a Firebase.
 */

const FIREBASE_DB = 'https://tempestescat-default-rtdb.europe-west1.firebasedatabase.app';

async function setPlaFirebase(uid, pla, env) {
    const url = `${FIREBASE_DB}/users/${encodeURIComponent(uid)}/pla.json?auth=${env.FIREBASE_SECRET}`;
    const r = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pla)
    });
    if (!r.ok) throw new Error('Firebase ' + r.status);
    return true;
}

async function setPlaMetadata(uid, dades, env) {
    const url = `${FIREBASE_DB}/users/${encodeURIComponent(uid)}/subscripcio.json?auth=${env.FIREBASE_SECRET}`;
    await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dades)
    });
}

async function verificarSignatura(payload, sigHeader, secret) {
    const parts = {};
    sigHeader.split(',').forEach(p => {
        const [k, v] = p.split('=');
        if (k && v) parts[k] = v;
    });

    const timestamp = parts.t;
    const expected = parts.v1;
    if (!timestamp || !expected) throw new Error('Signatura mal formada');

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
        throw new Error('Timestamp massa antic');
    }

    const signedPayload = timestamp + '.' + payload;
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
    const computed = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');

    if (computed !== expected) throw new Error('Signatura invalida');
    return true;
}

export async function onRequestPost({ request, env }) {
    const sig = request.headers.get('stripe-signature');
    if (!sig) return new Response('Sense signatura', { status: 400 });

    const payload = await request.text();

    try {
        await verificarSignatura(payload, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (e) {
        console.error('[Webhook] Signatura:', e.message);
        return new Response('Signatura invalida', { status: 400 });
    }

    let event;
    try { event = JSON.parse(payload); }
    catch (e) { return new Response('JSON invalid', { status: 400 }); }

    console.log('[Webhook]', event.type);

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const uid = session.client_reference_id || (session.metadata && session.metadata.uid);
                const pla = (session.metadata && session.metadata.pla) || 'gratuït';
                if (!uid) break;

                await setPlaFirebase(uid, pla, env);
                await setPlaMetadata(uid, {
                    pla,
                    cicle: (session.metadata && session.metadata.cicle) || 'mensual',
                    stripeCustomerId: session.customer || null,
                    stripeSubscriptionId: session.subscription || null,
                    dataInici: new Date().toISOString(),
                    estat: 'actiu'
                }, env);
                console.log('[Webhook] Pla activat:', uid, '->', pla);
                break;
            }

            case 'customer.subscription.updated': {
                const sub = event.data.object;
                const uid = sub.metadata && sub.metadata.uid;
                if (!uid) break;

                const actiu = sub.status === 'active' || sub.status === 'trialing';
                const pla = actiu ? (sub.metadata.pla || 'gratuït') : 'gratuït';

                await setPlaFirebase(uid, pla, env);
                await setPlaMetadata(uid, {
                    pla,
                    estat: sub.status,
                    stripeSubscriptionId: sub.id,
                    dataActualitzacio: new Date().toISOString()
                }, env);
                console.log('[Webhook] Subscripcio actualitzada:', uid, '->', pla, '(' + sub.status + ')');
                break;
            }

            case 'customer.subscription.deleted': {
                const sub = event.data.object;
                const uid = sub.metadata && sub.metadata.uid;
                if (!uid) break;

                await setPlaFirebase(uid, 'gratuït', env);
                await setPlaMetadata(uid, {
                    pla: 'gratuït',
                    estat: 'cancel·lat',
                    dataFi: new Date().toISOString()
                }, env);
                console.log('[Webhook] Subscripcio cancel·lada:', uid);
                break;
            }

            case 'invoice.payment_failed': {
                const inv = event.data.object;
                const uid = inv.subscription_details && inv.subscription_details.metadata
                    && inv.subscription_details.metadata.uid;
                if (!uid) break;
                await setPlaMetadata(uid, {
                    estat: 'impagament',
                    dataFallada: new Date().toISOString()
                }, env);
                console.log('[Webhook] Pagament fallit:', uid);
                break;
            }

            default:
                break;
        }
    } catch (e) {
        console.error('[Webhook] Error processant:', e);
        return new Response('Error processant', { status: 500 });
    }

    return new Response('ok', { status: 200 });
}