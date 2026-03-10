# gpool Terraform Layout

This folder mirrors the `cv` terraform structure so app and ops concerns stay separated:

- `bootstrap/`: one-time AWS setup primitives (state bucket, IAM/OIDC bootstrap, etc.)
- `aws-compose/`: app deploy-facing outputs consumed by GitHub Actions in `gpool`
- root module files: shared provider/version baseline

## Ownership model

Infrastructure runtime resources are managed in `platform-ops`.
This repository consumes infra outputs and ships application releases.

## Expected outputs for GitHub `production` environment

`gpool` deploy workflow expects these values (typically produced from `platform-ops`):

1. `AWS_REGION`
2. `AWS_DEPLOY_BUCKET`
3. `AWS_DEPLOY_INSTANCE_ID`
4. `AWS_ECR_API_REPOSITORY_URI`
5. `AWS_ECR_WEB_REPOSITORY_URI`
6. `AWS_SSM_APP_PREFIX` (example: `/gpool/prod/app`)
7. `NEXT_PUBLIC_API_BASE_URL`
8. Optional: `DEPLOY_HEALTHCHECK_URL`
