/**
 * AI Automod - AI Automod for Reddit
 * Copyright (C) 2025 CoinsTax LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Circuit Breaker Pattern Implementation for AI Providers
 *
 * Prevents cascading failures by temporarily blocking calls to failed AI providers.
 * Implements a state machine with three states: CLOSED → OPEN → HALF_OPEN → CLOSED.
 *
 * State Transitions:
 * - CLOSED (normal): All requests pass through
 * - OPEN (failing): Block all requests immediately (fast-fail)
 * - HALF_OPEN (testing): Allow limited requests to test recovery
 *
 * Circuit opens after 5 consecutive failures, waits 30s, then tests recovery.
 * Closes after 2 consecutive successes in HALF_OPEN state.
 *
 * @module ai/circuitBreaker
 *
 * @example
 * ```typescript
 * const circuitBreaker = CircuitBreaker.getInstance(context);
 *
 * try {
 *   const result = await circuitBreaker.execute('claude', async () => {
 *     return await claudeClient.analyze(request);
 *   });
 *   // Use result
 * } catch (error) {
 *   if (error instanceof AIError && error.type === AIErrorType.CIRCUIT_OPEN) {
 *     // Circuit is open, try fallback provider
 *     console.log('Claude circuit is open, falling back to OpenAI');
 *   }
 *   throw error;
 * }
 * ```
 */

import { Devvit } from '@devvit/public-api';
import {
  AIProviderType,
  CircuitBreakerState,
  CircuitBreakerConfig,
  AIErrorType,
  AIError,
} from '../types/ai.js';

/**
 * Circuit breaker configuration
 * Controls when circuits open/close and timeout values
 */
const CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5, // Open circuit after 5 consecutive failures
  halfOpenRetryDelay: 30000, // Wait 30s before testing recovery (HALF_OPEN)
  successThreshold: 2, // Close circuit after 2 consecutive successes in HALF_OPEN
  timeout: 10000, // Consider request failed after 10s
};

/**
 * Circuit Breaker implementation for AI provider fault tolerance
 *
 * Tracks provider health and automatically blocks requests to failing providers,
 * allowing them time to recover. Implements the Circuit Breaker pattern with
 * Redis-backed state persistence.
 *
 * Key features:
 * - Automatic failure detection and recovery
 * - Configurable failure thresholds and retry delays
 * - Request timeout handling
 * - Per-provider circuit isolation
 * - Thread-safe state transitions
 */
export class CircuitBreaker {
  /**
   * Private constructor - use getInstance() instead
   * @param redis - Devvit Redis client for state persistence
   */
  private constructor(private redis: Devvit.Context['redis']) {}

  /**
   * Singleton instances keyed by Redis client
   * Ensures one CircuitBreaker per Devvit context
   */
  private static instances = new Map<any, CircuitBreaker>();

  /**
   * Get or create CircuitBreaker instance for this context
   *
   * @param context - Devvit context containing Redis client
   * @returns Singleton CircuitBreaker instance
   *
   * @example
   * ```typescript
   * const breaker = CircuitBreaker.getInstance(context);
   * ```
   */
  static getInstance(context: Devvit.Context): CircuitBreaker {
    const redis = context.redis;

    if (!this.instances.has(redis)) {
      this.instances.set(redis, new CircuitBreaker(redis));
    }

    return this.instances.get(redis)!;
  }

  /**
   * Execute an operation through the circuit breaker
   *
   * Checks circuit state before executing. If circuit is OPEN, rejects immediately.
   * If OPEN timeout has expired, transitions to HALF_OPEN for testing.
   * Tracks success/failure and updates circuit state accordingly.
   *
   * @template T - Return type of the operation
   * @param provider - AI provider type (claude, openai, deepseek)
   * @param operation - Async operation to execute
   * @returns Promise resolving to operation result
   * @throws {AIError} CIRCUIT_OPEN if circuit is open and cooldown not expired
   * @throws {AIError} TIMEOUT if operation exceeds timeout
   * @throws {Error} Any error thrown by the operation
   *
   * @example
   * ```typescript
   * const result = await circuitBreaker.execute('claude', async () => {
   *   return await fetch('https://api.anthropic.com/analyze', {
   *     method: 'POST',
   *     body: JSON.stringify(request)
   *   });
   * });
   * ```
   */
  async execute<T>(
    provider: AIProviderType,
    operation: () => Promise<T>
  ): Promise<T> {
    // Check current circuit state
    const state = await this.getState(provider);

    // Handle OPEN circuit
    if (state.state === 'OPEN') {
      const now = Date.now();

      // Check if cooldown period has expired
      if (state.openUntil && now >= state.openUntil) {
        // Transition to HALF_OPEN to test recovery
        await this.transitionToHalfOpen(provider);
        console.log(
          `[CircuitBreaker] ${provider} - Transitioned OPEN → HALF_OPEN (cooldown expired)`
        );
      } else {
        // Circuit still open, reject immediately
        const remainingMs = state.openUntil ? state.openUntil - now : 0;
        throw new AIError(
          AIErrorType.CIRCUIT_OPEN,
          `Circuit breaker is OPEN for provider ${provider}. Retry in ${Math.ceil(remainingMs / 1000)}s`,
          provider
        );
      }
    }

    // Execute operation with timeout
    try {
      const result = await this.executeWithTimeout(operation);
      await this.recordSuccess(provider);
      return result;
    } catch (error) {
      await this.recordFailure(provider);
      throw error;
    }
  }

  /**
   * Execute operation with configurable timeout
   *
   * @template T - Return type of the operation
   * @param operation - Async operation to execute
   * @returns Promise resolving to operation result
   * @throws {AIError} TIMEOUT if operation exceeds configured timeout
   * @private
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new AIError(
            AIErrorType.TIMEOUT,
            `Operation exceeded timeout of ${CIRCUIT_BREAKER_CONFIG.timeout}ms`
          )
        );
      }, CIRCUIT_BREAKER_CONFIG.timeout);
    });

    return Promise.race([operation(), timeoutPromise]);
  }

  /**
   * Get current circuit breaker state for a provider
   *
   * Retrieves state from Redis. If not initialized, returns default CLOSED state.
   *
   * @param provider - AI provider type
   * @returns Current circuit breaker state
   *
   * @example
   * ```typescript
   * const state = await circuitBreaker.getState('claude');
   * console.log(`Claude circuit is ${state.state}`);
   * console.log(`Failure count: ${state.failureCount}`);
   * ```
   */
  async getState(provider: AIProviderType): Promise<CircuitBreakerState> {
    const [stateStr, failuresStr, successesStr, openUntilStr] =
      await Promise.all([
        this.redis.get(`circuit:${provider}:state`),
        this.redis.get(`circuit:${provider}:failures`),
        this.redis.get(`circuit:${provider}:successes`),
        this.redis.get(`circuit:${provider}:openUntil`),
      ]);

    // Default to CLOSED if not initialized
    const state = (stateStr as 'CLOSED' | 'OPEN' | 'HALF_OPEN') || 'CLOSED';
    const failureCount = failuresStr ? parseInt(failuresStr, 10) : 0;
    const successCount = successesStr ? parseInt(successesStr, 10) : 0;
    const openUntil = openUntilStr ? parseInt(openUntilStr, 10) : undefined;

    return {
      provider,
      state,
      failureCount,
      lastFailureTime: openUntil ? openUntil - CIRCUIT_BREAKER_CONFIG.halfOpenRetryDelay : 0,
      openUntil,
      successCount,
    };
  }

  /**
   * Manually reset circuit to CLOSED state
   *
   * Clears all failure counters and reopens the circuit.
   * Useful for manual recovery or testing.
   *
   * @param provider - AI provider type
   *
   * @example
   * ```typescript
   * // Manually reset circuit after fixing provider issue
   * await circuitBreaker.reset('claude');
   * console.log('Claude circuit manually reset');
   * ```
   */
  async reset(provider: AIProviderType): Promise<void> {
    await Promise.all([
      this.redis.set(`circuit:${provider}:state`, 'CLOSED'),
      this.redis.del(`circuit:${provider}:failures`),
      this.redis.del(`circuit:${provider}:successes`),
      this.redis.del(`circuit:${provider}:openUntil`),
    ]);

    console.log(`[CircuitBreaker] ${provider} - Manually reset to CLOSED`);
  }

  /**
   * Record successful operation execution
   *
   * Resets failure count and handles HALF_OPEN → CLOSED transition
   * when success threshold is met.
   *
   * @param provider - AI provider type
   * @private
   */
  private async recordSuccess(provider: AIProviderType): Promise<void> {
    const state = await this.getState(provider);

    // Reset failure count on any success
    await this.redis.set(`circuit:${provider}:failures`, '0');

    if (state.state === 'HALF_OPEN') {
      // Increment success count in HALF_OPEN
      const newSuccessCount = state.successCount + 1;
      await this.redis.set(
        `circuit:${provider}:successes`,
        newSuccessCount.toString()
      );

      console.log(
        `[CircuitBreaker] ${provider} - Success in HALF_OPEN (${newSuccessCount}/${CIRCUIT_BREAKER_CONFIG.successThreshold})`
      );

      // Transition to CLOSED if threshold met
      if (newSuccessCount >= CIRCUIT_BREAKER_CONFIG.successThreshold) {
        await this.transitionToClosed(provider);
        console.log(
          `[CircuitBreaker] ${provider} - Transitioned HALF_OPEN → CLOSED (${newSuccessCount} successes)`
        );
      }
    }
  }

  /**
   * Record failed operation execution
   *
   * Increments failure count and handles state transitions:
   * - CLOSED → OPEN when failure threshold exceeded
   * - HALF_OPEN → OPEN immediately on any failure
   *
   * @param provider - AI provider type
   * @private
   */
  private async recordFailure(provider: AIProviderType): Promise<void> {
    const state = await this.getState(provider);

    if (state.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN immediately reopens circuit
      await this.transitionToOpen(provider);
      console.log(
        `[CircuitBreaker] ${provider} - Transitioned HALF_OPEN → OPEN (failure during recovery test)`
      );
      return;
    }

    // Increment failure count
    const newFailureCount = state.failureCount + 1;
    await this.redis.set(
      `circuit:${provider}:failures`,
      newFailureCount.toString()
    );

    console.log(
      `[CircuitBreaker] ${provider} - Failure recorded (${newFailureCount}/${CIRCUIT_BREAKER_CONFIG.failureThreshold})`
    );

    // Open circuit if threshold exceeded
    if (newFailureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      await this.transitionToOpen(provider);
      console.log(
        `[CircuitBreaker] ${provider} - Transitioned CLOSED → OPEN (${newFailureCount} failures)`
      );
    }
  }

  /**
   * Transition circuit to HALF_OPEN state
   *
   * Resets success counter and prepares for recovery testing.
   * Called automatically when OPEN cooldown expires.
   *
   * @param provider - AI provider type
   * @private
   */
  private async transitionToHalfOpen(provider: AIProviderType): Promise<void> {
    await Promise.all([
      this.redis.set(`circuit:${provider}:state`, 'HALF_OPEN'),
      this.redis.set(`circuit:${provider}:successes`, '0'),
    ]);
  }

  /**
   * Transition circuit to OPEN state
   *
   * Sets cooldown period and resets counters.
   * Blocks all requests until cooldown expires.
   *
   * @param provider - AI provider type
   * @private
   */
  private async transitionToOpen(provider: AIProviderType): Promise<void> {
    const openUntil = Date.now() + CIRCUIT_BREAKER_CONFIG.halfOpenRetryDelay;

    await Promise.all([
      this.redis.set(`circuit:${provider}:state`, 'OPEN'),
      this.redis.set(`circuit:${provider}:failures`, '0'),
      this.redis.set(`circuit:${provider}:openUntil`, openUntil.toString()),
    ]);
  }

  /**
   * Transition circuit to CLOSED state
   *
   * Resets all counters and resumes normal operation.
   * Called after successful recovery in HALF_OPEN state.
   *
   * @param provider - AI provider type
   * @private
   */
  private async transitionToClosed(provider: AIProviderType): Promise<void> {
    await Promise.all([
      this.redis.set(`circuit:${provider}:state`, 'CLOSED'),
      this.redis.set(`circuit:${provider}:failures`, '0'),
      this.redis.set(`circuit:${provider}:successes`, '0'),
      this.redis.del(`circuit:${provider}:openUntil`),
    ]);
  }
}
