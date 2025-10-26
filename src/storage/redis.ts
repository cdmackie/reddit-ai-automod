/**
 * Redis storage abstraction layer
 *
 * Provides type-safe access to Devvit's built-in Redis storage
 */

import { RedisClient } from '@devvit/public-api';
import { StorageKey, buildKey } from '../types/storage';

/**
 * Redis storage wrapper with helper methods
 */
export class RedisStorage {
  constructor(private redis: RedisClient) {}

  /**
   * Store a value with optional expiration
   */
  async set(
    key: string,
    value: unknown,
    expirationMs?: number
  ): Promise<void> {
    const serialized = JSON.stringify(value);
    if (expirationMs) {
      await this.redis.set(key, serialized, { expiration: new Date(Date.now() + expirationMs) });
    } else {
      await this.redis.set(key, serialized);
    }
  }

  /**
   * Retrieve a value by key
   */
  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const value = await this.redis.get(key);
    return value !== null;
  }

  /**
   * Increment a counter
   */
  async increment(key: string, amount = 1): Promise<number> {
    return await this.redis.incrBy(key, amount);
  }

  /**
   * Get all keys matching a pattern
   * Note: Devvit Redis doesn't support SCAN, so we track keys separately
   */
  async keys(_pattern: string): Promise<string[]> {
    // TODO: Implement key tracking in Phase 2
    return [];
  }

  /**
   * Build a storage key using the standard pattern
   */
  buildKey(type: StorageKey, ...parts: string[]): string {
    return buildKey(type, ...parts);
  }
}
