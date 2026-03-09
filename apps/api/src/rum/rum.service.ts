import { Injectable, Logger } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

interface RUMEvent {
  type: 'performance' | 'error' | 'interaction' | 'navigation' | 'frustration';
  name: string;
  value?: number;
  metadata?: Record<string, any>;
  timestamp: number;
  url: string;
  userAgent: string;
  userId?: string;
  sessionId?: string;
  navigationPath?: string[];
}

@Injectable()
export class RUMService {
  private readonly logger = new Logger(RUMService.name);

  // Prometheus metrics for RUM
  private readonly performanceHistogram: Histogram<string>;
  private readonly errorCounter: Counter<string>;
  private readonly interactionCounter: Counter<string>;
  private readonly navigationCounter: Counter<string>;
  private readonly frustrationCounter: Counter<string>;
  private readonly navigationPathGauge: Gauge<string>;

  constructor(private readonly registry: Registry) {

    // Create Prometheus metrics for RUM data
    this.performanceHistogram = new Histogram({
      registers: [registry],
      name: 'rum_performance_seconds',
      help: 'RUM performance metrics in seconds',
      labelNames: ['metric_name', 'page'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    });

    this.errorCounter = new Counter({
      registers: [registry],
      name: 'rum_errors_total',
      help: 'Total number of RUM errors',
      labelNames: ['error_type', 'page'],
    });

    this.interactionCounter = new Counter({
      registers: [registry],
      name: 'rum_interactions_total',
      help: 'Total number of user interactions',
      labelNames: ['interaction_type', 'page'],
    });

    this.navigationCounter = new Counter({
      registers: [registry],
      name: 'rum_navigations_total',
      help: 'Total number of page navigations',
      labelNames: ['navigation_type', 'page'],
    });

    this.frustrationCounter = new Counter({
      registers: [registry],
      name: 'rum_frustrations_total',
      help: 'Total number of user frustration events',
      labelNames: ['frustration_type', 'page'],
    });

    this.navigationPathGauge = new Gauge({
      registers: [registry],
      name: 'rum_navigation_path_length',
      help: 'Length of user navigation path in session',
      labelNames: ['session_id', 'user_id'],
    });
  }

  async processEvents(events: RUMEvent[]) {
    for (const event of events) {
      try {
        const page = this.extractPageFromUrl(event.url);

        switch (event.type) {
          case 'performance':
            if (event.value !== undefined) {
              // Convert milliseconds to seconds for Prometheus
              this.performanceHistogram.observe(
                { metric_name: event.name, page },
                event.value / 1000
              );
              this.logger.debug(`Performance: ${event.name} = ${event.value}ms on ${page}`);
            }
            break;

          case 'error':
            this.errorCounter.inc({
              error_type: event.name,
              page,
            });
            this.logger.warn(`RUM Error: ${event.name} on ${page}`, event.metadata);
            break;

          case 'interaction':
            this.interactionCounter.inc({
              interaction_type: event.name,
              page,
            });
            this.logger.debug(`Interaction: ${event.name} on ${page}`);
            break;

          case 'navigation':
            this.navigationCounter.inc({
              navigation_type: event.name,
              page,
            });
            // Track navigation path length
            if (event.navigationPath && event.sessionId) {
              this.navigationPathGauge.set(
                { session_id: event.sessionId, user_id: event.userId || 'anonymous' },
                event.navigationPath.length
              );
            }
            this.logger.debug(`Navigation: ${event.name} to ${page}`, {
              path: event.navigationPath,
              depth: event.metadata?.navigationDepth,
            });
            break;

          case 'frustration':
            this.frustrationCounter.inc({
              frustration_type: event.name.toLowerCase().replace(/\s+/g, '_'),
              page,
            });
            this.logger.warn(`RUM Frustration: ${event.name} on ${page}`, event.metadata);
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to process RUM event: ${error.message}`, error.stack);
      }
    }
  }

  private extractPageFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname || '/';
    } catch {
      return '/';
    }
  }
}
