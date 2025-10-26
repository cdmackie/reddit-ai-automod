/**
 * Request Coalescer - Prevents duplicate AI analysis calls for the same user
 *
 * This component implements Redis-based request deduplication using SETNX locking.
 * When multiple requests for the same user arrive simultaneously, only one performs
 * the AI analysis while others wait for the cached result.
 *
 * **Key Features**:
 * - SETNX atomic lock acquisition with auto-expiry (30s TTL)
 * - Exponential backoff polling to reduce Redis load
 * - Graceful degradation on Redis errors
 * - Singleton pattern for efficient resource usage
 *
 * **Redis Keys**:
 * - `ai:inflight:{userId}` → InFlightRequest lock (TTL: 30s)
 * - `ai:analysis:{userId}` → AIAnalysisResult cache (read-only, written by analyzer)
 *
 * @module ai/requestCoalescer
 */

import { Devvit } from '@devvit/public-api';
import { InFlightRequest, AIAnalysisResult } from '../types/ai.js';

/**
 * RequestCoalescer class - Manages request deduplication via Redis locks
 *
 * **Usage Example**:
 * ```typescript
 * const coalescer = RequestCoalescer.getInstance(context);
 *
 * // Try to acquire lock
 * if (!await coalescer.acquireLock(userId, correlationId)) {
 *   // Another request is in progress, wait for its result
 *   console.log('Request coalesced, waiting for result');
 *   const result = await coalescer.waitForResult(userId);
 *   if (result) return result;
 * }
 *
 * try {
 *   // Perform analysis
 *   const result = await analyzeUser(...);
 *   return result;
 * } finally {
 *   // Always release lock
 *   await coalescer.releaseLock(userId);
 * }
 * ```
 */
export class RequestCoalescer {
  /** Redis client instance */
  private readonly redis: Devvit.Context['redis'];

  /**
   * Private constructor - use getInstance() instead
   * @param redis - Devvit Redis client
   */
  private constructor(redis: Devvit.Context['redis']) {
    this.redis = redis;
  }

  /** Singleton instances map (one per Redis connection) */
  private static instances = new Map<any, RequestCoalescer>();

  /**
   * Get singleton instance for the given Devvit context
   *
   * @param context - Devvit context containing Redis client
   * @returns RequestCoalescer instance
   *
   * @example
   * ```typescript
   * const coalescer = RequestCoalescer.getInstance(context);
   * ```
   */
  static getInstance(context: Devvit.Context): RequestCoalescer {
    if (!this.instances.has(context.redis)) {
      this.instances.set(context.redis, new RequestCoalescer(context.redis));
    }
    return this.instances.get(context.redis)!;
  }

  /**
   * Attempt to acquire lock for user analysis
   *
   * Uses Redis SETNX (SET if Not eXists) with 30-second TTL to create
   * an atomic lock. If lock is acquired, caller should perform analysis.
   * If lock fails, another request is already analyzing this user.
   *
   * **Auto-Expiry**: Lock automatically expires after 30s to prevent stuck locks
   * if the process crashes or analysis takes too long.
   *
   * @param userId - Reddit user ID (format: t2_xxxxx)
   * @param correlationId - Unique ID for tracking this request
   * @returns true if lock acquired, false if already held by another request
   *
   * @example
   * ```typescript
   * const acquired = await coalescer.acquireLock('t2_abc123', 'req-001');
   * if (acquired) {
   *   // Perform analysis
   * } else {
   *   // Wait for other request's result
   * }
   * ```
   */
  async acquireLock(userId: string, correlationId: string): Promise<boolean> {
    try {
      const key = `ai:inflight:${userId}`;
      const value: InFlightRequest = {
        userId,
        correlationId,
        startTime: Date.now(),
        expiresAt: Date.now() + 30000, // 30s auto-expiry
      };

      // SET with NX option and 30s TTL (atomic operation)
      // Returns "OK" if key was set (lock acquired), null if key already exists
      const result = await this.redis.set(key, JSON.stringify(value), {
        nx: true, // Only set if key doesn't exist (SETNX behavior)
        expiration: new Date(Date.now() + 30000), // 30 seconds from now
      });

      const acquired = result !== null;

      if (acquired) {
        console.log('[RequestCoalescer] Lock acquired', { userId, correlationId });
      } else {
        console.log('[RequestCoalescer] Lock failed (already held)', { userId, correlationId });
      }

      return acquired;
    } catch (error) {
      // On Redis error, fail-safe: allow analysis (return true)
      // This prevents blocking requests if Redis is unavailable
      console.error('[RequestCoalescer] Error acquiring lock, allowing request', {
        userId,
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return true; // Graceful degradation
    }
  }

  /**
   * Release lock after analysis completes
   *
   * Deletes the lock key from Redis. Safe to call even if lock doesn't exist.
   * Should always be called in a finally {} block to ensure cleanup.
   *
   * @param userId - Reddit user ID (format: t2_xxxxx)
   *
   * @example
   * ```typescript
   * try {
   *   const result = await analyzeUser(userId);
   *   return result;
   * } finally {
   *   await coalescer.releaseLock(userId);
   * }
   * ```
   */
  async releaseLock(userId: string): Promise<void> {
    try {
      const key = `ai:inflight:${userId}`;
      await this.redis.del(key);
      console.log('[RequestCoalescer] Lock released', { userId });
    } catch (error) {
      // Log error but don't throw - lock will auto-expire anyway
      console.error('[RequestCoalescer] Error releasing lock (will auto-expire)', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Wait for in-flight request to complete and return cached result
   *
   * Polls Redis for the cached analysis result every 500ms (with exponential backoff).
   * Returns the result once it's available, or null if timeout is reached.
   *
   * **Exponential Backoff**:
   * - Initial delay: 500ms
   * - Growth factor: 1.5x per iteration
   * - Max delay: 1000ms
   *
   * This prevents hammering Redis while still being responsive.
   *
   * @param userId - Reddit user ID (format: t2_xxxxx)
   * @param maxWaitMs - Maximum time to wait in milliseconds (default: 30000 = 30s)
   * @returns AIAnalysisResult if found, null if timeout
   *
   * @example
   * ```typescript
   * const result = await coalescer.waitForResult('t2_abc123', 30000);
   * if (result) {
   *   console.log('Got coalesced result');
   * } else {
   *   console.log('Timeout, proceeding with analysis');
   * }
   * ```
   */
  async waitForResult(userId: string, maxWaitMs: number = 30000): Promise<AIAnalysisResult | null> {
    const startTime = Date.now();
    let delayMs = 500; // Initial delay
    const maxDelayMs = 1000; // Max delay cap
    const backoffMultiplier = 1.5; // Exponential growth factor

    console.log('[RequestCoalescer] Waiting for result', { userId, maxWaitMs });

    try {
      while (Date.now() - startTime < maxWaitMs) {
        // Check if analysis is cached
        const cacheKey = `ai:analysis:${userId}`;
        const cachedData = await this.redis.get(cacheKey);

        if (cachedData) {
          console.log('[RequestCoalescer] Result found in cache', {
            userId,
            waitedMs: Date.now() - startTime,
          });
          return JSON.parse(cachedData) as AIAnalysisResult;
        }

        // Wait with exponential backoff before next check
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        // Increase delay for next iteration (exponential backoff)
        delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
      }

      // Timeout reached
      console.log('[RequestCoalescer] Wait timeout', {
        userId,
        waitedMs: Date.now() - startTime,
      });
      return null;
    } catch (error) {
      // On error, return null (timeout)
      console.error('[RequestCoalescer] Error waiting for result', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get current in-flight request data for debugging/monitoring
   *
   * Returns the InFlightRequest data if a request is currently in progress,
   * or null if no request is active.
   *
   * **Use Cases**:
   * - Debugging stuck locks
   * - Monitoring request duration
   * - Tracking correlationIds
   *
   * @param userId - Reddit user ID (format: t2_xxxxx)
   * @returns InFlightRequest if request is in flight, null otherwise
   *
   * @example
   * ```typescript
   * const inFlight = await coalescer.getInFlightRequest('t2_abc123');
   * if (inFlight) {
   *   console.log('Request duration:', Date.now() - inFlight.startTime);
   *   console.log('Correlation ID:', inFlight.correlationId);
   * }
   * ```
   */
  async getInFlightRequest(userId: string): Promise<InFlightRequest | null> {
    try {
      const key = `ai:inflight:${userId}`;
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      // Parse and validate JSON
      return JSON.parse(data) as InFlightRequest;
    } catch (error) {
      // Invalid JSON or Redis error
      console.error('[RequestCoalescer] Error getting in-flight request', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Clean up corrupted data
      try {
        const key = `ai:inflight:${userId}`;
        await this.redis.del(key);
        console.log('[RequestCoalescer] Cleaned up corrupted lock data', { userId });
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      return null;
    }
  }
}

// Default export for convenience
export default RequestCoalescer;
