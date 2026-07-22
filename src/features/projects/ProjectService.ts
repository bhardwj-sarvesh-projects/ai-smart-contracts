import { Project, ProjectFile } from '../../types';

export class ProjectService {
  static createDefaultProject(name: string, blockchain: string = 'ethereum', language: string = 'solidity', framework: string = 'foundry', files: ProjectFile[] = []): Project {
    const defaultFiles: ProjectFile[] = files.length > 0 ? files : [
      {
        path: 'src/Contract.sol',
        content: `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\n/**\n * @title ${name}\n * @notice Enterprise production-ready contract architecture.\n */\ncontract Contract {\n    address public immutable owner;\n\n    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);\n\n    constructor() {\n        owner = msg.sender;\n        emit OwnershipTransferred(address(0), msg.sender);\n    }\n}\n`,
        language,
      },
    ];

    return {
      id: `proj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name,
      description: `Enterprise Smart Contract Project for ${blockchain}`,
      blockchain,
      language,
      framework,
      contractType: 'Smart Contract',
      files: defaultFiles,
      activeFilePath: defaultFiles[0].path,
      versions: [
        {
          id: `v-1`,
          timestamp: new Date().toISOString(),
          prompt: 'Initial creation',
          files: defaultFiles,
          summary: 'Created workspace',
        },
      ],
      deployments: [],
      createdAt: new Date().toISOString(),
    };
  }
}
