import { QualityGateDecision, InternalEngineeringReport } from './ReviewReport';

export class DecisionEngine {
  static readonly MAX_PASSES = 2;

  static decide(report: InternalEngineeringReport, currentPass: number): QualityGateDecision {
    if (currentPass >= this.MAX_PASSES) {
      return 'MAX_PASSES_REACHED';
    }

    if (report.overallScore >= 95) {
      return 'APPROVED';
    }

    if (report.overallScore >= 90) {
      return 'TARGETED_IMPROVEMENT';
    }

    return 'REBUILD_AND_REGENERATE';
  }
}
