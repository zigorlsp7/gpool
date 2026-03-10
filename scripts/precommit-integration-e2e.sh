#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker/compose.precommit.yml"
STARTED_BY_HOOK=0
STACK_SERVICES=(postgres api web)

cleanup() {
  if [ "$STARTED_BY_HOOK" -eq 1 ]; then
    docker compose -f "$COMPOSE_FILE" down -v >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

running_container="$(docker compose -f "$COMPOSE_FILE" ps -q api 2>/dev/null || true)"
existing_local_stack=0
local_api_container="$(
  docker compose --env-file docker/.env.app.local -f docker/compose.app.local.yml ps -q api 2>/dev/null || true
)"
local_web_container="$(
  docker compose --env-file docker/.env.app.local -f docker/compose.app.local.yml ps -q web 2>/dev/null || true
)"

if [ -n "$local_api_container" ] && [ -n "$local_web_container" ]; then
  existing_local_stack=1
fi

if [ -z "$running_container" ] && [ "$existing_local_stack" -eq 0 ]; then
  docker compose -f "$COMPOSE_FILE" up -d --build "${STACK_SERVICES[@]}"
  STARTED_BY_HOOK=1
fi

API_HEALTH_URL="http://localhost:3010/api/health"
METRICS_URL="http://localhost:3010/metrics"
WEB_HEALTH_URL="http://localhost:3101"

if [ "$existing_local_stack" -eq 1 ]; then
  WEB_HEALTH_URL="http://localhost:3011"
fi

echo "Waiting for API health..."
i=1
while [ $i -le 60 ]; do
  if curl -fsS "$API_HEALTH_URL" >/dev/null; then
    break
  fi
  sleep 2
  i=$((i + 1))
done

if [ $i -gt 60 ]; then
  echo "API did not become healthy in time" >&2
  docker compose -f "$COMPOSE_FILE" logs --no-color api
  exit 1
fi

metrics_payload="$(curl -fsS "$METRICS_URL")"
if ! printf '%s\n' "$metrics_payload" | grep -q 'http_requests_total'; then
  echo "Missing http_requests_total in /metrics output" >&2
  exit 1
fi

if ! printf '%s\n' "$metrics_payload" | grep -q 'http_request_duration_seconds_bucket'; then
  echo "Missing http_request_duration_seconds_bucket in /metrics output" >&2
  exit 1
fi

echo "Waiting for web health..."
i=1
while [ $i -le 60 ]; do
  if curl -fsS "$WEB_HEALTH_URL" >/dev/null; then
    break
  fi
  sleep 2
  i=$((i + 1))
done

if [ $i -gt 60 ]; then
  echo "Web did not become reachable in time" >&2
  docker compose -f "$COMPOSE_FILE" logs --no-color web api
  exit 1
fi

echo "Precommit integration smoke passed"
