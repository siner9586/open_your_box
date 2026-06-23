import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const routes = ['personal','organization','tools','risk-model','report','safety','method','passport','company-card','map','diff','developer-kit','family-safety','executive-brief','watchlist','vendor-snapshot','privacy','social','accounts','reports','risk','settings','auth'];
const enhancerScript = '<script type="module" src="/assets/personal-phone-input.js"></script>';

function prepareHtml(html, assetPrefix) {
  return html
    .replaceAll('href="/assets/', `href="${assetPrefix}assets/`)
    .replaceAll('src="/assets/', `src="${assetPrefix}assets/`)
    .replace('</body>', `  ${enhancerScript.replace('/assets/', `${assetPrefix}assets/`)}\n  </body>`);
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(root, 'assets'), path.join(dist, 'assets'), { recursive: true });
await cp(path.join(root, 'data'), path.join(dist, 'data'), { recursive: true });
await mkdir(path.join(dist, 'lib'), { recursive: true });
await cp(path.join(root, 'lib/demo'), path.join(dist, 'lib/demo'), { recursive: true });

const sourceHtml = await readFile(path.join(root, 'index.html'), 'utf8');
const rootHtml = prepareHtml(sourceHtml, '');
await writeFile(path.join(dist, 'index.html'), rootHtml);
await writeFile(path.join(dist, '404.html'), rootHtml);
for (const route of routes) {
  const dir = path.join(dist, route);
  await mkdir(dir, { recursive: true });
  const html = prepareHtml(sourceHtml, '../');
  await writeFile(path.join(dir, 'index.html'), html);
}
console.log(`Built ${routes.length + 1} pages into dist/`);
