#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/env-doctor.sh [--mode all|local|prod]

Checks app env-file contract drift across local/prod files.
USAGE
}

MODE="all"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --mode)
      MODE="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

case "$MODE" in
  all|local|prod) ;;
  *)
    echo "Invalid --mode value: $MODE (expected all|local|prod)" >&2
    exit 1
    ;;
esac

APP_LOCAL="docker/.env.app.local"
APP_PROD="docker/.env.app.prod"

error_count=0
warning_count=0

has_key() {
  local file="$1"
  local key="$2"
  grep -Eq "^${key}=" "$file"
}

read_value() {
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

require_file() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "ERROR  missing file: $file" >&2
    error_count=$((error_count + 1))
  fi
}

check_required_keys() {
  local file="$1"
  local scope="$2"
  shift 2

  local key value
  for key in "$@"; do
    if ! has_key "$file" "$key"; then
      echo "ERROR  [$scope] missing key: $key ($file)" >&2
      error_count=$((error_count + 1))
      continue
    fi

    value="$(read_value "$file" "$key")"
    if [ -z "$value" ]; then
      echo "ERROR  [$scope] empty value: $key ($file)" >&2
      error_count=$((error_count + 1))
    fi
  done
}

check_forbidden_placeholder() {
  local file="$1"
  local scope="$2"
  shift 2

  local key value
  for key in "$@"; do
    value="$(read_value "$file" "$key")"
    if [ "$value" = "CHANGE_ME" ] || [ "$value" = "REQUIRED_SET_BY_DEPLOY" ]; then
      echo "WARN   [$scope] placeholder value still set for key: $key" >&2
      warning_count=$((warning_count + 1))
    fi
  done
}

check_forbidden_keys() {
  local file="$1"
  local scope="$2"
  shift 2

  local key value
  for key in "$@"; do
    if has_key "$file" "$key"; then
      value="$(read_value "$file" "$key")"
      if [ -n "$value" ]; then
        echo "WARN   [$scope] secret-like key should not live in $file: $key" >&2
        warning_count=$((warning_count + 1))
      fi
    fi
  done
}

check_openbao_contract() {
  local file="$1"
  local scope="$2"
  local mount path

  mount="$(read_value "$file" "OPENBAO_KV_MOUNT")"
  path="$(read_value "$file" "OPENBAO_SECRET_PATH")"

  if [ "$mount" != "kv" ]; then
    echo "ERROR  [$scope] OPENBAO_KV_MOUNT must be 'kv' (got '$mount')" >&2
    error_count=$((error_count + 1))
  fi

  if [ "$path" != "gpool" ]; then
    echo "ERROR  [$scope] OPENBAO_SECRET_PATH must be 'gpool' (got '$path')" >&2
    error_count=$((error_count + 1))
  fi
}

if [ "$MODE" = "all" ] || [ "$MODE" = "local" ]; then
  require_file "$APP_LOCAL"
  if [ -f "$APP_LOCAL" ]; then
    check_required_keys "$APP_LOCAL" "local-app" \
      GP_SHARED_NETWORK NODE_ENV POSTGRES_USER POSTGRES_DB \
      DB_HOST DB_PORT DB_USER DB_NAME API_PORT WEB_PORT NEXT_PUBLIC_API_URL NEXT_PUBLIC_RELEASE \
      SWAGGER_ENABLED OTEL_SERVICE_NAME OTEL_EXPORTER_OTLP_ENDPOINT \
      CORS_ORIGINS OPENBAO_ADDR OPENBAO_TOKEN OPENBAO_KV_MOUNT OPENBAO_SECRET_PATH OPENBAO_REQUIRED_KEYS_API \
      OPENBAO_REQUIRED_KEYS_WEB TOLGEE_API_URL TOLGEE_PROJECT_ID \
      GOOGLE_CLIENT_ID GOOGLE_CALLBACK_URL \
      SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_FROM FRONTEND_URL
    check_openbao_contract "$APP_LOCAL" "local-app"
    check_forbidden_keys "$APP_LOCAL" "local-app" \
      AUTH_SESSION_SECRET GOOGLE_CLIENT_SECRET SMTP_PASS TOLGEE_API_KEY POSTGRES_PASSWORD DB_PASSWORD
    check_forbidden_placeholder "$APP_LOCAL" "local-app" OPENBAO_TOKEN
  fi
fi

if [ "$MODE" = "all" ] || [ "$MODE" = "prod" ]; then
  require_file "$APP_PROD"
  if [ -f "$APP_PROD" ]; then
    check_required_keys "$APP_PROD" "prod-app" \
      GP_SHARED_NETWORK API_IMAGE WEB_IMAGE WEB_DOMAIN API_DOMAIN NODE_ENV \
      POSTGRES_USER POSTGRES_DB \
      DB_HOST DB_PORT DB_USER DB_NAME NEXT_PUBLIC_API_URL NEXT_PUBLIC_RELEASE CORS_ORIGINS \
      SWAGGER_ENABLED OTEL_SERVICE_NAME OTEL_EXPORTER_OTLP_ENDPOINT \
      OPENBAO_ADDR OPENBAO_TOKEN OPENBAO_KV_MOUNT OPENBAO_SECRET_PATH OPENBAO_REQUIRED_KEYS_API OPENBAO_REQUIRED_KEYS_WEB \
      TOLGEE_API_URL TOLGEE_PROJECT_ID GOOGLE_CLIENT_ID GOOGLE_CALLBACK_URL \
      SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_FROM FRONTEND_URL
    check_openbao_contract "$APP_PROD" "prod-app"
    check_forbidden_keys "$APP_PROD" "prod-app" \
      AUTH_SESSION_SECRET GOOGLE_CLIENT_SECRET SMTP_PASS TOLGEE_API_KEY POSTGRES_PASSWORD DB_PASSWORD
    check_forbidden_placeholder "$APP_PROD" "prod-app" \
      API_IMAGE WEB_IMAGE OPENBAO_TOKEN
  fi
fi

echo

echo "Env doctor summary:"
echo "  mode: $MODE"
echo "  errors: $error_count"
echo "  warnings: $warning_count"

if [ "$error_count" -gt 0 ]; then
  exit 1
fi

echo "OK: env contract checks passed."
