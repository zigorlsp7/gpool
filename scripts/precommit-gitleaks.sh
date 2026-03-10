#!/usr/bin/env bash
set -euo pipefail

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks is not installed. Install it to run secret scans." >&2
  echo "macOS (brew): brew install gitleaks" >&2
  echo "Other: https://github.com/gitleaks/gitleaks#installation" >&2
  exit 1
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git diff --cached --name-only -z \
    | xargs -0 -I {} sh -c 'if [ -f "$1" ]; then cat "$1"; fi' _ {} \
    | gitleaks detect --pipe --redact --config .gitleaks.toml
else
  gitleaks detect --source . --redact --config .gitleaks.toml
fi
