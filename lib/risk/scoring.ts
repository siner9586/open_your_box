export const riskWeights = {
  account_reuse: 0.12,
  email_breach: 0.14,
  public_profile: 0.08,
  domain_exposure: 0.12,
  subdomain_legacy: 0.08,
  service_exposure: 0.16,
  secret_leak: 0.14,
  cloud_misconfig: 0.08,
  threat_intel: 0.04,
  governance_gap: 0.04
} as const;
export function weightedScore(scores: Record<keyof typeof riskWeights, number>) {
  return Math.round(Object.entries(riskWeights).reduce((sum, [key, weight]) => sum + (scores[key as keyof typeof riskWeights] || 0) * weight, 0));
}
export function scoreLevel(score: number) {
  if (score <= 20) return 'low';
  if (score <= 40) return 'medium';
  if (score <= 60) return 'medium';
  if (score <= 80) return 'high';
  return 'critical';
}
