// Common middleware utilities

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Request ID middleware - adds unique ID to each request
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.headers['x-request-id'] = requestId as string;
  res.setHeader('X-Request-Id', requestId as string);
  next();
}

// Correlation ID middleware - tracks requests across services
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const correlationId =
    req.headers['x-correlation-id'] || req.headers['x-request-id'] || uuidv4();
  req.headers['x-correlation-id'] = correlationId as string;
  res.setHeader('X-Correlation-Id', correlationId as string);
  next();
}

// Security headers middleware
export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove server header
  res.removeHeader('X-Powered-By');
  
  next();
}
