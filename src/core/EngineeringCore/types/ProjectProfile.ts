import { CompilerType } from '../compiler/CompilerEngine';

export interface ProjectProfile {
  projectId: string;
  blockchain: string;
  language: string;
  framework: string;
  compiler: CompilerType | string;
  validator: string;
  workspaceTemplate: string;
  directoryLayout: string[];
  packageManager: string;
  deploymentTarget: string;
  testingFramework: string;
  documentationStrategy: string;
  exportStrategy: string;
  contractType: string;
  createdAt: string;
}
