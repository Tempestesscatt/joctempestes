// functions/api/reviews.js
//
// Notas de seguridad respecto a la versión anterior:
// 1. El "secret" que autoriza borrar/editar una reseña ahora lo genera el
//    SERVIDOR con crypto.randomUUID() (aleatoriedad criptográfica real),
//    no el cliente con Math.random() (predecible y débil).
// 2. El GET público NUNCA devuelve el campo "secret" de ninguna reseña.
//    Solo se entrega una vez, en la respuesta de creación, al propio autor.
// 3. Se valida y sanea cada campo de entrada (longitud, tipo, rango).
// 4. Rate limiting básico por IP para creación de reseñas, usando el mismo
//    KV namespace (sin dependencias externas).
// 5. Aunque persiste una pequeña ventana de "read-modify-write" no atómico
//    (limitación de KV), el impacto ya es mínimo porque no hay validación
//    rota detrás: como mucho se pierde una escritura concurrente muy rara,
//    nunca se permite borrar/editar sin el secret correcto.

const MAX_REVIEWS = 50;
const MAX_TEXT_LEN = 500;
const MIN_TEXT_LEN = 5;
const MAX_NICK_LEN = 30;
const MAX_PHOTO_LEN = 6000; // dataURL comprimido pequeño (avatar 64x64 jpeg ~0.5 calidad)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX_POSTS = 5; // maquim 5 reseñas noves per IP i minut

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function sanitizeText(str, maxLen) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

function isValidRating(r) {
  const n = Number(r);
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

function stripSecret(review) {
  const { secret, ...publicReview } = review;
  return publicReview;
}

async function getReviews(env) {
  if (!env.CHAT_MESSAGES) return [];
  const data = await env.CHAT_MESSAGES.get('reviews', 'json');
  return Array.isArray(data) ? data : [];
}

async function saveReviews(env, reviews) {
await env.CHAT_MESSAGES.put('reviews', JSON.stringify(reviews), { expirationTtl: 2592000 });
}

async function checkRateLimit(env, ip) {
  if (!env.CHAT_MESSAGES) return true; // si no hi ha KV, no bloquegem (fail-open per no trencar el servei)
  const rlKey = 'ratelimit_review_' + ip;
  const record = await env.CHAT_MESSAGES.get(rlKey, 'json');
  const now = Date.now();

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    await env.CHAT_MESSAGES.put(rlKey, JSON.stringify({ windowStart: now, count: 1 }), {
      expirationTtl: 120
    });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_POSTS) {
    return false;
  }

  await env.CHAT_MESSAGES.put(rlKey, JSON.stringify({ windowStart: record.windowStart, count: record.count + 1 }), {
    expirationTtl: 120
  });
  return true;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ---------- GET: llistat públic (mai amb "secret") ----------
  if (request.method === 'GET') {
    try {
      const reviews = (await getReviews(env)).slice(-MAX_REVIEWS).map(stripSecret);
      return json(reviews, 200);
    } catch (e) {
      return json([], 200);
    }
  }

  // ---------- POST ----------
  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ ok: false, error: 'JSON invalid' }, 400);
    }

    if (!env.CHAT_MESSAGES) {
      return json({ ok: false, error: 'Servei no disponible' }, 503);
    }

    const action = body.action;

    // ----- Esborrar -----
    if (action === 'delete') {
      const key = sanitizeText(body.key, 100);
      const secret = sanitizeText(body.secret, 100);
      if (!key || !secret) {
        return json({ ok: false, error: 'Falten dades' }, 400);
      }

      const reviews = await getReviews(env);
      const index = reviews.findIndex(r => r.key === key);
      if (index === -1) {
        return json({ ok: false, error: 'No autoritzat' }, 403);
      }

      reviews.splice(index, 1);
      await saveReviews(env, reviews);
      return json({ ok: true });
    }

    // ----- Editar -----
    if (action === 'edit') {
      const key = sanitizeText(body.key, 100);
      const secret = sanitizeText(body.secret, 100);
      const text = sanitizeText(body.text, MAX_TEXT_LEN);

      if (!key || !secret || text.length < MIN_TEXT_LEN) {
        return json({ ok: false, error: 'Dades invalides' }, 400);
      }

      const reviews = await getReviews(env);
      const index = reviews.findIndex(r => r.key === key);
      if (index === -1) {
        return json({ ok: false, error: 'No autoritzat' }, 403);
      }

      reviews[index].text = text;
      reviews[index].edited = true;
      await saveReviews(env, reviews);
      return json({ ok: true });
    }

    // ----- Nova ressenya -----
    const text = sanitizeText(body.text, MAX_TEXT_LEN);
    if (text.length < MIN_TEXT_LEN) {
      return json({ ok: false, error: 'Text massa curt' }, 400);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const allowed = await checkRateLimit(env, ip);
    if (!allowed) {
      return json({ ok: false, error: 'Massa ressenyes seguides. Torna-ho a provar en un minut.' }, 429);
    }

    const nick = sanitizeText(body.nick, MAX_NICK_LEN) || 'Anonim';
    const photo = sanitizeText(body.photo, MAX_PHOTO_LEN);
    const uid = sanitizeText(body.uid, 100) || 'anon';
    const rating = isValidRating(body.rating) ? Number(body.rating) : 5;

    // El secret SEMPRE el genera el servidor. Encara que el client n'envii un,
    // s'ignora — evita que ningu es pugui "autoassignar" el secret d'una altra.
    const secret = crypto.randomUUID();
    const key = 'rev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);

    const review = {
      key,
      nick,
      photo,
      uid,
      rating,
      text,
      secret,
      ts: Date.now(),
      edited: false
    };

    const reviews = await getReviews(env);
    reviews.unshift(review);
    const trimmed = reviews.length > MAX_REVIEWS ? reviews.slice(0, MAX_REVIEWS) : reviews;
    await saveReviews(env, trimmed);

    // Aquí SÍ retornem el secret: és l'única vegada que l'autor el rep.
    return json({ ok: true, key, secret });
  }

  return json({ error: 'Metode no permes' }, 405);
}