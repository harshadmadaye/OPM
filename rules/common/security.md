# Security Guidelines

## Before Any Commit

- No hardcoded secrets: API keys, passwords, tokens, connection strings, service-account files.
- All external input validated at the boundary.
- Parameterized queries only; never build SQL/NoSQL queries by string concatenation.
- Escape output and sanitize HTML to prevent XSS.
- CSRF protection on state-changing endpoints that use cookie auth.
- Authentication *and* authorization checked on every protected route, server action, callable function, and database rule. "Signed in" is not "allowed".
- Rate limiting on public and auth endpoints.
- Error messages do not leak stack traces, internal paths, or sensitive data.

## Secret Management

- Never hardcode secrets in source. Use environment variables or a secret manager.
- Anything shipped to a client bundle or mobile binary (`NEXT_PUBLIC_*`, `VITE_*`, `--dart-define`) is public. Real secrets stay server-side.
- Validate that required secrets are present at startup.
- Treat any secret that reached source control or logs as exposed: rotate it.

## Security Response Protocol

If a security issue is found:

1. Stop and flag it to the user before continuing other work.
2. Run the `security-reviewer` agent on the affected changes.
3. Fix CRITICAL issues before continuing.
4. Rotate any exposed secrets.
5. Search the codebase for the same pattern elsewhere.

<!-- Adapted from affaan-m/ecc (MIT) -->
