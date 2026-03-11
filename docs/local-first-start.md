# Local First Start (gpool)

Use this runbook when you are creating the `gpool` local environment from scratch.
Complete `platform-ops/docs/local-first-start.md` first. `gpool` depends on the shared local OpenBao, Tolgee, observability stack, and Docker network provided there.

## 1. What You Are Building

When this runbook is complete, you will have:

- the `gpool` API running on `http://localhost:3010`
- the `gpool` web app running on `http://localhost:3011`
- a local Postgres database for `gpool`
- Google OAuth login working locally
- runtime translations loaded from Tolgee
- optional email delivery through the separate `notifications` local stack

## 2. Prerequisites

Run every command in this document from the `gpool` repo root.

Required:

- `platform-ops` local stack is already running
- OpenBao in `platform-ops` is initialized and unsealed
- `kv` v2 is enabled in OpenBao
- Docker
- `npm`
- `jq`
- access to a Google Cloud project where you can create an OAuth client

Optional but recommended:

- the `notifications` local stack, if you want actual local email delivery

## 3. Create The Tolgee Project And API Key

`gpool` requires a Tolgee project and API key before the web container can start.

Open Tolgee:

- `http://localhost:8090`

Log in with the bootstrap credentials from `platform-ops/docker/.env.ops.local`.

Then:

1. create a project for `gpool` if it does not already exist
2. note the numeric project id
3. create an API key that the server-side runtime can use to read or export translations

You will need:

- the project id for `TOLGEE_PROJECT_ID` in `docker/.env.app.local`
- the API key for `TOLGEE_API_KEY` in OpenBao

Important:

- the tracked local env file defaults `TOLGEE_PROJECT_ID=3`
- if your fresh Tolgee instance gives `gpool` a different id, update `docker/.env.app.local`

## 4. Create The Google OAuth Client

`gpool` local login uses Google OAuth.

Create a Google OAuth client in Google Cloud Console with:

- application type: `Web application`
- authorized JavaScript origin: `http://localhost:3011`
- authorized redirect URI: `http://localhost:3011/api/auth/google/callback`

If you use a different local frontend URL, change the origin and redirect URI accordingly.

You will need:

- the Google client id for tracked file `docker/.env.app.local`
- the Google client secret for OpenBao secret `kv/gpool`

## 5. Create The OpenBao Secret `kv/gpool`

Open OpenBao:

- `http://localhost:8200/ui`

Create secret path `kv/gpool` with these keys:

- `AUTH_SESSION_SECRET`
  - used to sign the application session
  - generate with `openssl rand -hex 32`
- `GOOGLE_CLIENT_SECRET`
  - client secret from the Google OAuth client you created
- `TOLGEE_API_KEY`
  - API key from the Tolgee project
- `POSTGRES_PASSWORD`
  - password for the local `gpool` Postgres database

## 6. Create A Read-Only Policy For `gpool`

Create an OpenBao ACL policy named `gpool-local-read`:

```bash
docker compose --env-file ../platform-ops/docker/.env.ops.local -f ../platform-ops/docker/compose.ops.local.yml exec -T openbao bao policy write gpool-local-read - <<'EOF'
path "kv/data/gpool" { capabilities = ["read"] }
path "kv/metadata/gpool" { capabilities = ["read"] }
EOF
```

This policy allows the app to read only `kv/gpool`.

## 7. Create The `gpool` OpenBao Token

Use the OpenBao root token saved during the `platform-ops` bootstrap.

Create the app token:

```bash
ROOT_TOKEN='paste_root_token_here'

docker compose --env-file ../platform-ops/docker/.env.ops.local -f ../platform-ops/docker/compose.ops.local.yml exec -T \
  -e BAO_ADDR=http://127.0.0.1:8200 \
  -e BAO_TOKEN="$ROOT_TOKEN" \
  openbao bao token create -policy=gpool-local-read -format=json \
  | jq -r '.auth.client_token'
```

Copy the printed token value and use it only for `gpool`.

## 8. Prepare The Local Env File

Create the real local env file from the tracked example:

```bash
cp docker/.env.app.local.example docker/.env.app.local
```

Edit `docker/.env.app.local`.

Set or review these values:

- `OPENBAO_TOKEN`
  - set it to the `gpool-local-read` token from the previous step
- `TOLGEE_PROJECT_ID`
  - set it to the real Tolgee project id for `gpool`
- `GOOGLE_CLIENT_ID`
  - public client id from the Google OAuth client
- `GOOGLE_OAUTH_REDIRECT_URI`
  - should match the Google OAuth client redirect URI
- `FRONTEND_URL`
  - should match the local web origin, normally `http://localhost:3011`
- `SWAGGER_ENABLED`
  - set to `true` if you want Swagger locally
- `NOTIFICATIONS_KAFKA_BROKERS`
  - keep the default if you use the local `notifications` stack

Leave these placeholders as they are:

- `POSTGRES_PASSWORD=SET_FROM_OPEN_BAO`
- `API_IMAGE=REQUIRED_SET_BY_DEPLOY`
- `WEB_IMAGE=REQUIRED_SET_BY_DEPLOY`

## 9. Start The Local Stack

Start the app:

```bash
npm run local:up
```

What the script does:

- validates OpenBao reachability
- validates the token against `kv/gpool`
- validates the required OpenBao keys
- exports `POSTGRES_PASSWORD` from OpenBao
- starts or rebuilds the local Docker Compose stack

## 10. Validate The Local App

Check the API:

```bash
curl -fsS http://localhost:3010/api/health
```

Open the web app:

- `http://localhost:3011`

Recommended manual checks:

- sign in with Google
- create or update data through the UI
- if `notifications` is also running, verify any email-producing flow you care about

## 11. Daily Commands

Start or restart the local app:

```bash
npm run local:up
```

Stop the stack but keep volumes:

```bash
npm run local:down
```

Stop the stack and delete local volumes:

```bash
npm run local:reset
```

## 12. Troubleshooting

`403 permission denied` when reading `kv/gpool`:

- the token does not have the `gpool-local-read` policy
- the token in `docker/.env.app.local` is wrong or outdated

Google login redirects fail:

- `GOOGLE_OAUTH_REDIRECT_URI` does not exactly match the redirect URI configured in Google Cloud
- `FRONTEND_URL` and the authorized origin do not match
- `GOOGLE_CLIENT_SECRET` in OpenBao is wrong

Translations do not load:

- `TOLGEE_PROJECT_ID` does not match the real Tolgee project
- `TOLGEE_API_KEY` is wrong or missing

Email-producing flows fail:

- the `notifications` stack is not running
- `NOTIFICATIONS_KAFKA_BROKERS` points to the wrong broker

You need container logs:

```bash
docker compose --env-file docker/.env.app.local -f docker/compose.app.local.yml logs --no-color <service>
```

Common services:

- `api`
- `web`
- `postgres`

## 13. Next Step

If you want local email delivery, continue with:

- `../notifications/docs/local-first-start.md`
