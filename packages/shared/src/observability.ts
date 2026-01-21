// Observability utilities and types
export interface LogContext {
  service: string;
  userId?: string;
  requestId?: string;
  correlationId?: string;
  [key: string]: any;
}

export interface MetricLabels {
  service: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  [key: string]: string | number | undefined;
}

// Log levels matching Winston/Pino
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

// Metric types
export interface CounterMetric {
  name: string;
  value: number;
  labels: MetricLabels;
  timestamp?: number;
}

export interface HistogramMetric {
  name: string;
  value: number;
  labels: MetricLabels;
  buckets?: number[];
  timestamp?: number;
}
