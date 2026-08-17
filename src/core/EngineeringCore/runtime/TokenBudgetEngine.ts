export interface TPMTracker {
  provider: string;
  model: string;
  tpmLimit: number;
  recentTokensUsed: number;
  lastResetTime: number;
}

const providerTPMMap: Record<string, TPMTracker> = {
  groq: {
    provider: 'groq',
    model: 'platform-router',
    tpmLimit: 250000,
    recentTokensUsed: 0,
    lastResetTime: Date.now()
  },
  openai: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    tpmLimit: 200000,
    recentTokensUsed: 0,
    lastResetTime: Date.now()
  }
};

export class TokenBudgetEngine {
  public static getFileTypeMaxTokens(targetPath?: string): number {
    if (!targetPath) return 65536;
    const pathLower = targetPath.toLowerCase().trim();
    const filename = pathLower.split('/').pop() || '';

    // 1. .env, .env.example -> 256
    if (
      filename === '.env' ||
      filename === '.env.example' ||
      filename.endsWith('.env') ||
      filename.endsWith('.env.example')
    ) {
      return 1024;
    }

    // 2. foundry.toml, solang.toml, Anchor.toml, Move.toml -> 512
    if (
      filename === 'foundry.toml' ||
      filename === 'solang.toml' ||
      filename === 'anchor.toml' ||
      filename === 'move.toml'
    ) {
      return 8192;
    }

    // 3. Cargo.toml, package.json, tsconfig.json, vite.config.* -> 768
    if (
      filename === 'cargo.toml' ||
      filename === 'package.json' ||
      filename === 'tsconfig.json' ||
      filename.startsWith('vite.config.') ||
      filename.startsWith('vite.config')
    ) {
      return 16384;
    }

    // 4. README.md, LICENSE, other small documentation -> 1000
    if (
      filename === 'readme.md' ||
      filename === 'license' ||
      filename === 'license.md' ||
      filename === 'license.txt' ||
      pathLower.endsWith('.md') ||
      pathLower.endsWith('.txt')
    ) {
      return 16384;
    }

    // 5. Tests -> 3000
    if (
      pathLower.includes('.test.') ||
      pathLower.includes('.spec.') ||
      pathLower.includes('/test/') ||
      pathLower.includes('/tests/')
    ) {
      return 65536;
    }

    // 6. Deployment scripts -> 2500
    if (
      pathLower.includes('deploy') ||
      pathLower.includes('migration') ||
      pathLower.includes('script')
    ) {
      return 65536;
    }

    // 7. Solidity -> 3500
    if (pathLower.endsWith('.sol')) {
      return 65536;
    }

    // 8. Rust -> 4000
    if (pathLower.endsWith('.rs')) {
      return 65536;
    }

    // 9. Move -> 3500
    if (pathLower.endsWith('.move')) {
      return 65536;
    }

    // 10. HTML/CSS -> 1500
    if (pathLower.endsWith('.html') || pathLower.endsWith('.css')) {
      return 16384;
    }

    // 11. JS/TS -> 2000
    if (
      pathLower.endsWith('.js') ||
      pathLower.endsWith('.ts') ||
      pathLower.endsWith('.jsx') ||
      pathLower.endsWith('.tsx')
    ) {
      return 65536;
    }

    return 65536;
  }

  public static isConfigFile(targetPath?: string): boolean {
    if (!targetPath) return false;
    const pathLower = targetPath.toLowerCase().trim();
    const filename = pathLower.split('/').pop() || '';
    return (
      filename === 'solang.toml' ||
      filename === 'foundry.toml' ||
      filename === 'anchor.toml' ||
      filename === 'move.toml' ||
      filename === 'cargo.toml' ||
      filename === '.env' ||
      filename === '.env.example' ||
      filename === 'package.json' ||
      filename === 'tsconfig.json' ||
      filename.startsWith('vite.config')
    );
  }

  public static getFileCategory(targetPath?: string): string {
    if (!targetPath) return 'Generic Code';
    const pathLower = targetPath.toLowerCase();
    const filename = pathLower.split('/').pop() || '';

    if (this.isConfigFile(targetPath)) return 'Configuration';
    if (
      filename === 'readme.md' ||
      pathLower.endsWith('.md') ||
      pathLower.endsWith('.txt')
    )
      return 'Documentation';
    if (
      pathLower.includes('.test.') ||
      pathLower.includes('.spec.') ||
      pathLower.includes('/test/') ||
      pathLower.includes('/tests/')
    )
      return 'Tests';
    if (
      pathLower.includes('deploy') ||
      pathLower.includes('migration') ||
      pathLower.includes('script')
    )
      return 'Deployment';
    if (pathLower.endsWith('.sol')) return 'Solidity Contract';
    if (pathLower.endsWith('.rs')) return 'Rust Program';
    if (pathLower.endsWith('.move')) return 'Move Module';
    return 'Source Code';
  }

  public static assertTokenBudget(targetPath: string, maxTokens: number): void {
    const hardMax = this.getFileTypeMaxTokens(targetPath);
    const filename = (targetPath.split('/').pop() || '').toLowerCase();

    if (filename === 'solang.toml' && maxTokens > 512) {
      throw new Error(`INTERNAL_TOKEN_BUDGET_ERROR: solang.toml requested maxTokens (${maxTokens}) exceeds hard limit 512.`);
    }
    if (filename === 'foundry.toml' && maxTokens > 512) {
      throw new Error(`INTERNAL_TOKEN_BUDGET_ERROR: foundry.toml requested maxTokens (${maxTokens}) exceeds hard limit 512.`);
    }
    if ((filename === 'anchor.toml' || filename === 'move.toml') && maxTokens > 512) {
      throw new Error(`INTERNAL_TOKEN_BUDGET_ERROR: ${filename} requested maxTokens (${maxTokens}) exceeds hard limit 512.`);
    }
    if ((filename === '.env.example' || filename === '.env') && maxTokens > 256) {
      throw new Error(`INTERNAL_TOKEN_BUDGET_ERROR: ${filename} requested maxTokens (${maxTokens}) exceeds hard limit 256.`);
    }
    if (filename === 'package.json' && maxTokens > 768) {
      throw new Error(`INTERNAL_TOKEN_BUDGET_ERROR: package.json requested maxTokens (${maxTokens}) exceeds hard limit 768.`);
    }

    if (maxTokens > hardMax) {
      throw new Error(`INTERNAL_TOKEN_BUDGET_ERROR: File "${targetPath}" requested maxTokens (${maxTokens}) exceeds file type category limit (${hardMax}).`);
    }
  }

  public static extractRetryAfter(
    errMessage: string,
    headers?: Record<string, any>
  ): string | number | null {
    if (headers) {
      const headerVal =
        headers['retry-after'] ||
        headers['Retry-After'] ||
        headers['x-ratelimit-reset-requests'] ||
        headers['x-ratelimit-reset-tokens'];
      if (headerVal) return String(headerVal);
    }

    if (typeof errMessage === 'string') {
      const match =
        errMessage.match(/try again in ([0-9]+(?:\.[0-9]+)?s?)/i) ||
        errMessage.match(/in ([0-9]+(?:\.[0-9]+)?s)/i);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  public static updateTPMUsageFromError(providerKey: string, errMessage: string) {
    const key = providerKey.toLowerCase();
    const tracker = providerTPMMap[key];
    if (!tracker) return;

    if (typeof errMessage === 'string') {
      const limitMatch = errMessage.match(/Limit\s+([0-9]+)/i);
      const usedMatch = errMessage.match(/Used\s+([0-9]+)/i);
      if (limitMatch && limitMatch[1]) {
        tracker.tpmLimit = parseInt(limitMatch[1], 10);
      }
      if (usedMatch && usedMatch[1]) {
        tracker.recentTokensUsed = parseInt(usedMatch[1], 10);
        tracker.lastResetTime = Date.now();
      }
    }
  }

  public static updateTPMUsageSuccess(providerKey: string, tokensUsed: number) {
    const key = providerKey.toLowerCase();
    const tracker = providerTPMMap[key];
    if (!tracker) return;

    const now = Date.now();
    if (now - tracker.lastResetTime > 60000) {
      tracker.recentTokensUsed = tokensUsed;
      tracker.lastResetTime = now;
    } else {
      tracker.recentTokensUsed += tokensUsed;
    }
  }

  public static checkAndClampTPMBudget(
    providerKey: string,
    targetPath: string,
    requestedMaxTokens: number,
    promptLength: number
  ): { safeMaxTokens: number; shouldFailFast: boolean; reason?: string } {
    const fileTypeLimit = this.getFileTypeMaxTokens(targetPath);
    const clampedTokens = Math.min(requestedMaxTokens, fileTypeLimit);
    return { safeMaxTokens: clampedTokens, shouldFailFast: false };
  }
}
