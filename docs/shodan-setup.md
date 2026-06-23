# Shodan Setup

Open Your Box 的 Shodan 适配器只读取环境变量 `SHODAN_API_KEY`。不要把真实 Key 写入前端、README、日志、截图、提交记录或 Demo JSON。

## 本地测试

```bash
export SHODAN_API_KEY="在本地填入你的 Shodan Key"
npm run scan:shodan -- --ip 203.0.113.10 --authorized --out report-shodan.json
```

`--authorized` 表示你确认该 IP 属于本人、本组织或已获得明确授权。没有授权确认时，脚本不会做真实查询。

## GitHub Actions Secret

```bash
gh secret set SHODAN_API_KEY -R siner9586/open_your_box
```

公共 Demo 工作流默认不使用该 Secret，也不扫描真实目标。

## 输出边界

脚本只输出：端口、服务名、产品名、版本摘要、组织或 ISP、国家/地区、SSL 证书摘要、最近观测时间、风险解释、加固建议。

脚本禁止输出：默认密码、exploit、可利用脚本、进入后台的 URL、未脱敏敏感 banner。
