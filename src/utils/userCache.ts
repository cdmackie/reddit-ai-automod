/**
 * User cache helper for approved users and moderators
 *
 * Provides caching system to avoid repeated API calls for checking
 * if users are approved contributors or moderators of a subreddit.
 *
 * Phase 5.32: Skip approved users with caching
 * Phase 5.34: Skip moderators with caching
 */

import { RedditAPIClient } from '@devvit/public-api';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory cache (persists during app lifetime)
const approvedUsersCache = new Map<string, CacheEntry<Set<string>>>();
const moderatorsCache = new Map<string, CacheEntry<Set<string>>>();

/**
 * Get approved users for a subreddit with caching
 *
 * @param reddit - Reddit API client
 * @param subredditName - Name of the subreddit
 * @returns Set of approved usernames (lowercase)
 */
export async function getApprovedUsers(
  reddit: RedditAPIClient,
  subredditName: string
): Promise<Set<string>> {
  const cached = approvedUsersCache.get(subredditName);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const subreddit = await reddit.getSubredditByName(subredditName);
    const approvedUsers = await subreddit.getApprovedUsers().all();
    const usernames = new Set(approvedUsers.map(u => u.username.toLowerCase()));

    approvedUsersCache.set(subredditName, {
      data: usernames,
      timestamp: Date.now()
    });

    console.log(`[UserCache] Fetched ${usernames.size} approved users for r/${subredditName}`);
    return usernames;
  } catch (error) {
    console.error(`[UserCache] Failed to fetch approved users for r/${subredditName}:`, error);
    return new Set();
  }
}

/**
 * Get moderators for a subreddit with caching
 *
 * @param reddit - Reddit API client
 * @param subredditName - Name of the subreddit
 * @returns Set of moderator usernames (lowercase)
 */
export async function getModerators(
  reddit: RedditAPIClient,
  subredditName: string
): Promise<Set<string>> {
  const cached = moderatorsCache.get(subredditName);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const subreddit = await reddit.getSubredditByName(subredditName);
    const moderators = await subreddit.getModerators().all();
    const usernames = new Set(moderators.map(m => m.username.toLowerCase()));

    moderatorsCache.set(subredditName, {
      data: usernames,
      timestamp: Date.now()
    });

    console.log(`[UserCache] Fetched ${usernames.size} moderators for r/${subredditName}`);
    return usernames;
  } catch (error) {
    console.error(`[UserCache] Failed to fetch moderators for r/${subredditName}:`, error);
    return new Set();
  }
}

/**
 * Clear all caches (useful for testing)
 */
export function clearUserCaches(): void {
  approvedUsersCache.clear();
  moderatorsCache.clear();
  console.log('[UserCache] All caches cleared');
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats(): {
  approvedUsers: { subreddits: number; entries: number };
  moderators: { subreddits: number; entries: number };
} {
  let approvedUsersCount = 0;
  approvedUsersCache.forEach(entry => {
    approvedUsersCount += entry.data.size;
  });

  let moderatorsCount = 0;
  moderatorsCache.forEach(entry => {
    moderatorsCount += entry.data.size;
  });

  return {
    approvedUsers: {
      subreddits: approvedUsersCache.size,
      entries: approvedUsersCount
    },
    moderators: {
      subreddits: moderatorsCache.size,
      entries: moderatorsCount
    }
  };
}
