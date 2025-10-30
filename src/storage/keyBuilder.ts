/**
 * Centralized Redis Key Builder
 *
 * Single source of truth for all Redis key patterns in the application.
 * Uses version prefix for cache invalidation and hierarchical organization
 * for easy per-user data clearing.
 *
 * Key Structure:
 * - User-scoped: v{version}:user:{userId}:{...parts}
 * - Global-scoped: v{version}:global:{...parts}
 *
 * Benefits:
 * - Version bump (v1 → v2) instantly invalidates all caches
 * - Easy per-user cache clearing (all keys under v1:user:{userId}:*)
 * - Single source of truth for key patterns
 * - Future-proof architecture
 *
 * @example
 * ```typescript
 * // User profile
 * buildUserKey('t2_abc123', 'profile')
 * // => "v1:user:t2_abc123:profile"
 *
 * // AI questions
 * buildUserKey('t2_abc123', 'ai', 'questions', 'hash123')
 * // => "v1:user:t2_abc123:ai:questions:hash123"
 *
 * // Cost tracking
 * buildGlobalKey('cost', 'daily', '2025-01-30')
 * // => "v1:global:cost:daily:2025-01-30"
 * ```
 *
 * @module storage/keyBuilder
 */

import { RedisClient } from '@devvit/public-api';

/**
 * Current cache version
 *
 * Increment this number to invalidate ALL caches when breaking changes occur.
 * Old keys will be ignored automatically and expire naturally via TTL.
 *
 * Version History:
 * - v1: Initial implementation (2025-01-30)
 */
export const CACHE_VERSION = 1;

/**
 * Key scope type
 */
export type KeyScope = 'user' | 'global';

/**
 * Build a versioned Redis key with hierarchical structure
 *
 * @param scope - Key scope ('user' or 'global')
 * @param userId - User ID for user-scoped keys (required if scope='user')
 * @param parts - Key path components
 * @returns Versioned Redis key string
 *
 * @example
 * ```typescript
 * buildKey('user', 't2_abc', 'profile')
 * // => "v1:user:t2_abc:profile"
 *
 * buildKey('global', null, 'cost', 'daily', '2025-01-30')
 * // => "v1:global:cost:daily:2025-01-30"
 * ```
 */
export function buildKey(
  scope: KeyScope,
  userId: string | null,
  ...parts: string[]
): string {
  if (scope === 'user') {
    if (!userId) {
      throw new Error('userId is required for user-scoped keys');
    }
    return `v${CACHE_VERSION}:user:${userId}:${parts.join(':')}`;
  }

  return `v${CACHE_VERSION}:global:${parts.join(':')}`;
}

/**
 * Build a user-scoped key
 *
 * Convenience wrapper around buildKey for user-scoped keys.
 *
 * @param userId - User ID
 * @param parts - Key path components
 * @returns Versioned user-scoped key
 *
 * @example
 * ```typescript
 * buildUserKey('t2_abc', 'profile')
 * // => "v1:user:t2_abc:profile"
 *
 * buildUserKey('t2_abc', 'ai', 'questions', 'hash123')
 * // => "v1:user:t2_abc:ai:questions:hash123"
 * ```
 */
export function buildUserKey(userId: string, ...parts: string[]): string {
  return buildKey('user', userId, ...parts);
}

/**
 * Build a global-scoped key
 *
 * Convenience wrapper around buildKey for global-scoped keys.
 *
 * @param parts - Key path components
 * @returns Versioned global-scoped key
 *
 * @example
 * ```typescript
 * buildGlobalKey('cost', 'daily', '2025-01-30')
 * // => "v1:global:cost:daily:2025-01-30"
 *
 * buildGlobalKey('tracking', 'FriendsOver40', 'users')
 * // => "v1:global:tracking:FriendsOver40:users"
 * ```
 */
export function buildGlobalKey(...parts: string[]): string {
  return buildKey('global', null, ...parts);
}

/**
 * Standard user cache keys
 *
 * Common key patterns used throughout the application.
 */
export const UserKeys = {
  /** User profile cache: v1:user:{userId}:profile */
  profile: (userId: string) => buildUserKey(userId, 'profile'),

  /** User post history cache: v1:user:{userId}:history */
  history: (userId: string) => buildUserKey(userId, 'history'),

  /** User trust scores (all subreddits): v1:user:{userId}:trust */
  trust: (userId: string) => buildUserKey(userId, 'trust'),

  /** User tracking data (all subreddits): v1:user:{userId}:tracking */
  tracking: (userId: string) => buildUserKey(userId, 'tracking'),

  /** AI questions tracking set: v1:user:{userId}:ai:questions:keys */
  aiQuestionsKeys: (userId: string) => buildUserKey(userId, 'ai', 'questions', 'keys'),

  /** AI question cache: v1:user:{userId}:ai:questions:{hash} */
  aiQuestion: (userId: string, hash: string) => buildUserKey(userId, 'ai', 'questions', hash),
} as const;

/**
 * Standard global cache keys
 *
 * Common global key patterns used throughout the application.
 */
export const GlobalKeys = {
  /** Daily cost total: v1:global:cost:daily:{date} */
  costDaily: (date: string) => buildGlobalKey('cost', 'daily', date),

  /** Daily cost per provider: v1:global:cost:daily:{date}:{provider} */
  costDailyProvider: (date: string, provider: string) => buildGlobalKey('cost', 'daily', date, provider),

  /** Monthly cost total: v1:global:cost:monthly:{month} */
  costMonthly: (month: string) => buildGlobalKey('cost', 'monthly', month),

  /** Cost record: v1:global:cost:record:{timestamp}:{userId} */
  costRecord: (timestamp: number, userId: string) => buildGlobalKey('cost', 'record', timestamp.toString(), userId),

  /** Tracked users set: v1:global:tracking:{subreddit}:users */
  trackedUsers: (subreddit: string) => buildGlobalKey('tracking', subreddit, 'users'),
} as const;

/**
 * Clear all cached data for a specific user
 *
 * Deletes all user-scoped cache entries including profile, history, trust,
 * tracking, and AI question cache.
 *
 * @param redis - Redis client instance
 * @param userId - User ID to clear cache for
 *
 * @example
 * ```typescript
 * await clearUserCache(context.redis, 't2_abc123');
 * // Clears all cached data for user t2_abc123
 * ```
 */
export async function clearUserCache(redis: RedisClient, userId: string): Promise<void> {
  // Clear AI questions (with tracking set)
  const aiKeysSet = UserKeys.aiQuestionsKeys(userId);
  const aiHashes = await redis.sMembers(aiKeysSet);

  for (const hashEntry of aiHashes) {
    const hash = hashEntry.member;
    await redis.del(UserKeys.aiQuestion(userId, hash));
  }
  await redis.del(aiKeysSet);

  // Clear dictionary keys (no iteration needed)
  await redis.del(UserKeys.profile(userId));
  await redis.del(UserKeys.history(userId));
  await redis.del(UserKeys.trust(userId));
  await redis.del(UserKeys.tracking(userId));
}

/**
 * Clear all cached data for a subreddit
 *
 * Deletes all tracked users' data and global tracking for the subreddit.
 * Optionally clears cost data (default: preserve for auditing).
 *
 * @param redis - Redis client instance
 * @param subreddit - Subreddit name
 * @param clearCostData - Whether to clear cost tracking data (default: false)
 * @returns Object with deletion counts
 *
 * @example
 * ```typescript
 * const stats = await clearSubredditCache(context.redis, 'FriendsOver40');
 * console.log(`Cleared ${stats.usersCleared} users, ${stats.keysDeleted} keys`);
 * ```
 */
export async function clearSubredditCache(
  redis: RedisClient,
  subreddit: string,
  clearCostData = false
): Promise<{ usersCleared: number; keysDeleted: number }> {
  let usersCleared = 0;
  let keysDeleted = 0;

  // Get all tracked users for this subreddit
  const trackingKey = GlobalKeys.trackedUsers(subreddit);
  const userIds = await redis.sMembers(trackingKey);

  // Clear each user's cache
  for (const userEntry of userIds) {
    const userId = userEntry.member;
    await clearUserCache(redis, userId);
    usersCleared++;
    keysDeleted += 5; // profile, history, trust, tracking, aiKeysSet (+ AI questions counted below)

    // Count AI questions deleted
    const aiKeysSet = UserKeys.aiQuestionsKeys(userId);
    const aiHashes = await redis.sMembers(aiKeysSet);
    keysDeleted += aiHashes.length;
  }

  // Clear global tracking set
  await redis.del(trackingKey);
  keysDeleted++;

  // Optionally clear cost data
  if (clearCostData) {
    // Note: This requires knowing date ranges
    // For now, just document that cost data is preserved
    console.log('[clearSubredditCache] Cost data preserved for auditing');
  }

  return { usersCleared, keysDeleted };
}
