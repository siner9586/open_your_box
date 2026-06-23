# Open Your Box Real Self Audit

生成时间：2026-06-23T14:53:28.230Z

审计对象：https://open-your-box.pages.dev

授权范围：仅限本项目线上站点、当前 GitHub 仓库和仓库内公开配置；不检查陌生个人、第三方资产或未授权目标。

总分：42（high）

## 真实检查结果

- 页面检查：8 个路由，失败 0 个。
- 安全文本：主要页面均可见安全/授权边界。
- 响应头：缺失项合计 24 个，建议在 Cloudflare Pages 增加统一安全头。
- 仓库文件：检查 56 个文件；工作流 7 个。
- 密钥卫生：可疑明文模式 1 处；本报告不输出任何疑似密钥原文。

## 路由明细

| 路由 | 状态 | 标题 | 安全边界 | Demo 标识 | 指纹 |
|---|---:|---|---|---|---|
| / | 200 | Open Your Box｜打开自己的盒子 | 是 | 否 | 5efc25ae |
| /personal/ | 200 | Open Your Box｜打开自己的盒子 | 是 | 否 | 3afd7614 |
| /organization/ | 200 | Open Your Box｜打开自己的盒子 | 是 | 否 | 3afd7614 |
| /tools/ | 200 | Open Your Box｜打开自己的盒子 | 是 | 否 | 3afd7614 |
| /risk-model/ | 200 | Open Your Box｜打开自己的盒子 | 是 | 否 | 3afd7614 |
| /report/ | 200 | Open Your Box｜打开自己的盒子 | 是 | 否 | 3afd7614 |
| /safety/ | 200 | Open Your Box｜打开自己的盒子 | 是 | 否 | 3afd7614 |
| /method/ | 200 | Open Your Box｜打开自己的盒子 | 是 | 否 | 3afd7614 |

## 仓库配置

- ✅ README.md
- ✅ SECURITY.md
- ✅ PRIVACY.md
- ✅ .env.example
- ✅ package.json
- ✅ scripts/run-shodan.py

## 工作流

- .github/workflows/ci.yml
- .github/workflows/demo-report.yml
- .github/workflows/lighthouse.yml
- .github/workflows/pages.yml
- .github/workflows/playwright.yml
- .github/workflows/real-self-audit.yml
- .github/workflows/secret-scan.yml

## 修复优先级

1. 给 Cloudflare Pages 增加 `_headers`，补齐 Content-Security-Policy、Referrer-Policy、X-Content-Type-Options、X-Frame-Options 和 Permissions-Policy。
2. 保持公共站 Demo Mode；真实授权检查只在本地、私有 Actions、企业 Runner 或带 Secret 的自部署服务中执行。
3. 每次报告只保存摘要、风险等级、修复建议和脱敏证据，不保存原始响应正文、敏感 banner 或凭证。
4. 若后续接入授权 IP/域名检查，应先用仓库变量维护授权清单，并在报告中记录授权依据。

## 安全边界

本报告用于项目自查与上线验收，不用于识别、追踪、画像或披露任何第三方个人信息。