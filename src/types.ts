export interface ProjectFile {
  path: string;
  content: string;
  language: string;
}

export interface SmartContractTemplate {
  id: string;
  name: string;
  description: string;
  blockchain: string;
  language: string;
  framework: string;
  type: string;
  files: ProjectFile[];
}

export interface Version {
  id: string;
  timestamp: string;
  prompt: string;
  files: ProjectFile[];
  summary: string;
}

export interface Vulnerability {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  description: string;
  line?: number;
  file: string;
  codeSnippet?: string;
  recommendation: string;
  fixAvailable: boolean;
  fixedCode?: string;
}

export interface AuditResult {
  score: number;
  codeQuality: number;
  gasOptimization: number;
  complexity: number;
  vulnerabilities: Vulnerability[];
  summary: string;
}

export interface DeploymentHistory {
  id: string;
  timestamp: string;
  network: string;
  contractName: string;
  address: string;
  txHash: string;
  gasUsed: string;
  status: 'success' | 'failed';
  logs: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  blockchain: string;
  language: string;
  framework: string;
  contractType: string;
  files: ProjectFile[];
  activeFilePath: string;
  versions: Version[];
  audit?: AuditResult;
  deployments: DeploymentHistory[];
  createdAt: string;
}

export interface BlockchainConfig {
  id: string;
  name: string;
  languages: {
    id: string;
    name: string;
    frameworks: string[];
    defaultExtension: string;
  }[];
}
