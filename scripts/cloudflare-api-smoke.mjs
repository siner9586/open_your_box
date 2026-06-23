const BASE_URL = (process.env.BASE_URL || 'https://open-your-box.pages.dev').replace(/\/$/, '');
const TOKEN = process.env.PRIVATE_TOKEN || 'private-mode-token';
const headers = () => ({ 'content-type': 'application/json', 'idempotency-key': `smoke-${Date.now()}-${Math.random().toString(36).slice(2)}`, 'x-private-token': TOKEN });
async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`${path} returned non-JSON ${res.status}: ${text.slice(0, 160)}`); }
  if (!res.ok) throw new Error(`${path} failed ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}
async function get(path, accept = 'application/json') {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { accept } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} failed ${res.status}: ${text.slice(0, 300)}`);
  if (accept.includes('json')) return JSON.parse(text);
  return text;
}
const personalPayload = {
  authorization: { mode: 'private', verified: false },
  identifiers: { email: 'test@example.com', github: 'octocat' },
  publicProfileUrls: ['https://example.com'],
  uploads: {
    passwordManagerText: 'url,username,ignored_secret_field\nhttps://github.com,me@example.com,DO_NOT_KEEP_THIS_FIELD',
    mailboxText: 'From: security@github.com\nSubject: reset account created verify',
    browserText: 'https://github.com/settings/security',
    platformExportText: 'https://github.com/settings/admin'
  }
};
const companyPayload = { authorization: { mode: 'private', verified: true, method: 'manual_admin_test' }, domain: 'example.com', githubOrg: 'octocat', ip: '93.184.216.34' };
const personal = await post('/api/scan/personal', personalPayload);
if (!personal.reportId || !personal.report?.accountTasks) throw new Error('personal report missing id or accountTasks');
if (JSON.stringify(personal).includes('DO_NOT_KEEP_THIS_FIELD')) throw new Error('ignored field leaked in personal response');
const company = await post('/api/scan/company', companyPayload);
if (!company.reportId || company.report?.reportType !== 'company') throw new Error('company report missing');
const list = await get('/api/reports');
if (!Array.isArray(list.reports)) throw new Error('reports list missing');
const id = personal.taskId;
const detail = await get(`/api/reports/${encodeURIComponent(id)}`);
if (detail.scanId !== id) throw new Error('report detail mismatch');
const md = await get(`/api/reports/${encodeURIComponent(id)}/export?format=md`, 'text/markdown');
if (!md.includes('Open Your Box')) throw new Error('markdown export invalid');
const csv = await get(`/api/reports/${encodeURIComponent(id)}/export?format=csv`, 'text/csv');
if (!csv.includes('severity')) throw new Error('csv export invalid');
await post('/api/settings/delete-data', { scope: 'local-test' });
const after = await get('/api/reports');
console.log(JSON.stringify({ baseUrl: BASE_URL, personalReportId: personal.reportId, companyReportId: company.reportId, reportsBeforeDelete: list.reports.length, reportsAfterDelete: after.reports.length, persisted: { personal: personal.persisted, company: company.persisted } }, null, 2));
