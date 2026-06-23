import { mkdir, readFile, writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const getArg = (name, fallback = '') => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const catalogPath = getArg('--catalog', 'data/personal-account-platform-catalog.json');
const findingsPath = getArg('--findings', '');
const outPath = getArg('--out', 'reports/personal/latest-account-cleanup.md');

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
let findings = [];
if (findingsPath) {
  findings = JSON.parse(await readFile(findingsPath, 'utf8'));
}

const byId = new Map(catalog.platforms.map((platform) => [platform.id, platform]));
const normalizeFinding = (finding) => {
  const platformId = finding.platformId || finding.platform || finding.id;
  const platform = byId.get(platformId);
  if (!platform) return null;
  return {
    platform,
    status: finding.status || 'possible',
    confidence: Number(finding.confidence ?? 0.5),
    matchedIdentifierType: finding.identifierType || finding.inputType || 'self_provided',
    evidenceSummary: finding.evidenceSummary || finding.summary || '用户本人输入或本地工具报告提示需复核。'
  };
};

const normalizedFindings = findings.map(normalizeFinding).filter(Boolean);
const topPlatforms = normalizedFindings.length
  ? normalizedFindings.sort((a, b) => b.confidence - a.confidence)
  : catalog.platforms.slice(0, 30).map((platform) => ({
      platform,
      status: 'catalog_only',
      confidence: 0,
      matchedIdentifierType: platform.identifiers.join('/'),
      evidenceSummary: '当前未导入本人真实扫描结果，仅作为覆盖平台与注销入口清单。'
    }));

const categoryCounts = catalog.platforms.reduce((acc, platform) => {
  acc[platform.category] = (acc[platform.category] || 0) + 1;
  return acc;
}, {});

const lines = [
  '# Open Your Box｜个人账号注销清理计划',
  '',
  `生成时间：${new Date().toISOString()}`,
  '',
  `平台目录版本：${catalog.version}`,
  '',
  `覆盖平台：${catalog.platformCount} 个`,
  '',
  '## 适用范围',
  '',
  '本计划用于实名后本人账号足迹整理、登录找回、数据导出、解绑与注销。每个查询标识必须属于当前用户本人，并完成手机号、邮箱、OAuth 或实名状态验证。',
  '',
  '## 覆盖类别',
  '',
  ...Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).map(([category, count]) => `- ${category}：${count} 个平台`),
  '',
  '## 本轮账号清理任务',
  '',
  '| 平台 | 状态 | 置信度 | 找回入口 | 数据导出 | 注销入口 | 注销前提醒 |',
  '|---|---|---:|---|---|---|---|',
  ...topPlatforms.map(({ platform, status, confidence }) => `| ${platform.name} | ${status} | ${confidence.toFixed(2)} | ${platform.recoveryEntry} | ${platform.dataExportEntry} | ${platform.deletionEntry} | ${platform.cleanupNote} |`),
  '',
  '## 标准闭环',
  '',
  '1. 确认该账号是否属于本人。',
  '2. 找回或登录账号。',
  '3. 下载或导出个人数据。',
  '4. 取消订阅、解绑支付、迁移资产、转移管理员权限。',
  '5. 删除或隐藏公开内容。',
  '6. 提交停用、注销或删除申请。',
  '7. 记录冷静期和复查日期。',
  '8. 冷静期后确认账号是否仍可登录、是否仍被搜索引擎收录。',
  '',
  '## 后续接入方式',
  '',
  '导入 Blackbird、Maigret 或官方 OAuth/平台 API 产生的本人查询结果时，请统一转换成：',
  '',
  '```json',
  '[{"platformId":"github","status":"likely","confidence":0.86,"identifierType":"username","evidenceSummary":"本人用户名命中公开主页"}]',
  '```',
  '',
  '然后执行：',
  '',
  '```bash',
  'node scripts/generate-account-cleanup-plan.mjs --findings reports/personal/findings.json',
  '```',
  '',
  '## 保存原则',
  '',
  '只保存平台、状态、置信度、任务状态、时间戳和用户可见链接；不要保存密码、验证码、身份证图像、原始泄露样本、完整敏感证据或第三方隐私。'
];

await mkdir(outPath.split('/').slice(0, -1).join('/'), { recursive: true });
await writeFile(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Generated ${outPath}`);
