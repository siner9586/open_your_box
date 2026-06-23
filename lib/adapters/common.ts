import type { EvidenceItem, ScanInput } from './types';
export const ensureAuthorized = (input: ScanInput) => {
  if (!input.authorized) throw new Error('Authorization required: only self-owned or explicitly authorized assets are allowed.');
};
export const maskEmail = (value: string) => value.replace(/^(.).+(@.+)$/, '$1***$2');
export const maskIp = (value: string) => value.replace(/(\d+\.\d+\.\d+)\.\d+/, '$1.*');
export const demoEvidence = (sourceTool: string, title: string, maskedValue: string, riskLevel: EvidenceItem['riskLevel'] = 'medium'): EvidenceItem[] => [{ sourceTool, evidenceType: 'demo_public_signal', title, description: 'Demo Mode evidence only. No real scan is performed and no raw sensitive value is stored.', maskedValue, confidence: 0.74, riskLevel, remediation: ['确认资产归属', '仅在授权环境复查', '按报告清单完成修复', '下次导入报告做趋势对比'] }];
