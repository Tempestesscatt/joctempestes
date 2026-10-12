/**
 * POST /api/portal
 * Obre el portal de client de Stripe perque l'usuari gestioni la subscripcio.
 */

function cors() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
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

    const { customerId } = cos;
    if (!customerId) return json({ error: 'Falta customerId' }, 400);

    try {
        const r = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + env.STRIPE_SECRET_KEY,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                customer: customerId,
                return_url: 'https://tempestes.cat/'
            }).toString()
        });
        const text = await r.text();
        if (!r.ok) throw new Error('Stripe ' + r.status + ': ' + text);
        const session = JSON.parse(text);
        return json({ url: session.url });
    } catch (e) {
        console.error('[Portal]', e);
        return json({ error: 'No s\'ha pogut obrir el portal' }, 500);
    }
}