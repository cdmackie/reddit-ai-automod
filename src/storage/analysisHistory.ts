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
 * Analysis History Storage
 *
 * Stores AI analysis results in Redis for later viewing by moderators.
 * Provides audit trail of AI decisions with full context.
 */

import { RedisClient } from '@devvit/public-api';

/**
 * AI analysis history entry stored in Redis
 */
export interface AnalysisHistoryEntry {
  /** Post or comment ID (with t3_ or t1_ prefix) */
  contentId: string;
  /** Author username */
  authorName: string;
  /** Action taken by AI Automod */
  action: 'REMOVE' | 'FLAG' | 'COMMENT' | 'APPROVE';
  /** Name of the rule that matched */
  ruleName: string;
  /** Timestamp of the action (ISO string) */
  timestamp: string;
  /** User trust score (0-100) */
  trustScore: number;
  /** Account age in days */
  accountAgeInDays: number;
  /** Total karma */
  totalKarma: number;
  /** AI provider used */
  aiProvider?: string;
  /** AI model name */
  aiModel?: string;
  /** AI confidence percentage */
  confidence?: number;
  /** AI reasoning text */
  aiReasoning?: string;
  /** Rule reason text */
  ruleReason?: string;
}

/**
 * Redis key prefix for analysis history
 */
const ANALYSIS_KEY_PREFIX = 'ai_analysis:';

/**
 * TTL for analysis history entries (90 days in seconds)
 */
const ANALYSIS_TTL = 90 * 24 * 60 * 60;

/**
 * Save AI analysis result to Redis
 *
 * @param redis - Redis client
 * @param entry - Analysis history entry to save
 */
export async function saveAnalysisHistory(
  redis: RedisClient,
  entry: AnalysisHistoryEntry
): Promise<void> {
  const key = `${ANALYSIS_KEY_PREFIX}${entry.contentId}`;

  try {
    // Store as JSON
    await redis.set(key, JSON.stringify(entry), {
      expiration: new Date(Date.now() + ANALYSIS_TTL * 1000),
    });

    console.log(`Saved analysis history for ${entry.contentId}`);
  } catch (error) {
    console.error('Failed to save analysis history:', {
      error: error instanceof Error ? error.message : String(error),
      contentId: entry.contentId,
    });
    // Don't throw - storage failure shouldn't block action execution
  }
}

/**
 * Retrieve AI analysis result from Redis
 *
 * @param redis - Redis client
 * @param contentId - Post or comment ID (with t3_ or t1_ prefix)
 * @returns Analysis history entry or null if not found
 */
export async function getAnalysisHistory(
  redis: RedisClient,
  contentId: string
): Promise<AnalysisHistoryEntry | null> {
  const key = `${ANALYSIS_KEY_PREFIX}${contentId}`;

  try {
    const data = await redis.get(key);

    if (!data) {
      console.log(`No analysis history found for ${contentId}`);
      return null;
    }

    const entry = JSON.parse(data) as AnalysisHistoryEntry;
    console.log(`Retrieved analysis history for ${contentId}`);
    return entry;
  } catch (error) {
    console.error('Failed to retrieve analysis history:', {
      error: error instanceof Error ? error.message : String(error),
      contentId,
    });
    return null;
  }
}

/**
 * Check if analysis history exists for a post/comment
 *
 * @param redis - Redis client
 * @param contentId - Post or comment ID (with t3_ or t1_ prefix)
 * @returns True if history exists, false otherwise
 */
export async function hasAnalysisHistory(
  redis: RedisClient,
  contentId: string
): Promise<boolean> {
  const key = `${ANALYSIS_KEY_PREFIX}${contentId}`;

  try {
    const data = await redis.get(key);
    return data !== null;
  } catch (error) {
    console.error('Failed to check analysis history:', {
      error: error instanceof Error ? error.message : String(error),
      contentId,
    });
    return false;
  }
}
