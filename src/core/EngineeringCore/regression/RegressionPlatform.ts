import { BenchmarkManager, BenchmarkDefinition, BenchmarkEcosystemType } from './BenchmarkManager';
import { PromptGenerator, PromptVariation } from './PromptGenerator';
import { MetricsCollector, AggregateMetrics, ProjectRunMetrics } from './MetricsCollector';
import { FailureAnalyzer, FailureAnalysisReport } from './FailureAnalyzer';
import { PerformanceProfiler, PerformanceProfileReport } from './PerformanceProfiler';
import { ReliabilityDashboard, DashboardData } from './ReliabilityDashboard';
import { ReleaseReadinessEvaluator, ReleaseReadinessEvaluation } from './ReleaseReadinessEvaluator';
import { RegressionRunner } from './RegressionRunner';

export interface RegressionPlatformResult {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  overallSuccessRatePercent: number;
  isProductionReady: boolean;
  finalDecision: 'PRODUCTION READY' | 'NOT READY';
  metrics: AggregateMetrics;
  failureAnalysis: FailureAnalysisReport;
  performanceProfile: PerformanceProfileReport;
  dashboardData: DashboardData;
  releaseEvaluation: ReleaseReadinessEvaluation;
  reports: {
    failureReportMd: string;
    regressionHistoryMd: string;
    performanceReportMd: string;
    reliabilityReportMd: string;
    releaseReadinessReportMd: string;
  };
}

export class RegressionPlatform {
  private metricsCollector: MetricsCollector;

  constructor() {
    this.metricsCollector = new MetricsCollector();
  }

  public async runFullRegressionSuite(
    variationsPerBenchmark: number = 8,
    customBenchmarks?: BenchmarkDefinition[]
  ): Promise<RegressionPlatformResult> {
    const benchmarks = customBenchmarks || BenchmarkManager.getAllBenchmarks();
    this.metricsCollector = new MetricsCollector();

    console.log(`🚀 [RegressionPlatform] Starting continuous platform regression suite across ${benchmarks.length} benchmarks...`);

    // Generate prompt variations for each benchmark
    const allVariations: { benchmark: BenchmarkDefinition; variation: PromptVariation }[] = [];

    benchmarks.forEach(bm => {
      const vars = PromptGenerator.generateVariationsForBenchmark(bm, Math.max(1, Math.floor(variationsPerBenchmark / 8)));
      vars.forEach(v => allVariations.push({ benchmark: bm, variation: v }));
    });

    console.log(`📊 Total project test cases generated: ${allVariations.length}`);

    // Execute pipeline for each test case
    for (const item of allVariations) {
      const runMetrics = await RegressionRunner.executePipelineForProject(item.benchmark, item.variation);
      this.metricsCollector.recordRun(runMetrics);
    }

    return this.compilePlatformResults();
  }

  public async runEcosystemRegression(
    ecosystem: BenchmarkEcosystemType,
    variationsPerBenchmark: number = 8
  ): Promise<RegressionPlatformResult> {
    const benchmarks = BenchmarkManager.getBenchmarksByEcosystem(ecosystem);
    return this.runFullRegressionSuite(variationsPerBenchmark, benchmarks);
  }

  public compilePlatformResults(): RegressionPlatformResult {
    const metrics = this.metricsCollector.calculateAggregateMetrics();
    const runs = this.metricsCollector.getRuns();

    const failureAnalysis = FailureAnalyzer.analyzeFailures(runs);
    const performanceProfile = PerformanceProfiler.profilePerformance(runs);
    const dashboardData = ReliabilityDashboard.generateDashboardData(metrics);

    const hasCriticalRegression = metrics.certificationPassRate < 95.0;
    const releaseEvaluation = ReleaseReadinessEvaluator.evaluateReleaseReadiness(
      metrics,
      performanceProfile,
      failureAnalysis,
      hasCriticalRegression
    );

    const regressionHistoryMd = RegressionRunner.generateRegressionHistoryMarkdown(metrics.certificationPassRate);
    const reliabilityReportMd = ReliabilityDashboard.generateReliabilityReportMarkdown(metrics, runs);

    return {
      totalRuns: metrics.totalRuns,
      successfulRuns: metrics.successfulRuns,
      failedRuns: metrics.failedRuns,
      overallSuccessRatePercent: metrics.totalRuns > 0 ? (metrics.successfulRuns / metrics.totalRuns) * 100 : 0,
      isProductionReady: releaseEvaluation.isProductionReady,
      finalDecision: releaseEvaluation.finalDecision,
      metrics,
      failureAnalysis,
      performanceProfile,
      dashboardData,
      releaseEvaluation,
      reports: {
        failureReportMd: failureAnalysis.reportMarkdown,
        regressionHistoryMd,
        performanceReportMd: performanceProfile.reportMarkdown,
        reliabilityReportMd,
        releaseReadinessReportMd: releaseEvaluation.reportMarkdown
      }
    };
  }

  public static async executeAndExportAll(): Promise<RegressionPlatformResult> {
    const platform = new RegressionPlatform();
    return platform.runFullRegressionSuite();
  }
}
