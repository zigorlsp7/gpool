#!/usr/bin/env bash
set -euo pipefail

APP_ENV_FILE="docker/.env.app.local"
APP_ENV_EXAMPLE_FILE="docker/.env.app.local.example"
OPENBAO_LOCAL_ADDR="http://localhost:8200"
GP_SHARED_NETWORK="platform_ops_shared"
OPENBAO_KV_MOUNT="kv"
OPENBAO_SECRET_PATH="gpool"
OPENBAO_REQUIRED_KEYS_API="AUTH_SESSION_SECRET,GOOGLE_CLIENT_SECRET"
OPENBAO_REQUIRED_KEYS_WEB="AUTH_SESSION_SECRET,TOLGEE_API_KEY"
OPENBAO_REQUIRED_KEYS_DB="POSTGRES_PASSWORD"
DB_NAME="gpool"
DB_USER="app"

read_env_var_from_file() {
  local file="$1"
  local key="$2"
  local line
  line="$(grep -E "^${key}=" "$file" | tail -n1 || true)"
  if [ -z "$line" ]; then
    printf ''
    return
  fi
  printf '%s' "${line#*=}"
}


unset_compose_shell_overrides() {
  local file="$1"
  while IFS='=' read -r key _; do
    unset "$key" || true
  done < <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$file" || true)
}
if [ ! -f "$APP_ENV_FILE" ]; then
  if [ ! -f "$APP_ENV_EXAMPLE_FILE" ]; then
    echo "Missing $APP_ENV_FILE and $APP_ENV_EXAMPLE_FILE." >&2
    exit 1
  fi
  cp "$APP_ENV_EXAMPLE_FILE" "$APP_ENV_FILE"
  echo "Created $APP_ENV_FILE from $APP_ENV_EXAMPLE_FILE"
fi

docker network create "$GP_SHARED_NETWORK" >/dev/null 2>&1 || true

openbao_token="$(read_env_var_from_file "$APP_ENV_FILE" "OPENBAO_TOKEN")"
openbao_kv_mount="$OPENBAO_KV_MOUNT"
openbao_secret_path="$OPENBAO_SECRET_PATH"
required_keys_api="$OPENBAO_REQUIRED_KEYS_API"
required_keys_web="$OPENBAO_REQUIRED_KEYS_WEB"
required_keys_db="$OPENBAO_REQUIRED_KEYS_DB"
db_name="$DB_NAME"
db_user="$DB_USER"

if [ -z "$openbao_token" ]; then
  echo "OPENBAO_TOKEN is required in $APP_ENV_FILE" >&2
  exit 1
fi
if [ "$openbao_token" = "CHANGE_ME_LOCAL_OPENBAO_TOKEN" ]; then
  echo "OPENBAO_TOKEN in $APP_ENV_FILE still has the example value. Update it before retrying." >&2
  exit 1
fi

unset_compose_shell_overrides "$APP_ENV_FILE"

echo "Using OpenBao path: ${openbao_kv_mount}/${openbao_secret_path}"

compose_secret_paths="$(
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-compose-check-placeholder}" \
    docker compose --env-file "$APP_ENV_FILE" -f docker/compose.app.local.yml config \
    | sed -n 's/^[[:space:]]*OPENBAO_SECRET_PATH:[[:space:]]*//p' | sort -u
)"
if [ -z "$compose_secret_paths" ]; then
  echo "Could not resolve OPENBAO_SECRET_PATH from docker compose config" >&2
  exit 1
fi
if [ "$compose_secret_paths" != "$openbao_secret_path" ]; then
  echo "Compose OPENBAO_SECRET_PATH mismatch: env=$openbao_secret_path compose=$compose_secret_paths" >&2
  exit 1
fi
echo "Waiting for OpenBao to become ready..."
i=1
openbao_code=""
while [ $i -le 60 ]; do
  openbao_code="$(curl -s -o /dev/null -w '%{http_code}' "$OPENBAO_LOCAL_ADDR/v1/sys/health" || true)"
  case "$openbao_code" in
    200|429|472|473|501|503)
      break
      ;;
  esac
  sleep 2
  i=$((i + 1))
done

if [ $i -gt 60 ]; then
  echo "OpenBao did not become ready in time. Start platform-ops local stack first." >&2
  echo "See docs/local-first-start.md" >&2
  exit 1
fi

case "$openbao_code" in
  200|429|472|473)
    echo "OpenBao is ready"
    ;;
  501)
    echo "OpenBao is uninitialized. Initialize/unseal it from platform-ops first." >&2
    echo "See docs/local-first-start.md" >&2
    exit 1
    ;;
  503)
    echo "OpenBao is sealed. Unseal it from platform-ops first." >&2
    echo "See docs/local-first-start.md" >&2
    exit 1
    ;;
  *)
    echo "Unexpected OpenBao health status: $openbao_code" >&2
    exit 1
    ;;
esac

mount_path="${openbao_kv_mount%/}"
secret_path="${openbao_secret_path#/}"
secret_url="$OPENBAO_LOCAL_ADDR/v1/${mount_path}/data/${secret_path}"
secret_body_file="$(mktemp)"
trap 'rm -f "$secret_body_file"' EXIT

secret_code="$(curl -s -o "$secret_body_file" -w '%{http_code}' -H "X-Vault-Token: $openbao_token" "$secret_url" || true)"
if [ "$secret_code" != "200" ]; then
  echo "OpenBao secret path is not readable with OPENBAO_TOKEN (status=$secret_code): ${mount_path}/${secret_path}" >&2
  cat "$secret_body_file" >&2 || true
  echo >&2
  echo "Create/fix the secret path in OpenBao and retry." >&2
  echo "See docs/local-first-start.md" >&2
  exit 1
fi

required_keys_csv="${required_keys_api},${required_keys_web},${required_keys_db}"
if [ -n "${required_keys_csv//,/}" ]; then
  REQUIRED_KEYS="$required_keys_csv" SECRET_BODY_FILE="$secret_body_file" node -e '
const fs = require("node:fs");
const requiredEnv = process.env.REQUIRED_KEYS;
if (requiredEnv === undefined) {
  throw new Error("REQUIRED_KEYS is required");
}
const required = Array.from(new Set(requiredEnv
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean)));
if (required.length === 0) process.exit(0);
let payload;
try {
  payload = JSON.parse(fs.readFileSync(process.env.SECRET_BODY_FILE, "utf8"));
} catch (err) {
  console.error("Failed to parse OpenBao secret payload:", err.message);
  process.exit(1);
}
const data = payload?.data?.data;
if (!data || typeof data !== "object" || Array.isArray(data)) {
  console.error("OpenBao payload does not contain kv-v2 data.data object");
  process.exit(1);
}
const missing = required.filter((key) => {
  const value = data[key];
  return value === undefined || value === null || String(value).trim().length === 0;
});
if (missing.length > 0) {
  console.error(`OpenBao secret path is missing required keys: ${missing.join(", ")}`);
  process.exit(1);
}
'
fi

postgres_password="$(
  SECRET_BODY_FILE="$secret_body_file" node -e '
const fs = require("node:fs");
let payload;
try {
  payload = JSON.parse(fs.readFileSync(process.env.SECRET_BODY_FILE, "utf8"));
} catch (err) {
  console.error("Failed to parse OpenBao secret payload:", err.message);
  process.exit(1);
}
const value = payload?.data?.data?.POSTGRES_PASSWORD;
if (value === undefined || value === null || String(value).trim().length === 0) {
  console.error("OpenBao secret path is missing required key: POSTGRES_PASSWORD");
  process.exit(1);
}
process.stdout.write(String(value));
'
)"
export POSTGRES_PASSWORD="$postgres_password"

echo "Ensuring PostgreSQL database exists: $db_name"
docker compose --env-file "$APP_ENV_FILE" -f docker/compose.app.local.yml up -d postgres

i=1
while [ $i -le 60 ]; do
  if docker compose --env-file "$APP_ENV_FILE" -f docker/compose.app.local.yml exec -T postgres \
    sh -lc "pg_isready -U \"$db_user\" -d postgres >/dev/null 2>&1"; then
    break
  fi
  sleep 2
  i=$((i + 1))
done

if [ $i -gt 60 ]; then
  echo "Postgres did not become ready in time." >&2
  exit 1
fi

db_exists="$(
  docker compose --env-file "$APP_ENV_FILE" -f docker/compose.app.local.yml exec -T postgres \
    sh -lc "psql -U \"$db_user\" -d postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = '$db_name'\""
)"
db_exists="$(printf '%s' "$db_exists" | tr -d '[:space:]')"

if [ "$db_exists" != "1" ]; then
  docker compose --env-file "$APP_ENV_FILE" -f docker/compose.app.local.yml exec -T postgres \
    sh -lc "psql -U \"$db_user\" -d postgres -c \"CREATE DATABASE \\\"$db_name\\\";\""
fi

docker compose --env-file "$APP_ENV_FILE" -f docker/compose.app.local.yml up -d --build --force-recreate --remove-orphans
echo "App stack started (API runs migrations on startup)."
