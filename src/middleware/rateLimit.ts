interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Simple in-memory rate limiter (for production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

/**
 * Rate limiting middleware
 * @param maxRequests Maximum requests per window
 * @param windowMs Time window in milliseconds
 */
export function createRateLimitMiddleware(maxRequests: number, windowMs: number) {
  return (request: any, reply: any, done: () => void) => {
    const userId = request.userId || request.ip;
    const key = `ratelimit:${userId}`;
    const now = Date.now();

    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      done();
      return;
    }

    if (entry.count >= maxRequests) {
      reply.status(429).send({
        success: false,
        error: `Too many requests. Try again in ${Math.ceil((entry.resetTime - now) / 1000)} seconds.`,
      });
      return;
    }

    entry.count++;
    done();
  };
}

/**
 * Rate limit middleware for deposit confirmation (5 requests per 5 minutes)
 */
export const depositConfirmRateLimit = createRateLimitMiddleware(5, 5 * 60 * 1000);
