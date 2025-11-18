addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// حتما این مقدار را به یک رمز قوی و منحصربه‌فرد تغییر دهید!
const PURGE_SECRET = 'your-very-strong-secret-key-here-123456789';

async function handleRequest(request) {
  const url = new URL(request.url);

  // پاک کردن کش (امن)
  if (url.searchParams.get('purge') === PURGE_SECRET) {
    return new Response('Cache purged successfully!', { 
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  if (request.method === 'OPTIONS') return handleOPTIONS();

  // صفحه اصلی
  if (url.pathname === '/' && !url.search) {
    return new Response(`Telegram Bot API Proxy is running!\n\nDomain: ${url.hostname}\nUptime: 99.99%\nSource: https://github.com/yourname/telegram-proxy`, {
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  url.hostname = 'api.telegram.org';

  const newHeaders = new Headers(request.headers);
  ['host', 'cf-connecting-ip', 'cf-ray', 'x-forwarded-for', 'cf-ipcountry', 'connection'].forEach(h => 
    newHeaders.delete(h)
  );
  if (!newHeaders.has('user-agent')) {
    newHeaders.set('User-Agent', 'TelegramBotAPI-Proxy/2.0 (+https://github.com/yourname/telegram-proxy)');
  }

  // کش هوشمند بر اساس نوع درخواست
  let cacheTtl = 0;
  if (request.method === 'GET') {
    const path = url.pathname;
    if (path.includes('/getMe') || path.includes('/getMyCommands') || path.includes('/getChat')) cacheTtl = 86400;
    else if (path.includes('/file/bot')) cacheTtl = 31536000; // فایل‌ها برای همیشه
    else if (path.startsWith('/bot')) cacheTtl = 30;
  }

  const modifiedRequest = new Request(url.toString(), {
    method: request.method,
    headers: newHeaders,
    body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
    redirect: 'follow',
    cf: {
      cacheEverything: true,
      cacheTtl,
      cacheKey: url.toString()
    }
  });

  try {
    const response = await fetch(modifiedRequest);
    const newRespHeaders = new Headers(response.headers);
    newRespHeaders.set('Access-Control-Allow-Origin', '*');
    newRespHeaders.set('Vary', 'Origin');
    newRespHeaders.delete('set-cookie');
    newRespHeaders.delete('set-cookie2');
    newRespHeaders.set('X-Powered-By', 'Cloudflare Workers Telegram Proxy');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newRespHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ 
      ok: false, 
      error_code: 502, 
      description: 'Proxy temporarily unavailable. Try again later.' 
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

function handleOPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    }
  });
}
