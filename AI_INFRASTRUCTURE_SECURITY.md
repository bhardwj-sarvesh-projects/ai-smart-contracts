# AI Contracts — AI Credential Security Boundary

## Server-only secrets

The following values must remain server-side only:

- Groq API keys
- OpenAI API keys, if introduced later
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `FIREBASE_PRIVATE_KEY`
- `ENCRYPTION_SECRET`
- database credentials and other backend secrets

Never prefix any of these with `VITE_`. Vite exposes `VITE_*` variables to the browser bundle.

## Groq credential lifecycle

1. Administrator enters a Groq key in the authenticated Admin Panel.
2. The browser sends the key over HTTPS to the authenticated server.
3. The server validates the key format.
4. The server encrypts the key before persistence.
5. Subsequent credential-list responses contain only non-secret metadata and `••••••••`.
6. The server decrypts the key only inside the AI execution/test path.
7. The decrypted key is never returned to the browser.

### Important browser limitation

During the moment an administrator enters a new API key, the browser necessarily has the key in memory and sends it in the HTTPS request body. An administrator who opens DevTools on that same browser session can inspect that submission. This cannot be eliminated while keeping browser-based key entry in the Admin Panel.

After storage, the application does not return the key, partial key, encrypted value, or service-account credential to the browser.

## Firebase Admin credential lifecycle

`FIREBASE_SERVICE_ACCOUNT_JSON` is read only by the Node.js server process. It is not imported by React, not prefixed with `VITE_`, and not returned by any API route.

Firebase Web SDK configuration (`VITE_FIREBASE_*`) is intentionally separate and is not equivalent to Firebase Admin credentials.

## Identity boundary

The server uses the verified Firebase ID token as the source of user identity. Client-controlled `x-user-id`, `x-user-email`, `x-user-name`, and `x-user-photo` headers are not trusted for authentication or project ownership.

## Admin boundary

Admin access requires either:

- a server-verified Firebase custom admin claim, or
- a verified Firebase email present in `ADMIN_EMAILS`.

The Admin Panel itself is never the security boundary; the backend is.
