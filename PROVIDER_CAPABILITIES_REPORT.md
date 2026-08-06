# Provider Capabilities Report

## Root Cause
Hardcoding context windows and token limits across different LLM providers (OpenAI, Claude, OpenRouter, Groq, Gemini, Bedrock) leads to system failures. Smaller-context providers like Groq fail when sent medium-sized contexts, while massive-context models like Gemini are artificially restricted.

---

## Provider Capabilities Matrix
The runtime eliminates hardcoded assumptions by querying a central capability matrix mapping every active provider's true resource constraints:

| Provider | Context Window | Max Output Tokens | Recommended Output | Supports JSON? | Supports Streaming? | Supports Tool Calling? |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Gemini** | `2,000,000` | `8,192` | `8,192` | Yes | Yes | Yes |
| **Claude** | `200,000` | `8,192` | `4,096` | Yes | Yes | Yes |
| **OpenAI** | `128,000` | `16,384` | `4,096` | Yes | Yes | Yes |
| **OpenRouter**| `128,000` | `4,096` | `4,096` | Yes | Yes | No |
| **Groq** | `32,768` | `4,096` | `2,048` | Yes | Yes | Yes |
| **Bedrock** | `200,000` | `4,096` | `4,096` | Yes | Yes | Yes |

---

## Implementation Details
1. **Dynamic Model Matching:** The engine parses the runtime model string (e.g., `"models/gemini-3.5-flash"`) and selects the appropriate provider mapping automatically.
2. **Dynamic Clamping:** Output allocations are clamped mathematically to never exceed the provider's physical boundaries.
3. **No Hardcoded Constraints:** Every resource limit is dynamic and adapts transparently as new provider SDKs are registered.
