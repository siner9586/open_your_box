import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const bannedMarketing = ['一键开盒', '五分钟查清', '扒出所有马甲', '查人神器', '猎人式追踪', '默认密码尝试'];
const secretPattern = /(shodan[_-]?api[_-]?key\s*[:=]\s*[A-Za-z0-9]{20,}|api[_-]?key\s*[:=]\s*[A-Za-z0-9_\-]{24,})/i;
const skip = new Set(['node_modules', 'dist', '.git']);
async function files(dir) {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...await files(p));
    else if (/\.(js|mjs|ts|tsx|json|md|html|css|yml|yaml|py)$/.test(ent.name)) out.push(p);
  }
  return out;
}
let failed = false;
for (const file of await files(root)) {
  const text = await readFile(file, 'utf8');
  if (!/README|SECURITY|PRIVACY|safety-boundary|lint-content|app\.js/.test(path.relative(root, file))) {
    for (const word of bannedMarketing) {
      if (text.includes(word)) { console.error(`Forbidden marketing phrase '${word}' in ${path.relative(root, file)}`); failed = true; }
    }
  }
  const normalized = text.replace(/SHODAN_API_KEY=\n/g, '').replace(/SHODAN_API_KEY=/g, '').replace(/export SHODAN_API_KEY="在本地填入你的 Shodan Key"/g, '');
  if (secretPattern.test(normalized)) { console.error(`Possible secret in ${path.relative(root, file)}`); failed = true; }
}
if (failed) process.exit(1);
console.log('Content lint passed: no offensive marketing phrasing or committed API key pattern detected.');
