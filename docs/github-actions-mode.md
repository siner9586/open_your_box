# GitHub Actions Mode

GitHub Actions 默认只做 CI、构建、静态部署、Demo 报告生成和 Secret Scan。真实授权扫描需要用户自行配置私有 Runner、授权资产清单和 Secrets。

## 默认工作流

- ci.yml：lint、typecheck、test、build。
- pages.yml：构建并发布静态站点。
- demo-report.yml：每周生成 Demo 报告，不扫描真实目标。
- secret-scan.yml：Gitleaks 检查仓库。
- lighthouse.yml：静态质量 dry checks。
- playwright.yml：核心页面 smoke 测试。
