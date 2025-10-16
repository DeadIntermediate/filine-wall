import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

export class RateLimiter {
  private store: RateLimitStore = {};
  private options: Required<RateLimitOptions>;

  constructor(options: RateLimitOptions) {
    this.options = {
      windowMs: options.windowMs,
      maxRequests: options.maxRequests,
      message: options.message || 'Too many requests, please try again later.',
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
      keyGenerator: options.keyGenerator || this.defaultKeyGenerator,
    };

    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private defaultKeyGenerator(req: Request): string {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.options.keyGenerator(req);
      const now = Date.now();

      // Initialize or reset if window has passed
      if (!this.store[key] || this.store[key].resetTime < now) {
        this.store[key] = {
          count: 0,
          resetTime: now + this.options.windowMs,
        };
      }

      // Increment request count
      this.store[key].count++;

      // Set headers
      res.set({
        'X-RateLimit-Limit': this.options.maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, this.options.maxRequests - this.store[key].count).toString(),
        'X-RateLimit-Reset': new Date(this.store[key].resetTime).toISOString(),
      });

      // Check if limit exceeded
      if (this.store[key].count > this.options.maxRequests) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: this.options.message,
          retryAfter: Math.ceil((this.store[key].resetTime - now) / 1000),
        });
      }

      next();
    };
  }

  public getStats(key?: string): any {
    if (key) {
      return this.store[key] || null;
    }
    return Object.keys(this.store).map(k => ({
      key: k,
      ...this.store[k]
    }));
  }

  public reset(key?: string): void {
    if (key) {
      delete this.store[key];
    } else {
      this.store = {};
    }
  }
}

// Create common rate limiters
export const createRateLimiter = (options: RateLimitOptions) => {
  return new RateLimiter(options);
};

// Predefined rate limiters
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 login attempts per 15 minutes
  message: 'Too many login attempts, please try again later.',
});

export const apiRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  message: 'Too many API requests, please try again later.',
});

export const strictRateLimit = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
  message: 'Too many requests, please slow down.',
});