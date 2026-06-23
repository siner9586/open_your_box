import { readFile } from 'node:fs/promises';
const html = await readFile('index.html', 'utf8');
const checks = [
  ['title', /<title>Open Your Box/],
  ['description', /meta name="description"/],
  ['viewport', /meta name="viewport"/],
  ['main app root', /<main id="app"/]
];
for (const [name, pattern] of checks) {
  if (!pattern.test(html)) throw new Error(`Lighthouse dry check failed: ${name}`);
}
console.log('Lighthouse dry checks passed. Full Lighthouse CI can be enabled after deployment URL is known.');
