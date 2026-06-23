import { createFinding, maskIdentifier, hashIdentifier } from './runtime.mjs';

async function sha1(value = '') {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(String(value).trim().toLowerCase()));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
const severity = n => n >= 10 ? 'high' : n >= 3 ? 'medium' : n > 0 ? 'low' : 'info';
export async function runHibpEmailRange(email = '', env = {}, verified = false, scanId = 'scan') {
  if (!email) return [];
  if (!env.HIBP_API_KEY) return [createFinding({ scanId, source: 'hibp', category: 'adapter_status', severity: 'info', confidence: 'verified', title: 'HIBP adapter not configured', summary: 'HIBP_API_KEY is missing; lookup skipped.', evidenceType: 'official_api', evidencePreview: 'missing HIBP_API_KEY', affectedIdentifierMasked: maskIdentifier(email, 'email') })];
  if (!verified) return [createFinding({ scanId, source: 'hibp', category: 'authorization', severity: 'medium', confidence: 'verified', title: 'HIBP lookup limited', summary: 'Email ownership is not verified; lookup skipped.', evidenceType: 'official_api', evidencePreview: maskIdentifier(email, 'email') })];
  try {
    const digest = await sha1(email);
    const prefix = digest.slice(0, 6), suffix = digest.slice(6);
    const res = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/range/${prefix}`, { headers: { accept: 'application/json', 'user-agent': 'OpenYourBox-AuthorizedSelfAudit/1.0', 'hibp-api-key': env.HIBP_API_KEY } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    const hit = (Array.isArray(rows) ? rows : []).find(r => String(r.hashSuffix || r.HashSuffix || '').toUpperCase() === suffix);
    const names = hit?.websites || hit?.Websites || hit?.breachNames || hit?.BreachNames || [];
    return [createFinding({ scanId, subjectType: 'personal', source: 'hibp', category: 'breach_summary', severity: severity(names.length), confidence: 'verified', title: names.length ? `HIBP matched breach names: ${names.length}` : 'HIBP matched breach names: 0', summary: names.length ? 'A verified email hash range matched public breach names. Unmatched range rows were discarded and no plaintext secrets are stored.' : 'No breach name matched the verified email hash range.', evidenceType: 'official_api_k_anonymity', evidencePreview: names.slice(0, 12).join(', ') || 'no matched breach names', affectedIdentifierMasked: maskIdentifier(email, 'email'), affectedIdentifierHash: await hashIdentifier(email, env.HASH_SALT || ''), remediation: { actionType: 'rotate_secret', label: 'Harden affected accounts', steps: ['Change reused passwords', 'Enable MFA', 'Close unused accounts', 'Watch for phishing'] } })];
  } catch (error) {
    return [createFinding({ scanId, source: 'hibp', category: 'adapter_error', severity: 'info', confidence: 'low', title: 'HIBP lookup failed', summary: error.message, evidenceType: 'official_api', evidencePreview: maskIdentifier(email, 'email') })];
  }
}
