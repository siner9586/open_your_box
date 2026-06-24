const DEFAULT_TARGETS = [
  ['github','GitHub','https://github.com/{u}','global'],['gitlab','GitLab','https://gitlab.com/{u}','global'],['gitee','Gitee','https://gitee.com/{u}','china'],['npm','npm','https://www.npmjs.com/~{u}','global'],['pypi','PyPI','https://pypi.org/user/{u}/','global'],['dockerhub','Docker Hub','https://hub.docker.com/u/{u}','global'],['huggingface','Hugging Face','https://huggingface.co/{u}','global'],['kaggle','Kaggle','https://www.kaggle.com/{u}','global'],['medium','Medium','https://medium.com/@{u}','global'],['devto','DEV','https://dev.to/{u}','global'],['keybase','Keybase','https://keybase.io/{u}','global'],['reddit','Reddit','https://www.reddit.com/user/{u}/','global'],['mastodon','Mastodon.social','https://mastodon.social/@{u}','global'],['producthunt','Product Hunt','https://www.producthunt.com/@{u}','global'],['codepen','CodePen','https://codepen.io/{u}','global'],['behance','Behance','https://www.behance.net/{u}','global'],['dribbble','Dribbble','https://dribbble.com/{u}','global'],['twitch','Twitch','https://www.twitch.tv/{u}','global'],['telegram','Telegram public','https://t.me/{u}','global'],['youtube','YouTube handle','https://www.youtube.com/@{u}','global'],['zhihu','知乎','https://www.zhihu.com/people/{u}','china'],['csdn','CSDN','https://blog.csdn.net/{u}','china'],['juejin','稀土掘金','https://juejin.cn/user/{u}','china'],['cnblogs','博客园','https://www.cnblogs.com/{u}/','china'],['segmentfault','SegmentFault','https://segmentfault.com/u/{u}','china'],['jianshu','简书','https://www.jianshu.com/u/{u}','china'],['douban','豆瓣','https://www.douban.com/people/{u}/','china'],['weibo','微博','https://weibo.com/{u}','china'],['xiaohongshu','小红书','https://www.xiaohongshu.com/user/profile/{u}','china'],['kuaishou','快手','https://www.kuaishou.com/profile/{u}','china']
].map(([id,name,url,region]) => ({ id, name, url, region }));
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const now = () => new Date().toISOString();
const id = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const mask = (v = '', type = 'id') => type === 'email' ? String(v).replace(/^(.).+(@.).+(\..+)$/, '$1***$2***$3') : type === 'phone' ? String(v).replace(/(\d{3})\d+(\d{2})$/, '$1****$2') : String(v).slice(0, 2) + '***';
export async function onRequestPost(context: any) {
  const DB = context.env.DB;
  if (!DB?.prepare) return json({ error: { code: 'D1_NOT_BOUND', message: 'DB binding is required.' } }, 500);
  const idem = context.request.headers.get('idempotency-key') || context.request.headers.get('x-idempotency-key');
  if (!idem) return json({ error: { code: 'MISSING_IDEMPOTENCY_KEY' } }, 400);
  const payload = await context.request.json().catch(() => ({}));
  const identifiers = payload.identifiers || {};
  const username = String(identifiers.username || identifiers.nickname || '').trim().replace(/^@/, '');
  if (!username) return json({ error: { code: 'USERNAME_REQUIRED', message: 'username/nickname is required for async platform scan.' } }, 400);
  const maxTargets = Math.max(1, Math.min(Number(payload.maxTargets || 300), 2000));
  const provided = Array.isArray(payload.platformTargets) ? payload.platformTargets : [];
  const targets = [...DEFAULT_TARGETS, ...provided].filter(t => t && (t.url || t.profileUrl)).slice(0, maxTargets);
  const jobId = id('async_personal');
  const created = now();
  await DB.prepare('insert or replace into jobs (id,user_id,subject_type,subject_hash,mode,status,progress,started_at,finished_at,error_message,created_at) values (?,?,?,?,?,?,?,?,?,?,?)').bind(jobId, 'local', 'personal', username.slice(0, 96), 'async_personal_platforms', 'queued', 0, created, '', '', created).run();
  const stmt = DB.prepare('insert or replace into scan_queue (id,job_id,user_id,scan_type,platform_id,platform_name,region,identifier_type,identifier_masked,target_url,status,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const t of targets) {
    const targetUrl = String(t.url || t.profileUrl).replace('{u}', encodeURIComponent(username));
    await stmt.bind(id('q'), jobId, 'local', 'username_public_profile', t.id || t.platformId || '', t.name || t.platformName || t.id || 'platform', t.region || 'unknown', 'username', mask(username, 'username'), targetUrl, 'pending', created, created).run();
  }
  return json({ status: 'queued', jobId, queued: targets.length, runBatchUrl: `/api/scan/personal/run-batch?jobId=${jobId}`, statusUrl: `/api/scan/personal/status?jobId=${jobId}`, note: 'Run run-batch repeatedly or from a Cron/Workflow until pending reaches 0.' });
}
