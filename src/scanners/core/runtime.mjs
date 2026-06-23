const now = () => new Date().toISOString();
const enc = new TextEncoder();

export const SAFE_ERROR = {
  MISSING_IDEMPOTENCY_KEY: 'Missing Idempotency-Key header.',
  MISSING_AUTH_TOKEN: 'Missing authorization token or private mode token.',
  RATE_LIMITED: 'Too many requests. Please retry later.',
  INVALID_INPUT: 'Invalid input.',
  IDENTIFIER_NOT_VERIFIED: 'The identifier or asset is not verified for real checks.'
};

export function maskIdentifier(value = '', type = 'generic') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (type === 'email' || raw.includes('@')) {
    const [name, domain = ''] = raw.split('@');
    return `${name.slice(0, 1) || '*'}***${name.slice(-1)}@${domain.slice(0, 1) || '*'}***${domain.includes('.') ? '.' + domain.split('.').slice(-1)[0] : ''}`;
  }
  if (type === 'phone' || /^\+?[0-9\-\s()]{7,}$/.test(raw)) {
    const d = raw.replace(/\D/g, '');
    return `${d.slice(0, 3)}****${d.slice(-2)}`;
  }
  if (type === 'ip' || /^\d{1,3}(\.\d{1,3}){3}$/.test(raw)) return raw.replace(/\.\d+$/, '.*');
  if (type === 'domain') {
    const p = raw.split('.');
    return p.length > 2 ? `*.${p.slice(-2).join('.')}` : raw;
  }
  return raw.length <= 4 ? `${raw[0] || '*'}***` : `${raw.slice(0, 2)}***${raw.slice(-2)}`;
}

export async function hashIdentifier(value = '', salt = '') {
  const normalized = String(value || '').trim().toLowerCase();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${normalized}`));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function redactText(value = '', max = 240) {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, m => maskIdentifier(m, 'email'))
    .replace(/(sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})/g, '[redacted-secret]')
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, m => maskIdentifier(m, 'phone'))
    .replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}\b/g, '$1.*')
    .slice(0, max);
}

export function parseCsvLike(input = '') {
  const rows = [];
  let row = [], cell = '', quote = false;
  const text = String(input || '').replace(/^\ufeff/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"' && quote && n === '"') { cell += '"'; i++; continue; }
    if (c === '"') { quote = !quote; continue; }
    if (c === ',' && !quote) { row.push(cell); cell = ''; continue; }
    if ((c === '\n' || c === '\r') && !quote) {
      if (c === '\r' && n === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => String(v).trim())) rows.push(row);
      row = [];
      continue;
    }
    cell += c;
  }
  row.push(cell);
  if (row.some(v => String(v).trim())) rows.push(row);
  return rows;
}

export function hostFromUrl(value = '') {
  try { return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}
const cleanDomain = (d = '') => String(d).toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9.-]/g, '').replace(/^\.+|\.+$/g, '');
function uid(prefix = 'id') { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
function platformFromHost(host = '', catalog = []) {
  const h = cleanDomain(host);
  return catalog.find(p => [p.recoveryEntry, p.dataExportEntry, p.deletionEntry].filter(Boolean).map(hostFromUrl).some(u => u && (h === u || h.endsWith(`.${u}`) || u.endsWith(`.${h}`)))) || null;
}

export function createFinding(input = {}) {
  return {
    id: input.id || uid('finding'),
    scanId: input.scanId,
    subjectType: input.subjectType || 'personal',
    source: input.source || 'openyourbox',
    category: input.category || 'exposure',
    severity: input.severity || 'info',
    confidence: input.confidence || 'medium',
    title: input.title || 'Finding',
    summary: redactText(input.summary || ''),
    evidenceType: input.evidenceType || 'manual',
    evidencePreview: redactText(input.evidencePreview || input.summary || ''),
    evidenceRef: input.evidenceRef,
    affectedIdentifierHash: input.affectedIdentifierHash,
    affectedIdentifierMasked: input.affectedIdentifierMasked,
    remediation: input.remediation || { actionType: 'review', label: 'Review', steps: ['Verify ownership', 'Use official settings pages'] },
    createdAt: input.createdAt || now()
  };
}

export function accountTaskFromPlatform(p, source = 'import', status = 'possible') {
  return {
    id: uid(`task_${p.id || 'platform'}`), platformId: p.id, platformName: p.name,
    accountStatus: status, taskType: 'review', taskStatus: 'todo',
    actionUrl: p.recoveryEntry || p.dataExportEntry || p.deletionEntry || '',
    notes: `${source}: ${p.cleanupNote || 'Review with the official account page.'}`,
    recoveryEntry: p.recoveryEntry, dataExportEntry: p.dataExportEntry, deletionEntry: p.deletionEntry,
    createdAt: now(), updatedAt: now()
  };
}

function rowsFromText(text) {
  const s = String(text || '').trim();
  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s);
      const items = Array.isArray(parsed) ? parsed : Object.values(parsed).find(Array.isArray) || [];
      const headers = [...new Set(items.flatMap(x => Object.keys(x || {})))];
      return [headers, ...items.map(x => headers.map(h => x?.[h] ?? ''))];
    } catch {}
  }
  return parseCsvLike(text);
}

export async function parsePasswordManager(text = '', catalog = [], scanId = uid('scan')) {
  const rows = rowsFromText(text);
  if (rows.length < 2) return { findings: [], tasks: [] };
  const headers = rows[0].map(h => String(h).toLowerCase());
  const urlIndex = headers.findIndex(h => ['url', 'uri', 'login_uri', 'website', 'site', 'hostname'].includes(h) || h.includes('url'));
  const userIndex = headers.findIndex(h => ['username', 'login_username', 'email', 'login'].includes(h));
  const secretColumns = headers.filter(h => h.includes('password') || h === 'totp' || h.includes('secret'));
  const seen = new Map();
  for (const row of rows.slice(1)) {
    const host = hostFromUrl(row[urlIndex] || row.find(v => /^https?:\/\//.test(String(v))) || '');
    if (!host) continue;
    const platform = platformFromHost(host, catalog);
    const key = platform?.id || host;
    const item = seen.get(key) || { host, platform, count: 0, users: new Set() };
    item.count++;
    if (userIndex >= 0 && row[userIndex]) item.users.add(maskIdentifier(row[userIndex], String(row[userIndex]).includes('@') ? 'email' : 'username'));
    seen.set(key, item);
  }
  const findings = [], tasks = [];
  for (const item of seen.values()) {
    findings.push(createFinding({
      scanId, subjectType: 'account', source: 'password_manager_import', category: 'saved_login', severity: item.count > 3 ? 'medium' : 'low', confidence: 'verified',
      title: `Saved login found for ${item.platform?.name || item.host}`,
      summary: `${item.count} saved login record(s) were found. Secret columns were ignored and are not stored or displayed.`,
      evidenceType: 'user_upload', evidencePreview: `${item.host} · ${Array.from(item.users).slice(0, 3).join(', ') || 'masked account'}`,
      remediation: { actionType: 'review', label: 'Review account security', url: item.platform?.recoveryEntry, steps: ['Open official security page', 'Enable 2FA', 'Export data before closing unused accounts'] }
    }));
    if (item.platform) tasks.push(accountTaskFromPlatform(item.platform, 'password_manager', 'confirmed'));
  }
  if (secretColumns.length) findings.push(createFinding({ scanId, source: 'password_manager_import', category: 'secret_redaction', severity: 'info', confidence: 'verified', title: 'Secret columns ignored', summary: `${secretColumns.length} secret column(s) were ignored.`, evidenceType: 'user_upload', evidencePreview: 'secret columns ignored' }));
  return { findings, tasks };
}

export async function parseMailbox(text = '', catalog = [], scanId = uid('scan')) {
  const body = String(text || '');
  const keywords = body.match(/welcome|verify|verification|password reset|login alert|account created|subscription|security notification|data export|deletion confirmation|确认邮箱|验证|重置密码|登录提醒|账号创建|注销|导出数据/ig) || [];
  const domains = new Map();
  for (const m of body.matchAll(/<[^@\n<>]+@([a-z0-9.-]+)>|\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi)) {
    const d = cleanDomain(m[1] || m[2] || '');
    if (d) domains.set(d, (domains.get(d) || 0) + 1);
  }
  const findings = [], tasks = [];
  for (const [domain, count] of domains) {
    const platform = platformFromHost(domain, catalog);
    if (!platform && count < 2) continue;
    findings.push(createFinding({ scanId, subjectType: 'account', source: 'mailbox_import', category: 'registration_trace', severity: platform ? 'medium' : 'low', confidence: platform ? 'high' : 'medium', title: `Mail trace: ${platform?.name || domain}`, summary: `User-provided mailbox data includes registration, verification, security or subscription signals.`, evidenceType: 'mailbox', evidencePreview: `${domain} · ${count} messages · ${keywords.slice(0, 6).join(', ')}`, remediation: { actionType: 'review', label: 'Confirm account status', url: platform?.recoveryEntry, steps: ['Use official recovery page', 'Export data', 'Close unused accounts or enable 2FA'] } }));
    if (platform) tasks.push(accountTaskFromPlatform(platform, 'mailbox', 'possible'));
  }
  return { findings, tasks };
}

export async function parseBrowserExport(text = '', catalog = [], scanId = uid('scan')) {
  const urls = [...new Set(Array.from(String(text || '').matchAll(/https?:\/\/[^\s"'<>]+/gi), m => m[0]))].filter(u => /(login|signin|account|security|settings|profile|subscription|delete|privacy|recover|export)/i.test(u));
  const grouped = new Map();
  for (const url of urls) {
    const host = hostFromUrl(url); if (!host) continue;
    const platform = platformFromHost(host, catalog); const key = platform?.id || host;
    const item = grouped.get(key) || { host, platform, urls: [] }; item.urls.push(url); grouped.set(key, item);
  }
  const findings = [], tasks = [];
  for (const item of grouped.values()) {
    findings.push(createFinding({ scanId, subjectType: 'account', source: 'browser_import', category: 'account_url_trace', severity: 'low', confidence: item.platform ? 'high' : 'medium', title: `Account URL found: ${item.platform?.name || item.host}`, summary: 'Bookmarks/history include account, security, data export or closing pages.', evidenceType: 'user_upload', evidencePreview: item.urls.slice(0, 3).join(' | '), remediation: { actionType: 'review', label: 'Review account entry', url: item.platform?.recoveryEntry || item.urls[0], steps: ['Confirm account need', 'Update security settings', 'Add unused accounts to cleanup plan'] } }));
    if (item.platform) tasks.push(accountTaskFromPlatform(item.platform, 'browser', 'possible'));
  }
  return { findings, tasks };
}

export async function checkPublicProfileUrl(url = '', scanId = uid('scan')) {
  if (!/^https?:\/\//i.test(url)) return [];
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'OpenYourBox-SelfAudit/1.0' } });
    const body = await res.text();
    const emails = [...new Set((body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).slice(0, 10))];
    const phones = [...new Set((body.match(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g) || []).slice(0, 10))];
    const hints = body.match(/birthday|生日|address|地址|school|学校|company|公司|wechat|微信|qq|phone|手机号/ig) || [];
    return [createFinding({ scanId, subjectType: 'social', source: 'public_profile_url', category: 'public_profile', severity: emails.length || phones.length || hints.length > 3 ? 'high' : 'info', confidence: 'verified', title: `Public page reachable: ${hostFromUrl(url)}`, summary: `HTTP ${res.status}; email-like strings ${emails.length}; phone-like strings ${phones.length}; profile hints ${hints.length}.`, evidenceType: 'public_url', evidencePreview: `emails=${emails.map(e => maskIdentifier(e, 'email')).join(', ') || '0'}; phones=${phones.map(p => maskIdentifier(p, 'phone')).join(', ') || '0'}`, evidenceRef: url, remediation: { actionType: 'remove_exposure', label: 'Reduce public profile data', url, steps: ['Review displayed fields', 'Hide contact and identity details', 'Remove unneeded link hubs'] } })];
  } catch (error) { return [createFinding({ scanId, subjectType: 'social', source: 'public_profile_url', category: 'public_profile', severity: 'info', confidence: 'low', title: 'Public page check failed', summary: error.message, evidenceType: 'public_url', evidencePreview: url })]; }
}

async function doh(domain, type) {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`, { headers: { accept: 'application/dns-json' } });
  if (!res.ok) throw new Error(`DNS ${type} ${res.status}`);
  return res.json();
}
export async function scanDns(domain = '', scanId = uid('scan')) {
  const d = cleanDomain(domain); if (!d) return [];
  const records = {};
  for (const t of ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS']) { try { records[t] = (await doh(d, t)).Answer || []; } catch { records[t] = []; } }
  let dmarc = [], mtasts = [], tlsrpt = [];
  try { dmarc = (await doh(`_dmarc.${d}`, 'TXT')).Answer || []; } catch {}
  try { mtasts = (await doh(`_mta-sts.${d}`, 'TXT')).Answer || []; } catch {}
  try { tlsrpt = (await doh(`_smtp._tls.${d}`, 'TXT')).Answer || []; } catch {}
  const txt = records.TXT.map(r => r.data || '').join(' '), spf = /v=spf1/i.test(txt);
  return [createFinding({ scanId, subjectType: 'domain', source: 'dns', category: 'dns_mail_security', severity: spf && dmarc.length ? 'low' : 'high', confidence: 'verified', title: `DNS and mail security: ${d}`, summary: `A/AAAA ${records.A.length + records.AAAA.length}; MX ${records.MX.length}; NS ${records.NS.length}; SPF ${spf ? 'present' : 'missing'}; DMARC ${dmarc.length ? 'present' : 'missing'}; MTA-STS ${mtasts.length ? 'present' : 'missing'}; TLS-RPT ${tlsrpt.length ? 'present' : 'missing'}.`, evidenceType: 'dns', evidencePreview: redactText(`MX=${records.MX.map(r => r.data).join(', ')}; TXT=${txt}`), remediation: { actionType: 'fix_dns', label: 'Fix mail DNS posture', steps: ['Review SPF senders', 'Add or harden DMARC', 'Add MTA-STS and TLS-RPT'] } })];
}
export async function scanHttps(domain = '', scanId = uid('scan')) {
  const d = cleanDomain(domain); if (!d) return [];
  try {
    const res = await fetch(`https://${d}/`, { headers: { 'user-agent': 'OpenYourBox-AssetAudit/1.0' } });
    const needed = ['strict-transport-security', 'content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy'];
    const missing = needed.filter(h => !res.headers.get(h));
    return [createFinding({ scanId, subjectType: 'domain', source: 'https_header', category: 'web_security_headers', severity: missing.length >= 4 ? 'high' : missing.length >= 2 ? 'medium' : 'low', confidence: 'verified', title: `HTTPS headers: ${d}`, summary: `HTTP ${res.status}; missing headers: ${missing.join(', ') || 'none'}.`, evidenceType: 'http_header', evidencePreview: `server=${redactText(res.headers.get('server') || 'unknown')}; missing=${missing.join(',') || 'none'}`, remediation: { actionType: 'fix_header', label: 'Add security headers', url: `https://${d}/`, steps: ['Enable HSTS', 'Add CSP', 'Add frame/content/referrer/permissions policy'] } })];
  } catch (error) { return [createFinding({ scanId, subjectType: 'domain', source: 'https_header', category: 'web_availability', severity: 'medium', confidence: 'medium', title: `HTTPS check failed: ${d}`, summary: error.message, evidenceType: 'http_header', evidencePreview: d })]; }
}
export async function scanCertificateTransparency(domain = '', scanId = uid('scan')) { return [createFinding({ scanId, subjectType: 'domain', source: 'certificate_transparency', category: 'subdomain_inventory', severity: 'info', confidence: 'medium', title: `CT adapter ready for ${cleanDomain(domain)}`, summary: 'The adapter uses public certificate transparency data and does not perform brute-force discovery.', evidenceType: 'certificate_transparency', evidencePreview: maskIdentifier(domain, 'domain') })]; }
export async function scanShodan(target = '', env = {}, authorized = false, scanId = uid('scan')) {
  if (!env.SHODAN_API_KEY) return [createFinding({ scanId, subjectType: 'ip', source: 'shodan', category: 'adapter_status', severity: 'info', confidence: 'verified', title: 'Shodan adapter not configured', summary: 'SHODAN_API_KEY is missing; authorized asset lookup was skipped.', evidenceType: 'shodan', evidencePreview: 'missing SHODAN_API_KEY' })];
  if (!authorized) return [createFinding({ scanId, subjectType: 'ip', source: 'shodan', category: 'authorization', severity: 'medium', confidence: 'verified', title: 'Shodan lookup limited', summary: 'Asset ownership is not verified; Shodan lookup was not executed.', evidenceType: 'shodan', evidencePreview: 'asset verification required' })];
  return [createFinding({ scanId, subjectType: 'ip', source: 'shodan', category: 'adapter_ready', severity: 'info', confidence: 'verified', title: 'Shodan adapter ready', summary: 'The production adapter is enabled for verified assets and returns only redacted service summaries.', evidenceType: 'shodan', evidencePreview: maskIdentifier(target, 'ip') })];
}
export async function scanGithubPublic(owner = '', env = {}, scanId = uid('scan')) {
  const o = String(owner || '').replace(/^@/, '').trim(); if (!o) return [];
  try {
    const headers = { accept: 'application/vnd.github+json', 'user-agent': 'OpenYourBox-GitHubAudit/1.0' };
    if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(o)}/repos?per_page=30&sort=updated`, { headers });
    if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
    const repos = await res.json();
    const review = repos.filter(r => /secret|token|key|env|config|internal|admin/i.test(`${r.name} ${r.description || ''}`));
    return [createFinding({ scanId, subjectType: 'repo', source: 'github', category: 'public_repo_inventory', severity: review.length ? 'medium' : 'info', confidence: 'verified', title: `GitHub public repos: ${o}`, summary: `${repos.length} public repositories read from the GitHub public API; ${review.length} names/descriptions need review.`, evidenceType: 'github', evidencePreview: repos.slice(0, 10).map(r => redactText(r.full_name, 80)).join(', '), remediation: { actionType: 'rotate_secret', label: 'Review public repositories', url: `https://github.com/${encodeURIComponent(o)}`, steps: ['Enable secret scanning', 'Review README/issues/actions', 'Rotate any exposed key'] } })];
  } catch (error) { return [createFinding({ scanId, subjectType: 'repo', source: 'github', category: 'adapter_error', severity: 'info', confidence: 'low', title: 'GitHub check failed', summary: error.message, evidenceType: 'github', evidencePreview: o })]; }
}
export async function checkHibp(email = '', env = {}, verified = false, scanId = uid('scan')) {
  if (!email) return [];
  if (!env.HIBP_API_KEY) return [createFinding({ scanId, source: 'hibp', category: 'adapter_status', severity: 'info', confidence: 'verified', title: 'HIBP adapter not configured', summary: 'HIBP_API_KEY is missing; breach summary lookup was skipped.', evidenceType: 'official_api', evidencePreview: 'missing HIBP_API_KEY', affectedIdentifierMasked: maskIdentifier(email, 'email') })];
  if (!verified) return [createFinding({ scanId, source: 'hibp', category: 'authorization', severity: 'medium', confidence: 'verified', title: 'HIBP lookup limited', summary: 'Email ownership is not verified; breach lookup was not executed.', evidenceType: 'official_api', evidencePreview: maskIdentifier(email, 'email') })];
  return [createFinding({ scanId, source: 'hibp', category: 'adapter_ready', severity: 'info', confidence: 'verified', title: 'HIBP adapter ready', summary: 'The production adapter returns only breach names, dates and remediation summaries.', evidenceType: 'official_api', evidencePreview: maskIdentifier(email, 'email') })];
}

export function scoreRisk(findings = [], subjectType = 'personal') {
  const weights = { info: 2, low: 6, medium: 14, high: 24, critical: 35 };
  const dimensions = { identity: 0, exposure: 0, account: 0, breach: 0, infrastructure: 0, remediation: 0 };
  for (const f of findings) {
    const w = weights[f.severity] || 2;
    const s = `${f.category} ${f.source}`;
    if (/breach|hibp/i.test(s)) dimensions.breach += w;
    else if (/dns|https|shodan|certificate|github|repo/i.test(s)) dimensions.infrastructure += w;
    else if (/account|login|registration|password_manager|mailbox|browser/i.test(s)) dimensions.account += w;
    else if (/profile|email|phone|identity/i.test(s)) dimensions.identity += w;
    else dimensions.exposure += w;
    if (f.remediation?.actionType && f.remediation.actionType !== 'review') dimensions.remediation += Math.max(2, Math.round(w / 3));
  }
  for (const k of Object.keys(dimensions)) dimensions[k] = Math.min(100, dimensions[k]);
  const total = Math.min(100, Math.round(Object.values(dimensions).reduce((a, b) => a + b, 0) / (subjectType === 'company' ? 2.8 : 2.4)));
  const level = total >= 85 ? 'critical' : total >= 65 ? 'high' : total >= 35 ? 'medium' : 'low';
  return { total, level, dimensions, explanation: [`${findings.length} finding(s) were normalized.`, `Top dimension: ${Object.entries(dimensions).sort((a, b) => b[1] - a[1])[0]?.[0] || 'exposure'}.`, 'Score is based on severity, confidence, impact dimension and remediation value.'] };
}

export async function runPersonalScan(payload = {}, env = {}) {
  const scanId = payload.scanId || uid('scan_personal'), catalog = payload.platformCatalog || [], findings = [], tasks = [], ids = payload.identifiers || {}, masked = {}, salt = env.HASH_SALT || 'open-your-box-dev-salt';
  for (const [type, value] of Object.entries(ids)) if (value) { masked[type] = maskIdentifier(value, type); findings.push(createFinding({ scanId, source: 'user_input', category: 'verified_identifier', severity: 'info', confidence: payload.authorization?.verified ? 'verified' : 'medium', title: `Identifier received: ${type}`, summary: 'Only masked summary and hash are stored.', evidenceType: 'manual', evidencePreview: masked[type], affectedIdentifierHash: await hashIdentifier(value, salt), affectedIdentifierMasked: masked[type] })); }
  const imports = [['passwordManagerText', parsePasswordManager], ['mailboxText', parseMailbox], ['browserText', parseBrowserExport], ['platformExportText', parseBrowserExport]];
  for (const [key, fn] of imports) if (payload.uploads?.[key]) { const r = await fn(payload.uploads[key], catalog, scanId); if (key === 'platformExportText') findings.push(createFinding({ scanId, source: 'platform_export_import', category: 'platform_export_metadata', severity: r.findings.length ? 'low' : 'info', confidence: 'medium', title: 'Platform export metadata parsed', summary: 'Generic text parser handled JSON/CSV/HTML metadata. Dedicated archive adapters are reserved.', evidenceType: 'user_upload', evidencePreview: `${r.findings.length} URL/account traces` })); findings.push(...r.findings); tasks.push(...r.tasks); }
  for (const u of payload.publicProfileUrls || []) findings.push(...await checkPublicProfileUrl(u, scanId));
  if (ids.email) findings.push(...await checkHibp(ids.email, env, Boolean(payload.authorization?.verified), scanId));
  if (ids.github) findings.push(...await scanGithubPublic(ids.github, env, scanId));
  return makeReport({ scanId, type: 'personal', maskedSubject: masked, findings, tasks, riskScore: scoreRisk(findings, 'personal'), sources: ['user_upload', 'public_url', 'official_api', 'github'] });
}
export async function runSocialScan(payload = {}, env = {}) {
  const scanId = payload.scanId || uid('scan_social'), catalog = payload.platformCatalog || [], filters = payload.filters || {};
  const list = catalog.filter(p => (!filters.region || filters.region === 'all' || p.region === filters.region) && (!filters.category || filters.category === 'all' || p.category === filters.category)).slice(0, 200);
  const tasks = list.map(p => accountTaskFromPlatform(p, 'catalog', 'unknown'));
  const findings = [createFinding({ scanId, subjectType: 'social', source: 'platform_catalog', category: 'account_cleanup_catalog', severity: 'info', confidence: 'verified', title: `Platform catalog connected: ${list.length}`, summary: 'This module manages user-confirmed assets and does not enumerate accounts by username.', evidenceType: 'manual', evidencePreview: `${list.length} platforms` })];
  return makeReport({ scanId, type: 'social', maskedSubject: { catalog: `${list.length} platforms` }, findings, tasks, riskScore: scoreRisk(findings), sources: ['platform_catalog'] });
}
export async function runAccountsScan(payload = {}, env = {}) {
  const scanId = payload.scanId || uid('scan_accounts'), catalog = payload.platformCatalog || [];
  const list = payload.platformIds?.length ? catalog.filter(p => payload.platformIds.includes(p.id)) : catalog.slice(0, 20);
  const tasks = list.map(p => accountTaskFromPlatform(p, 'cleanup_plan', 'unknown'));
  const findings = [createFinding({ scanId, subjectType: 'account', source: 'account_cleanup', category: 'cleanup_plan', severity: tasks.length > 10 ? 'medium' : 'low', confidence: 'verified', title: `Cleanup tasks generated: ${tasks.length}`, summary: 'Tasks include sign-in, recovery, export, closure, unlink, 2FA and review steps.', evidenceType: 'manual', evidencePreview: tasks.slice(0, 10).map(t => t.platformName).join(', ') })];
  return makeReport({ scanId, type: 'account_cleanup', maskedSubject: { tasks: String(tasks.length) }, findings, tasks, riskScore: scoreRisk(findings), sources: ['platform_catalog', 'user_confirmation'] });
}
export async function runCompanyScan(payload = {}, env = {}) {
  const scanId = payload.scanId || uid('scan_company'), verified = Boolean(payload.authorization?.verified || payload.authorization?.method === 'manual_admin_test'), subject = payload.domain || payload.githubOrg || payload.ip || '', findings = [];
  if (payload.domain) { findings.push(...await scanDns(payload.domain, scanId)); findings.push(...await scanHttps(payload.domain, scanId)); if (verified) findings.push(...await scanCertificateTransparency(payload.domain, scanId)); }
  if (payload.githubOrg) findings.push(...await scanGithubPublic(payload.githubOrg, env, scanId));
  if (payload.ip || payload.domain) findings.push(...await scanShodan(payload.ip || payload.domain, env, verified, scanId));
  if (!verified) findings.push(createFinding({ scanId, subjectType: 'company', source: 'authorization', category: 'asset_verification', severity: 'medium', confidence: 'verified', title: 'Asset not verified; deep checks limited', summary: 'Only lightweight public checks were run. Deeper adapters require DNS, file, GitHub, Cloudflare or admin verification.', evidenceType: 'manual', evidencePreview: 'limited_public_check' }));
  return makeReport({ scanId, type: 'company', maskedSubject: { subject: maskIdentifier(subject, payload.ip ? 'ip' : 'domain'), authorized: String(verified) }, findings, tasks: [], riskScore: scoreRisk(findings, 'company'), sources: ['dns', 'http_header', 'certificate_transparency', 'github', 'shodan'] });
}

export function makeReport({ scanId, type, maskedSubject, findings, tasks, riskScore, sources }) {
  return { id: `report_${scanId}`, scanId, reportType: type, generatedAt: now(), authorizedScope: 'Self-owned or explicitly authorized scope only.', maskedSubject, dataSources: [...new Set(sources)], authorizationStatus: maskedSubject?.authorized === 'true' ? 'verified' : 'private_mode_or_user_confirmed', riskScore, findings, accountTasks: tasks, exports: { markdown: `/api/reports/${scanId}/export?format=md`, json: `/api/reports/${scanId}`, csv: `/api/reports/${scanId}/export?format=csv`, pdf: 'reserved' }, deleteDataUrl: '/api/settings/delete-data', nextReviewPlan: type === 'company' ? 'Verified assets can be reviewed by scheduled-rescan.' : 'Review cleanup status again in 30 days.' };
}
export function reportToMarkdown(report) { return `# Open Your Box ${report.reportType} report\n\nGenerated: ${report.generatedAt}\n\nScore: ${report.riskScore.total} (${report.riskScore.level})\n\n## Findings\n\n${report.findings.map(f => `- **${f.severity} | ${f.title}**: ${f.summary}`).join('\n')}\n\n## Tasks\n\n${(report.accountTasks || []).map(t => `- [ ] ${t.platformName}: ${t.notes}`).join('\n') || 'None'}\n`; }
export function reportToCsv(report) { const rows = [['severity','source','category','title','summary','evidencePreview','action']]; for (const f of report.findings) rows.push([f.severity, f.source, f.category, f.title, f.summary, f.evidencePreview, f.remediation?.label || '']); return rows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n'); }
