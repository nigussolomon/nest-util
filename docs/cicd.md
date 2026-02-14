# CI/CD & GitHub Pages

This repository ships with hardened GitHub Actions workflows for quality, security, publishing, and docs deployment.

## CI principles applied

- Least-privilege permissions per workflow
- Concurrency groups to prevent duplicate runs
- Pinned Node + pnpm versions
- Deterministic dependency install via lockfile
- Affected-project execution for efficient Nx monorepo checks

## Pipelines

- **CI**: lint, typecheck, test, and build on push/PR.
- **Security**: dependency audit, secret scanning, CodeQL, dependency review.
- **Publish**: package tarball creation and release bundling from `publish` branch.
- **Docs deploy**: validates docs and publishes `docs/` to GitHub Pages.

## Publishing docs to GitHub Pages

1. Ensure repository settings use **GitHub Actions** as Pages source.
2. Push updates to `main`.
3. `deploy-docs` workflow uploads `docs/` as Pages artifact.
4. `actions/deploy-pages` publishes site.

## Recommended branch protections

- Require CI + Security checks before merge.
- Restrict direct pushes to `main` and `publish`.
- Require signed commits for release branches.
