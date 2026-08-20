Replace these files in your AI Studio codebase at the exact same paths.

Changed existing files:
server/services/AICredentialService.ts
server/routes/aiInfrastructure.ts
src/components/AdminAIInfrastructure.tsx
server.ts

New file:
server/services/AICredentialService.persistence.test.ts

Do not change Firebase/Groq secrets in source code. Keep them in server environment variables.
