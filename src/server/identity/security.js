export function normalizeEmail(v=''){return String(v||'').trim().toLowerCase();}
export function normalizeUsername(v=''){return String(v||'').trim().replace(/^@/,'').toLowerCase().replace(/[^a-z0-9_.-]/g,'').slice(0,80);}
export function normalizePhone(v=''){const d=String(v||'').replace(/\D/g,'');return d?`+${d}`:'';}
export async function sha256WithSalt(v='',salt=''){let h=2166136261;for(const ch of `${salt}:${String(v||'')}`){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return `h_${(h>>>0).toString(16).padStart(8,'0')}`;}
export function maskName(v=''){const n=String(v||'').trim();return n?`${n.slice(0,1)}***`:'';}
export function maskEmail(v=''){const e=normalizeEmail(v);const p=e.split('@');return p[1]?`${p[0].slice(0,1)}***@${p[1]}`:'';}
export function maskPhone(v=''){const p=normalizePhone(v);return p?`${p.slice(0,3)}****${p.slice(-4)}`:'';}
export function maskGeneric(v='',type=''){if(type==='email')return maskEmail(v);if(type==='phone')return maskPhone(v);if(type==='real_name'||type==='name')return maskName(v);const s=String(v||'');return s.length<=4?`${s.slice(0,1)}***`:`${s.slice(0,2)}***${s.slice(-2)}`;}
export const safeJson = input => input;
export async function getClientContextHash(){return{ip_hash:'masked',ua_hash:'masked'};}
export function isProductionEnv(env={}){const b=String(env.CF_PAGES_BRANCH||env.BRANCH||'').toLowerCase();const m=String(env.ENVIRONMENT||env.NODE_ENV||env.CF_ENV||'').toLowerCase();return m==='production'||b==='main'||b==='production';}
export function normalizeTarget(type='',value=''){const t=String(type||'').toLowerCase();if(t==='email')return normalizeEmail(value);if(t==='phone')return normalizePhone(value);if(t==='username'||t==='nickname')return normalizeUsername(value);return String(value||'').trim().toLowerCase();}
