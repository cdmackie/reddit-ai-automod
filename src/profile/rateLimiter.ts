/**
 * Rate Limiter for Reddit API calls
 *
 * This class enforces rate limits on Reddit API requests to prevent hitting
 * Reddit's API rate limits (typically 60 requests per minute). It tracks
 * requests within a sliding window and automatically waits when the limit
 * is reached.
 *
 * The rate limiter also provides retry logic with exponential backoff for
 * handling rate limit errors from the Reddit API.
 *
 * **Usage**:
 * ```typescript
 * const rateLimiter = new RateLimiter();
 *
 * // Wrap API calls with retry logic
 * const user = await rateLimiter.withRetry(async () => {
 *   return await reddit.getUserById(userId);
 * });
 * ```
 *
 * **Singleton Pattern**:
 * This class should be instantiated once and shared across all profile
 * fetchers and history analyzers to ensure rate limiting works correctly
 * across the entire application.
 */
export class RateLimiter {
  /** Number of requests made in the current window */
  private requestCount: number = 0;

  /** Timestamp when the current window started (milliseconds) */
  private windowStart: number = Date.now();

  /** Maximum number of requests allowed per minute */
  private readonly maxRequests: number = 60;

  /** Duration of the rate limit window in milliseconds (1 minute) */
  private readonly windowMs: number = 60000;

  /**
   * Check if we're within rate limits, and wait if necessary
   *
   * This method:
   * 1. Checks if the current window has expired, resets counter if so
   * 2. If we've hit the rate limit, waits until the window resets
   * 3. Increments the request counter
   *
   * Call this before making any Reddit API request.
   *
   * @returns Promise that resolves when it's safe to make a request
   */
  async checkLimit(): Promise<void> {
    const now = Date.now();

    // Reset counter if window has passed
    if (now - this.windowStart >= this.windowMs) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // If at limit, wait until window resets
    if (this.requestCount >= this.maxRequests) {
      const waitMs = this.windowMs - (now - this.windowStart);
      console.warn(`[RateLimiter] Rate limit reached, waiting ${waitMs}ms`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      this.requestCount = 0;
      this.windowStart = Date.now();
    }

    this.requestCount++;
  }

  /**
   * Execute a function with automatic retry logic and rate limiting
   *
   * This method:
   * 1. Checks rate limits before each attempt
   * 2. Executes the provided function
   * 3. If a rate limit error occurs, retries with exponential backoff
   * 4. Other errors are thrown immediately without retry
   *
   * **Exponential backoff**: 1s, 2s, 4s, 8s, etc.
   *
   * @template T - The return type of the function
   * @param fn - Async function to execute (typically a Reddit API call)
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @returns Promise resolving to the function's return value
   * @throws The last error if all retries are exhausted, or immediately if not a rate limit error
   *
   * @example
   * ```typescript
   * const user = await rateLimiter.withRetry(
   *   async () => await reddit.getUserById(userId),
   *   3 // max 3 retries
   * );
   * ```
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.checkLimit();
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if it's a rate limit error
        if (error instanceof Error && error.message.includes('rate limit')) {
          const backoffMs = Math.pow(2, i) * 1000; // exponential backoff: 1s, 2s, 4s, 8s...
          console.warn(`[RateLimiter] Retry ${i + 1}/${maxRetries} after ${backoffMs}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          // Not a rate limit error, don't retry - throw immediately
          throw error;
        }
      }
    }

    // All retries exhausted, throw the last error
    throw lastError || new Error('Max retries exceeded');
  }
}
