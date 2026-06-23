import { createFinding, maskIdentifier, redactText, hashIdentifier } from './runtime.mjs';

const ua = 'OpenYourBox-AuthorizedSelfAudit/1.0';
const jsonHeaders = { accept: 'application/json', 'user-agent': ua };
const cleanDomain = (value = '') => String(value || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].replace(/[^a-z0-9.-]/g, '').replace(/^\.+|\.+$/g, '');
const isIp = (value = '') => /^\d{1,3}(\.\d{1,3}){3}$/.test(String(value || '').trim());
const sevFromCount = (n = 0) => n >= 10 ? 'high' : n >= 3 ? 'medium' : n > 0 ? 'low' : 'info';

async function safeJson(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...jsonHeaders, ...(options.headers || {}) } });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 500) }; }
  return { ok: res.ok, status: res.status, data };
}

function notConfigured(scanId, source, keyName) {
  return createFinding({ scanId, source, category: 'adapter_status', severity: 'info', confidence: 'verified', title: `${source} adapter not configured`, summary: `${keyName} is missing; authorized lookup was skipped.`, evidenceType: 'official_api', evidencePreview: `missing ${keyName}` });
}
function limited(scanId, source, target, type = 'asset') {
  return createFinding({ scanId, source, category: 'authorization', severity: 'medium', confidence: 'verified', title: `${source} lookup limited`, summary: `${type} ownership is not verified; external lookup was not executed.`, evidenceType: 'official_api', evidencePreview: maskIdentifier(target, type === 'email' ? 'email' : isIp(target) ? 'ip' : 'domain') });
}

export async function scanShodanReal(target = '', env = {}, authorized = false, scanId = 'scan') {
  if (!env.SHODAN_API_KEY) return [notConfigured(scanId, 'shodan', 'SHODAN_API_KEY')];
  if (!authorized) return [limited(scanId, 'shodan', target)];
  if (!isIp(target)) return [createFinding({ scanId, source: 'shodan', category: 'asset_scope', severity: 'info', confidence: 'verified', title: 'Shodan host lookup skipped', summary: 'Shodan host lookup is limited to verified IP addresses in this project. Domain-wide search is intentionally not enabled.', evidenceType: 'official_api', evidencePreview: maskIdentifier(target, 'domain') })];
  try {
    const url = `https://api.shodan.io/shodan/host/${encodeURIComponent(target)}?minify=true&key=${encodeURIComponent(env.SHODAN_API_KEY)}`;
    const { ok, status, data } = await safeJson(url);
    if (!ok) throw new Error(`HTTP ${status}`);
    const ports = Array.isArray(data.ports) ? data.ports : [];
    const severity = ports.some(p => [21, 23, 445, 3389, 5900, 6379, 9200, 11211].includes(Number(p))) ? 'high' : sevFromCount(ports.length);
    return [createFinding({ scanId, subjectType: 'ip', source: 'shodan', category: 'exposed_service_summary', severity, confidence: 'verified', title: `Shodan service summary: ${maskIdentifier(target, 'ip')}`, summary: `Open service count: ${ports.length}; organization: ${redactText(data.org || data.isp || 'unknown')}; last update: ${data.last_update || 'unknown'}.`, evidenceType: 'official_api', evidencePreview: `ports=${ports.slice(0, 20).join(',') || 'none'}; asn=${redactText(data.asn || '')}`, remediation: { actionType: 'reduce_exposure', label: 'Review exposed services', steps: ['Confirm each open port is expected', 'Restrict admin services by VPN or allowlist', 'Patch public services and monitor logs'] } })];
  } catch (error) {
    return [createFinding({ scanId, source: 'shodan', category: 'adapter_error', severity: 'info', confidence: 'low', title: 'Shodan lookup failed', summary: error.message, evidenceType: 'official_api', evidencePreview: maskIdentifier(target, 'ip') })];
  }
}

async function sha1(value = '') {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(String(value).trim().toLowerCase()));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
export async function scanHibpReal(email = '', env = {}, verified = false, scanId = 'scan') {
  if (!email) return [];
  if (!env.HIBP_API_KEY) return [notConfigured(scanId, 'hibp', 'HIBP_API_KEY')];
  if (!verified) return [limited(scanId, 'hibp', email, 'email')];
  try {
    const digest = await sha1(email);
    const prefix = digest.slice(0, 6), suffix = digest.slice(6);
    const { ok, status, data } = await safeJson(`https://haveibeenpwned.com/api/v3/breachedaccount/range/${prefix}`, { headers: { 'hibp-api-key': env.HIBP_API_KEY } });
    if (!ok && status !== 404) throw new Error(`HTTP ${status}`);
    const rows = Array.isArray(data) ? data : [];
    const hit = rows.find(r => String(r.hashSuffix || '').toUpperCase() === suffix);
    const names = hit?.breachNames || [];
    return [createFinding({ scanId, subjectType: 'personal', source: 'hibp', category: 'breach_summary', severity: names.length ? sevFromCount(names.length) : 'info', confidence: 'verified', title: names.length ? `HIBP breach summary: ${names.length} breach name(s)` : 'HIBP breach summary: no matched range result', summary: names.length ? 'The verified email matched public breach names. No plaintext secrets are stored or returned.' : 'No matched breach name was returned for the verified email hash range.', evidenceType: 'official_api_k_anonymity', evidencePreview: names.slice(0, 10).map(redactText).join(', ') || 'no matched breach names', affectedIdentifierMasked: maskIdentifier(email, 'email'), affectedIdentifierHash: await hashIdentifier(email, env.HASH_SALT || ''), remediation: { actionType: 'rotate_secret', label: 'Harden affected accounts', steps: ['Change reused passwords', 'Enable multi-factor authentication', 'Close unused accounts', 'Watch for phishing using the exposed identity context'] } })];
  } catch (error) {
    return [createFinding({ scanId, source: 'hibp', category: 'adapter_error', severity: 'info', confidence: 'low', title: 'HIBP lookup failed', summary: error.message, evidenceType: 'official_api', evidencePreview: maskIdentifier(email, 'email') })];
  }
}

export async function scanVirusTotal(target = '', env = {}, authorized = false, scanId = 'scan') {
  if (!env.VIRUSTOTAL_API_KEY) return [notConfigured(scanId, 'virustotal', 'VIRUSTOTAL_API_KEY')];
  if (!authorized) return [limited(scanId, 'virustotal', target)];
  const kind = isIp(target) ? 'ip_addresses' : 'domains';
  const value = isIp(target) ? target : cleanDomain(target);
  if (!value) return [];
  try {
    const { ok, status, data } = await safeJson(`https://www.virustotal.com/api/v3/${kind}/${encodeURIComponent(value)}`, { headers: { 'x-apikey': env.VIRUSTOTAL_API_KEY } });
    if (!ok) throw new Error(`HTTP ${status}`);
    const stats = data?.data?.attributes?.last_analysis_stats || {};
    const malicious = Number(stats.malicious || 0), suspicious = Number(stats.suspicious || 0);
    return [createFinding({ scanId, source: 'virustotal', category: 'reputation_summary', severity: malicious ? 'high' : suspicious ? 'medium' : 'info', confidence: 'verified', title: `VirusTotal reputation: ${maskIdentifier(value, isIp(value) ? 'ip' : 'domain')}`, summary: `malicious=${malicious}; suspicious=${suspicious}; harmless=${stats.harmless || 0}; undetected=${stats.undetected || 0}.`, evidenceType: 'official_api', evidencePreview: JSON.stringify(stats), remediation: { actionType: 'review', label: 'Review reputation signals', steps: ['Confirm whether detections are false positives', 'Check hosting and DNS changes', 'Clean compromised hosts if needed'] } })];
  } catch (error) { return [createFinding({ scanId, source: 'virustotal', category: 'adapter_error', severity: 'info', confidence: 'low', title: 'VirusTotal lookup failed', summary: error.message, evidenceType: 'official_api', evidencePreview: maskIdentifier(target) })]; }
}

export async function scanAbuseIpdb(target = '', env = {}, authorized = false, scanId = 'scan') {
  if (!env.ABUSEIPDB_API_KEY) return [notConfigured(scanId, 'abuseipdb', 'ABUSEIPDB_API_KEY')];
  if (!authorized) return [limited(scanId, 'abuseipdb', target)];
  if (!isIp(target)) return [];
  try {
    const url = `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(target)}&maxAgeInDays=90`;
    const { ok, status, data } = await safeJson(url, { headers: { Key: env.ABUSEIPDB_API_KEY } });
    if (!ok) throw new Error(`HTTP ${status}`);
    const d = data.data || {}; const score = Number(d.abuseConfidenceScore || 0);
    return [createFinding({ scanId, source: 'abuseipdb', category: 'abuse_reputation', severity: score >= 50 ? 'high' : score >= 10 ? 'medium' : 'info', confidence: 'verified', title: `AbuseIPDB score: ${maskIdentifier(target, 'ip')}`, summary: `Abuse confidence score: ${score}; reports: ${d.totalReports || 0}; last reported: ${d.lastReportedAt || 'none'}.`, evidenceType: 'official_api', evidencePreview: `score=${score}; reports=${d.totalReports || 0}`, remediation: { actionType: 'review', label: 'Investigate abuse reports', steps: ['Review server logs', 'Check outbound traffic', 'Patch and rotate exposed credentials if compromise is suspected'] } })];
  } catch (error) { return [createFinding({ scanId, source: 'abuseipdb', category: 'adapter_error', severity: 'info', confidence: 'low', title: 'AbuseIPDB lookup failed', summary: error.message, evidenceType: 'official_api', evidencePreview: maskIdentifier(target, 'ip') })]; }
}

export async function scanOtx(target = '', env = {}, authorized = false, scanId = 'scan') {
  if (!env.OTX_API_KEY) return [notConfigured(scanId, 'otx', 'OTX_API_KEY')];
  if (!authorized) return [limited(scanId, 'otx', target)];
  const value = isIp(target) ? target : cleanDomain(target);
  if (!value) return [];
  const type = isIp(value) ? 'IPv4' : 'domain';
  try {
    const { ok, status, data } = await safeJson(`https://otx.alienvault.com/api/v1/indicators/${type}/${encodeURIComponent(value)}/general`, { headers: { 'X-OTX-API-KEY': env.OTX_API_KEY } });
    if (!ok) throw new Error(`HTTP ${status}`);
    const count = Number(data.pulse_info?.count || 0);
    return [createFinding({ scanId, source: 'otx', category: 'threat_pulse_summary', severity: count >= 5 ? 'medium' : count ? 'low' : 'info', confidence: 'verified', title: `OTX pulse summary: ${maskIdentifier(value, isIp(value) ? 'ip' : 'domain')}`, summary: `Pulse count: ${count}.`, evidenceType: 'official_api', evidencePreview: `pulse_count=${count}`, remediation: { actionType: 'review', label: 'Review OTX context', steps: ['Confirm whether listed pulses refer to your asset', 'Look for compromise indicators', 'Harden or rotate if detections are credible'] } })];
  } catch (error) { return [createFinding({ scanId, source: 'otx', category: 'adapter_error', severity: 'info', confidence: 'low', title: 'OTX lookup failed', summary: error.message, evidenceType: 'official_api', evidencePreview: maskIdentifier(target) })]; }
}

export async function scanCensys(target = '', env = {}, authorized = false, scanId = 'scan') {
  if (!env.CENSYS_API_ID || !env.CENSYS_API_SECRET) return [notConfigured(scanId, 'censys', 'CENSYS_API_ID / CENSYS_API_SECRET')];
  if (!authorized) return [limited(scanId, 'censys', target)];
  const value = isIp(target) ? target : cleanDomain(target);
  if (!value || !isIp(value)) return [createFinding({ scanId, source: 'censys', category: 'asset_scope', severity: 'info', confidence: 'verified', title: 'Censys host lookup skipped', summary: 'This adapter currently uses host lookup for verified IP addresses. Domain certificate inventory can be enabled after domain verification is configured.', evidenceType: 'official_api', evidencePreview: maskIdentifier(target, 'domain') })];
  try {
    const auth = btoa(`${env.CENSYS_API_ID}:${env.CENSYS_API_SECRET}`);
    const { ok, status, data } = await safeJson(`https://search.censys.io/api/v2/hosts/${encodeURIComponent(value)}`, { headers: { authorization: `Basic ${auth}` } });
    if (!ok) throw new Error(`HTTP ${status}`);
    const services = data.result?.services || [];
    return [createFinding({ scanId, source: 'censys', category: 'host_service_summary', severity: sevFromCount(services.length), confidence: 'verified', title: `Censys host summary: ${maskIdentifier(value, 'ip')}`, summary: `Observed service count: ${services.length}.`, evidenceType: 'official_api', evidencePreview: services.slice(0, 12).map(s => `${s.port}/${s.service_name || 'unknown'}`).join(', ') || 'none', remediation: { actionType: 'reduce_exposure', label: 'Review observed services', steps: ['Confirm asset ownership', 'Close unnecessary public services', 'Patch internet-facing services'] } })];
  } catch (error) { return [createFinding({ scanId, source: 'censys', category: 'adapter_error', severity: 'info', confidence: 'low', title: 'Censys lookup failed', summary: error.message, evidenceType: 'official_api', evidencePreview: maskIdentifier(value, 'ip') })]; }
}

export async function scanCloudflareZone(domain = '', env = {}, authorized = false, scanId = 'scan') {
  if (!env.CLOUDFLARE_API_TOKEN) return [notConfigured(scanId, 'cloudflare', 'CLOUDFLARE_API_TOKEN')];
  if (!authorized) return [limited(scanId, 'cloudflare', domain, 'domain')];
  const d = cleanDomain(domain); if (!d) return [];
  try {
    const zones = await safeJson(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(d)}`, { headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
    if (!zones.ok) throw new Error(`HTTP ${zones.status}`);
    const zone = (zones.data.result || [])[0];
    if (!zone) return [createFinding({ scanId, source: 'cloudflare', category: 'zone_inventory', severity: 'info', confidence: 'verified', title: `Cloudflare zone not found: ${d}`, summary: 'No matching Cloudflare zone was returned for the verified domain.', evidenceType: 'official_api', evidencePreview: maskIdentifier(d, 'domain') })];
    let dnsCount = 0;
    try { const dns = await safeJson(`https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records?per_page=100`, { headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } }); dnsCount = (dns.data.result || []).length; } catch {}
    return [createFinding({ scanId, source: 'cloudflare', category: 'zone_inventory', severity: zone.status === 'active' ? 'low' : 'medium', confidence: 'verified', title: `Cloudflare zone verified: ${maskIdentifier(d, 'domain')}`, summary: `Zone status: ${zone.status || 'unknown'}; DNS records sampled: ${dnsCount}.`, evidenceType: 'official_api', evidencePreview: `zone=${maskIdentifier(zone.name || d, 'domain')}; status=${zone.status || 'unknown'}; records=${dnsCount}`, remediation: { actionType: 'review', label: 'Review Cloudflare zone posture', steps: ['Review DNS-only records', 'Enable HTTPS and WAF rules where appropriate', 'Remove stale records'] } })];
  } catch (error) { return [createFinding({ scanId, source: 'cloudflare', category: 'adapter_error', severity: 'info', confidence: 'low', title: 'Cloudflare zone lookup failed', summary: error.message, evidenceType: 'official_api', evidencePreview: maskIdentifier(domain, 'domain') })]; }
}

export async function runExternalChecks(mode = 'company', payload = {}, env = {}, scanId = 'scan') {
  const verified = Boolean(payload.authorization?.verified || payload.authorization?.method === 'manual_admin_test' || payload.authorization?.method === 'cloudflare_zone');
  const findings = [];
  if (mode === 'personal' && payload.identifiers?.email) findings.push(...await scanHibpReal(payload.identifiers.email, env, Boolean(payload.authorization?.verified), scanId));
  if (mode !== 'company') return findings;
  const target = payload.ip || payload.domain || '';
  if (payload.ip) {
    findings.push(...await scanShodanReal(payload.ip, env, verified, scanId));
    findings.push(...await scanCensys(payload.ip, env, verified, scanId));
    findings.push(...await scanVirusTotal(payload.ip, env, verified, scanId));
    findings.push(...await scanAbuseIpdb(payload.ip, env, verified, scanId));
    findings.push(...await scanOtx(payload.ip, env, verified, scanId));
  }
  if (payload.domain) {
    findings.push(...await scanVirusTotal(payload.domain, env, verified, scanId));
    findings.push(...await scanOtx(payload.domain, env, verified, scanId));
    findings.push(...await scanCloudflareZone(payload.domain, env, verified, scanId));
  }
  if (!payload.ip && target) findings.push(...await scanShodanReal(target, env, verified, scanId));
  return findings;
}
