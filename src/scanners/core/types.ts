export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical'
export type Confidence = 'low' | 'medium' | 'high' | 'verified'
export type OybFinding = {
  id: string
  scanId: string
  subjectType: string
  source: string
  category: string
  severity: Severity
  confidence: Confidence
  title: string
  summary: string
  evidenceType: string
  evidencePreview: string
  evidenceRef?: string
  affectedIdentifierHash?: string
  affectedIdentifierMasked?: string
  remediation: { actionType: string; label: string; url?: string; steps: string[] }
  createdAt: string
}
export type RiskScore = {
  total: number
  level: 'low' | 'medium' | 'high' | 'critical'
  dimensions: Record<string, number>
  explanation: string[]
}
