# Admin Authentication Fix

Replace these files in the current AI Contracts codebase:

- server/services/FirebaseAdminAuth.ts
- src/components/AdminDashboard.tsx
- .env.example

Server configuration is still required. Configure ONE Firebase Admin credential method:

1. FIREBASE_SERVICE_ACCOUNT_JSON
2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
3. Google Application Default Credentials in a Google-managed runtime

The administrator allowlist defaults to:
 sarveshtiwarisarvesh@gmail.com

Do not put service-account credentials in Vite/frontend variables.
