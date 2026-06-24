const app = document.querySelector('#app');
const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value = '') => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const navPath = () => location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`;
const reportUrl = id => `/reports/?id=${encodeURIComponent(id || '')}`;

async function apiPost(path, body = {}) {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID(), 'x-private-token': localStorage.getItem('oyb-token') || 'private-mode-token' }, body: JSON.stringify(body) });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: { code: 'NON_JSON_RESPONSE', message: text.slice(0, 300), status: res.status } }; }
}
async function apiGet(path) {
  const res = await fetch(path, { headers: { accept: 'application/json', 'x-private-token': localStorage.getItem('oyb-token') || 'private-mode-token' } });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: { code: 'NON_JSON_RESPONSE', message: text.slice(0, 300), status: res.status } }; }
}
async function catalog() { try { return (await (await fetch('/data/personal-account-platform-catalog.json')).json()).platforms || []; } catch { return []; } }
function card(title, text) { return `<article class="card"><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`; }
function badge(value = 'info') { return `<span class="badge ${esc(value)}">${esc(value)}</span>`; }
function statusMeta(t = {}) {
  const raw = `${t.accountStatus || ''} ${t.taskType || ''} ${t.notes || ''} ${t.evidenceSource || ''}`.toLowerCase();
  if (t.statusLabel) return { label: t.statusLabel, level: t.statusLevel || 'info', reason: t.statusReason || t.notes || '按报告证据判断。' };
  if (/confirmed|password_manager/.test(raw)) return { label: '已确认有账号/登录记录', level: 'high', reason: '你提供的登录记录或账号导入中出现该平台；可优先检查安全设置、导出数据和注销入口。' };
  if (/mailbox|browser|platform_export|possible/.test(raw)) return { label: '可能存在账号', level: 'medium', reason: '邮箱、浏览器记录或平台导出元信息中出现该平台线索；需要进入官方入口确认。' };
  if (/candidate_from_username|username_review|username_nickname_candidate|candidate/.test(raw)) return { label: '候选待确认', level: 'low', reason: '仅由用户名/昵称和平台目录生成，不代表已经确认存在账号。' };
  return { label: '待人工确认', level: 'info', reason: '暂无足够证据确认状态，请使用官方入口核验。' };
}
function actionLinks(t = {}) {
  const links = [['找回', t.recoveryEntry || t.actionUrl], ['导出', t.dataExportEntry], ['注销/停用', t.deletionEntry]].filter(([, u]) => u);
  return links.map(([label, url]) => `<a class="btn" href="${esc(url)}" target="_blank" rel="noreferrer">${esc(label)}</a>`).join('');
}
function statusCounts(tasks = []) {
  return tasks.reduce((acc, t) => { const label = statusMeta(t).label; acc[label] = (acc[label] || 0) + 1; return acc; }, {});
}
function statusBoard(report = {}) {
  const summary = report.accountStatusSummary || statusCounts(report.accountTasks || []);
  const order = ['已确认有账号/登录记录', '可能存在账号', '候选待确认', '待人工确认'];
  return `<div class="grid cols-4">${order.map(k => card(k, `${summary[k] || 0} 个平台`)).join('')}</div><p><small>说明：只有来自你上传/导入的登录记录才显示为“已确认”；用户名/昵称只生成候选，不等同于真实账号命中。</small></p>`;
}
function findingGrid(report = {}) {
  return `<div class="grid cols-3">${(report.findings || []).map(f => `<article class="card solid">${badge(f.severity)}<h3>${esc(f.title)}</h3><p>${esc(f.summary)}</p><p><small>${esc(f.source)} · ${esc(f.category)} · ${esc(f.evidencePreview || '')}</small></p></article>`).join('') || '<article class="card">暂无发现项。</article>'}</div>`;
}
function taskGrid(report = {}) {
  const tasks = report.accountTasks || [];
  if (!tasks.length) return '<article class="card">暂无账号任务。提交个人自查或上传账号线索后会显示。</article>';
  const order = ['已确认有账号/登录记录', '可能存在账号', '候选待确认', '待人工确认'];
  return order.map(label => {
    const group = tasks.filter(t => statusMeta(t).label === label);
    if (!group.length) return '';
    return `<section class="card"><div class="section-head"><div><h3>${esc(label)}</h3><p>${group.length} 个平台</p></div>${badge(label)}</div><div class="grid">${group.map(t => { const m = statusMeta(t); return `<article class="task"><input type="checkbox" aria-label="任务状态"><span><strong>${esc(t.platformName || t.platformId || '未知平台')}</strong><br><small><b>状态：</b>${esc(m.label)} ｜ <b>依据：</b>${esc(m.reason)}</small><br><small><b>任务：</b>${esc(t.notes || '使用官方入口确认、导出、解绑或注销。')}</small><br><span class="actions">${actionLinks(t)}</span></span>${badge(m.level)}</article>`; }).join('')}</div></section>`;
  }).join('');
}
function renderReportSummary(report = {}) {
  const id = report.scanId || report.id;
  return `<section class="section card"><div class="section-head"><div><h2>报告 ${esc(report.id || '')}</h2><p>${esc(report.reportType)} · ${esc(report.generatedAt || '')}</p><p>主体：${esc(JSON.stringify(report.maskedSubject || {}))}</p></div><div class="score-ring" style="--score:${report.riskScore?.total || 0}"><strong>${report.riskScore?.total || 0}</strong></div></div><h3>账号状态摘要</h3>${statusBoard(report)}<div class="actions"><a class="btn primary" href="${esc(reportUrl(id))}">打开报告详情</a><a class="btn" href="${esc(report.exports?.markdown || '#')}">Markdown</a><a class="btn" href="${esc(report.exports?.csv || '#')}">CSV</a></div><h3>账号状态与处理入口</h3>${taskGrid(report)}<h3>发现项</h3>${findingGrid(report)}</section>`;
}
function home() {
  app.innerHTML = `<section class="hero"><div><span class="eyebrow">Open Your Box</span><h1>真实数字足迹与暴露面自查。</h1><p class="lead">面向本人、自有账号、自有域名、自有代码资产和企业授权资产，把上传记录、公开页面、DNS、HTTPS、GitHub 与可选外部 API 归并成报告和修复任务。</p><div class="actions"><a class="btn primary" href="/personal/">开始个人自查</a><a class="btn" href="/organization/">开始组织自查</a><a class="btn" href="/reports/">查看报告</a></div></div><div class="glass-stack"><article class="card floating solid"><h3>生产闭环</h3><p>Pages Functions 写入 D1，报告中心可刷新后读取。</p></article><article class="card floating solid"><h3>账号状态</h3><p>已确认、可能存在、候选待确认分开显示。</p></article><article class="card floating solid"><h3>数据原则</h3><p>不保存密码、TOTP、cookie、token 或 secret 明文。</p></article></div></section><section class="section grid cols-4">${['个人自查','组织自查','账号任务台','报告中心'].map(x => card(x, '真实扫描链路返回结构化 JSON；缺 Key 或未验证时明确跳过。')).join('')}</section>`;
}
function personal() {
  app.innerHTML = `<section class="section"><h2>个人数字足迹自查 Beta</h2><p class="lead">测试阶段按本人确认给足权限，优先保证链路可运行；用户名/昵称会对现有社交与应用平台目录生成候选清理任务，后期再接入实名后的强验证检索。</p><form class="card form" id="personal-form"><div class="grid cols-2"><label>本人邮箱<input id="email" autocomplete="email" placeholder="me@example.com"></label><label>本人手机号<input id="phone" autocomplete="tel" placeholder="+86 138****0000"></label><label>用户名/昵称<input id="username" placeholder="octocat / 常用昵称 / 平台 ID"></label><label>公开主页 URL<textarea id="publicUrls" placeholder="每行一个 URL，只检查你提供的页面\nhttps://example.com"></textarea></label></div><div class="grid cols-2"><label>密码管理器 CSV 文本<textarea id="passwordManagerText" placeholder="url,username,password\nhttps://github.com,me@example.com,ignored"></textarea><small>导入会忽略 password、TOTP、token、secret 字段。</small></label><label>邮箱导出文本<textarea id="mailboxText" placeholder="From: security@example.com\nSubject: password reset"></textarea><small>只提取平台线索，不保存邮件正文。</small></label><label>浏览器书签/历史文本<textarea id="browserText" placeholder="https://github.com/settings/security"></textarea><small>只提取账号、安全、隐私、导出、注销相关 URL。</small></label><label>平台导出元信息文本<textarea id="platformExportText" placeholder="粘贴平台导出的索引、URL 或元信息，不要粘贴 cookie/token"></textarea><small>用于生成账号清理任务，不保存敏感明文。</small></label></div><label class="check-row"><input type="checkbox" id="ok"><span>我确认只检查本人数据；测试阶段按本人确认启用最大可用权限。</span></label><button class="btn primary" id="go" disabled>提交个人自查</button></form><div id="out" class="result-area"></div></section>`;
  $('#ok').onchange = () => $('#go').disabled = !$('#ok').checked;
  $('#personal-form').onsubmit = async event => {
    event.preventDefault();
    $('#out').innerHTML = '<div class="card">扫描中……</div>';
    const username = $('#username').value.trim();
    const payload = { authorization: { mode: 'private', verified: true, method: 'self_test_max_access' }, identifiers: { email: $('#email').value.trim(), phone: $('#phone').value.trim(), username, nickname: username }, platformCatalog: await catalog(), publicProfileUrls: $('#publicUrls').value.split(/\n+/).map(x => x.trim()).filter(Boolean), uploads: { passwordManagerText: $('#passwordManagerText').value, mailboxText: $('#mailboxText').value, browserText: $('#browserText').value, platformExportText: $('#platformExportText').value } };
    const data = await apiPost('/api/scan/personal', payload);
    $('#out').innerHTML = data.report ? renderReportSummary(data.report) : `<pre class="card">${esc(JSON.stringify(data, null, 2))}</pre>`;
  };
}
function organization() {
  app.innerHTML = `<section class="section"><h2>组织授权资产自查 Beta</h2><p class="lead">未验证时只跑 DNS、HTTPS Header、GitHub public summary；完成管理员确认、Cloudflare Zone 或 DNS TXT 验证后才允许外部 adapter。</p><form class="card form" id="org-form"><div class="grid cols-3"><label>域名检查<input id="domain" placeholder="example.com"></label><label>GitHub 组织/用户名<input id="githubOrg" placeholder="octocat"></label><label>自有 IP 检查<input id="ip" placeholder="93.184.216.34"></label></div><label>资产验证方式<select id="method"><option value="none">未验证：轻量公开检查</option><option value="manual_admin_test">手动管理员确认：允许授权适配器</option><option value="cloudflare_zone">Cloudflare Zone 验证：Token 可查到 zone</option><option value="dns_txt">DNS TXT 已验证</option></select></label><label class="check-row"><input type="checkbox" id="org-ok"><span>我确认域名、组织或 IP 属于自有或明确授权资产。</span></label><button class="btn primary" id="org-go" disabled>提交企业自查</button></form><article class="card"><h3>DNS TXT 验证</h3><p>生成 token 后添加 TXT：<code>_openyourbox.&lt;domain&gt;</code>，再执行检查。</p><div class="actions"><button class="btn" id="dns-token">生成 TXT token</button><button class="btn" id="dns-check">检查 TXT</button></div><pre id="dns-out"></pre></article><div id="org-out" class="result-area"></div></section>`;
  $('#org-ok').onchange = () => $('#org-go').disabled = !$('#org-ok').checked;
  let dnsToken = '';
  $('#dns-token').onclick = async () => { const data = await apiPost('/api/verify/dns-txt', { domain: $('#domain').value.trim() }); dnsToken = data.token || ''; $('#dns-out').textContent = JSON.stringify(data, null, 2); };
  $('#dns-check').onclick = async () => { const data = await apiPost('/api/verify/dns-txt', { domain: $('#domain').value.trim(), token: dnsToken, check: true }); if (data.verified) $('#method').value = 'dns_txt'; $('#dns-out').textContent = JSON.stringify(data, null, 2); };
  $('#org-form').onsubmit = async event => { event.preventDefault(); $('#org-out').innerHTML = '<div class="card">扫描中……</div>'; const method = $('#method').value; const payload = { domain: $('#domain').value.trim(), githubOrg: $('#githubOrg').value.trim(), ip: $('#ip').value.trim(), authorization: { mode: 'private', verified: method !== 'none', method } }; const data = await apiPost('/api/scan/company', payload); $('#org-out').innerHTML = data.report ? renderReportSummary(data.report) : `<pre class="card">${esc(JSON.stringify(data, null, 2))}</pre>`; };
}
async function social() {
  const list = await catalog();
  app.innerHTML = `<section class="section"><div class="section-head"><div><h2>社交账号目录</h2><p>用于本人账号找回、导出、注销和安全设置入口，不做陌生人枚举。</p></div>${badge(`${list.length} platforms`)}</div><div class="tool-controls"><button class="chip active" data-region="all">全部</button><button class="chip" data-region="global">全球</button><button class="chip" data-region="china">中国大陆</button></div><div id="grid" class="grid cols-3"></div></section>`;
  const render = region => $('#grid').innerHTML = list.filter(p => region === 'all' || p.region === region).slice(0, 120).map(p => `<article class="card"><span class="badge">${esc(p.region)}</span><h3>${esc(p.name)}</h3><p>${esc(p.category)}</p><div class="actions"><a class="btn" href="${esc(p.recoveryEntry || '#')}">找回</a><a class="btn" href="${esc(p.dataExportEntry || '#')}">导出</a><a class="btn" href="${esc(p.deletionEntry || '#')}">处理账号</a></div></article>`).join('');
  render('all'); document.querySelectorAll('[data-region]').forEach(b => b.onclick = () => render(b.dataset.region));
}
async function accounts() {
  const list = await catalog();
  const reports = await apiGet('/api/reports');
  const latestPersonal = (reports.reports || []).find(r => r.reportType === 'personal');
  let report = null;
  if (latestPersonal) report = await apiGet(`/api/reports/${encodeURIComponent(latestPersonal.scanId || latestPersonal.id)}`);
  app.innerHTML = `<section class="section"><h2>账号任务台</h2><p class="lead">清楚区分“已确认、可能存在、候选待确认”。没有报告时展示平台目录默认任务。</p><div class="actions"><a class="btn" href="/personal/">生成个人报告</a><a class="btn" href="/reports/">报告中心</a></div>${report?.accountTasks?.length ? statusBoard(report) + taskGrid(report) : `<div class="grid">${list.slice(0, 50).map(p => `<article class="task"><input type="checkbox"><span><strong>${esc(p.name)}</strong><br><small>状态：待人工确认。${esc(p.cleanupNote || '先导出数据，再处理账号状态。')}</small><br><span class="actions">${actionLinks(p)}</span></span>${badge('default')}</article>`).join('')}</div>`}</section>`;
}
async function reports() {
  const id = new URL(location.href).searchParams.get('id');
  if (id) return reportDetail(id);
  const data = await apiGet('/api/reports');
  app.innerHTML = `<section class="section"><h2>报告中心</h2><p class="lead">从 D1 读取最近报告。详情页使用查询参数打开，避免 Cloudflare Pages 动态路径打不开。</p><div class="grid">${(data.reports || []).map(r => { const id = r.scanId || r.id; return `<article class="card"><h3>${esc(r.id || r.scanId)}</h3><p>${esc(r.reportType)} · ${esc(r.riskScore)} · ${esc(r.createdAt || '')}</p><div class="actions"><a class="btn primary" href="${esc(reportUrl(id))}">打开详情</a><a class="btn" href="/api/reports/${esc(id)}/export?format=md">Markdown</a><a class="btn" href="/api/reports/${esc(id)}/export?format=csv">CSV</a></div></article>`; }).join('') || '<article class="card">暂无服务器报告。提交一次扫描后会显示。</article>'}</div></section>`;
}
async function reportDetail(id) {
  const report = await apiGet(`/api/reports/${encodeURIComponent(id)}`);
  if (report.error) { app.innerHTML = `<section class="section"><h2>报告详情打不开</h2><p>没有在 D1 或本地缓存中找到该报告。请回到报告中心重新打开，或重新提交一次个人自查。</p><div class="actions"><a class="btn" href="/reports/">返回报告中心</a><a class="btn" href="/personal/">重新个人自查</a></div><pre class="card">${esc(JSON.stringify(report, null, 2))}</pre></section>`; return; }
  app.innerHTML = `<section class="section"><div class="section-head"><div><h2>报告详情</h2><p>${esc(report.reportType)} · ${esc(report.generatedAt)}</p><p>${esc(report.authorizedScope || '')}</p></div><div class="score-ring" style="--score:${report.riskScore?.total || 0}"><strong>${report.riskScore?.total || 0}</strong></div></div><div class="grid cols-2">${card('主体', JSON.stringify(report.maskedSubject || {}))}${card('数据源', (report.dataSources || []).join(', '))}${card('导出', `Markdown: ${report.exports?.markdown || ''} | CSV: ${report.exports?.csv || ''}`)}${card('复查计划', report.nextReviewPlan || '')}</div><h3>账号状态总览</h3>${statusBoard(report)}<h3>哪些平台有账号/可能有账号/候选待确认</h3>${taskGrid(report)}<h3>发现项</h3>${findingGrid(report)}<h3>修复建议</h3><div class="card"><ol>${(report.remediationSteps || []).map(s => `<li>${esc(s)}</li>`).join('') || '<li>根据发现项逐项复核。</li>'}</ol></div><div class="actions"><a class="btn" href="${esc(report.exports?.markdown || '#')}">导出 Markdown</a><a class="btn" href="${esc(report.exports?.csv || '#')}">导出 CSV</a><button class="btn" id="delete-data">清除测试数据</button><a class="btn" href="/reports/">返回报告中心</a></div><pre id="delete-out"></pre></section>`;
  $('#delete-data').onclick = async () => { $('#delete-out').textContent = JSON.stringify(await apiPost('/api/settings/delete-data', { scope: 'local-test' }), null, 2); };
}
function risk() { app.innerHTML = `<section class="section"><h2>风险评分</h2><div class="grid cols-3">${['identity','exposure','account','breach','infrastructure','remediation'].map(x => card(x, '按发现数量、严重程度、置信度、修复价值和资产类型归一化。')).join('')}</div></section>`; }
function settings() {
  app.innerHTML = `<section class="section"><h2>设置与数据</h2><p class="lead">用于测试阶段导出或清除本地匿名 D1 报告数据。</p><div class="grid cols-2"><article class="card"><h3>导出我的数据</h3><p>导出当前 D1 中 local 测试报告。</p><button class="btn" id="export-data">导出 JSON</button></article><article class="card"><h3>清除服务器数据</h3><p>删除当前测试范围内 reports、jobs、findings、account_tasks。</p><button class="btn" id="delete-data">清除测试数据</button></article></div><pre class="card" id="settings-out"></pre></section>`;
  $('#export-data').onclick = async () => { $('#settings-out').textContent = JSON.stringify(await apiPost('/api/settings/export-data', { scope: 'local-test' }), null, 2); };
  $('#delete-data').onclick = async () => { $('#settings-out').textContent = JSON.stringify(await apiPost('/api/settings/delete-data', { scope: 'local-test' }), null, 2); };
}
function safety() { app.innerHTML = `<section class="section"><h2>安全边界</h2><p class="lead">本项目只做本人、自有资产和授权资产的防御型自查。真实扫描依赖用户上传、用户连接、公开 URL 或资产验证，不提供陌生人查询、绕过限制或攻击性能力。</p><div class="grid cols-3">${['不保存敏感字段','不保存 cookie/token/secret','未验证企业资产不跑外部 adapter'].map(x => card(x, '这是当前生产化闭环的硬边界。')).join('')}</div></section>`; }
function auth() { app.innerHTML = '<section class="section"><h2>登录预留</h2><p class="lead">后续阶段接入登录；当前第 1–4 步使用 local 匿名测试用户完成 D1 报告闭环。</p></section>'; }

const routes = { '/': home, '/personal/': personal, '/organization/': organization, '/social/': social, '/accounts/': accounts, '/reports/': reports, '/risk/': risk, '/settings/': settings, '/auth/': auth, '/safety/': safety };
function boot() {
  const path = navPath();
  const handler = path.startsWith('/reports/') ? reports : (routes[path] || home);
  handler();
  $('.nav-toggle')?.addEventListener('click', () => $('.site-nav')?.classList.toggle('open'));
}
boot();
