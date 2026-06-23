import { readFile } from 'node:fs/promises';
const toolMatrix = JSON.parse(await readFile('data/tool-matrix.json', 'utf8'));
const personal = JSON.parse(await readFile('data/personal-exposure.json', 'utf8'));
const organization = JSON.parse(await readFile('data/organization-exposure.json', 'utf8'));
const required = ['blackbird', 'maigret', 'spiderfoot', 'theharvester', 'shodan'];
for (const id of required) {
  if (!toolMatrix.some(t => t.id === id)) throw new Error(`Missing core tool: ${id}`);
}
if (toolMatrix.length < 30) throw new Error('Tool matrix must contain at least 30 tools.');
if (personal.totalScore !== 56) throw new Error('Personal demo score should be 56.');
if (organization.totalScore !== 68) throw new Error('Organization demo score should be 68.');
console.log(`Tests passed: ${toolMatrix.length} tools, core adapters represented, demo scores valid.`);
