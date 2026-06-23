import type { ScanInput, ToolAdapter } from './types';
import { demoEvidence, ensureAuthorized, maskEmail } from './common';
export const blackbirdAdapter: ToolAdapter = {
  id: 'blackbird', name: 'Blackbird｜账号足迹快照', inputTypes: ['username', 'email'], requiresApiKey: false, defaultEnabled: true,
  safetyBoundary: '只允许输入本人用户名、本人邮箱或明确授权账号；不输出身份判断、住址、关系或人物画像。',
  buildCommand(input: ScanInput) { return input.type === 'email' ? `python blackbird.py --email ${maskEmail(input.value)} --json report-blackbird-email.json` : `python blackbird.py --username ${input.value || 'demo_user'} --json report-blackbird.json`; },
  async run(input: ScanInput) { ensureAuthorized(input); return demoEvidence('Blackbird', '账号足迹快照', input.type === 'email' ? maskEmail(input.value) : input.value || 'demo_user', 'medium'); }
};
