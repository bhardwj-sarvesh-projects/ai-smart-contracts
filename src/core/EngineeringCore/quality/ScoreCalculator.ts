import { DetailedCategoryScores } from './ReviewReport';

export class ScoreCalculator {
  static WEIGHTS = {
    requirementsCompleteness: 0.10,
    architecture: 0.15,
    security: 0.20,
    codeQuality: 0.15,
    gasOptimization: 0.10,
    documentation: 0.10,
    testing: 0.10,
    deploymentReadiness: 0.05,
    maintainability: 0.03,
    standardsCompliance: 0.02,
  };

  static calculateOverallScore(scores: DetailedCategoryScores): number {
    const rawSum =
      scores.requirementsCompleteness * this.WEIGHTS.requirementsCompleteness +
      scores.architecture * this.WEIGHTS.architecture +
      scores.security * this.WEIGHTS.security +
      scores.codeQuality * this.WEIGHTS.codeQuality +
      scores.gasOptimization * this.WEIGHTS.gasOptimization +
      scores.documentation * this.WEIGHTS.documentation +
      scores.testing * this.WEIGHTS.testing +
      scores.deploymentReadiness * this.WEIGHTS.deploymentReadiness +
      scores.maintainability * this.WEIGHTS.maintainability +
      scores.standardsCompliance * this.WEIGHTS.standardsCompliance;

    return Math.min(100, Math.max(0, Math.round(rawSum * 10) / 10));
  }

  static getWeakAreas(scores: DetailedCategoryScores, threshold = 90): string[] {
    const weak: string[] = [];

    if (scores.requirementsCompleteness < threshold) weak.push('requirementsCompleteness');
    if (scores.architecture < threshold) weak.push('architecture');
    if (scores.security < threshold) weak.push('security');
    if (scores.codeQuality < threshold) weak.push('codeQuality');
    if (scores.gasOptimization < threshold) weak.push('gasOptimization');
    if (scores.documentation < threshold) weak.push('documentation');
    if (scores.testing < threshold) weak.push('testing');
    if (scores.deploymentReadiness < threshold) weak.push('deploymentReadiness');
    if (scores.maintainability < threshold) weak.push('maintainability');
    if (scores.standardsCompliance < threshold) weak.push('standardsCompliance');

    return weak;
  }
}
