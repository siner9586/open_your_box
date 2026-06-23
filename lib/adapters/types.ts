export type ScanInputType = 'username' | 'email' | 'domain' | 'ip' | 'cidr' | 'github_org' | 'repo';
export type ScanMode = 'demo' | 'local' | 'server' | 'imported';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export interface ScanInput { type: ScanInputType; value: string; mode: ScanMode; authorized: boolean; }
export interface EvidenceItem { sourceTool: string; evidenceType: string; title: string; description: string; maskedValue?: string; confidence: number; riskLevel: RiskLevel; remediation: string[]; }
export interface ToolAdapter { id: string; name: string; inputTypes: ScanInputType[]; requiresApiKey: boolean; defaultEnabled: boolean; safetyBoundary: string; run(input: ScanInput): Promise<EvidenceItem[]>; buildCommand(input: ScanInput): string; }
export type AssetType = 'username' | 'email' | 'domain' | 'subdomain' | 'ip' | 'cidr' | 'url' | 'repo' | 'cloud_asset' | 'certificate' | 'technology' | 'service' | 'account' | 'breach' | 'threat_indicator';
export type ToolRunMode = 'demo' | 'imported' | 'local_command' | 'github_action' | 'server_api' | 'self_hosted_worker';
export type EvidenceSensitivity = 'public' | 'masked' | 'sensitive' | 'secret';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export interface ExposureAsset { id: string; type: AssetType; label: string; maskedLabel: string; sourceTools: string[]; firstSeen?: string; lastSeen?: string; tags: string[]; sensitivity: EvidenceSensitivity; }
export interface ExposureEvidence { id: string; assetId: string; sourceTool: string; title: string; description: string; evidenceType: string; confidence: ConfidenceLevel; sensitivity: EvidenceSensitivity; rawValueStored: false; maskedValue?: string; discoveredAt: string; remediationRefs: string[]; }
export interface ExposureRisk { id: string; title: string; category: 'account_reuse' | 'email_breach' | 'public_profile' | 'domain_exposure' | 'service_exposure' | 'secret_leak' | 'cloud_misconfig' | 'supply_chain' | 'threat_intel' | 'governance_gap'; score: number; level: RiskLevel; evidenceIds: string[]; businessImpact: string; personalImpact?: string; technicalImpact?: string; remediationTaskIds: string[]; }
export interface RemediationTask { id: string; title: string; description: string; difficulty: 'easy' | 'medium' | 'hard'; estimatedMinutes: number; riskReduction: number; steps: string[]; verification: string; ownerType: 'individual' | 'developer' | 'security_team' | 'manager'; status: 'todo' | 'doing' | 'done' | 'ignored'; }
export interface ExposureReport { id: string; reportType: 'personal' | 'organization' | 'vendor' | 'developer'; generatedAt: string; authorizedScope: string; toolsUsed: string[]; assets: ExposureAsset[]; evidence: ExposureEvidence[]; risks: ExposureRisk[]; tasks: RemediationTask[]; totalScore: number; summary: string; nextReviewDate?: string; }
