# Environment Management

`gpool` uses two app env files under `docker/`:

- `docker/.env.app.local`: local compose runtime
- `docker/.env.app.prod`: production template synced to SSM

OpenBao + Tolgee are also defined in these app env files:

- OpenBao pointer + auth: `OPENBAO_*`
- Tolgee runtime config: `TOLGEE_API_URL`, `TOLGEE_PROJECT_ID`
- OTEL tracing config: `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`
- Swagger docs toggle: `SWAGGER_ENABLED`

UI translation source is auto-detected at runtime:

- If `TOLGEE_API_URL`, `TOLGEE_PROJECT_ID`, and `TOLGEE_API_KEY` are available, UI pulls from Tolgee.
- Otherwise, UI falls back to local JSON messages under `apps/ui/messages`.

Required OpenBao keys at `kv/gpool`:

- API: `AUTH_SESSION_SECRET`, `GOOGLE_CLIENT_SECRET`, `SMTP_PASS`
- Web: `AUTH_SESSION_SECRET`, `TOLGEE_API_KEY`
- DB/startup: `POSTGRES_PASSWORD`

Log shipping to platform Loki is handled by Alloy sidecar in app compose:

- `docker/alloy/config.alloy`

Validate contracts:

```bash
npm run env:doctor
```

Sync production template to SSM:

```bash
./scripts/aws-ssm-sync-env.sh \
  --file docker/.env.app.prod \
  --prefix /gpool/prod/app \
  --region us-east-1 \
  --secure-keys OPENBAO_TOKEN
```
