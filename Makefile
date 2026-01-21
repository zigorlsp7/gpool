.PHONY: up down logs build rebuild clean test setup-kafka init-dynamodb health

# Start all services
up:
	docker-compose up -d

# Stop all services
down:
	docker-compose down

# View logs
logs:
	docker-compose logs -f

# Build all services
build:
	docker-compose build

# Rebuild specific service
rebuild:
	docker-compose build $(SERVICE)
	docker-compose up -d $(SERVICE)

# Clean everything (containers, volumes, images)
clean:
	docker-compose down -v
	docker system prune -f

# Run tests
test:
	@echo "Running tests..."
	pnpm test

# Setup Kafka topics
setup-kafka:
	./scripts/setup-kafka-topics.sh

# Initialize DynamoDB tables
init-dynamodb:
	./scripts/init-dynamodb-local.sh

# Health check
health:
	./scripts/health-check.sh
