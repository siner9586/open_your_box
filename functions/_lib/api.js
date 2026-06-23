import { runPersonalScan, runCompanyScan, runSocialScan, runAccountsScan, reportToMarkdown, reportToCsv } from '../../src/scanners/core/runtime.mjs';

const cache = new Map();
const response = (data, status = 200, type = 'application/json; charset=utf-8') => new Response(type.includes('json') ? JSON.stringify(data, null, 2) : data, { status, headers: { 'content-type': type, 'cache-control': 'no-store' } });
async function body(request) { try { return await request.json(); } catch { return {}; } }
function find(id = '') { return cache.get(id.replace(/^report_/, '')) || cache.get(id); }
export async function handleScan(context, mode) {
  const payload = await body(context.request);
  payload.platformCatalog ||= [];
  payload.authorization ||= { mode: 'private', verified: false };
  const runner = { personal: runPersonalScan, company: runCompanyScan, social: runSocialScan, accounts: runAccountsScan }[mode];
  const report = await runner(payload, context.env);
  cache.set(report.scanId, report);
  return response({ status: 'completed', taskId: report.scanId, reportId: report.id, report });
}
export async function getReport(context) { const report = find(context.params?.id || ''); return report ? response(report) : response({ status: 'not_found' }, 404); }
export async function listReports() { return response({ reports: [...cache.values()].map(r => ({ id: r.id, scanId: r.scanId, reportType: r.reportType, riskScore: r.riskScore.total, createdAt: r.generatedAt })) }); }
export async function exportReport(context) { const report = find(context.params?.id || ''); if (!report) return response({ error: { code: 'REPORT_NOT_FOUND' } }, 404); const f = new URL(context.request.url).searchParams.get('format'); if (f === 'md') return response(reportToMarkdown(report), 200, 'text/markdown; charset=utf-8'); if (f === 'csv') return response(reportToCsv(report), 200, 'text/csv; charset=utf-8'); return response(report); }
export async function getTask() { return response({ status: 'not_found' }, 404); }
export async function exportData() { return response({ reports: [...cache.values()] }); }
