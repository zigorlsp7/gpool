# GitHub Governance

## Branch protection (`main`)

Required checks before merge:

- `CI / Quality (Lint + Typecheck + Build + Unit Coverage)`
- `CI / Secrets Scan (Gitleaks)`
- `CI / Integration Smoke (Compose)`
- `CI / Security + Supply Chain`
- `CodeQL / Analyze`
- `Commitlint / pr-title`

Apply policy in GitHub:

- Repository `Settings` -> `Branches`
- Edit protection rule for `main` with required checks above

## Release automation

- `Release Please` creates release PRs from Conventional Commits.
- `Auto-Approve and Auto-Merge Release Please PR` auto-merges release PRs on green checks.

## Secrets scanning gate

CI job:

- `.github/workflows/ci.yml` job `Secrets Scan (Gitleaks)`

Config:

- `.gitleaks.toml`
