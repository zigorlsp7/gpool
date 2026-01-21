#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

KAFKA_BROKER="localhost:9092"

echo -e "${YELLOW}Setting up Kafka topics...${NC}"

# Function to create topic if it doesn't exist
create_topic() {
    local topic=$1
    local partitions=$2
    
    echo -e "${YELLOW}Creating topic: $topic${NC}"
    docker-compose exec -T kafka kafka-topics \
        --create \
        --topic $topic \
        --bootstrap-server $KAFKA_BROKER \
        --partitions $partitions \
        --replication-factor 1 \
        --if-not-exists || echo "Topic $topic already exists or error occurred"
    
    echo -e "${GREEN}✓ Topic $topic ready${NC}"
}

# Create topics
create_topic "user-events" 3
create_topic "pool-events" 3
create_topic "match-events" 6
create_topic "prediction-events" 6
create_topic "scoring-events" 6
create_topic "leaderboard-events" 3
create_topic "notification-events" 3

echo -e "${GREEN}All Kafka topics created successfully!${NC}"

# List all topics
echo -e "${YELLOW}Listing all topics:${NC}"
docker-compose exec -T kafka kafka-topics --list --bootstrap-server $KAFKA_BROKER
