export type ClaimStatus = 'Pending' | 'AI Audited' | 'Verified' | 'Retired' | 'Duplicate blocked' | 'Rejected';

export interface TelemetryPoint {
  timestamp: string;
  hour: number;
  actualKWh: number;
  expectedKWh: number;
  irradianceOrActivity: number; // W/m2 for solar, km for transport, m3 for biogas
  isAnomaly: boolean;
  anomalyReason?: string;
}

export interface AiAuditReport {
  overallConfidence: number; // 0 - 100%
  claimedTonnes: number;
  aiEstimatedTonnes: number;
  variancePercentage: number;
  totalDataPoints: number;
  anomalyCount: number;
  anomalies: { hour: number; actual: number; expected: number; reason: string }[];
  methodology: string;
  emissionFactorUsed: string;
  verdict: 'PASS' | 'REVIEW_FLAGGED' | 'FRAUD_SUSPECTED';
  verdictSummary: string;
  recommendations: string[];
}

export interface Claim {
  id: string;
  name: string;
  type: 'Renewable energy' | 'Transport' | 'Waste management' | 'Forestry' | 'Supply chain';
  location: string;
  claimed: number; // in tCO2e
  estimated: number; // in tCO2e
  confidenceScore: number; // 0-100%
  status: ClaimStatus;
  date: string;
  hash: string; // Evidence Hash
  txHash?: string;
  blockNumber?: number;
  submitter: string;
  note: string;
  evidence: string;
  telemetryData?: TelemetryPoint[];
  auditReport?: AiAuditReport;
  retirement?: {
    beneficiary: string;
    reason: string;
    timestamp: string;
    certificateHash: string;
    retiredBy: string;
  };
}

export interface OnChainTransaction {
  hash: string;
  blockNumber: number;
  timestamp: string;
  from: string;
  to: string;
  action: 'ClaimRegistered' | 'ClaimAudited' | 'ClaimVerified' | 'ClaimRetired' | 'EvidenceRejected';
  claimId: string;
  status: 'Success' | 'Reverted';
  gasUsed: number;
}
