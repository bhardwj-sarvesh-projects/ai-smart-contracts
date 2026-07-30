import { ProjectRunMetrics, StatisticalSummary } from './MetricsCollector';

export interface PerformanceProfileReport {
  fastestProject: { name: string; timeMs: number; timeSec: string; benchmarkId: string };
  slowestProject: { name: string; timeMs: number; timeSec: string; benchmarkId: string };
  totalProcessingStatsMs: StatisticalSummary;
  totalProcessingStatsSec: {
    mean: string;
    median: string;
    min: string;
    max: string;
    p95: string;
    stdDev: string;
  };
  memoryUsageMb: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  stageTimingBreakdownSec: {
    generation: string;
    compilation: string;
    securityAudit: string;
    documentation: string;
    export: string;
    otherPipelineStages: string;
  };
  reportMarkdown: string;
}

export class PerformanceProfiler {
  public static profilePerformance(runs: ProjectRunMetrics[]): PerformanceProfileReport {
    if (runs.length === 0) {
      return this.emptyProfileReport();
    }

    const sortedByTime = [...runs].sort((a, b) => a.totalProcessingTimeMs - b.totalProcessingTimeMs);
    const fastest = sortedByTime[0];
    const slowest = sortedByTime[sortedByTime.length - 1];

    const totalTimes = runs.map(r => r.totalProcessingTimeMs);
    const statsMs = this.calculateStats(totalTimes);

    const statsSec = {
      mean: (statsMs.mean / 1000).toFixed(2),
      median: (statsMs.median / 1000).toFixed(2),
      min: (statsMs.min / 1000).toFixed(2),
      max: (statsMs.max / 1000).toFixed(2),
      p95: (statsMs.p95 / 1000).toFixed(2),
      stdDev: (statsMs.stdDev / 1000).toFixed(2)
    };

    // Memory usage profiling
    const mem = typeof process !== 'undefined' && process.memoryUsage ? process.memoryUsage() : { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 };
    const memoryMb = {
      rss: Math.round((mem.rss || 0) / 1024 / 1024),
      heapTotal: Math.round((mem.heapTotal || 0) / 1024 / 1024),
      heapUsed: Math.round((mem.heapUsed || 0) / 1024 / 1024),
      external: Math.round((mem.external || 0) / 1024 / 1024)
    };

    // Stage Timing Breakdown
    const avgGen = this.average(runs.map(r => r.generationTimeMs));
    const avgComp = this.average(runs.map(r => r.compilationTimeMs));
    const avgSec = this.average(runs.map(r => r.securityAuditTimeMs));
    const avgDoc = this.average(runs.map(r => r.documentationTimeMs));
    const avgExp = this.average(runs.map(r => r.exportTimeMs));
    const avgTotal = statsMs.mean;
    const avgOther = Math.max(0, avgTotal - (avgGen + avgComp + avgSec + avgDoc + avgExp));

    const stageTimingBreakdownSec = {
      generation: (avgGen / 1000).toFixed(2),
      compilation: (avgComp / 1000).toFixed(2),
      securityAudit: (avgSec / 1000).toFixed(2),
      documentation: (avgDoc / 1000).toFixed(2),
      export: (avgExp / 1000).toFixed(2),
      otherPipelineStages: (avgOther / 1000).toFixed(2)
    };

    const reportMarkdown = this.generatePerformanceReportMarkdown(
      runs.length,
      fastest,
      slowest,
      statsSec,
      memoryMb,
      stageTimingBreakdownSec
    );

    return {
      fastestProject: {
        name: fastest.projectName,
        timeMs: fastest.totalProcessingTimeMs,
        timeSec: (fastest.totalProcessingTimeMs / 1000).toFixed(2),
        benchmarkId: fastest.benchmarkId
      },
      slowestProject: {
        name: slowest.projectName,
        timeMs: slowest.totalProcessingTimeMs,
        timeSec: (slowest.totalProcessingTimeMs / 1000).toFixed(2),
        benchmarkId: slowest.benchmarkId
      },
      totalProcessingStatsMs: statsMs,
      totalProcessingStatsSec: statsSec,
      memoryUsageMb: memoryMb,
      stageTimingBreakdownSec,
      reportMarkdown
    };
  }

  private static calculateStats(values: number[]): StatisticalSummary {
    if (values.length === 0) return { mean: 0, median: 0, min: 0, max: 0, p95: 0, stdDev: 0 };
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

  private static average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private static generatePerformanceReportMarkdown(
    count: number,
    fastest: ProjectRunMetrics,
    slowest: ProjectRunMetrics,
    statsSec: { mean: string; median: string; min: string; max: string; p95: string; stdDev: string },
    memMb: { rss: number; heapTotal: number; heapUsed: number; external: number },
    stageTimingBreakdownSec: Record<string, string>
  ): string {
    const timestamp = new Date().toISOString();

    return `# AI Contracts v1.0 - PERFORMANCE_REPORT.md

**Generated At**: ${timestamp}
**Total Benchmarks Profiled**: ${count}

---

## Processing Speed Distribution Summary

| Metric | Processing Duration (Seconds) |
| :--- | :---: |
| **Fastest Project Execution** | \`${(fastest.totalProcessingTimeMs / 1000).toFixed(2)}s\` (${fastest.projectName}) |
| **Slowest Project Execution** | \`${(slowest.totalProcessingTimeMs / 1000).toFixed(2)}s\` (${slowest.projectName}) |
| **Average Processing Time (Mean)** | \`${statsSec.mean}s\` |
| **Median Processing Time** | \`${statsSec.median}s\` |
| **95th Percentile (P95)** | \`${statsSec.p95}s\` |
| **Standard Deviation** | \`${statsSec.stdDev}s\` |

---

## Stage Timing Breakdown

| Pipeline Stage | Avg Time (s) | % of Total Time |
| :--- | :---: | :---: |
| **Smart Contract Code Generation** | \`${stageTimingBreakdownSec.generation}s\` | ${((parseFloat(stageTimingBreakdownSec.generation) / parseFloat(statsSec.mean)) * 100 || 0).toFixed(1)}% |
| **Compiler & Syntax Verification** | \`${stageTimingBreakdownSec.compilation}s\` | ${((parseFloat(stageTimingBreakdownSec.compilation) / parseFloat(statsSec.mean)) * 100 || 0).toFixed(1)}% |
| **Security Audit & Vuln Scanning** | \`${stageTimingBreakdownSec.securityAudit}s\` | ${((parseFloat(stageTimingBreakdownSec.securityAudit) / parseFloat(statsSec.mean)) * 100 || 0).toFixed(1)}% |
| **Documentation & Diagram Suite** | \`${stageTimingBreakdownSec.documentation}s\` | ${((parseFloat(stageTimingBreakdownSec.documentation) / parseFloat(statsSec.mean)) * 100 || 0).toFixed(1)}% |
| **Export Package Bundling** | \`${stageTimingBreakdownSec.export}s\` | ${((parseFloat(stageTimingBreakdownSec.export) / parseFloat(statsSec.mean)) * 100 || 0).toFixed(1)}% |
| **Other Pipeline Stages (Integrity, Arch, Cert)** | \`${stageTimingBreakdownSec.otherPipelineStages}s\` | ${((parseFloat(stageTimingBreakdownSec.otherPipelineStages) / parseFloat(statsSec.mean)) * 100 || 0).toFixed(1)}% |

---

## Runtime Memory Footprint

- **Resident Set Size (RSS)**: \`${memMb.rss} MB\`
- **Heap Total Allocated**: \`${memMb.heapTotal} MB\`
- **Heap Used**: \`${memMb.heapUsed} MB\`
- **External C/C++ Memory**: \`${memMb.external} MB\`
`;
  }

  private static emptyProfileReport(): PerformanceProfileReport {
    return {
      fastestProject: { name: 'None', timeMs: 0, timeSec: '0.00', benchmarkId: 'N/A' },
      slowestProject: { name: 'None', timeMs: 0, timeSec: '0.00', benchmarkId: 'N/A' },
      totalProcessingStatsMs: { mean: 0, median: 0, min: 0, max: 0, p95: 0, stdDev: 0 },
      totalProcessingStatsSec: { mean: '0.00', median: '0.00', min: '0.00', max: '0.00', p95: '0.00', stdDev: '0.00' },
      memoryUsageMb: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 },
      stageTimingBreakdownSec: { generation: '0.00', compilation: '0.00', securityAudit: '0.00', documentation: '0.00', export: '0.00', otherPipelineStages: '0.00' },
      reportMarkdown: '# PERFORMANCE_REPORT.md\nNo runs recorded.'
    };
  }
}
