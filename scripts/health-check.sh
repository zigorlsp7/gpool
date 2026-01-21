#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Checking service health...${NC}\n"

# Function to check service
check_service() {
    local name=$1
    local url=$2
    
    if curl -f -s $url > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $name: Healthy${NC}"
        return 0
    else
        echo -e "${RED}✗ $name: Unhealthy${NC}"
        return 1
    fi
}

# Check infrastructure
check_service "DynamoDB Local" "http://localhost:8000"

echo ""

# Check services
check_service "Auth Service" "http://localhost:3001/health" || true
check_service "User Service" "http://localhost:3002/health" || true
check_service "Pool Service" "http://localhost:3003/health" || true
check_service "Match Service" "http://localhost:3004/health" || true
check_service "Prediction Service" "http://localhost:3005/health" || true
check_service "Scoring Service" "http://localhost:3006/health" || true
check_service "Leaderboard Service" "http://localhost:3007/health" || true
check_service "Notification Service" "http://localhost:3008/health" || true
check_service "WebSocket Service" "http://localhost:3009/health" || true
check_service "Web App" "http://localhost:3000" || true

echo ""
echo -e "${YELLOW}Health check complete!${NC}"
