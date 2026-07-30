import { BenchmarkEcosystemType } from './BenchmarkManager';

export interface StageExecutionResult {
  stageName: string;
  passed: boolean;
  durationMs: number;
  details?: string;
}

export interface ProjectRunMetrics {
  runId: string;
  projectId: string;
  projectName: string;
  benchmarkId: string;
  ecosystem: BenchmarkEcosystemType;
  promptCategory: string;
  promptText: string;
  isSuccess: boolean;

  // Pipeline stage pass statuses
  generationPassed: boolean;
  compilationPassed: boolean;
  selfHealingTriggered: boolean;
  selfHealingPassed: boolean;
  securityPassed: boolean;
  architecturePassed: boolean;
  testingPassed: boolean;
  documentationPassed: boolean;
  exportPassed: boolean;
  certificationPassed: boolean;

  // Stage timings (in ms)
  generationTimeMs: number;
  compilationTimeMs: number;
  securityAuditTimeMs: number;
  documentationTimeMs: number;
  exportTimeMs: number;
  totalProcessingTimeMs: number;

  stageResults: StageExecutionResult[];
  issues: string[];
  qualityScore: number;
}

export interface StatisticalSummary {
  mean: number;
  median: number;
  min: number;
  max: number;
  p95: number;
  stdDev: number;
}

export interface EcosystemMetrics {
  ecosystem: BenchmarkEcosystemType;
  totalProjects: number;
  successfulProjects: number;
  passRatePercent: number;
  avgTotalTimeMs: number;
  certificationPassRatePercent: number;
}

export interface AggregateMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;

  // Percentage pass rates
  generationSuccessRate: number;
  compilationSuccessRate: number;
  selfHealingSuccessRate: number;
  securityPassRate: number;
  architecturePassRate: number;
  testingPassRate: number;
  documentationPassRate: number;
  exportPassRate: number;
  certificationPassRate: number;

  // Average Timings (in ms and seconds)
  avgGenerationTimeMs: number;
  avgCompilationTimeMs: number;
  avgSecurityAuditTimeMs: number;
  avgDocumentationTimeSec: number;
  avgExportTimeSec: number;
  avgTotalProcessingTimeSec: number;

  avgGenerationTimeSec: number;
  avgCompilationTimeSec: number;
  avgSecurityAuditTimeSec: number;
  avgDocumentationTimeMs: number;
  avgExportTimeMs: number;
  avgTotalProcessingTimeMs: number;

  // Statistical distribution for total processing time
  totalProcessingTimeStats: StatisticalSummary;

  // Ecosystem breakdowns
  ecosystemBreakdown: Record<BenchmarkEcosystemType, EcosystemMetrics>;
}

export class MetricsCollector {
  private runs: ProjectRunMetrics[] = [];

  public recordRun(run: ProjectRunMetrics): void {
    this.runs.push(run);
  }

  public getRuns(): ProjectRunMetrics[] {
    return this.runs;
  }

  public calculateAggregateMetrics(): AggregateMetrics {
    const total = this.runs.length;
    if (total === 0) {
      return this.emptyAggregateMetrics();
    }

    const successful = this.runs.filter(r => r.isSuccess).length;
    const failed = total - successful;

    const genPass = this.runs.filter(r => r.generationPassed).length;
    const compPass = this.runs.filter(r => r.compilationPassed).length;
    const selfHealTriggered = this.runs.filter(r => r.selfHealingTriggered);
    const selfHealPass = selfHealTriggered.filter(r => r.selfHealingPassed).length;
    const secPass = this.runs.filter(r => r.securityPassed).length;
    const archPass = this.runs.filter(r => r.architecturePassed).length;
    const testPass = this.runs.filter(r => r.testingPassed).length;
    const docPass = this.runs.filter(r => r.documentationPassed).length;
    const expPass = this.runs.filter(r => r.exportPassed).length;
    const certPass = this.runs.filter(r => r.certificationPassed).length;

    // Timings
    const genTimes = this.runs.map(r => r.generationTimeMs);
    const compTimes = this.runs.map(r => r.compilationTimeMs);
    const secTimes = this.runs.map(r => r.securityAuditTimeMs);
    const docTimes = this.runs.map(r => r.documentationTimeMs);
    const expTimes = this.runs.map(r => r.exportTimeMs);
    const totalTimes = this.runs.map(r => r.totalProcessingTimeMs);

    const avgGenMs = this.average(genTimes);
    const avgCompMs = this.average(compTimes);
    const avgSecMs = this.average(secTimes);
    const avgDocMs = this.average(docTimes);
    const avgExpMs = this.average(expTimes);
    const avgTotalMs = this.average(totalTimes);

    // Ecosystem Breakdown
    const ecosystems: BenchmarkEcosystemType[] = ['Ethereum/EVM', 'Solana', 'Aptos', 'Sui'];
    const ecosystemBreakdown: Record<BenchmarkEcosystemType, EcosystemMetrics> = {} as any;

    ecosystems.forEach(eco => {
      const ecoRuns = this.runs.filter(r => r.ecosystem === eco);
      const ecoTotal = ecoRuns.length;
      const ecoSuccess = ecoRuns.filter(r => r.isSuccess).length;
      const ecoCertPass = ecoRuns.filter(r => r.certificationPassed).length;
      const ecoAvgTime = this.average(ecoRuns.map(r => r.totalProcessingTimeMs));

      ecosystemBreakdown[eco] = {
        ecosystem: eco,
        totalProjects: ecoTotal,
        successfulProjects: ecoSuccess,
        passRatePercent: ecoTotal > 0 ? (ecoSuccess / ecoTotal) * 100 : 0,
        avgTotalTimeMs: ecoAvgTime,
        certificationPassRatePercent: ecoTotal > 0 ? (ecoCertPass / ecoTotal) * 100 : 0
      };
    });

    return {
      totalRuns: total,
      successfulRuns: successful,
      failedRuns: failed,

      generationSuccessRate: (genPass / total) * 100,
      compilationSuccessRate: (compPass / total) * 100,
      selfHealingSuccessRate: selfHealTriggered.length > 0 ? (selfHealPass / selfHealTriggered.length) * 100 : 100,
      securityPassRate: (secPass / total) * 100,
      architecturePassRate: (archPass / total) * 100,
      testingPassRate: (testPass / total) * 100,
      documentationPassRate: (docPass / total) * 100,
      exportPassRate: (expPass / total) * 100,
      certificationPassRate: (certPass / total) * 100,

      avgGenerationTimeMs: avgGenMs,
      avgCompilationTimeMs: avgCompMs,
      avgSecurityAuditTimeMs: avgSecMs,
      avgDocumentationTimeMs: avgDocMs,
      avgExportTimeMs: avgExpMs,
      avgTotalProcessingTimeMs: avgTotalMs,

      avgGenerationTimeSec: avgGenMs / 1000,
      avgCompilationTimeSec: avgCompMs / 1000,
      avgSecurityAuditTimeSec: avgSecMs / 1000,
      avgDocumentationTimeSec: avgDocMs / 1000,
      avgExportTimeSec: avgExpMs / 1000,
      avgTotalProcessingTimeSec: avgTotalMs / 1000,

      totalProcessingTimeStats: this.calculateStats(totalTimes),
      ecosystemBreakdown
    };
  }

  public calculateStats(values: number[]): StatisticalSummary {
    if (values.length === 0) {
      return { mean: 0, median: 0, min: 0, max: 0, p95: 0, stdDev: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mean = this.average(sorted);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    const p95Idx = Math.floor(sorted.length * 0.95);
    const p95 = sorted[Math.min(p95Idx, sorted.length - 1)];

    const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / sorted.length;
    const stdDev = Math.sqrt(variance);

    return { mean, median, min, max, p95, stdDev };
  }

  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private emptyAggregateMetrics(): AggregateMetrics {
    return {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      generationSuccessRate: 0,
      compilationSuccessRate: 0,
      selfHealingSuccessRate: 0,
      securityPassRate: 0,
      architecturePassRate: 0,
      testingPassRate: 0,
      documentationPassRate: 0,
      exportPassRate: 0,
      certificationPassRate: 0,

      avgGenerationTimeMs: 0,
      avgCompilationTimeMs: 0,
      avgSecurityAuditTimeMs: 0,
      avgDocumentationTimeMs: 0,
      avgExportTimeMs: 0,
      avgTotalProcessingTimeMs: 0,

      avgGenerationTimeSec: 0,
      avgCompilationTimeSec: 0,
      avgSecurityAuditTimeSec: 0,
      avgDocumentationTimeSec: 0,
      avgExportTimeSec: 0,
      avgTotalProcessingTimeSec: 0,

      totalProcessingTimeStats: { mean: 0, median: 0, min: 0, max: 0, p95: 0, stdDev: 0 },
      ecosystemBreakdown: {
        'Ethereum/EVM': { ecosystem: 'Ethereum/EVM', totalProjects: 0, successfulProjects: 0, passRatePercent: 0, avgTotalTimeMs: 0, certificationPassRatePercent: 0 },
        'Solana': { ecosystem: 'Solana', totalProjects: 0, successfulProjects: 0, passRatePercent: 0, avgTotalTimeMs: 0, certificationPassRatePercent: 0 },
        'Aptos': { ecosystem: 'Aptos', totalProjects: 0, successfulProjects: 0, passRatePercent: 0, avgTotalTimeMs: 0, certificationPassRatePercent: 0 },
        'Sui': { ecosystem: 'Sui', totalProjects: 0, successfulProjects: 0, passRatePercent: 0, avgTotalTimeMs: 0, certificationPassRatePercent: 0 }
      }
    };
  }
}
