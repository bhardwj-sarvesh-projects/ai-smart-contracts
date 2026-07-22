import { ReviewReport, StructuredProjectOutput } from '../types';
import { EngineeringReviewer as QualityReviewer } from '../quality/EngineeringReviewer';

export class EngineeringReviewer {
  static review(project: StructuredProjectOutput): ReviewReport {
    const internalReport = QualityReviewer.reviewProject(project);

    return {
      score: Math.round(internalReport.overallScore),
      overallScore: Math.round(internalReport.overallScore),
      securityScore: internalReport.categoryScores.security,
      architectureScore: internalReport.categoryScores.architecture,
      gasOptimizationScore: internalReport.categoryScores.gasOptimization,
      readabilityScore: internalReport.categoryScores.documentation,
      standardsCompliance: internalReport.overallScore >= 80,
      readinessForMainnet: internalReport.overallScore >= 90,
      recommendations: internalReport.recommendations,
      requiresImprovementPass: internalReport.overallScore < 90,
      detailedReport: internalReport,
    };
  }
}
