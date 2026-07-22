import { AuditResult } from '../../../types';

export type UserIntent =
  | 'Create Project'
  | 'Generate'
  | 'Modify'
  | 'Continue'
  | 'Refactor'
  | 'Optimize'
  | 'Audit'
  | 'Explain'
  | 'Deploy'
  | 'Test'
  | 'Convert Blockchain'
  | 'Convert Language'
  | 'Migrate'
  | 'Documentation'
  | 'Compare';

export interface ProjectRequirements {
  businessGoal: string;
  projectType: string;
  contractType: string;
  blockchain: string;
  language: string;
  framework: string;
  compiler: string;
  standards: string[];
  actors: string[];
  assets: string[];
  dependencies: string[];
  upgradeability: boolean;
  securityRequirements: string[];
  testingRequirements: string[];
  deploymentRequirements: string[];
  complexity: 'Low' | 'Medium' | 'High' | 'Enterprise';
  confidenceScore: number;
  clarificationQuestions?: string[];
}

export interface ArchitecturePlan {
  folderStructure: string[];
  contracts: Array<{ name: string; type: string; purpose: string }>;
  interfaces: Array<{ name: string; purpose: string }>;
  libraries: Array<{ name: string; purpose: string }>;
  storageLayout: string;
  modules: string[];
  dependencies: string[];
}

export interface SecurityPlan {
  accessControl: boolean;
  reentrancyProtection: boolean;
  pausable: boolean;
  emergencyRecovery: boolean;
  timelock: boolean;
  ecdsa: boolean;
  permit: boolean;
  replayProtection: boolean;
  oracleValidation: boolean;
  rateLimiting: boolean;
  inputValidation: boolean;
  safeTransferPatterns: boolean;
  recommendedLibraries: string[];
}

export interface PipelineContext {
  id: string;
  userPrompt: string;
  blockchainInput?: string;
  languageInput?: string;
  frameworkInput?: string;
  existingFiles?: Array<{ path: string; content: string; language: string }>;
  intent?: UserIntent;
  requirements?: ProjectRequirements;
  architecturePlan?: ArchitecturePlan;
  securityPlan?: SecurityPlan;
  systemPrompt?: string;
  rawResponseText?: string;
  parsedOutput?: any;
  reviewReport?: ReviewReport;
  executionLog: Array<{ stage: string; timestamp: number; durationMs?: number; details?: string }>;
}

export interface ReviewReport {
  score: number;
  overallScore: number;
  securityScore: number;
  architectureScore: number;
  gasOptimizationScore: number;
  readabilityScore: number;
  standardsCompliance: boolean;
  readinessForMainnet: boolean;
  recommendations: string[];
  requiresImprovementPass: boolean;
  detailedReport?: any;
}

export interface StructuredProjectFile {
  path: string;
  content: string;
  language: string;
}

export interface StructuredProjectOutput {
  name: string;
  description: string;
  blockchain: string;
  language: string;
  framework: string;
  contractType: string;
  files: StructuredProjectFile[];
  audit?: AuditResult;
  requirements?: ProjectRequirements;
  architecture?: ArchitecturePlan;
  securityPlan?: SecurityPlan;
  reviewReport?: ReviewReport;
  clarificationQuestions?: string[];
  metadata?: Record<string, any>;
}
