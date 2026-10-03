import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
// Loopback only. Limits are resource guards, not distributed authentication limits.
export function oauthCallback(state: string, open: (redirect: string) => Promise<void>, timeoutMs = 300000, idleMs = 10000) {
  let cancel = () => {};
  const result = new Promise<{ code: string; redirect: string }>((resolve, reject) => {
    let finished = false, selected = false, redirect = '';
    const server = http.createServer({ maxHeaderSize: 8192, headersTimeout: 10000, requestTimeout: 15000, keepAliveTimeout: 1000 }, (req, res) => {
      const reply = (status: number, text: string) => {
        res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', Connection: 'close' }); res.end(text);
      };
      if (finished || selected) { reply(409, 'This sign-in attempt is complete.'); return; }
      let url: URL;
      try {
        if (!req.url?.startsWith('/') || req.url.startsWith('//') || req.url.length > 8192) throw Error();
        url = new URL(req.url, redirect);
        if (req.headers.host !== new URL(redirect).host) throw Error();
      } catch { reply(400, 'Invalid sign-in request.'); return; }
      if (req.method !== 'GET' || url.pathname !== '/oauth/callback') { reply(404, 'Page not found.'); return; }
      const params = url.searchParams;
      if (params.getAll('state').length !== 1 || params.getAll('code').length > 1 || params.getAll('error').length > 1 || params.has('code') && params.has('error')) { reply(400, 'Invalid sign-in request.'); return; }
      const received = Buffer.from(params.get('state') ?? ''), expected = Buffer.from(state);
      if (received.length !== expected.length || !timingSafeEqual(received, expected)) { reply(400, 'Invalid sign-in state. Return to C.C. Lime and try again.'); return; }
      selected = true;
      res.once('finish', () => finish(params.has('error') || !params.get('code') ? new Error('Google sign-in was canceled.') : null, { code: params.get('code')!, redirect }));
      reply(200, 'You can close this page and return to C.C. Lime.');
    });
    server.maxConnections = 16;
    server.on('connection', socket => socket.setTimeout(idleMs, () => socket.destroy()));
    server.on('clientError', (_error, socket) => { if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); else socket.destroy(); });
    const finish = (error: Error | null, value?: { code: string; redirect: string }) => {
      if (finished) return; finished = true; clearTimeout(timer);
      server.close(); server.closeAllConnections(); error ? reject(error) : resolve(value!);
    };
    const timer = setTimeout(() => finish(new Error('Google sign-in timed out. Please try again.')), timeoutMs);
    cancel = () => finish(new Error('Google sign-in canceled.'));
    server.on('error', () => finish(new Error('Could not start Google sign-in.')));
    server.listen(0, '127.0.0.1', () => {
      if (finished) { server.close(); return; }
      const address = server.address(); if (!address || typeof address === 'string') return finish(new Error('Could not start sign-in.'));
      redirect = `http://127.0.0.1:${address.port}/oauth/callback`;
      void open(redirect).catch(() => finish(new Error('Could not open Google sign-in.')));
    });
  });
  return { result, cancel: () => cancel() };
}
