#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

DYNAMODB_ENDPOINT="http://localhost:8000"
REGION="us-east-1"

# Set dummy credentials for DynamoDB Local
export AWS_ACCESS_KEY_ID=dummy
export AWS_SECRET_ACCESS_KEY=dummy

echo -e "${YELLOW}Deleting all DynamoDB Local tables...${NC}"

# Get list of tables
TABLES=$(aws dynamodb list-tables \
  --endpoint-url "$DYNAMODB_ENDPOINT" \
  --region "$REGION" \
  --no-cli-pager \
  --query 'TableNames[]' \
  --output text 2>/dev/null)

if [ -z "$TABLES" ]; then
  echo -e "${YELLOW}No tables found.${NC}"
  exit 0
fi

# Delete each table
for table in $TABLES; do
  echo -e "${YELLOW}Deleting table: $table${NC}"
  aws dynamodb delete-table \
    --table-name "$table" \
    --endpoint-url "$DYNAMODB_ENDPOINT" \
    --region "$REGION" \
    --no-cli-pager >/dev/null 2>&1
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Deleted $table${NC}"
  else
    echo -e "${RED}✗ Failed to delete $table${NC}"
  fi
done

echo -e "${GREEN}All tables deleted!${NC}"
