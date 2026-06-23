# Local CLI Mode

Local CLI Mode 的作用是生成可复制的本地命令，让用户在自己的授权环境中运行 Blackbird、Maigret、SpiderFoot、theHarvester、Shodan、Gitleaks、TruffleHog 等工具。

公共站点不执行真实扫描。命令旁边必须显示授权边界和风险提示。

示例：

```bash
maigret demo_user --json report-maigret.json
theHarvester -d example.com -b bing,crtsh -f report-theharvester
npm run scan:shodan -- --ip 203.0.113.10 --authorized --out report-shodan.json
```
