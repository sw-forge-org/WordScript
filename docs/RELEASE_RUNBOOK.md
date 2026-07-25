# WordScript Release Runbook

Status: 2026-07-25

## Purpose

This runbook describes the current internal release build-up. It does not
claim that WordScript has a public installer, a trusted download channel, or a
working in-place updater.

## Current Reality

- The usable build is `npm run tauri dev` from this repository.
- `.github/workflows/release.yml` provides the `Release Build-Up Matrix`.
- The workflow builds Tauri artifacts for Linux, macOS, and Windows.
- It aggregates platform artifacts into checksummed maintainer handoff archives.
- It can optionally create or update an internal GitHub draft release.
- GitHub's public latest-release endpoint and `check_app_update` remain limited
  to published releases. Internal drafts are not a user release channel.
- Signing, in-place updates, and reliable Linux AppImage packaging remain open
  release work. A `linuxdeploy` failure is known build-up feedback, not a
  regression in a published delivery path.

Public release readiness remains blocked by transcription reliability outside
`General Writing` and incomplete guided local setup.

## Pre-Build Gates

Before any release-track build:

1. Run `npm test`, `npm run build`, and
   `cargo test --manifest-path src-tauri/Cargo.toml` successfully.
2. Confirm that active profiles do not make raw transcription less reliable
   than `General Writing` through multilingual drift, garbage tokens, or topic
   drift.
3. Align the planned version in `package.json` and `src-tauri/tauri.conf.json`.
4. Ensure README, REFERENCE, CHANGELOG, and About copy do not imply a public
   availability that does not exist.
5. When creating a draft, confirm the intended handoff tag. The default is
   `v<package.json version>`.

## Run the Build Matrix

1. Open GitHub Actions and select `Release Build-Up Matrix`.
2. Choose the target ref, normally `main`.
3. Enable `create_draft_release` only when the artifacts belong in an internal
   maintainer draft.
4. Optionally override `release_tag` or `release_title`; otherwise the workflow
   uses the version-derived defaults.
5. Start the workflow.
6. Review the aggregated `wordscript-release-handoff` artifact first.
7. If a draft was requested, verify its tag, title, notes, and asset list.

## Workflow Output

- Native Tauri bundle artifacts for each platform
- An aggregated maintainer handoff with `tar.gz` archives
- `SHA256SUMS.txt` for every archive
- `release-build-metadata.md` with ref, version, tag, workflow run, and an
  explicit internal-only notice
- An optional internal draft GitHub release carrying the same assets

## Post-Run Checks

- Linux: verify the expected AppImage or DEB structure when packaging completes;
  record a `linuxdeploy` failure as an open packaging finding.
- macOS: verify DMG or bundle artifacts.
- Windows: verify installer or bundle artifacts.
- Verify `SHA256SUMS.txt` against the handoff archives and ensure metadata names
  the same ref, version, and tag.
- Verify any GitHub draft is still marked `draft` and does not imply public
  downloads or updates.
- Verify the product and documentation still state the actual release status.

## Gates Before the First Public Release

- Dependable transcription for `General Writing` and active profiles
- Guided local runner, model, and cleanup setup
- Platform signing and a defined trust path
- A reviewed release-note, tag, and promotion process
- Defined updater semantics
- Stable Linux packaging without the current `linuxdeploy` failure
- An explicit decision to promote the workflow beyond internal draft handoffs
