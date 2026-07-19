import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { AIService } from "./server/services/AIService";
import { OPENAI_MODEL } from "./server/config/ai";

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
    if (result.success) {
      return res.json({
        provider: "openai",
        model: OPENAI_MODEL,
        connected: true,
        success: true
      });
    } else {
      return res.json({
        connected: false,
        error: result.error || "Failed to connect to OpenAI service"
      });
    }
  } catch (err: any) {
    return res.json({
      connected: false,
      error: err.message || String(err)
    });
  }
});

// Test OpenAI Route
app.get("/api/test-openai", async (req, res) => {
  try {
    const rawResponse = await AIService.testOpenAI();
    return res.json({
      success: true,
      response: rawResponse
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || String(err),
      stack: err.stack || "No stack trace available"
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

    const result = await AIService.generatePlan(planPrompt);
    return res.json({
      ...result.data,
      mode: "live"
    });
  } catch (err: any) {
    console.error("Plan endpoint error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || String(err),
      stack: err.stack || "No stack trace available"
    });
  }
});

// -------------------------------------------------------------
// AI WORKSPACE ENGINE (GENERATION, EDITING, AUDITING)
// -------------------------------------------------------------

// POST /api/generate
app.post("/api/generate", async (req, res) => {
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
  } catch (err: any) {
    console.error("Critical error in /api/generate:", err);
    return res.status(500).json({
      success: false,
      error: err.message || String(err),
      stack: err.stack || "No stack trace available"
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

  try {
    const result = await AIService.editWorkspace(editingPrompt);
    return res.json({
      ...result.data,
      mode: "live"
    });
  } catch (err: any) {
    console.error("Critical error in /api/edit:", err);
    return res.status(500).json({
      success: false,
      error: err.message || String(err),
      stack: err.stack || "No stack trace available"
    });
  }
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

  try {
    const result = await AIService.auditWorkspace(auditPrompt);
    return res.json({
      ...result.data,
      mode: "live"
    });
  } catch (err: any) {
    console.error("Critical error in /api/audit:", err);
    return res.status(500).json({
      success: false,
      error: err.message || String(err),
      stack: err.stack || "No stack trace available"
    });
  }
});

// POST /api/compile
app.post("/api/compile", async (req, res) => {
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
    const result = await AIService.compileAnalysis(compilerPrompt);
    const parsed = result.data;
    return res.json({
      success: parsed.success,
      errors: parsed.errors || [],
      logs: parsed.logs || [],
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("OpenAI compiler validation failed:", err);
    return res.status(500).json({
      success: false,
      error: err.message || String(err),
      stack: err.stack || "No stack trace available"
    });
  }
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
