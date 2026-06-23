import { runPersonalScan, runCompanyScan, runSocialScan, runAccountsScan } from '../../src/scanners/core/runtime.mjs';

const cache = new Map();
const response = (data, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
async function body(request) { try { return await request.json(); } catch { return {}; } }
export async function handleScan(context, mode) {
  const payload = await body(context.request);
  payload.platformCatalog ||= [];
  const runner = { personal: runPersonalScan, company: runCompanyScan, social: runSocialScan, accounts: runAccountsScan }[mode];
  const report = await runner(payload, context.env);
  cache.set(report.scanId, report);
  return response({ status: 'completed', taskId: report.scanId, reportId: report.id, report });
}
export async function getReport(context) { const id = context.params?.id || ''; const report = cache.get(id.replace(/^report_/, '')) || cache.get(id); return report ? response(report) : response({ status: 'not_found' }, 404); }
export async function listReports() { return response({ reports: [...cache.values()].map(r => ({ id: r.id, scanId: r.scanId, reportType: r.reportType })) }); }
