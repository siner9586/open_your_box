const SENSITIVE_KEY_RE = /(token|secret|password|passcode|otp|phone|id_number|real_name|authorization|cookie|session)/i;

function encoder() {
  return new TextEncoder();
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function normalizePhone(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '').slice(0, 18);
  if (!digits) return '';
  return `${hasPlus ? '+' : '+'}${digits}`;
}

export function normalizeUsername(value = '') {
  return String(value || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 80);
}

export function normalizeTarget(type = '', value = '') {
  const targetType = String(type || '').toLowerCase();
  if (targetType === 'email') return normalizeEmail(value);
  if (targetType === 'phone') return normalizePhone(value);
  if (targetType === 'username' || targetType === 'nickname') return normalizeUsername(value);
  if (targetType === 'domain') return String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return String(value || '').trim().toLowerCase();
}

export async function sha256WithSalt(value = '', salt = '') {
  const effectiveSalt = String(salt || '');
  if (!effectiveSalt) throw new Error('SCAN_SALT_REQUIRED');
  const digest = await crypto.subtle.digest('SHA-256', encoder().encode(`${effectiveSalt}:${String(value || '')}`));
  return `sha256:${toHex(digest)}`;
}

export function maskEmail(value = '') {
  const email = normalizeEmail(value);
  const [local, domain] = email.split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, 1)}***@${domain}`;
}

export function maskPhone(value = '') {
  const phone = normalizePhone(value);
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '+***';
  return `+***${digits.slice(-2)}`;
}

export function maskName(value = '') {
  const name = String(value || '').trim();
  if (!name) return '';
  return `${name.slice(0, 1)}***`;
}

export function maskGeneric(value = '', type = '') {
  const targetType = String(type || '').toLowerCase();
  if (targetType === 'email') return maskEmail(value);
  if (targetType === 'phone') return maskPhone(value);
  if (targetType === 'real_name' || targetType === 'name') return maskName(value);
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= 3) return `${text.slice(0, 1)}***`;
  return `${text.slice(0, 2)}***${text.slice(-1)}`;
}

export function safeJson(input, depth = 0) {
  if (depth > 8) return '[MaxDepth]';
  if (input == null) return input;
  if (Array.isArray(input)) return input.map(item => safeJson(item, depth + 1));
  if (typeof input !== 'object') return input;
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      if (typeof value === 'boolean' || value == null) {
        output[key] = value;
        continue;
      }
      if (typeof value === 'string' && /^(present|missing|true|false|\d+)?$/i.test(value)) {
        output[key] = value;
        continue;
      }
      if (value && typeof value === 'object' && ['secrets', 'tables', 'variables'].includes(String(key).toLowerCase())) {
        output[key] = safeJson(value, depth + 1);
        continue;
      }
      if (/phone/i.test(key)) output[key] = typeof value === 'string' ? maskPhone(value) : '[redacted]';
      else if (/email/i.test(key)) output[key] = typeof value === 'string' ? maskEmail(value) : '[redacted]';
      else if (/name/i.test(key)) output[key] = typeof value === 'string' ? maskName(value) : '[redacted]';
      else output[key] = '[redacted]';
      continue;
    }
    output[key] = safeJson(value, depth + 1);
  }
  return output;
}

export async function getClientContextHash(requestOrContext = {}, env = {}) {
  const request = requestOrContext.request || requestOrContext;
  const salt = env.SCAN_SALT || env.HASH_SALT || 'development-context-salt';
  const ip = request?.headers?.get?.('cf-connecting-ip') || request?.headers?.get?.('x-forwarded-for') || 'unknown-ip';
  const ua = request?.headers?.get?.('user-agent') || 'unknown-ua';
  return {
    ip_hash: await sha256WithSalt(ip, salt),
    ua_hash: await sha256WithSalt(ua, salt)
  };
}

export function isProductionEnv(env = {}) {
  const branch = String(env.CF_PAGES_BRANCH || env.BRANCH || '').toLowerCase();
  const mode = String(env.ENVIRONMENT || env.NODE_ENV || env.CF_ENV || '').toLowerCase();
  return mode === 'production' || branch === 'main' || branch === 'production';
}

export function createRandomToken(prefix = 'tok') {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `${prefix}_${toHex(bytes)}`;
}

export async function hashSessionToken(token = '', env = {}) {
  return sha256WithSalt(token, env.SCAN_SALT || env.HASH_SALT || '');
}
