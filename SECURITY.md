# Security Policy

## 报告安全问题

如果你发现 Open Your Box 自身存在安全问题，请通过 GitHub Security Advisory 或 Issue 中的安全说明渠道联系维护者。请不要在公开 Issue 中贴出真实密钥、真实泄露数据、私人邮箱、内部域名或敏感 banner。

## API Key 不进仓库

所有 API Key 只能放在本地环境变量、GitHub Secrets 或自部署平台 Secret 中。仓库中只允许保留 `.env.example` 的空变量名。

## Secret 管理建议

- 不在前端代码、README、日志、截图或提交记录中写入真实 Key。
- 本地测试后应按自己的安全策略轮换临时 Key。
- GitHub Actions 只通过 `${{ secrets.NAME }}` 读取 Secret。
- 扫描结果中的疑似凭证只保留脱敏摘要和修复任务。

## Demo Mode 与真实扫描边界

公共站点默认只运行 Demo Mode。真实扫描只能在用户自己的本地机器、自部署服务器、私有 GitHub Actions、Cloudflare Worker with Secret 或企业内部 Runner 中执行，并且必须限定本人、自有资产或明确授权资产。

## 不接受的贡献

项目不接受攻击性功能贡献，不接受侵犯隐私功能贡献，不接受默认密码尝试、漏洞利用脚本、暗网样本展示、泄露明文展示、人物画像推断、私人关系推断或骚扰相关功能。
