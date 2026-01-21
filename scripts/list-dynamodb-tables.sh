#!/bin/bash

# List DynamoDB Local tables
# Usage: ./scripts/list-dynamodb-tables.sh

DYNAMODB_ENDPOINT="http://localhost:8000"
REGION="us-east-1"

echo "Listing DynamoDB tables..."
echo ""

# Use dummy credentials for DynamoDB Local
AWS_ACCESS_KEY_ID=dummy \
AWS_SECRET_ACCESS_KEY=dummy \
aws dynamodb list-tables \
  --endpoint-url $DYNAMODB_ENDPOINT \
  --region $REGION \
  --no-cli-pager \
  --output table 2>&1

# If that fails, try from Docker container
if [ $? -ne 0 ]; then
  echo ""
  echo "Trying via Docker container..."
  docker run --rm \
    --network gpool_gpool-network \
    -e AWS_ACCESS_KEY_ID=dummy \
    -e AWS_SECRET_ACCESS_KEY=dummy \
    amazon/aws-cli:latest \
    dynamodb list-tables \
    --endpoint-url http://dynamodb-local:8000 \
    --region us-east-1 \
    --no-cli-pager \
    --output table 2>&1
fi
