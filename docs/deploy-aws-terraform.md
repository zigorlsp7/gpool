# AWS Production Deployment (gpool on platform-ops)

This repo deploys only the `gpool` app stack. Ops infrastructure is managed in `platform-ops`.

## Architecture

- `platform-ops` manages host/infrastructure + ops services.
- `gpool` deploy workflow builds app images and runs remote app deploy.
- App runtime env comes from SSM path (`/gpool/prod/app`).
- OpenBao + Tolgee variables are part of the app env contract and should be configured for production.
- OTEL traces are exported to `platform-ops` collector.
- Docker logs are shipped to Loki via Alloy sidecar.

## Prerequisites

1. Platform ops is provisioned and healthy.
2. `gpool` and `platform-ops` share network `platform_ops_shared` on the host.
3. ECR repositories exist for:
   - `gpool-api`
   - `gpool-web`
4. EC2 deploy instance can:
   - read deploy bundles from S3
   - read app env from SSM path
   - pull images from ECR
5. OpenBao is initialized/unsealed in `platform-ops` and has:
   - KV v2 mount `kv/`
   - app secret path `kv/gpool`
6. Tolgee is running in `platform-ops`.

## GitHub Environment Setup (`production`)

Deploy workflow: `.github/workflows/deploy.yml`

Set secret:

1. `AWS_DEPLOY_ROLE_ARN`

Set variables:

1. `AWS_REGION`
2. `AWS_DEPLOY_BUCKET`
3. `AWS_DEPLOY_INSTANCE_ID`
4. `AWS_ECR_API_REPOSITORY_URI`
5. `AWS_ECR_WEB_REPOSITORY_URI`
6. `AWS_SSM_APP_PREFIX` (example `/gpool/prod/app`)
7. `NEXT_PUBLIC_API_URL`
8. `DEPLOY_HEALTHCHECK_URL` (optional, recommended)

## SSM App Parameters

`gpool` remote deploy rewrites `docker/.env.app.prod` on the instance from SSM path `AWS_SSM_APP_PREFIX`.

Template source in repo: `docker/.env.app.prod`

Sync example:

```bash
./scripts/aws-ssm-sync-env.sh \
  --file docker/.env.app.prod \
  --prefix /gpool/prod/app \
  --region us-east-1 \
  --secure-keys OPENBAO_TOKEN
```

## Deploy

1. Merge to `main`.
2. `Release Please` creates/updates a release PR.
3. Release PR is auto-approved + auto-merged after checks pass.
4. `Deploy AWS App (EC2 Compose)` runs automatically on `release.published`.

Manual deploy is also possible via workflow dispatch with a release tag.

## OpenBao + Tolgee keys

Set these values in `/gpool/prod/app` (SSM):

1. `OPENBAO_ADDR`
2. `OPENBAO_TOKEN`
3. `OPENBAO_KV_MOUNT` (`kv`)
4. `OPENBAO_SECRET_PATH` (`gpool`)
5. `OPENBAO_REQUIRED_KEYS_API`
6. `OPENBAO_REQUIRED_KEYS_WEB`
7. `TOLGEE_API_URL` (usually `http://tolgee:8080` on shared network)
8. `TOLGEE_PROJECT_ID`
9. `OTEL_SERVICE_NAME` (for example `gpool-api`)
10. `OTEL_EXPORTER_OTLP_ENDPOINT` (for shared host usually `http://otel-collector:4318`)

Recommended secret keys in OpenBao `kv/gpool`:

1. `TOLGEE_API_KEY`
2. `GOOGLE_CLIENT_SECRET`
3. `AUTH_SESSION_SECRET`
4. `SMTP_PASS`
5. `POSTGRES_PASSWORD`
