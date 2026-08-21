import { RegressionPlatform, RegressionPlatformResult } from './RegressionPlatform';
import { getNodeRequire } from '../utils/nodeRequire';

// Safe dynamic require helper to bypass browser bundle static analysis
const requireFn = getNodeRequire();
const fs = requireFn ? requireFn('fs') : null;
const path = requireFn ? requireFn('path') : null;

export interface AcceptanceTestVerificationResult {
  allPassed: boolean;
  totalProjectsExecuted: number;
  successfulProjects: number;
  failedProjects: number;
  certificationPassRatePercent: number;
  isProductionReady: boolean;
  finalDecision: 'PRODUCTION READY' | 'NOT READY';
  generatedReports: string[];
  platformResult: RegressionPlatformResult;
}

export class RegressionPlatformAcceptanceTest {
  public static async runPlatformVerification(): Promise<AcceptanceTestVerificationResult> {
    console.log('🏁 [AcceptanceTest] Executing Enterprise Reliability & Regression Platform Suite...');

    const platform = new RegressionPlatform();
    // Execute across all 28 benchmarks with 2 variations each = 56 total project pipeline executions!
    const result = await platform.runFullRegressionSuite(2);

    const generatedReports: string[] = [];

    // Write generated reports to disk if running in Node environment
    if (typeof window === 'undefined' && fs && fs.writeFileSync) {
      const reportFiles = [
        { name: 'FAILURE_REPORT.md', content: result.reports.failureReportMd },
        { name: 'REGRESSION_HISTORY.md', content: result.reports.regressionHistoryMd },
        { name: 'PERFORMANCE_REPORT.md', content: result.reports.performanceReportMd },
        { name: 'RELIABILITY_REPORT.md', content: result.reports.reliabilityReportMd },
        { name: 'RELEASE_READINESS_REPORT.md', content: result.reports.releaseReadinessReportMd }
      ];

      reportFiles.forEach(rf => {
        try {
          const targetPath = path.join ? path.join(process.cwd(), rf.name) : rf.name;
          fs.writeFileSync(targetPath, rf.content, 'utf8');
          generatedReports.push(targetPath);
          console.log(`📄 Exported artifact: ${rf.name}`);
        } catch (e) {
          console.warn(`Could not export artifact ${rf.name}:`, e);
        }
      });
    }

    const allPassed = result.isProductionReady && result.metrics.certificationPassRate >= 95.0;

    console.log(`\n==================================================`);
    console.log(`🎯 ENTERPRISE REGRESSION PLATFORM EXECUTION COMPLETE`);
    console.log(`==================================================`);
    console.log(`Total Projects Executed: ${result.totalRuns}`);
    console.log(`Successful Pipeline Runs: ${result.successfulRuns}`);
    console.log(`Certification Pass Rate: ${result.metrics.certificationPassRate.toFixed(1)}%`);
    console.log(`Compilation Pass Rate: ${result.metrics.compilationSuccessRate.toFixed(1)}%`);
    console.log(`Security Audit Pass Rate: ${result.metrics.securityPassRate.toFixed(1)}%`);
    console.log(`Average Processing Time: ${result.metrics.avgTotalProcessingTimeSec.toFixed(2)}s`);
    console.log(`Production Release Decision: ${result.finalDecision}`);
    console.log(`==================================================\n`);

    return {
      allPassed,
      totalProjectsExecuted: result.totalRuns,
      successfulProjects: result.successfulRuns,
      failedProjects: result.failedRuns,
      certificationPassRatePercent: result.metrics.certificationPassRate,
      isProductionReady: result.isProductionReady,
      finalDecision: result.finalDecision,
      generatedReports,
      platformResult: result
    };
  }
}
