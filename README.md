# gpool

Football pool platform monorepo.

## Repository shape (aligned with `cv`)

- `apps/ui`: Next.js web app
- `apps/api`: NestJS monolithic backend (auth + pools + notifications + RUM)
- `docker/`: app-local, app-prod, ci/precommit compose manifests + env templates
- `infra/terraform/`: deploy-facing terraform layout
- `.github/workflows/`: CI, deploy, release, governance workflows

## Quick start

1. Install dependencies

```bash
npm install
```

2. Start local app stack

```bash
npm run local:up
```

This app stack expects the shared Docker network from `platform-ops` (`platform_ops_shared` by default).

3. Check stack

```bash
curl -fsS http://localhost:3010/api/health
curl -fsS http://localhost:3011
```

4. Stop stack

```bash
npm run local:down
```

## Quality commands

```bash
npm run lint
npm run typecheck
npm run build
npm run test
npm run env:doctor
```

## Release + deploy model

- `Release Please` manages versioning/changelog + release PR.
- On release publish, `Deploy AWS App (EC2 Compose)` builds/pushes images and deploys remotely via AWS SSM.
- Runtime env comes from SSM path (default `/gpool/prod/app`) rendered into `docker/.env.app.prod` on the host.
- Platform infra/ops services are owned by `platform-ops`; this repo only ships app stack compose + app config under `docker/`.

See:

- `docs/deployment.md`
- `docs/observability.md`
- `docs/deploy-aws-terraform.md`
- `docs/github-governance.md`
