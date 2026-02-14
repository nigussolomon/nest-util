# CI/CD & GitHub Pages

This repository uses GitHub Actions for quality checks, security, packaging, and docs deployment.

## Pipeline goals

- deterministic builds
- least-privilege workflow permissions
- reduced duplicate runs via concurrency groups
- monorepo-aware execution using affected projects
- validation-before-deploy for docs

---

## CI workflow (`ci.yml`)

Main behavior:

- Detects base/head SHAs for Nx affected analysis
- Runs `lint`, `typecheck`, `test`, and `build` only where required
- Uses lockfile-based dependency installation
- Applies explicit job timeouts

Recommended branch policy:

- Require CI passing before merge
- Require up-to-date branch before merge

---

## Security workflow (`security.yml`)

Checks include:

- dependency audit (`pnpm audit --audit-level=high`)
- secret scanning (Gitleaks)
- CodeQL analysis
- dependency review on pull requests

Recommendations:

- Triaging vulnerabilities weekly
- Block merges on unresolved high severity findings
- Keep dependency upgrade cadence predictable (weekly/biweekly)

---

## Publish workflow (`publish.yml`)

Responsibilities:

- build and verify each library package (`nest-audit`, `nest-crud`, `nest-auth`, `nest-file`)
- create tarballs for every package + CLI artifact
- upload build artifacts
- compose release assets

Recommendations:

- protect `publish` branch
- enforce signed release commits/tags
- document release rollback procedure

---

## Docs deploy workflow (`deploy-docs.yml`)

Flow:

1. Validate required docs files exist
2. Run link check across docs content
3. Deploy to GitHub Pages on non-PR events

This ensures broken documentation links are caught before publication.

---

## GitHub Pages setup

In repository settings:

1. Go to **Pages**
2. Set source to **GitHub Actions**
3. Ensure `deploy-docs.yml` is allowed to write Pages

Deployment target is the `docs/` directory uploaded as an artifact.

---

## Operational checklist

- [ ] CI required on `main`
- [ ] Security required on `main`
- [ ] Dependabot (or equivalent) enabled
- [ ] Secrets stored in repository/environment secrets only
- [ ] Release process documented for maintainers
