import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const style = `:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#0c0b10;color:#f4f0ff}body{margin:0;min-height:100vh;display:grid;place-items:center}main{max-width:34rem;margin:2rem;padding:clamp(1.5rem,5vw,3rem);border:1px solid #493765;border-radius:1.5rem;background:#17121f}header{color:#c6a6fa;font-weight:700;letter-spacing:.08em}h1{font-size:clamp(2rem,6vw,3rem);line-height:1.15}p{color:#c7bfd4;line-height:1.6}a{display:inline-block;margin-top:1rem;background:#b58aff;color:#190d2b;border-radius:.7rem;padding:.8rem 1.1rem;font-weight:700;text-decoration:none}a:hover{background:#c9aaff}a:focus-visible{outline:3px solid #fff;outline-offset:5px}`;
const csp = `default-src 'none'; style-src 'sha256-${createHash('sha256').update(style).digest('base64')}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;

function errorPage(status: 404 | 405, head: boolean): Response {
  const title = status === 404 ? 'Page not found' : 'This action is unavailable';
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${status} · C.C. Lime</title><style>${style}</style></head><body><main><header>C.C. LIME · ${status}</header><h1>${title}</h1><p>This address doesn’t open a calendar page. Your saved calendar is still on this computer.</p><a href="cclime://app/index.html">Return to calendar</a></main></body></html>`;
  return new Response(head ? null : body, { status, headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': csp,
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    ...(status === 405 ? { Allow: 'GET, HEAD' } : {}),
  } });
}

function appOrigin(url: URL): boolean {
  return url.protocol === 'cclime:' && url.hostname === 'app' && !url.port && !url.username && !url.password;
}
export function isAppDocument(address: string): boolean {
  try { const url = new URL(address); return appOrigin(url) && !url.search && ['/', '/index.html'].includes(url.pathname); }
  catch { return false; }
}
function inside(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return !!relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function appProtocol(rendererRoot: string, fetchFile: (url: string) => Promise<Response>) {
  return async (request: { url: string; method: string }): Promise<Response> => {
    const head = request.method === 'HEAD';
    try {
      const url = new URL(request.url);
      if (!appOrigin(url)) return errorPage(404, head);
      if (request.method !== 'GET' && !head) return errorPage(405, false);
      const decoded = decodeURIComponent(url.pathname);
      if (/[\\:\0]/.test(decoded)) return errorPage(404, head);
      const root = path.resolve(rendererRoot), file = path.resolve(root, decoded.replace(/^\/+/, '') || 'index.html');
      if (!inside(root, file) || !['.html', '.css', '.js', '.png', '.svg', '.ico', '.woff2'].includes(path.extname(file))) return errorPage(404, head);
      const [realRoot, realFile, stat] = await Promise.all([fs.realpath(root), fs.realpath(file), fs.stat(file)]);
      if (!stat.isFile() || !inside(realRoot, realFile)) return errorPage(404, head);
      const response = await fetchFile(pathToFileURL(realFile).href);
      if (!response.ok) { await response.body?.cancel(); return errorPage(404, head); }
      if (head) { await response.body?.cancel(); return new Response(null, { status: response.status, headers: response.headers }); }
      return response;
    } catch { return errorPage(404, head); }
  };
}
