type Platform = { id?: string; name?: string; url?: string; region?: string; category?: string };

const DEFAULT_PLATFORMS: Platform[] = [
  ['github','GitHub','https://github.com/{u}','global'],['gitlab','GitLab','https://gitlab.com/{u}','global'],['gitee','Gitee','https://gitee.com/{u}','china'],['npm','npm','https://www.npmjs.com/~{u}','global'],['pypi','PyPI','https://pypi.org/user/{u}/','global'],['dockerhub','Docker Hub','https://hub.docker.com/u/{u}','global'],['huggingface','Hugging Face','https://huggingface.co/{u}','global'],['kaggle','Kaggle','https://www.kaggle.com/{u}','global'],['medium','Medium','https://medium.com/@{u}','global'],['devto','DEV','https://dev.to/{u}','global'],['keybase','Keybase','https://keybase.io/{u}','global'],['reddit','Reddit','https://www.reddit.com/user/{u}/','global'],['mastodon','Mastodon.social','https://mastodon.social/@{u}','global'],['producthunt','Product Hunt','https://www.producthunt.com/@{u}','global'],['stackoverflow','Stack Overflow','https://stackoverflow.com/users/{u}','global'],['codepen','CodePen','https://codepen.io/{u}','global'],['behance','Behance','https://www.behance.net/{u}','global'],['dribbble','Dribbble','https://dribbble.com/{u}','global'],['patreon','Patreon','https://www.patreon.com/{u}','global'],['twitch','Twitch','https://www.twitch.tv/{u}','global'],['telegram','Telegram public','https://t.me/{u}','global'],['youtube','YouTube handle','https://www.youtube.com/@{u}','global'],['bilibili','Bilibili','https://space.bilibili.com/{u}','china'],['zhihu','Zhihu','https://www.zhihu.com/people/{u}','china'],['csdn','CSDN','https://blog.csdn.net/{u}','china'],['juejin','稀土掘金','https://juejin.cn/user/{u}','china'],['cnblogs','博客园','https://www.cnblogs.com/{u}/','china'],['segmentfault','SegmentFault','https://segmentfault.com/u/{u}','china'],['jianshu','简书','https://www.jianshu.com/u/{u}','china'],['douban','豆瓣','https://www.douban.com/people/{u}/','china'],['weibo','微博','https://weibo.com/{u}','china'],['xiaohongshu','小红书','https://www.xiaohongshu.com/user/profile/{u}','china'],['kuaishou','快手','https://www.kuaishou.com/profile/{u}','china'],['acfun','AcFun','https://www.acfun.cn/u/{u}','china'],['lofter','LOFTER','https://{u}.lofter.com/','china'],['oschina','OSChina','https://my.oschina.net/{u}','china'],['51cto','51CTO','https://blog.51cto.com/u_{u}','china'],['imooc','慕课网','https://www.imooc.com/u/{u}','china'],['yuque','语雀','https://www.yuque.com/{u}','china'],['sspai','少数派','https://sspai.com/u/{u}','china'],['coolapk','酷安','https://www.coolapk.com/u/{u}','china']
].map(([id, name, url, region]) => ({ id, name, url, region }));

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const sanitize = (s = '') => String(s || '').trim().replace(/^@/, '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 64);
const safeMessage = (e: unknown) => String((e as Error)?.message || e || 'error').slice(0, 180);

async function probe(platform: Platform, username: string) {
  const url = String(platform.url || '').replace('{u}', encodeURIComponent(username));
  if (!url.startsWith('https://')) return { ...platform, url, status: 'skipped', certainty: 'unsupported_template', httpStatus: 0, reason: 'missing https URL template' };
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'OpenYourBox-BatchSelfCheck/1.0' } });
    const text = res.status === 200 ? (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 1000) : '';
    const negative = /not found|page not found|不存在|用户不存在|页面不存在|该用户不存在|doesn't exist|user not found|404/i.test(text);
    if (res.status === 200 && !negative) return { ...platform, url, status: 'confirmed_public_profile', certainty: 'public_http_200', httpStatus: res.status, reason: '公开主页返回 200，需人工确认是否本人。' };
    if (res.status === 404 || res.status === 410 || negative) return { ...platform, url, status: 'no_evidence', certainty: 'http_negative', httpStatus: res.status, reason: '当前公开 URL 未发现该用户名证据。' };
    if ([401, 403, 429, 503].includes(res.status)) return { ...platform, url, status: 'possible_or_blocked', certainty: 'blocked_or_rate_limited', httpStatus: res.status, reason: '平台限制访问或风控，需人工确认。' };
    return { ...platform, url, status: 'unknown', certainty: 'http_unclear', httpStatus: res.status, reason: 'HTTP 状态不能直接判断。' };
  } catch (error) {
    return { ...platform, url, status: 'failed', certainty: 'network_error', httpStatus: 0, reason: safeMessage(error) };
  }
}

export const onRequestPost = async ({ request }: { request: Request }) => {
  let input: any = {};
  try { input = await request.json(); } catch { input = {}; }
  const username = sanitize(input.username || input.nickname || '');
  if (!username || username.length < 2) return json({ error: { code: 'INVALID_USERNAME', message: 'username/nickname is required.' } }, 400);
  const supplied = Array.isArray(input.platforms) ? input.platforms : [];
  const platforms: Platform[] = supplied.length ? supplied.filter((p: Platform) => p?.url && String(p.url).includes('{u}')) : DEFAULT_PLATFORMS;
  const offset = Math.max(0, Number(input.offset || 0));
  const limit = Math.max(1, Math.min(50, Number(input.limit || 20)));
  const batch = platforms.slice(offset, offset + limit);
  const results = await Promise.all(batch.map(p => probe(p, username)));
  const nextOffset = offset + results.length;
  const summary = results.reduce((acc: Record<string, number>, r: any) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  return json({ status: 'batch_completed', usernameMasked: username.length > 2 ? `${username.slice(0, 1)}***${username.slice(-1)}` : '***', offset, limit, nextOffset, done: nextOffset >= platforms.length, total: platforms.length, summary, results });
};
