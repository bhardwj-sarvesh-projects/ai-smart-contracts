/**
 * Legacy compatibility constants.
 *
 * AI execution is server-side through the locked Groq routing policy. No
 * OpenAI credential or model is accepted from the browser.
 */
export const OPENAI_API_KEY = "";
export const OPENAI_MODEL = "platform-router";
export const OPENAI_TIMEOUT = 90000;
