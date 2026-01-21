# Football Pool Management System

A real-time football pool management platform built with microservices architecture.

## 🏗️ Architecture

- **Frontend**: Next.js (React, TypeScript)
- **Backend**: NestJS microservices (TypeScript)
- **Message Broker**: Apache Kafka (MSK)
- **Database**: DynamoDB
- **Cache**: Redis (ElastiCache)
- **Infrastructure**: AWS (ECS Fargate, ALB, CloudFront)

See [FINAL_ARCHITECTURE.md](./FINAL_ARCHITECTURE.md) for complete architecture details.

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+
- pnpm 8+

### Setup

1. **Clone and install dependencies**:
   ```bash
   pnpm install
   ```

2. **Copy environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Start infrastructure services**:
   ```bash
   docker-compose up -d zookeeper kafka redis dynamodb-local
   ```

4. **Setup Kafka topics**:
   ```bash
   make setup-kafka
   # Or: ./scripts/setup-kafka-topics.sh
   ```

5. **Initialize DynamoDB tables**:
   ```bash
   make init-dynamodb
   # Or: ./scripts/init-dynamodb-local.sh
   ```

6. **Start all services**:
   ```bash
   docker-compose up -d
   # Or: make up
   ```

7. **Check health**:
   ```bash
   make health
   # Or: ./scripts/health-check.sh
   ```

### Development

- **View logs**: `make logs` or `docker-compose logs -f <service-name>`
- **Rebuild service**: `make rebuild SERVICE=<service-name>`
- **Run tests**: `pnpm test` (in service directory) or `make test`
- **Stop services**: `make down` or `docker-compose down`

## 📁 Project Structure

```
football-pool/
├── apps/
│   ├── web/          # Next.js web application
│   └── mobile/       # React Native mobile app
├── services/         # NestJS microservices
│   ├── auth-service/
│   ├── user-service/
│   ├── pool-service/
│   ├── match-service/
│   ├── prediction-service/
│   ├── scoring-service/
│   ├── leaderboard-service/
│   ├── notification-service/
│   └── websocket-service/
├── packages/         # Shared packages
│   ├── shared/       # Shared types, utilities
│   ├── ui/           # Shared UI components
│   └── config/       # Shared configurations
└── infrastructure/   # Infrastructure as code
    ├── terraform/
    └── nginx/
```

## 🔧 Available Commands

- `make up` - Start all services
- `make down` - Stop all services
- `make logs` - View logs
- `make build` - Build all services
- `make setup-kafka` - Create Kafka topics
- `make init-dynamodb` - Initialize DynamoDB tables
- `make health` - Check service health
- `make clean` - Clean containers and volumes

## 📚 Documentation

- [Architecture Plan](./FINAL_ARCHITECTURE.md) - Complete architecture documentation
- [API Documentation](./docs/api.md) - API endpoints (to be created)
- [Development Guide](./docs/development.md) - Development guidelines (to be created)

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests for specific service
cd services/auth-service && pnpm test
```

## 📝 License

Private - All rights reserved
