import { Project, ProjectFile } from '../../types';

export class DocumentationService {
  static generateReadme(project: Project): ProjectFile {
    const md = `# ${project.name}

> ${project.description || 'Enterprise Smart Contract Architecture'}

## Specifications
- **Blockchain Target:** ${project.blockchain}
- **Language:** ${project.language}
- **Framework:** ${project.framework}
- **Contract Type:** ${project.contractType}

## Architecture
This project implements enterprise-grade clean architecture with modular interfaces, custom errors, and event emission.

## Build & Test
\`\`\`bash
# Run compiler build
forge build

# Run security test suite
forge test -vvv
\`\`\`

## Security & NatSpec
All external functions are fully documented with NatSpec tags and implement strict checks-effects-interactions (CEI) state access control.
`;

    return {
      path: 'README.md',
      content: md,
      language: 'markdown',
    };
  }
}
