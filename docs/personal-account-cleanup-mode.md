# Personal Account Cleanup Mode｜个人账号足迹清理模式

## 1. 产品定位

Open Your Box 后续实名上线时，个人端的核心目标不是“开盒别人”，而是：

> 每个用户实名或强验证登录后，只能查询、整理、找回、导出和注销自己的账号足迹。

产品最终应形成一条闭环：

```text
本人登录/实名验证 → 绑定本人手机号/邮箱/用户名 → 平台覆盖查询 → 账号可能性分级 → 登录找回 → 数据导出 → 注销/解绑 → 复查确认
```

## 2. “所有信息”的产品定义

这里的“所有信息”不应理解为抓取个人隐私明文，而应拆成可管理、可验证、可注销的账号治理字段：

1. 账号存在性线索：该手机号、邮箱、用户名、昵称、UID、主页 URL 是否可能与某个平台账号有关。
2. 登录/找回入口：用户如何找回或进入对应平台账号。
3. 数据导出入口：删除前如何下载账号资料、内容、相册、视频、订单、消息、创作数据等。
4. 注销/停用入口：如何进入官方账号关闭、停用、注销、删除或解绑入口。
5. 依赖影响：删除前是否会影响邮箱、支付、订阅、游戏资产、店铺、云盘、作品、开发者项目、域名、组织权限等。
6. 清理任务：改密码、开 MFA、取消订阅、导出数据、迁移资产、删除公开资料、注销账号、复查搜索结果。

## 3. 当前已落地文件

新增数据文件：

```text
data/personal-account-platform-catalog.json
```

当前覆盖 100 个平台/账号体系，按以下类别组织：

- 全球基础账号：Google、Apple、Microsoft、Amazon、Adobe 等。
- 全球社交：Facebook、Instagram、Threads、X、LinkedIn、Reddit、Pinterest、Tumblr、Mastodon 等。
- 即时通信与社群：Telegram、WhatsApp、Signal、Discord、Slack 等。
- 中国社交与内容：微信、QQ、QQ 空间、微博、抖音、快手、小红书、Bilibili、知乎、豆瓣、贴吧、百度、网易、新浪、搜狐、今日头条、西瓜视频、百家号、微信公众号/视频号等。
- 开发者与代码平台：GitHub、GitLab、Gitee、Bitbucket、Stack Overflow、npm、Docker Hub、Hugging Face、Kaggle、Replit、Vercel、Netlify、Cloudflare 等。
- 博客与知识社区：Medium、WordPress、Substack、Notion、语雀、简书、CSDN、博客园、掘金、SegmentFault、Quora、Goodreads 等。
- 视频、音乐、游戏：YouTube、Twitch、Spotify、网易云音乐、QQ 音乐、Steam、Epic、PlayStation、Xbox、Nintendo 等。
- 电商、本地生活与旅行：淘宝/天猫、支付宝、京东、拼多多、美团、大众点评、饿了么、携程、飞猪、Airbnb 等。
- 工作、设计与创作者工具：Zoom、Teams、Trello、Canva、Figma、Dribbble、Behance 等。
- 金融与约会类账号：PayPal、Wise、Venmo、Tinder、Bumble、探探、Soul 等。

## 4. 字段说明

每个平台使用统一结构：

```json
{
  "id": "x",
  "name": "X / Twitter",
  "category": "social_network",
  "region": "global",
  "identifiers": ["email", "phone", "username"],
  "recoveryEntry": "https://x.com/account/begin_password_reset",
  "dataExportEntry": "https://x.com/settings/download_your_data",
  "deletionEntry": "https://x.com/settings/deactivate",
  "cleanupNote": "先下载 X 数据，停用后 30 天未登录才进入删除。",
  "executionPolicy": "self_verified_user_only",
  "automationLevel": "manual_or_official_flow_first"
}
```

字段含义：

- `identifiers`：该平台通常可能用哪些本人标识找回或识别账号。
- `recoveryEntry`：登录、找回、重置密码、账号恢复入口。
- `dataExportEntry`：数据导出、隐私中心、下载个人资料入口。
- `deletionEntry`：注销、停用、关闭账号入口。
- `cleanupNote`：删除前必须提醒用户处理的关键依赖。
- `executionPolicy`：默认只允许已验证本人查询。
- `automationLevel`：优先使用官方流程，避免黑箱抓取。

## 5. 后续真实查询模式

### 5.1 匿名 Demo 模式

公共站点只展示 Demo、平台覆盖清单和注销路线图。

### 5.2 登录自查模式

用户登录后，可以填写或绑定：

- 本人手机号；
- 本人邮箱；
- 常用用户名；
- 常用昵称；
- GitHub/Gitee/X/小红书/抖音等已知主页；
- QQ 号、微信号等用户主动输入的标识；
- 后期实名后的实名认证状态。

系统只为当前登录用户生成报告。

### 5.3 强验证实名模式

当项目进入实名阶段，建议增加：

- 手机号 OTP；
- 邮箱 OTP；
- 微信/支付宝/Apple/Google OAuth 绑定；
- 实名状态只保存验证结果，不保存证件图像；
- 每个标识符都要有“本人已验证”的状态位。

## 6. 查询结果分级

每个平台的查询结果不应简单写“查到了/没查到”，而应分级：

| 等级 | 含义 | 用户动作 |
|---|---|---|
| confirmed | 用户已经登录或 OAuth 授权确认 | 可直接进入导出/注销任务 |
| likely | 公开主页、找回提示或用户手动确认存在 | 引导登录找回并确认 |
| possible | 用户名规则、历史记录或弱信号相似 | 仅列为待复核 |
| not_found | 没有明显线索 | 暂不处理，后续复查 |
| unsupported | 平台不支持安全查询 | 只提供人工入口 |

## 7. 注销任务模板

每个疑似账号生成以下任务：

```text
1. 确认账号是否属于本人。
2. 登录或找回账号。
3. 导出个人数据。
4. 取消订阅、解绑支付、迁移资产。
5. 删除公开内容或隐藏主页。
6. 提交注销/停用/删除申请。
7. 记录申请日期和冷静期。
8. 冷静期后复查是否仍可登录或被搜索到。
```

## 8. 防滥用约束

为了保证“每个人只能查自己”，后端需要有这些硬约束：

1. 每个查询标识必须绑定当前用户。
2. 手机号与邮箱必须通过 OTP 验证。
3. 用户名批量查询默认限制次数和频率。
4. 不提供匿名批量查询。
5. 不返回他人隐私明文、历史泄露样本、密码、身份证、住址、关系链。
6. 不输出“某人画像”，只输出“我的账号清理任务”。
7. 所有报告支持用户一键删除。
8. 保留审计日志：谁在什么时间查询了哪个自己绑定的标识。

## 9. 推荐后端模型

后期从静态站升级为实名服务时，建议使用：

```text
Cloudflare Pages 前端
Cloudflare Workers API
Cloudflare D1 / Neon Postgres 账号与任务表
Cloudflare KV/R2 保存脱敏报告或用户导出的加密文件
Cloudflare Queues 执行慢任务
Durable Objects 管理单用户扫描状态
```

核心表：

```sql
users(id, created_at, auth_provider, realname_status)
verified_identifiers(id, user_id, type, normalized_hash, verified_at)
platform_catalog(id, name, category, recovery_entry, export_entry, deletion_entry)
account_findings(id, user_id, platform_id, identifier_id, status, confidence, evidence_summary, created_at)
cleanup_tasks(id, user_id, finding_id, task_type, status, due_at, completed_at)
audit_logs(id, user_id, action, target_type, target_hash, created_at)
```

## 10. 与现有项目的关系

现有 README 中的个人自查、数字暴露护照、报告导入、Watchlist 和工具矩阵可以继续保留；只是产品重心应从“暴露面展示”进一步前移到：

```text
账号找回与注销工作台
```

推荐前端新增页面：

```text
/account-cleanup/
```

页面应展示：

- 覆盖平台数量；
- 平台分类；
- 用户输入的本人标识；
- 可能注册的平台；
- 登录找回入口；
- 数据导出入口；
- 注销入口；
- 注销前风险提醒；
- 任务状态；
- 下次复查时间。

## 11. 下一步工程任务

1. 将 `data/personal-account-platform-catalog.json` 接入前端 `/account-cleanup/` 页面。
2. 增加本地报告解析器：读取 Blackbird/Maigret 的本人查询结果，匹配 catalog，生成注销任务。
3. 增加 Cloudflare Worker API：只允许登录用户查询自己的已验证标识。
4. 增加 Neon/D1 表结构与迁移脚本。
5. 增加“导出我的数据”和“删除我的报告”按钮。
6. 增加平台覆盖度统计与待补充平台清单。
7. 增加定期复查机制：30/60/90 天提醒用户复查账号是否已注销。
