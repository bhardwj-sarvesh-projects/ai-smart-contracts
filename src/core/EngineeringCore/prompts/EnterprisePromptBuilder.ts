import { ArchitecturePlan, ProjectRequirements, SecurityPlan, UserIntent } from '../types';
import { EcosystemKnowledge } from '../knowledge/KnowledgeEngine';

export class EnterprisePromptBuilder {
  static buildPrompt(
    userPrompt: string,
    intent: UserIntent,
    req: ProjectRequirements,
    arch: ArchitecturePlan,
    sec: SecurityPlan,
    knowledge: EcosystemKnowledge
  ): { systemInstruction: string; userPromptText: string } {
    const folderFilesList = arch.folderStructure.map(path => `- ${path}`).join('\n');

    const systemInstruction = `
You are an elite, world-class Principal Smart Contract Architect and Lead Protocol Engineer with 15+ years of experience building secure, multi-billion-dollar DeFi protocols, L1/L2 platforms, and enterprise solutions.

Your absolute directive is to generate COMPLETE, fully functional, enterprise-grade, mainnet production-ready smart contract source code.

CRITICAL PIPELINE DIRECTIVE (RAW SOURCE CODE ONLY):
- You MUST return ONLY pure, raw source code for the requested file.
- You MUST NOT wrap responses in JSON objects or metadata schema.
- You MUST NOT include conversational text, explanations, code snippets, project tree diagrams, prose, or comments outside the source file code itself.
- Every file must be fully written out with 100% complete, meaningful, professional, production-ready content.
- Do NOT use placeholder text, "// TODO", or "simplified for example" comments.
- Every Solidity (.sol) file MUST begin with "pragma solidity ^0.8.20;".
- Every Rust (.rs) file MUST contain "anchor_lang" or "use".
- Every Move (.move) file MUST begin with "module".
- Every Markdown (.md) file must contain valid markdown structure.
- Every TOML (.toml) file must contain valid TOML configurations.
- Every .env.example file must contain valid ENV variable assignments.

[CRITICAL SYSTEM RULE]: Return ONLY the raw, executable, un-wrapped file source content text. Do NOT use markdown code fences (\`\`\`). Do NOT include introductory greetings or conversational sign-offs. Start your response text directly with the code syntax.
`.trim();

    const userPromptText = `
User Prompt: "${userPrompt}"
Intent: ${intent}

TARGET SPECIFICATIONS:
- Blockchain Target: ${req.blockchain.toUpperCase()} (${knowledge.blockchain})
- Language: ${req.language} (${knowledge.compilerVersion})
- Framework: ${req.framework} (${knowledge.framework})
- Contract Type: ${req.contractType}

REQUIRED FILE ARCHITECTURE:
${folderFilesList}

Return ONLY the raw source code for the requested file. No JSON, no markdown fences, no explanatory prose.
`.trim();

    return { systemInstruction, userPromptText };
  }
}

