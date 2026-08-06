# Deterministic Validator Routing Report

**Module:** `ResponseParser` & Category Validators  
**Status:** ✅ ENFORCED & VERIFIED  

---

## Category-Aware Validator Dispatch

Validation routing consumes `ProjectProfile.validator` and dispatches source code directly to category validators after preprocessing:

```
[ Generated Content ]
         │
         ▼
[ MarkdownFenceStripper.strip() ]  <── Preprocessing Stage
         │
         ▼
[ Profile Mismatch Gate ]          <── Fail-Fast Check (PROJECT_PROFILE_MISMATCH)
         │
         ▼
[ Category Classifier ] ──────────► [ Category Validator ]
                                    ├── SmartContractValidator
                                    ├── FrontendValidator
                                    ├── ConfigurationValidator
                                    ├── DocumentationValidator
                                    └── AssetValidator
```

---

## Validation Routing Table

| File Extension / Category | Validator Class | Syntax Rules Applied |
| :--- | :--- | :--- |
| `.sol` | `SmartContractValidator` | License identifier, pragma, contract/interface header |
| `.rs` | `RustValidator` | `use anchor_lang::prelude::*`, `#[program]` attribute |
| `.move` | `MoveValidator` | `module <addr>::<name>` declaration |
| `.html` / `.tsx` | `FrontendValidator` | `<!DOCTYPE html>`, script/style closing tags |
| `.toml` / `.json` | `ConfigurationValidator` | Proper TOML/JSON key-value syntax |
| `.md` | `DocumentationValidator` | Clean markdown headers, zero raw code fences |
