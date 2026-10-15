// Local development server: serves public/ and routes /api/<name> to the
// POST handler exported by api/<name>.js, the same way Vercel does.
// Usage: npm run dev   (reads GEMINI_API_KEY from .env)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = join(import.meta.dirname, 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/[^a-z-]/g, '');
      const mod = await import(`./api/${name}.js`);
      const handler = mod[req.method];
      if (!handler) return send(res, 405, 'Method not allowed');

      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      return res.end(Buffer.from(await response.arrayBuffer()));
    }

    const path = normalize(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = await readFile(join(PUBLIC_DIR, path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(file);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ERR_MODULE_NOT_FOUND') return send(res, 404, 'Not found');
    console.error(err);
    send(res, 500, 'Server error');
  }
}).listen(PORT, () => console.log(`Dev server: http://localhost:${PORT}`));

function send(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain' });
  res.end(text);
}
