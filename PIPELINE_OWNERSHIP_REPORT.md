# Pipeline Ownership & Governance Report

**Governance Model:** Planner-Owned Incremental Pipeline Architecture  
**Owner Engine:** `ProjectPlanner` & `UniversalPipeline`  

---

## 1. Single Source of Truth Hierarchy

```
User Intent
    ↓
ProjectPlanner (Owns task graph, file list, dependency order, file paths)
    ↓
LLMRuntimeEngine (Executes single-file tasks, handles retries)
    ↓
Validators (Enforce category syntax before workspace commit)
    ↓
Workspace State (Stores certified source files)
    ↓
Compiler & Certification Engines (Pass-through evaluation)
```

---

## 2. Component Responsibility Breakdown

| Component | Responsibility Scope | Forbidden Actions |
| :--- | :--- | :--- |
| `ProjectPlanner` | Plan full project file graph, resolve dependencies, define file categories and paths. | Modifying generated source code content. |
| `LLMRuntimeEngine` | Execute single-file generation, calculate token budgets, prune context, run retries. | Creating new tasks or altering the plan graph. |
| `MarkdownFenceStripper` | Normalize LLM output by stripping markdown fences, prose, and comments. | Altering code logic or language keywords. |
| Category Validators | Validate syntax constraints (`pragma`, `anchor_lang`, `module`, TOML, HTML). | Triggering LLM invocations directly. |
| `WorkspaceWriter` | Commit validated files into project workspace. | Transforming or formatting file content during write. |
| `EngineeringCertificationEngine` | Audit compiled workspace against 11 quality gates. | Invoking AI, parsing AI, or retrying generation. |

---

## 3. Governance Compliance Verification

- All pipeline stages log progress via `[EngineeringCore Pipeline Stage]`.
- Failure logging is routed through `[RETRY ENGINE LOG]` and `[LLM RUNTIME OBSERVE]`.
- Certification Engine verified to run only after complete execution of the generation loop.
