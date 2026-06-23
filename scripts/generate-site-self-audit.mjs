import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DEFAULT_SITE = 'https://open-your-box.pages.dev';
const SITE_URL = process.env.OYB_SITE_URL || DEFAULT_SITE;
const EXTRA_ALLOWED_HOSTS = (process.env.OYB_ALLOWED_SITE_HOSTS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const allowedHosts = new Set(['open-your-box.pages.dev', ...EXTRA_ALLOWED_HOSTS]);
const parsedSite = new URL(SITE_URL);
if (!allowedHosts.has(parsedSite.host)) {
  throw new Error(`Refusing to audit unapproved host: ${parsedSite.host}. Set OYB_ALLOWED_SITE_HOSTS only for owned or explicitly authorized sites.`);
}

const startedAt = new Date();
const routes = ['/', '/personal/', '/organization/', '/tools/', '/risk-model/', '/report/', '/safety/', '/method/'];
const repoRoot = process.cwd();
const skipDirs = new Set(['.git', 'node_modules', 'dist', '.next', '.cache']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (skipDirs.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function shortHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
}

function titleOf(html) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim().replace(/\s+/g, ' ') : '';
}

async function checkRoute(pathname) {
  const url = new URL(pathname, SITE_URL).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    const text = await response.text();
    return {
      path: pathname,
      url,
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      server: response.headers.get('server') || '',
      cacheControl: response.headers.get('cache-control') || '',
      securityHeaders: {
        contentSecurityPolicy: Boolean(response.headers.get('content-security-policy')),
        referrerPolicy: Boolean(response.headers.get('referrer-policy')),
        xContentTypeOptions: Boolean(response.headers.get('x-content-type-options')),
        xFrameOptions: Boolean(response.headers.get('x-frame-options')),
        permissionsPolicy: Boolean(response.headers.get('permissions-policy'))
      },
      title: titleOf(text),
      pageBytes: text.length,
      contentFingerprint: shortHash(text),
      hasSafetyBoundary: /安全边界|明确授权|本人|自有资产|授权资产/.test(text),
      hasDemoMode: /Demo Mode|Demo|模拟数据|演示数据/.test(text),
      hasReportEntry: /报告|风险评分|Exposure|暴露面/.test(text)
    };
  } catch (error) {
    return {
      path: pathname,
      url,
      ok: false,
      status: 0,
      error: error.name || 'FetchError'
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function inspectRepo() {
  const files = await walk(repoRoot);
  const relFiles = files.map((file) => relative(repoRoot, file));
  const workflowFiles = relFiles.filter((file) => file.startsWith('.github/workflows/') && file.endsWith('.yml')).sort();
  const importantFiles = ['README.md', 'SECURITY.md', 'PRIVACY.md', '.env.example', 'package.json', 'scripts/run-shodan.py'];
  const importantStatus = {};
  for (const file of importantFiles) importantStatus[file] = await exists(join(repoRoot, file));

  const riskyPatterns = [
    { name: 'plain_env_assignment', re: /(?:API_KEY|TOKEN|SECRET|PASSWORD)\s*=\s*['\"]?[A-Za-z0-9_\-]{16,}/i },
    { name: 'private_key_marker', re: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
    { name: 'cloudflare_token_like', re: /(?:CF_API_TOKEN|CLOUDFLARE_API_TOKEN)\s*=\s*['\"]?[A-Za-z0-9_\-]{20,}/i }
  ];
  const findings = [];
  for (const file of files) {
    const rel = relative(repoRoot, file);
    if (/\.(png|jpg|jpeg|gif|webp|ico|pdf|zip)$/i.test(rel)) continue;
    const content = await readFile(file, 'utf8').catch(() => '');
    if (!content) continue;
    for (const pattern of riskyPatterns) {
      if (pattern.re.test(content)) findings.push({ file: rel, type: pattern.name });
    }
  }

  const readme = await readFile(join(repoRoot, 'README.md'), 'utf8').catch(() => '');
  const security = await readFile(join(repoRoot, 'SECURITY.md'), 'utf8').catch(() => '');
  const privacy = await readFile(join(repoRoot, 'PRIVACY.md'), 'utf8').catch(() => '');

  return {
    fileCount: relFiles.length,
    workflowFiles,
    importantStatus,
    secretHygiene: {
      checkedTextFiles: relFiles.length,
      suspiciousPatternCount: findings.length,
      suspiciousPatternFiles: [...new Set(findings.map((item) => item.file))].sort()
    },
    safetyDocs: {
      readmeHasDefensiveScope: /防御型|本人|自有资产|明确授权/.test(readme),
      securityHasBoundary: /禁止|授权|隐私|漏洞利用|社工/.test(security),
      privacyHasLocalParsing: /本地|不上传|不保存|脱敏/.test(privacy)
    }
  };
}

function grade({ routeResults, repo }) {
  const failedRoutes = routeResults.filter((item) => !item.ok).length;
  const missingSafety = routeResults.filter((item) => item.ok && !item.hasSafetyBoundary).length;
  const missingHeaders = routeResults.reduce((sum, item) => {
    if (!item.ok || !item.securityHeaders) return sum;
    return sum + Object.values(item.securityHeaders).filter((value) => !value).length;
  }, 0);
  const suspicious = repo.secretHygiene.suspiciousPatternCount;
  const missingDocs = Object.values(repo.safetyDocs).filter((value) => !value).length;
  const score = Math.max(0, 100 - failedRoutes * 12 - missingSafety * 6 - missingHeaders * 2 - suspicious * 10 - missingDocs * 8);
  const level = score >= 90 ? 'low' : score >= 75 ? 'medium' : 'high';
  return { score, level, failedRoutes, missingSafety, missingHeaders, suspicious, missingDocs };
}

function mdReport(payload) {
  const lines = [
    '# Open Your Box Real Self Audit',
    '',
    `生成时间：${payload.generatedAt}`,
    '',
    `审计对象：${payload.scope.site}`,
    '',
    `授权范围：仅限本项目线上站点、当前 GitHub 仓库和仓库内公开配置；不检查陌生个人、第三方资产或未授权目标。`,
    '',
    `总分：${payload.grade.score}（${payload.grade.level}）`,
    '',
    '## 真实检查结果',
    '',
    `- 页面检查：${payload.routes.length} 个路由，失败 ${payload.grade.failedRoutes} 个。`,
    `- 安全文本：${payload.grade.missingSafety === 0 ? '主要页面均可见安全/授权边界' : `${payload.grade.missingSafety} 个页面缺少明显安全/授权边界`}。`,
    `- 响应头：缺失项合计 ${payload.grade.missingHeaders} 个，建议在 Cloudflare Pages 增加统一安全头。`,
    `- 仓库文件：检查 ${payload.repo.fileCount} 个文件；工作流 ${payload.repo.workflowFiles.length} 个。`,
    `- 密钥卫生：可疑明文模式 ${payload.repo.secretHygiene.suspiciousPatternCount} 处；本报告不输出任何疑似密钥原文。`,
    '',
    '## 路由明细',
    '',
    '| 路由 | 状态 | 标题 | 安全边界 | Demo 标识 | 指纹 |',
    '|---|---:|---|---|---|---|',
    ...payload.routes.map((item) => `| ${item.path} | ${item.status || 0} | ${item.title || '-'} | ${item.hasSafetyBoundary ? '是' : '否'} | ${item.hasDemoMode ? '是' : '否'} | ${item.contentFingerprint || '-'} |`),
    '',
    '## 仓库配置',
    '',
    ...Object.entries(payload.repo.importantStatus).map(([file, ok]) => `- ${ok ? '✅' : '⚠️'} ${file}`),
    '',
    '## 工作流',
    '',
    ...payload.repo.workflowFiles.map((file) => `- ${file}`),
    '',
    '## 修复优先级',
    '',
    '1. 给 Cloudflare Pages 增加 `_headers`，补齐 Content-Security-Policy、Referrer-Policy、X-Content-Type-Options、X-Frame-Options 和 Permissions-Policy。',
    '2. 保持公共站 Demo Mode；真实授权检查只在本地、私有 Actions、企业 Runner 或带 Secret 的自部署服务中执行。',
    '3. 每次报告只保存摘要、风险等级、修复建议和脱敏证据，不保存原始响应正文、敏感 banner 或凭证。',
    '4. 若后续接入授权 IP/域名检查，应先用仓库变量维护授权清单，并在报告中记录授权依据。',
    '',
    '## 安全边界',
    '',
    '本报告用于项目自查与上线验收，不用于识别、追踪、画像或披露任何第三方个人信息。'
  ];
  return lines.join('\n');
}

const routeResults = [];
for (const route of routes) routeResults.push(await checkRoute(route));
const repo = await inspectRepo();
const payload = {
  generatedAt: startedAt.toISOString(),
  scope: { site: SITE_URL, repository: process.env.GITHUB_REPOSITORY || 'local' },
  routes: routeResults,
  repo,
  grade: null
};
payload.grade = grade({ routeResults, repo });

await mkdir('reports/real', { recursive: true });
await writeFile('reports/real/latest-self-audit.json', `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await writeFile('reports/real/latest-self-audit.md', mdReport(payload), 'utf8');
console.log(`Generated reports/real/latest-self-audit.md with score ${payload.grade.score}`);
