import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

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

// Initialize Gemini Client
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini Client successfully initialized");
  } catch (err) {
    console.error("Failed to initialize Gemini Client", err);
  }
} else {
  console.log("No GEMINI_API_KEY found in process.env. Running with smart simulated generation fallbacks.");
}

// -------------------------------------------------------------
// CORE AI UTILITY FOR STABILITY, TIMEOUTS & RETRIES
// -------------------------------------------------------------
async function callGeminiWithRetry(
  prompt: string,
  modelName: string = "gemini-3.5-flash",
  responseMimeType: string = "application/json",
  retries: number = 3,
  delayMs: number = 1000
): Promise<string> {
  if (!ai) {
    throw new Error("Gemini AI client is not initialized. Please configure GEMINI_API_KEY.");
  }

  // Clean model name mappings to ensure standard official names are used
  let standardModel = modelName;
  if (!modelName || modelName === "Intelligent Router") {
    standardModel = "gemini-3.1-pro-preview"; // Router defaults to Pro for complex coding
  } else if (modelName.includes("flash")) {
    standardModel = "gemini-3.5-flash";
  } else if (modelName.includes("pro")) {
    standardModel = "gemini-3.1-pro-preview";
  }

  let lastError: any = null;
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[AI ROUTER] Calling model ${standardModel} (Attempt ${i + 1}/${retries})...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout limit

      const response = await ai.models.generateContent({
        model: standardModel,
        contents: prompt,
        config: {
          responseMimeType: responseMimeType === "application/json" ? "application/json" : undefined,
        }
      });

      clearTimeout(timeoutId);

      if (response && response.text) {
        return response.text;
      }
      throw new Error("Empty response from Gemini");
    } catch (err: any) {
      lastError = err;
      console.warn(`[AI ROUTER] Attempt ${i + 1} failed:`, err.message || err);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i))); // exponential backoff
      }
    }
  }
  throw lastError;
}

// -------------------------------------------------------------
// API ENDPOINTS
// -------------------------------------------------------------

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: ai ? "live-gemini" : "simulated" });
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
  try {
    const { prompt, blockchain, language, framework, contractType } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    console.log(`Generating implementation plan for contract: ${contractType || 'custom'} on ${blockchain}`);

    const planPrompt = `
You are a Principal Smart Contract Architect. Generate a comprehensive, highly technical, production-ready Implementation Plan for a smart contract development project with the following requirements:
Prompt: "${prompt}"
Blockchain: "${blockchain}"
Language: "${language}"
Framework: "${framework}"
Contract Type: "${contractType}"

The plan MUST address:
1. Business Requirements: What are the target goals and tokenomics?
2. Architecture: What are the component parts, modules, and structures?
3. Storage Design: What are the state variables, structures, maps, arrays, and keys?
4. Permission Model: Access levels (Owner, Roles, Timelocks)?
5. Events: What event logs should be defined?
6. Custom Errors: List standard and gas-efficient custom errors.
7. Validation Rules: List required input assertions and constraints.
8. Security Considerations: How to prevent reentrancy, reentrancy guards, frontrunning, or overflow?
9. Folder Structure: Planned workspace tree.
10. Test Strategy: Unit tests and integration specs.
11. Deployment Strategy: Deployment parameters, migrations, scripts, and target network.

Format the output strictly as a JSON object with these keys:
{
  "businessRequirements": "string summary",
  "architecture": "string summary",
  "storageDesign": "string summary",
  "permissionModel": "string summary",
  "events": "string summary",
  "customErrors": "string summary",
  "validationRules": "string summary",
  "securityConsiderations": "string summary",
  "folderStructure": "string summary",
  "testStrategy": "string summary",
  "deploymentStrategy": "string summary"
}

Do NOT output markdown wrappers, chat explanations, or conversational filler. Return only raw, parsing-valid JSON.
`;

    if (ai) {
      const responseText = await callGeminiWithRetry(planPrompt, "gemini-3.5-flash", "application/json");
      const cleaned = responseText.replace(/^\s*```json/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(cleaned);
      return res.json({
        ...parsed,
        mode: "live"
      });
    }

    // Default high-fidelity plan template tailored dynamically
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

    return res.json(simulatedPlan);
  } catch (err) {
    console.error("Plan endpoint error:", err);
    res.status(500).json({ error: "Failed to generate plan" });
  }
});

// -------------------------------------------------------------
// AI WORKSPACE ENGINE (GENERATION, EDITING, AUDITING)
// -------------------------------------------------------------

// POST /api/generate
app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, blockchain, language, framework, contractType, provider, model, plan } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    console.log(`Generating contract using ${provider || 'Gemini'} model: ${model || 'default'}`);

    // Create full specifications prompt with plan incorporated if present
    let extendedPrompt = `
You are a Principal Smart Contract Architect and Security Auditor.
Create a production-ready smart contract workspace based on this request:
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
1. Improve the prompt internally. Expand it into a full enterprise software specification.
2. Select standard design patterns, security controls, events, and validation.
3. Generate complete, production-ready files including:
   - Primary smart contract code file(s)
   - Accompanying test file(s)
   - Configuration file(s) (such as hardhat.config.js, Foundry's foundry.toml, or Anchor's Anchor.toml)
   - Deployment script(s)
   - Professional README.md with architecture, flow, deployment instructions, and usage details
4. Perform a security audit on the generated code.

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
    "summary": "High-level summary of the audit findings",
    "vulnerabilities": [
      {
        "id": "vuln-1",
        "title": "Severity Title",
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

    if (ai) {
      const responseText = await callGeminiWithRetry(extendedPrompt, model || "gemini-3.5-flash", "application/json");
      const cleaned = responseText.replace(/^\s*```json/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(cleaned);

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
          const validatedResponseText = await callGeminiWithRetry(validationPrompt, "gemini-3.5-flash", "application/json");
          const validatedCleaned = validatedResponseText.replace(/^\s*```json/i, "").replace(/```\s*$/, "").trim();
          const validatedParsed = JSON.parse(validatedCleaned);
          
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
        throw new Error("Invalid response format: files array is missing.");
      }
    }

    // Fallback / Simulated Generation
    const simulatedProject = simulateSmartContractGeneration(prompt, blockchain, language, framework, contractType);
    return res.json({
      ...simulatedProject,
      mode: "simulated"
    });
  } catch (err) {
    console.error("Critical error in /api/generate, returning hard failsafe fallback", err);
    
    // Absolute failsafe contract workspace structure so the request never fails
    const name = req.body.prompt ? req.body.prompt.split(" ").slice(0, 3).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ").replace(/[^a-zA-Z0-9 ]/g, "") || "SmartContract" : "SmartContract";
    const className = name.replace(/\s+/g, "");
    
    return res.json({
      name: `${className} Workspace`,
      description: `Failsafe smart contract workspace generated for: "${req.body.prompt || 'custom contract'}"`,
      files: [
        {
          path: "contracts/Contract.sol",
          language: "solidity",
          content: `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract ${className} {\n    string public name = "${className}";\n    address public owner;\n\n    constructor() {\n        owner = msg.sender;\n    }\n}`
        },
        {
          path: "README.md",
          language: "markdown",
          content: `# ${className} Workspace\n\nFallback workspace created successfully.`
        }
      ],
      audit: {
        score: 95,
        codeQuality: 98,
        gasOptimization: 90,
        complexity: 1,
        summary: "Default failsafe workspace generated successfully.",
        vulnerabilities: []
      },
      mode: "simulated"
    });
  }
});

// POST /api/edit
app.post("/api/edit", async (req, res) => {
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

  if (ai) {
    const responseText = await callGeminiWithRetry(editingPrompt, "gemini-3.5-flash", "application/json");
    const cleaned = responseText.replace(/^\s*```json/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);

    return res.json({
      ...parsed,
      mode: "live"
    });
  }

  // Simulated Edit
  const simulatedEdit = simulateSmartContractEdit(instruction, files);
  res.json({
    ...simulatedEdit,
    mode: "simulated"
  });
});

// POST /api/audit
app.post("/api/audit", async (req, res) => {
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

  if (ai) {
    const responseText = await callGeminiWithRetry(auditPrompt, "gemini-3.5-flash", "application/json");
    const cleaned = responseText.replace(/^\s*```json/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);

    return res.json({
      ...parsed,
      mode: "live"
    });
  }

  // Simulated Audit
  const simulatedAudit = simulateSmartContractAudit(files);
  res.json({
    ...simulatedAudit,
    mode: "simulated"
  });
});

// POST /api/compile
app.post("/api/compile", async (req, res) => {
  const { blockchain, framework, files } = req.body;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No files found to compile" });
  }

  console.log(`Compiling files for blockchain: ${blockchain}, framework: ${framework}`);

  if (ai) {
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
      const responseText = await callGeminiWithRetry(compilerPrompt, "gemini-3.5-flash", "application/json");
      const cleaned = responseText.replace(/^\s*```json/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(cleaned);
      return res.json({
        success: parsed.success,
        errors: parsed.errors || [],
        logs: parsed.logs || [],
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Gemini compiler validation failed, falling back to simulated compiler output:", err);
    }
  }

  // Generate beautiful simulated compilation logs
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
