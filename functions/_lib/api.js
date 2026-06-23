import { runPersonalScan, runCompanyScan, runSocialScan, runAccountsScan, reportToMarkdown, reportToCsv, scoreRisk } from '../../src/scanners/core/runtime.mjs';
import { runExternalChecks } from '../../src/scanners/core/external-adapters.mjs';
import { runHibpEmailRange } from '../../src/scanners/core/hibp-adapter.mjs';

const cache = new Map();
const response = (data, status = 200, type = 'application/json; charset=utf-8') => new Response(type.includes('json') ? JSON.stringify(data, null, 2) : data, { status, headers: { 'content-type': type, 'cache-control': 'no-store' } });
async function body(request) { try { return await request.json(); } catch { return {}; } }
function db(env = {}) { return env.DB || env.OYB_DB || env.OYB_DATABASE || null; }
function findLocal(id = '') { return cache.get(id.replace(/^report_/, '')) || cache.get(id); }
function gate(request, env = {}) { if (request.method !== 'GET' && !(request.headers.get('idempotency-key') || request.headers.get('x-idempotency-key'))) return response({ error: { code: 'MISSING_IDEMPOTENCY_KEY' } }, 400); const token = request.headers.get('x-private-token') || request.headers.get('authorization') || ''; if (request.method !== 'GET' && env.SCAN_MODE !== 'private' && token.length < 12) return response({ error: { code: 'MISSING_AUTH_TOKEN' } }, 401); }

async function saveReport(env = {}, report = {}) {
  const d = db(env); if (!d?.prepare || !report?.id) return false;
  const created = report.generatedAt || new Date().toISOString();
  try {
    await d.prepare('insert or replace into reports (id,user_id,job_id,report_type,risk_score,report_json,created_at) values (?,?,?,?,?,?,?)').bind(report.id, 'local', report.scanId, report.reportType, Number(report.riskScore?.total || 0), JSON.stringify(report), created).run();
    return true;
  } catch (error) { console.warn('report store skipped', error.message); return false; }
}
async function readReport(env = {}, id = '') {
  const local = findLocal(id); if (local) return local;
  const d = db(env); if (!d?.prepare) return null;
  const key = String(id || '').replace(/^report_/, '');
  try { const row = await d.prepare('select report_json from reports where id = ? or job_id = ? or id = ? limit 1').bind(id, key, `report_${key}`).first(); return row?.report_json ? JSON.parse(row.report_json) : null; } catch { return null; }
}

export async function handleScan(context, mode) {
  const denied = gate(context.request, context.env); if (denied) return denied;
  const payload = await body(context.request);
  payload.platformCatalog ||= [];
  payload.authorization ||= { mode: 'private', verified: false };
  const runner = { personal: runPersonalScan, company: runCompanyScan, social: runSocialScan, accounts: runAccountsScan }[mode];
  const report = await runner(payload, context.env);
  const extra = mode === 'personal' && payload.identifiers?.email ? await runHibpEmailRange(payload.identifiers.email, context.env, Boolean(payload.authorization?.verified), report.scanId) : await runExternalChecks(mode, payload, context.env, report.scanId);
  if (extra.length) {
    const seen = new Set((report.findings || []).map(f => `${f.source}:${f.category}:${f.title}`));
    for (const item of extra) if (!seen.has(`${item.source}:${item.category}:${item.title}`)) report.findings.push(item);
    report.riskScore = scoreRisk(report.findings, mode === 'company' ? 'company' : 'personal');
    report.dataSources = [...new Set([...(report.dataSources || []), ...extra.map(f => f.source)])];
  }
  cache.set(report.scanId, report);
  const persisted = await saveReport(context.env, report);
  return response({ status: 'completed', taskId: report.scanId, reportId: report.id, persisted, report });
}
export async function getReport(context) { const report = await readReport(context.env, context.params?.id || ''); return report ? response(report) : response({ status: 'not_found' }, 404); }
export async function listReports(context = {}) { const d = db(context.env || {}); if (d?.prepare) { try { const rows = await d.prepare('select id, job_id, report_type, risk_score, created_at from reports order by created_at desc limit 50').all(); return response({ reports: (rows.results || []).map(r => ({ id: r.id, scanId: r.job_id, reportType: r.report_type, riskScore: r.risk_score, createdAt: r.created_at })) }); } catch {} } return response({ reports: [...cache.values()].map(r => ({ id: r.id, scanId: r.scanId, reportType: r.reportType, riskScore: r.riskScore.total, createdAt: r.generatedAt })) }); }
export async function exportReport(context) { const report = await readReport(context.env, context.params?.id || ''); if (!report) return response({ error: { code: 'REPORT_NOT_FOUND' } }, 404); const f = new URL(context.request.url).searchParams.get('format'); if (f === 'md') return response(reportToMarkdown(report), 200, 'text/markdown; charset=utf-8'); if (f === 'csv') return response(reportToCsv(report), 200, 'text/csv; charset=utf-8'); return response(report); }
export async function getTask() { return response({ status: 'not_found' }, 404); }
export async function handleUpload(context, kind) { const denied = gate(context.request, context.env); if (denied) return denied; const text = await context.request.text(); const uploads = kind === 'mailbox' ? { mailboxText: text } : kind === 'browser-history' ? { browserText: text } : kind === 'platform-export' ? { platformExportText: text } : { passwordManagerText: text }; const report = await runPersonalScan({ uploads, platformCatalog: [] }, context.env); cache.set(report.scanId, report); const persisted = await saveReport(context.env, report); return response({ status: 'processed', kind, reportId: report.id, taskId: report.scanId, persisted, report }); }
export async function exportData(context = {}) { const d = db(context.env || {}); if (d?.prepare) { try { const rows = await d.prepare('select report_json from reports order by created_at desc limit 100').all(); return response({ reports: (rows.results || []).map(r => JSON.parse(r.report_json)) }); } catch {} } return response({ reports: [...cache.values()] }); }
export async function deleteData() { cache.clear(); return response({ status: 'cleared' }); }
