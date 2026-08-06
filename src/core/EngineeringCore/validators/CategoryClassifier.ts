export type FileCategory = 'SMART_CONTRACT' | 'FRONTEND' | 'CONFIGURATION' | 'DOCUMENTATION' | 'ASSET';

export class CategoryClassifier {
  /**
   * Classifies a file path into its proper FileCategory.
   */
  public static classify(path: string): FileCategory {
    const normalized = path.replace(/\\/g, '/').trim();
    const filename = normalized.split('/').pop() || '';
    const lowerFilename = filename.toLowerCase();
    
    const ext = lowerFilename.includes('.') ? lowerFilename.split('.').pop()! : '';

    // 1. SMART CONTRACTS
    if (['sol', 'rs', 'move'].includes(ext)) {
      return 'SMART_CONTRACT';
    }

    // 2. FRONTEND
    if (['html', 'css', 'scss', 'js', 'jsx', 'ts', 'tsx'].includes(ext)) {
      return 'FRONTEND';
    }

    // 3. CONFIGURATION
    if (
      ['toml', 'json', 'yaml', 'yml'].includes(ext) ||
      lowerFilename === '.env' ||
      lowerFilename === '.env.example' ||
      lowerFilename === 'license'
    ) {
      return 'CONFIGURATION';
    }

    // 4. DOCUMENTATION
    if (ext === 'md') {
      return 'DOCUMENTATION';
    }

    // 5. STATIC ASSETS
    if (['svg', 'png', 'jpg', 'jpeg', 'ico', 'webmanifest'].includes(ext)) {
      return 'ASSET';
    }

    // Fallbacks based on directory structure
    if (
      normalized.startsWith('app/') ||
      normalized.startsWith('src/') ||
      normalized.startsWith('public/')
    ) {
      return 'FRONTEND';
    }

    return 'CONFIGURATION';
  }
}
