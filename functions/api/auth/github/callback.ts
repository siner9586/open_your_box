function cookieValue(header = '', name = '') {
  return String(header || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.split('=').slice(1).join('=') || '';
}
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
export const onRequestGet = async ({ request, env }) => {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return json({ error: { code: 'GITHUB_OAUTH_NOT_CONFIGURED' } }, 501);
  const url = new URL(request.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const expected = cookieValue(request.headers.get('cookie') || '', 'oyb_github_state');
  if (!code || !state || !expected || state !== expected) return json({ error: { code: 'GITHUB_OAUTH_STATE_MISMATCH' } }, 400);
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'OpenYourBox-OAuth/1.0' },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code })
  });
  const token = await tokenRes.json();
  if (!token.access_token) return json({ error: { code: 'GITHUB_TOKEN_EXCHANGE_FAILED', detail: token.error || tokenRes.status } }, 502);
  const profileRes = await fetch('https://api.github.com/user', { headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token.access_token}`, 'user-agent': 'OpenYourBox-OAuth/1.0' } });
  const profile = await profileRes.json();
  const safeProfile = { provider: 'github', id: profile.id, login: profile.login, name: profile.name, avatar_url: profile.avatar_url, public_repos: profile.public_repos };
  return json({ status: 'connected', profile: safeProfile, tokenStored: false, next: 'Use this connection to verify user-owned GitHub assets. Token persistence is intentionally deferred until encrypted storage is configured.' }, 200, { 'set-cookie': 'oyb_github_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' });
};
