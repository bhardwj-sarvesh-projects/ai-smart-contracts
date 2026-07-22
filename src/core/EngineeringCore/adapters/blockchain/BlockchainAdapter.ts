export interface BlockchainAdapter {
  id: string;
  name: string;
  supportedLanguages: string[];
  defaultLanguage: string;
  supportedFrameworks: string[];
  defaultFramework: string;
  compilerVersions: string[];
  standards: string[];
  defaultSDK: string;
  deploymentStrategy: string;
  securityPatterns: string[];
  bestPractices: string[];
}
