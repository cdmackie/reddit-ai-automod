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
 * Cache Operations Helper
 *
 * Higher-level cache operations built on top of keyBuilder.
 * Provides type-safe, convenient methods for common cache operations.
 *
 * @module storage/cacheOperations
 */

import { RedisClient } from '@devvit/public-api';
import { UserKeys, GlobalKeys } from './keyBuilder.js';

/**
 * User profile cache operations
 */
export class ProfileCache {
  constructor(private redis: RedisClient, private settingsVersion: string) {}

  /**
   * Get cached user profile
   */
  async get(userId: string): Promise<any | null> {
    const key = UserKeys.profile(userId, this.settingsVersion);
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Set user profile cache
   * @param userId - User ID
   * @param profile - Profile data
   * @param ttlMs - TTL in milliseconds (default: 24 hours)
   */
  async set(userId: string, profile: any, ttlMs = 24 * 60 * 60 * 1000): Promise<void> {
    const key = UserKeys.profile(userId, this.settingsVersion);
    await this.redis.set(key, JSON.stringify(profile), {
      expiration: new Date(Date.now() + ttlMs),
    });
  }

  /**
   * Delete user profile cache
   */
  async delete(userId: string): Promise<void> {
    await this.redis.del(UserKeys.profile(userId, this.settingsVersion));
  }
}

/**
 * User history cache operations
 */
export class HistoryCache {
  constructor(private redis: RedisClient, private settingsVersion: string) {}

  /**
   * Get cached user history
   */
  async get(userId: string): Promise<any | null> {
    const key = UserKeys.history(userId, this.settingsVersion);
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Set user history cache
   * @param userId - User ID
   * @param history - History data
   * @param ttlMs - TTL in milliseconds (default: 24 hours)
   */
  async set(userId: string, history: any, ttlMs = 24 * 60 * 60 * 1000): Promise<void> {
    const key = UserKeys.history(userId, this.settingsVersion);
    await this.redis.set(key, JSON.stringify(history), {
      expiration: new Date(Date.now() + ttlMs),
    });
  }

  /**
   * Delete user history cache
   */
  async delete(userId: string): Promise<void> {
    await this.redis.del(UserKeys.history(userId, this.settingsVersion));
  }
}

/**
 * User trust scores cache operations
 *
 * Stores trust scores for all subreddits in a single dictionary.
 */
export class TrustCache {
  constructor(private redis: RedisClient, private settingsVersion: string) {}

  /**
   * Get all trust scores for a user
   * @returns Dictionary of subreddit -> trust data
   */
  async getAll(userId: string): Promise<Record<string, any> | null> {
    const key = UserKeys.trust(userId, this.settingsVersion);
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Get trust score for specific subreddit
   */
  async get(userId: string, subreddit: string): Promise<any | null> {
    const all = await this.getAll(userId);
    return all?.[subreddit] || null;
  }

  /**
   * Set trust score for specific subreddit
   * @param userId - User ID
   * @param subreddit - Subreddit name
   * @param trustData - Trust score data
   */
  async set(userId: string, subreddit: string, trustData: any): Promise<void> {
    const key = UserKeys.trust(userId, this.settingsVersion);
    const all = (await this.getAll(userId)) || {};
    all[subreddit] = trustData;
    await this.redis.set(key, JSON.stringify(all));
  }

  /**
   * Delete trust score for specific subreddit
   */
  async delete(userId: string, subreddit: string): Promise<void> {
    const key = UserKeys.trust(userId, this.settingsVersion);
    const all = await this.getAll(userId);
    if (all && all[subreddit]) {
      delete all[subreddit];
      if (Object.keys(all).length > 0) {
        await this.redis.set(key, JSON.stringify(all));
      } else {
        // If no subreddits left, delete the key
        await this.redis.del(key);
      }
    }
  }

  /**
   * Delete all trust scores for user
   */
  async deleteAll(userId: string): Promise<void> {
    await this.redis.del(UserKeys.trust(userId, this.settingsVersion));
  }
}

/**
 * User tracking cache operations
 *
 * Stores tracking data for all subreddits in a single dictionary.
 */
export class TrackingCache {
  constructor(private redis: RedisClient, private settingsVersion: string) {}

  /**
   * Get all tracking data for a user
   * @returns Dictionary of subreddit -> tracking data
   */
  async getAll(userId: string): Promise<Record<string, any> | null> {
    const key = UserKeys.tracking(userId, this.settingsVersion);
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Get tracking data for specific subreddit
   */
  async get(userId: string, subreddit: string): Promise<any | null> {
    const all = await this.getAll(userId);
    return all?.[subreddit] || null;
  }

  /**
   * Set tracking data for specific subreddit
   */
  async set(userId: string, subreddit: string, trackingData: any): Promise<void> {
    const key = UserKeys.tracking(userId, this.settingsVersion);
    const all = (await this.getAll(userId)) || {};
    all[subreddit] = trackingData;
    await this.redis.set(key, JSON.stringify(all));
  }

  /**
   * Delete tracking data for specific subreddit
   */
  async delete(userId: string, subreddit: string): Promise<void> {
    const key = UserKeys.tracking(userId, this.settingsVersion);
    const all = await this.getAll(userId);
    if (all && all[subreddit]) {
      delete all[subreddit];
      if (Object.keys(all).length > 0) {
        await this.redis.set(key, JSON.stringify(all));
      } else {
        await this.redis.del(key);
      }
    }
  }

  /**
   * Delete all tracking data for user
   */
  async deleteAll(userId: string): Promise<void> {
    await this.redis.del(UserKeys.tracking(userId, this.settingsVersion));
  }
}

/**
 * AI questions cache operations
 *
 * Uses tracking set to manage dynamic question hashes.
 */
export class AIQuestionsCache {
  constructor(private redis: RedisClient, private settingsVersion: string) {}

  /**
   * Get cached AI question result
   */
  async get(userId: string, hash: string): Promise<any | null> {
    const key = UserKeys.aiQuestion(userId, this.settingsVersion, hash);
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Set AI question result and track the hash
   * @param userId - User ID
   * @param hash - Question hash
   * @param result - AI result data
   * @param ttlMs - TTL in milliseconds
   */
  async set(userId: string, hash: string, result: any, ttlMs: number): Promise<void> {
    const key = UserKeys.aiQuestion(userId, this.settingsVersion, hash);
    const trackingKey = UserKeys.aiQuestionsKeys(userId, this.settingsVersion);

    // Store the result
    await this.redis.set(key, JSON.stringify(result), {
      expiration: new Date(Date.now() + ttlMs),
    });

    // Track this hash in the sorted set (using timestamp as score)
    await this.redis.zAdd(trackingKey, { member: hash, score: Date.now() });
  }

  /**
   * Delete specific AI question cache
   */
  async delete(userId: string, hash: string): Promise<void> {
    const key = UserKeys.aiQuestion(userId, this.settingsVersion, hash);
    const trackingKey = UserKeys.aiQuestionsKeys(userId, this.settingsVersion);

    await this.redis.del(key);
    await this.redis.zRem(trackingKey, [hash]);
  }

  /**
   * Delete all AI question caches for user
   */
  async deleteAll(userId: string): Promise<number> {
    const trackingKey = UserKeys.aiQuestionsKeys(userId, this.settingsVersion);
    // Get all members from sorted set (score range -inf to +inf)
    const hashes = await this.redis.zRange(trackingKey, 0, -1);

    let deleted = 0;
    for (const hashEntry of hashes) {
      const hash = hashEntry.member;
      await this.redis.del(UserKeys.aiQuestion(userId, this.settingsVersion, hash));
      deleted++;
    }

    await this.redis.del(trackingKey);
    return deleted;
  }

  /**
   * Get all tracked hashes for user
   */
  async getTrackedHashes(userId: string): Promise<string[]> {
    const trackingKey = UserKeys.aiQuestionsKeys(userId, this.settingsVersion);
    // Get all members from sorted set
    const hashes = await this.redis.zRange(trackingKey, 0, -1);
    return hashes.map((h) => h.member);
  }
}

/**
 * Global tracking operations
 *
 * Manages subreddit-level user tracking sets.
 */
export class GlobalTracking {
  constructor(private redis: RedisClient, private settingsVersion: string) {}

  /**
   * Add user to subreddit tracking set
   */
  async addUser(subreddit: string, userId: string): Promise<void> {
    const key = GlobalKeys.trackedUsers(subreddit, this.settingsVersion);
    await this.redis.zAdd(key, { member: userId, score: Date.now() });
  }

  /**
   * Remove user from subreddit tracking set
   */
  async removeUser(subreddit: string, userId: string): Promise<void> {
    const key = GlobalKeys.trackedUsers(subreddit, this.settingsVersion);
    await this.redis.zRem(key, [userId]);
  }

  /**
   * Get all tracked users for subreddit
   */
  async getUsers(subreddit: string): Promise<string[]> {
    const key = GlobalKeys.trackedUsers(subreddit, this.settingsVersion);
    // Get all members from sorted set
    const users = await this.redis.zRange(key, 0, -1);
    return users.map((u) => u.member);
  }

  /**
   * Clear all tracked users for subreddit
   */
  async clearUsers(subreddit: string): Promise<void> {
    const key = GlobalKeys.trackedUsers(subreddit, this.settingsVersion);
    await this.redis.del(key);
  }
}
