import { StructuredProjectOutput } from '../types';
import { InternalEngineeringReport, ReviewReport } from './ReviewReport';
import { EngineeringReviewer } from './EngineeringReviewer';
import { DecisionEngine } from './DecisionEngine';
import { ImprovementPlanner } from './ImprovementPlanner';
import { ResponseParser } from '../parsers/ResponseParser';

export interface QualityGateOptions {
  aiExecutor?: (systemInstruction: string, userPrompt: string) => Promise<string>;
  onStepProgress?: (stepMessage: string) => void;
  maxPasses?: number;
}

export class QualityGateEngine {
  static async evaluateAndImprove(
    project: StructuredProjectOutput,
    options: QualityGateOptions = {}
  ): Promise<StructuredProjectOutput> {
    const maxPasses = options.maxPasses || DecisionEngine.MAX_PASSES;
    let currentPass = 1;
    let currentProject = { ...project };
    const improvementLogs: string[] = [];

    options.onStepProgress?.('Reviewing Engineering Quality...');

    // Pass 1 Review
    let report: InternalEngineeringReport = EngineeringReviewer.reviewProject(currentProject, currentPass);
    improvementLogs.push(`Pass 1 Initial Score: ${report.overallScore}/100`);

    while (currentPass <= maxPasses) {
      const decision = DecisionEngine.decide(report, currentPass);

      if (decision === 'APPROVED' || decision === 'MAX_PASSES_REACHED' || currentPass >= maxPasses) {
        if (decision === 'APPROVED') {
          options.onStepProgress?.('Quality Gate Approved (Score >= 95)');
        } else {
          options.onStepProgress?.(`Quality Gate Completed (Score: ${report.overallScore}/100)`);
        }
        break;
      }

      // Execute targeted improvement or rebuild pass
      currentPass++;
      options.onStepProgress?.(
        decision === 'TARGETED_IMPROVEMENT'
          ? `Optimizing Project (Pass ${currentPass}/${maxPasses})...`
          : `Rebuilding Architecture (Pass ${currentPass}/${maxPasses})...`
      );

      // Step 1: Deterministic structural enrichment
      currentProject = ImprovementPlanner.enrichProjectDeterministically(currentProject, report);

      // Step 2: AI self-improvement request if executor available
      if (options.aiExecutor && report.overallScore < 95) {
        try {
          const { systemInstruction, userPromptText } = ImprovementPlanner.buildTargetedImprovementPrompt(
            currentProject,
            report
          );
          const rawImproved = await options.aiExecutor(systemInstruction, userPromptText);
          if (rawImproved && rawImproved.trim().length > 0) {
            const parsedImproved = ResponseParser.parseAndNormalize(
              rawImproved,
              currentProject.contractType || 'Smart Contract'
            );
            if (parsedImproved.files && parsedImproved.files.length > 0) {
              currentProject = {
                ...currentProject,
                files: parsedImproved.files,
              };
            }
          }
        } catch (e) {
          console.warn('[QualityGateEngine] AI self-improvement pass encountered warning:', e);
        }
      }

      // Re-review after improvement
      report = EngineeringReviewer.reviewProject(currentProject, currentPass);
      improvementLogs.push(`Pass ${currentPass} Improved Score: ${report.overallScore}/100`);
    }

    report.improvementLog = improvementLogs;

    // Construct compatible ReviewReport for UI/Audit components
    const legacyReviewReport: ReviewReport = {
      score: Math.round(report.overallScore),
      overallScore: Math.round(report.overallScore),
      securityScore: report.categoryScores.security,
      architectureScore: report.categoryScores.architecture,
      gasOptimizationScore: report.categoryScores.gasOptimization,
      readabilityScore: report.categoryScores.documentation,
      standardsCompliance: report.overallScore >= 80,
      readinessForMainnet: report.overallScore >= 90,
      recommendations: report.recommendations,
      requiresImprovementPass: report.overallScore < 90,
      detailedReport: report,
    };

    const mainContractFile = currentProject.files.find(
      f => f.path.endsWith('.sol') || f.path.endsWith('.rs') || f.path.endsWith('.move')
    ) || currentProject.files[0];

    currentProject.reviewReport = legacyReviewReport;
    currentProject.audit = {
      score: Math.round(report.overallScore),
      codeQuality: report.categoryScores.codeQuality,
      gasOptimization: report.categoryScores.gasOptimization,
      complexity: report.overallScore > 90 ? 2 : 4,
      summary: `Enterprise Quality Gate Score: ${report.overallScore}/100 across 10 security & architecture dimensions.`,
      vulnerabilities: report.checklist
        .filter(c => c.status === 'FAIL' || c.status === 'WARN')
        .map((c, i) => ({
          id: `vuln-qg-${i}`,
          title: `[${c.category}] ${c.item}`,
          severity: c.status === 'FAIL' ? 'high' : 'medium',
          description: c.details || 'Checklist finding from automated quality gate review.',
          recommendation: report.recommendations[i] || 'Apply standard security best practices.',
          location: c.category,
          file: mainContractFile ? mainContractFile.path : 'src/Contract.sol',
          fixAvailable: true,
        })),
    };

    options.onStepProgress?.('Preparing Workspace...');

    return currentProject;
  }
}
