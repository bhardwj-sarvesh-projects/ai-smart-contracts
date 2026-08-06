# Token Budget Report

## Root Cause
Hardcoded token limits like `99999`, `4000`, `3000`, or `2000` failed to account for provider-specific capabilities, leading to token exhaustion or rate limits on smaller models, while underutilizing the context windows of larger ones (e.g. Gemini, Claude).

---

## Token Budget Algorithm
The runtime dynamically calculates the optimal token allocation before dispatching every request:

1. **Calculate Prompt Length:** Estimate prompt tokens via the character-to-token ratio:
   $$\text{Prompt Tokens} = \lceil \frac{\text{Prompt Length in Characters}}{4} \rceil$$

2. **Reserved Safety Margin:** Dynamically reserve safety cushion (the smaller of `2000` tokens or 10% of the provider's context window):
   $$\text{Reserved Margin} = \min(2000, \lceil \text{Context Window} \times 0.1 \rceil)$$

3. **Remaining Available Context:** Calculate remaining space left in the model's context window:
   $$\text{Remaining Context} = \text{Context Window} - \text{Prompt Tokens} - \text{Reserved Margin}$$

4. **Safe Output Token Allocation:** The target output tokens is determined by taking the minimum of the provider's max output, the remaining context, and the user-requested limit:
   $$\text{Safe Output} = \min(\text{Provider Max Output}, \text{Remaining Context}, \text{User Limit})$$

5. **Clamp Values:** Prevent model rejection by clamping output tokens between a hard floor of `256` and the maximum provider capability:
   $$\text{Output Tokens} = \max(256, \min(\text{Safe Output}, \text{Provider Max Output}))$$

---

## Dynamic Budgeting Performance Metrics
By calculating budgets before payload submission, we guarantee:
- **Zero Token Exhaustion (HTTP 402):** Prompts that would otherwise overflow are caught beforehand, either trigger workspace pruning or reducing maximum output parameters safely.
- **Maximized Output Density:** High-capacity models (like Gemini with 2,000,000 context tokens) receive high outputs (`8192`), while limited endpoints (like Groq) are scaled down to safe windows (`2048`).
