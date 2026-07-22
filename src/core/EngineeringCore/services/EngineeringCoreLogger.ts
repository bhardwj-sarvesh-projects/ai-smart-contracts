import { PipelineContext } from '../types';

export class EngineeringCoreLogger {
  static logStage(context: PipelineContext, stage: string, details?: string) {
    const timestamp = Date.now();
    const lastLog = context.executionLog[context.executionLog.length - 1];
    if (lastLog && !lastLog.durationMs) {
      lastLog.durationMs = timestamp - lastLog.timestamp;
    }

    context.executionLog.push({
      stage,
      timestamp,
      details,
    });

    console.log(`[EngineeringCore Pipeline Stage] (${new Date(timestamp).toISOString()}) Stage: ${stage}${details ? ` - ${details}` : ''}`);
  }

  static finalizeLog(context: PipelineContext) {
    const timestamp = Date.now();
    const lastLog = context.executionLog[context.executionLog.length - 1];
    if (lastLog && !lastLog.durationMs) {
      lastLog.durationMs = timestamp - lastLog.timestamp;
    }

    const totalDurationMs = timestamp - (context.executionLog[0]?.timestamp || timestamp);
    console.log(`[EngineeringCore Pipeline Complete] Total Duration: ${totalDurationMs}ms across ${context.executionLog.length} stages.`);
  }
}
