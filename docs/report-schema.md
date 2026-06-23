# Report Schema

核心报告结构：

```ts
interface ExposureReport {
  id: string;
  reportType: 'personal' | 'organization' | 'vendor' | 'developer';
  generatedAt: string;
  authorizedScope: string;
  toolsUsed: string[];
  assets: ExposureAsset[];
  evidence: ExposureEvidence[];
  risks: ExposureRisk[];
  tasks: RemediationTask[];
  totalScore: number;
  summary: string;
  nextReviewDate?: string;
}
```

报告必须包含授权范围、工具来源、数据时间、脱敏说明、风险评分、证据摘要、清理任务、复查建议和安全边界。
