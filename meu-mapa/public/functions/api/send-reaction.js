// functions/api/send-reaction.js

export async function onRequest(context) {
  const { request, env } = context;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  // Solo POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Mètode no permès' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    const body = await request.json();
    const { msgKey, reactId, uid } = body;

    if (!msgKey || !reactId || !uid) {
      return new Response(JSON.stringify({ error: 'Falten camps' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Verificar variables Pusher
    const PUSHER_APP_ID = env.PUSHER_APP_ID;
    const PUSHER_KEY = env.PUSHER_KEY;
    const PUSHER_SECRET = env.PUSHER_SECRET;
    const PUSHER_CLUSTER = env.PUSHER_CLUSTER || 'eu';

    if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET) {
      return new Response(JSON.stringify({
        error: 'Falten variables d\'entorn de Pusher'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Signar petició a Pusher
    const timestamp = Math.floor(Date.now() / 1000);
    const eventBody = JSON.stringify({
      name: 'reaction-updated',
      channel: 'reactions-channel',
      data: JSON.stringify({
        msgKey: msgKey,
        reactId: reactId,
        uid: uid,
        ts: Date.now()
      })
    });

    // MD5 del body
    const bodyMd5 = await md5Hex(eventBody);
    const authVersion = '1.0';

    const paramsToSign = [
      `auth_key=${PUSHER_KEY}`,
      `auth_timestamp=${timestamp}`,
      `auth_version=${authVersion}`,
      `body_md5=${bodyMd5}`
    ].join('&');

    const path = `/apps/${PUSHER_APP_ID}/events`;
    const stringToSign = `POST\n${path}\n${paramsToSign}`;
    const authSignature = await hmacSha256Hex(PUSHER_SECRET, stringToSign);

    const url = `https://api-${PUSHER_CLUSTER}.pusher.com${path}?${paramsToSign}&auth_signature=${authSignature}`;

    const pusherRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: eventBody
    });

    if (!pusherRes.ok) {
      const errText = await pusherRes.text();
      console.error('Error Pusher:', errText);
      return new Response(JSON.stringify({ error: 'Error Pusher', detail: errText }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Error intern' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// ========== FUNCIONS AUXILIARS ==========

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function md5Hex(message) {
  return md5(message);
}

function md5(str) {
  function rotl(n, s) { return (n << s) | (n >>> (32 - s)); }
  function toHex(n) {
    let s = '', v;
    for (let i = 0; i < 4; i++) {
      v = (n >>> (i * 8)) & 255;
      s += ('0' + v.toString(16)).slice(-2);
    }
    return s;
  }
  const utf8 = decodeURIComponent(encodeURIComponent(str));
  const bytes = [];
  for (let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i));
  const origLenBits = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 0; i < 8; i++) bytes.push((origLenBits / Math.pow(2, 8 * i)) & 0xff);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const K = [];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32);
  const S = [
    7,12,17,22, 7,12,17,22, 7,12,17,22, 7,12,17,22,
    5, 9,14,20, 5, 9,14,20, 5, 9,14,20, 5, 9,14,20,
    4,11,16,23, 4,11,16,23, 4,11,16,23, 4,11,16,23,
    6,10,15,21, 6,10,15,21, 6,10,15,21, 6,10,15,21
  ];

  for (let chunk = 0; chunk < bytes.length; chunk += 64) {
    const M = [];
    for (let i = 0; i < 16; i++) {
      M[i] = bytes[chunk + i * 4] |
        (bytes[chunk + i * 4 + 1] << 8) |
        (bytes[chunk + i * 4 + 2] << 16) |
        (bytes[chunk + i * 4 + 3] << 24);
    }
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) | 0;
      A = D; D = C; C = B;
      B = (B + rotl(F, S[i])) | 0;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  return toHex(a0) + toHex(b0) + toHex(c0) + toHex(d0);
}