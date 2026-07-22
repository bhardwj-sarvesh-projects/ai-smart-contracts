import { ProjectRequirements, ArchitecturePlan, SecurityPlan, ReviewReport } from '../types';

export type QualityGateDecision =
  | 'APPROVED'
  | 'TARGETED_IMPROVEMENT'
  | 'REBUILD_AND_REGENERATE'
  | 'MAX_PASSES_REACHED';

export interface QualityCheckItem {
  category: string;
  item: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details?: string;
}

export interface DetailedCategoryScores {
  requirementsCompleteness: number; // 10%
  architecture: number;              // 15%
  security: number;                  // 20%
  codeQuality: number;               // 15%
  gasOptimization: number;           // 10%
  documentation: number;             // 10%
  testing: number;                   // 10%
  deploymentReadiness: number;       // 5%
  maintainability: number;           // 3%
  standardsCompliance: number;       // 2%
}

export interface InternalEngineeringReport {
  overallScore: number;
  categoryScores: DetailedCategoryScores;
  decision: QualityGateDecision;
  passesCount: number;
  checklist: QualityCheckItem[];
  recommendations: string[];
  weakAreas: string[];
  improvementLog: string[];
  timestamp: string;
  requirementsSummary?: string;
  architectureSummary?: string;
}

export type { ReviewReport };

