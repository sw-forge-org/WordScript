# `.agents/` -- Project-Local, Tool-Agnostic Content

Do not confuse this directory with the shared
`dotfiles/.agents/AGENTS.md`. It is needed only when a project-specific skill,
not the general behavior layer, must be reused by more than one harness.

## Why `AGENTS.md` Does Not Belong Here

Most harnesses read the repository behavior layer directly or through a simple
symlink:

- Claude Code uses `CLAUDE.md`, which is already a symlink to `AGENTS.md`.
- Codex, OpenCode and GitHub Copilot read `AGENTS.md` natively.
- Kilo Code and Cline can use a direct rule symlink because universal rules do
  not require frontmatter:

  ```sh
  ln -s ../AGENTS.md .kilocode/rules/00-global.md
  ln -s ../AGENTS.md .clinerules/00-global.md
  ```

- Cursor requires frontmatter in `.cursor/rules/*.mdc` and does not read
  `AGENTS.md`. Use a thin `.mdc` copy with the required metadata and keep it in
  sync when material behavior changes.

The repository behavior layer is therefore already shared without introducing
another canonical copy under `.agents/`.

## When `.agents/` Is Appropriate

Use this directory for project-specific skills that need different
frontmatter wrappers across harnesses:

- Claude Code skills require `name` and `description`.
- Path-scoped Cursor rules require `globs`.
- GitHub Copilot path instructions require `applyTo`.

Create such a skill only after a recurring project-specific need is
demonstrated.

## Pattern

```text
.agents/
└── skills/
    └── <name>.md
```

The canonical file contains plain Markdown without harness-specific
frontmatter. Each harness may add a thin wrapper with its required metadata.
If a wrapper uses an `@relative/path` import, verify that the target harness
actually resolves imports inside skill bodies before relying on it.

## Current WordScript State

WordScript currently has no project-specific skill that needs cross-harness
reuse. Global skills such as `spec-sync`, `shadcn-ui`, `frontend-design`,
`ui-ux-pro-max`, `web-perf` and `VibeSec-Skill` cover the active workflows.
This directory is reserved for a demonstrated future need.
