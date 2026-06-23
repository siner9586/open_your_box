const BASE_URL = (() => {
  const script = document.currentScript?.getAttribute('src') || '/assets/app.js';
  const url = new URL(script, window.location.href);
  return url.pathname.replace(/assets\/app\.js$/, '');
})();

const route = () => {
  const path = window.location.pathname.replace(BASE_URL, '/').replace(/\/+/g, '/');
  return path.endsWith('/') ? path : `${path}/`;
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const app = $('#app');
const state = { tools: [], risks: [], personal: null, organization: null, selectedNode: null, watchlist: [] };

const fetchJson = async (path) => {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) throw new Error(`无法读取 ${path}`);
  return response.json();
};

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const badgeClass = (risk = '') => risk === 'critical' || risk === 'high' || risk === '高' ? 'high' : risk === 'medium' || risk === '中度' ? 'medium' : 'low';
const cnLevel = (score) => score <= 20 ? '低暴露' : score <= 40 ? '轻度暴露' : score <= 60 ? '中度暴露' : score <= 80 ? '高暴露' : '严重暴露';
const coreToolIds = ['blackbird', 'maigret', 'spiderfoot', 'theharvester', 'shodan'];

function linkTo(path) { return `${BASE_URL.replace(/\/$/, '')}${path}` || path; }
function hydrateLinks() {
  $$('a[href^="/"]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href.startsWith(BASE_URL)) a.setAttribute('href', linkTo(href));
  });
}

function demoBanner(text = '当前为 Demo Mode：页面只使用模拟数据，不触发真实扫描，不保存敏感原文。真实检查请在本地 CLI、自部署 Worker 或私有 GitHub Actions 中执行。') {
  return `<div class="demo-banner"><strong>Demo Mode</strong><span>${text}</span></div>`;
}

function valueCards() {
  const items = [
    ['看见暴露', '聚合账号、邮箱、域名、IP、设备、仓库等公开线索。'],
    ['理解风险', '不堆砌原始情报，而是转化为风险等级、证据类型和影响解释。'],
    ['立即清理', '给出注销账号、修改密码、开启 MFA、隐藏公开资料、收敛端口等行动清单。'],
    ['持续守护', '通过 GitHub Actions、定期导入报告或自部署服务形成周期性体检。']
  ];
  return `<section class="section"><div class="grid cols-4">${items.map((item, i) => `
    <article class="card"><div class="value-icon">${i + 1}</div><h3>${item[0]}</h3><p>${item[1]}</p></article>`).join('')}</div></section>`;
}

function heroVisual() {
  return `<div class="glass-stack" aria-label="暴露面管理示意卡片">
    <article class="card floating solid"><span class="badge">Personal & Organizational Exposure Intelligence</span><h3>暴露面地图</h3><div class="kpi"><span>账号足迹</span><strong>7</strong></div><div class="kpi"><span>子域名</span><strong>18</strong></div><div class="kpi"><span>公网服务</span><strong>3</strong></div></article>
    <article class="card floating solid"><h3>风险评分</h3><div class="score-ring" style="--score:68"><strong>68</strong></div><p>高暴露：优先处理测试系统、管理端口与仓库密钥。</p></article>
    <article class="card floating solid"><h3>工具矩阵</h3><p class="lead" style="font-size:1rem">Blackbird · Maigret · SpiderFoot · theHarvester · Shodan · Gitleaks · Censys · VirusTotal · Prowler</p><span class="badge">58 个防御型工具/模块</span></article>
  </div>`;
}

function homePage() {
  const coreTools = state.tools.filter(t => coreToolIds.includes(t.id));
  app.innerHTML = `<section class="hero">
    <div>
      <span class="eyebrow">Open Your Box｜打开自己的盒子</span>
      <h1>先打开自己的盒子，再决定如何关上它。</h1>
      <p class="lead">你在互联网上留下的账号、邮箱、域名、子域名、设备、代码仓库和泄露痕迹，往往比想象中更多。Open Your Box 帮你把这些公开线索整理成一张可读的暴露面地图，并给出清理、加固和长期监测建议。</p>
      <div class="actions">
        <a class="btn primary" href="/personal/">开始个人自查</a>
        <a class="btn" href="/organization/">开始组织自查</a>
        <a class="btn ghost" href="/tools/">查看工具矩阵</a>
        <a class="btn ghost" href="/safety/">阅读安全边界</a>
      </div>
      ${demoBanner('公共站点默认只展示 Demo 与报告导入能力。真实扫描必须在你的本地或私有环境中运行。')}
    </div>
    ${heroVisual()}
  </section>
  ${valueCards()}
  <section class="section grid cols-2">
    <article class="card"><h2>个人自查</h2><p>围绕本人用户名、邮箱、GitHub 足迹和旧账号遗留，生成数字暴露护照与 7 天清理任务。</p><a class="btn primary" href="/personal/">进入个人模式</a></article>
    <article class="card"><h2>组织自查</h2><p>围绕自有域名、授权 IP、GitHub 组织和公开服务，输出资产视图、风险视图和修复视图。</p><a class="btn primary" href="/organization/">进入组织模式</a></article>
  </section>
  <section class="section"><div class="section-head"><div><h2>五个核心工具</h2><p>只作为防御型暴露面管理适配器，不包装成查人或攻击工具。</p></div><a class="btn" href="/tools/">全部 ${state.tools.length} 个工具</a></div><div class="grid cols-5">${coreTools.map(toolCard).join('')}</div></section>
  <section class="section card"><h2>方法论</h2><div class="grid cols-5">${['授权输入','多源采集','脱敏去重','风险评分','清理复查'].map((x,i)=>`<div class="notice-item"><b>${i+1}</b><span>${x}</span></div>`).join('')}</div></section>`;
}

function consentForm(type) {
  const isPersonal = type === 'personal';
  const title = isPersonal ? '个人数字足迹自查' : '组织公开暴露面体检';
  const inputs = isPersonal
    ? [['username','本人用户名','demo_user'], ['email','本人邮箱','d***@example.com'], ['nickname','本人常用昵称','demo'], ['github','GitHub 用户名（可选）','demo_user']]
    : [['domain','自有/授权域名','example.com'], ['ip','自有/授权 IP','203.0.113.10'], ['githubOrg','GitHub 组织名','demo-org'], ['company','公司名称（可选）','Example Demo Ltd.']];
  const consent = isPersonal
    ? '我确认本次输入的信息属于我本人，或我已获得明确授权。本工具不会用于骚扰、跟踪、羞辱或侵犯他人隐私。'
    : '我确认本次输入的域名、IP、仓库或组织资产属于本人/本组织，或我已获得书面/明确授权。';
  return `<section class="section"><div class="section-head"><div><h2>${title}</h2><p>${isPersonal ? '从账号、邮箱、开发者足迹和旧账号开始，生成可行动的清理清单。' : '从域名、子域名、公网服务、代码仓库和供应链视角，整理公开暴露面。'}</p></div></div>${demoBanner()}
    <div class="grid cols-2"><form class="card form" id="scan-form">
      <div class="form-row">${inputs.map(([id,label,ph]) => `<label>${label}<input id="${id}" placeholder="${ph}" autocomplete="off" /></label>`).join('')}</div>
      <label class="check-row"><input id="consent" type="checkbox" /><span>${consent}</span></label>
      <div class="actions"><button class="btn primary" id="run-demo" disabled type="submit">生成演示报告</button><button class="btn" id="show-command" disabled type="button">查看本地执行命令</button></div>
    </form><div class="card"><h3>默认执行层</h3><div class="notice-list">
      <div class="notice-item"><b>Layer 1</b><span>前端 Demo：只读模拟数据，完整体验流程。</span></div>
      <div class="notice-item"><b>Layer 2</b><span>报告导入：浏览器内解析 JSON，不上传敏感原文。</span></div>
      <div class="notice-item"><b>Layer 3</b><span>本地 CLI：生成命令，不在公共站点扫描。</span></div>
      <div class="notice-item"><b>Layer 4</b><span>自部署 / 私有 Actions：真实扫描只在授权环境执行。</span></div>
    </div></div></div>
    <div id="scan-result" class="result-area"></div>
  </section>`;
}

function personalPage() {
  app.innerHTML = consentForm('personal');
  bindScan('personal');
}
function organizationPage() {
  app.innerHTML = consentForm('organization');
  bindScan('organization');
}

function bindScan(type) {
  const consent = $('#consent');
  const run = $('#run-demo');
  const command = $('#show-command');
  consent.addEventListener('change', () => { run.disabled = command.disabled = !consent.checked; });
  $('#scan-form').addEventListener('submit', (event) => {
    event.preventDefault();
    renderScanResult(type);
  });
  command.addEventListener('click', () => renderCommands(type));
}

function findingsHtml(report) {
  return `<div class="grid cols-3">${report.findings.map(f => `<article class="card solid"><span class="badge ${badgeClass(f.risk)}">${f.risk}</span><h3>${f.title}</h3><p><strong>${f.maskedValue}</strong> · ${f.count} 条证据</p><p>${f.explanation}</p><div class="meta">${f.tools.map(t=>`<span class="badge">${t}</span>`).join('')}</div></article>`).join('')}</div>`;
}

function tasksHtml(tasks) {
  return `<div class="grid">${tasks.map(task => `<label class="task"><input type="checkbox" data-task="${task.id}" /><span><strong>${task.title}</strong><br/><small>${task.difficulty} · ${task.estimatedMinutes} 分钟 · 降低 ${task.riskReduction} 分风险</small><br/>${task.steps.join(' → ')}<br/><em>验收：${task.verification}</em></span><span class="badge">${task.status}</span></label>`).join('')}</div>`;
}

function renderScanResult(type) {
  const report = type === 'personal' ? state.personal : state.organization;
  $('#scan-result').innerHTML = `<section class="section card"><div class="section-head"><div><h2>${report.reportType === 'personal' ? '个人自查 Demo 结果' : '组织体检 Demo 结果'}</h2><p>${report.summary}</p></div><div class="score-ring" style="--score:${report.totalScore}"><strong>${report.totalScore}</strong></div></div><span class="badge ${badgeClass(report.level)}">${report.level}</span>${findingsHtml(report)}<h3>清理建议生成器</h3>${tasksHtml(report.tasks)}<div class="actions"><button class="btn primary" data-export-md="${type}">导出 Markdown</button><button class="btn" data-export-json="${type}">导出 JSON</button><a class="btn" href="/report/">查看完整报告页</a></div></section>`;
  bindExports(report);
  bindTaskToggle();
}

function commandBlock(title, command, note) {
  return `<article class="card solid"><h3>${title}</h3><pre class="report-preview">${escapeHtml(command)}</pre><p>${note}</p></article>`;
}
function renderCommands(type) {
  const html = type === 'personal'
    ? [commandBlock('Blackbird｜账号足迹快照', 'python blackbird.py --username demo_user --json report-blackbird.json\npython blackbird.py --email d***@example.com --json report-blackbird-email.json', '仅限本人用户名或授权账号；不要用于骚扰、曝光或身份推断。'), commandBlock('Maigret｜用户名深度复核', 'maigret demo_user --json report-maigret.json', '递归扩展默认关闭，只作为自查扩展建议。'), commandBlock('Gitleaks｜开发者足迹检查', 'gitleaks detect --source . --report-format json --report-path report-gitleaks.json', '只扫描自己的仓库；报告中不要保存明文密钥。')]
    : [commandBlock('theHarvester｜组织公开资产梳理', 'theHarvester -d example.com -b bing,crtsh -f report-theharvester', '只允许自有或授权域名；邮箱输出需脱敏。'), commandBlock('SpiderFoot｜暴露面关联分析', 'python sf.py -s example.com -t DOMAIN_NAME -o json > report-spiderfoot.json', '不展示泄露明文，不展示暗网样本或可复现路径。'), commandBlock('Shodan｜公网设备暴露检查', 'export SHODAN_API_KEY="在本地填入你的 Shodan Key"\npnpm run scan:shodan -- --ip 203.0.113.10 --out report-shodan.json', 'Shodan Key 只走环境变量或 GitHub Secret，不写入前端、README、日志或提交记录。')];
  $('#scan-result').innerHTML = `<section class="section"><h2>本地执行命令生成器</h2>${demoBanner('以下命令只应在你的授权环境中运行。公共站点不会执行真实扫描。')}<div class="grid cols-2">${html.join('')}</div></section>`;
}

function toolCard(tool) {
  const core = coreToolIds.includes(tool.id);
  return `<article class="card tool-card ${core ? 'core' : ''}" data-domain="${tool.domain}"><div class="meta"><span class="badge">${tool.order}</span>${core ? '<span class="badge high">核心</span>' : ''}<span class="badge">${tool.domain}</span></div><h3>${tool.name}</h3><p>${tool.output}</p><div class="meta"><span class="badge">输入：${tool.input}</span><span class="badge">API Key：${tool.requiresApiKey}</span><span class="badge">${tool.execution}</span></div><p><strong>边界：</strong>${tool.boundary}</p></article>`;
}
function toolsPage() {
  const domains = [...new Set(state.tools.map(t => t.domain))];
  app.innerHTML = `<section class="section"><div class="section-head"><div><h2>防御型 OSINT 工具矩阵</h2><p>不是黑客工具大全，而是面向个人、组织、开发者和安全团队的防御型暴露面管理工具箱。</p></div><span class="badge">${state.tools.length} 个工具/模块</span></div><div class="tool-controls"><button class="chip active" data-filter="all">全部</button>${domains.map(d=>`<button class="chip" data-filter="${d}">${d}</button>`).join('')}</div><div id="tools-grid" class="grid cols-3">${state.tools.map(toolCard).join('')}</div></section>`;
  $$('.chip').forEach(chip => chip.addEventListener('click', () => {
    $$('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const filter = chip.dataset.filter;
    $('#tools-grid').innerHTML = state.tools.filter(t => filter === 'all' || t.domain === filter).map(toolCard).join('');
  }));
}

function riskPage() {
  const total = Math.round(state.risks.reduce((sum, r) => sum + r.score * r.weight, 0));
  app.innerHTML = `<section class="section"><div class="section-head"><div><h2>风险评分模型</h2><p>不只显示一个分数，而是解释每个分数背后的证据、来源工具、影响和复查方式。</p></div><div class="score-ring" style="--score:${total}"><strong>${total}</strong></div></div>
  <div class="card"><h3>0—100 总分区间</h3><div class="grid cols-5">${['0—20：低暴露','21—40：轻度暴露','41—60：中度暴露','61—80：高暴露','81—100：严重暴露'].map(x=>`<span class="badge">${x}</span>`).join('')}</div><p><strong>当前 Demo 总风险分：</strong>${total}，${cnLevel(total)}。</p></div>
  <div class="grid cols-2 section">${state.risks.map(r => `<article class="card"><div class="section-head"><div><h3>${r.title}</h3><span class="badge">权重 ${Math.round(r.weight*100)}%</span> <span class="badge">证据 ${r.evidence_count}</span></div><strong>${r.score}</strong></div><div class="risk-bar"><div class="risk-fill" style="--w:${r.score}%"></div></div><p>${r.explanation}</p><p><strong>来源：</strong>${r.sources.join('、')}</p><p><strong>修复建议：</strong>${r.recommendation.join('；')}</p><p><strong>复查：</strong>${r.review_method}</p></article>`).join('')}</div></section>`;
}

function makeMarkdown(report) {
  return `# ${report.reportType === 'personal' ? '个人隐私自查报告' : '组织公开暴露面体检报告'}\n\n生成时间：${report.generatedAt}\n\n授权范围：${report.authorizedScope}\n\n## 摘要\n\n${report.summary}\n\n## 使用工具\n\n${report.toolsUsed.map(t=>`- ${t}`).join('\n')}\n\n## 风险评分\n\n总分：${report.totalScore}（${report.level}）\n\n## 重要发现\n\n${report.findings.map(f=>`- ${f.title}：${f.count} 条证据，${f.explanation}`).join('\n')}\n\n## 7 天行动清单\n\n${report.tasks.map(t=>`- [ ] ${t.title}：${t.steps.join('；')}。验收：${t.verification}`).join('\n')}\n\n## 长期监测建议\n\n下次复查：${report.nextReviewDate}。建议通过报告导入或私有 GitHub Actions 比较新增、已修复和仍未处理风险。\n\n## 合规边界\n\n本报告只用于本人、自有资产或明确授权资产的防御性暴露面管理，不用于骚扰、披露他人隐私、社工、撞库或漏洞利用。`;
}
function download(name, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
function bindExports(report) {
  $$('[data-export-md]').forEach(btn => btn.addEventListener('click', () => download(`${report.id}.md`, makeMarkdown(report), 'text/markdown')));
  $$('[data-export-json]').forEach(btn => btn.addEventListener('click', () => download(`${report.id}.json`, JSON.stringify(report, null, 2), 'application/json')));
}
function bindTaskToggle() {
  $$('[data-task]').forEach(input => input.addEventListener('change', () => input.closest('.task').classList.toggle('done', input.checked)));
}
function reportPage() {
  const report = state.organization;
  const md = makeMarkdown(report);
  app.innerHTML = `<section class="section"><div class="section-head"><div><h2>我的暴露面报告</h2><p>报告结构包括摘要、输入范围、授权声明、使用工具、发现概览、风险评分、证据类型、重要发现、清理建议、7 天行动清单、30 天加固计划、长期监测建议和合规附录。</p></div><div class="actions"><button class="btn primary" id="export-md">导出 Markdown</button><button class="btn" id="export-json">导出 JSON</button><button class="btn" onclick="window.print()">打印 / PDF</button></div></div>${demoBanner()}<div class="grid cols-2"><article class="card"><h3>报告摘要</h3><p>${report.summary}</p><div class="score-ring" style="--score:${report.totalScore}"><strong>${report.totalScore}</strong></div><h3>导入本地 JSON</h3><textarea id="import-json" placeholder="粘贴本地扫描生成的脱敏 JSON 报告"></textarea><button class="btn" id="parse-json">解析导入报告</button></article><pre class="report-preview" id="report-md">${escapeHtml(md)}</pre></div></section>`;
  $('#export-md').addEventListener('click', () => download(`${report.id}.md`, md, 'text/markdown'));
  $('#export-json').addEventListener('click', () => download(`${report.id}.json`, JSON.stringify(report, null, 2), 'application/json'));
  $('#parse-json').addEventListener('click', () => {
    try { const imported = JSON.parse($('#import-json').value); $('#report-md').textContent = makeMarkdown({ ...report, ...imported, tasks: imported.tasks || report.tasks, findings: imported.findings || report.findings, toolsUsed: imported.toolsUsed || report.toolsUsed }); }
    catch { $('#report-md').textContent = 'JSON 解析失败：请确认报告已脱敏且结构正确。'; }
  });
}

function safetyPage() {
  app.innerHTML = `<section class="section"><h2>安全与合规边界</h2><p class="lead">工具本身不是目的。知道自己暴露了什么，是为了更好地保护自己，而不是伤害别人。公开信息并不等于可以滥用。</p><div class="grid cols-2"><article class="card"><h3>允许</h3><div class="notice-list">${['查自己','查自有域名','查自有 IP','查授权企业资产','查自己管理的 GitHub 仓库','做供应商公开暴露面尽调','做安全教育演示','做 Demo 数据模拟'].map(x=>`<div class="notice-item"><b>可以</b><span>${x}</span></div>`).join('')}</div></article><article class="card"><h3>禁止</h3><div class="notice-list">${['查陌生人','查伴侣、情敌等私人关系对象','人肉搜索或披露他人身份','暴露他人隐私','社工、钓鱼或撞库','尝试默认密码','利用漏洞','批量骚扰','出售或传播结果'].map(x=>`<div class="notice-item"><b>不可以</b><span>${x}</span></div>`).join('')}</div></article></div><article class="card section"><h3>产品承诺</h3><p>公共演示站只展示 Demo、报告导入和本地命令生成器，不直接扫描真实第三方目标，不保存敏感原文，不输出漏洞利用步骤、默认密码或攻击路径。</p></article></section>`;
}
function methodPage() {
  app.innerHTML = `<section class="section"><h2>从公开线索到可行动清单</h2><p class="lead">产品方法论不是“发现越多越好”，而是把公开线索转化为可解释、可处理、可复查的治理闭环。</p><div class="grid cols-4">${['输入边界：明确只检查本人、自有资产或授权资产。','多源采集：通过 Blackbird、Maigret、SpiderFoot、theHarvester、Shodan 等工具获取公开线索。','风险归并：合并成账号、邮箱、域名、IP、仓库、设备、泄露事件等类别。','清理闭环：生成注销、改密、MFA、收敛端口、修复 DNS、清理仓库密钥等任务。'].map((x,i)=>`<article class="card"><div class="value-icon">${i+1}</div><p>${x}</p></article>`).join('')}</div><article class="card section mermaid-box"><h3>Mermaid 流程图</h3><pre>flowchart LR\n  A[授权输入] --> B[工具矩阵采集]\n  B --> C[结果脱敏与去重]\n  C --> D[风险评分]\n  D --> E[清理建议]\n  E --> F[复查与长期监测]</pre></article></section>`;
}

async function loadDemo(name) { return fetchJson(`lib/demo/${name}`); }
async function passportPage() {
  const p = await loadDemo('personal-passport.json');
  app.innerHTML = `<section class="section"><h2>${p.title}</h2>${demoBanner()}<div class="grid cols-3"><article class="card"><h3>用户名复用指数</h3><div class="score-ring" style="--score:${p.usernameReuseIndex}"><strong>${p.usernameReuseIndex}</strong></div></article><article class="card"><h3>邮箱泄露事件数</h3><strong style="font-size:3rem">${p.emailBreachEvents}</strong><p>只显示事件数，不展示明文。</p></article><article class="card"><h3>旧账号遗留数量</h3><strong style="font-size:3rem">${p.legacyAccounts}</strong><p>优先清理长期不用平台。</p></article></div><div class="grid cols-2 section"><article class="card"><h3>7 天清理任务</h3>${p.sevenDayTasks.map(x=>`<div class="notice-item"><b>任务</b><span>${x}</span></div>`).join('')}</article><article class="card"><h3>30 天加固计划</h3>${p.thirtyDayPlan.map(x=>`<div class="notice-item"><b>计划</b><span>${x}</span></div>`).join('')}</article></div></section>`;
}
async function companyCardPage() {
  const c = await loadDemo('company-exposure-card.json');
  app.innerHTML = `<section class="section"><h2>${c.title}</h2><p class="lead">管理层可读的一页式组织公开暴露面摘要。</p><div class="grid cols-4">${[['域名',c.domains],['子域名',c.subdomains],['公开邮箱',c.publicEmails],['公网服务',c.publicServices]].map(([k,v])=>`<article class="card"><h3>${k}</h3><strong style="font-size:3rem">${v}</strong></article>`).join('')}</div><article class="card section"><h3>修复优先级</h3><p>${c.priority}</p><p><strong>端口类型：</strong>${c.ports.join('、')}</p><p><strong>技术栈摘要：</strong>${c.techStack.join('、')}</p></article></section>`;
}
function digitalShadowNodes() {
  return [
    ['email','邮箱','d***@example.com','证据类型：邮箱泄露信号；修复：改密、MFA、邮箱别名。'],
    ['account','平台账号','demo_user','证据类型：旧账号与用户名复用；修复：注销或隐藏资料。'],
    ['repo','GitHub 仓库','demo-org/app','证据类型：公开邮箱与配置提醒；修复：Secret Scanning。'],
    ['domain','域名','example.com','证据类型：公开 DNS 与证书；修复：资产台账。'],
    ['subdomain','子域名','test.example.com','证据类型：历史测试系统；修复：关闭或迁移到内网。'],
    ['ip','IP','203.0.113.*','证据类型：公网服务；修复：白名单/VPN。'],
    ['service','服务','8443/admin-demo','证据类型：管理入口暴露；修复：收敛端口。'],
    ['risk','风险','高暴露','证据类型：多源聚合；修复：优先级清单。']
  ];
}
function mapPage() {
  const nodes = digitalShadowNodes();
  app.innerHTML = `<section class="section"><h2>Digital Shadow Map｜数字影子地图</h2>${demoBanner('图谱默认使用 Demo 数据，敏感节点默认遮蔽，点击节点查看证据类型、风险解释和修复建议。')}<div class="card node-map"><div class="nodes">${nodes.map((n,i)=>`<button class="node" data-node="${i}"><strong>${n[1]}</strong><br/><small>${n[2]}</small></button>`).join('')}</div><article class="card solid" id="node-detail"><h3>点击一个节点</h3><p>查看该节点的证据类型、风险解释与修复建议。</p></article></div></section>`;
  $$('.node').forEach(btn => btn.addEventListener('click', () => {
    $$('.node').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const n = nodes[Number(btn.dataset.node)];
    $('#node-detail').innerHTML = `<span class="badge">${n[0]}</span><h3>${n[1]}：${n[2]}</h3><p>${n[3]}</p><p>关系链：邮箱 → 平台账号 → GitHub 仓库 → 域名 → 子域名 → IP → 端口 → 服务 → 风险。</p>`;
  }));
}
async function diffPage() {
  const before = await loadDemo('exposure-diff-before.json');
  const after = await loadDemo('exposure-diff-after.json');
  app.innerHTML = `<section class="section"><h2>Exposure Diff｜两次报告对比</h2><p class="lead">比较新增风险、已修复风险、仍未处理风险、风险分变化、新增资产和消失资产。</p><div class="grid cols-3"><article class="card"><h3>上次评分</h3><div class="score-ring" style="--score:${before.totalScore}"><strong>${before.totalScore}</strong></div></article><article class="card"><h3>本次评分</h3><div class="score-ring" style="--score:${after.totalScore}"><strong>${after.totalScore}</strong></div></article><article class="card"><h3>风险下降</h3><strong style="font-size:3rem">${before.totalScore - after.totalScore}</strong><p>来自已修复项。</p></article></div><div class="grid cols-2 section"><article class="card"><h3>仍未处理</h3>${after.risks.map(x=>`<div class="notice-item"><b>风险</b><span>${x}</span></div>`).join('')}</article><article class="card"><h3>已修复</h3>${after.fixed.map(x=>`<div class="notice-item"><b>完成</b><span>${x}</span></div>`).join('')}</article></div></section>`;
}
async function developerKitPage() {
  const d = await loadDemo('developer-kit.json');
  app.innerHTML = `<section class="section"><h2>${d.title}</h2><p class="lead">面向独立开发者、创业者、开源维护者的上线前自保清单。</p><div class="grid cols-2"><article class="card"><h3>检查项</h3>${d.checks.map(x=>`<div class="notice-item"><b>检查</b><span>${x}</span></div>`).join('')}</article><article class="card"><h3>上线前清单</h3>${d.launchChecklist.map(x=>`<div class="notice-item"><b>清单</b><span>${x}</span></div>`).join('')}</article></div></section>`;
}
function familyPage() {
  app.innerHTML = `<section class="section"><h2>Family Safety Mode｜家庭数字安全模式</h2><p class="lead">只做家庭安全教育，不做监控和控制他人。重点是老账号清理、公开资料保护、家庭设备不要暴露公网、密码管理器和 MFA。</p><div class="grid cols-3">${['清理家庭成员旧账号','儿童公开资料保护','家庭 Wi-Fi 设备暴露提示','摄像头 / NAS / 打印机不要暴露公网','邮箱泄露事件自查','密码管理器与 MFA 建议'].map(x=>`<article class="card"><h3>${x}</h3><p>温和提醒，尊重家庭成员边界，只处理授权信息。</p></article>`).join('')}</div></section>`;
}
async function executivePage() {
  const e = await loadDemo('executive-brief.json');
  app.innerHTML = `<section class="section"><h2>${e.title}</h2><p class="lead">面向老板、管理者、MBA/企业管理者和安全负责人的一页式管理简报。</p><div class="grid cols-2"><article class="card"><h3>当前暴露面总览</h3><div class="score-ring" style="--score:${e.score}"><strong>${e.score}</strong></div><p>${e.trustImpact}</p></article><article class="card"><h3>资源投入优先级</h3>${e.resourcePriority.map(x=>`<div class="notice-item"><b>优先</b><span>${x}</span></div>`).join('')}</article></div><article class="card section"><h3>主要风险来自哪里</h3>${e.mainRisks.map(x=>`<span class="badge high">${x}</span>`).join(' ')}</article></section>`;
}
function watchlistPage() {
  let stored = [];
  try { stored = JSON.parse(localStorage.getItem('oyb-watchlist') || '[]'); } catch {}
  app.innerHTML = `<section class="section"><h2>Watchlist｜持续监测清单</h2>${demoBanner('默认不自动扫描真实目标。添加清单只保存在当前浏览器，用于演示授权范围管理。')}<form class="card form" id="watch-form"><div class="form-row"><label>资产类型<select id="watch-type"><option>domain</option><option>github_org</option><option>email</option><option>ip</option><option>vendor_domain</option></select></label><label>资产值<input id="watch-value" placeholder="example.com" /></label></div><button class="btn primary">加入 Watchlist</button></form><div id="watch-list" class="grid section"></div></section>`;
  const render = () => { $('#watch-list').innerHTML = stored.concat([{type:'domain', value:'example.com', mode:'demo'}]).map((x,i)=>`<article class="card"><span class="badge">${x.mode || 'local'}</span><h3>${x.type}</h3><p>${escapeHtml(x.value)}</p><small>真实复查需私有环境配置授权清单与 Secret。</small></article>`).join(''); };
  render();
  $('#watch-form').addEventListener('submit', (e) => { e.preventDefault(); stored.push({ type: $('#watch-type').value, value: $('#watch-value').value, mode:'local-list-only' }); localStorage.setItem('oyb-watchlist', JSON.stringify(stored)); render(); });
}
function vendorPage() {
  app.innerHTML = `<section class="section"><h2>Vendor Snapshot｜供应商公开暴露快照</h2><p class="lead">用于企业合作前的授权或公开信息尽调。它不是商业诋毁工具，不给“好/坏公司”结论，只给公开暴露信号和复核建议。</p><div class="card form"><label>供应商官网域名<input placeholder="vendor.example.com" /></label><label class="check-row"><input type="checkbox" /><span>我确认本次仅做授权或公开信息复核，不作商业诋毁或传播。</span></label><button class="btn primary">生成 Demo 快照</button></div></section>`;
}
function privacyPage() {
  app.innerHTML = `<section class="section"><h2>隐私政策</h2><div class="card"><p>Open Your Box 默认不保存原始扫描结果。Demo 数据不包含真实个人或真实公司。报告导入默认在浏览器本地解析。敏感值会进行遮蔽，例如 d***@example.com、203.0.113.*。</p><p>如果用户未来主动保存报告，应只保存脱敏摘要、风险分、任务状态和复查时间，不保存明文凭证、完整泄露数据或敏感 banner。</p></div></section>`;
}

const routes = {
  '/': homePage,
  '/personal/': personalPage,
  '/organization/': organizationPage,
  '/tools/': toolsPage,
  '/risk-model/': riskPage,
  '/report/': reportPage,
  '/safety/': safetyPage,
  '/method/': methodPage,
  '/passport/': passportPage,
  '/company-card/': companyCardPage,
  '/map/': mapPage,
  '/diff/': diffPage,
  '/developer-kit/': developerKitPage,
  '/family-safety/': familyPage,
  '/executive-brief/': executivePage,
  '/watchlist/': watchlistPage,
  '/vendor-snapshot/': vendorPage,
  '/privacy/': privacyPage
};

async function init() {
  try {
    [state.tools, state.risks, state.personal, state.organization] = await Promise.all([
      fetchJson('data/tool-matrix.json'), fetchJson('data/risk-model.json'), fetchJson('data/personal-exposure.json'), fetchJson('data/organization-exposure.json')
    ]);
    const page = routes[route()] || homePage;
    await page();
    hydrateLinks();
    $('.nav-toggle')?.addEventListener('click', () => $('.site-nav')?.classList.toggle('open'));
  } catch (error) {
    app.innerHTML = `<section class="section card"><h2>加载失败</h2><p>${escapeHtml(error.message)}</p></section>`;
  }
}

init();
