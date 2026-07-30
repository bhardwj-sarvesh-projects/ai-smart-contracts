import { ProjectRunMetrics } from './MetricsCollector';

export type FailureCategory =
  | 'Prompt Parsing'
  | 'Business Logic'
  | 'Workspace'
  | 'Dependencies'
  | 'Compiler'
  | 'Security'
  | 'Deployment'
  | 'Architecture'
  | 'Testing'
  | 'Documentation'
  | 'Export'
  | 'Certification';

export interface FailureIncident {
  runId: string;
  projectName: string;
  benchmarkId: string;
  category: FailureCategory;
  failedStage: string;
  errorMessage: string;
  promptCategory: string;
  suggestedMitigation: string;
}

export interface FailureCategorySummary {
  category: FailureCategory;
  count: number;
  percentageOfTotalFailures: number;
  impactSeverity: 'Critical' | 'High' | 'Medium' | 'Low';
  commonRootCause: string;
  incidents: FailureIncident[];
}

export interface FailureAnalysisReport {
  totalRunsAnalyzed: number;
  totalFailures: number;
  failureRatePercent: number;
  categories: FailureCategorySummary[];
  mostCommonFailureCategory: FailureCategory | 'None';
  reportMarkdown: string;
}

export class FailureAnalyzer {
  public static analyzeFailures(runs: ProjectRunMetrics[]): FailureAnalysisReport {
    const incidents: FailureIncident[] = [];

    runs.forEach(r => {
      if (!r.isSuccess) {
        incidents.push(...this.extractIncidents(r));
      }
    });

    const categoryMap: Record<FailureCategory, FailureIncident[]> = {
      'Prompt Parsing': [],
      'Business Logic': [],
      'Workspace': [],
      'Dependencies': [],
      'Compiler': [],
      'Security': [],
      'Deployment': [],
      'Architecture': [],
      'Testing': [],
      'Documentation': [],
      'Export': [],
      'Certification': []
    };

    incidents.forEach(inc => {
      categoryMap[inc.category].push(inc);
    });

    const totalFailures = incidents.length;
    let maxCount = -1;
    let mostCommonCategory: FailureCategory | 'None' = 'None';

    const categorySummaries: FailureCategorySummary[] = Object.entries(categoryMap).map(([catStr, incs]) => {
      const cat = catStr as FailureCategory;
      const count = incs.length;

      if (count > maxCount && count > 0) {
        maxCount = count;
        mostCommonCategory = cat;
      }

      return {
        category: cat,
        count,
        percentageOfTotalFailures: totalFailures > 0 ? (count / totalFailures) * 100 : 0,
        impactSeverity: this.determineSeverity(cat),
        commonRootCause: this.getCommonRootCause(cat, incs),
        incidents: incs
      };
    });

    const reportMarkdown = this.generateFailureReportMarkdown(runs.length, totalFailures, categorySummaries, mostCommonCategory);

    return {
      totalRunsAnalyzed: runs.length,
      totalFailures,
      failureRatePercent: runs.length > 0 ? (totalFailures / runs.length) * 100 : 0,
      categories: categorySummaries,
      mostCommonFailureCategory: mostCommonCategory,
      reportMarkdown
    };
  }

  private static extractIncidents(run: ProjectRunMetrics): FailureIncident[] {
    const incidents: FailureIncident[] = [];

    if (!run.generationPassed) {
      incidents.push({
        runId: run.runId,
        projectName: run.projectName,
        benchmarkId: run.benchmarkId,
        category: run.promptCategory === 'Invalid Inputs' ? 'Prompt Parsing' : 'Business Logic',
        failedStage: 'Smart Contract Generation',
        errorMessage: run.issues[0] || 'Code generation failed to produce valid structure',
        promptCategory: run.promptCategory,
        suggestedMitigation: 'Refine prompt parsing rules and enhance fallback template fallbacks.'
      });
    }

    if (!run.compilationPassed) {
      incidents.push({
        runId: run.runId,
        projectName: run.projectName,
        benchmarkId: run.benchmarkId,
        category: 'Compiler',
        failedStage: 'Compiler Validation',
        errorMessage: run.issues.find(i => i.includes('Compiler') || i.includes('syntax')) || 'Syntax/Type check error during compilation',
        promptCategory: run.promptCategory,
        suggestedMitigation: 'Invoke Compiler Self-Healing patch loop or standard library import fixes.'
      });
    }

    if (!run.securityPassed) {
      incidents.push({
        runId: run.runId,
        projectName: run.projectName,
        benchmarkId: run.benchmarkId,
        category: 'Security',
        failedStage: 'Security Audit',
        errorMessage: run.issues.find(i => i.includes('Security') || i.includes('Vulnerability')) || 'Critical/High security vulnerability detected',
        promptCategory: run.promptCategory,
        suggestedMitigation: 'Auto-apply ReentrancyGuard, SafeERC20, or update access controls.'
      });
    }

    if (!run.architecturePassed) {
      incidents.push({
        runId: run.runId,
        projectName: run.projectName,
        benchmarkId: run.benchmarkId,
        category: 'Architecture',
        failedStage: 'Architecture Validation',
        errorMessage: run.issues.find(i => i.includes('Architecture')) || 'Architectural compliance score below 90/100 threshold',
        promptCategory: run.promptCategory,
        suggestedMitigation: 'Enforce standard contract inheritance hierarchies and event declarations.'
      });
    }

    if (!run.testingPassed) {
      incidents.push({
        runId: run.runId,
        projectName: run.projectName,
        benchmarkId: run.benchmarkId,
        category: 'Testing',
        failedStage: 'Testing Validation',
        errorMessage: run.issues.find(i => i.includes('Testing')) || 'Automated unit test coverage below required threshold',
        promptCategory: run.promptCategory,
        suggestedMitigation: 'Auto-generate complementary Foundry/Anchor test suites for un-covered functions.'
      });
    }

    if (!run.certificationPassed) {
      incidents.push({
        runId: run.runId,
        projectName: run.projectName,
        benchmarkId: run.benchmarkId,
        category: 'Certification',
        failedStage: 'Engineering Certification Engine',
        errorMessage: run.issues.find(i => i.includes('Certification')) || 'Engineering Certification final master gate rejected delivery',
        promptCategory: run.promptCategory,
        suggestedMitigation: 'Verify all 11 upstream validation artifacts before issuing certificate.'
      });
    }

    return incidents;
  }

  private static determineSeverity(category: FailureCategory): 'Critical' | 'High' | 'Medium' | 'Low' {
    switch (category) {
      case 'Security':
      case 'Compiler':
      case 'Certification':
        return 'Critical';
      case 'Architecture':
      case 'Testing':
      case 'Dependencies':
        return 'High';
      case 'Workspace':
      case 'Business Logic':
      case 'Deployment':
        return 'Medium';
      default:
        return 'Low';
    }
  }

  private static getCommonRootCause(category: FailureCategory, incidents: FailureIncident[]): string {
    if (incidents.length === 0) return 'None detected';
    switch (category) {
      case 'Prompt Parsing': return 'Malformed or ambiguous prompt instructions.';
      case 'Business Logic': return 'Contradictory state machine constraints in user prompt.';
      case 'Workspace': return 'Directory path resolution or permission issue.';
      case 'Dependencies': return 'Version mismatch in standard framework imports.';
      case 'Compiler': return 'Solidity/Rust type mismatch or undeclared variable.';
      case 'Security': return 'Missing ReentrancyGuard or unchecked external calls.';
      case 'Deployment': return 'Invalid chain RPC endpoint or gas estimation failure.';
      case 'Architecture': return 'Non-standard design pattern or missing event emissions.';
      case 'Testing': return 'Insufficient unit test assertions for edge case paths.';
      case 'Documentation': return 'Incomplete README or diagram specification.';
      case 'Export': return 'Package bundling or file manifest omission.';
      case 'Certification': return 'Failed upstream gate verification in final master cert.';
    }
  }

  private static generateFailureReportMarkdown(
    totalRuns: number,
    totalFailures: number,
    categories: FailureCategorySummary[],
    mostCommonCategory: FailureCategory | 'None'
  ): string {
    const timestamp = new Date().toISOString();
    const failureRate = totalRuns > 0 ? ((totalFailures / totalRuns) * 100).toFixed(2) : '0.00';

    let md = `# AI Contracts v1.0 - FAILURE_REPORT.md\n\n`;
    md += `**Generated At**: ${timestamp}\n`;
    md += `**Total Projects Tested**: ${totalRuns}\n`;
    md += `**Total Failure Incidents**: ${totalFailures}\n`;
    md += `**Failure Incident Rate**: ${failureRate}%\n`;
    md += `**Primary Failure Driver**: ${mostCommonCategory}\n\n`;

    md += `---

## Failure Classification Summary

| Failure Category | Incident Count | % of Total Failures | Severity Impact | Common Root Cause |
| :--- | :---: | :---: | :---: | :--- |
`;

    categories.forEach(c => {
      md += `| **${c.category}** | ${c.count} | ${c.percentageOfTotalFailures.toFixed(1)}% | ${c.impactSeverity} | ${c.commonRootCause} |\n`;
    });

    md += `\n---

## Incident Log Details

`;

    let incidentCount = 0;
    categories.forEach(c => {
      if (c.incidents.length > 0) {
        md += `### Category: ${c.category}\n\n`;
        c.incidents.forEach(inc => {
          incidentCount++;
          md += `**[${incidentCount}] ${inc.projectName}** (${inc.benchmarkId})\n`;
          md += `- **Run ID**: \`${inc.runId}\` | **Prompt Variant**: ${inc.promptCategory}\n`;
          md += `- **Failed Stage**: ${inc.failedStage}\n`;
          md += `- **Error Message**: \`${inc.errorMessage}\` \n`;
          md += `- **Suggested Mitigation**: ${inc.suggestedMitigation}\n\n`;
        });
      }
    });

    if (totalFailures === 0) {
      md += `🎉 **ZERO FAILURES DETECTED!** All benchmark projects passed all 15 pipeline stages cleanly.\n`;
    }

    return md;
  }
}
