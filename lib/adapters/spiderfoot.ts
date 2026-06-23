import type { ScanInput, ToolAdapter } from './types';
import { demoEvidence, ensureAuthorized, maskEmail, maskIp } from './common';
export const spiderfootAdapter: ToolAdapter = {
  id: 'spiderfoot', name: 'SpiderFoot｜暴露面关联分析', inputTypes: ['email', 'domain', 'ip'], requiresApiKey: true, defaultEnabled: true,
  safetyBoundary: '不展示完整泄露数据，不保存敏感明文；暗网相关内容只显示风险信号和人工核验建议。',
  buildCommand(input: ScanInput) { const target = input.type === 'email' ? maskEmail(input.value) : input.type === 'ip' ? maskIp(input.value) : input.value || 'example.com'; return `python sf.py -s ${target} -o json > report-spiderfoot.json`; },
  async run(input: ScanInput) { ensureAuthorized(input); return demoEvidence('SpiderFoot', '暴露面关联分析', input.type === 'email' ? maskEmail(input.value) : input.type === 'ip' ? maskIp(input.value) : input.value || 'example.com', 'medium'); }
};
