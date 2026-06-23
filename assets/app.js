const app = document.querySelector('#app');
const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value = '') => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const navPath = () => location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`;

async function apiPost(path, body = {}) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID(), 'x-private-token': localStorage.getItem('oyb-token') || 'private-mode-token' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: { code: 'NON_JSON_RESPONSE', message: text.slice(0, 300), status: res.status } }; }
}
async function apiGet(path) {
  const res = await fetch(path, { headers: { accept: 'application/json' } });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: { code: 'NON_JSON_RESPONSE', message: text.slice(0, 300), status: res.status } }; }
}
async function catalog() { try { return (await (await fetch('/data/personal-account-platform-catalog.json')).json()).platforms || []; } catch { return []; } }
function card(title, text) { return `<article class="card"><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`; }
function badge(value = 'info') { return `<span class="badge ${esc(value)}">${esc(value)}</span>`; }
function findingGrid(report = {}) {
  return `<div class="grid cols-3">${(report.findings || []).map(f => `<article class="card solid">${badge(f.severity)}<h3>${esc(f.title)}</h3><p>${esc(f.summary)}</p><p><small>${esc(f.source)} · ${esc(f.category)} · ${esc(f.evidencePreview || '')}</small></p></article>`).join('') || '<article class="card">暂无发现项。</article>'}</div>`;
}
function taskGrid(report = {}) {
  return `<div class="grid">${(report.accountTasks || []).map(t => `<article class="task"><input type="checkbox" aria-label="任务状态"><span><strong>${esc(t.platformName)}</strong><br><small>${esc(t.notes || '')}</small><br><small>${['recoveryEntry','dataExportEntry','deletionEntry'].map(k => t[k] ? `<a href="${esc(t[k])}" target="_blank" rel="noreferrer">${esc(k)}</a>` : '').join(' ')}</small></span>${badge(t.taskStatus || 'todo')}</article>`).join('') || '<article class="card">暂无账号任务。</article>'}</div>`;
}
function renderReportSummary(report = {}) {
  return `<section class="section card"><div class="section-head"><div><h2>报告 ${esc(report.id || '')}</h2><p>${esc(report.reportType)} · ${esc(report.generatedAt || '')}</p><p>主体：${esc(JSON.stringify(report.maskedSubject || {}))}</p></div><div class="score-ring" style="--score:${report.riskScore?.total || 0}"><strong>${report.riskScore?.total || 0}</strong></div></div><div class="actions"><a class="btn" href="/reports/${esc(report.scanId || report.id)}/">打开报告详情</a><a class="btn" href="${esc(report.exports?.markdown || '#')}">Markdown</a><a class="btn" href="${esc(report.exports?.csv || '#')}">CSV</a></div><h3>发现项</h3>${findingGrid(report)}<h3>账号任务</h3>${taskGrid(report)}</section>`;
}
function home() {
  app.innerHTML = `<section class="hero"><div><span class="eyebrow">Open Your Box</span><h1>真实数字足迹与暴露面自查。</h1><p class="lead">面向本人、自有账号、自有域名、自有代码资产和企业授权资产，把上传记录、公开页面、DNS、HTTPS、GitHub 与可选外部 API 归并成报告和修复任务。</p><div class="actions"><a class="btn primary" href="/personal/">开始个人自查</a><a class="btn" href="/organization/">开始组织自查</a><a class="btn" href="/reports/">查看报告</a></div></div><div class="glass-stack"><article class="card floating solid"><h3>生产闭环</h3><p>Pages Functions 写入 D1，报告中心可刷新后读取。</p></article><article class="card floating solid"><h3>风险评分</h3><div class="score-ring" style="--score:64"><strong>64</strong></div></article><article class="card floating solid"><h3>数据原则</h3><p>不保存密码、TOTP、cookie、token 或 secret 明文。</p></article></div></section><section class="section grid cols-4">${['个人自查','组织自查','账号任务台','报告中心'].map(x => card(x, '真实扫描链路返回结构化 JSON；缺 Key 或未验证时明确跳过。')).join('')}</section>`;
}
function personal() {
  app.innerHTML = `<section class="section"><h2>个人数字足迹自查 Beta</h2><p class="lead">仅检查本人提供的数据、本人公开页面和本人授权标识；不会保存密码字段、TOTP、cookie、token 或 secret 明文。</p><form class="card form" id="personal-form"><div class="grid cols-2"><label>本人邮箱<input id="email" autocomplete="email" placeholder="me@example.com"></label><label>本人手机号<input id="phone" autocomplete="tel" placeholder="+86 138****0000"></label><label>GitHub 用户名<input id="github" placeholder="octocat"></label><label>公开主页 URL<textarea id="publicUrls" placeholder="每行一个 URL，只检查你提供的页面\nhttps://example.com"></textarea></label></div><div class="grid cols-2"><label>密码管理器 CSV 文本<textarea id="passwordManagerText" placeholder="url,username,password\nhttps://github.com,me@example.com,SHOULD_NOT_BE_STORED"></textarea><small>导入会忽略 password、TOTP、token、secret 字段。</small></label><label>邮箱导出文本<textarea id="mailboxText" placeholder="From: security@example.com\nSubject: password reset"></textarea><small>只提取平台线索，不保存邮件正文。</small></label><label>浏览器书签/历史文本<textarea id="browserText" placeholder="https://github.com/settings/security"></textarea><small>只提取账号、安全、隐私、导出、注销相关 URL。</small></label><label>平台导出元信息文本<textarea id="platformExportText" placeholder="粘贴平台导出的索引、URL 或元信息，不要粘贴 cookie/token"></textarea><small>用于生成账号清理任务，不保存敏感明文。</small></label></div><label class="check-row"><input type="checkbox" id="ok"><span>我确认只检查本人数据，不用于陌生人查询。</span></label><button class="btn primary" id="go" disabled>提交个人自查</button></form><div id="out" class="result-area"></div></section>`;
  $('#ok').onchange = () => $('#go').disabled = !$('#ok').checked;
  $('#personal-form').onsubmit = async event => {
    event.preventDefault();
    $('#out').innerHTML = '<div class="card">扫描中……</div>';
    const payload = {
      authorization: { mode: 'private', verified: false },
      identifiers: { email: $('#email').value.trim(), phone: $('#phone').value.trim(), github: $('#github').value.trim() },
      publicProfileUrls: $('#publicUrls').value.split(/\n+/).map(x => x.trim()).filter(Boolean),
      uploads: {
        passwordManagerText: $('#passwordManagerText').value,
        mailboxText: $('#mailboxText').value,
        browserText: $('#browserText').value,
        platformExportText: $('#platformExportText').value
      }
    };
    const data = await apiPost('/api/scan/personal', payload);
    $('#out').innerHTML = data.report ? renderReportSummary(data.report) : `<pre class="card">${esc(JSON.stringify(data, null, 2))}</pre>`;
  };
}
function organization() {
  app.innerHTML = `<section class="section"><h2>组织授权资产自查 Beta</h2><p class="lead">未验证时只跑 DNS、HTTPS Header、GitHub public summary；完成管理员确认、Cloudflare Zone 或 DNS TXT 验证后才允许外部 adapter。</p><form class="card form" id="org-form"><div class="grid cols-3"><label>域名检查<input id="domain" placeholder="example.com"></label><label>GitHub 组织/用户名<input id="githubOrg" placeholder="octocat"></label><label>自有 IP 检查<input id="ip" placeholder="93.184.216.34"></label></div><label>资产验证方式<select id="method"><option value="none">未验证：轻量公开检查</option><option value="manual_admin_test">手动管理员确认：允许授权适配器</option><option value="cloudflare_zone">Cloudflare Zone 验证：Token 可查到 zone</option><option value="dns_txt">DNS TXT 已验证</option></select></label><label class="check-row"><input type="checkbox" id="org-ok"><span>我确认域名、组织或 IP 属于自有或明确授权资产。</span></label><button class="btn primary" id="org-go" disabled>提交企业自查</button></form><article class="card"><h3>DNS TXT 验证</h3><p>生成 token 后添加 TXT：<code>_openyourbox.&lt;domain&gt;</code>，再执行检查。</p><div class="actions"><button class="btn" id="dns-token">生成 TXT token</button><button class="btn" id="dns-check">检查 TXT</button></div><pre id="dns-out"></pre></article><div id="org-out" class="result-area"></div></section>`;
  $('#org-ok').onchange = () => $('#org-go').disabled = !$('#org-ok').checked;
  let dnsToken = '';
  $('#dns-token').onclick = async () => {
    const data = await apiPost('/api/verify/dns-txt', { domain: $('#domain').value.trim() });
    dnsToken = data.token || '';
    $('#dns-out').textContent = JSON.stringify(data, null, 2);
  };
  $('#dns-check').onclick = async () => {
    const data = await apiPost('/api/verify/dns-txt', { domain: $('#domain').value.trim(), token: dnsToken, check: true });
    if (data.verified) $('#method').value = 'dns_txt';
    $('#dns-out').textContent = JSON.stringify(data, null, 2);
  };
  $('#org-form').onsubmit = async event => {
    event.preventDefault();
    $('#org-out').innerHTML = '<div class="card">扫描中……</div>';
    const method = $('#method').value;
    const payload = { domain: $('#domain').value.trim(), githubOrg: $('#githubOrg').value.trim(), ip: $('#ip').value.trim(), authorization: { mode: 'private', verified: method !== 'none', method } };
    const data = await apiPost('/api/scan/company', payload);
    $('#org-out').innerHTML = data.report ? renderReportSummary(data.report) : `<pre class="card">${esc(JSON.stringify(data, null, 2))}</pre>`;
  };
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
  let tasks = [];
  if (latestPersonal) {
    const detail = await apiGet(`/api/reports/${encodeURIComponent(latestPersonal.scanId || latestPersonal.id)}`);
    tasks = detail.accountTasks || [];
  }
  app.innerHTML = `<section class="section"><h2>账号任务台</h2><p class="lead">优先展示最近一次个人报告里的 accountTasks；没有报告时展示平台目录默认任务。</p><div class="actions"><a class="btn" href="/personal/">生成个人报告</a><a class="btn" href="/reports/">报告中心</a></div><div class="grid">${tasks.length ? tasks.map(t => `<article class="task"><input type="checkbox"><span><strong>${esc(t.platformName)}</strong><br><small>${esc(t.notes || '')}</small></span>${badge(t.taskStatus || 'todo')}</article>`).join('') : list.slice(0, 50).map(p => `<article class="task"><input type="checkbox"><span><strong>${esc(p.name)}</strong><br><small>${esc(p.cleanupNote || '先导出数据，再处理账号状态。')}</small></span>${badge('default')}</article>`).join('')}</div></section>`;
}
async function reports() {
  const parts = navPath().split('/').filter(Boolean);
  if (parts[0] === 'reports' && parts[1]) return reportDetail(parts[1]);
  const data = await apiGet('/api/reports');
  app.innerHTML = `<section class="section"><h2>报告中心</h2><p class="lead">从 D1 读取最近报告，支持 JSON、Markdown 和 CSV 导出。</p><div class="grid">${(data.reports || []).map(r => `<article class="card"><h3>${esc(r.id || r.scanId)}</h3><p>${esc(r.reportType)} · ${esc(r.riskScore)} · ${esc(r.createdAt || '')}</p><div class="actions"><a class="btn primary" href="/reports/${esc(r.scanId || r.id)}/">打开详情</a><a class="btn" href="/api/reports/${esc(r.scanId || r.id)}/export?format=md">Markdown</a><a class="btn" href="/api/reports/${esc(r.scanId || r.id)}/export?format=csv">CSV</a></div></article>`).join('') || '<article class="card">暂无服务器报告。提交一次扫描后会显示。</article>'}</div></section>`;
}
async function reportDetail(id) {
  const report = await apiGet(`/api/reports/${encodeURIComponent(id)}`);
  if (report.error) { app.innerHTML = `<section class="section"><pre class="card">${esc(JSON.stringify(report, null, 2))}</pre></section>`; return; }
  app.innerHTML = `<section class="section"><div class="section-head"><div><h2>报告详情</h2><p>${esc(report.reportType)} · ${esc(report.generatedAt)}</p><p>${esc(report.authorizedScope || '')}</p></div><div class="score-ring" style="--score:${report.riskScore?.total || 0}"><strong>${report.riskScore?.total || 0}</strong></div></div><div class="grid cols-2">${card('主体', JSON.stringify(report.maskedSubject || {}))}${card('数据源', (report.dataSources || []).join(', '))}${card('导出', `Markdown: ${report.exports?.markdown || ''} | CSV: ${report.exports?.csv || ''}`)}${card('复查计划', report.nextReviewPlan || '')}</div><h3>发现项</h3>${findingGrid(report)}<h3>账号清理任务</h3>${taskGrid(report)}<h3>修复建议</h3><div class="card"><ol>${(report.remediationSteps || []).map(s => `<li>${esc(s)}</li>`).join('') || '<li>根据发现项逐项复核。</li>'}</ol></div><div class="actions"><a class="btn" href="${esc(report.exports?.markdown || '#')}">导出 Markdown</a><a class="btn" href="${esc(report.exports?.csv || '#')}">导出 CSV</a><button class="btn" id="delete-data">清除测试数据</button></div><pre id="delete-out"></pre></section>`;
  $('#delete-data').onclick = async () => { $('#delete-out').textContent = JSON.stringify(await apiPost('/api/settings/delete-data', { scope: 'local-test' }), null, 2); };
}
function risk() { app.innerHTML = `<section class="section"><h2>风险评分</h2><div class="grid cols-3">${['identity','exposure','account','breach','infrastructure','remediation'].map(x => card(x, '按发现数量、严重程度、置信度、修复价值和资产类型归一化。')).join('')}</div></section>`; }
function settings() {
  app.innerHTML = `<section class="section"><h2>设置与数据</h2><p class="lead">用于测试阶段导出或清除本地匿名 D1 报告数据。</p><div class="grid cols-2"><article class="card"><h3>导出我的数据</h3><p>导出当前 D1 中 local 测试报告。</p><button class="btn" id="export-data">导出 JSON</button></article><article class="card"><h3>清除服务器数据</h3><p>删除当前测试范围内 reports、jobs、findings、account_tasks。</p><button class="btn" id="delete-data">清除测试数据</button></article></div><pre class="card" id="settings-out"></pre></section>`;
  $('#export-data').onclick = async () => { $('#settings-out').textContent = JSON.stringify(await apiPost('/api/settings/export-data', { scope: 'local-test' }), null, 2); };
  $('#delete-data').onclick = async () => { $('#settings-out').textContent = JSON.stringify(await apiPost('/api/settings/delete-data', { scope: 'local-test' }), null, 2); };
}
function safety() { app.innerHTML = `<section class="section"><h2>安全边界</h2><p class="lead">本项目只做本人、自有资产和授权资产的防御型自查。真实扫描依赖用户上传、用户连接、公开 URL 或资产验证，不提供陌生人查询、绕过限制或攻击性能力。</p><div class="grid cols-3">${['不保存密码字段','不保存 cookie/token/secret','未验证企业资产不跑外部 adapter'].map(x => card(x, '这是当前生产化闭环的硬边界。')).join('')}</div></section>`; }
function auth() { app.innerHTML = '<section class="section"><h2>登录预留</h2><p class="lead">后续阶段接入登录；当前第 1–4 步使用 local 匿名测试用户完成 D1 报告闭环。</p></section>'; }

const routes = { '/': home, '/personal/': personal, '/organization/': organization, '/social/': social, '/accounts/': accounts, '/reports/': reports, '/risk/': risk, '/settings/': settings, '/auth/': auth, '/safety/': safety };
function boot() {
  const path = navPath();
  const handler = path.startsWith('/reports/') ? reports : (routes[path] || home);
  handler();
  $('.nav-toggle')?.addEventListener('click', () => $('.site-nav')?.classList.toggle('open'));
}
boot();
