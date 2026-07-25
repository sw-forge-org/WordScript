# 0001: Tauri/Rust as the Runtime Owner

Date: 2026-03-30
Status: Accepted

## Context

WordScript began with a Python sidecar and an Electron-like UI shell. Untyped
JSON boundaries blurred ownership and allowed renderer code to recreate runtime
semantics. The alternatives were retaining that architecture or moving trigger,
capture, provider, transform, insertion, and recovery into a Tauri v2 Rust
runtime while React/TypeScript becomes the display, configuration, and
diagnostics layer.

## Decision

Adopt the Tauri/Rust runtime. Rust owns trigger handling, capture, providers,
transformation, insertion, and recovery. React renders, configures, and
explains native state without reinventing its semantics. Typed UI/runtime
contracts are mandatory.

The former Python sidecar, including `wordscript/`, `speech_to_text.py`,
`WordScript.spec`, `requirements.txt`, `config.example.json`, and
`build-sidecar.sh`, is removed and is not a reference path.

## Consequences

- New product logic belongs to the active Tauri/Rust path, never legacy
  sidecar or glue code.
- Hotkeys, capture, session orchestration, and insertion reliability remain
  Rust-owned.
- Asynchronous provider, transform, and insert results are guarded to the
  active processing session; late results after abort or a new capture are
  discarded.
- Cross-platform builds use Tauri and the GitHub workflow matrix, not a
  separate Python packaging path.
