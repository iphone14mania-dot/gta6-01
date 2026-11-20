// Dev server: serves the game directory over HTTP for local playtesting.
// Usage: node serve.ts [port]  (default 4173)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || 4173);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  const file = join(here, 'game', path === '/' ? 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found\n');
  }
});

server.listen(port, () => console.log(`Solmar Bay at http://localhost:${port}/`));
