# Deployment

Current production deployment model:

1. `platform-ops` provisions/operates infra + shared ops services.
2. `gpool` deploys app images and app compose only.
3. Runtime app env comes from SSM (`/gpool/prod/app`) including OpenBao/Tolgee pointers.
4. Runtime app secrets are read from OpenBao path `kv/gpool`.
5. App edge routing/TLS config lives in `docker/caddy/Caddyfile.app.prod` (no in-repo `infrastructure/` stack).
6. Observability integration is app-level:
- OTEL traces exported to `platform-ops` collector (`OTEL_EXPORTER_OTLP_ENDPOINT`)
- Prometheus metrics exposed at `/metrics`
- Docker logs shipped to Loki via `docker/alloy/config.alloy`

Main docs:

- `docs/deploy-aws-terraform.md`
- `docs/github-governance.md`
