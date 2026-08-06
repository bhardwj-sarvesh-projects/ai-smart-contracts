# Category-Aware File Validation Specification & Matrix Report

**Module:** `ResponseParser` & Category Validation System  
**Status:** ✅ IMPLEMENTED & VERIFIED  

---

## Category Validation Matrix

| Category | File Extensions / Filenames | Specialized Validator | Validation Rules |
| :--- | :--- | :--- | :--- |
| **SMART_CONTRACT** | `.sol`, `.rs`, `.move` | `SmartContractValidator` | Solidity: `pragma solidity` requirement, placeholder filename rejection, JSON/Markdown/TOML/ENV leakage checks. Rust: Anchor/use checks. Move: `module` header check. |
| **FRONTEND** | `.html`, `.css`, `.scss`, `.js`, `.jsx`, `.ts`, `.tsx` | `FrontendValidator` | HTML tag balance & DOCTYPE checks. React/TypeScript code block validation, bracket balance checks, CSS rule validation. Reject raw code fences wrapper leakage. |
| **CONFIGURATION** | `.toml`, `.json`, `.yaml`, `.yml`, `.env`, `.env.example`, `LICENSE` | `ConfigurationValidator` | Valid JSON parse verification, TOML header/key-value checks, YAML syntax checks, ENV key-value structure validation. |
| **DOCUMENTATION** | `.md` | `DocumentationValidator` | Non-empty Markdown header, list, or structural formatting verification. |
| **ASSET** | `.svg`, `.png`, `.jpg`, `.jpeg`, `.ico`, `.webmanifest` | `AssetValidator` | XML SVG tag structure validation (`<svg>...</svg>`), Webmanifest JSON structure validation, non-empty binary asset checks. |

---

## Technical Enhancements

1. **`CategoryClassifier` (`src/core/EngineeringCore/validators/CategoryClassifier.ts`):**
   - Implements zero-cost, deterministic path classification based on extension and path hierarchy.
2. **Category Dispatcher (`ResponseParser`):**
   - Replaced monolithic extension array with `CategoryClassifier.classify(path)` switch.
   - Eliminates false-positive `INVALID_AI_RESPONSE` errors for frontend assets like `app/index.html`.
3. **Architecture Planner Integration (`ArchitecturePlanner`):**
   - Attaches `classifiedFiles` array containing category tags to every generated `ArchitecturePlan`.
