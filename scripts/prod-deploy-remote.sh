#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage:
  $0 \
    --release-dir <path> \
    --region <aws-region> \
    --app-ssm-prefix </gpool/prod/app> \
    --api-image <ecr-uri:tag> \
    --web-image <ecr-uri:tag> \
    --release-tag <tag>
USAGE
}

RELEASE_DIR=""
AWS_REGION=""
APP_SSM_PREFIX=""
API_IMAGE=""
WEB_IMAGE=""
RELEASE_TAG=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --release-dir)
      RELEASE_DIR="$2"
      shift 2
      ;;
    --region)
      AWS_REGION="$2"
      shift 2
      ;;
    --app-ssm-prefix)
      APP_SSM_PREFIX="$2"
      shift 2
      ;;
    --api-image)
      API_IMAGE="$2"
      shift 2
      ;;
    --web-image)
      WEB_IMAGE="$2"
      shift 2
      ;;
    --release-tag)
      RELEASE_TAG="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      exit 1
      ;;
  esac
done

require_value() {
  local name="$1"
  local value="$2"
  if [ -z "$value" ]; then
    echo "Missing required arg: $name" >&2
    usage
    exit 1
  fi
}

require_value "--release-dir" "$RELEASE_DIR"
require_value "--region" "$AWS_REGION"
require_value "--app-ssm-prefix" "$APP_SSM_PREFIX"
require_value "--api-image" "$API_IMAGE"
require_value "--web-image" "$WEB_IMAGE"
require_value "--release-tag" "$RELEASE_TAG"

retry() {
  local attempts="$1"
  local sleep_seconds="$2"
  shift 2
  local i=1

  while true; do
    if "$@"; then
      return 0
    fi

    if [ "$i" -ge "$attempts" ]; then
      return 1
    fi

    sleep "$sleep_seconds"
    i=$((i + 1))
  done
}

for cmd in aws jq docker curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing command: $cmd" >&2
    exit 1
  fi
done

run_compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
    return
  fi

  echo "Missing compose runtime (tried 'docker compose' and 'docker-compose')" >&2
  exit 1
}

if [ ! -d "$RELEASE_DIR" ]; then
  echo "Release dir not found: $RELEASE_DIR" >&2
  exit 1
fi

cd "$RELEASE_DIR"

APP_BASE_ENV_FILE="docker/.env.app.prod"
APP_ENV_FILE="$(mktemp /tmp/gpool-app-env.XXXXXX)"
trap 'rm -f "$APP_ENV_FILE"' EXIT
OPENBAO_LOCAL_ADDR="http://127.0.0.1:8200"
OPENBAO_KV_MOUNT="kv"
OPENBAO_SECRET_PATH="gpool"

if [ ! -f "$APP_BASE_ENV_FILE" ]; then
  echo "Missing base app env file in release bundle: $APP_BASE_ENV_FILE" >&2
  exit 1
fi

cp "$APP_BASE_ENV_FILE" "$APP_ENV_FILE"
chmod 600 "$APP_ENV_FILE"

read_env_var() {
  local file="$1"
  local key="$2"
  grep -E "^${key}=" "$file" | tail -n1 | cut -d'=' -f2- || true
}

require_env_var_in_file() {
  local file="$1"
  local key="$2"
  local value

  value="$(read_env_var "$file" "$key")"
  if [ -z "$value" ]; then
    echo "Missing required non-secret value '$key' in $file" >&2
    exit 1
  fi
}

upsert_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp

  tmp="$(mktemp)"

  awk -v key="$key" -v value="$value" -F= '
    BEGIN { updated=0 }
    $1 == key { print key "=" value; updated=1; next }
    { print }
    END { if (!updated) print key "=" value }
  ' "$file" > "$tmp"

  mv "$tmp" "$file"
}

fetch_ssm_secret_value() {
  local parameter_name="$1"
  local value
  local err_file
  local rc

  err_file="$(mktemp)"

  set +e
  value="$(aws ssm get-parameter --region "$AWS_REGION" --name "$parameter_name" --with-decryption --query 'Parameter.Value' --output text 2>"$err_file")"
  rc=$?
  set -e

  if [ "$rc" -ne 0 ] || [ -z "$value" ] || [ "$value" = "None" ]; then
    echo "Missing required SSM secret: $parameter_name (region=$AWS_REGION)" >&2
    if [ -s "$err_file" ]; then
      cat "$err_file" >&2
    fi
    rm -f "$err_file"
    exit 1
  fi

  rm -f "$err_file"
  printf '%s' "$value"
}

required_non_secret_keys=(
  WEB_DOMAIN
  API_DOMAIN
  NEXT_PUBLIC_API_BASE_URL
  CORS_ORIGINS
  TRUST_PROXY
  SWAGGER_ENABLED
  GOOGLE_CLIENT_ID
  GOOGLE_OAUTH_REDIRECT_URI
  FRONTEND_URL
  SMTP_USER
  SMTP_FROM
)

for key in "${required_non_secret_keys[@]}"; do
  require_env_var_in_file "$APP_ENV_FILE" "$key"
done

openbao_token="$(fetch_ssm_secret_value "${APP_SSM_PREFIX%/}/OPENBAO_TOKEN")"
upsert_env_var "$APP_ENV_FILE" "OPENBAO_TOKEN" "$openbao_token"
upsert_env_var "$APP_ENV_FILE" "API_IMAGE" "$API_IMAGE"
upsert_env_var "$APP_ENV_FILE" "WEB_IMAGE" "$WEB_IMAGE"
upsert_env_var "$APP_ENV_FILE" "NEXT_PUBLIC_RELEASE" "$RELEASE_TAG"

docker network create "platform_ops_shared" >/dev/null 2>&1 || true

echo "[deploy] Waiting for OpenBao health"
openbao_ready="false"
openbao_code=""
i=1
while [ $i -le 60 ]; do
  openbao_code="$(curl -s -o /dev/null -w '%{http_code}' "$OPENBAO_LOCAL_ADDR/v1/sys/health" || true)"
  if [ "$openbao_code" = "200" ] || [ "$openbao_code" = "429" ]; then
    openbao_ready="true"
    break
  fi
  if [ "$openbao_code" = "501" ] || [ "$openbao_code" = "503" ]; then
    echo "[deploy] OpenBao health is $openbao_code (not initialized or sealed). Ensure platform-ops is initialized and unsealed." >&2
    break
  fi
  sleep 2
  i=$((i + 1))
done

if [ "$openbao_ready" != "true" ]; then
  echo "OpenBao did not become ready (last_health_code=$openbao_code). Ensure platform-ops is running on this host." >&2
  exit 1
fi

openbao_secret_url="${OPENBAO_LOCAL_ADDR}/v1/${OPENBAO_KV_MOUNT}/data/${OPENBAO_SECRET_PATH}"
openbao_secret_body_file="$(mktemp)"

openbao_secret_code="$(curl -s -o "$openbao_secret_body_file" -w '%{http_code}' -H "X-Vault-Token: $openbao_token" "$openbao_secret_url" || true)"
if [ "$openbao_secret_code" != "200" ]; then
  echo "Failed to read OpenBao secret ${OPENBAO_KV_MOUNT}/${OPENBAO_SECRET_PATH} with OPENBAO_TOKEN (status=$openbao_secret_code)" >&2
  cat "$openbao_secret_body_file" >&2 || true
  rm -f "$openbao_secret_body_file"
  exit 1
fi

if ! postgres_password="$(jq -r '.data.data.POSTGRES_PASSWORD // ""' "$openbao_secret_body_file")"; then
  echo "Failed to parse OpenBao secret payload from ${OPENBAO_KV_MOUNT}/${OPENBAO_SECRET_PATH}" >&2
  cat "$openbao_secret_body_file" >&2 || true
  rm -f "$openbao_secret_body_file"
  exit 1
fi

if [ -z "$postgres_password" ]; then
  echo "OpenBao secret is missing required key: POSTGRES_PASSWORD" >&2
  rm -f "$openbao_secret_body_file"
  exit 1
fi
rm -f "$openbao_secret_body_file"

export POSTGRES_PASSWORD="$postgres_password"

ECR_LOGGED_IN_REGISTRIES="|"

is_ecr_registry() {
  local registry="$1"
  [[ "$registry" == *".dkr.ecr."*".amazonaws.com"* ]]
}

login_ecr_for_image() {
  local image="$1"
  local registry
  local registry_region

  registry="${image%%/*}"

  if [ -z "$registry" ] || [ "$registry" = "$image" ]; then
    return 0
  fi

  if ! is_ecr_registry "$registry"; then
    return 0
  fi

  if [[ "$ECR_LOGGED_IN_REGISTRIES" == *"|${registry}|"* ]]; then
    return 0
  fi

  registry_region="$(printf '%s' "$registry" | awk -F'.' '{print $4}')"
  if [ -z "$registry_region" ]; then
    registry_region="$AWS_REGION"
  fi

  echo "[deploy] Logging into ECR registry: $registry (region=$registry_region)"
  aws ecr get-login-password --region "$registry_region" | docker login --username AWS --password-stdin "$registry" >/dev/null

  ECR_LOGGED_IN_REGISTRIES="${ECR_LOGGED_IN_REGISTRIES}${registry}|"
}

login_ecr_for_image "$API_IMAGE"
login_ecr_for_image "$WEB_IMAGE"

echo "[deploy] Starting gpool app stack"
run_compose --env-file "$APP_ENV_FILE" -f docker/compose.app.prod.yml up -d

api_domain="$(grep -E '^API_DOMAIN=' "$APP_ENV_FILE" | tail -n1 | cut -d'=' -f2- || true)"
web_domain="$(grep -E '^WEB_DOMAIN=' "$APP_ENV_FILE" | tail -n1 | cut -d'=' -f2- || true)"

if [ -z "$api_domain" ] || [ -z "$web_domain" ]; then
  echo "API_DOMAIN and WEB_DOMAIN must be present in $APP_ENV_FILE" >&2
  exit 1
fi

echo "[deploy] Health checking API via Caddy"
retry 30 2 curl -fsS -H "Host: $api_domain" http://127.0.0.1/api/health >/dev/null

echo "[deploy] Health checking web via Caddy"
retry 30 2 curl -fsS -H "Host: $web_domain" http://127.0.0.1/ >/dev/null

run_compose --env-file "$APP_ENV_FILE" -f docker/compose.app.prod.yml ps

echo "[deploy] Release $RELEASE_TAG deployed successfully"
