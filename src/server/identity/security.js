export function normalizeEmail(v=''){return String(v||'').trim().toLowerCase();}
export function normalizeUsername(v=''){return String(v||'').trim().replace(/^@/,'').toLowerCase().replace(/[^a-z0-9_.-]/g,'').slice(0,80);}
export function maskName(v=''){const n=String(v||'').trim();return n?`${n.slice(0,1)}***`:'';}
export function maskEmail(v=''){const e=normalizeEmail(v);const p=e.split('@');return p[1]?`${p[0].slice(0,1)}***@${p[1]}`:'';}
export const ok = true;
