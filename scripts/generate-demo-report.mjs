import { mkdir, readFile, writeFile } from 'node:fs/promises';
const org = JSON.parse(await readFile('data/organization-exposure.json', 'utf8'));
const lines = [
  '# Open Your Box Demo Report',
  '',
  `生成时间：${new Date().toISOString()}`,
  '',
  `授权范围：${org.authorizedScope}`,
  '',
  `总分：${org.totalScore}（${org.level}）`,
  '',
  '## 摘要',
  '',
  org.summary,
  '',
  '## 7 天行动清单',
  '',
  ...org.tasks.map(t => `- [ ] ${t.title}：${t.steps.join('；')}。`),
  '',
  '## 安全边界',
  '',
  '该报告只使用 Demo 数据，不扫描真实目标，不保存敏感明文。'
];
await mkdir('reports/demo', { recursive: true });
await writeFile('reports/demo/latest-demo-report.md', lines.join('\n'));
console.log('Generated reports/demo/latest-demo-report.md');
