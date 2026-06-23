import type { ScanInput, ToolAdapter } from './types';
import { demoEvidence, ensureAuthorized, maskIp } from './common';
export const shodanAdapter: ToolAdapter = {
  id: 'shodan', name: 'Shodan｜公网设备暴露检查', inputTypes: ['ip', 'domain', 'cidr'], requiresApiKey: true, defaultEnabled: false,
  safetyBoundary: 'Shodan API Key 只走服务端环境变量 SHODAN_API_KEY；仅查询自有或授权 IP/域名，不输出攻击路径、默认密码或利用脚本。',
  buildCommand(input: ScanInput) { return `export SHODAN_API_KEY="在本地填入你的 Shodan Key"\npnpm run scan:shodan -- --ip ${input.value || '203.0.113.10'} --authorized --out report-shodan.json`; },
  async run(input: ScanInput) { ensureAuthorized(input); if (input.mode !== 'server') return demoEvidence('Shodan', '公网设备暴露检查', maskIp(input.value || '203.0.113.10'), 'high'); throw new Error('Server-side Shodan execution is intentionally not implemented in public demo builds.'); }
};
