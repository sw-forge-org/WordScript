# Open Dependency Advisories

Status: **Open — one real finding without an available patch, plus a stale
Dependabot backlog**

First recorded: 2026-07-27
Affected area: `package.json` / `package-lock.json`; the Rust dependency tree is
currently unscanned

This is a living record. Re-check it with `npm audit` and
`gh api repos/sw-forge-org/WordScript/dependabot/alerts` rather than trusting the
table below after a dependency change.

## Why two sources disagree

`npm audit` evaluates the lockfile in the working tree. GitHub Dependabot
evaluates the default branch and keeps alerts open until it re-scans. On
2026-07-27 GitHub reported seven open alerts while `npm audit` reported four,
and most of the difference is Dependabot lagging behind an upgrade that already
happened. Read both, and check the vulnerable version range against what is
actually installed before acting on either.

## Real findings

| Package | Installed | Advisory | Severity | Path | Fix |
|---|---|---|---|---|---|
| `react-router-dom` | 6.30.4 | GHSA-jjmj-jmhj-qwj2 — open redirect leading to XSS | moderate | direct dependency | **none in 6.x** |
| `react-router` | 6.30.4 | GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg | moderate | via `react-router-dom` | v7 (breaking) |
| `postcss` | 8.5.15 | GHSA-r28c-9q8g-f849 — arbitrary `.map` file disclosure via `sourceMappingURL` | high | via `vite`, build time only | `npm audit fix` |
| `undici` | 7.25.0 | GHSA-vmh5-mc38-953g and six others — TLS validation bypass via SOCKS5 `ProxyAgent`, header injection, cache disclosure | high | via `jsdom`, test time only | `npm audit fix` |

### Exposure in this app

The router advisories describe an attacker-controlled navigation destination
reaching `<Link>` or `useNavigate`. WordScript has neither call site: `App.tsx`
declares four static routes plus a catch-all `<Navigate to="/overlay" replace />`
with a literal target, mounted under `HashRouter` in a Tauri webview with no
server and no SSR hydration. There is no path by which untrusted input becomes a
navigation target today. The dependency is still worth moving off, because that
is a property of the current call sites rather than of the library.

`postcss` runs at build time and `undici` only inside the Vitest jsdom
environment. Neither ships in the desktop binary. They are still worth fixing,
because a build-time arbitrary file read is a supply-chain concern on a
developer machine, and both fixes are non-breaking.

## Stale Dependabot alerts

These are open on GitHub but do not match what is installed. They need a
re-scan or a manual dismissal; no code change is warranted.

| Alert | Vulnerable range | Installed | Why stale |
|---|---|---|---|
| GHSA-fx2h-pf6j-xcff (`vite`, x2 manifests) | `<= 6.4.2` | 8.0.16 | out of range |
| GHSA-v6wh-96g9-6wx3 (`vite`, x2 manifests) | `<= 6.4.2` | 8.0.16 | out of range |
| GHSA-2j2x-hqr9-3h42 (`react-router`) | `>= 6.7.0, < 6.30.4` | 6.30.4 | already patched |
| GHSA-4x5r-pxfx-6jf8 (`@babel/core`) | `<= 7.29.0` | not installed | absent from the lockfile |

## Gap: the Rust tree is unscanned

`cargo audit` is not installed on the development machine and GitHub reports no
Cargo alerts, so the native dependency surface — the half that actually ships in
the binary — currently has no advisory coverage at all. The absence of alerts is
not evidence of the absence of advisories.

## Actions

1. Run `npm audit fix` for `postcss` and `undici`; both are non-breaking
   transitive bumps. Re-run `npm test` and `npm run build` afterwards.
2. Decide on `react-router-dom` v7. It is a major upgrade for a router used with
   four static routes, so the migration surface is small, but it is a real
   change and belongs in its own commit rather than in a security sweep.
3. Install `cargo audit` and add it to the release checks so the native tree is
   covered before a public release.
4. Re-scan or dismiss the four stale Dependabot alerts so the alert count stops
   being noise that hides a real finding.

## References

- [SECURITY.md](../../SECURITY.md): reporting policy
- [DEVELOPMENT.md](../DEVELOPMENT.md): `npm audit` is required after dependency
  changes
- [RELEASE_RUNBOOK.md](../RELEASE_RUNBOOK.md): release build-up path
