# Security Policy

## Disclosure

Do not report vulnerabilities through a public issue. Contact
security@sw-labs.de with a description, reproduction steps, affected version or
commit, and expected impact.

## Scope

Report issues in this repository or SW labs infrastructure that could lead to:

- exposure of secrets, credentials, PII, or production data
- code execution, command injection, or privilege escalation
- access-control bypass
- unsafe Groq, local `whisper-cli`, or local Ollama integration that exposes
  user data or API keys

WordScript stores the Groq API key in the OS secret store and scrubs JSON
configuration on save. A key committed to the repository, written to logs, or
stored in unencrypted configuration is in scope.

## Out of Scope

- Dependency vulnerabilities without a repository-specific exploit path; report
  them to the upstream vendor and run `npm audit` after dependency changes.
- General tool or harness security topics, except a repository-specific
  security-relevant workaround.

## Expected Response

Expect acknowledgement within 48 hours and an initial status update within seven
days.

## Repository Secret Handling

- The Groq API key stays in the OS secret store, never in JSON configuration.
- Legacy JSON keys migrate natively to the secret store before save.
- `.githooks/pre-commit` runs `gitleaks` when it is available.
- `.gitignore` excludes environment files, keys, credentials, secrets, and
  `CREDENTIALS.md`.
- `.claude/settings.json` blocks raw private-key files such as `*.pem` and
  `*_rsa` where no legitimate read is required.
