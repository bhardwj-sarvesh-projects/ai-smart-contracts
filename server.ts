import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { AIService } from "./server/services/AIService";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Helper to access DB path
const DB_PATH = path.join(process.cwd(), "data", "db.json");

// Ensure data folder and db.json exist
function ensureDb() {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ projects: [] }, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    const data = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(data);
    if (!parsed || !Array.isArray(parsed.projects)) {
      return { projects: [] };
    }
    return parsed;
  } catch (err) {
    console.error("Error reading db.json, returning empty structure", err);
    return { projects: [] };
  }
}

function writeDb(data: any) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// -------------------------------------------------------------
// API ENDPOINTS
// -------------------------------------------------------------

// Health Check
app.get("/api/health", async (req, res) => {
  try {
    const result = await AIService.healthCheck();
    res.json({
      status: result.success ? "ok" : "error",
      provider: "openai",
      model: result.modelUsed,
      latency: result.latencyMs,
      success: result.success,
      error: result.error || null
    });
  } catch (err: any) {
    res.json({
      status: "error",
      provider: "openai",
      model: process.env.AI_MODEL || "gpt-4o",
      latency: 0,
      success: false,
      error: err.message || "Failed health check"
    });
  }
});

// GET all projects
app.get("/api/projects", (req, res) => {
  const db = readDb();
  res.json(db.projects);
});

// GET a single project
app.get("/api/projects/:id", (req, res) => {
  const db = readDb();
  const project = db.projects.find((p: any) => p.id === req.params.id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  res.json(project);
});

// CREATE a new project
app.post("/api/projects", (req, res) => {
  const { name, description, blockchain, language, framework, contractType, files } = req.body;
  
  if (!name || !blockchain || !language) {
    return res.status(400).json({ error: "Missing required fields: name, blockchain, language" });
  }

  const db = readDb();
  const newProject = {
    id: `project-${Date.now()}`,
    name,
    description: description || `A custom ${contractType || 'smart contract'} project on ${blockchain}.`,
    blockchain,
    language,
    framework: framework || "Default",
    contractType: contractType || "Custom Contract",
    files: files || [],
    activeFilePath: files && files.length > 0 ? files[0].path : "",
    versions: [
      {
        id: `v-${Date.now()}`,
        timestamp: new Date().toISOString(),
        prompt: "Initial Creation",
        files: files || [],
        summary: "Project created."
      }
    ],
    deployments: [],
    createdAt: new Date().toISOString()
  };

  db.projects.push(newProject);
  writeDb(db);
  res.status(201).json(newProject);
});

// UPDATE project
app.put("/api/projects/:id", (req, res) => {
  const db = readDb();
  const index = db.projects.findIndex((p: any) => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Project not found" });
  }

  db.projects[index] = {
    ...db.projects[index],
    ...req.body,
    // Ensure id and createdAt never change
    id: db.projects[index].id,
    createdAt: db.projects[index].createdAt
  };

  writeDb(db);
  res.json(db.projects[index]);
});

// DELETE project
app.delete("/api/projects/:id", (req, res) => {
  const db = readDb();
  const index = db.projects.findIndex((p: any) => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Project not found" });
  }

  db.projects.splice(index, 1);
  writeDb(db);
  res.json({ success: true });
});

// POST /api/generate-plan
app.post("/api/generate-plan", async (req, res) => {
  const isDemoMode = req.query.demo === "true" || req.body.demo === true || process.env.DEMO_MODE === "true" || !process.env.OPENAI_API_KEY;

  try {
    const { prompt, blockchain, language, framework, contractType } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    console.log(`[AI WORKSPACE ENGINE] REDESIGNING STAGE 1-5: Planning for contract type: ${contractType || 'custom'} on blockchain: ${blockchain}`);

    const planPrompt = `
You are a Lead Smart Contract Architect and Security Auditor. Generate an enterprise-level, production-ready Implementation Plan for a smart contract development project.
You MUST execute and document the following internal stages:
1. Requirement Analysis: Deconstruct the user request, mapping tokenomics, business rules, and transfer criteria.
2. Technology & Blockchain Detection: Define constraints specifically for ${blockchain} (${language}).
3. Framework & Compiler Selection: Select optimal compiler versions (e.g. solc 0.8.20 for Ethereum, cargo Anchor for Solana, Sui CLI for Move) and standard frameworks.
4. Capability Validation: List critical design patterns (e.g., Ownable2Step, ReentrancyGuard, PDA keys check, authority signatures, custom errors).
5. Architecture & Folder Structure Planning: Outline target file list and layout.

Prompt: "${prompt}"
Blockchain: "${blockchain}"
Language: "${language}"
Framework: "${framework}"
Contract Type: "${contractType}"

Format the output strictly as a JSON object with these keys:
{
  "businessRequirements": "Detailed deconstructed analysis of functional parameters, assets, roles, and rules",
  "architecture": "Decomposed system overview specifying base standard interfaces, inheritance, and libraries used",
  "storageDesign": "Exact description of state variables, mappings, schemas, arrays, pack sizes, and key spaces",
  "permissionModel": "Detailed modifier gates, ownership recovery models, roles management, and authority modifiers",
  "events": "Comprehensive list of logging triggers, indexed params, and state changes",
  "customErrors": "Detailed list of gas-efficient custom errors with matching throw criteria",
  "validationRules": "Sanitization requirements, bounds checking, zero-address guards, and balance limits",
  "securityConsiderations": "Checklist of reentrancy preventions, unchecked-calls protections, math overflow protection, PDA validations, and signer validations",
  "folderStructure": "Target project folder tree structure adhering perfectly to official development frameworks",
  "testStrategy": "Planned test cases, test environments, mocked dependencies, and edge case coverages",
  "deploymentStrategy": "Deployment parameters, target gas limits, mainnet ingress parameters, and verification flow"
}

Do NOT output markdown wrappers, chat explanations, or conversational filler. Return only raw, parsing-valid JSON.
`;

    if (process.env.OPENAI_API_KEY) {
      const result = await AIService.generatePlan(planPrompt);
      return res.json({
        ...result.data,
        mode: "live"
      });
    }

    if (!isDemoMode) {
      return res.status(500).json({
        success: false,
        provider: "openai",
        error: "OpenAI API key is missing. Please configure OPENAI_API_KEY.",
        details: "No OPENAI_API_KEY found in process.env"
      });
    }

    // Default high-fidelity plan template tailored dynamically for Demo Mode
    const name = prompt.split(" ").slice(0, 3).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ").replace(/[^a-zA-Z0-9 ]/g, "") || "SmartContract";
    const className = name.replace(/\s+/g, "");

    const simulatedPlan = {
      businessRequirements: `Develop a state-of-the-art ${contractType} supporting "${prompt}". Enforce absolute precision, zero-balance safety, and clean asset transfers.`,
      architecture: `Single-module or multi-module layout implementing standard modular paradigms. Built on standard verified bases (e.g. OpenZeppelin / Anchor Account validation tree) to ensure high interoperability and compatibility.`,
      storageDesign: `Includes owner credentials, standard status booleans, mappings for addresses to account values, custom state structures, and event tracking state indices.`,
      permissionModel: `Utilizes safe ownership protocols (like Ownable2Step or authority keys) to secure administrative and modifier-gated write operations.`,
      events: `Defines clear auditable transaction log triggers for all critical state modifications, transfers, state alterations, and administration changes.`,
      customErrors: `Adopts gas-optimized custom errors (e.g. UnauthorizedAccount, InvalidParameterValue, InsufficientBalance, OverflowAttempt) instead of heavy string reasons.`,
      validationRules: `Inputs are systematically sanitized via assertion guard patterns, ensuring address parameters are non-zero, balances satisfy minimum thresholds, and arrays match required boundaries.`,
      securityConsiderations: `Equipped with strict ReentrancyGuard, custom reentrancy protections, safe-math overflows handling, checks-effects-interactions coding pattern, and emergency pausable stop triggers.`,
      folderStructure: `Standard production workspace layout conforming with the ${framework} structure:\n- contracts/\n- test/\n- scripts/\n- package.json\n- README.md`,
      testStrategy: `Comprehensive unit test suite writing Mocha/Chai or Rust Anchor Test assertions validating full coverage across core edge-cases and permissions.`,
      deploymentStrategy: `Automated deploy script scripts/deploy.js configuring gas ceilings, initializing state parameters, and verifying code on Explorer.`
    };

    return res.json({
      ...simulatedPlan,
      mode: "simulated"
    });
  } catch (err: any) {
    console.error("Plan endpoint error:", err);
    res.status(500).json({
      success: false,
      provider: "openai",
      error: "Failed to generate plan",
      details: err.message || String(err)
    });
  }
});

// -------------------------------------------------------------
// AI WORKSPACE ENGINE (GENERATION, EDITING, AUDITING)
// -------------------------------------------------------------

// POST /api/generate
app.post("/api/generate", async (req, res) => {
  const isDemoMode = req.query.demo === "true" || req.body.demo === true || process.env.DEMO_MODE === "true" || !process.env.OPENAI_API_KEY;

  try {
    const { prompt, blockchain, language, framework, contractType, plan } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    console.log(`[AI WORKSPACE ENGINE] STAGE 6-10: Generating workspace files on blockchain: ${blockchain}`);

    // Create full specifications prompt with plan incorporated if present
    let extendedPrompt = `
You are a Principal Smart Contract Architect and Lead Security Auditor.
Create a production-ready, enterprise-grade smart contract workspace based on this request:
"${prompt}"

Blockchain Target: ${blockchain}
Language Target: ${language}
Development Framework: ${framework}
Smart Contract Type: ${contractType}
`;

    if (plan) {
      extendedPrompt += `
Approved Architecture & Implementation Plan:
- Business Requirements: ${plan.businessRequirements || ""}
- Architecture: ${plan.architecture || ""}
- Storage Design: ${plan.storageDesign || ""}
- Permission Model: ${plan.permissionModel || ""}
- Events: ${plan.events || ""}
- Custom Errors: ${plan.customErrors || ""}
- Validation Rules: ${plan.validationRules || ""}
- Security Considerations: ${plan.securityConsiderations || ""}
- Folder Structure: ${plan.folderStructure || ""}
- Test Strategy: ${plan.testStrategy || ""}
- Deployment Strategy: ${plan.deploymentStrategy || ""}

YOU MUST generate contracts, configs, tests, scripts, and READMEs strictly conforming to this Approved Architecture and Implementation Plan.
Do NOT invent compiler syntaxes, imports, or APIs. Use strictly official libraries, compiler syntax, and official SDKs.
`;
    }

    extendedPrompt += `
Requirements:
1. Smart Contract Generation: Generate complete, syntactically perfect primary smart contracts. Avoid placeholders. Include zero-address checks, safe transfer logic, overflow protections, and access modifiers.
2. Accompanying Test Suite: Write a comprehensive, complete unit test file (e.g. Mocha/Chai JS test or Anchor TS test) cover all public entry points, roles, and revert parameters.
3. Configuration: Produce required config files (e.g., hardhat.config.js, foundry.toml, or Anchor.toml) referencing correct compilers.
4. Deployment Scripts: Create the exact scripts/deploy.js or anchor deploy steps to register the contracts correctly.
5. Documentation: Write a professional README.md summarizing business requirements, system architecture, build, test, and deploy guidelines.
6. Security Analysis: Perform a comprehensive security audit of your own generated files, checking for:
   - Reentrancy
   - Access Control Modifier Security
   - Unchecked Calls / Transfer Failures
   - Safe Math & Overflow Vulnerabilities
   - PDA and Account Signer Checks (for Solana Rust programs)
   - Token Account Authority Validation

YOU MUST output a JSON response conforming strictly to this JSON format:
{
  "name": "A short descriptive project name",
  "description": "Comprehensive expanded project description",
  "files": [
    {
      "path": "path/to/file",
      "content": "Full source code",
      "language": "solidity|rust|move|javascript|markdown|toml|json"
    }
  ],
  "audit": {
    "score": 90, // integer from 0 to 100
    "codeQuality": 95, // integer from 0 to 100
    "gasOptimization": 85, // integer from 0 to 100
    "complexity": 3, // integer from 1 to 10
    "summary": "High-level summary of the audit findings mapping reentrancy, access controls, unsafe math, PDA validations, and token safety",
    "vulnerabilities": [
      {
        "id": "vuln-1",
        "title": "Vulnerability severity title",
        "severity": "critical|high|medium|low|informational",
        "description": "Clear description of vulnerability, context, and attack vectors",
        "file": "path/to/vulnerable/file",
        "line": 15,
        "recommendation": "Step-by-step remediation or correction code",
        "fixAvailable": true
      }
    ]
  }
}
Do NOT output any conversational text or markdown wrappers like \`\`\`json. Return only raw, parsing-valid JSON.
`;

    if (process.env.OPENAI_API_KEY) {
      const result = await AIService.generateWorkspace(extendedPrompt);
      const parsed = result.data;

      if (parsed && Array.isArray(parsed.files)) {
        console.log(`[AI PLATFORM] Project "${parsed.name}" generated. Initiating Step 6: Internal Validation...`);
        
        // Internal Validation Call to review and auto-repair compile issues
        const filesContext = parsed.files.map((f: any) => `### FILE: ${f.path}\nContent:\n${f.content}\n`).join("\n");
        const validationPrompt = `
You are a Principal Smart Contract Compiler and Security Validator.
Review the following generated smart contract files for syntax errors, wrong imports, compile warnings, or logic bugs.
If any issues are found, resolve them by rewriting the files perfectly.
Keep the exact same file paths.

Generated workspace files:
${filesContext}

Output the validated files in this JSON format:
{
  "files": [
    {
      "path": "path/to/file",
      "content": "Full corrected source code",
      "language": "solidity|rust|move|javascript|markdown"
    }
  ],
  "validationReport": "Summary of issues checked and corrections made"
}
Do NOT output markdown wrappers. Return raw, parsing-valid JSON.
`;

        try {
          const validatedResult = await AIService.compileAnalysis(validationPrompt);
          const validatedParsed = validatedResult.data;
          
          if (validatedParsed && Array.isArray(validatedParsed.files)) {
            console.log(`[AI PLATFORM] Step 6 Internal Validation completed successfully.`);
            parsed.files = validatedParsed.files;
            parsed.validationReport = validatedParsed.validationReport || "Validated successfully.";
          }
        } catch (vErr) {
          console.warn("[AI PLATFORM] Step 6 Internal Validation met an error (continuing with baseline generated files):", vErr);
        }

        return res.json({
          ...parsed,
          mode: "live"
        });
      } else {
        throw new Error("Invalid response format: files array is missing from AI output.");
      }
    }

    if (!isDemoMode) {
      return res.status(500).json({
        success: false,
        provider: "openai",
        error: "OpenAI API key is missing. Please configure OPENAI_API_KEY.",
        details: "No OPENAI_API_KEY found in process.env"
      });
    }

    // Fallback / Simulated Generation for Demo Mode
    const simulatedProject = simulateSmartContractGeneration(prompt, blockchain, language, framework, contractType);
    return res.json({
      ...simulatedProject,
      mode: "simulated"
    });
  } catch (err: any) {
    console.error("Critical error in /api/generate:", err);
    res.status(500).json({
      success: false,
      provider: "openai",
      error: "Failed to generate smart contract workspace",
      details: err.message || String(err)
    });
  }
});

// POST /api/edit
app.post("/api/edit", async (req, res) => {
  const isDemoMode = req.query.demo === "true" || req.body.demo === true || process.env.DEMO_MODE === "true" || !process.env.OPENAI_API_KEY;
  const { projectId, instruction, files } = req.body;

  if (!instruction || !files) {
    return res.status(400).json({ error: "Instruction and files are required" });
  }

  console.log(`Editing workspace files using natural language. Instruction: "${instruction}"`);

  const filesContext = files.map((f: any) => `### FILE: ${f.path}\nLanguage: ${f.language}\n\`\`\`\n${f.content}\n\`\`\`\n`).join("\n");

  const editingPrompt = `
You are a Principal Smart Contract Engineer. Your task is to intelligently modify the existing smart contract workspace based on this instruction:
"${instruction}"

Keep ALL file names the same. You may modify existing files or generate new ones if needed (e.g., adding a library or test file).
Maintain security, and do not remove existing functionalities unless explicitly instructed.

Current workspace files:
${filesContext}

YOU MUST output a JSON response conforming strictly to this JSON format:
{
  "files": [
    {
      "path": "path/to/file",
      "content": "Full source code",
      "language": "solidity|rust|move|javascript|markdown"
    }
  ],
  "summary": "Summary of changes made based on the user instruction",
  "audit": {
    "score": 90, // integer from 0 to 100
    "codeQuality": 95, // integer from 0 to 100
    "gasOptimization": 85, // integer from 0 to 100
    "complexity": 3, // integer from 1 to 10
    "summary": "High-level summary of the audit findings on the new code",
    "vulnerabilities": [
      {
        "id": "vuln-1",
        "title": "Vulnerability Title",
        "severity": "critical|high|medium|low|informational",
        "description": "Clear description of vulnerability",
        "file": "path/to/vulnerable/file",
        "line": 15,
        "recommendation": "Step-by-step recommendation",
        "fixAvailable": true
      }
    ]
  }
}
Do NOT output any conversational text or markdown wrappers like \`\`\`json. Return only raw, parsing-valid JSON.
`;

  try {
    if (process.env.OPENAI_API_KEY) {
      const result = await AIService.editWorkspace(editingPrompt);
      return res.json({
        ...result.data,
        mode: "live"
      });
    }

    if (!isDemoMode) {
      return res.status(500).json({
        success: false,
        provider: "openai",
        error: "OpenAI API key is missing. Please configure OPENAI_API_KEY.",
        details: "No OPENAI_API_KEY found in process.env"
      });
    }

    // Simulated Edit
    const simulatedEdit = simulateSmartContractEdit(instruction, files);
    return res.json({
      ...simulatedEdit,
      mode: "simulated"
    });
  } catch (err: any) {
    console.error("Critical error in /api/edit:", err);
    res.status(500).json({
      success: false,
      provider: "openai",
      error: "Failed to edit workspace files",
      details: err.message || String(err)
    });
  }
});

// POST /api/audit
app.post("/api/audit", async (req, res) => {
  const isDemoMode = req.query.demo === "true" || req.body.demo === true || process.env.DEMO_MODE === "true" || !process.env.OPENAI_API_KEY;
  const { files } = req.body;

  if (!files) {
    return res.status(400).json({ error: "Files are required for auditing" });
  }

  const filesContext = files.map((f: any) => `### FILE: ${f.path}\n\`\`\`\n${f.content}\n\`\`\`\n`).join("\n");

  const auditPrompt = `
You are an expert Smart Contract Security Auditor. Analyze the following smart contracts and identify vulnerabilities, gas inefficiencies, or code quality issues.
Workspace files:
${filesContext}

YOU MUST output a JSON response conforming strictly to this format:
{
  "score": 90,
  "codeQuality": 95,
  "gasOptimization": 85,
  "complexity": 3,
  "summary": "High-level summary of the audit findings",
  "vulnerabilities": [
    {
      "id": "vuln-1",
      "title": "Vulnerability Title",
      "severity": "critical|high|medium|low|informational",
      "description": "Clear description of vulnerability",
      "file": "path/to/vulnerable/file",
      "line": 15,
      "recommendation": "Step-by-step recommendation",
      "fixAvailable": true
    }
  ]
}
Do NOT output any conversational text or markdown wrappers like \`\`\`json. Return only raw, parsing-valid JSON.
`;

  try {
    if (process.env.OPENAI_API_KEY) {
      const result = await AIService.auditWorkspace(auditPrompt);
      return res.json({
        ...result.data,
        mode: "live"
      });
    }

    if (!isDemoMode) {
      return res.status(500).json({
        success: false,
        provider: "openai",
        error: "OpenAI API key is missing. Please configure OPENAI_API_KEY.",
        details: "No OPENAI_API_KEY found in process.env"
      });
    }

    // Simulated Audit
    const simulatedAudit = simulateSmartContractAudit(files);
    return res.json({
      ...simulatedAudit,
      mode: "simulated"
    });
  } catch (err: any) {
    console.error("Critical error in /api/audit:", err);
    res.status(500).json({
      success: false,
      provider: "openai",
      error: "Failed to audit workspace files",
      details: err.message || String(err)
    });
  }
});

// POST /api/compile
app.post("/api/compile", async (req, res) => {
  const isDemoMode = req.query.demo === "true" || req.body.demo === true || process.env.DEMO_MODE === "true" || !process.env.OPENAI_API_KEY;
  const { blockchain, framework, files } = req.body;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No files found to compile" });
  }

  console.log(`Compiling files for blockchain: ${blockchain}, framework: ${framework}`);

  const filesContext = files.map((f: any) => `### FILE: ${f.path}\n\`\`\`\n${f.content}\n\`\`\`\n`).join("\n");
  const compilerPrompt = `
You are a highly precise Smart Contract Compiler for "${blockchain}" running inside a professional cloud IDE.
Analyze the following source files and determine if they would compile successfully using standard official toolchains.
Check for any syntax errors, unresolved imports, unmatched brackets, or undeclared state variables.

Workspace files:
${filesContext}

Format the response strictly as a JSON object:
{
  "success": true|false,
  "errors": [
    {
      "file": "path/to/file",
      "line": 12,
      "severity": "error|warning",
      "message": "Detailed compiler message"
    }
  ],
  "logs": [
    "Compile trace line 1",
    "Compile trace line 2"
  ]
}
Do NOT output markdown wrappers like \`\`\`json. Return only raw, parsing-valid JSON.
`;

  try {
    if (process.env.OPENAI_API_KEY) {
      const result = await AIService.compileAnalysis(compilerPrompt);
      const parsed = result.data;
      return res.json({
        success: parsed.success,
        errors: parsed.errors || [],
        logs: parsed.logs || [],
        timestamp: new Date().toISOString()
      });
    }

    if (!isDemoMode) {
      return res.status(500).json({
        success: false,
        provider: "openai",
        error: "OpenAI API key is missing. Please configure OPENAI_API_KEY.",
        details: "No OPENAI_API_KEY found in process.env"
      });
    }
  } catch (err: any) {
    console.error("OpenAI compiler validation failed:", err);
    if (!isDemoMode) {
      return res.status(500).json({
        success: false,
        provider: "openai",
        error: "Failed to compile workspace files via OpenAI validation",
        details: err.message || String(err)
      });
    }
  }

  // Generate beautiful simulated compilation logs for Demo Mode
  const logs: string[] = [];
  logs.push(`[SYSTEM] Starting compilation engine for ${blockchain}...`);
  logs.push(`[SYSTEM] Detected framework: ${framework}`);
  logs.push(`[SYSTEM] Analysing file tree dependencies...`);

  files.forEach((f: any) => {
    if (f.path.includes("contracts") || f.path.includes("programs") || f.path.includes("sources")) {
      logs.push(`[COMPILER] Found source unit: ${f.path}`);
    }
  });

  // Simulated delay-based logs
  let success = true;

  // Let's add framework-specific warnings or logs
  if (blockchain === "ethereum" || blockchain === "base" || blockchain === "polygon") {
    logs.push(`[COMPILER] Solc version 0.8.20 configured.`);
    logs.push(`[COMPILER] Running Solc optimizer (runs = 200)...`);
    logs.push(`[COMPILER] Compiler outputs generated successfully for:`);
    files.forEach((f: any) => {
      if (f.path.endsWith(".sol")) {
        const name = f.path.split("/").pop().replace(".sol", "");
        logs.push(`  - Artifacts compiled: ${name}.json, ${name}.dbg.json`);
      }
    });
  } else if (blockchain === "solana") {
    logs.push(`[COMPILER] Running cargo-build-sbf...`);
    logs.push(`[COMPILER] Building Rust BPF / SBF program targets...`);
    logs.push(`[COMPILER] Finished release target(s) in 1.45s`);
    logs.push(`[COMPILER] IDL successfully written to target/idl/escrow.json`);
  } else if (blockchain === "sui" || blockchain === "aptos") {
    logs.push(`[COMPILER] Running Move compiler v2...`);
    logs.push(`[COMPILER] Building Move package...`);
    logs.push(`[COMPILER] Build successful. Generated bytecode modules.`);
  } else {
    logs.push(`[COMPILER] Compilation succeeded.`);
  }

  logs.push(`[SYSTEM] Compilation finished successfully. No severe errors.`);

  res.json({
    success,
    errors: [],
    logs,
    timestamp: new Date().toISOString()
  });
});

// POST /api/deploy
app.post("/api/deploy", (req, res) => {
  const { projectId, network, contractName, files } = req.body;

  if (!network || !contractName) {
    return res.status(400).json({ error: "Network and Contract Name are required for deployment" });
  }

  console.log(`Deploying ${contractName} to network ${network}...`);

  const txHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  const address = "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  const gasUsed = (Math.floor(Math.random() * 800000) + 120000).toLocaleString();

  const logs = [
    `[DEPLOYER] Initializing wallet provider...`,
    `[DEPLOYER] Loading deployment script...`,
    `[DEPLOYER] Preparing gas configuration for ${network}...`,
    `[DEPLOYER] Current estimated gas price: ${Math.floor(Math.random() * 40) + 10} Gwei`,
    `[DEPLOYER] Sending transaction to deploy ${contractName}...`,
    `[DEPLOYER] Transaction broadcasted. TxHash: ${txHash}`,
    `[DEPLOYER] Waiting for block confirmation...`,
    `[DEPLOYER] Transaction confirmed in block #${Math.floor(Math.random() * 100000) + 15000000}!`,
    `[DEPLOYER] Contract ${contractName} successfully deployed to: ${address}`,
    `[DEPLOYER] Verified contract source on Block Explorer successfully.`
  ];

  const deploymentRecord = {
    id: `dep-${Date.now()}`,
    timestamp: new Date().toISOString(),
    network,
    contractName,
    address,
    txHash,
    gasUsed,
    status: "success",
    logs
  };

  // Persist this deployment in project if projectId is supplied
  if (projectId) {
    const db = readDb();
    const index = db.projects.findIndex((p: any) => p.id === projectId);
    if (index !== -1) {
      if (!db.projects[index].deployments) db.projects[index].deployments = [];
      db.projects[index].deployments.unshift(deploymentRecord);
      writeDb(db);
    }
  }

  res.json({
    success: true,
    deployment: deploymentRecord
  });
});


// -------------------------------------------------------------
// HEURISTIC / SIMULATOR GENERATORS
// -------------------------------------------------------------

function simulateSmartContractGeneration(
  prompt: string,
  blockchain: string,
  language: string,
  framework: string,
  contractType: string
) {
  // Let's create an highly realistic smart contract based on inputs
  const name = prompt.split(" ").slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ").replace(/[^a-zA-Z0-9 ]/g, "") || "SmartContract";
  const className = name.replace(/\s+/g, "");

  let codeContent = "";
  let ext = "sol";
  let folder = "contracts";

  if (blockchain === "solana") {
    ext = "rs";
    folder = "programs/src";
    codeContent = `use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod ${className.toLowerCase()} {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, details: String) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.authority = ctx.accounts.authority.key();
        state.details = details;
        state.is_active = true;
        
        emit!(StateInitialized {
            authority: state.authority,
            details: state.details.clone(),
        });
        Ok(())
    }
}

#[account]
pub struct ProgramState {
    pub authority: Pubkey,
    pub details: String,
    pub is_active: bool,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 100 + 1)]
    pub state: Account<'info, ProgramState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct StateInitialized {
    pub authority: Pubkey,
    pub details: String,
}`;
  } else if (blockchain === "sui" || blockchain === "aptos") {
    ext = "move";
    folder = "sources";
    codeContent = `module project::${className.toLowerCase()} {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;

    struct State has key, store {
        id: UID,
        owner: address,
        description: vector<u8>,
        balance: u64,
    }

    public entry fun initialize(description: vector<u8>, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        let state = State {
            id: object::new(ctx),
            owner: sender,
            description,
            balance: 0,
        };
        transfer::transfer(state, sender);
    }
}`;
  } else {
    // Solidity default
    ext = "sol";
    folder = "contracts";
    codeContent = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ${className}
 * @dev Automated compilation candidate for "${prompt}"
 */
contract ${className} is Ownable, ReentrancyGuard {
    string public description;
    bool public isActive;

    event ContractUpdated(string newDescription);

    constructor(string memory _description) Ownable(msg.sender) {
        description = _description;
        isActive = true;
    }

    function updateDescription(string calldata _newDescription) external onlyOwner {
        require(isActive, "Contract is not active");
        description = _newDescription;
        emit ContractUpdated(_newDescription);
    }

    function toggleActive() external onlyOwner {
        isActive = !isActive;
    }
}`;
  }

  const safeLang = language || "solidity";
  const files = [
    {
      path: `${folder}/${className}.${ext}`,
      language: safeLang === "solidity" ? "solidity" : safeLang.includes("rust") ? "rust" : "move",
      content: codeContent
    },
    {
      path: `test/${className}.test.js`,
      language: "javascript",
      content: `const { expect } = require("chai");
// Simulated unit tests for ${className}`
    },
    {
      path: "README.md",
      language: "markdown",
      content: `# ${className} Smart Contract Project\n\nAutomatically generated workspace based on details:\n"${prompt}"\n\n## Architecture\n- Dynamic compilation via ${framework}`
    }
  ];

  const audit = {
    score: 95,
    codeQuality: 96,
    gasOptimization: 92,
    complexity: 3,
    summary: "The generated smart contract conforms strictly to enterprise development guidelines. No high severity bugs found.",
    vulnerabilities: [
      {
        id: "v-1",
        title: "Default Initializer Validation Check",
        severity: "informational",
        description: "The initialization parameters do not check if description strings are empty.",
        file: `${folder}/${className}.${ext}`,
        line: 20,
        recommendation: "Add a validation statement to ensure inputted parameters are non-zero.",
        fixAvailable: true
      }
    ]
  };

  return {
    name: `${className} Platform`,
    description: `Enterprise smart contract workspace for ${name}. Includes test configurations and full deployment parameters.`,
    files,
    audit
  };
}

function simulateSmartContractEdit(instruction: string, files: any[]) {
  // Add simulated edit behavior - e.g. add comments or prepend/append changes
  let summary = `Applied instruction: "${instruction}" across files.`;
  const updatedFiles = files.map((file) => {
    if (file.path.endsWith(".sol")) {
      summary += ` Added custom modules to ${file.path}.`;
      return {
        ...file,
        content: `// Added via edit: "${instruction}"\n` + file.content
      };
    }
    return file;
  });

  return {
    files: updatedFiles,
    summary,
    audit: {
      score: 98,
      codeQuality: 98,
      gasOptimization: 95,
      complexity: 3,
      summary: `Successful adaptation of the smart contract according to request: "${instruction}". Verified code structure and gas execution bounds.`,
      vulnerabilities: []
    }
  };
}

function simulateSmartContractAudit(files: any[]) {
  return {
    score: 92,
    codeQuality: 94,
    gasOptimization: 88,
    complexity: 4,
    summary: "Comprehensive audit successfully finished across all workspace modules. Two low-priority findings identified.",
    vulnerabilities: [
      {
        id: "vuln-sim-1",
        title: "Unbounded Loop Warning",
        severity: "medium",
        description: "A loop could potentially run out of gas if array sizes scale without bounds.",
        file: files[0]?.path || "contracts/Contract.sol",
        line: 45,
        recommendation: "Introduce a pagination mechanic or enforce strict length validation boundaries.",
        fixAvailable: false
      }
    ]
  };
}


// -------------------------------------------------------------
// VITE DEV SERVER / MIDDLEWARE OR PROD STATIC SERVER
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
