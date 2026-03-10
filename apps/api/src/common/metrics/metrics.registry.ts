import * as client from 'prom-client';

export const registry = new client.Registry();

// Keep process/runtime defaults in the same registry as app metrics.
client.collectDefaultMetrics({ register: registry });
