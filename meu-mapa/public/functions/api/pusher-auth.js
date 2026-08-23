export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Només POST' }), { status: 405, headers: corsHeaders });
  }

  try {
    const body = await request.formData();
    const socketId = body.get('socket_id');
    const channelName = body.get('channel_name');

    if (!socketId || !channelName) {
      return new Response(JSON.stringify({ error: 'Falten paràmetres' }), { status: 400, headers: corsHeaders });
    }

    const KEY = env.PUSHER_KEY;
    const SECRET = env.PUSHER_SECRET;

    const stringToSign = socketId + ':' + channelName;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(stringToSign));
    const signature = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    const auth = KEY + ':' + signature;

    const userData = JSON.stringify({
      user_id: 'user_' + Math.random().toString(36).substr(2, 9),
      user_info: { name: 'Usuari' }
    });

    return new Response(JSON.stringify({ auth: auth, channel_data: userData }), { status: 200, headers: corsHeaders });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
}
