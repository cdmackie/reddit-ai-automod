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
