import type { ScanInput, ToolAdapter } from './types';
import { demoEvidence, ensureAuthorized } from './common';
export const theHarvesterAdapter: ToolAdapter = {
  id: 'theharvester', name: 'theHarvester｜组织公开资产梳理', inputTypes: ['domain'], requiresApiKey: false, defaultEnabled: true,
  safetyBoundary: '只允许域名维度的企业自查或授权尽调；邮箱默认脱敏，不输出员工名单式结果。',
  buildCommand(input: ScanInput) { return `theHarvester -d ${input.value || 'example.com'} -b bing,crtsh -f report-theharvester`; },
  async run(input: ScanInput) { ensureAuthorized(input); return demoEvidence('theHarvester', '组织公开资产梳理', input.value || 'example.com', 'medium'); }
};
