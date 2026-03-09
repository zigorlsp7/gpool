#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Checking gpool app-local health...${NC}\n"

check_http() {
  local name="$1"
  local url="$2"

  if curl -fsS "$url" >/dev/null 2>&1; then
    echo -e "${GREEN}[ok]${NC} $name"
    return 0
  fi

  echo -e "${RED}[fail]${NC} $name ($url)"
  return 1
}

check_tcp() {
  local name="$1"
  local host="$2"
  local port="$3"

  if nc -z "$host" "$port" >/dev/null 2>&1; then
    echo -e "${GREEN}[ok]${NC} $name"
    return 0
  fi

  echo -e "${RED}[fail]${NC} $name ($host:$port)"
  return 1
}

check_http "API" "http://localhost:3000/api/health" || true
check_http "Web app" "http://localhost:3001" || true
check_tcp "Postgres" "localhost" "5432" || true

echo
echo -e "${YELLOW}Health check complete.${NC}"
