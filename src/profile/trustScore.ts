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
 * TrustScoreCalculator - Calculates and manages user trust scores
 *
 * Trust scores are calculated based on multiple factors:
 * - Account age (0-40 points)
 * - Karma (0-30 points)
 * - Email verification (0-15 points)
 * - Approved post history in the subreddit (0-15 points)
 *
 * Users with scores >= 70 are marked as "trusted" for fast lookups.
 * Scores are cached for 7 days to reduce computation.
 */

import { RedisClient } from '@devvit/public-api';
import { TrustScore, UserProfile, UserPostHistory, DEFAULT_PROFILE_CONFIG } from '../types/profile.js';
import { RedisStorage } from '../storage/redis.js';
import { StorageKey, buildKey } from '../types/storage.js';

export class TrustScoreCalculator {
  private storage: RedisStorage;
  private readonly TRUST_SCORE_TTL = 604800000; // 7 days in milliseconds

  constructor(redis: RedisClient) {
    this.storage = new RedisStorage(redis);
  }

  /**
   * Calculate comprehensive trust score for a user
   *
   * @param profile - User's Reddit profile data
   * @param _history - User's post history (reserved for future use)
   * @param subreddit - Subreddit context for scoring
   * @returns Calculated trust score with breakdown
   */
  async calculateTrustScore(
    profile: UserProfile,
    _history: UserPostHistory,
    subreddit: string
  ): Promise<TrustScore> {
    try {
      const userId = profile.userId;

      // Calculate individual score components
      const accountAgeScore = this.calculateAccountAgeScore(profile.accountAgeInDays);
      const karmaScore = this.calculateKarmaScore(profile.totalKarma);
      const emailScore = this.calculateEmailScore(profile.emailVerified);

      // Get approved post count for this subreddit
      const approvedCount = await this.getApprovedPostCount(userId, subreddit);
      const approvedHistoryScore = this.calculateApprovedHistoryScore(approvedCount);

      // Calculate total score
      const totalScore = accountAgeScore + karmaScore + emailScore + approvedHistoryScore;

      // Determine if user is trusted based on threshold
      const threshold = DEFAULT_PROFILE_CONFIG.trustThreshold;
      const isTrusted = totalScore >= threshold;

      // Create trust score object
      const trustScore: TrustScore = {
        userId,
        subreddit,
        totalScore,
        breakdown: {
          accountAgeScore: accountAgeScore,
          karmaScore: karmaScore,
          emailVerifiedScore: emailScore,
          approvedHistoryScore: approvedHistoryScore
        },
        isTrusted,
        threshold,
        calculatedAt: new Date(),
        expiresAt: new Date(Date.now() + this.TRUST_SCORE_TTL)
      };

      // Store the trust score in cache
      await this.storeTrustScore(trustScore);

      // If user is trusted, store a fast-lookup flag
      if (isTrusted) {
        await this.storeTrustedFlag(userId, subreddit);
        console.log(`[TrustScore] User ${userId} achieved trusted status in r/${subreddit} with score ${totalScore}/${threshold}`);
      }

      console.log(`[TrustScore] Calculated score for ${userId} in r/${subreddit}: ${totalScore} (Age: ${accountAgeScore}, Karma: ${karmaScore}, Email: ${emailScore}, Approved: ${approvedHistoryScore})`);

      return trustScore;
    } catch (error) {
      console.error('[TrustScore] Error calculating trust score:', error);

      // Return a minimal safe score on error
      return {
        userId: profile.userId,
        subreddit,
        totalScore: 0,
        breakdown: {
          accountAgeScore: 0,
          karmaScore: 0,
          emailVerifiedScore: 0,
          approvedHistoryScore: 0
        },
        isTrusted: false,
        threshold: DEFAULT_PROFILE_CONFIG.trustThreshold,
        calculatedAt: new Date(),
        expiresAt: new Date(Date.now() + this.TRUST_SCORE_TTL)
      };
    }
  }

  /**
   * Fast check if user is trusted in a subreddit
   * Uses cached trusted flag for optimal performance
   *
   * @param userId - Reddit user ID
   * @param subreddit - Subreddit name
   * @returns True if user is trusted
   */
  async isTrustedUser(userId: string, subreddit: string): Promise<boolean> {
    try {
      const key = buildKey(StorageKey.TRUSTED_USER, subreddit, 'trusted', userId);
      const isTrusted = await this.storage.get<boolean>(key);
      return isTrusted === true;
    } catch (error) {
      console.error('[TrustScore] Error checking trusted status:', error);
      return false;
    }
  }

  /**
   * Invalidate cached trust score for a user
   * Call this when a user receives a negative moderation action
   *
   * @param userId - Reddit user ID
   * @param subreddit - Subreddit name
   */
  async invalidateTrustScore(userId: string, subreddit: string): Promise<void> {
    try {
      // Remove trust score cache
      const scoreKey = buildKey(StorageKey.USER_TRUST_SCORE, userId, 'trustScore');
      await this.storage.delete(scoreKey);

      // Remove trusted flag
      const trustedKey = buildKey(StorageKey.TRUSTED_USER, subreddit, 'trusted', userId);
      await this.storage.delete(trustedKey);

      console.log(`[TrustScore] Invalidated trust score for ${userId} in r/${subreddit}`);
    } catch (error) {
      console.error('[TrustScore] Error invalidating trust score:', error);
    }
  }

  /**
   * Get count of approved posts for user in subreddit
   * For Phase 1.2, uses a simple counter maintained by handlers
   *
   * @param userId - Reddit user ID
   * @param subreddit - Subreddit name
   * @returns Count of approved posts
   */
  private async getApprovedPostCount(userId: string, subreddit: string): Promise<number> {
    try {
      const key = buildKey(StorageKey.USER_APPROVED_COUNT, userId, subreddit, 'approved');
      const count = await this.storage.get<number>(key);
      return count || 0;
    } catch (error) {
      console.error('[TrustScore] Error getting approved post count:', error);
      return 0;
    }
  }

  /**
   * Calculate account age score (0-40 points)
   *
   * Scoring:
   * - < 7 days: 0 points
   * - 7-30 days: 10 points
   * - 30-90 days: 20 points
   * - 90-365 days: 30 points
   * - >= 365 days: 40 points
   *
   * @param accountAgeInDays - Age of account in days
   * @returns Score between 0-40
   */
  private calculateAccountAgeScore(accountAgeInDays: number): number {
    if (accountAgeInDays < 7) return 0;
    if (accountAgeInDays < 30) return 10;
    if (accountAgeInDays < 90) return 20;
    if (accountAgeInDays < 365) return 30;
    return 40;
  }

  /**
   * Calculate karma score (0-30 points)
   *
   * Scoring:
   * - < 10 karma: 0 points
   * - 10-100 karma: 5 points
   * - 100-500 karma: 10 points
   * - 500-1000 karma: 15 points
   * - 1000-5000 karma: 20 points
   * - >= 5000 karma: 30 points
   *
   * @param totalKarma - Combined post + comment karma
   * @returns Score between 0-30
   */
  private calculateKarmaScore(totalKarma: number): number {
    if (totalKarma < 10) return 0;
    if (totalKarma < 100) return 5;
    if (totalKarma < 500) return 10;
    if (totalKarma < 1000) return 15;
    if (totalKarma < 5000) return 20;
    return 30;
  }

  /**
   * Calculate email verification score (0-15 points)
   *
   * Scoring:
   * - Not verified: 0 points
   * - Verified: 15 points
   *
   * @param emailVerified - Whether user has verified email
   * @returns Score of 0 or 15
   */
  private calculateEmailScore(emailVerified: boolean): number {
    return emailVerified ? 15 : 0;
  }

  /**
   * Calculate approved history score (0-15 points)
   *
   * Scoring based on approved posts in THIS subreddit:
   * - 0 approved posts: 0 points
   * - 1-2 approved posts: 5 points
   * - 3-5 approved posts: 10 points
   * - > 5 approved posts: 15 points
   *
   * @param approvedCount - Number of approved posts in subreddit
   * @returns Score between 0-15
   */
  private calculateApprovedHistoryScore(approvedCount: number): number {
    if (approvedCount === 0) return 0;
    if (approvedCount <= 2) return 5;
    if (approvedCount <= 5) return 10;
    return 15;
  }

  /**
   * Store trust score in cache
   *
   * @param trustScore - Calculated trust score
   */
  private async storeTrustScore(trustScore: TrustScore): Promise<void> {
    try {
      const key = buildKey(StorageKey.USER_TRUST_SCORE, trustScore.userId, 'trustScore');

      // Serialize dates to ISO strings for storage
      const serialized = {
        ...trustScore,
        calculatedAt: trustScore.calculatedAt.toISOString(),
        expiresAt: trustScore.expiresAt.toISOString()
      };

      await this.storage.set(key, serialized, this.TRUST_SCORE_TTL);
    } catch (error) {
      console.error('[TrustScore] Error storing trust score:', error);
    }
  }

  /**
   * Store trusted flag for fast lookups
   *
   * @param userId - Reddit user ID
   * @param subreddit - Subreddit name
   */
  private async storeTrustedFlag(userId: string, subreddit: string): Promise<void> {
    try {
      const key = buildKey(StorageKey.TRUSTED_USER, subreddit, 'trusted', userId);
      await this.storage.set(key, true, this.TRUST_SCORE_TTL);
    } catch (error) {
      console.error('[TrustScore] Error storing trusted flag:', error);
    }
  }

  /**
   * Increment approved post count for user in subreddit
   * Called by handlers when a post is approved
   *
   * @param userId - Reddit user ID
   * @param subreddit - Subreddit name
   */
  async incrementApprovedCount(userId: string, subreddit: string): Promise<void> {
    try {
      const key = buildKey(StorageKey.USER_APPROVED_COUNT, userId, subreddit, 'approved');
      const currentCount = await this.storage.get<number>(key) || 0;

      // Store with no expiration - this is permanent history
      await this.storage.set(key, currentCount + 1);

      console.log(`[TrustScore] Incremented approved count for ${userId} in r/${subreddit}: ${currentCount + 1}`);
    } catch (error) {
      console.error('[TrustScore] Error incrementing approved count:', error);
    }
  }

  /**
   * Retrieve cached trust score if available and not expired
   *
   * @param userId - Reddit user ID
   * @returns Cached trust score or null if not found/expired
   */
  async getCachedTrustScore(userId: string): Promise<TrustScore | null> {
    try {
      const key = buildKey(StorageKey.USER_TRUST_SCORE, userId, 'trustScore');
      const cached = await this.storage.get<any>(key);

      if (!cached) {
        return null;
      }

      // Deserialize dates
      const trustScore: TrustScore = {
        ...cached,
        calculatedAt: new Date(cached.calculatedAt),
        expiresAt: new Date(cached.expiresAt)
      };

      // Check if expired
      if (trustScore.expiresAt < new Date()) {
        console.log(`[TrustScore] Cached score for ${userId} has expired`);
        await this.storage.delete(key);
        return null;
      }

      return trustScore;
    } catch (error) {
      console.error('[TrustScore] Error retrieving cached trust score:', error);
      return null;
    }
  }
}
