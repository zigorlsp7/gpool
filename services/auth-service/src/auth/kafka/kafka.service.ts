import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;

  constructor(private configService: ConfigService) {
    const brokers = this.configService
      .get<string>('KAFKA_BROKERS', 'localhost:9092')
      .split(',');

    this.kafka = new Kafka({
      clientId: 'auth-service',
      brokers,
    });

    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.logger.log('Kafka producer connected');
    } catch (error) {
      this.logger.error(`Failed to connect Kafka producer: ${error.message}`, error.stack);
    }
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect();
      this.logger.log('Kafka producer disconnected');
    } catch (error) {
      this.logger.error(`Error disconnecting Kafka producer: ${error.message}`, error.stack);
    }
  }

  async publishEvent(
    topic: string,
    eventType: string,
    aggregateId: string,
    data: Record<string, any>,
    userId?: string,
  ) {
    const event = {
      eventId: uuidv4(),
      eventType,
      aggregateId,
      timestamp: new Date().toISOString(),
      version: 1,
      data,
      metadata: {
        userId,
        source: 'auth-service',
        correlationId: uuidv4(),
      },
    };

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: aggregateId,
            value: JSON.stringify(event),
          },
        ],
      });

      this.logger.log(`Event published: ${eventType} for ${aggregateId}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish event ${eventType}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async publishUserAuthenticated(userId: string) {
    return this.publishEvent(
      'user-events',
      'UserAuthenticated',
      userId,
      {
        userId,
        timestamp: new Date().toISOString(),
      },
      userId,
    );
  }

  async publishUserLoggedOut(userId: string) {
    return this.publishEvent(
      'user-events',
      'UserLoggedOut',
      userId,
      {
        userId,
        timestamp: new Date().toISOString(),
      },
      userId,
    );
  }
}
