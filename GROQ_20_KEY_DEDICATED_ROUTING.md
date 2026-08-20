# Groq 20-Key Dedicated Routing Architecture

The platform now supports **20 encrypted Groq API credentials**. Administrators only add/disable/delete credentials. They cannot choose models or routing groups.

| API slots | Dedicated workload | Locked model ladder |
|---|---|---|
| API 01-03 | Architecture & Repository Analysis | GPT-OSS 120B -> Llama 3.3 70B -> GPT-OSS 20B |
| API 04-06 | Smart Contract Generation | GPT-OSS 120B -> GPT-OSS 20B -> Llama 3.3 70B |
| API 07-09 | Code Editing & Repair | GPT-OSS 120B -> GPT-OSS 20B -> Llama 3.3 70B |
| API 10-12 | Testing & Test Analysis | GPT-OSS 20B -> GPT-OSS 120B -> Llama 3.3 70B |
| API 13-15 | Security Audit & Remediation | GPT-OSS 120B -> Llama 3.3 70B -> GPT-OSS 20B |
| API 16-18 | Documentation & Copilot | Llama 3.3 70B -> GPT-OSS 20B -> GPT-OSS 120B |
| API 19-20 | Research | Groq Compound -> GPT-OSS 120B -> Llama 3.3 70B |

## Request routing

For a task assigned to a group, the server performs:

`API #1 -> Model #1 -> Model #2 -> Model #3 -> API #2 -> Model #1 -> ...`

Authentication/rate-limit failures mark that API key unhealthy/cooling down and move to the next API in the same dedicated group. The router does not borrow keys from unrelated groups.

The three model IDs are based on Groq's current production model catalog and are defined in the server policy, not in the database or browser. See Groq's supported production models for the current catalog. 
