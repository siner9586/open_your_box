function makeState() {
  const data = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
}
export const onRequestGet = async ({ request, env }) => {
  if (!env.GITHUB_CLIENT_ID) return new Response(JSON.stringify({ error: { code: 'GITHUB_OAUTH_NOT_CONFIGURED' } }), { status: 501, headers: { 'content-type': 'application/json; charset=utf-8' } });
  const url = new URL(request.url);
  const state = makeState();
  const redirectUri = `${url.origin}/api/auth/github/callback`;
  const target = new URL('https://github.com/login/oauth/authorize');
  target.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  target.searchParams.set('redirect_uri', redirectUri);
  target.searchParams.set('scope', 'read:user user:email repo');
  target.searchParams.set('state', state);
  return new Response(null, { status: 302, headers: { location: target.toString(), 'set-cookie': `oyb_github_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`, 'cache-control': 'no-store' } });
};
