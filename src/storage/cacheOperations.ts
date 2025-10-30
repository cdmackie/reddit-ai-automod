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
  constructor(private redis: RedisClient) {}

  /**
   * Get cached user profile
   */
  async get(userId: string): Promise<any | null> {
    const key = UserKeys.profile(userId);
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
    const key = UserKeys.profile(userId);
    await this.redis.set(key, JSON.stringify(profile), {
      expiration: new Date(Date.now() + ttlMs),
    });
  }

  /**
   * Delete user profile cache
   */
  async delete(userId: string): Promise<void> {
    await this.redis.del(UserKeys.profile(userId));
  }
}

/**
 * User history cache operations
 */
export class HistoryCache {
  constructor(private redis: RedisClient) {}

  /**
   * Get cached user history
   */
  async get(userId: string): Promise<any | null> {
    const key = UserKeys.history(userId);
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
    const key = UserKeys.history(userId);
    await this.redis.set(key, JSON.stringify(history), {
      expiration: new Date(Date.now() + ttlMs),
    });
  }

  /**
   * Delete user history cache
   */
  async delete(userId: string): Promise<void> {
    await this.redis.del(UserKeys.history(userId));
  }
}

/**
 * User trust scores cache operations
 *
 * Stores trust scores for all subreddits in a single dictionary.
 */
export class TrustCache {
  constructor(private redis: RedisClient) {}

  /**
   * Get all trust scores for a user
   * @returns Dictionary of subreddit -> trust data
   */
  async getAll(userId: string): Promise<Record<string, any> | null> {
    const key = UserKeys.trust(userId);
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
    const key = UserKeys.trust(userId);
    const all = (await this.getAll(userId)) || {};
    all[subreddit] = trustData;
    await this.redis.set(key, JSON.stringify(all));
  }

  /**
   * Delete trust score for specific subreddit
   */
  async delete(userId: string, subreddit: string): Promise<void> {
    const key = UserKeys.trust(userId);
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
    await this.redis.del(UserKeys.trust(userId));
  }
}

/**
 * User tracking cache operations
 *
 * Stores tracking data for all subreddits in a single dictionary.
 */
export class TrackingCache {
  constructor(private redis: RedisClient) {}

  /**
   * Get all tracking data for a user
   * @returns Dictionary of subreddit -> tracking data
   */
  async getAll(userId: string): Promise<Record<string, any> | null> {
    const key = UserKeys.tracking(userId);
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
    const key = UserKeys.tracking(userId);
    const all = (await this.getAll(userId)) || {};
    all[subreddit] = trackingData;
    await this.redis.set(key, JSON.stringify(all));
  }

  /**
   * Delete tracking data for specific subreddit
   */
  async delete(userId: string, subreddit: string): Promise<void> {
    const key = UserKeys.tracking(userId);
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
    await this.redis.del(UserKeys.tracking(userId));
  }
}

/**
 * AI questions cache operations
 *
 * Uses tracking set to manage dynamic question hashes.
 */
export class AIQuestionsCache {
  constructor(private redis: RedisClient) {}

  /**
   * Get cached AI question result
   */
  async get(userId: string, hash: string): Promise<any | null> {
    const key = UserKeys.aiQuestion(userId, hash);
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
    const key = UserKeys.aiQuestion(userId, hash);
    const trackingKey = UserKeys.aiQuestionsKeys(userId);

    // Store the result
    await this.redis.set(key, JSON.stringify(result), {
      expiration: new Date(Date.now() + ttlMs),
    });

    // Track this hash in the set
    await this.redis.sAdd(trackingKey, [{ member: hash, score: Date.now() }]);
  }

  /**
   * Delete specific AI question cache
   */
  async delete(userId: string, hash: string): Promise<void> {
    const key = UserKeys.aiQuestion(userId, hash);
    const trackingKey = UserKeys.aiQuestionsKeys(userId);

    await this.redis.del(key);
    await this.redis.sRem(trackingKey, [hash]);
  }

  /**
   * Delete all AI question caches for user
   */
  async deleteAll(userId: string): Promise<number> {
    const trackingKey = UserKeys.aiQuestionsKeys(userId);
    const hashes = await this.redis.sMembers(trackingKey);

    let deleted = 0;
    for (const hashEntry of hashes) {
      const hash = hashEntry.member;
      await this.redis.del(UserKeys.aiQuestion(userId, hash));
      deleted++;
    }

    await this.redis.del(trackingKey);
    return deleted;
  }

  /**
   * Get all tracked hashes for user
   */
  async getTrackedHashes(userId: string): Promise<string[]> {
    const trackingKey = UserKeys.aiQuestionsKeys(userId);
    const hashes = await this.redis.sMembers(trackingKey);
    return hashes.map((h) => h.member);
  }
}

/**
 * Global tracking operations
 *
 * Manages subreddit-level user tracking sets.
 */
export class GlobalTracking {
  constructor(private redis: RedisClient) {}

  /**
   * Add user to subreddit tracking set
   */
  async addUser(subreddit: string, userId: string): Promise<void> {
    const key = GlobalKeys.trackedUsers(subreddit);
    await this.redis.sAdd(key, [{ member: userId, score: Date.now() }]);
  }

  /**
   * Remove user from subreddit tracking set
   */
  async removeUser(subreddit: string, userId: string): Promise<void> {
    const key = GlobalKeys.trackedUsers(subreddit);
    await this.redis.sRem(key, [userId]);
  }

  /**
   * Get all tracked users for subreddit
   */
  async getUsers(subreddit: string): Promise<string[]> {
    const key = GlobalKeys.trackedUsers(subreddit);
    const users = await this.redis.sMembers(key);
    return users.map((u) => u.member);
  }

  /**
   * Clear all tracked users for subreddit
   */
  async clearUsers(subreddit: string): Promise<void> {
    const key = GlobalKeys.trackedUsers(subreddit);
    await this.redis.del(key);
  }
}
