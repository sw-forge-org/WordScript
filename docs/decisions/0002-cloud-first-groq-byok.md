# 0002: Cloud-First Groq BYOK

Date: 2026-03-30
Status: Accepted

## Context

WordScript needed a first production transcription lane. Local-only speech was
honest but required users to assemble a runner, ggml model, and cleanup model.
A hosted WordScript backend would introduce accounts, shared credentials, and
server operations. The remaining option was a cloud-first BYOK provider plus a
local lane.

## Decision

Use cloud-first Groq as the first production provider and keep BYOK as the
credential strategy. API keys live in the OS secret store, JSON configuration
is scrubbed on save, and legacy JSON keys are migrated natively. WordScript has
no proxy or hosted mode on the current path.

`local_preview` is the compatibility identifier for the local runtime lane:
`whisper-cli` and ggml models for speech recognition, plus local Ollama cleanup.

## Consequences

- `ProviderCommandError` is the provider error contract and includes `kind`,
  `retryable`, and `user_action`.
- `local` means on-device execution. Future `self_hosted` means a user-operated
  remote or LAN service and is not an active lane today.
- Local cleanup falls back conservatively to raw local transcription when its
  model is unavailable.
- A second production provider must implement the shared provider contract in
  `src-tauri/src/core/providers/`.
