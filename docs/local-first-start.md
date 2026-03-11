# Local First Start (gpool)

Use this runbook for first local startup of `gpool`, or after resetting local data/OpenBao.

## 1. Prerequisites

- `platform-ops` local stack is running.
- OpenBao is initialized and unsealed.
- `kv` secrets engine exists in OpenBao.

If OpenBao is not initialized yet, follow:

- `platform-ops/docs/local-first-start.md`

## 2. Create `kv/gpool` Secret in OpenBao (UI)

Open:

- `http://localhost:8200/ui`

In OpenBao UI:

1. Go to secrets engines and open `kv`.
2. Create secret at path `gpool`.
3. Add these keys:
- `AUTH_SESSION_SECRET`
  - generate with:
```bash
openssl rand -hex 32
```
- `GOOGLE_CLIENT_SECRET`
- `SMTP_PASS`
- `TOLGEE_API_KEY`
- `POSTGRES_PASSWORD`

## 3. Create a Read Policy for GPool Token (UI)

In OpenBao UI:

1. Open top-level `Policies` from the left navigation.
2. Click create ACL policy.
3. Name: `gpool-local-read`
4. Policy content:

```hcl
path "kv/data/gpool" { capabilities = ["read"] }
path "kv/metadata/gpool" { capabilities = ["read"] }
```

## 4. Create GPool Read Token (CLI required in this UI version)

Your OpenBao UI may show this message for `token` auth method:

- `The OpenBao UI only supports configuration for this authentication method. For management, the API or CLI should be used.`

Create token with CLI:

```bash
ROOT_TOKEN='paste_root_token_here'
docker compose --env-file docker/.env.ops.local -f docker/compose.ops.local.yml exec -T \
  -e BAO_ADDR=http://127.0.0.1:8200 \
  -e BAO_TOKEN="$ROOT_TOKEN" \
  openbao bao token create -policy=gpool-local-read -format=json \
  | jq -r '.auth.client_token'
```

Use the `ROOT_TOKEN` from OpenBao init.

## 5. Prepare GPool Local Env

Edit `docker/.env.app.local` and confirm at least:

- `OPENBAO_TOKEN=<client token from step 4>`
- `SWAGGER_ENABLED=true` (optional, local)
- `GOOGLE_OAUTH_REDIRECT_URI` and `FRONTEND_URL` are local values
- SMTP config is valid for local testing (`SMTP_USER`, `SMTP_FROM`)

## 6. Start GPool Local Stack

From `gpool` repo root:

```bash
npm run local:up
```

The script will:

- validate OpenBao readiness
- validate token access to `kv/gpool`
- validate required keys
- start postgres, ensure DB exists
- start/rebuild app services

## 7. Validate

```bash
curl -fsS http://localhost:3010/api/health
curl -fsS http://localhost:3011
```

## 8. Troubleshooting

`403 permission denied` on `kv/gpool`:

- token policy is missing/wrong
- token does not include `gpool-local-read`
- `OPENBAO_TOKEN` in `docker/.env.app.local` is outdated

`OpenBao is uninitialized` or `sealed`:

- fix OpenBao state in `platform-ops` first

`missing required keys`:

- one or more required keys under `kv/gpool` are empty/missing

## 9. CLI Fallback (Optional)

```bash
docker compose --env-file docker/.env.ops.local -f docker/compose.ops.local.yml exec -T openbao bao policy write gpool-local-read - <<'EOF'
path "kv/data/gpool" { capabilities = ["read"] }
path "kv/metadata/gpool" { capabilities = ["read"] }
EOF
```
