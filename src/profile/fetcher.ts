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
 * User Profile Fetcher
 *
 * This module fetches basic Reddit user profile data and caches it in Redis
 * to minimize API calls. It extracts account age, karma, email verification
 * status, and other profile information used for trust score calculation.
 *
 * **Caching Strategy**:
 * - Redis key pattern: `v1:user:{userId}:profile`
 * - TTL: 24 hours (86400000 ms)
 * - Check cache first, fetch from API on miss
 * - Uses centralized key builder for version-based cache invalidation
 *
 * **Error Handling**:
 * - Invalid user ID format → Return null
 * - User not found → Return null
 * - API errors → Log error, return null (graceful degradation)
 * - Never throws exceptions, always returns null on failure
 *
 * **Usage**:
 * ```typescript
 * const fetcher = new UserProfileFetcher(redis, reddit, rateLimiter);
 * const profile = await fetcher.getUserProfile('t2_abc123');
 * if (profile) {
 *   console.log(`User ${profile.username} has ${profile.totalKarma} karma`);
 * }
 * ```
 */

import { RedisClient, RedditAPIClient } from '@devvit/public-api';
import { UserProfile, DEFAULT_PROFILE_CONFIG } from '../types/profile';
import { RateLimiter } from './rateLimiter';
import { ProfileCache } from '../storage/cacheOperations.js';

/**
 * Fetches and caches user profile data from Reddit
 */
export class UserProfileFetcher {
  private cache: ProfileCache;
  private cacheTTL: number;

  constructor(
    redis: RedisClient,
    private reddit: RedditAPIClient,
    private rateLimiter: RateLimiter,
    settingsVersion: string
  ) {
    this.cache = new ProfileCache(redis, settingsVersion);
    this.cacheTTL = DEFAULT_PROFILE_CONFIG.profileCacheTTL;
  }

  /**
   * Get user profile data (from cache or Reddit API)
   *
   * This is the main public method. It:
   * 1. Validates the user ID format
   * 2. Checks Redis cache for existing profile data
   * 3. If cache miss, fetches from Reddit API and caches the result
   * 4. Handles all errors gracefully by returning null
   *
   * @param userId - Reddit user ID (format: t2_xxxxx)
   * @returns User profile data or null if not found/error
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    // Validate user ID format
    if (!this.validateUserId(userId)) {
      console.error(`[ProfileFetcher] Invalid user ID format: ${userId}`);
      return null;
    }

    try {
      // Check cache first
      const cached = await this.cache.get(userId);

      if (cached) {
        console.log(`[ProfileFetcher] Cache hit for user ${userId}`);
        // Deserialize Date objects
        return {
          ...cached,
          fetchedAt: new Date(cached.fetchedAt),
        };
      }

      console.log(`[ProfileFetcher] Cache miss for user ${userId}, fetching from API`);

      // Fetch from Reddit API
      const profile = await this.fetchFromReddit(userId);

      if (!profile) {
        return null;
      }

      // Cache the result
      await this.cache.set(profile.userId, profile, this.cacheTTL);

      console.log(`[ProfileFetcher] Successfully fetched and cached profile for ${profile.username}`);
      return profile;
    } catch (error) {
      console.error(`[ProfileFetcher] Error fetching profile for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Fetch user profile from Reddit API
   *
   * This method:
   * 1. Uses rate limiter to prevent hitting API limits
   * 2. Fetches user data via Reddit API
   * 3. Calculates derived fields (account age, total karma)
   * 4. Returns structured UserProfile object
   *
   * @param userId - Reddit user ID (format: t2_xxxxx)
   * @returns User profile data or null if user not found/error
   * @private
   */
  private async fetchFromReddit(userId: string): Promise<UserProfile | null> {
    try {
      // Fetch user with rate limiting and retry logic
      const user = await this.rateLimiter.withRetry(async () => {
        return await this.reddit.getUserById(userId);
      });

      if (!user) {
        console.warn(`[ProfileFetcher] User not found: ${userId}`);
        return null;
      }

      // Calculate account age in days
      const accountAgeInDays = Math.floor(
        (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate total karma
      const totalKarma = user.linkKarma + user.commentKarma;

      // Build UserProfile object
      const profile: UserProfile = {
        userId: userId,
        username: user.username,
        accountAgeInDays,
        commentKarma: user.commentKarma,
        postKarma: user.linkKarma,
        totalKarma,
        // Email verification status from Devvit User API (hasVerifiedEmail field)
        emailVerified: user.hasVerifiedEmail ?? false,
        isModerator: false, // Will be set to true if user moderates any subreddit (future enhancement)
        hasUserFlair: false, // TODO: Fetch user flair from subreddit context
        hasPremium: false, // TODO: Check if Devvit exposes this property
        isVerified: false, // TODO: Check if Devvit exposes this property
        fetchedAt: new Date(),
      };

      return profile;
    } catch (error) {
      console.error(`[ProfileFetcher] API error fetching user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Validate Reddit user ID format
   *
   * Reddit user IDs follow the format "t2_xxxxx" where:
   * - "t2" is the type prefix for users
   * - "_" is the separator
   * - "xxxxx" is a base36 encoded ID
   *
   * @param userId - User ID to validate
   * @returns True if valid format, false otherwise
   * @private
   */
  private validateUserId(userId: string): boolean {
    // Reddit user IDs start with "t2_" followed by alphanumeric characters
    const userIdPattern = /^t2_[a-z0-9]+$/i;
    return userIdPattern.test(userId);
  }
}
