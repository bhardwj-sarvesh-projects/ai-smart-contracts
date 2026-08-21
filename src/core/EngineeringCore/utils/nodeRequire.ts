/**
 * Safe dynamic Node module require helper.
 * Compatible with:
 * - Browser bundles (returns null, prevents window/process crashes)
 * - Node CommonJS bundled output (e.g. dist/server.cjs)
 * - Node ESM / Vitest environments
 */
export function getNodeRequire(): ((id: string) => any) | null {
  if (typeof window !== 'undefined') {
    return null;
  }
  if (typeof require === 'function') {
    return require;
  }
  try {
    const mod = typeof module !== 'undefined' ? (module as any) : null;
    if (mod && typeof mod.createRequire === 'function') {
      const metaUrl = typeof import.meta !== 'undefined' && import.meta ? (import.meta as any).url : undefined;
      const fileUrl = metaUrl || (typeof __filename !== 'undefined' ? __filename : (typeof process !== 'undefined' && process.cwd ? `file://${process.cwd()}/index.js` : 'file:///app/index.js'));
      return mod.createRequire(fileUrl);
    }
  } catch {
    // Fallback if dynamic resolution fails
  }
  return null;
}
