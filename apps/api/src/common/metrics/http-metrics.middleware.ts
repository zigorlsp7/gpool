import type { NextFunction, Request, Response } from 'express';
import * as client from 'prom-client';
import { registry } from './metrics.registry';

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

export function httpMetricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const diffNs = process.hrtime.bigint() - start;
    const seconds = Number(diffNs) / 1e9;

    const route =
      (req.route?.path as string | undefined) ??
      (req.baseUrl ? `${req.baseUrl}${req.path}` : req.path);
    if (!route) {
      return;
    }

    const labels = {
      method: req.method,
      route,
      status: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels, 1);
    httpRequestDuration.observe(labels, seconds);
  });

  next();
}
