import type { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const windowMs = 60 * 1000; // 1 minute
const maxRequestsPerWindow = 120; // 120 requests per minute

const ipMap = new Map<string, RateLimitRecord>();

// Cleanup stale IP records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipMap.entries()) {
    if (now > record.resetAt) {
      ipMap.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  // Allow unbounded requests during automated unit/integration tests
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
  const now = Date.now();

  const record = ipMap.get(ip);

  if (!record || now > record.resetAt) {
    ipMap.set(ip, {
      count: 1,
      resetAt: now + windowMs,
    });
    return next();
  }

  if (record.count >= maxRequestsPerWindow) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please wait a moment before sending more speech or extraction requests.',
      retryAfterSeconds: Math.ceil((record.resetAt - now) / 1000),
    });
    return;
  }

  record.count += 1;
  next();
}

