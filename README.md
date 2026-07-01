# Open Your Box

先打开自己的盒子，再决定如何关上它。

Open Your Box 是一个防御型 OSINT 工作台，用于个人隐私自查、组织公开暴露面管理、安全教育和授权尽调。它把 Blackbird、Maigret、SpiderFoot、theHarvester、Shodan 等工具的思路整合为一个可读、可行动、可持续复查的暴露面管理站点。

> 英文定位：Personal & Organizational Exposure Intelligence Platform  
> 中文定位：个人隐私自查与组织暴露面管理工作台

## 为什么叫 Open Your Box

“打开自己的盒子”不是鼓励窥探别人，而是提醒个人和组织：公开互联网中散落着账号、邮箱、域名、子域名、IP、设备、代码仓库、泄露事件和公开资产线索。先把自己的暴露面看清楚，再整理它、关上它，并建立复查节奏。

## 防御型 OSINT 是什么

防御型 OSINT 只围绕本人、自有资产或明确授权资产进行公开线索整理。它的价值不在于展示原始情报，而在于把公开线索转化为风险等级、证据类型、影响解释、修复优先级和复查建议。

## 项目不做什么

项目不做侵犯隐私、骚扰、社工、钓鱼、撞库、漏洞利用、默认密码尝试、攻击路径生成、暗网样本展示、泄露明文保存和人物画像推断。

## 安全边界

允许：查自己、查自有域名、查自有 IP、查授权企业资产、查自己管理的 GitHub 仓库、做供应商公开暴露面尽调、做安全教育演示、做 Demo 数据模拟。

禁止：查陌生人、查私人关系对象、人肉搜索、披露他人身份、暴露他人隐私、社工、钓鱼、撞库、尝试默认密码、利用漏洞、批量骚扰、出售或传播结果。

## 功能列表

- 首页：产品定位、双入口、工具矩阵、方法论、安全边界。
- 个人自查：账号足迹快照、邮箱暴露检查、开发者足迹检查、清理建议生成器。
- 个人账号注销清理：覆盖 100 个主流平台/账号体系，按“找回入口—数据导出—注销入口—注销前提醒”生成本人账号清理计划。
- 组织自查：域名与子域名梳理、公开邮箱脱敏、公网服务暴露检查、代码仓库泄露检查、供应链与技术栈识别。
- 工具矩阵：58 个防御型工具、数据源与分析模块。
- 风险评分模型：0—100 总分和可解释加权模型。
- 报告页：JSON、Markdown、HTML、浏览器打印/PDF、管理层摘要、技术修复清单思路。
- 数字暴露护照：个人账号、邮箱、旧账号、公开资料、开发者足迹和清理任务。
- 组织暴露面名片：域名、子域名、公开邮箱、公网服务、端口类型、技术栈、代码仓库提醒。
- 数字影子地图：邮箱 → 账号 → 仓库 → 域名 → 子域名 → IP → 服务 → 风险。
- Exposure Diff：比较两次报告的新增、修复和仍未处理风险。
- Watchlist：持续监测清单，默认只做本地演示和授权范围管理。
- Developer Self-Defense Kit：面向独立开发者、创业者和开源维护者。
- Family Safety Mode：家庭数字安全教育，不监控家人。
- Executive Brief：管理层一页式暴露简报。

## 五个核心工具说明

1. **Blackbird｜账号足迹快照**：本人用户名/邮箱公开账号痕迹初筛，用于找回旧账号和降低账号复用风险。
2. **Maigret｜用户名深度复核**：本人或授权用户名多平台公开存在性复核，递归扩展默认关闭。
3. **SpiderFoot｜暴露面关联分析**：邮箱、域名、IP、主机名的模块化公开线索聚合；不展示泄露明文。
4. **theHarvester｜组织公开资产梳理**：自有或授权域名维度的公开邮箱格式、子域名、主机和 IP 梳理；邮箱默认脱敏。
5. **Shodan｜公网设备暴露检查**：通过 `SHODAN_API_KEY` 在本地或私有服务端查询授权 IP/域名解析 IP 的公网服务摘要；不输出攻击路径。

## 个人账号注销清理模式

项目新增 `data/personal-account-platform-catalog.json`，用于后期实名上线后的本人账号足迹清理。当前目录覆盖 100 个平台/账号体系，包括微信、QQ、微博、抖音、快手、小红书、Bilibili、知乎、豆瓣、百度、网易、Google、Apple、Microsoft、Facebook、Instagram、Threads、X、LinkedIn、TikTok、Reddit、Telegram、WhatsApp、Discord、GitHub、GitLab、Gitee、Stack Overflow、npm、Docker Hub、Hugging Face、淘宝、支付宝、京东、拼多多、美团、携程、Steam、Spotify、Tinder、Soul 等。

该模式不把“所有信息”理解为隐私明文抓取，而是拆成账号治理字段：账号存在性线索、登录/找回入口、数据导出入口、注销/停用入口、依赖影响和清理任务。详细设计见 `docs/personal-account-cleanup-mode.md`。

本地生成账号注销清理计划：

```bash
node scripts/generate-account-cleanup-plan.mjs

# 导入本人 Blackbird / Maigret / OAuth 结果后的用法
node scripts/generate-account-cleanup-plan.mjs --findings reports/personal/findings.json
```

## 扩展工具矩阵

工具矩阵覆盖 8 个能力域：个人账号足迹自查、邮箱与泄露事件自查、域名与子域名资产发现、公网设备与服务暴露检查、代码仓库与密钥泄露检查、云资产与 SaaS 配置暴露检查、威胁情报与风险富集、报告/可视化/持续监测。站点中的 `/tools/` 页面展示完整字段：工具名称、能力域、输入类型、输出类型、API Key、默认启用、Demo-only、适用对象、风险边界和推荐执行位置。

## 本地开发命令

```bash
git clone https://github.com/siner9586/open_your_box.git
cd open_your_box
npm install
npm run dev
```

本项目当前生产线使用 Cloudflare Pages Functions + D1。静态页面仍由 `scripts/build-site.mjs` 生成，API 负责异步任务、实名/授权、隐私请求、管理员审核和健康检查。

## 生产部署

生产默认必须保持：

- `ENABLE_PHONE_DEEP_SCAN=false`
- `IDENTITY_PROVIDER_MODE=manual`
- `ALLOW_DEV_LOGIN=false`

部署命令：

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run db:migrate:remote
npx wrangler pages deploy dist --project-name open-your-box
BASE_URL=<PRODUCTION_URL> RUN_PENDING_TOKEN=<CRON_SECRET> npm run smoke
BASE_URL=<PRODUCTION_URL> ADMIN_TOKEN=<ADMIN_TOKEN> npm run smoke:identity
```

D1 binding 名称必须是 `DB`，数据库名为 `open-your-box-db`。Secret 只通过 Cloudflare 交互式命令或控制台配置，不写入仓库：

```bash
npx wrangler secret put SCAN_SALT
npx wrangler secret put CRON_SECRET
npx wrangler secret put ADMIN_TOKEN
```

Cloudflare 控制台路径：Workers & Pages → open-your-box → Settings → Environment variables。D1 绑定路径：Workers & Pages → open-your-box → Settings → Functions → D1 database bindings → Add binding → Variable name `DB` → D1 database `open-your-box-db`。

## 实名认证与授权闭环

生产默认使用人工审核 provider。实名认证只保存 salted hash、masked subject 和 provider/manual review reference，不保存身份证号、真实姓名或手机号明文。未实名用户不能执行手机号深度扫描。

手机号归属验证同样只保存 `phone_hash` 和 `phone_masked`。manual provider 会创建 `identity_verifications` pending 记录和 `admin_review_queue` 项，管理员 approve 后才会把对应 verification 更新为 `verified`。

授权通过 `consent_records` 记录，可在 `/consent/` 授予或撤销，在 `/privacy-center/` 创建导出、删除、匿名化请求。管理员审核页面 `/admin/reviews/` 必须提供 `ADMIN_TOKEN`，只展示 masked 和 evidence/ref。

## 手机号深度扫描安全边界

手机号深度扫描默认关闭。即使未来开启，也必须同时满足：

- `ENABLE_PHONE_DEEP_SCAN=true`
- 用户 `real_name` verified
- 目标手机号归属 `phone_ownership` verified
- `phone_deep_scan` consent granted
- rate limit 通过
- audit log 已写入
- target `phone_hash` 与已验证手机号 hash 一致

当前第一版只提供 gating 和 limited skeleton result，不做大规模平台撞库、不做验证码绕过、不做登录态检测、不查询他人隐私。

## 线上变量

Variables：

- `ENABLE_PHONE_DEEP_SCAN=false`
- `ENABLE_DEMO_ADAPTERS=true`
- `MAX_TARGETS_PER_JOB=10`
- `MAX_ITEMS_PER_RUN=25`
- `MAX_SUBMISSIONS_PER_HOUR=20`
- `IDENTITY_PROVIDER_MODE=manual`
- `ALLOW_DEV_LOGIN=false`
- `PHONE_VERIFICATION_CODE_TTL_SECONDS=600`
- `MAX_PHONE_VERIFY_ATTEMPTS=5`
- `DATA_RETENTION_DAYS=30`

Required Secrets：`SCAN_SALT`、`CRON_SECRET`、`ADMIN_TOKEN`。

Optional Secrets：`SHODAN_API_KEY`、`HIBP_API_KEY`、`VIRUSTOTAL_API_KEY`、`GITHUB_TOKEN`、`IDENTITY_PROVIDER_API_KEY`。

接入真实实名供应商前必须完成合同、隐私政策、数据处理协议和合规评估。缺少 `IDENTITY_PROVIDER_API_KEY` 时 external provider skeleton 只返回 pending/skipped。

## 环境变量

复制 `.env.example` 为 `.env.local`，只在本地或私有部署环境填写 Secret。不要把真实 Key 写入前端、README、日志或提交记录。

## Demo Mode

公共站点默认进入 Demo Mode，只使用 `data/` 和 `lib/demo/` 中的模拟数据。Demo 数据使用 `example.com`、`demo_user`、`d***@example.com`、`203.0.113.10`、`198.51.100.22`、`192.0.2.15` 等保留示例，不指向真实个人或真实公司。

## 本地 CLI 模式

站点会生成本地命令，但不在公共前端执行真实扫描：

```bash
# 用户名自查，限本人或授权
maigret demo_user --json report-maigret.json

# 自有域名授权检查
theHarvester -d example.com -b bing,crtsh -f report-theharvester

# Shodan 自有 IP 查询
export SHODAN_API_KEY="在本地填入你的 Shodan Key"
npm run scan:shodan -- --ip 203.0.113.10 --authorized --out report-shodan.json
```

## GitHub Actions 模式

工作流包括：

- `ci.yml`：lint、typecheck、test、build。
- `pages.yml`：构建并部署到 GitHub Pages。
- `demo-report.yml`：每周生成 Demo 暴露面报告，不扫描真实目标。
- `secret-scan.yml`：使用 Gitleaks 检查仓库是否误提交密钥。
- `lighthouse.yml`：部署 URL 未确定前先执行 Lighthouse dry checks。
- `playwright.yml`：执行核心页面静态 smoke 测试；后续可接入真正 Playwright 浏览器测试。

## Shodan API 配置

只允许通过环境变量或 GitHub Secret 使用：

```bash
export SHODAN_API_KEY="在本地填入你的 Shodan Key"
npm run scan:shodan -- --ip 203.0.113.10 --authorized --out report-shodan.json
```

GitHub Secret：

```bash
gh secret set SHODAN_API_KEY -R siner9586/open_your_box
```

`docs/shodan-setup.md` 只说明配置方式，不包含真实 Key。

## 报告导入模式

报告页支持粘贴脱敏 JSON 报告并在浏览器本地解析。默认不上传、不保存、不发送原始扫描结果。

## 自部署真实扫描方式

真实扫描只能在以下位置运行：本地机器、自部署服务器、私有 GitHub Actions、Cloudflare Worker with Secret、企业内部 Runner。公共演示站不直接扫描真实第三方目标。

## 合规使用声明

使用者必须确认目标属于本人、自有资产或已获得明确授权。任何对他人隐私、身份、关系、住址、凭证、账号安全造成损害的使用方式都不被接受。

## 隐私保护设计

- 默认不保存原始扫描结果。
- Demo 数据不包含真实个人或公司。
- 报告导入默认本地解析。
- 邮箱、IP、凭证、banner、泄露信号均以脱敏摘要呈现。
- 第三方 API 调用只允许在服务端或本地环境中通过 Secret 完成。

## 数据脱敏规则

- 邮箱：`d***@example.com`
- IP：`203.0.113.*`
- Token：只显示前后极短片段，默认不保存明文。
- Banner：不保存原始 banner，只保留服务名、端口、产品名、版本摘要和修复建议。

## 风险评分模型

总风险分 = 账号复用风险 × 0.12 + 邮箱泄露风险 × 0.14 + 公开资料过量风险 × 0.08 + 域名暴露风险 × 0.12 + 子域名遗留风险 × 0.08 + 公网服务暴露风险 × 0.16 + 代码密钥泄露风险 × 0.14 + 云配置暴露风险 × 0.08 + 威胁情报命中风险 × 0.04 + 治理闭环缺口 × 0.04。

## 路线图

1. 接入 Censys / GreyNoise / VirusTotal。
2. 增加自部署 Worker。
3. 增加企业资产 CSV 导入。
4. 增加周期性授权复查。
5. 增加 PDF 专业报告模板。
6. 增加管理层一页式简报模板。
7. 增加 Watchlist 真实授权扫描。
8. 增加供应商公开暴露快照。
9. 增加 `/account-cleanup/` 页面，接入 100 平台账号注销清理目录。
10. 增加实名后“本人标识验证—平台查询—导出—注销—复查”闭环。

## License

MIT
