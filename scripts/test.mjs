import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  maskIdentifier,
  redactText,
  parsePasswordManager,
  parseMailbox,
  parseBrowserExport,
  runPersonalScan,
  runCompanyScan,
  scoreRisk
} from '../src/scanners/core/runtime.mjs';

const toolMatrix = JSON.parse(await readFile('data/tool-matrix.json', 'utf8'));
const catalog = JSON.parse(await readFile('data/personal-account-platform-catalog.json', 'utf8'));
const required = ['blackbird', 'maigret', 'spiderfoot', 'theharvester', 'shodan'];
for (const id of required) assert.ok(toolMatrix.some(t => t.id === id), `Missing core tool: ${id}`);
assert.ok(toolMatrix.length >= 30, 'Tool matrix must contain at least 30 tools.');
assert.equal(catalog.selfOnly, true, 'Platform catalog must be self-only.');
assert.ok(catalog.platforms.length >= 50, 'Platform catalog should cover broad account cleanup needs.');

assert.match(maskIdentifier('alice@example.com', 'email'), /^a\*\*\*/);
assert.ok(!redactText('token sk-test-secret-1234567890123 alice@example.com').includes('alice@example.com'));

const csv = 'name,url,username,password,totp\nGitHub,https://github.com,alice@example.com,SuperSecret,123456\nGoogle,https://accounts.google.com,alice@example.com,Another,654321';
const pm = await parsePasswordManager(csv, catalog.platforms, 'scan_test_pm');
assert.ok(pm.findings.length >= 2, 'Credential-store import should produce account findings.');
assert.ok(!JSON.stringify(pm).includes('SuperSecret'), 'Secret values must not be stored.');

const mailbox = await parseMailbox('Welcome to GitHub <noreply@github.com> verify email password reset account created', catalog.platforms, 'scan_test_mail');
assert.ok(mailbox.findings.length >= 1, 'Mailbox import should detect registration traces.');

const browser = await parseBrowserExport('<A HREF="https://github.com/settings/security">GitHub security</A>', catalog.platforms, 'scan_test_browser');
assert.ok(browser.findings.length >= 1, 'Browser import should detect account URLs.');

const personal = await runPersonalScan({ identifiers: { email: 'alice@example.com', github: 'octocat' }, uploads: { passwordManagerText: csv }, platformCatalog: catalog.platforms }, { HASH_SALT: 'test' });
assert.equal(personal.reportType, 'personal');
assert.ok(personal.findings.length >= 3);
assert.ok(personal.riskScore.total >= 0);

const company = await runCompanyScan({ domain: 'example.com', authorization: { verified: false } }, {});
assert.equal(company.reportType, 'company');
assert.ok(company.findings.some(f => f.category === 'asset_verification'));

const risk = scoreRisk(personal.findings, 'personal');
assert.ok(['low', 'medium', 'high', 'critical'].includes(risk.level));

console.log(`Tests passed: ${toolMatrix.length} tools, ${catalog.platforms.length} platforms, runtime scanners validated.`);
