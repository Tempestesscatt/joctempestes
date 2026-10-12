/**
 * POST /api/create-checkout
 * Crea una sessió de Stripe Checkout i retorna { url }.
 */

const PRICE_IDS = {
    entusiasta_mensual:   'price_1UPYMCL8aDWHzsR2xvcBqbLQ',
    entusiasta_anual:     'price_1UPYNFL8aDWHzsR2tvN3anlf',
    professional_mensual: 'price_1UPYNlL8aDWHzsR25XV7kOUS',
    professional_anual:   'price_1UPYOML8aDWHzsR2TOZnqNnU'
};

function cors() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
    };
}

function json(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors() }
    });
}

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: cors() });
}

export async function onRequestPost({ request, env }) {
    let cos;
    try { cos = await request.json(); }
    catch (e) { return json({ error: 'JSON invalid' }, 400); }

    const { uid, email, pla, cicle, returnUrl } = cos;

    if (!uid || !pla || !cicle) return json({ error: 'Falten parametres' }, 400);
    if (!['entusiasta', 'professional'].includes(pla)) return json({ error: 'Pla invalid' }, 400);
    if (!['mensual', 'anual'].includes(cicle)) return json({ error: 'Cicle invalid' }, 400);

    const priceId = PRICE_IDS[`${pla}_${cicle}`];
    if (!priceId) return json({ error: 'Preu no configurat' }, 500);

    const params = {
        mode: 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        client_reference_id: uid,
        'metadata[uid]': uid,
        'metadata[pla]': pla,
        'metadata[cicle]': cicle,
        success_url: returnUrl || 'https://tempestes.cat/?success=1',
        cancel_url: returnUrl ? returnUrl.replace('success=1', 'cancel=1') : 'https://tempestes.cat/?cancel=1',
        'subscription_data[metadata][uid]': uid,
        'subscription_data[metadata][pla]': pla
    };
    if (email) params.customer_email = email;

    try {
        const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + env.STRIPE_SECRET_KEY,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams(params).toString()
        });
        const text = await r.text();
        if (!r.ok) throw new Error('Stripe ' + r.status + ': ' + text);
        const session = JSON.parse(text);
        return json({ url: session.url, id: session.id });
    } catch (e) {
        console.error('[Checkout]', e);
        return json({ error: 'No s\'ha pogut crear la sessio' }, 500);
    }
}