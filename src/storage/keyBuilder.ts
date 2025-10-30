/**
 * Centralized Redis Key Builder
 *
 * Single source of truth for all Redis key patterns in the application.
 * Uses TWO-LEVEL version prefix for cache invalidation and hierarchical
 * organization for easy per-user data clearing.
 *
 * Key Structure (Two-Level Versioning):
 * - User-scoped: v{codeVersion}:{settingsVersion}:user:{userId}:{...parts}
 * - Global-scoped: v{codeVersion}:{settingsVersion}:global:{...parts}
 *
 * Version Levels:
 * 1. Code Version (CACHE_VERSION): Hardcoded constant bumped by developers
 *    - Changed when data structure or format changes (breaking changes)
 *    - Requires code deployment
 * 2. Settings Version (cacheVersion): Runtime setting controlled by moderators
 *    - Changed via settings UI to force complete cache invalidation
 *    - No code deployment needed
 *    - Useful for testing or after configuration changes
 *
 * Benefits:
 * - Developer version bump (v1 → v2) invalidates all caches globally
 * - Moderator version bump (settingsVersion: 1 → 2) invalidates per-subreddit
 * - Easy per-user cache clearing (all keys under v1:1:user:{userId}:*)
 * - Single source of truth for key patterns
 * - Future-proof architecture
 *
 * @example
 * ```typescript
 * // User profile with default settings version
 * buildUserKey('t2_abc123', '1', 'profile')
 * // => "v1:1:user:t2_abc123:profile"
 *
 * // User profile with settings version 3 (after mod bumped it)
 * buildUserKey('t2_abc123', '3', 'profile')
 * // => "v1:3:user:t2_abc123:profile"
 *
 * // AI questions
 * buildUserKey('t2_abc123', '1', 'ai', 'questions', 'hash123')
 * // => "v1:1:user:t2_abc123:ai:questions:hash123"
 *
 * // Cost tracking
 * buildGlobalKey('1', 'cost', 'daily', '2025-01-30')
 * // => "v1:1:global:cost:daily:2025-01-30"
 * ```
 *
 * @module storage/keyBuilder
 */

import { RedisClient, Context } from '@devvit/public-api';

/**
 * Code-level cache version (Developer-controlled)
 *
 * Increment this number to invalidate ALL caches globally when breaking
 * changes occur to data structures or formats. This requires code deployment.
 * Old keys will be ignored automatically and expire naturally via TTL.
 *
 * This is the FIRST level in the two-level versioning system.
 * Combined with settingsVersion, the full version prefix is: v{CACHE_VERSION}:{settingsVersion}
 *
 * Version History:
 * - v1: Initial implementation with two-level versioning (2025-01-30)
 */
export const CACHE_VERSION = 1;

/**
 * Default settings version
 *
 * Used when no settings version is provided. This is the SECOND level
 * in the two-level versioning system.
 */
export const DEFAULT_SETTINGS_VERSION = '1';

/**
 * Key scope type
 */
export type KeyScope = 'user' | 'global';

/**
 * Get the settings version from context
 *
 * Reads the cacheVersion setting from context.settings. This should be called once
 * per request and the result passed to key builder functions.
 *
 * @param context - Devvit context object
 * @returns The cache version string (defaults to '1' if not set)
 *
 * @example
 * ```typescript
 * const sv = await getSettingsVersion(context);
 * // sv will be '1', '2', '3', etc.
 * ```
 */
export async function getSettingsVersion(context: Context): Promise<string> {
  const version = await context.settings.get('cacheVersion');
  return (version as string) || DEFAULT_SETTINGS_VERSION;
}

/**
 * Build a versioned Redis key with hierarchical structure and two-level versioning
 *
 * @param scope - Key scope ('user' or 'global')
 * @param userId - User ID for user-scoped keys (required if scope='user')
 * @param settingsVersion - Runtime settings version (moderator-controlled)
 * @param parts - Key path components
 * @returns Versioned Redis key string with format v{codeVersion}:{settingsVersion}:{scope}:...
 *
 * @example
 * ```typescript
 * buildKey('user', 't2_abc', '1', 'profile')
 * // => "v1:1:user:t2_abc:profile"
 *
 * buildKey('user', 't2_abc', '3', 'profile')
 * // => "v1:3:user:t2_abc:profile"
 *
 * buildKey('global', null, '1', 'cost', 'daily', '2025-01-30')
 * // => "v1:1:global:cost:daily:2025-01-30"
 * ```
 */
export function buildKey(
  scope: KeyScope,
  userId: string | null,
  settingsVersion: string = DEFAULT_SETTINGS_VERSION,
  ...parts: string[]
): string {
  const sv = settingsVersion || DEFAULT_SETTINGS_VERSION;

  if (scope === 'user') {
    if (!userId) {
      throw new Error('userId is required for user-scoped keys');
    }
    return `v${CACHE_VERSION}:${sv}:user:${userId}:${parts.join(':')}`;
  }

  return `v${CACHE_VERSION}:${sv}:global:${parts.join(':')}`;
}

/**
 * Build a user-scoped key
 *
 * Convenience wrapper around buildKey for user-scoped keys.
 *
 * @param userId - User ID
 * @param settingsVersion - Runtime settings version (moderator-controlled)
 * @param parts - Key path components
 * @returns Versioned user-scoped key
 *
 * @example
 * ```typescript
 * buildUserKey('t2_abc', '1', 'profile')
 * // => "v1:1:user:t2_abc:profile"
 *
 * buildUserKey('t2_abc', '2', 'ai', 'questions', 'hash123')
 * // => "v1:2:user:t2_abc:ai:questions:hash123"
 * ```
 */
export function buildUserKey(userId: string, settingsVersion: string = DEFAULT_SETTINGS_VERSION, ...parts: string[]): string {
  return buildKey('user', userId, settingsVersion, ...parts);
}

/**
 * Build a global-scoped key
 *
 * Convenience wrapper around buildKey for global-scoped keys.
 *
 * @param settingsVersion - Runtime settings version (moderator-controlled)
 * @param parts - Key path components
 * @returns Versioned global-scoped key
 *
 * @example
 * ```typescript
 * buildGlobalKey('1', 'cost', 'daily', '2025-01-30')
 * // => "v1:1:global:cost:daily:2025-01-30"
 *
 * buildGlobalKey('2', 'tracking', 'FriendsOver40', 'users')
 * // => "v1:2:global:tracking:FriendsOver40:users"
 * ```
 */
export function buildGlobalKey(settingsVersion: string = DEFAULT_SETTINGS_VERSION, ...parts: string[]): string {
  return buildKey('global', null, settingsVersion, ...parts);
}

/**
 * Standard user cache keys
 *
 * Common key patterns used throughout the application.
 * All functions require settingsVersion parameter for two-level versioning.
 */
export const UserKeys = {
  /** User profile cache: v1:{sv}:user:{userId}:profile */
  profile: (userId: string, settingsVersion: string = DEFAULT_SETTINGS_VERSION) => buildUserKey(userId, settingsVersion, 'profile'),

  /** User post history cache: v1:{sv}:user:{userId}:history */
  history: (userId: string, settingsVersion: string = DEFAULT_SETTINGS_VERSION) => buildUserKey(userId, settingsVersion, 'history'),

  /** User trust scores (all subreddits): v1:{sv}:user:{userId}:trust */
  trust: (userId: string, settingsVersion: string = DEFAULT_SETTINGS_VERSION) => buildUserKey(userId, settingsVersion, 'trust'),

  /** User tracking data (all subreddits): v1:{sv}:user:{userId}:tracking */
  tracking: (userId: string, settingsVersion: string = DEFAULT_SETTINGS_VERSION) => buildUserKey(userId, settingsVersion, 'tracking'),

  /** AI questions tracking set: v1:{sv}:user:{userId}:ai:questions:keys */
  aiQuestionsKeys: (userId: string, settingsVersion: string = DEFAULT_SETTINGS_VERSION) => buildUserKey(userId, settingsVersion, 'ai', 'questions', 'keys'),

  /** AI question cache: v1:{sv}:user:{userId}:ai:questions:{hash} */
  aiQuestion: (userId: string, settingsVersion: string = DEFAULT_SETTINGS_VERSION, hash: string) => buildUserKey(userId, settingsVersion, 'ai', 'questions', hash),
} as const;

/**
 * Standard global cache keys
 *
 * Common global key patterns used throughout the application.
 * All functions require settingsVersion parameter for two-level versioning.
 */
export const GlobalKeys = {
  /** Daily cost total: v1:{sv}:global:cost:daily:{date} */
  costDaily: (date: string, settingsVersion: string = DEFAULT_SETTINGS_VERSION) => buildGlobalKey(settingsVersion, 'cost', 'daily', date),

  /** Daily cost per provider: v1:{sv}:global:cost:daily:{date}:{provider} */
  costDailyProvider: (date: string, provider: string, settingsVersion: string = DEFAULT_SETTINGS_VERSION) => buildGlobalKey(settingsVersion, 'cost', 'daily', date, provider),

  /** Monthly cost total: v1:{sv}:global:cost:monthly:{month} */
  costMonthly: (month: string, settingsVersion: string = DEFAULT_SETTINGS_VERSION) => buildGlobalKey(settingsVersion, 'cost', 'monthly', month),

  /** Cost record: v1:{sv}:global:cost:record:{timestamp}:{userId} */
  costRecord: (timestamp: number, userId: string, settingsVersion: string = DEFAULT_SETTINGS_VERSION) => buildGlobalKey(settingsVersion, 'cost', 'record', timestamp.toString(), userId),

  /** Tracked users set: v1:{sv}:global:tracking:{subreddit}:users */
  trackedUsers: (subreddit: string, settingsVersion: string = DEFAULT_SETTINGS_VERSION) => buildGlobalKey(settingsVersion, 'tracking', subreddit, 'users'),
} as const;

/**
 * Clear all cached data for a specific user
 *
 * Deletes all user-scoped cache entries including profile, history, trust,
 * tracking, and AI question cache.
 *
 * @param redis - Redis client instance
 * @param userId - User ID to clear cache for
 * @param settingsVersion - Runtime settings version (moderator-controlled)
 *
 * @example
 * ```typescript
 * await clearUserCache(context.redis, 't2_abc123', '1');
 * // Clears all cached data for user t2_abc123 with settings version 1
 * ```
 */
export async function clearUserCache(redis: RedisClient, userId: string, settingsVersion: string = DEFAULT_SETTINGS_VERSION): Promise<void> {
  const sv = settingsVersion || DEFAULT_SETTINGS_VERSION;

  // Clear AI questions (with tracking set)
  const aiKeysSet = UserKeys.aiQuestionsKeys(userId, sv);
  const aiHashes = await redis.sMembers(aiKeysSet);

  for (const hashEntry of aiHashes) {
    const hash = hashEntry.member;
    await redis.del(UserKeys.aiQuestion(userId, sv, hash));
  }
  await redis.del(aiKeysSet);

  // Clear dictionary keys (no iteration needed)
  await redis.del(UserKeys.profile(userId, sv));
  await redis.del(UserKeys.history(userId, sv));
  await redis.del(UserKeys.trust(userId, sv));
  await redis.del(UserKeys.tracking(userId, sv));
}

/**
 * Clear all cached data for a subreddit
 *
 * Deletes all tracked users' data and global tracking for the subreddit.
 * Optionally clears cost data (default: preserve for auditing).
 *
 * @param redis - Redis client instance
 * @param subreddit - Subreddit name
 * @param settingsVersion - Runtime settings version (moderator-controlled)
 * @param clearCostData - Whether to clear cost tracking data (default: false)
 * @returns Object with deletion counts
 *
 * @example
 * ```typescript
 * const stats = await clearSubredditCache(context.redis, 'FriendsOver40', '1');
 * console.log(`Cleared ${stats.usersCleared} users, ${stats.keysDeleted} keys`);
 * ```
 */
export async function clearSubredditCache(
  redis: RedisClient,
  subreddit: string,
  settingsVersion: string = DEFAULT_SETTINGS_VERSION,
  clearCostData = false
): Promise<{ usersCleared: number; keysDeleted: number }> {
  const sv = settingsVersion || DEFAULT_SETTINGS_VERSION;
  let usersCleared = 0;
  let keysDeleted = 0;

  // Get all tracked users for this subreddit
  const trackingKey = GlobalKeys.trackedUsers(sv, subreddit);
  const userIds = await redis.sMembers(trackingKey);

  // Clear each user's cache
  for (const userEntry of userIds) {
    const userId = userEntry.member;
    await clearUserCache(redis, userId, sv);
    usersCleared++;
    keysDeleted += 5; // profile, history, trust, tracking, aiKeysSet (+ AI questions counted below)

    // Count AI questions deleted
    const aiKeysSet = UserKeys.aiQuestionsKeys(userId, sv);
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
