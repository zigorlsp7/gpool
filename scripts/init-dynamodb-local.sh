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

echo -e "${YELLOW}Initializing DynamoDB Local tables...${NC}"

# Function to create table if it doesn't exist
create_table_if_not_exists() {
  local table_name=$1
  local create_command=$2
  
  # Check if table exists
  if aws dynamodb describe-table \
    --table-name "$table_name" \
    --endpoint-url "$DYNAMODB_ENDPOINT" \
    --region "$REGION" \
    --no-cli-pager \
    >/dev/null 2>&1; then
    echo -e "${GREEN}✓ $table_name table already exists${NC}"
    return 0
  fi
  
  # Table doesn't exist, create it
  echo -e "${YELLOW}Creating $table_name table...${NC}"
  if eval "$create_command"; then
    echo -e "${GREEN}✓ $table_name table created${NC}"
    return 0
  else
    echo -e "${RED}✗ Failed to create $table_name table${NC}"
    return 1
  fi
}

# Users table - using direct command due to complex GlobalSecondaryIndexes syntax
if ! aws dynamodb describe-table --table-name Users --endpoint-url "$DYNAMODB_ENDPOINT" --region "$REGION" --no-cli-pager >/dev/null 2>&1; then
  echo -e "${YELLOW}Creating Users table...${NC}"
  aws dynamodb create-table \
    --endpoint-url "$DYNAMODB_ENDPOINT" \
    --region "$REGION" \
    --table-name Users \
    --attribute-definitions \
      AttributeName=userId,AttributeType=S \
      AttributeName=email,AttributeType=S \
    --key-schema \
      AttributeName=userId,KeyType=HASH \
    --global-secondary-indexes \
      IndexName=email-index,KeySchema=[{AttributeName=email,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
    --billing-mode PAY_PER_REQUEST \
    --no-cli-pager >/dev/null 2>&1 && echo -e "${GREEN}✓ Users table created${NC}" || echo -e "${GREEN}✓ Users table ready${NC}"
else
  echo -e "${GREEN}✓ Users table already exists${NC}"
fi

# RefreshTokens table
create_table_if_not_exists "RefreshTokens" "aws dynamodb create-table \
  --endpoint-url $DYNAMODB_ENDPOINT \
  --region $REGION \
  --table-name RefreshTokens \
  --attribute-definitions \
    AttributeName=tokenId,AttributeType=S \
  --key-schema \
    AttributeName=tokenId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager"

# Pools table
aws dynamodb create-table \
  --endpoint-url $DYNAMODB_ENDPOINT \
  --region $REGION \
  --table-name Pools \
  --attribute-definitions \
    AttributeName=poolId,AttributeType=S \
    AttributeName=adminUserId,AttributeType=S \
    AttributeName=status,AttributeType=S \
    AttributeName=createdAt,AttributeType=N \
  --key-schema \
    AttributeName=poolId,KeyType=HASH \
  --global-secondary-indexes \
    IndexName=admin-index,KeySchema=[{AttributeName=adminUserId,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
    IndexName=status-index,KeySchema=[{AttributeName=status,KeyType=HASH},{AttributeName=createdAt,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "Pools table already exists"

echo -e "${GREEN}✓ Pools table ready${NC}"

# PoolConfigurations table
aws dynamodb create-table \
  --endpoint-url $DYNAMODB_ENDPOINT \
  --region $REGION \
  --table-name PoolConfigurations \
  --attribute-definitions \
    AttributeName=poolId,AttributeType=S \
  --key-schema \
    AttributeName=poolId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "PoolConfigurations table already exists"

echo -e "${GREEN}✓ PoolConfigurations table ready${NC}"

# PoolMemberships table
aws dynamodb create-table \
  --endpoint-url $DYNAMODB_ENDPOINT \
  --region $REGION \
  --table-name PoolMemberships \
  --attribute-definitions \
    AttributeName=poolId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=poolId,KeyType=HASH \
    AttributeName=userId,KeyType=RANGE \
  --global-secondary-indexes \
    IndexName=user-index,KeySchema=[{AttributeName=userId,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "PoolMemberships table already exists"

echo -e "${GREEN}✓ PoolMemberships table ready${NC}"

# Matches table
aws dynamodb create-table \
  --endpoint-url $DYNAMODB_ENDPOINT \
  --region $REGION \
  --table-name Matches \
  --attribute-definitions \
    AttributeName=poolId,AttributeType=S \
    AttributeName=matchId,AttributeType=S \
    AttributeName=status,AttributeType=S \
    AttributeName=scheduledAt,AttributeType=N \
  --key-schema \
    AttributeName=poolId,KeyType=HASH \
    AttributeName=matchId,KeyType=RANGE \
  --global-secondary-indexes \
    IndexName=status-index,KeySchema=[{AttributeName=status,KeyType=HASH},{AttributeName=scheduledAt,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
    IndexName=pool-scheduled-index,KeySchema=[{AttributeName=poolId,KeyType=HASH},{AttributeName=scheduledAt,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "Matches table already exists"

echo -e "${GREEN}✓ Matches table ready${NC}"

# Teams table
aws dynamodb create-table \
  --endpoint-url $DYNAMODB_ENDPOINT \
  --region $REGION \
  --table-name Teams \
  --attribute-definitions \
    AttributeName=poolId,AttributeType=S \
    AttributeName=teamId,AttributeType=S \
  --key-schema \
    AttributeName=poolId,KeyType=HASH \
    AttributeName=teamId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "Teams table already exists"

echo -e "${GREEN}✓ Teams table ready${NC}"

# Players table
aws dynamodb create-table \
  --endpoint-url $DYNAMODB_ENDPOINT \
  --region $REGION \
  --table-name Players \
  --attribute-definitions \
    AttributeName=poolId,AttributeType=S \
    AttributeName=playerId,AttributeType=S \
  --key-schema \
    AttributeName=poolId,KeyType=HASH \
    AttributeName=playerId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "Players table already exists"

echo -e "${GREEN}✓ Players table ready${NC}"

# Predictions table
aws dynamodb create-table \
  --endpoint-url $DYNAMODB_ENDPOINT \
  --region $REGION \
  --table-name Predictions \
  --attribute-definitions \
    AttributeName=poolId,AttributeType=S \
    AttributeName=userIdMatchId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
    AttributeName=matchId,AttributeType=S \
  --key-schema \
    AttributeName=poolId,KeyType=HASH \
    AttributeName=userIdMatchId,KeyType=RANGE \
  --global-secondary-indexes \
    IndexName=user-index,KeySchema=[{AttributeName=userId,KeyType=HASH},{AttributeName=matchId,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "Predictions table already exists"

echo -e "${GREEN}✓ Predictions table ready${NC}"

# PlayerSelections table
aws dynamodb create-table \
  --endpoint-url $DYNAMODB_ENDPOINT \
  --region $REGION \
  --table-name PlayerSelections \
  --attribute-definitions \
    AttributeName=poolId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=poolId,KeyType=HASH \
    AttributeName=userId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "PlayerSelections table already exists"

echo -e "${GREEN}✓ PlayerSelections table ready${NC}"

# Scores table
aws dynamodb create-table \
  --endpoint-url $DYNAMODB_ENDPOINT \
  --region $REGION \
  --table-name Scores \
  --attribute-definitions \
    AttributeName=poolId,AttributeType=S \
    AttributeName=userIdMatchId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=poolId,KeyType=HASH \
    AttributeName=userIdMatchId,KeyType=RANGE \
  --global-secondary-indexes \
    IndexName=user-index,KeySchema=[{AttributeName=userId,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "Scores table already exists"

echo -e "${GREEN}✓ Scores table ready${NC}"

# TotalScores table
aws dynamodb create-table \
  --endpoint-url $DYNAMODB_ENDPOINT \
  --region $REGION \
  --table-name TotalScores \
  --attribute-definitions \
    AttributeName=poolId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
    AttributeName=totalPoints,AttributeType=N \
  --key-schema \
    AttributeName=poolId,KeyType=HASH \
    AttributeName=userId,KeyType=RANGE \
  --global-secondary-indexes \
    IndexName=points-index,KeySchema=[{AttributeName=poolId,KeyType=HASH},{AttributeName=totalPoints,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "TotalScores table already exists"

echo -e "${GREEN}✓ TotalScores table ready${NC}"

# Leaderboards table
aws dynamodb create-table \
  --endpoint-url $DYNAMODB_ENDPOINT \
  --region $REGION \
  --table-name Leaderboards \
  --attribute-definitions \
    AttributeName=poolId,AttributeType=S \
    AttributeName=rank,AttributeType=N \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=poolId,KeyType=HASH \
    AttributeName=rank,KeyType=RANGE \
  --global-secondary-indexes \
    IndexName=user-index,KeySchema=[{AttributeName=userId,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "Leaderboards table already exists"

echo -e "${GREEN}✓ Leaderboards table ready${NC}"

# Notifications table
aws dynamodb create-table \
  --endpoint-url $DYNAMODB_ENDPOINT \
  --region $REGION \
  --table-name Notifications \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=notificationId,AttributeType=S \
    AttributeName=sentAt,AttributeType=N \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=notificationId,KeyType=RANGE \
  --global-secondary-indexes \
    IndexName=unread-index,KeySchema=[{AttributeName=userId,KeyType=HASH},{AttributeName=sentAt,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "Notifications table already exists"

echo -e "${GREEN}✓ Notifications table ready${NC}"

# NotificationPreferences table
aws dynamodb create-table \
  --endpoint-url $DYNAMODB_ENDPOINT \
  --region $REGION \
  --table-name NotificationPreferences \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "NotificationPreferences table already exists"

echo -e "${GREEN}✓ NotificationPreferences table ready${NC}"

# UserPreferences table
aws dynamodb create-table \
  --endpoint-url $DYNAMODB_ENDPOINT \
  --region $REGION \
  --table-name UserPreferences \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "UserPreferences table already exists"

echo -e "${GREEN}✓ UserPreferences table ready${NC}"

echo -e "${GREEN}All tables initialized successfully!${NC}"
