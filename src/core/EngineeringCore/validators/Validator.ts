import { StructuredProjectOutput } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class Validator {
  static validate(project: StructuredProjectOutput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!project.files || project.files.length === 0) {
      errors.push('Project contains no contract or configuration files.');
    } else {
      project.files.forEach((file, index) => {
        if (!file.path) {
          errors.push(`File at index ${index} has missing path.`);
        }
        if (!file.content || file.content.trim().length === 0) {
          warnings.push(`File "${file.path}" is empty.`);
        }

        if (file.language === 'solidity') {
          if (!file.content.includes('pragma solidity')) {
            warnings.push(`File "${file.path}" is missing pragma solidity compiler declaration.`);
          }
          if (!file.content.includes('SPDX-License-Identifier')) {
            warnings.push(`File "${file.path}" is missing SPDX license identifier.`);
          }
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
