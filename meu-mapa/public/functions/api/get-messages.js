export async function onRequest(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Només GET' }), { status: 405, headers: corsHeaders });
  }

  try {
    let messages = [];
    if (context.env.CHAT_MESSAGES) {
      const data = await context.env.CHAT_MESSAGES.get('list', 'json');
      if (data && Array.isArray(data)) {
        const ara = Date.now();
        const vintIQuatreHores = 24 * 60 * 60 * 1000;
        messages = data.filter(m => m.ts && (ara - m.ts) < vintIQuatreHores);
        if (messages.length > 100) messages = messages.slice(-100);
      }
    }
    return new Response(JSON.stringify(messages), { status: 200, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify([]), { status: 200, headers: corsHeaders });
  }
}
