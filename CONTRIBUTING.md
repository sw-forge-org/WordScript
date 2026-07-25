# Contributing

Contributions are welcome. WordScript is a community-built project under SW
forge, the open-source brand of SW labs.

## Before Opening a Pull Request

- Use a descriptive `feat/`, `fix/`, `chore/`, or `docs/` branch.
- Target `main` and request at least one review.
- Run the relevant commands from [AGENTS.md](AGENTS.md), including `npm test`,
  `npm run build`, and `cd src-tauri && cargo test` for cross-cutting work.
- Update `CHANGELOG.md` when the change is user- or maintainer-visible.
- Use Conventional Commits such as `feat:`, `fix:`, `chore:`, or `docs:`.
- Never include secrets, `.env` values, or private credentials in commits or
  output. See [SECURITY.md](SECURITY.md) and `.gitignore`.
- Do not bypass Husky hooks with `--no-verify`.

## Branch Names

| Prefix | Purpose | Example |
| --- | --- | --- |
| `feat/` | new feature | `feat/mode-settings-frontend` |
| `fix/` | bug fix | `fix/overlay-placement-persist` |
| `chore/` | maintenance | `chore/update-deps` |
| `docs/` | documentation | `docs/architecture-update` |

## Worktrees

Use Git worktrees for independent feature work. Follow the repository workflow
in [DEVELOPMENT.md](docs/DEVELOPMENT.md); do not create worktrees inside
`.kilo/worktrees/`.

## Architecture and Documentation

Put consequential architecture decisions in append-only ADRs under
`docs/decisions/`; see its README for criteria and format. Update the relevant
living documentation when product reality changes, especially README, VISION,
ARCHITECTURE, DEVELOPMENT, DESIGN_SYSTEM, STATUS, PLATFORMS, REFERENCE, and
CHANGELOG. Use `spec-sync` for material specification drift.

For a substantial change, open and discuss an issue first. Current contribution
priorities are listed in [README.md](README.md).
