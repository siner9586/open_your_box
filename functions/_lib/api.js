import { runPersonalScan, runCompanyScan, runSocialScan, runAccountsScan, reportToMarkdown, reportToCsv, scoreRisk, hashIdentifier, createFinding, accountTaskFromPlatform, maskIdentifier, scanGithubPublic } from '../../src/scanners/core/runtime.mjs';
import { runExternalChecks } from '../../src/scanners/core/external-adapters.mjs';
import { runHibpEmailRange } from '../../src/scanners/core/hibp-adapter.mjs';

const cache = new Map();
const DEFAULT_PLATFORM_CATALOG = [
  { id: 'github', name: 'GitHub', domain: 'github.com', identifiers: ['email', 'username'], recoveryEntry: 'https://github.com/password_reset', dataExportEntry: 'https://github.com/settings/export', deletionEntry: 'https://github.com/settings/admin', cleanupNote: 'Review security settings, SSH keys, tokens and public repositories.' },
  { id: 'google', name: 'Google', domain: 'google.com', identifiers: ['email', 'phone', 'username'], recoveryEntry: 'https://accounts.google.com/signin/recovery', dataExportEntry: 'https://takeout.google.com/', deletionEntry: 'https://myaccount.google.com/delete-services-or-account', cleanupNote: 'Review account security, connected apps and Takeout exports.' },
  { id: 'microsoft', name: 'Microsoft', domain: 'microsoft.com', identifiers: ['email', 'phone', 'username', 'gamertag'], recoveryEntry: 'https://account.live.com/password/reset', dataExportEntry: 'https://account.microsoft.com/privacy', deletionEntry: 'https://account.live.com/closeaccount.aspx', cleanupNote: 'Review recovery methods and connected devices.' },
  { id: 'facebook', name: 'Facebook', domain: 'facebook.com', identifiers: ['email', 'phone', 'username'], recoveryEntry: 'https://www.facebook.com/login/identify', dataExportEntry: 'https://www.facebook.com/dyi', deletionEntry: 'https://www.facebook.com/help/delete_account', cleanupNote: 'Review public profile, sessions and data export.' },
  { id: 'x', name: 'X / Twitter', domain: 'x.com', identifiers: ['email', 'phone', 'username'], recoveryEntry: 'https://x.com/account/begin_password_reset', dataExportEntry: 'https://x.com/settings/download_your_data', deletionEntry: 'https://x.com/settings/deactivate', cleanupNote: 'Review login methods and public profile exposure.' },
  { id: 'linkedin', name: 'LinkedIn', domain: 'linkedin.com', identifiers: ['email', 'phone', 'username'], recoveryEntry: 'https://www.linkedin.com/checkpoint/rp/request-password-reset', dataExportEntry: 'https://www.linkedin.com/psettings/member-data', deletionEntry: 'https://www.linkedin.com/help/linkedin/answer/a1339364', cleanupNote: 'Review public résumé fields and data export.' },
  { id: 'wechat', name: 'WeChat', domain: 'wechat.com', identifiers: ['phone', 'wechat_id', 'nickname'], recoveryEntry: 'https://help.wechat.com/', dataExportEntry: 'https://help.wechat.com/', deletionEntry: 'https://help.wechat.com/', cleanupNote: 'Review phone binding, recovery entries and privacy settings.' }
];
const STATUS_ORDER = ['已确认有账号/登录记录', '可能存在账号', '候选待确认', '未发现证据', '跳过', '查询失败', '待人工确认'];
const response = (data, status = 200, type = 'application/json; charset=utf-8') => new Response(type.includes('json') ? JSON.stringify(data, null, 2) : data, { status, headers: { 'content-type': type, 'cache-control': 'no-store' } });
const db = (env = {}) => env.DB || env.OYB_DB || env.OYB_DATABASE || null;
const safeMsg = (error = {}) => String(error?.message || error || 'unknown_error').replace(/(Bearer\s+)[A-Za-z0-9._~-]+/gi, '$1[redacted]').replace(/(key=)[^\s&]+/gi, '$1[redacted]').replace(/(authorization|cookie|token|secret|password)[^,;\n]*/gi, '$1=[redacted]').slice(0, 240);
const cleanId = (id = '') => String(id || '').replace(/^report_/, '');
const now = () => new Date().toISOString();
const localId = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
function jsonError(code, status = 500, message = code, detail) { return response({ error: { code, message, ...(detail ? { detail } : {}) } }, status); }
async function body(request) { try { return await request.json(); } catch { return {}; } }
function findLocal(id = '') { return cache.get(cleanId(id)) || cache.get(id); }
function gate(request, env = {}) {
  if (request.method !== 'GET' && !(request.headers.get('idempotency-key') || request.headers.get('x-idempotency-key'))) return jsonError('MISSING_IDEMPOTENCY_KEY', 400, 'POST requests require an Idempotency-Key header.');
  const token = request.headers.get('x-private-token') || request.headers.get('authorization') || '';
  if (request.method !== 'GET' && env.SCAN_MODE !== 'private' && token.length < 12) return jsonError('MISSING_AUTH_TOKEN', 401, 'Private mode token is required for write operations.');
  return null;
}
function ensureCatalog(payload = {}) { payload.platformCatalog = Array.isArray(payload.platformCatalog) && payload.platformCatalog.length ? payload.platformCatalog : DEFAULT_PLATFORM_CATALOG; return payload; }
function normalizeIdentifierList(p = {}) { return (p.identifiers || []).map(x => String(x).toLowerCase()); }

function accountStatusMeta(task = {}) {
  if (task.statusLabel) return { statusLabel: task.statusLabel, statusLevel: task.statusLevel || 'info', evidenceSource: task.evidenceSource || 'provided_status', statusReason: task.statusReason || '按报告证据判断。' };
  const raw = `${task.accountStatus || ''} ${task.taskType || ''} ${task.notes || ''} ${task.evidenceSource || ''}`.toLowerCase();
  if (/adapter_error|query_failed|lookup_failed|failed/.test(raw)) return { statusLabel: '查询失败', statusLevel: 'medium', evidenceSource: 'adapter_error', statusReason: '查询源返回错误、网络失败或平台风控，不能据此判断账号不存在。' };
  if (/adapter_status|skipped|missing_|not_configured|authorization|limited/.test(raw)) return { statusLabel: '跳过', statusLevel: 'info', evidenceSource: 'adapter_skipped', statusReason: '缺少授权、密钥、实名或用户数据，当前未执行该项查询。' };
  if (/no_match|not_found|zero|未发现/.test(raw)) return { statusLabel: '未发现证据', statusLevel: 'info', evidenceSource: 'no_evidence_found', statusReason: '已检查的当前数据源未发现该平台线索，不代表平台绝对没有账号。' };
  if (/confirmed|password_manager/.test(raw)) return { statusLabel: '已确认有账号/登录记录', statusLevel: 'high', evidenceSource: 'user_import_login_record', statusReason: '你提供的密码管理器、账号导入或登录记录中出现该平台。' };
  if (/mailbox|browser|platform_export|possible/.test(raw)) return { statusLabel: '可能存在账号', statusLevel: 'medium', evidenceSource: 'user_import_trace', statusReason: '你提供的邮箱、浏览器、书签、历史或平台导出元信息中出现该平台线索。' };
  if (/candidate_from_username|username_review|username_nickname_candidate|candidate/.test(raw)) return { statusLabel: '候选待确认', statusLevel: 'low', evidenceSource: 'username_nickname_catalog_candidate', statusReason: '仅根据用户名/昵称和平台目录生成候选任务，不代表已经确认存在账号。' };
  return { statusLabel: '待人工确认', statusLevel: 'info', evidenceSource: 'manual_review_required', statusReason: '当前证据不足，需要通过官方入口人工确认。' };
}
function enrichAccountStatuses(report = {}) {
  report.accountTasks = (report.accountTasks || []).map(task => ({ ...task, ...accountStatusMeta(task) }));
  const summary = Object.fromEntries(STATUS_ORDER.map(k => [k, 0]));
  for (const task of report.accountTasks) summary[task.statusLabel] = (summary[task.statusLabel] || 0) + 1;
  report.accountStatusSummary = summary;
  report.platformAccountStatus = report.accountTasks.map(t => ({ platformId: t.platformId || '', platformName: t.platformName || '', status: t.statusLabel, statusLevel: t.statusLevel, evidenceSource: t.evidenceSource, reason: t.statusReason, actionUrl: t.actionUrl || t.recoveryEntry || t.dataExportEntry || t.deletionEntry || '' })).slice(0, 300);
  report.accountStatusLegend = { confirmed: '已确认有账号/登录记录：用户上传/导入材料中出现明确登录记录或官方授权结果。', possible: '可能存在账号：来自邮箱、浏览器、书签、历史、导出元信息等间接线索。', candidate: '候选待确认：仅用户名/昵称候选才进入账号任务；邮箱/手机号目录覆盖不会被当成账号状态。', noEvidence: '未发现证据：已检查的数据源未发现线索，不代表绝对没有账号。', skipped: '跳过：缺少 API Key、授权、实名、上传数据或平台不支持。', failed: '查询失败：网络、平台风控或接口错误，不能据此判断不存在。', unknown: '待人工确认：没有足够证据，需要走官方入口核验。' };
  return report;
}

async function runDb(statement, binds = []) { return statement.bind(...binds).run(); }
async function saveReport(env = {}, report = {}) {
  const d = db(env);
  if (!d?.prepare || !report?.id) return { persisted: false, reason: 'D1 binding DB is not available.' };
  const created = report.generatedAt || now();
  const userId = 'local';
  const subject = JSON.stringify(report.maskedSubject || {});
  try {
    await runDb(d.prepare('insert or replace into reports (id,user_id,job_id,report_type,risk_score,report_json,created_at) values (?,?,?,?,?,?,?)'), [report.id, userId, report.scanId, report.reportType, Number(report.riskScore?.total || 0), JSON.stringify(report), created]);
    await runDb(d.prepare('insert or replace into jobs (id,user_id,subject_type,subject_hash,mode,status,progress,started_at,finished_at,error_message,created_at) values (?,?,?,?,?,?,?,?,?,?,?)'), [report.scanId, userId, report.reportType, await hashIdentifier(subject, env.HASH_SALT || 'open-your-box'), report.reportType, 'completed', 100, created, created, '', created]);
    await runDb(d.prepare('delete from findings where job_id = ?'), [report.scanId]);
    for (const finding of report.findings || []) await runDb(d.prepare('insert or replace into findings (id,job_id,user_id,source,category,severity,confidence,title,summary,evidence_type,evidence_preview,evidence_ref,remediation_json,created_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'), [finding.id, report.scanId, userId, finding.source, finding.category, finding.severity, finding.confidence, finding.title, finding.summary, finding.evidenceType, finding.evidencePreview, finding.evidenceRef || '', JSON.stringify(finding.remediation || {}), finding.createdAt || created]);
    for (const task of report.accountTasks || []) await runDb(d.prepare('insert or replace into account_tasks (id,user_id,platform_id,platform_name,account_status,task_type,task_status,action_url,notes,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?)'), [task.id, userId, task.platformId || '', task.platformName || '', task.statusLabel || task.accountStatus || 'possible', task.taskType || 'review', task.taskStatus || 'todo', task.actionUrl || task.recoveryEntry || task.dataExportEntry || task.deletionEntry || '', `${report.scanId} · ${task.statusLabel || ''} · ${task.statusReason || ''} · ${task.notes || ''}`.slice(0, 900), task.createdAt || created, task.updatedAt || created]);
    return { persisted: true };
  } catch (error) { return { persisted: false, error: { code: 'D1_WRITE_FAILED', message: safeMsg(error) } }; }
}
async function readReport(env = {}, id = '') {
  const local = findLocal(id); if (local) return enrichAccountStatuses(local);
  const d = db(env); if (!d?.prepare) return null;
  const key = cleanId(id);
  try { const row = await d.prepare('select report_json from reports where id = ? or job_id = ? or id = ? limit 1').bind(id, key, `report_${key}`).first(); return row?.report_json ? enrichAccountStatuses(JSON.parse(row.report_json)) : null; } catch { return null; }
}

function identifierCoverageMatrix(payload = {}, scanId = 'scan') {
  const ids = payload.identifiers || {};
  const catalog = Array.isArray(payload.platformCatalog) ? payload.platformCatalog : [];
  const inputs = [
    { key: 'email', label: '邮箱', identifier: 'email', value: String(ids.email || '').trim() },
    { key: 'phone', label: '手机号', identifier: 'phone', value: String(ids.phone || '').trim() }
  ].filter(x => x.value);
  if (!inputs.length) return { findings: [], coverage: [], truth: [] };
  const findings = [], coverageMap = new Map(), truth = [];
  for (const input of inputs) {
    const platforms = catalog.filter(p => normalizeIdentifierList(p).includes(input.identifier)).slice(0, 180);
    truth.push({ identifierType: input.key, label: input.label, apiExecuted: false, deterministicResult: false, reason: `本轮没有调用任何可确认${input.label}是否注册某个平台的官方 API 或实名验证接口。` });
    for (const p of platforms) {
      const key = p.id || p.name || p.domain || `${input.identifier}_${coverageMap.size}`;
      const item = coverageMap.get(key) || { platformId: p.id || '', platformName: p.name || '', domain: p.domain || '', supportedIdentifiers: new Set(), recoveryEntry: p.recoveryEntry || '', dataExportEntry: p.dataExportEntry || '', deletionEntry: p.deletionEntry || '', note: p.cleanupNote || '' };
      item.supportedIdentifiers.add(input.label);
      coverageMap.set(key, item);
    }
    findings.push(createFinding({ scanId, subjectType: 'account', source: `${input.key}_identifier_coverage`, category: 'coverage_status', severity: 'info', confidence: 'verified', title: `${input.label}未执行账号命中查询`, summary: `本轮没有调用可确认${input.label}是否注册某个平台的官方 API、运营商接口或实名验证接口；下方仅展示平台目录中的通用找回/导出/注销入口覆盖范围。`, evidenceType: 'self_declared_identifier', evidencePreview: `${input.label}已脱敏 · ${platforms.length} 个通用入口`, affectedIdentifierMasked: maskIdentifier(input.value, input.key), remediation: { actionType: 'verify_with_official_flow', label: `使用官方入口逐项确认${input.label}`, steps: ['不要把覆盖范围当成账号命中', '优先使用官方找回入口验证是否本人账号', '确认后再导出数据、解绑或注销'] } }));
  }
  const coverage = [...coverageMap.values()].map(item => ({ ...item, supportedIdentifiers: [...item.supportedIdentifiers], status: '目录覆盖，不是账号命中', certainty: 'not_deterministic', evidenceSource: 'platform_catalog_only', reason: '该平台目录声明支持邮箱/手机号等入口；未查询该号码或邮箱是否真实注册。' })).slice(0, 300);
  return { findings, coverage, truth };
}
function usernameNicknameMatrix(payload = {}, scanId = 'scan') {
  const ids = payload.identifiers || {}, username = String(ids.username || ids.nickname || '').trim();
  if (!username) return { findings: [], tasks: [] };
  const catalog = Array.isArray(payload.platformCatalog) ? payload.platformCatalog : [];
  const candidates = catalog.filter(p => { const identifiers = normalizeIdentifierList(p); const category = String(p.category || '').toLowerCase(); return identifiers.some(x => ['username', 'nickname', 'github_username', 'wechat_id', 'qq_number', 'gamertag'].includes(x)) || /social|community|creator|developer|forum|gaming|video|music|livestream|work|professional|microblog|content|knowledge|lifestyle|travel|local_life/i.test(category); }).slice(0, 150);
  const masked = maskIdentifier(username, 'username');
  const tasks = candidates.map(p => ({ ...accountTaskFromPlatform(p, 'username_nickname_candidate', 'candidate'), id: localId(`task_username_${p.id || 'platform'}`), accountStatus: 'candidate_from_username', taskType: 'username_review', taskStatus: 'todo', actionUrl: p.recoveryEntry || p.dataExportEntry || p.deletionEntry || '', evidenceSource: 'username_nickname_catalog_candidate', statusLabel: '候选待确认', statusLevel: 'low', statusReason: '仅根据用户名/昵称和平台目录生成候选任务，不代表已经确认存在账号。', notes: `username_nickname_candidate: ${p.cleanupNote || 'Use official recovery, data export and closing flows to confirm whether this is your account.'} 原始用户名/昵称仅用于本次匹配，报告中以脱敏摘要呈现。`, createdAt: now(), updatedAt: now() }));
  const finding = createFinding({ scanId, subjectType: 'account', source: 'username_nickname_matrix', category: 'platform_candidate_matrix', severity: candidates.length >= 80 ? 'medium' : 'low', confidence: 'medium', title: `用户名/昵称平台候选矩阵：${candidates.length} 个平台`, summary: '测试阶段根据现有社交与应用平台目录生成候选账号任务；不执行陌生人隐私查询，不保存原始昵称，不绕过平台限制。', evidenceType: 'self_declared_identifier', evidencePreview: `${masked} · ${candidates.slice(0, 18).map(p => p.name).join(', ')}`, affectedIdentifierMasked: masked, remediation: { actionType: 'account_cleanup', label: '逐个平台确认本人账号', steps: ['优先使用官方找回入口确认是否为本人账号', '确认后导出数据并开启多因素认证', '对不用的平台执行解绑、停用或注销'] } });
  return { findings: [finding], tasks };
}

function isVerifiedCompany(payload = {}) { return Boolean(payload.authorization?.verified || ['manual_admin_test', 'manual_admin', 'cloudflare_zone', 'dns_txt'].includes(payload.authorization?.method)); }
async function scanCertificateTransparencyReal(domain = '', scanId = 'scan') {
  const clean = value => String(value || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].replace(/[^a-z0-9.-]/g, '').replace(/^\.+|\.+$/g, '');
  const d = clean(domain); if (!d) return [];
  try {
    const res = await fetch(`https://crt.sh/?q=${encodeURIComponent(`%.${d}`)}&output=json`, { headers: { 'user-agent': 'OpenYourBox-CTSummary/1.0' } });
    if (!res.ok) throw new Error(`crt.sh HTTP ${res.status}`);
    const rows = await res.json();
    const names = [...new Set((Array.isArray(rows) ? rows : []).flatMap(r => String(r.name_value || '').split(/\n+/)).map(clean).filter(x => x && (x === d || x.endsWith(`.${d}`))))].slice(0, 500);
    const suspicious = names.filter(x => /(dev|test|stage|staging|admin|vpn|internal|old|backup|legacy|uat)/i.test(x));
    return [{ id: localId('finding_ct'), scanId, subjectType: 'domain', source: 'certificate_transparency', category: 'subdomain_inventory', severity: suspicious.length ? 'medium' : names.length > 50 ? 'low' : 'info', confidence: 'verified', title: `CT subdomain summary: ${d}`, summary: `Certificate Transparency returned ${names.length} unique domain names; suspicious naming samples ${suspicious.length}. Raw CT rows are not stored.`, evidenceType: 'certificate_transparency', evidencePreview: `sample=${names.slice(0, 12).map(x => x.split('.').length > 2 ? `*.${x.split('.').slice(-2).join('.')}` : x).join(', ') || 'none'}; suspicious=${suspicious.slice(0, 8).map(x => x.split('.').length > 2 ? `*.${x.split('.').slice(-2).join('.')}` : x).join(', ') || 'none'}`, remediation: { actionType: 'review_asset', label: 'Review CT subdomains', steps: ['Confirm each subdomain is owned', 'Retire stale hosts', 'Review admin/vpn/internal-like names'] }, createdAt: now() }];
  } catch (error) { return [{ id: localId('finding_ct_error'), scanId, subjectType: 'domain', source: 'certificate_transparency', category: 'adapter_error', severity: 'info', confidence: 'low', title: 'CT lookup failed', summary: safeMsg(error), evidenceType: 'certificate_transparency', evidencePreview: d, remediation: { actionType: 'review', label: 'Retry CT lookup', steps: ['Retry later or verify with another CT data source'] }, createdAt: now() }]; }
}
function mergeExtraFindings(report, extra = [], subjectType = 'personal') { if (!extra.length) return report; const seen = new Set((report.findings || []).map(f => `${f.source}:${f.category}:${f.title}`)); for (const item of extra) { const key = `${item.source}:${item.category}:${item.title}`; if (!seen.has(key)) { report.findings.push(item); seen.add(key); } } report.riskScore = scoreRisk(report.findings, subjectType); report.dataSources = [...new Set([...(report.dataSources || []), ...extra.map(f => f.source)])]; report.remediationSteps = [...new Set(report.findings.flatMap(f => f.remediation?.steps || []))].slice(0, 20); return report; }
function mergeTasks(report, tasks = []) { if (!tasks.length) return report; const seen = new Set((report.accountTasks || []).map(t => `${t.platformId}:${t.taskType}:${t.platformName}:${t.evidenceSource || ''}`)); for (const task of tasks) { const key = `${task.platformId}:${task.taskType}:${task.platformName}:${task.evidenceSource || ''}`; if (!seen.has(key)) { report.accountTasks.push(task); seen.add(key); } } return report; }

export async function handleScan(context, mode) {
  const denied = gate(context.request, context.env); if (denied) return denied;
  try {
    const payload = ensureCatalog(await body(context.request));
    payload.authorization ||= { mode: 'private', verified: false };
    const runner = { personal: runPersonalScan, company: runCompanyScan, social: runSocialScan, accounts: runAccountsScan }[mode];
    if (!runner) return jsonError('INVALID_SCAN_MODE', 400, 'Unsupported scan mode.');
    const report = await runner(payload, context.env);
    if (mode === 'personal') report.findings = (report.findings || []).filter(f => f.source !== 'hibp');
    if (mode === 'company') report.findings = (report.findings || []).filter(f => f.source !== 'shodan' && !(f.source === 'certificate_transparency' && /adapter ready/i.test(f.title || '')));
    let extra = [];
    if (mode === 'personal') {
      if (payload.identifiers?.email) extra.push(...await runHibpEmailRange(payload.identifiers.email, context.env, Boolean(payload.authorization?.verified), report.scanId));
      const coverage = identifierCoverageMatrix(payload, report.scanId); extra.push(...coverage.findings); report.identifierCoverageSuggestions = coverage.coverage; report.identifierTruthStatement = coverage.truth;
      const matrix = usernameNicknameMatrix(payload, report.scanId); extra.push(...matrix.findings); mergeTasks(report, matrix.tasks);
      const username = String(payload.identifiers?.username || payload.identifiers?.nickname || '').trim(); if (username && !payload.identifiers?.github) extra.push(...await scanGithubPublic(username, context.env, report.scanId));
    } else if (mode === 'company') extra = [...(isVerifiedCompany(payload) && payload.domain ? await scanCertificateTransparencyReal(payload.domain, report.scanId) : []), ...await runExternalChecks(mode, payload, context.env, report.scanId)];
    mergeExtraFindings(report, extra, mode === 'company' ? 'company' : 'personal');
    enrichAccountStatuses(report);
    cache.set(report.scanId, report);
    const persistence = await saveReport(context.env, report);
    const status = persistence.persisted ? 'completed' : 'completed_not_persisted';
    return response({ status, taskId: report.scanId, reportId: report.id, ...persistence, report });
  } catch (error) { return jsonError('SCAN_FAILED', 500, 'Scan failed with a sanitized runtime error.', safeMsg(error)); }
}
export async function getReport(context) { const report = await readReport(context.env, context.params?.id || ''); return report ? response(report) : jsonError('REPORT_NOT_FOUND', 404, 'Report not found.'); }
export async function listReports(context = {}) { const d = db(context.env || {}); if (d?.prepare) { try { const rows = await d.prepare('select id, job_id, report_type, risk_score, created_at from reports order by created_at desc limit 50').all(); return response({ reports: (rows.results || []).map(r => ({ id: r.id, scanId: r.job_id, reportType: r.report_type, riskScore: r.risk_score, createdAt: r.created_at })) }); } catch (error) { return jsonError('D1_READ_FAILED', 500, 'Could not read reports from D1.', safeMsg(error)); } } return response({ reports: [...cache.values()].map(r => ({ id: r.id, scanId: r.scanId, reportType: r.reportType, riskScore: r.riskScore?.total || 0, createdAt: r.generatedAt })) }); }
export async function exportReport(context) { const report = await readReport(context.env, context.params?.id || ''); if (!report) return jsonError('REPORT_NOT_FOUND', 404, 'Report not found.'); const format = new URL(context.request.url).searchParams.get('format'); if (format === 'md') return response(reportToMarkdown(report), 200, 'text/markdown; charset=utf-8'); if (format === 'csv') return response(reportToCsv(report), 200, 'text/csv; charset=utf-8'); return response(report); }
export async function getTask() { return jsonError('TASK_NOT_FOUND', 404, 'Task endpoint is reserved.'); }
export async function handleUpload(context, kind) { const denied = gate(context.request, context.env); if (denied) return denied; try { const text = await context.request.text(); const uploads = kind === 'mailbox' ? { mailboxText: text } : kind === 'browser-history' ? { browserText: text } : kind === 'platform-export' ? { platformExportText: text } : { passwordManagerText: text }; const report = await runPersonalScan(ensureCatalog({ uploads, authorization: { mode: 'private', verified: false } }), context.env); enrichAccountStatuses(report); cache.set(report.scanId, report); const persistence = await saveReport(context.env, report); return response({ status: 'processed', kind, reportId: report.id, taskId: report.scanId, ...persistence, report }); } catch (error) { return jsonError('UPLOAD_PROCESS_FAILED', 500, 'Upload text could not be processed.', safeMsg(error)); } }
export async function exportData(context = {}) { const d = db(context.env || {}); if (d?.prepare) { try { const rows = await d.prepare('select report_json from reports where user_id = ? order by created_at desc limit 100').bind('local').all(); return response({ reports: (rows.results || []).map(r => enrichAccountStatuses(JSON.parse(r.report_json))) }); } catch (error) { return jsonError('D1_EXPORT_FAILED', 500, 'Could not export report data.', safeMsg(error)); } } return response({ reports: [...cache.values()].map(enrichAccountStatuses) }); }
export async function deleteData(context = {}) { const denied = context.request ? gate(context.request, context.env) : null; if (denied) return denied; cache.clear(); const d = db(context.env || {}); if (d?.prepare) { try { await d.prepare('delete from findings where user_id = ?').bind('local').run(); await d.prepare('delete from account_tasks where user_id = ?').bind('local').run(); await d.prepare('delete from jobs where user_id = ?').bind('local').run(); await d.prepare('delete from reports where user_id = ?').bind('local').run(); return response({ status: 'cleared', persisted: true }); } catch (error) { return jsonError('D1_DELETE_FAILED', 500, 'Could not delete test report data.', safeMsg(error)); } } return response({ status: 'cleared', persisted: false }); }
async function txtRecords(domain = '') { const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=TXT`, { headers: { accept: 'application/dns-json' } }); if (!res.ok) throw new Error(`DNS TXT ${res.status}`); const data = await res.json(); return (data.Answer || []).map(r => String(r.data || '').replace(/^"|"$/g, '').replace(/"\s+"/g, '')); }
function cleanDomain(value = '') { return String(value || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].replace(/[^a-z0-9.-]/g, '').replace(/^\.+|\.+$/g, ''); }
export async function verifyDnsTxt(context = {}) { const denied = gate(context.request, context.env); if (denied) return denied; try { const input = await body(context.request); const domain = cleanDomain(input.domain || ''); if (!domain) return jsonError('INVALID_DOMAIN', 400, 'A domain is required.'); const salt = context.env?.HASH_SALT || 'open-your-box-dns-txt'; const token = input.token || `oyb-${(await hashIdentifier(domain, salt)).slice(0, 24)}`; const recordName = `_openyourbox.${domain}`; if (!input.check) return response({ status: 'token_generated', domain, recordName, token, txtValue: token, instructions: `Add TXT ${recordName} = ${token}, then call this endpoint again with check:true.` }); const records = await txtRecords(recordName); const verified = records.some(value => value.includes(token)); return response({ status: verified ? 'verified' : 'pending', domain, recordName, token, verified, authorization: verified ? { mode: 'private', verified: true, method: 'dns_txt' } : { mode: 'private', verified: false, method: 'dns_txt_pending' } }); } catch (error) { return jsonError('DNS_TXT_VERIFY_FAILED', 500, 'DNS TXT verification failed.', safeMsg(error)); } }
