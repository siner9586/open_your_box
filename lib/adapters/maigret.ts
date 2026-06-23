import type { ScanInput, ToolAdapter } from './types';
import { demoEvidence, ensureAuthorized } from './common';
export const maigretAdapter: ToolAdapter = {
  id: 'maigret', name: 'Maigret｜用户名深度复核', inputTypes: ['username'], requiresApiKey: false, defaultEnabled: true,
  safetyBoundary: '递归追踪默认关闭，只作为本人用户名自查扩展建议；不做人身推断。',
  buildCommand(input: ScanInput) { return `maigret ${input.value || 'demo_user'} --json report-maigret.json`; },
  async run(input: ScanInput) { ensureAuthorized(input); return demoEvidence('Maigret', '用户名深度复核', input.value || 'demo_user', 'medium'); }
};
