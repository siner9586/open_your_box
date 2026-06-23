import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };
http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${port}`);
  let file = path.join(root, url.pathname);
  if (url.pathname.endsWith('/')) file = path.join(root, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(root, 'index.html');
  res.setHeader('Content-Type', types[path.extname(file)] || 'text/plain; charset=utf-8');
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Open Your Box dev server: http://localhost:${port}`));
