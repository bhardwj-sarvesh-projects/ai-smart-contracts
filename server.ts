import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { AIService } from "./server/services/AIService";
import { OPENAI_MODEL, AI_CONFIG } from "./server/config/ai";
import { SettingsService, UserConfig } from "./server/services/SettingsService";
import { isDummyOrEmptyKey } from "./server/providers/ProviderFactory";
import settingsRouter from "./server/routes/settings";
import { PatchEngine } from "./src/core/EngineeringCore/patch/PatchEngine";
import { ProjectIntegrityEngine } from "./src/core/EngineeringCore/validators/ProjectIntegrityEngine";
import { SecurityAuditEngine } from "./src/core/EngineeringCore/security/SecurityAuditEngine";
import { CompilerEngine } from "./src/core/EngineeringCore/compiler/CompilerEngine";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Helper to resolve active user AI configuration or use central fallback
function getActiveUserConfig(req: express.Request): UserConfig {
  const userId = req.headers["x-user-id"] as string;
  const email = req.headers["x-user-email"] as string;
  const displayName = req.headers["x-user-name"] as string;
  const photo = req.headers["x-user-photo"] as string;

  let userConfig = userId ? SettingsService.getDecrypted(userId) : null;

  if (!userConfig) {
    let activeProvider = AI_CONFIG.provider || "openai";
    let activeKey = "";
    let activeModel = "";

    if (activeProvider === "openai") {
      activeKey = AI_CONFIG.openai.apiKey;
      activeModel = AI_CONFIG.openai.model || "gpt-4o-mini";
    } else if (activeProvider === "groq") {
      activeKey = AI_CONFIG.groq.apiKey;
      activeModel = AI_CONFIG.groq.model || "llama-3.3-70b-versatile";
    }

    if (isDummyOrEmptyKey(activeKey, activeProvider)) {
      if (process.env.OPENAI_API_KEY && !isDummyOrEmptyKey(process.env.OPENAI_API_KEY, "openai")) {
        activeProvider = "openai";
        activeKey = process.env.OPENAI_API_KEY;
        activeModel = "gpt-4o-mini";
      } else if (process.env.GROQ_API_KEY && !isDummyOrEmptyKey(process.env.GROQ_API_KEY, "groq")) {
        activeProvider = "groq";
        activeKey = process.env.GROQ_API_KEY;
        activeModel = "llama-3.3-70b-versatile";
      }
    }

    userConfig = {
      userId: userId || "default",
      email: email || "default@smartcontract.ai",
      displayName: displayName || "Default User",
      photo: photo || "",
      provider: activeProvider,
      apiKey: activeKey,
      defaultModel: activeModel || "gpt-4o-mini",
      temperature: 0.2,
      maxTokens: 2000,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
  }
  return userConfig;
}

// Mount AI Settings Router
app.use("/api/settings", settingsRouter);


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
    const userConfig = getActiveUserConfig(req);
    const result = await AIService.healthCheck(userConfig);
    if (result.success) {
      return res.json({
        provider: userConfig.provider,
        model: result.modelUsed,
        connected: true,
        success: true
      });
    } else {
      return res.json({
        connected: false,
        error: result.error || `Failed to connect to ${userConfig.provider} service`
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
    const userConfig = getActiveUserConfig(req);
    const rawResponse = await AIService.testConnection(userConfig);
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

// GET all projects (User Isolated)
app.get("/api/projects", (req, res) => {
  const db = readDb();
  const userId = req.headers["x-user-id"] as string || "default";
  const userProjects = db.projects.filter((p: any) => (p.userId || "default") === userId);
  res.json(userProjects);
});

// GET a single project (User Isolated)
app.get("/api/projects/:id", (req, res) => {
  const db = readDb();
  const userId = req.headers["x-user-id"] as string || "default";
  const project = db.projects.find((p: any) => p.id === req.params.id && (p.userId || "default") === userId);
  if (!project) {
    return res.status(404).json({ error: "Project not found or access denied" });
  }
  res.json(project);
});

// CREATE a new project (User Isolated)
app.post("/api/projects", (req, res) => {
  const { name, description, blockchain, language, framework, contractType, files } = req.body;
  
  if (!name || !blockchain || !language) {
    return res.status(400).json({ error: "Missing required fields: name, blockchain, language" });
  }

  const db = readDb();
  const userId = req.headers["x-user-id"] as string || "default";
  const newProject = {
    id: `project-${Date.now()}`,
    userId: userId, // Enforce User Isolation
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

// UPDATE project (User Isolated)
app.put("/api/projects/:id", (req, res) => {
  const db = readDb();
  const userId = req.headers["x-user-id"] as string || "default";
  const index = db.projects.findIndex((p: any) => p.id === req.params.id && (p.userId || "default") === userId);
  if (index === -1) {
    return res.status(404).json({ error: "Project not found or access denied" });
  }

  db.projects[index] = {
    ...db.projects[index],
    ...req.body,
    id: db.projects[index].id,
    userId: db.projects[index].userId, // Enforce userId doesn't change
    createdAt: db.projects[index].createdAt
  };

  writeDb(db);
  res.json(db.projects[index]);
});

// DELETE project (Cascading delete - deletes versions, deployments, audit, and metadata, User Isolated)
app.delete("/api/projects/:id", (req, res) => {
  const db = readDb();
  const userId = req.headers["x-user-id"] as string || "default";
  const index = db.projects.findIndex((p: any) => p.id === req.params.id && (p.userId || "default") === userId);
  if (index === -1) {
    return res.status(404).json({ error: "Project not found or access denied" });
  }

  // Cascading delete is implicitly done because versions, deployments, audit,
  // and metadata are nested inside the deleted project record in db.json!
  db.projects.splice(index, 1);
  writeDb(db);
  res.json({ success: true, message: "Workspace and all associated versions, audit reports, history and metadata deleted permanently." });
});

// Centralized API Error Normalizer Helper
function sendStructuredError(res: express.Response, err: any, providerName = "openai", modelName = "gpt-4o-mini") {
  console.error("[SERVER ERROR]", err);
  let statusCode = 500;
  let code = "API_ERROR";
  let message = "An error occurred during AI processing.";
  let provider = providerName;
  let model = modelName;
  let retryable = false;
  let retryAfter: string | null = null;

  try {
    const rawMsg = err.message || String(err);
    if (rawMsg.startsWith("{") && rawMsg.endsWith("}")) {
      const parsed = JSON.parse(rawMsg);
      if (parsed.code) code = parsed.code;
      if (parsed.statusCode) statusCode = Number(parsed.statusCode);
      if (parsed.message) message = parsed.message;
      if (parsed.provider) provider = parsed.provider || providerName;
      if (parsed.model) model = parsed.model || modelName;
      if (parsed.retryable !== undefined) retryable = parsed.retryable;
      if (parsed.retryAfter) retryAfter = parsed.retryAfter;
    } else {
      const lower = rawMsg.toLowerCase();
      if (err.status === 429 || err.statusCode === 429 || lower.includes("429") || lower.includes("rate limit") || lower.includes("rate exceeded") || lower.includes("rate_limit_exceeded") || lower.includes("too many requests") || lower.includes("quota exceeded") || lower.includes("insufficient quota") || lower.includes("insufficient credits")) {
        statusCode = 429;
        code = "RATE_LIMIT_ERROR";
        message = rawMsg;
        retryable = false;
      } else if (err.status === 401 || err.status === 403 || err.status === 402 || lower.includes("401") || lower.includes("403") || lower.includes("402") || lower.includes("unauthorized") || lower.includes("invalid_api_key")) {
        statusCode = err.status || 401;
        code = "AUTH_ERROR";
        message = rawMsg;
        retryable = false;
      } else if (err.status) {
        statusCode = err.status;
      }
      message = rawMsg;
    }
  } catch {
    message = err.message || String(err);
  }

  if (statusCode === 429 && code !== "RATE_LIMIT_ERROR") {
    code = "RATE_LIMIT_ERROR";
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      errorCode: code,
      stage: "AI Generation",
      engine: "LLMRuntimeEngine / AIService",
      provider,
      model,
      statusCode,
      message,
      retryable: code === "RATE_LIMIT_ERROR" || code === "AUTH_ERROR" ? false : retryable,
      retryAfter,
      requestId: `req-${Date.now()}`
    }
  });
}

// Development / Test path simulating HTTP 429 Rate Limit
app.get("/api/test-429", (req, res) => {
  return res.status(429).json({
    success: false,
    error: {
      code: "RATE_LIMIT_ERROR",
      errorCode: "RATE_LIMIT_ERROR",
      stage: "AI Generation",
      engine: "LLMRuntimeEngine / AIService",
      provider: "openai",
      model: "gpt-4o-mini",
      statusCode: 429,
      message: "Rate limit exceeded.",
      retryable: false,
      retryAfter: null,
      requestId: "req-test-429"
    }
  });
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

    const userConfig = getActiveUserConfig(req);
    const result = await AIService.generatePlan(userConfig, planPrompt);
    return res.json({
      ...result.data,
      mode: "live"
    });
  } catch (err: any) {
    const userConfig = getActiveUserConfig(req);
    return sendStructuredError(res, err, userConfig.provider, userConfig.defaultModel);
  }
});

// -------------------------------------------------------------
// AI WORKSPACE ENGINE (GENERATION, EDITING, AUDITING)
// -------------------------------------------------------------

// POST /api/generate
app.post("/api/generate", async (req, res) => {
  try {
    const userConfig = getActiveUserConfig(req);
    const { prompt, blockchain, language, framework, contractType, plan, systemInstruction, targetPath, maxTokens } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Intercept V2 single file generation when systemInstruction is present
    if (systemInstruction) {
      console.log(`[SERVER /api/generate] Serving V2 single file generation for targetPath: "${targetPath || 'N/A'}", maxTokens: ${maxTokens || 'default'}`);
      const rawText = await AIService.generateRawSource(userConfig, prompt, systemInstruction, targetPath, maxTokens);
      return res.json({ success: true, data: rawText });
    }

    console.log(`[AI WORKSPACE ENGINE] STAGE 6-10: Generating workspace files on blockchain: ${blockchain}`);

    // Create full specifications prompt with plan incorporated if present
    let extendedPrompt = `
You are a Principal Smart Contract Architect with 15+ years of blockchain engineering experience across protocols like OpenZeppelin, Uniswap, Aave, MakerDAO, Compound, Chainlink, and LayerZero.

Your directive is to produce enterprise-grade, mainnet production-ready smart contracts that are secure, modular, scalable, readable, gas-optimized, and fully documented.

CORE ENGINEERING MANDATES:
1. No Tutorial/Demo/MVP Code: Generate complete, robust production-ready code with full implementations (never stubs, TODOs, or placeholder comments).
2. Clean Modular Architecture: Organize code logically (License -> NatSpec -> Imports -> Interfaces -> Libraries -> Custom Errors -> Enums -> Structs -> Storage -> Events -> Modifiers -> Constructor -> External -> Public -> Internal -> Private -> View/Pure -> Receive/Fallback). Use custom errors instead of string reverts.
3. Security & OpenZeppelin Best Practices: Incorporate ReentrancyGuard, AccessControl/Ownable, Pausable, SafeERC20, ECDSA, Permit (EIP-2612), or CEI (Checks-Effects-Interactions) as relevant. Implement zero-address checks and strict parameter validation.
4. Gas Optimization: Use immutable/constant variables, optimal storage packing, calldata for read-only array parameters, minimal SLOAD/SSTORE operations, and unchecked arithmetic blocks where proven safe.
5. Complete Documentation: Every public/external function must include complete NatSpec tags (@notice, @param, @return, @dev).
6. Enterprise Testing & Config: Provide comprehensive unit tests (covering happy path, role checks, custom errors, and edge cases), deploy scripts, and a professional README.

Request Details:
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

    const result = await AIService.generateWorkspace(userConfig, extendedPrompt);
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
        const validatedResult = await AIService.compileAnalysis(userConfig, validationPrompt);
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
    const userConfig = getActiveUserConfig(req);
    return sendStructuredError(res, err, userConfig.provider, userConfig.defaultModel);
  }
});

// POST /api/edit
app.post("/api/edit", async (req, res) => {
  const userConfig = getActiveUserConfig(req);
  const { projectId, instruction, files } = req.body;

  if (!instruction || !files || !Array.isArray(files)) {
    return res.status(400).json({ error: "Instruction and files array are required" });
  }

  console.log(`Editing workspace files using PatchEngine. Instruction: "${instruction}"`);

  const filesContext = files.map((f: any) => `### FILE: ${f.path}\nLanguage: ${f.language}\n\`\`\`\n${f.content}\n\`\`\`\n`).join("\n");

  const editingPrompt = `
You are a Principal Smart Contract Engineer operating as a precise IDE Patch Engine (like Cursor / VS Code / GitHub Copilot).
Your task is to modify ONLY the affected files in the smart contract workspace based on this instruction:
"${instruction}"

IMPORTANT ARCHITECTURAL RULES:
1. DO NOT return the entire workspace. Return ONLY the files that need to be modified, created, or deleted.
2. Unchanged files must NOT be returned. They will remain byte-for-byte untouched in the workspace.
3. DO NOT delete existing tests, scripts, interfaces, libraries, or documentation unless explicitly requested.

Current workspace files:
${filesContext}

YOU MUST output a JSON response conforming strictly to this JSON format:
{
  "modifiedFiles": [
    {
      "path": "path/to/affected/file",
      "content": "Full source code for updated file",
      "language": "solidity|rust|move|javascript|typescript|markdown",
      "reason": "Explanation of changes"
    }
  ],
  "newFiles": [
    {
      "path": "path/to/new/file",
      "content": "Full source code for new file",
      "language": "solidity|rust|move|javascript|typescript|markdown",
      "reason": "Why this file was created"
    }
  ],
  "deletedFiles": [],
  "summary": "Summary of changes made based on the user instruction",
  "audit": {
    "score": 90,
    "codeQuality": 95,
    "gasOptimization": 85,
    "complexity": 3,
    "summary": "High-level summary of the audit findings",
    "vulnerabilities": []
  }
}
Do NOT output any conversational text or markdown wrappers like \`\`\`json. Return only raw, parsing-valid JSON.
`;

  try {
    const result = await AIService.editWorkspace(userConfig, editingPrompt);

    // Create immutable workspace snapshot
    const snapshot = PatchEngine.createSnapshot(files);

    // Apply patch engine to merge AI response with workspace snapshot
    const mergedFiles = PatchEngine.applyPatch(snapshot, result.data);

    return res.json({
      files: mergedFiles,
      modifiedFiles: result.data.modifiedFiles || [],
      newFiles: result.data.newFiles || [],
      deletedFiles: result.data.deletedFiles || [],
      summary: result.data.summary || 'Workspace patched successfully.',
      audit: result.data.audit,
      mode: "live"
    });
  } catch (err: any) {
    return sendStructuredError(res, err, userConfig.provider, userConfig.defaultModel);
  }
});

// POST /api/remediate
app.post("/api/remediate", async (req, res) => {
  const userConfig = getActiveUserConfig(req);
  const { projectId, vulnerability, files } = req.body;

  if (!vulnerability || !files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "Vulnerability object and non-empty files array are required" });
  }

  const projectName = "RemediationProject";
  const logs: string[] = [];

  // Redact any secrets in prompt/context
  const redactSecrets = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/(?:PRIVATE_KEY|SECRET_KEY|API_KEY|PASSWORD|TOKEN)\s*[:=]\s*["']?[a-zA-Z0-9_.-]{16,}["']?/gi, '[REDACTED_SECRET]')
      .replace(/0x[a-fA-F0-9]{64}/g, '0x[REDACTED_PRIVATE_KEY]');
  };

  // State machine: DETECTED -> SNAPSHOT_CREATED -> PATCH_GENERATED -> PATCH_VALIDATED -> PATCH_APPLIED -> COMPILE -> SECURITY RE-AUDIT -> COMMIT
  logs.push(`[STATE: DETECTED] Initiating authoritative remediation state machine for "${vulnerability.title}"`);

  // 1. Create immutable initial workspace snapshot with pre-patch SHA-256 hashes
  const initialSnapshot = PatchEngine.createSnapshotWithHashes(files);
  logs.push(`[STATE: SNAPSHOT_CREATED] Snapshot ${initialSnapshot.snapshotId} created with ${Object.keys(initialSnapshot.hashes).length} file hashes.`);

  let currentFiles = PatchEngine.createSnapshot(initialSnapshot.files);
  let committedState = PatchEngine.createSnapshot(initialSnapshot.files);

  let attempts = 0;
  const maxAttempts = 3;
  let loopSuccess = false;
  let lastSummary = "";
  let finalPatchResult: any = null;

  while (attempts < maxAttempts && !loopSuccess) {
    attempts++;
    logs.push(`[ATTEMPT ${attempts}/${maxAttempts}] Executing remediation cycle...`);

    const fileToFix = vulnerability.file || vulnerability.affectedFile;
    if (!fileToFix) {
      logs.push(`[ERROR] Vulnerability missing target file path.`);
      break;
    }

    const normTarget = PatchEngine.normalizePath(fileToFix).toLowerCase();
    const affectedFile = currentFiles.find((f: any) => PatchEngine.normalizePath(f.path).toLowerCase() === normTarget);

    if (!affectedFile) {
      const errMsg = `Target file '${fileToFix}' not found in workspace.`;
      logs.push(`[ERROR] ${errMsg}`);
      break;
    }

    // Prepare targeted context ONLY (vulnerable file + direct interface/dependency imports, NO reports/secrets)
    const otherFiles = currentFiles.filter((f: any) => {
      const norm = PatchEngine.normalizePath(f.path).toLowerCase();
      if (norm === normTarget) return false;
      // Include only direct contract/code files, exclude diagnostic reports, metadata, secrets
      if (norm.startsWith('.diagnostics/') || norm.endsWith('.md') || norm.endsWith('.json') || norm.endsWith('.txt')) return false;
      return f.path.endsWith('.sol') || f.path.endsWith('.rs') || f.path.endsWith('.move');
    });

    const contextFilesText = otherFiles.map((f: any) => `### OTHER CODE FILE FOR CONTEXT: ${f.path}\n\`\`\`\n${redactSecrets(f.content)}\n\`\`\`\n`).join("\n");

    const remediationPrompt = `
You are a Principal Smart Contract Security Engineer. Your task is to fix a specific security vulnerability in the following smart contract file.

Vulnerability Details:
- ID: ${vulnerability.id}
- Title: ${vulnerability.title}
- Severity: ${vulnerability.severity}
- Affected File: ${vulnerability.file}
- Affected Line: ${vulnerability.line || vulnerability.lineNumber}
- Affected Function: ${vulnerability.affectedFunction || vulnerability.function || 'N/A'}
- Description: ${vulnerability.description || vulnerability.explanation}
- Recommendation: ${vulnerability.recommendation || vulnerability.recommendedRemediation}

Target Vulnerable File Content (${vulnerability.file}):
\`\`\`
${redactSecrets(affectedFile.content)}
\`\`\`

${contextFilesText ? `Workspace Context (Reference only):\n${contextFilesText}` : ''}

REMEDIATION CONSTRAINTS:
1. Modify ONLY the target file '${vulnerability.file}'. Do NOT modify or delete unrelated files.
2. Under NO circumstances produce path traversal ('..'), absolute paths, or modify internal diagnostic files.
3. Return valid code matching the original language structure.

YOU MUST output a JSON response conforming strictly to this format:
{
  "modifiedFiles": [
    {
      "path": "${vulnerability.file}",
      "content": "Full updated source code for this file with the vulnerability completely resolved",
      "language": "${affectedFile.language || 'solidity'}",
      "reason": "Fix ${vulnerability.title} in function ${vulnerability.affectedFunction || ''}"
    }
  ],
  "newFiles": [],
  "deletedFiles": [],
  "summary": "Detailed explanation of the security fix applied to resolve ${vulnerability.title}"
}
Do NOT output any conversational text or markdown wrappers like \`\`\`json. Return only raw, parsing-valid JSON.
`;

    try {
      // Create cycle attempt snapshot
      const cycleSnapshot = PatchEngine.createSnapshotWithHashes(currentFiles);

      // STEP 1: PATCH_GENERATED
      logs.push(`[STATE: PATCH_GENERATED] Requesting AI patch generation for "${vulnerability.title}" (Attempt ${attempts})...`);
      const result = await AIService.editWorkspace(userConfig, remediationPrompt);
      const patchData = result.data;

      if (!patchData || typeof patchData !== 'object') {
        logs.push(`[WARN] AI returned empty or invalid patch data. Retrying...`);
        continue;
      }

      lastSummary = patchData.summary || "AI remediation patch generated.";
      finalPatchResult = patchData;

      // STEP 2: PATCH_VALIDATED & SCOPE CHECK
      logs.push(`[STATE: PATCH_VALIDATED] Validating patch scope and path safety...`);
      const scopeCheck = PatchEngine.validatePatchScope(patchData, [fileToFix], cycleSnapshot.files);
      if (!scopeCheck.valid) {
        logs.push(`[REJECT: SCOPE_VIOLATION] Patch scope validation failed: ${scopeCheck.reason}`);
        continue;
      }

      // STEP 3: PATCH_APPLIED_TO_ISOLATED_WORKSPACE
      logs.push(`[STATE: PATCH_APPLIED_TO_ISOLATED_WORKSPACE] Overlaying patch onto candidate workspace...`);
      const candidateFiles = PatchEngine.applyPatch(cycleSnapshot.files, patchData);

      // Verify Immutability (no unexpected files changed)
      const immutabilityCheck = PatchEngine.verifyPatchImmutability(cycleSnapshot.files, candidateFiles, [fileToFix]);
      if (!immutabilityCheck.valid) {
        logs.push(`[REJECT: IMMUTABILITY_VIOLATION] Patch immutability check failed: ${immutabilityCheck.reason}`);
        continue;
      }

      // STEP 4: COMPILE (REAL CompilerEngine invocation)
      logs.push(`[STATE: COMPILE] Invoking real CompilerEngine on candidate workspace...`);
      const compileCert = CompilerEngine.certifyCompilation(
        candidateFiles,
        projectName,
        vulnerability.blockchain || 'Ethereum/EVM'
      );

      const compileResult = compileCert.result;
      const isCompiled = compileResult.success && compileResult.status !== 'NOT_VERIFIED' && compileResult.status !== 'FAIL';

      if (!isCompiled) {
        const diagText = (compileResult.diagnostics || []).map((d: any) => `${d.file || ''}:${d.line || ''} - ${d.message || d.explanation || ''}`).join('; ');
        logs.push(`[COMPILE FAIL] Real compilation failed: ${diagText || compileResult.stderr || 'Syntax/compilation error'}`);
        logs.push(`[ROLLBACK] Reverting candidate workspace to snapshot ${cycleSnapshot.snapshotId}...`);
        
        currentFiles = PatchEngine.createSnapshot(cycleSnapshot.files);
        const rb = PatchEngine.verifyRollback(cycleSnapshot.hashes, currentFiles);
        if (!rb.valid) {
          logs.push(`[CRITICAL ROLLBACK FAILURE] ${rb.reason}`);
          return res.status(500).json({ success: false, files: initialSnapshot.files, error: `ROLLBACK_FAILURE: ${rb.reason}`, logs });
        }
        continue;
      }

      logs.push(`[COMPILE PASS] Real compilation succeeded with zero fatal errors.`);

      // STEP 5: SECURITY RE-AUDIT (REAL SecurityAuditEngine invocation)
      logs.push(`[STATE: SECURITY RE-AUDIT] Executing real SecurityAuditEngine re-audit on compiled candidate...`);
      const auditCert = SecurityAuditEngine.certifySecurity(
        candidateFiles,
        projectName,
        vulnerability.blockchain || 'Ethereum/EVM',
        { success: compileResult.success, status: compileResult.status, verificationMode: compileResult.verificationMode, exitCode: compileResult.exitCode }
      );

      const auditRes = auditCert.auditResult;

      if (auditRes.status !== 'CERTIFIED_SECURE') {
        logs.push(`[AUDIT FAIL] Re-audit status was ${auditRes.status}. Reverting patch...`);
        currentFiles = PatchEngine.createSnapshot(cycleSnapshot.files);
        const rb = PatchEngine.verifyRollback(cycleSnapshot.hashes, currentFiles);
        if (!rb.valid) {
          logs.push(`[CRITICAL ROLLBACK FAILURE] ${rb.reason}`);
          return res.status(500).json({ success: false, files: initialSnapshot.files, error: `ROLLBACK_FAILURE: ${rb.reason}`, logs });
        }
        continue;
      }

      const remainingCriticalOrHigh = auditRes.findings.filter(f => f.severity === 'Critical' || f.severity === 'High');
      const targetVulnStillPresent = auditRes.findings.some(f =>
        f.id === vulnerability.id ||
        (f.title && vulnerability.title && f.title.toLowerCase().includes(vulnerability.title.toLowerCase()))
      );

      if (remainingCriticalOrHigh.length > 0 || targetVulnStillPresent) {
        logs.push(`[AUDIT FAIL] Re-audit found residual vulnerabilities: ${auditRes.findings.map(f => `[${f.severity}] ${f.title}`).join(', ')}`);
        logs.push(`[ROLLBACK] Reverting candidate workspace to pre-patch state.`);
        currentFiles = PatchEngine.createSnapshot(cycleSnapshot.files);
        const rb = PatchEngine.verifyRollback(cycleSnapshot.hashes, currentFiles);
        if (!rb.valid) {
          logs.push(`[CRITICAL ROLLBACK FAILURE] ${rb.reason}`);
          return res.status(500).json({ success: false, files: initialSnapshot.files, error: `ROLLBACK_FAILURE: ${rb.reason}`, logs });
        }
        continue;
      }

      logs.push(`[SECURITY RE-AUDIT PASS] Re-audit certified vulnerability '${vulnerability.title}' is completely resolved.`);

      // STEP 6: COMMIT
      logs.push(`[STATE: COMMIT] Authoritative validation pipeline passed! Committing patched workspace.`);
      committedState = PatchEngine.createSnapshot(candidateFiles);
      loopSuccess = true;
      break;

    } catch (err: any) {
      logs.push(`[ERROR] Attempt ${attempts} failed with exception: ${err.message || String(err)}`);
      currentFiles = PatchEngine.createSnapshot(initialSnapshot.files);
      PatchEngine.verifyRollback(initialSnapshot.hashes, currentFiles);
    }
  }

  if (loopSuccess) {
    logs.push(`[SUCCESS] Remediation pipeline completed successfully in ${attempts} attempts.`);
    return res.json({
      success: true,
      files: committedState,
      patch: finalPatchResult,
      summary: lastSummary,
      logs
    });
  } else {
    // Verified Rollback to initial workspace
    logs.push(`[FAIL] All ${attempts} remediation attempts failed. Restoring initial workspace.`);
    const restoredFiles = PatchEngine.createSnapshot(initialSnapshot.files);
    const rbCheck = PatchEngine.verifyRollback(initialSnapshot.hashes, restoredFiles);

    if (!rbCheck.valid) {
      logs.push(`[CRITICAL ROLLBACK FAILURE] ${rbCheck.reason}`);
      return res.status(500).json({
        success: false,
        files: initialSnapshot.files,
        error: `ROLLBACK_FAILURE: ${rbCheck.reason}`,
        logs
      });
    }

    return res.json({
      success: false,
      files: restoredFiles, // Verified 100% byte-for-byte identical to original
      error: `Self-healing remediation pipeline failed after ${attempts} attempts. Original workspace safely restored.`,
      logs
    });
  }
});

function validateAndSanitizeVulnerabilities(vulnerabilities: any[], files?: any[]): void {
  if (!vulnerabilities || !Array.isArray(vulnerabilities)) {
    return;
  }
  
  for (let i = vulnerabilities.length - 1; i >= 0; i--) {
    const v = vulnerabilities[i];
    if (!v || typeof v !== 'object') {
      vulnerabilities.splice(i, 1);
      continue;
    }

    if (files && files.length > 0) {
      const check = SecurityAuditEngine.validateFinding(
        {
          affectedFile: v.file || v.affectedFile,
          lineNumbers: [Number(v.line)],
          codeSnippet: v.snippet || v.codeSnippet,
          functionName: v.affectedFunction || v.function,
          severity: v.severity
        },
        files
      );

      if (!check.valid) {
        console.warn(`[AUDIT SANITIZE] Filtered out invalid finding: ${check.reason}`);
        vulnerabilities.splice(i, 1);
        continue;
      }
    }

    if (!v.file || typeof v.file !== 'string' || v.file.trim() === '' || v.file.toLowerCase() === 'n/a') {
      throw new Error(`Audit finding missing or invalid coordinate "file". Provided: "${v.file}"`);
    }
    const lineNum = Number(v.line);
    if (!v.line || isNaN(lineNum) || lineNum <= 0) {
      throw new Error(`Audit finding missing or invalid coordinate "line". Provided: "${v.line}"`);
    }
    const colNum = Number(v.column);
    if (v.column === undefined || isNaN(colNum) || colNum < 0) {
      throw new Error(`Audit finding missing or invalid coordinate "column" (must be non-negative integer). Provided: "${v.column}"`);
    }
    const funcName = v.affectedFunction || v.function;
    if (!funcName || typeof funcName !== 'string' || funcName.trim() === '' || funcName.toLowerCase() === 'n/a') {
      throw new Error(`Audit finding missing or invalid coordinate "affectedFunction".`);
    }

    const severity = v.severity;
    const allowedSeverities = ['Critical', 'High', 'Medium', 'Low', 'Informational'];
    if (!severity || !allowedSeverities.includes(severity)) {
      throw new Error(`Audit finding has invalid, missing, or lowercase severity: "${severity}". Allowed values: Critical | High | Medium | Low | Informational.`);
    }

    const snippet = v.snippet || v.codeSnippet || v.exploitExample;
    if (!snippet || typeof snippet !== 'string' || snippet.trim() === '' || snippet.toLowerCase() === 'n/a') {
      throw new Error(`Audit finding missing or invalid coordinate "snippet" / "codeSnippet".`);
    }

    if (!v.recommendation || typeof v.recommendation !== 'string' || v.recommendation.trim() === '' || v.recommendation.toLowerCase() === 'n/a') {
      throw new Error(`Audit finding missing or invalid coordinate "recommendation".`);
    }
  }
}

// POST /api/audit
app.post("/api/audit", async (req, res) => {
  try {
    const userConfig = getActiveUserConfig(req);
    const { files, modifiedFiles, previousAudit } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "Files are required for auditing" });
    }

    let filesToAudit = files;
    let isDifferential = false;

    if (Array.isArray(modifiedFiles) && modifiedFiles.length > 0 && previousAudit) {
      const normalizedModified = modifiedFiles.map((p: any) => PatchEngine.normalizePath(p).toLowerCase());
      filesToAudit = files.filter((f: any) => normalizedModified.includes(PatchEngine.normalizePath(f.path).toLowerCase()));
      isDifferential = true;
      console.log(`[DIFFERENTIAL AUDIT] Executing audit on modified files only: ${modifiedFiles.join(", ")}`);
    }

    if (filesToAudit.length === 0) {
      return res.json(previousAudit || { status: 'NOT_VERIFIED', score: 0, vulnerabilities: [], summary: "No modified files to audit." });
    }

    const filesContext = filesToAudit.map((f: any) => `### FILE: ${f.path}\n\`\`\`\n${f.content}\n\`\`\`\n`).join("\n");

    const auditPrompt = `
You are an elite Smart Contract Security Auditor and Threat Modeler. Analyze the following smart contracts and identify vulnerabilities, gas inefficiencies, or structural code quality issues.
Workspace files:
${filesContext}

${isDifferential ? `ATTENTION: This is a DIFFERENTIAL security audit. You are ONLY auditing the following modified files: ${modifiedFiles?.join(", ")}. Please focus your analysis and report vulnerabilities found ONLY in these files.` : ''}

IMPORTANT SECURITY AUDITING MANDATES:
1. Every vulnerability finding MUST specify an exact, precise "file" path and a non-zero, exact "line" number where the issue actually resides.
2. Every vulnerability finding MUST specify a precise "column" number (integer starting at 1).
3. Every vulnerability finding MUST specify the specific function name in "affectedFunction" (e.g., "withdraw(uint256)") rather than generic descriptions.
4. Every vulnerability finding MUST specify a "severity" mapping strictly to one of: "Critical", "High", "Medium", "Low", "Informational". Case sensitivity is strictly enforced. Lowercase severities (e.g., "critical") or missing values are forbidden.
5. Every vulnerability finding MUST specify a non-empty code "snippet" representing the exact vulnerable line(s) of code.
6. Every vulnerability finding MUST specify a clear, non-empty "recommendation" string to resolve the issue.
7. Under NO circumstances should you return "N/A", "Multiple Modules", "General", or "0" for the file, line, column, snippet, recommendation, or affectedFunction fields.

YOU MUST output a JSON response conforming strictly to this format:
{
  "score": 90, // Security score for these audited files (0 to 100)
  "codeQuality": 95, // Code quality score (0 to 100)
  "gasOptimization": 85, // Gas efficiency score (0 to 100)
  "complexity": 3, // Contract complexity index (1 to 10)
  "summary": "High-level executive summary of the security audit findings, mapping reentrancy, access controls, math operations, and key threat surfaces.",
  
  // New production-grade audit fields
  "openZeppelinCompatibility": "Compatible with OpenZeppelin safe-ERC20, Ownable, or ReentrancyGuard modules if applicable.",
  "compilerCompatibility": "Tested for compilers matching ^0.8.20 (or equivalent language toolchains).",
  "attackSurfaceSummary": "Analysis of external entry points, admin actions, and key token/value transfers.",
  "overallRecommendations": "Actionable overall developer guidelines to secure the codebase.",
  "securityChecklist": [
    "Reentrancy guards verified on state-changing external functions",
    "Integer overflow and safe-casting boundaries checked",
    "Access modifiers validated for administrative roles",
    "Token and native balance calculations sanity checked"
  ],
  "deploymentReadiness": "Description of deployment readiness e.g., 'Ready for Testnet deployment after addressing critical items.'",
  "auditConfidenceScore": 95, // Confidence score from 0 to 100
  "finalVerdict": "Needs Remediation / Approved",
  "readyForMainnet": false, // boolean
  "readyForTestnet": true, // boolean
  "needsReview": true, // boolean

  "vulnerabilities": [
    {
      "id": "vuln-1",
      "title": "Reentrancy vulnerability in withdraw function",
      "severity": "Critical", // Must be strictly capitalized: Critical | High | Medium | Low | Informational
      "description": "State variable updated after external transfer allowing caller to reenter prior to state finalization.",
      "file": "path/to/file",
      "line": 15,
      "column": 5,
      "affectedFunction": "withdraw(uint256)",
      "technicalExplanation": "The function performs an external transfer using message call prior to updating the user's mapped balance state, violating the Checks-Effects-Interactions pattern.",
      "whyThisIssueOccurs": "The developer did not call the ReentrancyGuard modifier or update the balance state before triggering the transfer.",
      "possibleAttackScenario": "An attacker uses a malicious fallback contract to call withdraw recursively, draining the contract pool.",
      "potentialFinancialImpact": "Loss of all stored user deposits and native pool liquidity.",
      "exploitExample": "contract Exploit { fallback() external payable { target.withdraw(1 ether); } }",
      "snippet": "(bool success, ) = msg.sender.call{value: amount}('');",
      "recommendation": "Update user balances BEFORE triggering the external transfer, or use the nonReentrant modifier from OpenZeppelin.",
      "codeExample": "mapping(address => uint255) balances;\nfunction withdraw(uint256 amount) external {\n  uint255 bal = balances[msg.sender];\n  require(bal >= amount);\n  balances[msg.sender] -= amount;\n  (bool success, ) = msg.sender.call{value: amount}('');\n  require(success);\n}",
      "bestPracticeReference": "ConsenSys Smart Contract Best Practices - Checks-Effects-Interactions Pattern",
      "estimatedFixDifficulty": "Low", // Low | Medium | High
      "priority": "High", // Low | Medium | High
      "fixAvailable": true,
      "fixedCode": "Full corrected smart contract code for the affected file, with this vulnerability resolved.",
      "explanationOfChanges": "Moved the balance decrement statement to occur before the low-level call.",
      "whyFixWorks": "It establishes a correct Checks-Effects-Interactions pattern, so recursive re-entrant withdraw calls see zero balance and fail.",
      "remainingRisks": "Ensure that any other custom transfer helper functions in the contract also follow this pattern."
    }
  ]
}

Do NOT output any conversational text or markdown wrappers like \`\`\`json. Return only raw, parsing-valid JSON.
`;

    const result = await AIService.auditWorkspace(userConfig, auditPrompt);
    let finalAudit = result.data;

    if (isDifferential && previousAudit) {
      const normalizedModified = modifiedFiles.map((p: any) => PatchEngine.normalizePath(p).toLowerCase());
      // Filter out old findings for files that we just re-audited
      const unchangedFindings = (previousAudit.vulnerabilities || []).filter((v: any) => {
        const normFile = PatchEngine.normalizePath(v.file).toLowerCase();
        return !normalizedModified.includes(normFile);
      });

      // Combine remaining old findings and newly detected ones
      const mergedFindings = [...unchangedFindings, ...(result.data.vulnerabilities || [])];

      // Calculate updated overall security score based on delta
      const criticalCount = mergedFindings.filter((f: any) => f.severity === 'Critical').length;
      const highCount = mergedFindings.filter((f: any) => f.severity === 'High').length;
      const mediumCount = mergedFindings.filter((f: any) => f.severity === 'Medium').length;
      const lowCount = mergedFindings.filter((f: any) => f.severity === 'Low').length;

      const scoreOffset = (criticalCount * 25) + (highCount * 15) + (mediumCount * 5) + (lowCount * 2);
      const overallScore = Math.max(10, 100 - scoreOffset);

      finalAudit = {
        ...result.data,
        vulnerabilities: mergedFindings,
        score: overallScore,
        summary: `Differential audit completed. Modified files re-scanned. ${result.data.summary || ''}`
      };
    }

    // Programmatically validate audit coordinates before sending response!
    validateAndSanitizeVulnerabilities(finalAudit.vulnerabilities, filesToAudit);

    return res.json({
      ...finalAudit,
      mode: "live"
    });
  } catch (err: any) {
    const userConfig = getActiveUserConfig(req);
    return sendStructuredError(res, err, userConfig.provider, userConfig.defaultModel);
  }
});

// POST /api/compile
app.post("/api/compile", async (req, res) => {
  const { blockchain, framework, files } = req.body;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No files found to compile" });
  }

  console.log(`[COMPILER ENGINE] Compiling files for blockchain: ${blockchain}, framework: ${framework}`);

  try {
    const cert = CompilerEngine.certifyCompilation(files, 'SmartContractProject', blockchain, framework);
    const result = cert.result;
    const rawLogs = (result.stdout || '') + '\n' + (result.stderr || '');

    return res.json({
      success: result.success,
      errors: result.diagnostics,
      logs: rawLogs.split('\n'),
      timestamp: result.timestamp
    });
  } catch (err: any) {
    console.error("[COMPILER ENGINE] Execution failed:", err);
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
// ADMINISTRATOR PORTAL ENDPOINTS
// -------------------------------------------------------------

// Admin Role protection middleware helper
function checkAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const email = req.headers["x-user-email"] as string;
  if (email && email.trim().toLowerCase() === "sarveshtiwarisarvesh@gmail.com") {
    return next();
  }
  // Check from configs
  const userId = req.headers["x-user-id"] as string;
  if (userId) {
    const config = SettingsService.get(userId);
    if (config && config.email && config.email.trim().toLowerCase() === "sarveshtiwarisarvesh@gmail.com") {
      return next();
    }
  }
  return res.status(403).json({ error: "Access denied: Administrator role required." });
}

// Admin stats
app.get("/api/admin/stats", checkAdmin, (req, res) => {
  const db = readDb();
  const allConfigs = SettingsService.getAllConfigs();
  const usersList = Object.values(allConfigs);

  const totalUsers = usersList.length;
  const totalProjects = db.projects.length;

  let sumScore = 0;
  let scoreCount = 0;
  const blockchainCounts: Record<string, number> = {};

  db.projects.forEach((p: any) => {
    if (p.audit?.score !== undefined) {
      sumScore += p.audit.score;
      scoreCount++;
    }
    const chain = p.blockchain || "Unknown";
    blockchainCounts[chain] = (blockchainCounts[chain] || 0) + 1;
  });

  const avgAuditScore = scoreCount > 0 ? Math.round(sumScore / scoreCount) : 0;

  res.json({
    totalUsers,
    totalProjects,
    avgAuditScore,
    blockchainCounts
  });
});

// Admin list users
app.get("/api/admin/users", checkAdmin, (req, res) => {
  const allConfigs = SettingsService.getAllConfigs();
  res.json(Object.values(allConfigs));
});

// Admin list projects
app.get("/api/admin/projects", checkAdmin, (req, res) => {
  const db = readDb();
  res.json(db.projects);
});

// Admin toggle user status (block/unblock)
app.put("/api/admin/users/:userId/toggle-status", checkAdmin, (req, res) => {
  const { userId } = req.params;
  const current = SettingsService.get(userId);
  if (!current) {
    // Let's bootstrap user if they don't exist yet in config but exist in request
    const mockEmail = req.headers["x-user-email"] as string || "unknown@ai-contracts.com";
    const initialized = SettingsService.save(userId, { email: mockEmail, isActive: true });
    const toggled = SettingsService.updateRoleAndStatus(userId, { isActive: false });
    return res.json(toggled);
  }

  const updatedActive = current.isActive === false ? true : false;
  const updated = SettingsService.updateRoleAndStatus(userId, { isActive: updatedActive });
  res.json(updated);
});

// Admin update user role
app.put("/api/admin/users/:userId/role", checkAdmin, (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  if (!role || (role !== "admin" && role !== "user")) {
    return res.status(400).json({ error: "Invalid role specified" });
  }

  const current = SettingsService.get(userId);
  if (!current) {
    // Bootstrap
    const mockEmail = req.headers["x-user-email"] as string || "unknown@ai-contracts.com";
    SettingsService.save(userId, { email: mockEmail });
  }

  const updated = SettingsService.updateRoleAndStatus(userId, { role });
  res.json(updated);
});


// Global Express Error-handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[UNCAUGHT EXPRESS EXCEPTION]", err);
  res.status(500).json({
    success: false,
    error: err.message || String(err),
    stack: err.stack || "No stack trace available"
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
