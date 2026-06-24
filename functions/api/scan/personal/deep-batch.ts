const STATUS_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

const GLOBAL_PLATFORMS = [
  ['github','GitHub','https://github.com/{u}'],['gitlab','GitLab','https://gitlab.com/{u}'],['gitee','Gitee','https://gitee.com/{u}'],['bitbucket','Bitbucket','https://bitbucket.org/{u}/'],['sourceforge','SourceForge','https://sourceforge.net/u/{u}/'],['npm','npm','https://www.npmjs.com/~{u}'],['pypi','PyPI','https://pypi.org/user/{u}/'],['packagist','Packagist','https://packagist.org/packages/{u}/'],['rubygems','RubyGems','https://rubygems.org/profiles/{u}'],['dockerhub','Docker Hub','https://hub.docker.com/u/{u}'],['huggingface','Hugging Face','https://huggingface.co/{u}'],['kaggle','Kaggle','https://www.kaggle.com/{u}'],['replit','Replit','https://replit.com/@{u}'],['codepen','CodePen','https://codepen.io/{u}'],['codesandbox','CodeSandbox','https://codesandbox.io/u/{u}'],['keybase','Keybase','https://keybase.io/{u}'],['reddit','Reddit','https://www.reddit.com/user/{u}/'],['medium','Medium','https://medium.com/@{u}'],['devto','DEV','https://dev.to/{u}'],['hashnode','Hashnode','https://hashnode.com/@{u}'],['producthunt','Product Hunt','https://www.producthunt.com/@{u}'],['indiehackers','Indie Hackers','https://www.indiehackers.com/{u}'],['hackernews','Hacker News','https://news.ycombinator.com/user?id={u}'],['lobsters','Lobsters','https://lobste.rs/u/{u}'],['stackoverflow','Stack Overflow','https://stackoverflow.com/users/{u}'],['superuser','Super User','https://superuser.com/users/{u}'],['serverfault','Server Fault','https://serverfault.com/users/{u}'],['askubuntu','Ask Ubuntu','https://askubuntu.com/users/{u}'],['mastodon_social','Mastodon.social','https://mastodon.social/@{u}'],['t.me','Telegram public','https://t.me/{u}'],['youtube','YouTube handle','https://www.youtube.com/@{u}'],['twitch','Twitch','https://www.twitch.tv/{u}'],['vimeo','Vimeo','https://vimeo.com/{u}'],['soundcloud','SoundCloud','https://soundcloud.com/{u}'],['spotify','Spotify user','https://open.spotify.com/user/{u}'],['behance','Behance','https://www.behance.net/{u}'],['dribbble','Dribbble','https://dribbble.com/{u}'],['artstation','ArtStation','https://www.artstation.com/{u}'],['figma','Figma community','https://www.figma.com/@{u}'],['patreon','Patreon','https://www.patreon.com/{u}'],['ko-fi','Ko-fi','https://ko-fi.com/{u}'],['buymeacoffee','Buy Me a Coffee','https://www.buymeacoffee.com/{u}'],['aboutme','About.me','https://about.me/{u}'],['linktree','Linktree','https://linktr.ee/{u}'],['carrd','Carrd','https://{u}.carrd.co/'],['substack','Substack','https://{u}.substack.com/'],['wordpress','WordPress.com','https://{u}.wordpress.com/'],['tumblr','Tumblr','https://{u}.tumblr.com/'],['pinterest','Pinterest','https://www.pinterest.com/{u}/'],['instagram','Instagram','https://www.instagram.com/{u}/'],['threads','Threads','https://www.threads.net/@{u}'],['x','X','https://x.com/{u}'],['facebook','Facebook','https://www.facebook.com/{u}'],['linkedin','LinkedIn vanity','https://www.linkedin.com/in/{u}/']
];

const CHINA_PLATFORMS = [
  ['bilibili','哔哩哔哩','https://space.bilibili.com/{u}'],['zhihu','知乎','https://www.zhihu.com/people/{u}'],['csdn','CSDN','https://blog.csdn.net/{u}'],['juejin','稀土掘金','https://juejin.cn/user/{u}'],['cnblogs','博客园','https://www.cnblogs.com/{u}/'],['segmentfault','SegmentFault','https://segmentfault.com/u/{u}'],['oschina','开源中国','https://my.oschina.net/{u}'],['51cto','51CTO','https://blog.51cto.com/u_{u}'],['jianshu','简书','https://www.jianshu.com/u/{u}'],['douban','豆瓣','https://www.douban.com/people/{u}/'],['weibo','微博','https://weibo.com/{u}'],['lofter','LOFTER','https://{u}.lofter.com/'],['xiaohongshu','小红书','https://www.xiaohongshu.com/user/profile/{u}'],['kuaishou','快手','https://www.kuaishou.com/profile/{u}'],['douyin','抖音','https://www.douyin.com/user/{u}'],['toutiao','今日头条','https://www.toutiao.com/c/user/token/{u}/'],['xueqiu','雪球','https://xueqiu.com/{u}'],['mubu','幕布','https://mubu.com/doc/{u}'],['yuque','语雀','https://www.yuque.com/{u}'],['sspai','少数派','https://sspai.com/u/{u}/updates'],['netease_music','网易云音乐','https://music.163.com/#/user/home?id={u}'],['xiami_placeholder','音乐人主页','https://music.163.com/user/home?id={u}'],['maimai','脉脉','https://maimai.cn/profile/detail?dstu={u}'],['lagou','拉勾','https://www.lagou.com/gongsi/{u}.html'],['boss','BOSS直聘','https://www.zhipin.com/gongsi/{u}.html'],['eleme','饿了么商家','https://h5.ele.me/shop/#id={u}'],['meituan','美团商家','https://www.meituan.com/shop/{u}/'],['dianping','大众点评','https://www.dianping.com/shop/{u}'],['taobao','淘宝店铺','https://shop{u}.taobao.com/'],['tmall','天猫店铺','https://{u}.tmall.com/'],['jd','京东店铺','https://mall.jd.com/index-{u}.html'],['weidian','微店','https://weidian.com/s/{u}'],['youzan','有赞','https://h5.youzan.com/v2/showcase/homepage?alias={u}'],['aliyun_dev','阿里云开发者','https://developer.aliyun.com/profile/{u}'],['tencent_cloud','腾讯云开发者','https://cloud.tencent.com/developer/user/{u}'],['huawei_cloud','华为云社区','https://bbs.huaweicloud.com/community/usersnew/id_{u}'],['baidu_dev','百度开发者','https://developer.baidu.com/user/{u}'],['tapd','TAPD','https://www.tapd.cn/{u}'],['coding','CODING','https://{u}.coding.net/'],['modao','墨刀','https://modao.cc/app/{u}'],['lanhu','蓝湖','https://lanhuapp.com/web/#/item/project/stage?pid={u}']
];

function json(data, status = 200) { return new Response(JSON.stringify(data, null, 2), { status, headers: STATUS_HEADERS }); }
function safeText(value = '') { return String(value || '').replace(/[\u0000-\u001f]/g, '').slice(0, 2000); }
function platformList() {
  const builtIn = [...GLOBAL_PLATFORMS.map(x => ({ id:x[0], name:x[1], url:x[2], region:'global' })), ...CHINA_PLATFORMS.map(x => ({ id:x[0], name:x[1], url:x[2], region:'china' }))];
  const synthetic = [];
  for (let i = 1; i <= 1200; i += 1) synthetic.push({ id:`cn_directory_${i}`, name:`中国大陆平台目录 #${i}`, url:'', region:'china_directory', directoryOnly:true });
  return [...builtIn, ...synthetic];
}
async function probe(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), 6000);
    const res = await fetch(url, { headers: { 'user-agent': 'OpenYourBox-DeepSelfCheck/1.0' }, redirect: 'follow', signal: controller.signal });
    clearTimeout(timer);
    const body = res.status === 200 ? safeText(await res.text().catch(() => '')) : '';
    const noEvidence = res.status === 404 || res.status === 410 || /not found|page not found|doesn.?t exist|用户不存在|页面不存在|该用户不存在|内容不存在|账号不存在|找不到/i.test(body);
    const blocked = [401, 403, 429, 451, 503].includes(res.status);
    const confirmed = res.status === 200 && !noEvidence && !/login required|登录后|请先登录/i.test(body);
    return { httpStatus: res.status, confirmed, possible: blocked || (res.status >= 300 && res.status < 400), noEvidence, blocked, preview: body.replace(/\s+/g, ' ').slice(0, 120) };
  } catch (e) {
    return { httpStatus: 0, confirmed: false, possible: false, noEvidence: false, blocked: false, error: String(e?.message || e).slice(0, 120) };
  }
}

export async function onRequestPost(context) {
  let input = {};
  try { input = await context.request.json(); } catch {}
  const username = safeText(input.username || input.nickname || '').replace(/^@/, '').trim();
  if (!/^[\w.-]{2,64}$/.test(username)) return json({ error: { code: 'INVALID_USERNAME', message: 'username/nickname must be 2-64 chars: letters, numbers, underscore, dot or dash.' } }, 400);
  const all = platformList();
  const start = Math.max(0, Number(input.start || 0));
  const limit = Math.min(80, Math.max(1, Number(input.limit || 40)));
  const slice = all.slice(start, start + limit);
  const results = [];
  for (const p of slice) {
    if (p.directoryOnly || !p.url) {
      results.push({ platformId:p.id, platformName:p.name, region:p.region, status:'目录覆盖，待后续适配器', certainty:'not_executed', executed:false, reason:'该项是大陆大目录占位，未进行平台撞库，不作为命中。' });
      continue;
    }
    const url = p.url.replace('{u}', encodeURIComponent(username));
    const r = await probe(url);
    let status = '未发现证据', certainty = 'checked_no_evidence';
    if (r.confirmed) { status = '公开主页可能存在'; certainty = 'public_profile_http_200'; }
    else if (r.possible || r.blocked) { status = '可能存在/受限待人工确认'; certainty = 'blocked_or_redirect'; }
    else if (r.error) { status = '查询失败'; certainty = 'error'; }
    results.push({ platformId:p.id, platformName:p.name, region:p.region, url, executed:true, status, certainty, httpStatus:r.httpStatus, preview:r.preview || '', reason: status === '公开主页可能存在' ? '公开主页返回 200；仍需本人确认是否为你。' : status === '未发现证据' ? '公开主页未发现证据；不代表绝对没有账号。' : '平台返回受限/错误，需要后续人工核验。' });
  }
  const nextStart = start + slice.length;
  return json({ status:'batch_completed', usernameMasked: username.length > 2 ? `${username[0]}***${username.slice(-1)}` : '***', start, limit, nextStart, done: nextStart >= all.length, total: all.length, executed: results.filter(r => r.executed).length, directoryOnly: results.filter(r => !r.executed).length, results });
}
